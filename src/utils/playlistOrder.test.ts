import { describe, expect, it } from 'vitest';
import { reorderItems, removeItemById } from './playlistOrder';

describe('reorderItems', () => {
    it('指定した2つのアイテムの順序を入れ替える', () => {
        const items = [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
            { id: 3, name: 'C' },
        ];

        expect(reorderItems(items, 1, 3)).toEqual([
            { id: 2, name: 'B' },
            { id: 3, name: 'C' },
            { id: 1, name: 'A' },
        ]);
    });

    it('対象が見つからない場合は元の順序を返す', () => {
        const items = [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
        ];

        expect(reorderItems(items, 99, 2)).toEqual(items);
    });
});

describe('removeItemById', () => {
    it('指定した ID を削除する', () => {
        const items = [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
            { id: 3, name: 'C' },
        ];

        expect(removeItemById(items, 2)).toEqual([
            { id: 1, name: 'A' },
            { id: 3, name: 'C' },
        ]);
    });
});
