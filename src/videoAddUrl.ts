/**
 * videoAddUrl.ts
 *
 * 拡張機能等から URL クエリパラメータ経由で動画を追加するためのユーティリティ。
 * バックエンドなしで、YListPlayer のタブが開いた瞬間に登録処理を実行する。
 */

export interface VideoAddParams {
    videoId: string;
    title: string;
    thumbnail: string;
    playlistId: number | null;
}

/**
 * クエリパラメータから動画追加情報を取り出す。
 * `addVideoId` または `videoId` が存在しない場合は null を返す。
 */
export function getVideoAddParams(searchStr: string = window.location.search): VideoAddParams | null {
    const params = new URLSearchParams(searchStr);
    const videoId = params.get('addVideoId') || params.get('videoId');
    if (!videoId) return null;

    const title = params.get('title') || videoId;
    const thumbnail = params.get('thumbnail') || `https://img.youtube.com/vi/${videoId}/default.jpg`;
    const pidStr = params.get('playlistId');
    const playlistId = pidStr && !isNaN(Number(pidStr)) ? Number(pidStr) : null;

    return {
        videoId,
        title,
        thumbnail,
        playlistId,
    };
}

/**
 * URL から動画追加に関するクエリパラメータを除去する（ブラウザ履歴を汚さない）。
 */
export function clearVideoAddParams(): void {
    const url = new URL(location.href);
    url.searchParams.delete('addVideoId');
    url.searchParams.delete('videoId');
    url.searchParams.delete('title');
    url.searchParams.delete('thumbnail');
    url.searchParams.delete('playlistId');
    history.replaceState(null, '', url.toString());
}
