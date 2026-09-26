import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box, Grid } from '@mui/material';
import theme from './theme';
import Sidebar from './Sidebar';
import PlayerSection from './PlayerSection';
import { db } from './db';
import { getNextVideoIndex } from './playback';
import { useLiveQuery } from 'dexie-react-hooks';
import { getPlaylistParam, decodeParamToPlaylist, clearPlaylistParam } from './playlistUrl';
import ConfirmDialog, { DialogState } from './ConfirmDialog';

function App() {
    const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);
    const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);
    const [isLoop, setIsLoop] = useState(false);
    const [dialog, setDialog] = useState<DialogState>({ open: false, variant: 'alert', title: '' });

    // URLパラメータからプレイリストをインポートする（起動時のみ）
    useEffect(() => {
        const encoded = getPlaylistParam();
        if (!encoded) return;

        // パラメータを先に除去（成功・失敗・キャンセルどの場合も除去する）
        clearPlaylistParam();

        decodeParamToPlaylist(encoded).then((data) => {
            // Step 1: インポートするか確認
            setDialog({
                open: true,
                variant: 'confirm',
                title: 'URLからプレイリストをインポート',
                message: `「${data.name}」(${data.videos.length}本) をインポートしますか？`,
                confirmLabel: 'インポート',
                confirmColor: 'primary',
                onResult: (ok) => {
                    if (!ok) return;
                    // Step 2: 名前を入力
                    setDialog({
                        open: true,
                        variant: 'prompt',
                        title: 'インポート先のプレイリスト名',
                        defaultValue: `${data.name} (Imported)`,
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
        // ponytail: 再生中に削除された等で現在位置が不明なら停止（従来通り）
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
            <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Grid container sx={{ flexGrow: 1, height: '100%', overflow: 'hidden' }}>
                    {/* Main Player Section (80%) */}
                    <Grid sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2, borderRight: '1px solid #333', flexBasis: '80%', flexGrow: 0, maxWidth: '80%' }}>
                        <PlayerSection
                            activeVideo={activeVideo}
                            onVideoEnd={handleVideoEnd}
                            isAutoPlaying={isAutoPlaying}
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
                        />
                    </Grid>
                </Grid>
            </Box>
            <ConfirmDialog state={dialog} onChange={setDialog} />
        </ThemeProvider>
    );
}

export default App;
