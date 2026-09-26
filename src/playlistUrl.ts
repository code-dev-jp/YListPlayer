/**
 * playlistUrl.ts
 *
 * プレイリストを URL クエリパラメータとして export/import するためのユーティリティ。
 *
 * エンコード方式:
 *   1. プレイリストを最小 JSON オブジェクトに変換
 *   2. UTF-8 テキストを deflate-raw で圧縮 (CompressionStream)
 *   3. Base64url エンコード (パディングなし)
 *   4. ?playlist=<encoded> として URL に埋め込む
 *
 * URL 長上限: MAX_URL_LENGTH (2000 文字)。超えた場合はエラーを throw する。
 */

import { Playlist, Video } from './db';

/** クエリパラメータ名 */
export const PLAYLIST_PARAM = 'playlist';

/** URL 全体の最大長（安全側の制限） */
export const MAX_URL_LENGTH = 2000;

// ---------------------------------------------------------------------------
// 最小シリアライズ形式
// ---------------------------------------------------------------------------

/** savedSegments の最小形式 */
interface MinSegment {
    s: number; // start
    e: number; // end
}

/** 動画の最小形式 */
interface MinVideo {
    i: string;  // youtubeId (11文字)
    t: string;  // title
    g?: MinSegment[]; // savedSegments (空なら省略)
    k?: number; // startMarker
    l?: number; // endMarker
}

/** プレイリスト全体の最小形式 */
interface MinPlaylist {
    n: string;       // name
    v: MinVideo[];   // videos
}

// ---------------------------------------------------------------------------
// YouTube ID 抽出
// ---------------------------------------------------------------------------

export function extractYoutubeId(url: string): string | null {
    const m = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// 圧縮 / 展開
// ---------------------------------------------------------------------------

async function compress(text: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const input = encoder.encode(text);
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(input);
    writer.close();
    const chunks: Uint8Array[] = [];
    const reader = cs.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
}

async function decompress(data: Uint8Array): Promise<string> {
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    // tsc の Uint8Array<ArrayBufferLike> と BufferSource の型不一致を回避
    const buf = data.buffer as ArrayBuffer;
    const slice = buf.slice(data.byteOffset, data.byteOffset + data.byteLength);
    // writable 側のエラー（不正データによる Z_DATA_ERROR 等）が
    // Unhandled Rejection にならないよう writer.closed を catch しておく
    writer.closed.catch(() => { /* readable 側で受け取るので無視 */ });
    writer.write(new Uint8Array(slice)).catch(() => { /* 同上 */ });
    writer.close().catch(() => { /* 同上 */ });
    const chunks: Uint8Array[] = [];
    const reader = ds.readable.getReader();
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
    }
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return new TextDecoder().decode(out);
}

// ---------------------------------------------------------------------------
// Base64url (パディングなし)
// ---------------------------------------------------------------------------

function toBase64url(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function fromBase64url(str: string): Uint8Array {
    const base64 = str
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
}

// ---------------------------------------------------------------------------
// 公開 API
// ---------------------------------------------------------------------------

/**
 * プレイリストと動画一覧を URL エンコードされた文字列に変換する。
 *
 * @throws {Error} URL が MAX_URL_LENGTH を超える場合
 */
export async function encodePlaylistToParam(
    playlist: Playlist,
    videos: Video[]
): Promise<string> {
    const min: MinPlaylist = {
        n: playlist.name,
        v: videos.map((v) => {
            const id = extractYoutubeId(v.youtubeUrl) ?? v.youtubeUrl;
            const item: MinVideo = { i: id, t: v.title };
            if (v.savedSegments && v.savedSegments.length > 0) {
                item.g = v.savedSegments.map((seg) => ({ s: seg.start, e: seg.end }));
            }
            if (v.startMarker !== undefined) item.k = v.startMarker;
            if (v.endMarker !== undefined) item.l = v.endMarker;
            return item;
        })
    };

    const json = JSON.stringify(min);
    const compressed = await compress(json);
    const encoded = toBase64url(compressed);

    // URL 全体長チェック: 現在の origin + pathname + ?playlist=<encoded>
    const base = `${location.origin}${location.pathname}`;
    const fullUrl = `${base}?${PLAYLIST_PARAM}=${encoded}`;
    if (fullUrl.length > MAX_URL_LENGTH) {
        throw new Error(
            `エクスポートURLが長すぎます（${fullUrl.length} 文字）。` +
            `動画数を減らすか、タイトルを短くしてください（上限: ${MAX_URL_LENGTH} 文字）。`
        );
    }

    return encoded;
}

/**
 * クエリパラメータ文字列からプレイリストデータを復元する。
 *
 * @returns プレイリスト名と動画リスト（id/playlistId は未設定）
 * @throws {Error} デコード・展開・パース失敗時
 */
export async function decodeParamToPlaylist(
    encoded: string
): Promise<{ name: string; videos: Omit<Video, 'id' | 'playlistId'>[] }> {
    let json: string;
    try {
        const bytes = fromBase64url(encoded);
        json = await decompress(bytes);
    } catch {
        throw new Error('URL のデコードに失敗しました。URLが壊れている可能性があります。');
    }

    let min: MinPlaylist;
    try {
        min = JSON.parse(json) as MinPlaylist;
    } catch {
        throw new Error('プレイリストデータのパースに失敗しました。');
    }

    if (!min.n || !Array.isArray(min.v)) {
        throw new Error('プレイリストデータの形式が不正です。');
    }

    const videos: Omit<Video, 'id' | 'playlistId'>[] = min.v.map((mv, idx) => ({
        youtubeUrl: `https://www.youtube.com/watch?v=${mv.i}`,
        title: mv.t ?? `Video ${mv.i}`,
        thumbnail: `https://img.youtube.com/vi/${mv.i}/default.jpg`,
        order: idx,
        startMarker: mv.k,
        endMarker: mv.l,
        savedSegments: mv.g ? mv.g.map((s) => ({ start: s.s, end: s.e })) : [],
    }));

    return { name: min.n, videos };
}

/**
 * 現在の URL から playlist パラメータを取得する。
 * 存在しない場合は null を返す。
 */
export function getPlaylistParam(): string | null {
    const params = new URLSearchParams(location.search);
    return params.get(PLAYLIST_PARAM);
}

/**
 * ブラウザ履歴を汚さずに URL からパラメータを除去する。
 */
export function clearPlaylistParam(): void {
    const url = new URL(location.href);
    url.searchParams.delete(PLAYLIST_PARAM);
    history.replaceState(null, '', url.toString());
}
