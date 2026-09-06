import React, { useState } from 'react';
import { ThemeProvider, CssBaseline, Box, Grid } from '@mui/material';
import theme from './theme';
import Sidebar from './Sidebar';
import PlayerSection from './PlayerSection';
import { db } from './db';
import { useLiveQuery } from 'dexie-react-hooks';

function App() {
    const [activePlaylistId, setActivePlaylistId] = useState<number | null>(null);
    const [activeVideoId, setActiveVideoId] = useState<number | null>(null);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);

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
        if (currentIndex !== -1 && currentIndex < playlistVideos.length - 1) {
            setActiveVideoId(playlistVideos[currentIndex + 1].id!);
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
                        />
                    </Grid>
                </Grid>
            </Box>
        </ThemeProvider>
    );
}

export default App;
