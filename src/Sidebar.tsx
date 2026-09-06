import React, { useState, useEffect } from 'react';
import {
    Box, Typography, FormControl, Select, MenuItem, Button,
    TextField, List, ListItem, ListItemAvatar,
    Avatar, IconButton, Divider, Stack
} from '@mui/material';
import { Plus, Trash2, GripVertical, Download, Upload, PlayCircle } from 'lucide-react';
import { db, Playlist, Video } from './db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SidebarProps {
    activePlaylistId: number | null;
    onSelectPlaylist: (id: number | null) => void;
    onSelectVideo: (id: number) => void;
    activeVideoId: number | null;
    onPlayPlaylist: () => void;
}

const SortableVideoItem = ({ video, isActive, onSelect, onDelete }: any) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: video.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <ListItem
            ref={setNodeRef}
            style={style}
            sx={{
                mb: 1,
                borderRadius: 1,
                bgcolor: isActive ? 'primary.main' : 'background.paper',
                '&:hover': { bgcolor: isActive ? 'primary.dark' : 'rgba(255, 255, 255, 0.08)' }
            }}
            secondaryAction={
                <IconButton edge="end" size="small" onClick={() => onDelete(video.id)}>
                    <Trash2 size={16} />
                </IconButton>
            }
            disablePadding
        >
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, flexGrow: 1, cursor: 'pointer' }} onClick={() => onSelect(video.id)}>
                <Box {...attributes} {...listeners} sx={{ cursor: 'grab', mr: 1, color: 'grey.600' }}>
                    <GripVertical size={20} />
                </Box>
                <Avatar variant="rounded" src={video.thumbnail} sx={{ width: 48, height: 36, mr: 1.5 }} />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ color: isActive ? 'white' : 'inherit' }}>
                        {video.title}
                    </Typography>
                    {video.savedSegments?.length > 0 && (
                        <Typography variant="caption" sx={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'text.secondary' }}>
                            {video.savedSegments.length} segments
                        </Typography>
                    )}
                </Box>
            </Box>
        </ListItem>
    );
};

const Sidebar: React.FC<SidebarProps> = ({
    activePlaylistId,
    onSelectPlaylist,
    onSelectVideo,
    activeVideoId,
    onPlayPlaylist
}) => {
    const [url, setUrl] = useState('');
    const playlists = useLiveQuery(() => db.playlists.toArray()) || [];
    const videos = useLiveQuery(
        () => (activePlaylistId ? db.videos.where('playlistId').equals(activePlaylistId).sortBy('order') : []),
        [activePlaylistId]
    ) || [];

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleCreatePlaylist = async () => {
        const name = prompt('Playlist Name:');
        if (name) {
            const id = await db.playlists.add({
                name,
                createdAt: Date.now()
            });
            onSelectPlaylist(id as number);
        }
    };

    const handleAddVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url || !activePlaylistId) return;

        const videoIdMatch = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
        const videoId = videoIdMatch ? videoIdMatch[1] : null;

        if (!videoId) return;

        const newVideo: Video = {
            playlistId: activePlaylistId,
            youtubeUrl: url,
            title: `Video ${videoId}`,
            thumbnail: `https://img.youtube.com/vi/${videoId}/default.jpg`,
            order: videos.length,
            savedSegments: []
        };

        await db.videos.add(newVideo);
        setUrl('');
    };

    const handleDeleteVideo = async (id: number) => {
        await db.videos.delete(id);
    };

    const handleExport = async () => {
        if (!activePlaylistId) return;
        const playlist = await db.playlists.get(activePlaylistId);
        const playlistVideos = await db.videos.where('playlistId').equals(activePlaylistId).toArray();

        const data = {
            playlist,
            videos: playlistVideos
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `${playlist?.name || 'playlist'}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = JSON.parse(event.target?.result as string);
                const { playlist, videos: importedVideos } = data;

                const newPlaylistId = await db.playlists.add({
                    name: `${playlist.name} (Imported)`,
                    createdAt: Date.now()
                });

                for (const v of importedVideos) {
                    await db.videos.add({
                        ...v,
                        id: undefined,
                        playlistId: newPlaylistId as number
                    });
                }
                onSelectPlaylist(newPlaylistId as number);
            } catch (err) {
                alert('Failed to import playlist');
            }
        };
        reader.readAsText(file);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = videos.findIndex(v => v.id === active.id);
            const newIndex = videos.findIndex(v => v.id === over.id);

            const newItems = arrayMove(videos, oldIndex, newIndex);

            // Update orders in DB
            for (let i = 0; i < newItems.length; i++) {
                if (newItems[i].id) {
                    await db.videos.update(newItems[i].id!, { order: i });
                }
            }
        }
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>My Playlists</Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                <FormControl fullWidth size="small">
                    <Select
                        value={activePlaylistId || ''}
                        onChange={(e) => onSelectPlaylist(e.target.value as number)}
                        displayEmpty
                    >
                        <MenuItem value="" disabled>Select Playlist</MenuItem>
                        {playlists.map((p) => (
                            <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <IconButton onClick={handleCreatePlaylist} color="primary">
                    <Plus size={24} />
                </IconButton>
            </Stack>

            {activePlaylistId && (
                <>
                    <Button
                        fullWidth
                        variant="contained"
                        color="success"
                        startIcon={<PlayCircle size={20} />}
                        sx={{ mb: 2 }}
                        onClick={onPlayPlaylist}
                        disabled={videos.length === 0}
                    >
                        Play All
                    </Button>

                    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            startIcon={<Download size={16} />}
                            onClick={handleExport}
                        >
                            Export
                        </Button>
                        <Button
                            fullWidth
                            variant="outlined"
                            size="small"
                            component="label"
                            startIcon={<Upload size={16} />}
                        >
                            Import
                            <input type="file" hidden accept=".json" onChange={handleImport} />
                        </Button>
                    </Stack>

                    <Box component="form" onSubmit={handleAddVideo} sx={{ mb: 3 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder="YouTube URL"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            sx={{ mb: 1 }}
                        />
                        <Button fullWidth variant="contained" type="submit" size="small">
                            Add Video
                        </Button>
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={videos.map(v => v.id!)}
                            strategy={verticalListSortingStrategy}
                        >
                            <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
                                {videos.map((video) => (
                                    <SortableVideoItem
                                        key={video.id}
                                        video={video}
                                        isActive={activeVideoId === video.id}
                                        onSelect={onSelectVideo}
                                        onDelete={handleDeleteVideo}
                                    />
                                ))}
                            </List>
                        </SortableContext>
                    </DndContext>
                </>
            )}
        </Box>
    );
};

export default Sidebar;
