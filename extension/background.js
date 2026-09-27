/**
 * background.js - YListPlayer Adder Service Worker
 *
 * content.js / popup.js から chrome.runtime.sendMessage で受け取り、
 * BroadcastChannel 経由で YListPlayer タブと通信する。
 *
 * YListPlayer タブが存在しない場合は一時タブを開き、
 * 処理完了後に自動で閉じる。
 */

const CHANNEL_NAME = 'ylistplayer';
const REQUEST_TIMEOUT_MS = 10000;

// ─── グローバルロック（処理の重複実行を防ぐ）─────────────────────────────────
// Service Worker はリクエストごとに起動するが、同一 SW インスタンス内では
// 複数の onMessage が並走しうるため Promise ベースのロックで直列化する。
let _pendingRequest = Promise.resolve();

function withLock(fn) {
    const next = _pendingRequest.then(() => fn()).catch(() => fn());
    _pendingRequest = next.catch(() => {});
    return next;
}

// ─── ストレージ ───────────────────────────────────────────────────────────────

async function getYListPlayerUrl() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['ylistPlayerUrl'], (result) => {
            resolve(result.ylistPlayerUrl || null);
        });
    });
}

// ─── タブ検索 ─────────────────────────────────────────────────────────────────

/**
 * 開いているタブの中から YListPlayer のタブを探す。
 * - オリジン一致（末尾スラッシュや hash の違いを吸収）
 * - status が complete のものを優先し、なければ loading も対象にする
 */
async function findYListPlayerTab(url) {
    // 末尾スラッシュ等を正規化してオリジンを取り出す
    const origin = new URL(url.trim()).origin;
    const tabs = await chrome.tabs.query({ url: `${origin}/*` });
    console.log(`[YListPlayer] findYListPlayerTab: origin=${origin}, found=${tabs.length}`);
    if (tabs.length === 0) return null;
    // complete なタブを優先
    return tabs.find(t => t.status === 'complete') ?? tabs[0];
}

// ─── BroadcastChannel 送受信 ──────────────────────────────────────────────────

/**
 * YListPlayer タブ内に executeScript でスクリプトを注入し、
 * BroadcastChannel 経由でメッセージを送って返信を待つ。
 *
 * world:'MAIN' でページ本体の window を共有し、
 * ページ内グローバルフラグで二重送信をブロックする。
 */
async function sendViaBroadcastChannel(tabId, message, replyType, timeoutMs = 5000) {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (channelName, msg, replyType, timeoutMs) => {
            const lockKey = `__ylistplayer_lock_${replyType}`;
            if (window[lockKey]) {
                return Promise.reject(new Error('BroadcastChannel request already in progress'));
            }
            window[lockKey] = true;

            return new Promise((resolve, reject) => {
                const ch = new BroadcastChannel(channelName);
                const timer = setTimeout(() => {
                    ch.close();
                    window[lockKey] = false;
                    reject(new Error('BroadcastChannel timeout'));
                }, timeoutMs);

                ch.onmessage = (event) => {
                    if (event.data?.type === replyType) {
                        clearTimeout(timer);
                        ch.close();
                        window[lockKey] = false;
                        resolve(event.data);
                    }
                };

                ch.postMessage(msg);
            });
        },
        args: [CHANNEL_NAME, message, replyType, timeoutMs],
    });

    if (results?.[0]?.result) {
        return results[0].result;
    }
    throw new Error(results?.[0]?.error?.message || 'executeScript returned no result');
}

// ─── タブ起動待ち ─────────────────────────────────────────────────────────────

async function waitForYListPlayer(tabId, timeoutMs = REQUEST_TIMEOUT_MS) {
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Tab load timeout')), timeoutMs);
        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                clearTimeout(timer);
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
    // BroadcastChannel 受信ハンドラが立ち上がるまで待つ
    await new Promise(r => setTimeout(r, 800));
}

// ─── タブ取得または作成 ───────────────────────────────────────────────────────

/**
 * YListPlayer タブを取得または作成する。
 * findYListPlayerTab と tabs.create の間に競合が起きないよう
 * 呼び出し側でグローバルロックを取ること。
 */
async function getOrCreateTab(ylistUrl) {
    const existing = await findYListPlayerTab(ylistUrl);
    if (existing) {
        return { tab: existing, isNew: false };
    }
    const tab = await chrome.tabs.create({ url: ylistUrl, active: false });
    return { tab, isNew: true };
}

// ─── ハンドラ ─────────────────────────────────────────────────────────────────

async function handleAddVideo({ videoId, title, thumbnail, playlistId }) {
    const ylistUrl = await getYListPlayerUrl();
    if (!ylistUrl) {
        throw new Error('YListPlayer の URL が設定されていません。拡張機能のポップアップから設定してください。');
    }

    // グローバルロックで直列化：findTab → create → send を atomic に扱う
    return withLock(async () => {
        const { tab, isNew } = await getOrCreateTab(ylistUrl);

        try {
            if (isNew) {
                await waitForYListPlayer(tab.id);
            }
            return await sendViaBroadcastChannel(
                tab.id,
                { type: 'ADD_VIDEO', videoId, title, thumbnail, playlistId },
                'ADD_VIDEO_DONE'
            );
        } finally {
            if (isNew) {
                chrome.tabs.remove(tab.id);
            }
        }
    });
}

async function handleGetPlaylists() {
    const ylistUrl = await getYListPlayerUrl();
    if (!ylistUrl) {
        throw new Error('YListPlayer の URL が設定されていません。');
    }

    return withLock(async () => {
        const { tab, isNew } = await getOrCreateTab(ylistUrl);

        try {
            if (isNew) {
                await waitForYListPlayer(tab.id);
            }
            return await sendViaBroadcastChannel(
                tab.id,
                { type: 'GET_PLAYLISTS' },
                'PLAYLISTS_RESULT'
            );
        } finally {
            if (isNew) {
                chrome.tabs.remove(tab.id);
            }
        }
    });
}

// ─── メッセージルーター ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ADD_VIDEO') {
        handleAddVideo(message)
            .then((result) => sendResponse({ ok: true, result }))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (message.type === 'GET_PLAYLISTS') {
        handleGetPlaylists()
            .then((result) => sendResponse({ ok: true, playlists: result.playlists }))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;
    }
});
