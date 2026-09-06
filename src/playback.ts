import type { VideoSegment } from './db';

// ponytail: UIから切り出した純粋ロジック。App/PlayerSectionとテストの単一の真実とする

// 連続再生の次インデックス。進む先がなければ null（停止）
export function getNextVideoIndex(currentIndex: number, count: number, loop: boolean): number | null {
    if (currentIndex < 0 || count <= 0) return null;
    if (currentIndex < count - 1) return currentIndex + 1;
    if (loop) return 0;
    return null;
}

export type SegmentAction =
    | { kind: 'continue' }
    | { kind: 'seek'; time: number }
    | { kind: 'end' };

// ponytail: PlayerSectionのポーリング条件(±0.5s境界)と同一。UI側に二重に書かない
export function resolveSegmentAction(segments: VideoSegment[], current: number): SegmentAction {
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
