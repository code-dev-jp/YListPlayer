import React, { useState, useRef, useEffect } from 'react';
import {
    Box, Button, Typography, Slider, Stack, IconButton,
    Alert, Snackbar
} from '@mui/material';
import { Play, Pause, Save, Flag, Trash2 } from 'lucide-react';
import { db, Video } from './db';

// YouTube IFrame API の型定義（簡易版）
declare global {
    interface Window {
        onYouTubeIframeAPIReady: () => void;
        YT: any;
    }
}

interface PlayerSectionProps {
    activeVideo: Video | null;
    onVideoEnd: () => void;
    isAutoPlaying: boolean;
}

const PlayerSection: React.FC<PlayerSectionProps> = ({ activeVideo, onVideoEnd, isAutoPlaying }) => {
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [startMarker, setStartMarker] = useState<number | null>(null);
    const [endMarker, setEndMarker] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [apiReady, setApiReady] = useState(() => !!window.YT?.Player);

    const playerRef = useRef<any>(null);
    const playerDivRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<number | null>(null);
    // ponytail: ドラッグ中のポーリング上書きを抑止するだけのフラグ。ロック等は不要
    const seekingRef = useRef(false);
    // ponytail: プレイヤー再生成なしで最新の終了コールバックを呼ぶ
    const onVideoEndRef = useRef(onVideoEnd);
    useEffect(() => { onVideoEndRef.current = onVideoEnd; });

    // YouTube API のロード
    useEffect(() => {
        if (window.YT?.Player) {
            setApiReady(true);
            return;
        }
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        window.onYouTubeIframeAPIReady = () => setApiReady(true);
    }, []);

    // 動画切り替え時の初期化（IDが変わったときのみ。保存区間のDB更新ではリセットしない）
    const activeVideoId = activeVideo?.id;
    useEffect(() => {
        if (activeVideoId) {
            setStartMarker(null);
            setEndMarker(null);
            setIsPlayerReady(false);
            setPlaying(false);
            setCurrentTime(0);
            setDuration(0);
            playerRef.current = null;
            // 自動再生フラグは、プレイヤーが準備できてから適用される
        }
    }, [activeVideoId]);

    // Play ALL等でisAutoPlayingが後からtrueになった場合（既にプレイヤー準備済み）の再生
    useEffect(() => {
        if (isAutoPlaying && isPlayerReady && playerRef.current) {
            try {
                const first = activeVideo?.savedSegments?.[0]?.start ?? activeVideo?.startMarker;
                if (first != null) playerRef.current.seekTo(first, true);
                playerRef.current.playVideo();
                setPlaying(true);
            } catch (e) {
                console.error('Error during autoplay:', e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAutoPlaying, isPlayerReady]);

    // セグメント監視ロジック
    useEffect(() => {
        if (activeVideo && isPlayerReady && playerRef.current) {
            const checkSegment = () => {
                if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;
                // ponytail: 自作UIドラッグ中のseekToとポーリングの競合を避ける
                if (seekingRef.current) return;

                try {
                    const current = playerRef.current.getCurrentTime();
                    setCurrentTime(current);

                    const d = playerRef.current.getDuration();
                    if (d > 0 && duration === 0) setDuration(d);

                    if (activeVideo.savedSegments && activeVideo.savedSegments.length > 0) {
                        const currentSegment = activeVideo.savedSegments.find(seg =>
                            current >= seg.start - 0.5 && current <= seg.end + 0.5
                        );

                        if (!currentSegment) {
                            const nextSegment = activeVideo.savedSegments.find(seg => seg.start > current);
                            if (nextSegment) {
                                if (Math.abs(nextSegment.start - current) > 0.5) {
                                    playerRef.current.seekTo(nextSegment.start, true);
                                }
                            } else {
                                onVideoEnd();
                            }
                        } else if (current >= currentSegment.end) {
                            const nextSegment = activeVideo.savedSegments.find(seg => seg.start > currentSegment.end);
                            if (nextSegment) {
                                playerRef.current.seekTo(nextSegment.start, true);
                            } else {
                                onVideoEnd();
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error during checkSegment:', e);
                }
            };

            intervalRef.current = window.setInterval(checkSegment, 500);
            return () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
            };
        }
    }, [activeVideo, isPlayerReady, onVideoEnd, duration]);

    const extractVideoId = (url: string) => {
        const match = url.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : '';
    };

    const videoId = activeVideo ? extractVideoId(activeVideo.youtubeUrl) : '';
    useEffect(() => {
        if (!apiReady || !videoId || !playerDivRef.current) return;
        const player = new window.YT.Player(playerDivRef.current, {
            videoId,
            // ponytail: 未指定だと640x360固定になるため全体に広げる
            width: '100%',
            height: '100%',
            playerVars: {
                modestbranding: 1, rel: 0, iv_load_policy: 3,
                controls: 0, disablekb: 1, fs: 0, autoplay: 1,
            },
            events: {
                onReady: (event: any) => {
                    playerRef.current = event.target;
                    setIsPlayerReady(true);
                    setDuration(event.target.getDuration());

                    // 保存された最初の区間があればそこにシーク
                    if (activeVideo && activeVideo.savedSegments.length > 0) {
                        event.target.seekTo(activeVideo.savedSegments[0].start, true);
                    } else if (activeVideo?.startMarker) {
                        event.target.seekTo(activeVideo.startMarker, true);
                    }

                    // ponytail: 選択＝再生。ブロック時は自作再生ボタンで開始できる
                    event.target.playVideo();
                    setPlaying(true);
                },
                onStateChange: (event: any) => {
                    if (event.data === window.YT.PlayerState.PLAYING) setPlaying(true);
                    if (event.data === window.YT.PlayerState.PAUSED) setPlaying(false);
                    if (event.data === window.YT.PlayerState.ENDED) onVideoEndRef.current();
                }
            }
        });
        return () => {
            try { player.destroy(); } catch { /* already gone */ }
            if (playerRef.current === player) playerRef.current = null;
        };
        // ponytail: activeVideo全体をdepsに入れると区間保存のたび再生成されるためvideoIdのみ
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiReady, videoId]);

    const togglePlay = () => {
        if (!playerRef.current) return;
        if (playing) {
            playerRef.current.pauseVideo();
        } else {
            playerRef.current.playVideo();
        }
        setPlaying(!playing);
    };

    const handleSeekPreview = (val: number) => {
        setCurrentTime(val);
    };

    const handleSeekCommit = (val: number) => {
        if (playerRef.current) {
            seekingRef.current = false;
            playerRef.current.seekTo(val, true);
            setCurrentTime(val);
        }
    };

    const setMarker = (type: 'start' | 'end') => {
        if (type === 'start') setStartMarker(currentTime);
        else setEndMarker(currentTime);
    };

    const handleSaveSegment = async () => {
        if (startMarker === null || endMarker === null) {
            setError('開始マーカーと終了マーカーの両方を設定してください。');
            return;
        }
        if (startMarker >= endMarker) {
            setError('開始位置は終了位置より前である必要があります。');
            return;
        }

        const isOverlapping = activeVideo?.savedSegments.some(seg =>
            (startMarker < seg.end && endMarker > seg.start)
        );

        if (isOverlapping) {
            setError('既存の区間と重なっています。');
            return;
        }

        if (activeVideo?.id) {
            const newSegments = [...activeVideo.savedSegments, { start: startMarker, end: endMarker }];
            newSegments.sort((a, b) => a.start - b.start);

            await db.videos.update(activeVideo.id, {
                savedSegments: newSegments,
                startMarker: startMarker,
                endMarker: endMarker
            });

            setStartMarker(null);
            setEndMarker(null);
            setError(null);
        }
    };

    if (!activeVideo) {
        return (
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000', borderRadius: 2 }}>
                <Typography color="grey.600">Please select a video from the sidebar</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: '#000', borderRadius: 2, overflow: 'hidden' }}>
                <Box ref={playerDivRef} sx={{ position: 'absolute', inset: 0 }} />
                {/* ponytail: 埋め込み側の直接操作を遮断し自作UIに一本化する透明層 */}
                <Box sx={{ position: 'absolute', inset: 0, cursor: 'default' }} />
            </Box>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="caption" color="grey.500">
                            {activeVideo.savedSegments.length > 0 ? `${activeVideo.savedSegments.length}個の保存済み区間があります` : 'シークバーで範囲を指定してください'}
                        </Typography>
                        <Slider
                            value={currentTime}
                            max={duration || 100}
                            disabled={!isPlayerReady}
                            onChange={(_, val) => {
                                seekingRef.current = true;
                                handleSeekPreview(val as number);
                            }}
                            onChangeCommitted={(_, val) => handleSeekCommit(val as number)}
                            marks={[
                                ...(startMarker !== null ? [{ value: startMarker, label: 'S' }] : []),
                                ...(endMarker !== null ? [{ value: endMarker, label: 'E' }] : []),
                                ...activeVideo.savedSegments.flatMap((seg, i) => [
                                    { value: seg.start, label: `[${i + 1}` },
                                    { value: seg.end, label: `]` }
                                ])
                            ]}
                            sx={{
                                '& .MuiSlider-markLabel': { color: 'primary.main', fontWeight: 'bold', fontSize: '0.7rem' }
                            }}
                        />
                    </Box>

                    <Stack direction="row" spacing={2} alignItems="center">
                        <Button
                            variant="outlined"
                            startIcon={<Flag size={18} />}
                            onClick={() => setMarker('start')}
                            color={startMarker !== null ? 'primary' : 'inherit'}
                        >
                            Set Start
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<Flag size={18} style={{ transform: 'rotate(180deg)' }} />}
                            onClick={() => setMarker('end')}
                            color={endMarker !== null ? 'primary' : 'inherit'}
                        >
                            Set Stop
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<Save size={18} />}
                            onClick={handleSaveSegment}
                            disabled={startMarker === null || endMarker === null}
                        >
                            Save Segment
                        </Button>

                        <Box sx={{ flexGrow: 1 }} />

                        <IconButton onClick={togglePlay} color="primary" disabled={!isPlayerReady}>
                            {playing ? <Pause size={32} /> : <Play size={32} />}
                        </IconButton>
                    </Stack>
                </Stack>
            </Box>

            {activeVideo.savedSegments && activeVideo.savedSegments.length > 0 && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2, flexGrow: 0, overflowY: 'auto', maxHeight: '150px' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>保存済み区間リスト</Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {activeVideo.savedSegments.map((seg, i) => (
                            <Box
                                key={i}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: 1,
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <Typography variant="caption" sx={{ mr: 1 }}>
                                    #{i + 1}: {Math.floor(seg.start)}s - {Math.floor(seg.end)}s
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={async () => {
                                        if (activeVideo.id) {
                                            const newSegments = activeVideo.savedSegments.filter((_, idx) => idx !== i);
                                            await db.videos.update(activeVideo.id, { savedSegments: newSegments });
                                        }
                                    }}
                                    sx={{ color: 'grey.500', '&:hover': { color: 'error.main' } }}
                                >
                                    <Trash2 size={14} />
                                </IconButton>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}

            {error && (
                <Snackbar open onClose={() => setError(null)} autoHideDuration={4000}>
                    <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>
                </Snackbar>
            )}
        </Box>
    );
};

export default PlayerSection;
