/**
 * content.js - YListPlayer Adder Content Script
 *
 * YouTube の動画ページ（/watch?v=...）に「YListPlayerに追加」ボタンを注入する。
 * YouTube は SPA のため MutationObserver で DOM 変化を監視し、
 * ページ遷移ごとに再注入する。
 */

const BUTTON_ID = 'ylistplayer-add-btn';
const INJECTED_ATTR = 'data-ylistplayer-injected';

// ─── ボタン作成 ───────────────────────────────────────────────────────────────

function createAddButton(defaultPlaylistId) {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.textContent = '＋ YListPlayer に追加';
    btn.title = 'YListPlayer のプレイリストに追加する';

    Object.assign(btn.style, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        marginLeft: '8px',
        padding: '0 12px',
        height: '36px',
        borderRadius: '18px',
        border: 'none',
        background: '#1a73e8',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        fontFamily: 'Roboto, Arial, sans-serif',
        flexShrink: '0',
        transition: 'background 0.2s',
    });

    btn.addEventListener('mouseenter', () => {
        btn.style.background = '#1558b0';
    });
    btn.addEventListener('mouseleave', () => {
        btn.style.background = '#1a73e8';
    });

    btn.addEventListener('click', () => handleAddVideo(defaultPlaylistId));

    return btn;
}

// ─── 動画情報取得 ─────────────────────────────────────────────────────────────

function getVideoId() {
    const params = new URLSearchParams(location.search);
    return params.get('v');
}

function getVideoTitle() {
    // YouTube の動画タイトル要素（複数のセレクタを順に試す）
    const selectors = [
        'h1.ytd-watch-metadata yt-formatted-string',
        'h1.title.ytd-video-primary-info-renderer',
        '#title h1',
        'h1.ytd-video-primary-info-renderer',
    ];
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) return el.textContent.trim();
    }
    return document.title.replace(' - YouTube', '').trim() || 'Unknown';
}

function getThumbnailUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/default.jpg`;
}

// ─── ボタン挿入先の検索 ───────────────────────────────────────────────────────

/**
 * YouTube のボタン行（like/dislike/share 等が並ぶ行）を探す。
 * DOM 構造が変わりやすいため複数パターンを試みる。
 */
function findInsertionTarget() {
    const candidates = [
        // 新 UI
        '#actions-inner #top-level-buttons-computed',
        '#actions #top-level-buttons-computed',
        'ytd-watch-metadata #actions',
        // 旧 UI
        '#top-level-buttons',
        '#menu-container #top-level-buttons',
    ];
    for (const sel of candidates) {
        const el = document.querySelector(sel);
        if (el) return el;
    }
    return null;
}

// ─── ボタン注入 ───────────────────────────────────────────────────────────────

async function injectButton() {
    const videoId = getVideoId();
    if (!videoId) return;

    // 既に注入済みなら再注入不要
    if (document.getElementById(BUTTON_ID)) return;

    const target = findInsertionTarget();
    if (!target) return;

    // 同じ target に複数注入しない
    if (target.getAttribute(INJECTED_ATTR)) return;
    target.setAttribute(INJECTED_ATTR, '1');

    // storage からデフォルトプレイリストIDを取得
    const { defaultPlaylistId } = await chrome.storage.sync.get(['defaultPlaylistId']);

    const btn = createAddButton(defaultPlaylistId ?? null);
    target.appendChild(btn);
}

// ─── 動画追加処理 ─────────────────────────────────────────────────────────────

async function handleAddVideo(defaultPlaylistId) {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;

    const videoId = getVideoId();
    if (!videoId) return;

    // ボタンを無効化してフィードバックを表示
    btn.disabled = true;
    btn.textContent = '追加中…';
    btn.style.background = '#555';

    const title = getVideoTitle();
    const thumbnail = getThumbnailUrl(videoId);

    // storage から最新のデフォルトプレイリストIDを再取得
    const { defaultPlaylistId: latestPlaylistId } = await chrome.storage.sync.get(['defaultPlaylistId']);

    const response = await chrome.runtime.sendMessage({
        type: 'ADD_VIDEO',
        videoId,
        title,
        thumbnail,
        playlistId: latestPlaylistId ?? defaultPlaylistId ?? null,
    });

    if (response?.ok) {
        btn.textContent = '✓ 追加済み';
        btn.style.background = '#188038';
        // 3秒後に元に戻す
        setTimeout(() => {
            btn.textContent = '＋ YListPlayer に追加';
            btn.style.background = '#1a73e8';
            btn.disabled = false;
        }, 3000);
    } else {
        btn.textContent = '✗ 失敗';
        btn.style.background = '#d93025';
        setTimeout(() => {
            btn.textContent = '＋ YListPlayer に追加';
            btn.style.background = '#1a73e8';
            btn.disabled = false;
        }, 3000);
        console.error('[YListPlayer Adder]', response?.error);
    }
}

// ─── SPA 対応：ページ遷移監視 ─────────────────────────────────────────────────

let lastVideoId = null;
let injectTimer = null;

function scheduleInject() {
    clearTimeout(injectTimer);
    injectTimer = setTimeout(() => {
        const videoId = getVideoId();
        if (!videoId) return;

        // 別の動画に遷移したらボタンをリセット
        if (videoId !== lastVideoId) {
            const old = document.getElementById(BUTTON_ID);
            if (old) old.remove();
            // 挿入済みフラグをリセット
            document.querySelectorAll(`[${INJECTED_ATTR}]`).forEach(el => {
                el.removeAttribute(INJECTED_ATTR);
            });
            lastVideoId = videoId;
        }

        injectButton();
    }, 1000); // DOM が安定するまで少し待つ
}

// YouTube の SPA ナビゲーションイベント
document.addEventListener('yt-navigate-finish', scheduleInject);

// MutationObserver でボタン行が後から生成される場合に対応
const observer = new MutationObserver(() => {
    if (getVideoId() && !document.getElementById(BUTTON_ID)) {
        scheduleInject();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

// 初回実行
scheduleInject();
