import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    encodePlaylistToParam,
    decodeParamToPlaylist,
    getPlaylistParam,
    clearPlaylistParam,
    MAX_URL_LENGTH,
    PLAYLIST_PARAM,
} from './playlistUrl';
import type { Playlist, Video } from './db';

// location をモック（ブラウザ環境にない Node.js 上でのテスト用）
const mockLocation = {
    origin: 'https://example.com',
    pathname: '/',
    search: '',
    href: 'https://example.com/',
};

beforeEach(() => {
    vi.stubGlobal('location', { ...mockLocation });
    vi.stubGlobal('history', {
        replaceState: vi.fn((_s, _t, url: string) => {
            const u = new URL(url);
            mockLocation.search = u.search;
            mockLocation.href = url;
        }),
    });
});

// ---------------------------------------------------------------------------
// テストデータ
// ---------------------------------------------------------------------------

const playlist: Playlist = { id: 1, name: 'My List', createdAt: 0 };

const videos: Video[] = [
    {
        id: 1,
        playlistId: 1,
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'Rick Astley',
        thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg',
        order: 0,
        savedSegments: [{ start: 10, end: 30 }],
        startMarker: 5,
        endMarker: 60,
    },
    {
        id: 2,
        playlistId: 1,
        youtubeUrl: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
        title: 'PSY',
        thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/default.jpg',
        order: 1,
        savedSegments: [],
    },
];

// ---------------------------------------------------------------------------
// encode → decode ラウンドトリップ
// ---------------------------------------------------------------------------

describe('encodePlaylistToParam / decodeParamToPlaylist', () => {
    it('ラウンドトリップ: プレイリスト名が復元される', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.name).toBe('My List');
    });

    it('ラウンドトリップ: 動画数が復元される', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.videos).toHaveLength(2);
    });

    it('ラウンドトリップ: YouTube URL が再生成される', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.videos[0].youtubeUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('ラウンドトリップ: タイトルが復元される', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.videos[0].title).toBe('Rick Astley');
        expect(result.videos[1].title).toBe('PSY');
    });

    it('ラウンドトリップ: savedSegments が復元される', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.videos[0].savedSegments).toEqual([{ start: 10, end: 30 }]);
        expect(result.videos[1].savedSegments).toEqual([]);
    });

    it('ラウンドトリップ: startMarker / endMarker が復元される', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.videos[0].startMarker).toBe(5);
        expect(result.videos[0].endMarker).toBe(60);
    });

    it('ラウンドトリップ: startMarker / endMarker が未設定の動画は undefined', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.videos[1].startMarker).toBeUndefined();
        expect(result.videos[1].endMarker).toBeUndefined();
    });

    it('ラウンドトリップ: order が 0-indexed で復元される', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.videos[0].order).toBe(0);
        expect(result.videos[1].order).toBe(1);
    });

    it('thumbnail が YouTube CDN URL として復元される', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const result = await decodeParamToPlaylist(encoded);
        expect(result.videos[0].thumbnail).toContain('dQw4w9WgXcQ');
    });
});

// ---------------------------------------------------------------------------
// URL 長上限チェック
// ---------------------------------------------------------------------------

describe('URL 長制限', () => {
    it('通常のプレイリストは上限内に収まる', async () => {
        const encoded = await encodePlaylistToParam(playlist, videos);
        const fullUrl = `${mockLocation.origin}${mockLocation.pathname}?${PLAYLIST_PARAM}=${encoded}`;
        expect(fullUrl.length).toBeLessThanOrEqual(MAX_URL_LENGTH);
    });

    it('動画数が多すぎると Error を throw する', async () => {
        // ユニークな ID・タイトルを持つ動画を 300 本用意して上限を超えさせる
        const makeId = (i: number) => String(i).padStart(11, 'a').slice(0, 11);
        const manyVideos: Video[] = Array.from({ length: 300 }, (_, i) => ({
            id: i,
            playlistId: 1,
            youtubeUrl: `https://www.youtube.com/watch?v=${makeId(i)}`,
            title: `Unique video title number ${i} with some extra text to fill space`,
            thumbnail: '',
            order: i,
            savedSegments: [{ start: 10, end: 30 }],
        }));
        await expect(encodePlaylistToParam(playlist, manyVideos)).rejects.toThrow(
            /URL.*長すぎ|上限/
        );
    });
});

// ---------------------------------------------------------------------------
// デコードエラーハンドリング
// ---------------------------------------------------------------------------

describe('decodeParamToPlaylist エラー', () => {
    it('壊れたエンコード文字列はエラーになる', async () => {
        await expect(decodeParamToPlaylist('!!!invalid!!!')).rejects.toThrow();
    });

    it('有効な Base64url だが中身が不正 JSON の場合はエラーになる', async () => {
        // btoa('garbage') の Base64url 形式
        const garbage = btoa('not json at all').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        await expect(decodeParamToPlaylist(garbage)).rejects.toThrow();
    });
});

// ---------------------------------------------------------------------------
// getPlaylistParam / clearPlaylistParam
// ---------------------------------------------------------------------------

describe('getPlaylistParam', () => {
    it('パラメータがなければ null', () => {
        vi.stubGlobal('location', { ...mockLocation, search: '' });
        expect(getPlaylistParam()).toBeNull();
    });

    it('playlist パラメータがあれば値を返す', () => {
        vi.stubGlobal('location', { ...mockLocation, search: '?playlist=ABC123' });
        expect(getPlaylistParam()).toBe('ABC123');
    });
});

describe('clearPlaylistParam', () => {
    it('history.replaceState が呼ばれる', () => {
        vi.stubGlobal('location', { ...mockLocation, search: '?playlist=ABC', href: 'https://example.com/?playlist=ABC' });
        const replaceState = vi.fn();
        vi.stubGlobal('history', { replaceState });
        clearPlaylistParam();
        expect(replaceState).toHaveBeenCalledOnce();
        const calledUrl: string = replaceState.mock.calls[0][2];
        expect(calledUrl).not.toContain('playlist=');
    });
});
