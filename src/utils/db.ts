import Dexie, { Table } from 'dexie';

export interface Playlist {
    id?: number;
    name: string;
    createdAt: number;
}

export interface VideoSegment {
    start: number;
    end: number;
}

export interface Video {
    id?: number;
    playlistId: number;
    youtubeUrl: string;
    title: string;
    thumbnail: string;
    order: number;
    startMarker?: number;
    endMarker?: number;
    savedSegments: VideoSegment[];
}

export class AppDatabase extends Dexie {
    playlists!: Table<Playlist>;
    videos!: Table<Video>;

    constructor() {
        super('YListPlayerDB');
        this.version(1).stores({
            playlists: '++id, name, createdAt',
            videos: '++id, playlistId, order'
        });
    }
}

export const db = new AppDatabase();
