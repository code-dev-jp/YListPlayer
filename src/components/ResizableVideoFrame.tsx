import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, GlobalStyles, IconButton, Tooltip } from '@mui/material';
import { Minus, Plus } from 'lucide-react';

interface ResizableVideoFrameProps {
    isMobile: boolean;
    children: React.ReactNode;
    onResizeModeChange: (manual: boolean) => void;
}

const ResizableVideoFrame: React.FC<ResizableVideoFrameProps> = ({ isMobile, children, onResizeModeChange }) => {
    const frameId = useId();
    const frameRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; y: number; height: number } | null>(null);
    const minimum = isMobile ? 200 : 240;
    const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
    const [height, setHeight] = useState<number | null>(null);
    const [measuredHeight, setMeasuredHeight] = useState(minimum);
    const [isDragging, setIsDragging] = useState(false);
    const maximum = Math.max(minimum, viewportHeight - (isMobile ? 200 : 0));
    const clamp = (value: number) => Math.round(Math.max(minimum, Math.min(maximum, value)));
    const isManual = height !== null;

    useLayoutEffect(() => { onResizeModeChange(isManual); }, [isManual, onResizeModeChange]);

    useEffect(() => {
        const updateViewport = () => {
            const next = window.innerHeight;
            setViewportHeight(next);
            setHeight(value => value === null ? null : Math.max(minimum, Math.min(Math.max(minimum, next - (isMobile ? 200 : 0)), value)));
        };
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, [minimum, isMobile]);

    useEffect(() => {
        if (!frameRef.current) return;
        const observer = new ResizeObserver(([entry]) => setMeasuredHeight(Math.round(entry.contentRect.height)));
        observer.observe(frameRef.current);
        return () => observer.disconnect();
    }, []);

    const changeHeight = (delta: number) => setHeight(clamp((frameRef.current?.getBoundingClientRect().height ?? minimum) + delta));
    const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        if (dragRef.current?.pointerId !== event.pointerId) return;
        dragRef.current = null;
        setIsDragging(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };

    return <>
        {isMobile && <GlobalStyles styles={{ html: { scrollPaddingTop: measuredHeight + 12 } }} />}
        <Box id={frameId} ref={frameRef} role="region" aria-label="動画プレイヤー" sx={{
            width: '100%', height: height === null ? undefined : clamp(height), maxHeight: maximum,
            aspectRatio: isMobile && height === null ? '16/9' : undefined,
            flexGrow: !isMobile && height === null ? 1 : 0,
            minHeight: minimum, flexShrink: 0, position: isMobile ? 'sticky' : 'relative',
            top: isMobile ? 0 : undefined, zIndex: isMobile ? 1 : undefined, bgcolor: '#000', borderRadius: 2,
            overflow: 'hidden', pointerEvents: isDragging ? 'none' : undefined,
        }}>{children}</Box>
        <Box role="group" aria-label="動画サイズ調整" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            <Tooltip describeChild title="上下にドラッグ、または↑↓キーで高さを変更">
                <Box role="separator" aria-orientation="horizontal" tabIndex={0} aria-label="動画の高さを変更"
                    aria-controls={frameId} aria-valuemin={minimum} aria-valuemax={maximum}
                    aria-valuenow={clamp(height ?? measuredHeight)}
                    aria-valuetext={`${clamp(height ?? measuredHeight)}px`}
                    onPointerDown={(event) => {
                        if (event.button !== 0 || !event.isPrimary || dragRef.current) return;
                        event.preventDefault();
                        event.currentTarget.focus({ preventScroll: true });
                        event.currentTarget.setPointerCapture(event.pointerId);
                        const start = frameRef.current?.getBoundingClientRect().height ?? minimum;
                        dragRef.current = { pointerId: event.pointerId, y: event.clientY, height: start };
                        setHeight(clamp(start));
                        setIsDragging(true);
                    }}
                    onPointerMove={(event) => {
                        const drag = dragRef.current;
                        if (drag?.pointerId === event.pointerId) setHeight(clamp(drag.height + event.clientY - drag.y));
                    }}
                    onPointerUp={finishDrag} onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
                    onKeyDown={(event) => {
                        const step = event.shiftKey ? 50 : 10;
                        if (event.key === 'ArrowUp') changeHeight(-step);
                        else if (event.key === 'ArrowDown') changeHeight(step);
                        else if (event.key === 'Home') setHeight(minimum);
                        else if (event.key === 'End') setHeight(maximum);
                        else return;
                        event.preventDefault();
                        const handle = event.currentTarget;
                        window.requestAnimationFrame(() => handle.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
                    }}
                    sx={{ flexGrow: 1, minHeight: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'ns-resize', touchAction: 'none', userSelect: 'none', borderRadius: 1,
                        '&:hover': { bgcolor: 'action.hover' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: '-2px' },
                    }}>
                    <Box aria-hidden="true" sx={{ width: 48, height: 4, bgcolor: 'text.secondary', borderRadius: 1, pointerEvents: 'none' }} />
                </Box>
            </Tooltip>
            <Tooltip title="動画を低くする"><IconButton aria-label="動画を低くする" size="small" onClick={() => changeHeight(-10)}
                sx={{ width: 32, height: 32 }}><Minus size={16} /></IconButton></Tooltip>
            <Tooltip title="動画を高くする"><IconButton aria-label="動画を高くする" size="small" onClick={() => changeHeight(10)}
                sx={{ width: 32, height: 32 }}><Plus size={16} /></IconButton></Tooltip>
            <Button color="inherit" size="small" aria-label="動画の高さを自動に戻す" onClick={() => setHeight(null)} sx={{ minHeight: 32 }}>自動</Button>
        </Box>
    </>;
};

export default ResizableVideoFrame;
