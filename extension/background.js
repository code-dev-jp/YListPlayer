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
const REQUEST_TIMEOUT_MS = 10000; // タブ起動待ちの最大待機時間

/**
 * chrome.storage.sync から YListPlayer の URL を取得する。
 * 未設定の場合は null を返す。
 */
async function getYListPlayerUrl() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['ylistPlayerUrl'], (result) => {
            resolve(result.ylistPlayerUrl || null);
        });
    });
}

/**
 * 開いているタブの中から YListPlayer のタブを探す。
 * 複数あれば最初の1件を返す。
 */
async function findYListPlayerTab(url) {
    const origin = new URL(url).origin;
    const tabs = await chrome.tabs.query({ url: `${origin}/*` });
    return tabs[0] || null;
}

/**
 * BroadcastChannel を使って YListPlayer タブにメッセージを送り、
 * 返信を待って resolve する。
 *
 * Service Worker 内では BroadcastChannel は使えないため、
 * chrome.scripting.executeScript でタブ内スクリプトとして実行する。
 *
 * @param {number} tabId      送信先タブID
 * @param {object} message    送信するメッセージオブジェクト
 * @param {string} replyType  待受する返信の type 文字列
 * @param {number} timeoutMs  タイムアウト（ms）
 */
async function sendViaBroadcastChannel(tabId, message, replyType, timeoutMs = 5000) {
    // タブ内で BroadcastChannel 送受信を行うスクリプトを注入する
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (channelName, msg, replyType, timeoutMs) => {
            return new Promise((resolve, reject) => {
                const ch = new BroadcastChannel(channelName);
                const timer = setTimeout(() => {
                    ch.close();
                    reject(new Error('BroadcastChannel timeout'));
                }, timeoutMs);

                ch.onmessage = (event) => {
                    if (event.data?.type === replyType) {
                        clearTimeout(timer);
                        ch.close();
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
    throw new Error('executeScript returned no result');
}

/**
 * YListPlayer が起動するまで待機する（ポーリング）。
 * タブが読み込み完了後、PING に応答するまで待つ。
 */
async function waitForYListPlayer(tabId, timeoutMs = REQUEST_TIMEOUT_MS) {
    const start = Date.now();

    // タブの読み込み完了を待つ
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

    // BroadcastChannel の受信ハンドラが立ち上がるまで少し待つ
    await new Promise(r => setTimeout(r, 800));
}

/**
 * YListPlayer タブを取得または作成する。
 * 新規作成の場合は isNew: true を返す。
 */
async function getOrCreateTab(ylistUrl) {
    const existing = await findYListPlayerTab(ylistUrl);
    if (existing) {
        return { tab: existing, isNew: false };
    }
    const tab = await chrome.tabs.create({ url: ylistUrl, active: false });
    return { tab, isNew: true };
}

/**
 * ADD_VIDEO リクエストを処理する。
 * - YListPlayer タブを探す or 作成
 * - BroadcastChannel で ADD_VIDEO を送信
 * - 完了後、自動で開いたタブなら閉じる
 */
async function handleAddVideo({ videoId, title, thumbnail, playlistId }) {
    const ylistUrl = await getYListPlayerUrl();
    if (!ylistUrl) {
        throw new Error('YListPlayer の URL が設定されていません。拡張機能のポップアップから設定してください。');
    }

    const { tab, isNew } = await getOrCreateTab(ylistUrl);

    try {
        if (isNew) {
            await waitForYListPlayer(tab.id);
        }

        const result = await sendViaBroadcastChannel(
            tab.id,
            { type: 'ADD_VIDEO', videoId, title, thumbnail, playlistId },
            'ADD_VIDEO_DONE'
        );
        return result;
    } finally {
        // 自動で開いたタブは閉じる
        if (isNew) {
            chrome.tabs.remove(tab.id);
        }
    }
}

/**
 * GET_PLAYLISTS リクエストを処理する。
 * YListPlayer からプレイリスト一覧を取得して返す。
 */
async function handleGetPlaylists() {
    const ylistUrl = await getYListPlayerUrl();
    if (!ylistUrl) {
        throw new Error('YListPlayer の URL が設定されていません。');
    }

    const { tab, isNew } = await getOrCreateTab(ylistUrl);

    try {
        if (isNew) {
            await waitForYListPlayer(tab.id);
        }

        const result = await sendViaBroadcastChannel(
            tab.id,
            { type: 'GET_PLAYLISTS' },
            'PLAYLISTS_RESULT'
        );
        return result;
    } finally {
        if (isNew) {
            chrome.tabs.remove(tab.id);
        }
    }
}

// ─── メッセージルーター ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ADD_VIDEO') {
        handleAddVideo(message)
            .then((result) => sendResponse({ ok: true, result }))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true; // 非同期応答
    }

    if (message.type === 'GET_PLAYLISTS') {
        handleGetPlaylists()
            .then((result) => sendResponse({ ok: true, playlists: result.playlists }))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;
    }
});
