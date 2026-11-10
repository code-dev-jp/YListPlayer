import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Box, Button, Typography, Stack, IconButton,
    Alert, Checkbox, FormControlLabel, Slider
} from '@mui/material';
import { Save, Flag, Trash2, Play } from 'lucide-react';
import { formatTime } from '../utils/formatTime';
import SegmentBoundaryControls from './SegmentBoundaryControls';
import ResizableVideoFrame from './ResizableVideoFrame';
import ConfirmDialog, { DialogState } from './ConfirmDialog';
import { db, Video } from '../utils/db';
import { resolveSegmentAction, getInitialSeekTime, extractVideoId, validateSegmentInput } from '../utils/playback';

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
    isMobile?: boolean;
}

const PlayerSection: React.FC<PlayerSectionProps> = ({ activeVideo, onVideoEnd, isAutoPlaying, isMobile = false }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isVideoResized, setIsVideoResized] = useState(false);
    const showEditor = !isMobile || isEditing;
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [startMarker, setStartMarker] = useState<number | null>(null);
    const [endMarker, setEndMarker] = useState<number | null>(null);
    const [dialog, setDialog] = useState<DialogState>({ open: false, variant: 'confirm', title: '' });
    const [savedMessage, setSavedMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [apiReady, setApiReady] = useState(() => !!window.YT?.Player);
    const [stopOutsideSegment, setStopOutsideSegment] = useState(true);

    const playerRef = useRef<any>(null);
    const savedSegmentsHeadingRef = useRef<HTMLHeadingElement>(null);
    const focusAfterDeleteRef = useRef(false);
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
            setError(null);
            setSavedMessage('');
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
    const seekToSegment = useCallback((sec: number) => {
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
    }, [isPlayerReady]);

    const handleSaveSegment = async () => {
        const validation = validateSegmentInput(startMarker, endMarker, activeVideo?.savedSegments ?? []);
        if (!validation.valid) {
            setError(validation.error);
            return;
        }

        if (activeVideo?.id) {
            const newSegments = [...activeVideo.savedSegments, { start: startMarker!, end: endMarker! }];
            newSegments.sort((a, b) => a.start - b.start);

            await db.videos.update(activeVideo.id, {
                savedSegments: newSegments,
                startMarker: startMarker!,
                endMarker: endMarker!
            });

            setStartMarker(null);
            setEndMarker(null);
            setError(null);
            setSavedMessage('区間を保存しました');
        }
    };

    type Marker = { value: number; type: 'start' | 'end' | 'segStart' | 'segEnd'; segIndex: number };
    const renderBoundary = (mark: Marker) => {
        if (!activeVideo) return null;
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


        const boundary = mark.type === 'start' || mark.type === 'segStart' ? '開始' : '終了';
        const label = `${mark.segIndex < 0 ? '新しい区間' : `区間${mark.segIndex + 1}`}の${boundary}位置`;
        return <SegmentBoundaryControls label={label} boundary={boundary} value={mark.value}
            disabled={!isPlayerReady} onSeek={seekToSegment} onNudge={nudge} onSnap={snapToCurrent} />;
    };

    const seekToPosition = (value: number) => {
        if (!playerRef.current || !isPlayerReady) return;
        seekingRef.current = true;
        playerRef.current.seekTo(value, true);
        setCurrentTime(value);
        endedNotifiedRef.current = false;
        window.setTimeout(() => { seekingRef.current = false; }, 600);
    };

    if (!activeVideo) {
        return (
            <Box sx={{
                width: '100%',
                aspectRatio: isMobile ? '16/9' : undefined,
                flexGrow: isMobile ? undefined : 1,
                minHeight: isMobile ? '200px' : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#000',
                borderRadius: 2
            }}>
                <Typography color="grey.600" sx={{ textAlign: 'center' }}>動画を選択してください</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'auto' : '100%', minHeight: isMobile && isVideoResized ? 'calc(100dvh - 24px)' : 0, overflowY: isMobile ? undefined : 'auto',
            '& :is(button, input):focus-visible, & .Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
            '@media (forced-colors: active)': { '& :is(button, input):focus-visible': { outlineColor: 'Highlight' } },
        }}>
            <ResizableVideoFrame isMobile={isMobile} onResizeModeChange={setIsVideoResized}>
                <Box ref={playerDivRef} sx={{ position: 'absolute', inset: 0 }} />
            </ResizableVideoFrame>

            {isMobile && <FormControlLabel sx={{ alignSelf: 'flex-start', mt: 1 }} label="編集"
                control={<Checkbox checked={isEditing} onChange={(event) => setIsEditing(event.target.checked)}
                    slotProps={{ input: { 'aria-controls': 'segment-editor' } }} />} />}

            {showEditor && <Box id="segment-editor" component="section" aria-labelledby="segment-editor-title" sx={{
                mt: isMobile ? 2 : 0, p: 1.5, bgcolor: 'background.paper', borderRadius: 2, flexShrink: 0,
            }}>
                <Stack spacing={1}>
                    <Stack direction="row" useFlexGap flexWrap="wrap" alignItems="center" justifyContent="space-between" gap={1}>
                        <Typography id="segment-editor-title" component="h2" variant="subtitle1" fontWeight={600}>再生区間を作成</Typography>
                        <FormControlLabel sx={{ m: 0, mr: 'auto' }} control={<Checkbox checked={stopOutsideSegment}
                            onChange={(e) => setStopOutsideSegment(e.target.checked)} size="small" />} label="区間外で停止" />
                        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </Typography>
                    </Stack>
                    <Box>
                        <Slider aria-label="再生位置" min={0} max={duration || 1} step={1}
                            value={Math.min(currentTime, duration || 1)} disabled={!isPlayerReady || duration <= 0}
                            getAriaValueText={(value) => formatTime(value)}
                            onChange={(_, value) => { seekingRef.current = true; setCurrentTime(value as number); }}
                            onChangeCommitted={(_, value) => seekToPosition(value as number)}
                            onTouchCancel={() => { seekingRef.current = false; }}
                            onPointerCancel={() => { seekingRef.current = false; }}
                            sx={{ display: 'block', width: 'auto', mx: 1.5 }} />
                        <Box aria-hidden="true" sx={{ position: 'relative', height: 4, mx: 1.5, mb: 1, bgcolor: 'action.selected', overflow: 'hidden' }}>
                            {duration > 0 && activeVideo.savedSegments.map((seg, i) => (
                                <Box key={i} sx={{ position: 'absolute', height: '100%', bgcolor: 'primary.main',
                                    left: `${(seg.start / (duration || 1)) * 100}%`,
                                    width: `${((seg.end - seg.start) / (duration || 1)) * 100}%`,
                                }} />
                            ))}
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            {isPlayerReady ? '再生位置を選び、開始点と終了点をセットして保存します。' : 'プレイヤーを準備中です。読み込み後に区間を設定できます。'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
                        <Box>
                            <Button fullWidth variant="outlined" color="inherit" disabled={!isPlayerReady}
                                startIcon={<Flag size={18} />} onClick={() => { setStartMarker(currentTime); setSavedMessage(''); }}
                                sx={{ minHeight: 44 }}>開始点をセット</Button>
                            {startMarker !== null ? renderBoundary({ value: startMarker, type: 'start', segIndex: -1 }) :
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>開始位置：未設定</Typography>}
                        </Box>
                        <Box>
                            <Button fullWidth variant="outlined" color="inherit" disabled={!isPlayerReady}
                                startIcon={<Flag size={18} style={{ transform: 'rotate(180deg)' }} />}
                                onClick={() => { setEndMarker(currentTime); setSavedMessage(''); }}
                                sx={{ minHeight: 44 }}>終了点をセット</Button>
                            {endMarker !== null ? renderBoundary({ value: endMarker, type: 'end', segIndex: -1 }) :
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>終了位置：未設定</Typography>}
                        </Box>
                        <Box>
                            <Button fullWidth variant="contained" startIcon={<Save size={18} />} onClick={handleSaveSegment}
                                disabled={!isPlayerReady} sx={{ minHeight: 44, color: 'background.default', '&:hover': { bgcolor: 'primary.light' } }}>区間を保存</Button>
                            <Typography role="status" variant="body2" color="text.secondary">{savedMessage}</Typography>
                        </Box>
                    </Box>
                    {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
                </Stack>
            </Box>}

            <Box component="section" aria-labelledby="saved-segments-title" sx={{
                mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 2,
                flexShrink: 0, height: 150, minHeight: 150, flexGrow: isVideoResized ? 1 : 0, display: 'flex', flexDirection: 'column',
            }}>
                <Typography ref={savedSegmentsHeadingRef} tabIndex={-1} id="saved-segments-title" component="h2" variant="subtitle1" fontWeight={600} sx={{ mb: 1, flexShrink: 0,
                    '&:focus': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
                }}>
                    保存済み区間（{activeVideo.savedSegments.length}）
                </Typography>
                <Box role="region" aria-label="保存済み区間の一覧" tabIndex={0} sx={{
                    flexGrow: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', p: 0.5,
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '2px' },
                }}>
                {activeVideo.savedSegments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">{showEditor
                        ? '保存した区間がここに表示されます。上の開始点と終了点をセットして保存してください。'
                        : '保存した区間はありません。「編集」をオンにすると区間を作成できます。'}</Typography>
                ) : (
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">{showEditor
                            ? '時刻を選ぶと再生。±1秒で調整し、◎で現在位置に合わせます。変更は自動保存されます。'
                            : '区間を選ぶと、その位置から再生します。'}</Typography>
                        {activeVideo.savedSegments.map((seg, i) => (
                            <Box key={i} sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                                    <Button color="inherit" startIcon={<Play size={16} />} disabled={!isPlayerReady}
                                        aria-label={`区間 ${i + 1} · ${formatTime(seg.start)}–${formatTime(seg.end)} を再生`} onClick={() => seekToSegment(seg.start)}
                                        sx={{ minHeight: 44, fontVariantNumeric: 'tabular-nums' }}>区間 {i + 1} · {formatTime(seg.start)}–{formatTime(seg.end)}</Button>
                                    {showEditor && <IconButton aria-label={`区間${i + 1}を削除`} sx={{ width: 44, height: 44, color: 'text.secondary' }}
                                        onClick={() => setDialog({
                                            open: true, variant: 'confirm', title: `区間${i + 1}を削除しますか？`,
                                            message: `${formatTime(seg.start)}–${formatTime(seg.end)}の区間を削除します。この操作は取り消せません。`,
                                            onResult: async (ok) => {
                                                if (ok && activeVideo.id) {
                                                    focusAfterDeleteRef.current = true;
                                                    const newSegments = activeVideo.savedSegments.filter((_, idx) => idx !== i);
                                                    await db.videos.update(activeVideo.id, { savedSegments: newSegments });
                                                }
                                            },
                                        })}><Trash2 size={18} /></IconButton>}
                                </Stack>
                                {showEditor && <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: { xs: 0.5, lg: 2 } }}>
                                    {renderBoundary({ value: seg.start, type: 'segStart', segIndex: i })}
                                    {renderBoundary({ value: seg.end, type: 'segEnd', segIndex: i })}
                                </Box>}
                            </Box>
                        ))}
                    </Stack>
                )}
                </Box>
            </Box>
            <ConfirmDialog state={dialog} onChange={setDialog} onExited={() => {
                if (focusAfterDeleteRef.current) {
                    savedSegmentsHeadingRef.current?.focus();
                    focusAfterDeleteRef.current = false;
                }
            }} />

        </Box>
    );
};

export default PlayerSection;
