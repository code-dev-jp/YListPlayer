/**
 * background.js - YListPlayer Adder Service Worker
 *
 * バックエンドなしで動作する。
 *  - 動画追加: YListPlayer のタブを開く/切り替え、URL クエリパラメータ経由で動画情報を渡して画面側で登録。
 *  - プレイリスト一覧取得: 開いている YListPlayer タブの IndexedDB から chrome.scripting.executeScript 経由で取得。
 */

// ─── ストレージ ───────────────────────────────────────────────────────────────

async function getYListPlayerUrl() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['ylistPlayerUrl'], (result) => {
            resolve(result.ylistPlayerUrl || null);
        });
    });
}

// ─── URL の正規化 ─────────────────────────────────────────────────────────────

function normalizeUrl(urlStr) {
    if (!urlStr) return '';
    try {
        const u = new URL(urlStr);
        return `${u.origin}${u.pathname}`.replace(/\/$/, '').toLowerCase();
    } catch {
        return urlStr.replace(/\/$/, '').toLowerCase();
    }
}

function getOrigin(urlStr) {
    if (!urlStr) return '';
    try {
        return new URL(urlStr).origin.toLowerCase();
    } catch {
        return '';
    }
}

// ─── 開いている YListPlayer タブの検索 ───────────────────────────────────────

async function findYListPlayerTab(baseUrl) {
    if (!baseUrl) return null;

    const targetNorm = normalizeUrl(baseUrl);
    const targetOrigin = getOrigin(baseUrl);

    try {
        const allTabs = await chrome.tabs.query({});
        for (const tab of allTabs) {
            if (!tab.url) continue;

            const tabNorm = normalizeUrl(tab.url);
            const tabOrigin = getOrigin(tab.url);

            // 1. URL 完全/前方一致チェック (例: http://localhost:5173 と http://localhost:5173/?addVideoId=...)
            if (tabNorm === targetNorm || tabNorm.startsWith(targetNorm) || targetNorm.startsWith(tabNorm)) {
                return tab;
            }

            // 2. Origin (Protocol + Host + Port) 一致チェック (例: http://localhost:5173 と http://localhost:5173/path)
            if (targetOrigin && tabOrigin === targetOrigin) {
                return tab;
            }

            // 3. タイトルによるチェック (YListPlayer 画面が開いている場合)
            if (tab.title && tab.title.toLowerCase().includes('ylistplayer')) {
                return tab;
            }
        }
    } catch (e) {
        console.error('[YListPlayer background] Error querying tabs:', e);
    }
    return null;
}

// ─── ADD_VIDEO ────────────────────────────────────────────────────────────────

async function handleAddVideo({ videoId, title, thumbnail, playlistId }) {
    const baseUrl = await getYListPlayerUrl();
    if (!baseUrl) {
        throw new Error('YListPlayer の URL が設定されていません。拡張機能のポップアップから設定してください。');
    }

    const params = new URLSearchParams({
        addVideoId: videoId,
        title: title ?? videoId,
        thumbnail: thumbnail ?? `https://img.youtube.com/vi/${videoId}/default.jpg`,
        ...(playlistId != null ? { playlistId: String(playlistId) } : {}),
    });

    const base = baseUrl.replace(/\/$/, '');
    const targetUrl = `${base}/?${params.toString()}`;

    const existingTab = await findYListPlayerTab(baseUrl);
    if (existingTab && existingTab.id != null) {
        await chrome.tabs.update(existingTab.id, { url: targetUrl, active: true });
        if (existingTab.windowId != null) {
            await chrome.windows.update(existingTab.windowId, { focused: true });
        }
    } else {
        await chrome.tabs.create({ url: targetUrl, active: true });
    }

    return { ok: true };
}

// ─── GET_PLAYLISTS ────────────────────────────────────────────────────────────

async function handleGetPlaylists() {
    const baseUrl = await getYListPlayerUrl();
    if (!baseUrl) {
        throw new Error('YListPlayer の URL が設定されていません。拡張機能のポップアップから設定してください。');
    }

    const tab = await findYListPlayerTab(baseUrl);
    if (!tab || tab.id == null) {
        throw new Error('YListPlayer のタブが開いていません。「YListPlayer を開く」ボタンから開いてから再試行してください。');
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
            return new Promise((resolve) => {
                const req = indexedDB.open('YListPlayerDB');
                req.onerror = () => resolve([]);
                req.onsuccess = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains('playlists')) {
                        resolve([]);
                        return;
                    }
                    const tx = db.transaction('playlists', 'readonly');
                    const store = tx.objectStore('playlists');
                    const getAllReq = store.getAll();
                    getAllReq.onsuccess = () => resolve(getAllReq.result || []);
                    getAllReq.onerror = () => resolve([]);
                };
            });
        },
    });

    const playlists = results?.[0]?.result || [];
    return { ok: true, playlists };
}

// ─── メッセージルーター ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ADD_VIDEO') {
        handleAddVideo(message)
            .then((res) => sendResponse(res))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (message.type === 'GET_PLAYLISTS') {
        handleGetPlaylists()
            .then((result) => sendResponse(result))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;
    }
});
