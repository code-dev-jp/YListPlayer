/**
 * popup.js - YListPlayer Adder Popup
 *
 * 機能:
 *  - YListPlayer の URL を storage.sync に保存・読み込み
 *  - BroadcastChannel 経由でプレイリスト一覧を取得・選択
 *  - デフォルトプレイリストを storage.sync に保存
 *  - 現在タブが YouTube /watch なら「追加」ボタンを有効化
 */

// ─── DOM 参照 ─────────────────────────────────────────────────────────────────

const elCurrentVideo  = document.getElementById('current-video');
const elBtnAddCurrent = document.getElementById('btn-add-current');
const elAddStatus     = document.getElementById('add-status');
const elSelectPlaylist= document.getElementById('select-playlist');
const elBtnRefresh    = document.getElementById('btn-refresh');
const elPlaylistStatus= document.getElementById('playlist-status');
const elInputUrl      = document.getElementById('input-url');
const elBtnSaveUrl    = document.getElementById('btn-save-url');
const elBtnOpenUrl    = document.getElementById('btn-open-url');
const elUrlStatus     = document.getElementById('url-status');

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function showStatus(el, type, message) {
    el.className = `status ${type}`;
    el.textContent = message;
    if (type === 'success') {
        setTimeout(() => { el.className = 'status'; el.textContent = ''; }, 3000);
    }
}

function getVideoIdFromUrl(url) {
    try {
        const params = new URL(url).searchParams;
        return params.get('v');
    } catch {
        return null;
    }
}

// ─── 初期化：設定読み込み ─────────────────────────────────────────────────────

async function loadSettings() {
    const { ylistPlayerUrl, defaultPlaylistId } = await chrome.storage.sync.get([
        'ylistPlayerUrl',
        'defaultPlaylistId',
    ]);

    if (ylistPlayerUrl) {
        elInputUrl.value = ylistPlayerUrl;
    }

    return { ylistPlayerUrl, defaultPlaylistId };
}

// ─── 現在のタブを確認 ─────────────────────────────────────────────────────────

async function checkCurrentTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return null;

    const videoId = getVideoIdFromUrl(tab.url || '');
    if (!videoId) {
        elCurrentVideo.className = 'current-video none';
        elCurrentVideo.textContent = 'YouTube の動画ページを開いてください';
        elBtnAddCurrent.disabled = true;
        return null;
    }

    const title = tab.title?.replace(' - YouTube', '').trim() || `動画 ${videoId}`;
    elCurrentVideo.className = 'current-video';
    elCurrentVideo.textContent = title;
    elBtnAddCurrent.disabled = false;

    return { videoId, title, thumbnail: `https://img.youtube.com/vi/${videoId}/default.jpg` };
}

// ─── プレイリスト一覧の取得・表示 ─────────────────────────────────────────────

async function loadPlaylists(selectedId) {
    elBtnRefresh.disabled = true;
    elBtnRefresh.textContent = '…';
    showStatus(elPlaylistStatus, 'info', 'プレイリストを取得中…');

    const response = await chrome.runtime.sendMessage({ type: 'GET_PLAYLISTS' });

    elBtnRefresh.disabled = false;
    elBtnRefresh.textContent = '↺';

    if (!response?.ok) {
        showStatus(elPlaylistStatus, 'error', response?.error || 'プレイリストの取得に失敗しました。');
        return;
    }

    const playlists = response.playlists || [];
    elPlaylistStatus.className = 'status';

    // 選択肢を再構築
    elSelectPlaylist.innerHTML = '<option value="">（未選択）</option>';
    for (const pl of playlists) {
        const opt = document.createElement('option');
        opt.value = pl.id;
        opt.textContent = pl.name;
        if (pl.id === selectedId) opt.selected = true;
        elSelectPlaylist.appendChild(opt);
    }

    if (playlists.length === 0) {
        showStatus(elPlaylistStatus, 'info', 'プレイリストがまだありません。');
    }
}

// ─── イベントハンドラ ─────────────────────────────────────────────────────────

// URL 保存
elBtnSaveUrl.addEventListener('click', async () => {
    const url = elInputUrl.value.trim();
    if (!url) {
        showStatus(elUrlStatus, 'error', 'URL を入力してください。');
        return;
    }
    try {
        new URL(url); // バリデーション
    } catch {
        showStatus(elUrlStatus, 'error', '正しい URL を入力してください。');
        return;
    }
    await chrome.storage.sync.set({ ylistPlayerUrl: url });
    showStatus(elUrlStatus, 'success', '保存しました。');
});

// YListPlayer を開く
elBtnOpenUrl.addEventListener('click', async () => {
    const url = elInputUrl.value.trim();
    if (!url) {
        showStatus(elUrlStatus, 'error', 'URL を入力してください。');
        return;
    }
    await chrome.tabs.create({ url });
    window.close();
});

// プレイリスト一覧を更新
elBtnRefresh.addEventListener('click', async () => {
    const selectedId = Number(elSelectPlaylist.value) || null;
    await loadPlaylists(selectedId);
});

// デフォルトプレイリスト変更時に保存
elSelectPlaylist.addEventListener('change', async () => {
    const id = elSelectPlaylist.value ? Number(elSelectPlaylist.value) : null;
    await chrome.storage.sync.set({ defaultPlaylistId: id });
    showStatus(elPlaylistStatus, 'success', 'デフォルトプレイリストを保存しました。');
});

// 現在のタブの動画を追加
elBtnAddCurrent.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const videoId = getVideoIdFromUrl(tab?.url || '');
    if (!videoId) return;

    elBtnAddCurrent.disabled = true;
    elBtnAddCurrent.textContent = '追加中…';
    showStatus(elAddStatus, 'info', 'YListPlayer に送信中…');

    const title = tab.title?.replace(' - YouTube', '').trim() || `動画 ${videoId}`;
    const thumbnail = `https://img.youtube.com/vi/${videoId}/default.jpg`;
    const playlistId = elSelectPlaylist.value ? Number(elSelectPlaylist.value) : null;

    const response = await chrome.runtime.sendMessage({
        type: 'ADD_VIDEO',
        videoId,
        title,
        thumbnail,
        playlistId,
    });

    elBtnAddCurrent.textContent = '＋ プレイリストに追加';
    elBtnAddCurrent.disabled = false;

    if (response?.ok) {
        showStatus(elAddStatus, 'success', '追加しました！');
    } else {
        showStatus(elAddStatus, 'error', response?.error || '追加に失敗しました。');
    }
});

// ─── 起動時処理 ───────────────────────────────────────────────────────────────

(async () => {
    const { defaultPlaylistId } = await loadSettings();
    await checkCurrentTab();
    await loadPlaylists(defaultPlaylistId ?? null);
})();
