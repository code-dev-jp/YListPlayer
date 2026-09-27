import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, CssBaseline, Box, Grid, Snackbar, Alert, useMediaQuery } from '@mui/material';
import theme from '../utils/theme';
import Sidebar from './Sidebar';
import PlayerSection from './PlayerSection';
import { db } from '../utils/db';
import { getNextVideoIndex } from '../utils/playback';
import { useLiveQuery } from 'dexie-react-hooks';
import { getPlaylistParam, decodeParamToPlaylist, clearPlaylistParam } from '../utils/playlistUrl';
import { getVideoAddParams, clearVideoAddParams } from '../utils/videoAddUrl';
import ConfirmDialog, { DialogState } from './ConfirmDialog';

function App() {
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);
    const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [isLoop, setIsLoop] = useState(false);
    const [dialog, setDialog] = useState<DialogState>({ open: false, variant: 'alert', title: '' });
    const [toasts, setToasts] = useState<{ message: string; severity: 'success' | 'error' }[]>([]);
    const showToast = useCallback((message: string, severity: 'success' | 'error') => {
        setToasts(current => [...current, { message, severity }]);
    }, []);

    // URLパラメータからプレイリストをインポートする（起動時のみ）
    useEffect(() => {
        const encoded = getPlaylistParam();
        if (!encoded) return;

        clearPlaylistParam();

        decodeParamToPlaylist(encoded).then((data) => {
            setDialog({
                open: true,
                variant: 'confirm',
                title: 'URLからプレイリストをインポート',
                message: `「${data.name}」(${data.videos.length}本) をインポートしますか？`,
                confirmLabel: 'インポート',
                confirmColor: 'primary',
                onResult: (ok) => {
                    if (!ok) return;
                    setDialog({
                        open: true,
                        variant: 'prompt',
                        title: 'インポート先のプレイリスト名',
                        defaultValue: `${data.name}（インポート済み）`,
                        onResult: async (ok2, name) => {
                            if (!ok2 || !name) return;
                            const newPlaylistId = await db.playlists.add({
                                name,
                                createdAt: Date.now()
                            });
                            for (const v of data.videos) {
                                await db.videos.add({
                                    ...v,
                                    playlistId: newPlaylistId as number
                                });
                            }
                            setActivePlaylistId(newPlaylistId as number);
                        }
                    });
                }
            });
        }).catch((err: unknown) => {
            const message = err instanceof Error ? err.message : 'URLのデコードに失敗しました。';
            setDialog({
                open: true,
                variant: 'alert',
                title: 'インポート失敗',
                message
            });
        });
    }, []);

    // URLクエリパラメータからの動画登録（登録タブが開かれた瞬間・フォーカス時に処理）
    useEffect(() => {
        const checkAndProcessVideoAdd = async () => {
            const params = getVideoAddParams();
            if (!params) return;

            clearVideoAddParams();

            try {
                let targetPlaylistId: number | null = params.playlistId;
                if (!targetPlaylistId) {
                    const first = await db.playlists.orderBy('createdAt').first();
                    targetPlaylistId = first?.id ?? null;
                }
                if (!targetPlaylistId) {
                    showToast(`「${params.title}」の追加失敗: プレイリストがありません`, 'error');
                    return;
                }
                const playlist = await db.playlists.get(targetPlaylistId);
                if (!playlist) {
                    showToast(`「${params.title}」の追加失敗: プレイリストが見つかりません`, 'error');
                    return;
                }
                const existing = await db.videos.where('playlistId').equals(targetPlaylistId).sortBy('order');
                await db.videos.add({
                    playlistId: targetPlaylistId,
                    youtubeUrl: `https://www.youtube.com/watch?v=${params.videoId}`,
                    title: params.title,
                    thumbnail: params.thumbnail,
                    order: existing.length,
                    savedSegments: [],
                });
                setActivePlaylistId(targetPlaylistId);
                showToast(`「${params.title}」を「${playlist.name}」に追加しました`, 'success');
            } catch (err) {
                const msg = err instanceof Error ? err.message : '動画の追加に失敗しました。';
                showToast(`「${params.title}」の追加失敗: ${msg}`, 'error');
            }
        };

        checkAndProcessVideoAdd();

        window.addEventListener('focus', checkAndProcessVideoAdd);
        window.addEventListener('popstate', checkAndProcessVideoAdd);
        return () => {
            window.removeEventListener('focus', checkAndProcessVideoAdd);
            window.removeEventListener('popstate', checkAndProcessVideoAdd);
        };
    }, [showToast]);

    const activeVideo = useLiveQuery(
        () => (activeVideoId ? db.videos.get(activeVideoId) : undefined),
        [activeVideoId]
    ) || null;

    const playlistVideos = useLiveQuery(
        () => (activePlaylistId ? db.videos.where('playlistId').equals(activePlaylistId).sortBy('order') : []),
        [activePlaylistId]
    ) || [];

    const handleSelectVideo = (id: number) => {
        setActiveVideoId(id);
        setIsAutoPlaying(false);
    };

    const handleVideoEnd = () => {
        if (!isAutoPlaying) return;
        const currentIndex = playlistVideos.findIndex(v => v.id === activeVideoId);
        if (currentIndex === -1) {
            setIsAutoPlaying(false);
            return;
        }
        const next = getNextVideoIndex(currentIndex, playlistVideos.length, isLoop);
        if (next !== null) {
            setActiveVideoId(playlistVideos[next].id!);
        } else {
            setIsAutoPlaying(false);
        }
    };

    const handlePlayPlaylist = () => {
        if (playlistVideos.length > 0) {
            setActiveVideoId(playlistVideos[0].id!);
            setIsAutoPlaying(true);
        }
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {isMobile ? (
                <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default', overflowY: 'auto', p: 1 }}>
                    {/* 1. Player Section (Player + Saved Segments) */}
                    <Box sx={{ width: '100%', mb: 2 }}>
                        <PlayerSection
                            activeVideo={activeVideo}
                            onVideoEnd={handleVideoEnd}
                            isAutoPlaying={isAutoPlaying}
                            isMobile={true}
                        />
                    </Box>

                    {/* 2. Sidebar Section (Playlist Select + Add Video + Video List) */}
                    <Box sx={{ width: '100%', p: 1, bgcolor: 'background.paper', borderRadius: 2 }}>
                        <Sidebar
                            activePlaylistId={activePlaylistId}
                            onSelectPlaylist={setActivePlaylistId}
                            onSelectVideo={handleSelectVideo}
                            activeVideoId={activeVideoId}
                            onPlayPlaylist={handlePlayPlaylist}
                            isLoop={isLoop}
                            onToggleLoop={setIsLoop}
                            isMobile={true}
                        />
                    </Box>
                </Box>
            ) : (
                <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <Grid container sx={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
                        {/* Main Player Section (80%) */}
                        <Grid sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2, borderRight: '1px solid #333', flexBasis: '80%', flexGrow: 0, maxWidth: '80%' }}>
                            <PlayerSection
                                activeVideo={activeVideo}
                                onVideoEnd={handleVideoEnd}
                                isAutoPlaying={isAutoPlaying}
                                isMobile={false}
                            />
                        </Grid>

                        {/* Sidebar Section (20%) */}
                        <Grid sx={{ height: '100%', p: 2, bgcolor: 'background.paper', overflowY: 'auto', flexBasis: '20%', flexGrow: 0, maxWidth: '20%' }}>
                            <Sidebar
                                activePlaylistId={activePlaylistId}
                                onSelectPlaylist={setActivePlaylistId}
                                onSelectVideo={handleSelectVideo}
                                activeVideoId={activeVideoId}
                                onPlayPlaylist={handlePlayPlaylist}
                                isLoop={isLoop}
                                onToggleLoop={setIsLoop}
                                isMobile={false}
                            />
                        </Grid>
                    </Grid>
                </Box>
            )}
            <ConfirmDialog state={dialog} onChange={setDialog} />

            {/* 拡張機能からの動画追加トースト通知 */}
            <Snackbar
                open={toasts.length > 0}
                autoHideDuration={4000}
                onClose={() => setToasts(current => current.slice(1))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    key={toasts[0]?.message}
                    severity={toasts[0]?.severity ?? 'success'}
                    sx={{ width: '100%' }}
                >
                    {toasts[0]?.message}
                </Alert>
            </Snackbar>
        </ThemeProvider>
    );
}

export default App;
