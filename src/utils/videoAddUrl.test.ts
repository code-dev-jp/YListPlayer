import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getVideoAddParams, clearVideoAddParams } from './videoAddUrl';

const mockLocation = {
    origin: 'http://localhost',
    pathname: '/',
    search: '',
    href: 'http://localhost/',
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

describe('videoAddUrl', () => {
    describe('getVideoAddParams', () => {
        it('addVideoId, title, thumbnail, playlistId がある場合に正しいオブジェクトを返す', () => {
            const search = '?addVideoId=abc12345678&title=TestVideo&thumbnail=http://example.com/img.jpg&playlistId=5';
            const params = getVideoAddParams(search);
            expect(params).toEqual({
                videoId: 'abc12345678',
                title: 'TestVideo',
                thumbnail: 'http://example.com/img.jpg',
                playlistId: 5,
            });
        });

        it('videoId （互換キー）でも取得できる', () => {
            const search = '?videoId=xyz98765432&title=CompatVideo';
            const params = getVideoAddParams(search);
            expect(params).toEqual({
                videoId: 'xyz98765432',
                title: 'CompatVideo',
                thumbnail: 'https://img.youtube.com/vi/xyz98765432/default.jpg',
                playlistId: null,
            });
        });

        it('title や thumbnail がない場合にデフォルト値を設定する', () => {
            const search = '?addVideoId=abc12345678';
            const params = getVideoAddParams(search);
            expect(params).toEqual({
                videoId: 'abc12345678',
                title: 'abc12345678',
                thumbnail: 'https://img.youtube.com/vi/abc12345678/default.jpg',
                playlistId: null,
            });
        });

        it('playlistId が非数値なら null に落とす', () => {
            const search = '?addVideoId=abc12345678&playlistId=not-a-number';
            const params = getVideoAddParams(search);
            expect(params).toEqual({
                videoId: 'abc12345678',
                title: 'abc12345678',
                thumbnail: 'https://img.youtube.com/vi/abc12345678/default.jpg',
                playlistId: null,
            });
        });

        it('addVideoId も videoId もない場合は null を返す', () => {
            const search = '?title=TestVideo';
            expect(getVideoAddParams(search)).toBeNull();
        });
    });

    describe('clearVideoAddParams', () => {
        it('URL から動画追加パラメータのみを削除し、他の状態を保持する', () => {
            vi.stubGlobal('location', { ...mockLocation, search: '?addVideoId=abc12345678&title=TestVideo&playlistId=1', href: 'http://localhost/?addVideoId=abc12345678&title=TestVideo&playlistId=1' });
            clearVideoAddParams();
            expect(mockLocation.search).toBe('');
        });
    });
});
