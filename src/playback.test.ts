import { describe, it, expect } from 'vitest';
import { getNextVideoIndex, resolveSegmentAction } from './playback';

describe('getNextVideoIndex', () => {
    it('途中なら次へ進む（ループ無関係）', () => {
        expect(getNextVideoIndex(0, 3, false)).toBe(1);
        expect(getNextVideoIndex(1, 3, true)).toBe(2);
    });
    it('最後はループOFFで停止(null)', () => {
        expect(getNextVideoIndex(2, 3, false)).toBeNull();
    });
    it('最後はループONで先頭へ', () => {
        expect(getNextVideoIndex(2, 3, true)).toBe(0);
    });
    it('単一動画でもループONなら先頭(自分)へ', () => {
        expect(getNextVideoIndex(0, 1, true)).toBe(0);
        expect(getNextVideoIndex(0, 1, false)).toBeNull();
    });
    it('不正入力は停止(null)', () => {
        expect(getNextVideoIndex(-1, 3, true)).toBeNull();
        expect(getNextVideoIndex(0, 0, true)).toBeNull();
    });
});

describe('resolveSegmentAction', () => {
    it('区間なしは継続', () => {
        expect(resolveSegmentAction([], 50)).toEqual({ kind: 'continue' });
    });
    it('区間内は継続', () => {
        expect(resolveSegmentAction([{ start: 10, end: 20 }], 15)).toEqual({ kind: 'continue' });
    });
    it('区間の終了到達で次区間へseek', () => {
        expect(
            resolveSegmentAction([{ start: 10, end: 20 }, { start: 30, end: 40 }], 20.2)
        ).toEqual({ kind: 'seek', time: 30 });
    });
    it('最終区間の終了到達でend', () => {
        expect(resolveSegmentAction([{ start: 10, end: 20 }], 20)).toEqual({ kind: 'end' });
        expect(resolveSegmentAction([{ start: 10, end: 20 }], 25)).toEqual({ kind: 'end' });
    });
    it('区間間の隙間は次区間へseek', () => {
        expect(
            resolveSegmentAction([{ start: 10, end: 20 }, { start: 30, end: 40 }], 25)
        ).toEqual({ kind: 'seek', time: 30 });
    });
    it('次区間の直前(0.5s以内)は継続', () => {
        expect(
            resolveSegmentAction([{ start: 10, end: 20 }, { start: 30, end: 40 }], 29.8)
        ).toEqual({ kind: 'continue' });
    });
});
