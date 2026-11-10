import React from 'react';
import { formatTime } from '../utils/formatTime';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/material';
import { LocateFixed } from 'lucide-react';

interface SegmentBoundaryControlsProps {
    label: string;
    boundary: '開始' | '終了';
    value: number;
    disabled: boolean;
    onSeek: (seconds: number) => void;
    onNudge: (delta: number) => void;
    onSnap: () => void;
}

const SegmentBoundaryControls: React.FC<SegmentBoundaryControlsProps> = ({
    label, boundary, value, disabled, onSeek, onNudge, onSnap,
}) => (
    <Box role="group" aria-label={label} sx={{
        display: 'grid', gridTemplateColumns: 'auto minmax(64px, 1fr) 44px 44px 44px',
        alignItems: 'center', gap: 0.5, minWidth: 0,
    }}>
        <Typography variant="body2" color="text.secondary">{boundary}</Typography>
        <Button variant="text" color="inherit" disabled={disabled} onClick={() => onSeek(value)}
            aria-label={`${formatTime(value)}：${label}から再生`} sx={{ minWidth: 0, minHeight: 44, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(value)}
        </Button>
        <Button variant="outlined" color="inherit" disabled={disabled} onClick={() => onNudge(-1)}
            aria-label={`${label}を1秒前へ`} sx={{ minWidth: 0, minHeight: 44, px: 0 }}>−1秒</Button>
        <Button variant="outlined" color="inherit" disabled={disabled} onClick={() => onNudge(1)}
            aria-label={`${label}を1秒後へ`} sx={{ minWidth: 0, minHeight: 44, px: 0 }}>+1秒</Button>
        <Tooltip title="現在の再生位置に合わせる">
            <span>
                <IconButton disabled={disabled} onClick={onSnap} aria-label={`${label}を現在位置に合わせる`}
                    sx={{ width: 44, height: 44, color: 'text.primary' }}>
                    <LocateFixed size={18} />
                </IconButton>
            </span>
        </Tooltip>
    </Box>
);

export default SegmentBoundaryControls;
