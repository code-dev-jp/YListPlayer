import React, { useState, useRef, useEffect } from 'react';
import {
    Box, Button, Typography, Stack, IconButton,
    Alert, Snackbar, Checkbox, FormControlLabel, LinearProgress
} from '@mui/material';
import { Save, Flag, Trash2 } from 'lucide-react';
import { db, Video } from './db';
import { resolveSegmentAction, getInitialSeekTime, extractVideoId } from './playback';

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
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [startMarker, setStartMarker] = useState<number | null>(null);
    const [endMarker, setEndMarker] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [apiReady, setApiReady] = useState(() => !!window.YT?.Player);
    const [stopOutsideSegment, setStopOutsideSegment] = useState(true);

    const playerRef = useRef<any>(null);
    const playerDivRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<number | null>(null);
    // ponytail: 区間終了の二重通知を抑止するだけのフラグ。区間に戻ったら解除される
    const endedNotifiedRef = useRef(false);
    // ponytail: ドラッグ中のポーリング上書きを抑止するだけのフラグ。ロック等は不要
    const seekingRef = useRef(false);
    // ponytail: ポーリング内でplaying状態を参照するためのref（effect depsを増やさない）
    const playingRef = useRef(false);
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
            playingRef.current = false;
            setCurrentTime(0);
            setDuration(0);
            playerRef.current = null;
            endedNotifiedRef.current = false;
            // 自動再生フラグは、プレイヤーが準備できてから適用される
        }
    }, [activeVideoId]);

    // Play ALL等でisAutoPlayingが後からtrueになった場合（既にプレイヤー準備済み）の再生
    useEffect(() => {
        if (isAutoPlaying && isPlayerReady && playerRef.current) {
            try {
                const seekTime = getInitialSeekTime(activeVideo?.savedSegments ?? [], activeVideo?.startMarker);
                if (seekTime != null) playerRef.current.seekTo(seekTime, true);
                playerRef.current.playVideo();
                playingRef.current = true;
            } catch (e) {
                console.error('Error during autoplay:', e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAutoPlaying, isPlayerReady]);

    // セグメント監視ロジック（判定条件は playback.ts の resolveSegmentAction が単一の真実）
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

                    const action = resolveSegmentAction(activeVideo.savedSegments ?? [], current, playingRef.current);
                    if (!stopOutsideSegment && action.kind !== 'continue') {
                        endedNotifiedRef.current = false;
                    } else if (action.kind === 'seek') {
                        // ponytail: seekingRefでポーリングをブロックし、YouTube側の遅延によるスナップバックを防止
                        seekingRef.current = true;
                        playerRef.current.seekTo(action.time, true);
                        setTimeout(() => { seekingRef.current = false; }, 600);
                    } else if (action.kind === 'end') {
                        // ponytail: 500ms毎の再通知を1回に抑え、その場で止める。
                        // 連続再生ならApp側が次へ進める（onVideoEnd経由）
                        if (!endedNotifiedRef.current) {
                            endedNotifiedRef.current = true;
                            try { playerRef.current.pauseVideo(); } catch { /* already gone */ }
                            playingRef.current = false;
                            onVideoEndRef.current();
                        }
                    } else {
                        endedNotifiedRef.current = false;
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
    }, [activeVideo, isPlayerReady, duration, stopOutsideSegment]);

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
                autoplay: 1,
            },
            events: {
                onReady: (event: any) => {
                    playerRef.current = event.target;
                    setIsPlayerReady(true);
                    setDuration(event.target.getDuration());

                    const seekTime = getInitialSeekTime(activeVideo?.savedSegments ?? [], activeVideo?.startMarker);
                    if (seekTime != null) event.target.seekTo(seekTime, true);

                    // ponytail: 選択＝再生。ブロック時は自作再生ボタンで開始できる
                event.target.playVideo();
                playingRef.current = true;
                },
                onStateChange: (event: any) => {
                    if (event.data === window.YT.PlayerState.PLAYING) {
                        playingRef.current = true;
                    }
                    if (event.data === window.YT.PlayerState.PAUSED) {
                        playingRef.current = false;
                    }
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

    // ponytail: 区間チップクリック→その先頭へseekして再生再開
    const seekToSegment = (sec: number) => {
        if (!playerRef.current || !isPlayerReady) return;
        try {
            seekingRef.current = false;
            endedNotifiedRef.current = false;
            playerRef.current.seekTo(sec, true);
            setCurrentTime(sec);
            playerRef.current.playVideo();
            playingRef.current = true;
        } catch (e) {
            console.error('Error during seekToSegment:', e);
        }
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
            </Box>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                <Stack spacing={2}>
                    <Box sx={{ position: 'relative', mx: 1.5 }}>
                        <LinearProgress
                            variant="determinate"
                            value={(currentTime / (duration || 1)) * 100}
                        />
                        {([] as { value: number; label: string; type: 'start' | 'end' | 'segStart' | 'segEnd'; segIndex: number }[])
                            .concat(startMarker !== null ? [{ value: startMarker, label: 'S', type: 'start' as const, segIndex: -1 }] : [])
                            .concat(endMarker !== null ? [{ value: endMarker, label: 'E', type: 'end' as const, segIndex: -1 }] : [])
                            .concat(activeVideo.savedSegments.flatMap((seg, i) => [
                                { value: seg.start, label: `[${i + 1}`, type: 'segStart' as const, segIndex: i },
                                { value: seg.end, label: `${i + 1}]`, type: 'segEnd' as const, segIndex: i }
                            ]))
                            .map((mark, i) => {
                                // 移動先 next がマーカー種別の区間として他区間と重なるか、
                                // または start/end の順序が逆転するか判定する。
                                // 問題がある場合は true を返す（呼び出し側でエラーを表示する）
                                const wouldOverlap = (next: number): { blocked: true; reason: string } | false => {
                                    const segs = activeVideo.savedSegments;
                                    let newStart: number;
                                    let newEnd: number;
                                    let otherSegs: typeof segs;

                                    if (mark.type === 'start') {
                                        newStart = next;
                                        newEnd = endMarker ?? next;
                                        otherSegs = segs;
                                        // endMarker が設定済みなら逆転チェック
                                        if (endMarker !== null && next >= endMarker) {
                                            return { blocked: true, reason: '開始位置は終了位置より前にしてください。' };
                                        }
                                    } else if (mark.type === 'end') {
                                        newStart = startMarker ?? next;
                                        newEnd = next;
                                        otherSegs = segs;
                                        // startMarker が設定済みなら逆転チェック
                                        if (startMarker !== null && next <= startMarker) {
                                            return { blocked: true, reason: '終了位置は開始位置より後にしてください。' };
                                        }
                                    } else {
                                        const self = segs[mark.segIndex];
                                        newStart = mark.type === 'segStart' ? next : self.start;
                                        newEnd   = mark.type === 'segEnd'   ? next : self.end;
                                        otherSegs = segs.filter((_, idx) => idx !== mark.segIndex);
                                        // 保存済み区間の逆転チェック
                                        if (newStart >= newEnd) {
                                            return { blocked: true, reason: mark.type === 'segStart'
                                                ? '開始位置は終了位置より前にしてください。'
                                                : '終了位置は開始位置より後にしてください。' };
                                        }
                                    }

                                    if (newStart < newEnd && otherSegs.some(s => newStart < s.end && newEnd > s.start)) {
                                        return { blocked: true, reason: '他の区間をまたぐため移動できません。' };
                                    }
                                    return false;
                                };

                                const nudge = async (delta: number) => {
                                    const next = Math.max(0, mark.value + delta);

                                    const check = wouldOverlap(next);
                                    if (check) {
                                        setError(check.reason);
                                        return;
                                    }

                                    if (mark.type === 'start') {
                                        setStartMarker(next);
                                    } else if (mark.type === 'end') {
                                        setEndMarker(next);
                                    } else if (activeVideo.id != null) {
                                        const segs = activeVideo.savedSegments.map((s, idx) => {
                                            if (idx !== mark.segIndex) return s;
                                            return mark.type === 'segStart'
                                                ? { ...s, start: next }
                                                : { ...s, end: next };
                                        });
                                        await db.videos.update(activeVideo.id, { savedSegments: segs });
                                    }
                                    if (playerRef.current && isPlayerReady) {
                                        try {
                                            seekingRef.current = true;
                                            playerRef.current.seekTo(next, true);
                                            setCurrentTime(next);
                                            setTimeout(() => { seekingRef.current = false; }, 600);
                                        } catch (e) {
                                            console.error('Error during nudge seek:', e);
                                        }
                                    }
                                };

                                // ↯: 現在の再生位置へマーカーを移動。他区間をまたぐ/逆転する場合はブロック
                                const snapToCurrent = async () => {
                                    const next = currentTime;

                                    const check = wouldOverlap(next);
                                    if (check) {
                                        setError(check.reason);
                                        return;
                                    }

                                    const segs = activeVideo.savedSegments;
                                    if (mark.type === 'start') {
                                        setStartMarker(next);
                                    } else if (mark.type === 'end') {
                                        setEndMarker(next);
                                    } else if (activeVideo.id != null) {
                                        const updated = segs.map((s, idx) => {
                                            if (idx !== mark.segIndex) return s;
                                            return mark.type === 'segStart'
                                                ? { ...s, start: next }
                                                : { ...s, end: next };
                                        });
                                        await db.videos.update(activeVideo.id, { savedSegments: updated });
                                    }
                                };

                                return (
                                    <Box
                                        key={i}
                                        sx={{
                                            position: 'absolute',
                                            bottom: '100%',
                                            left: `${(mark.value / (duration || 100)) * 100}%`,
                                            transform: 'translateX(-50%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '2px',
                                            lineHeight: 1,
                                        }}
                                    >
                                        {(mark.type === 'start' || mark.type === 'segStart') && (
                                            <Box
                                                component="button"
                                                onClick={snapToCurrent}
                                                title="現在の再生位置に合わせる"
                                                sx={{
                                                    bgcolor: 'transparent',
                                                    border: 'none',
                                                    color: 'warning.main',
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer',
                                                    p: '0 2px',
                                                    lineHeight: 1,
                                                    '&:hover': { color: 'warning.light' },
                                                }}
                                            >↯</Box>
                                        )}
                                        <Box
                                            component="button"
                                            onClick={() => nudge(-1)}
                                            title="-1秒"
                                            sx={{
                                                bgcolor: 'transparent',
                                                border: 'none',
                                                color: 'primary.main',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                p: '0 3px',
                                                lineHeight: 1,
                                                '&:hover': { color: 'primary.light' },
                                            }}
                                        >◂</Box>
                                        <Box
                                            component="button"
                                            onClick={() => seekToSegment(mark.value)}
                                            title={`${mark.label} に飛ぶ`}
                                            sx={{
                                                bgcolor: 'transparent',
                                                border: 'none',
                                                color: 'primary.main',
                                                fontWeight: 'bold',
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                p: '0 2px',
                                                lineHeight: 1,
                                                '&:hover': { color: 'primary.light' },
                                            }}
                                        >
                                            {mark.label}
                                        </Box>
                                        <Box
                                            component="button"
                                            onClick={() => nudge(+1)}
                                            title="+1秒"
                                            sx={{
                                                bgcolor: 'transparent',
                                                border: 'none',
                                                color: 'primary.main',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer',
                                                p: '0 3px',
                                                lineHeight: 1,
                                                '&:hover': { color: 'primary.light' },
                                            }}
                                        >▸</Box>
                                        {(mark.type === 'end' || mark.type === 'segEnd') && (
                                            <Box
                                                component="button"
                                                onClick={snapToCurrent}
                                                title="現在の再生位置に合わせる"
                                                sx={{
                                                    bgcolor: 'transparent',
                                                    border: 'none',
                                                    color: 'warning.main',
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer',
                                                    p: '0 2px',
                                                    lineHeight: 1,
                                                    '&:hover': { color: 'warning.light' },
                                                }}
                                            >↯</Box>
                                        )}
                                    </Box>
                                );
                            })
                        }
                    </Box>

                    <Stack direction="row" spacing={2} alignItems="center">
                        <Button
                            variant="outlined"
                            startIcon={<Flag size={18} />}
                            onClick={() => setStartMarker(currentTime)}
                            color={startMarker !== null ? 'primary' : 'inherit'}
                        >
                            Set Start
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<Flag size={18} style={{ transform: 'rotate(180deg)' }} />}
                            onClick={() => setEndMarker(currentTime)}
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

                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={stopOutsideSegment}
                                    onChange={(e) => setStopOutsideSegment(e.target.checked)}
                                    size="small"
                                />
                            }
                            label="区間外で停止"
                        />
                    </Stack>
                </Stack>
            </Box>

            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2, flexGrow: 0, overflowY: 'auto', maxHeight: '150px' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main' }}>保存済み区間リスト</Typography>
                {activeVideo.savedSegments.length === 0 ? (
                    <Typography variant="caption" color="grey.500">区間が保存されていません</Typography>
                ) : (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                        {activeVideo.savedSegments.map((seg, i) => (
                            <Box
                                key={i}
                                onClick={() => seekToSegment(seg.start)}
                                title="この区間から再生"
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    bgcolor: 'rgba(255,255,255,0.05)',
                                    px: 1.5,
                                    py: 0.5,
                                    borderRadius: 1,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' }
                                }}
                            >
                                <Typography variant="caption" sx={{ mr: 1 }}>
                                    #{i + 1}: {Math.floor(seg.start)}s - {Math.floor(seg.end)}s
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={async (e) => {
                                        e.stopPropagation();
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
                )}
            </Box>

            {error && (
                <Snackbar open onClose={() => setError(null)} autoHideDuration={4000}>
                    <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>
                </Snackbar>
            )}
        </Box>
    );
};

export default PlayerSection;
