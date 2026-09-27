import type { VideoSegment } from './db';

// ponytail: UIから切り出した純粋ロジック。App/PlayerSectionとテストの単一の真実とする

// 連続再生の次インデックス。進む先がなければ null（停止）
export function getNextVideoIndex(currentIndex: number, count: number, loop: boolean): number | null {
    if (currentIndex < 0 || count <= 0) return null;
    if (currentIndex < count - 1) return currentIndex + 1;
    if (loop) return 0;
    return null;
}

// ponytail: YouTube URLからvideoIdを抽出。PlayerSection_OnReady/isAutoPlaying共通
export function extractVideoId(url: string): string {
    const match = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : '';
}

// ponytail: 初期シーク位置の決定。onReady/isAutoPlayingで同一ロジックを二重に書かない
export function getInitialSeekTime(segments: VideoSegment[], startMarker?: number): number | null {
    if (segments.length > 0) return segments[0].start;
    if (startMarker != null) return startMarker;
    return null;
}

export type SegmentAction =
    | { kind: 'continue' }
    | { kind: 'seek'; time: number }
    | { kind: 'end' };

// ponytail: PlayerSectionのポーリング条件(±0.5s境界)と同一。UI側に二重に書かない
// playing=false（一時停止中）は区間外でもシークしない（ユーザーが任意の位置にシークできるようにする）
export function resolveSegmentAction(segments: VideoSegment[], current: number, playing: boolean): SegmentAction {
    if (!playing) return { kind: 'continue' };
    if (segments.length === 0) return { kind: 'continue' };
    const currentSegment = segments.find(
        (seg) => current >= seg.start - 0.5 && current <= seg.end + 0.5
    );
    if (!currentSegment) {
        const next = segments.find((seg) => seg.start > current);
        if (next) {
            return Math.abs(next.start - current) > 0.5
                ? { kind: 'seek', time: next.start }
                : { kind: 'continue' };
        }
        return { kind: 'end' };
    }
    if (current >= currentSegment.end) {
        const next = segments.find((seg) => seg.start > currentSegment.end);
        return next ? { kind: 'seek', time: next.start } : { kind: 'end' };
    }
    return { kind: 'continue' };
}

export function validateSegmentInput(
    startMarker: number | null,
    endMarker: number | null,
    existingSegments: VideoSegment[] = []
): { valid: true } | { valid: false; error: string } {
    if (startMarker === null || endMarker === null) {
        return { valid: false, error: '開始マーカーと終了マーカーの両方を設定してください。' };
    }
    if (startMarker >= endMarker) {
        return { valid: false, error: '開始位置は終了位置より前である必要があります。' };
    }
    const isOverlapping = existingSegments.some(seg =>
        startMarker < seg.end && endMarker > seg.start
    );
    if (isOverlapping) {
        return { valid: false, error: '既存の区間と重なっています。' };
    }
    return { valid: true };
}
