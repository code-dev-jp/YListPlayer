import { arrayMove } from '@dnd-kit/sortable';

export function reorderItems<T extends { id?: number }>(items: T[], activeId: number, overId: number): T[] {
    const oldIndex = items.findIndex((item) => item.id === activeId);
    const newIndex = items.findIndex((item) => item.id === overId);
    if (oldIndex < 0 || newIndex < 0) return items;
    return arrayMove(items, oldIndex, newIndex);
}

export function removeItemById<T extends { id?: number }>(items: T[], targetId: number): T[] {
    return items.filter((item) => item.id !== targetId);
}
