import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography, Box
} from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';

export interface DialogState {
    open: boolean;
    variant: 'alert' | 'confirm' | 'prompt' | 'url-display' | 'qr-display';
    title: string;
    message?: string;
    defaultValue?: string;
    qrValue?: string;
    /** confirm variant のOKボタンのラベル（省略時は「削除」） */
    confirmLabel?: string;
    /** confirm variant のOKボタンの色（省略時は 'error'） */
    confirmColor?: 'error' | 'primary' | 'warning' | 'success';
    onResult?: (ok: boolean, value?: string) => void;
}

interface ConfirmDialogProps {
    state: DialogState;
    onChange: (s: DialogState) => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ state, onChange }) => {
    const [value, setValue] = useState(state.defaultValue ?? '');

    useEffect(() => {
        if (state.open) setValue(state.defaultValue ?? '');
    }, [state.open, state.defaultValue]);

    const close = (ok: boolean) => {
        const result = ok && state.variant === 'prompt' ? value.trim() : undefined;
        // 先にダイアログを閉じてから onResult を呼ぶ。
        // 逆順にすると onResult 内で setDialog した新ダイアログが
        // onChange({ open: false }) で即上書きされてしまう。
        onChange({ ...state, open: false });
        state.onResult?.(ok, result);
    };

    const isPrompt = state.variant === 'prompt';
    const isUrlDisplay = state.variant === 'url-display';
    const isQrDisplay = state.variant === 'qr-display';
    const displayUrl = state.defaultValue ?? '';
    const qrCodeValue = state.qrValue || displayUrl;

    return (
        <Dialog
            open={state.open}
            onClose={() => close(false)}
            onKeyDown={(e) => { if (e.key === 'Enter' && isPrompt) close(true); }}
        >
            <DialogTitle sx={{ color: state.variant === 'alert' ? 'error.main' : 'inherit' }}>
                {state.title}
            </DialogTitle>
            <DialogContent sx={{ minWidth: 320 }}>
                {state.message && (
                    <Typography variant="body2" sx={{ mb: (isPrompt || isUrlDisplay || isQrDisplay) ? 2 : 0 }}>
                        {state.message}
                    </Typography>
                )}
                {isPrompt && (
                    <TextField
                        fullWidth
                        size="small"
                        autoFocus
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                    />
                )}
                {(isUrlDisplay || isQrDisplay) && (
                    <TextField
                        fullWidth
                        size="small"
                        value={displayUrl}
                        InputProps={{ readOnly: true }}
                        onFocus={(e) => e.target.select()}
                        sx={{ fontFamily: 'monospace', mb: isQrDisplay ? 2 : 0 }}
                    />
                )}
                {isQrDisplay && qrCodeValue && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2, bgcolor: 'white', borderRadius: 2 }}>
                        <QRCodeSVG value={qrCodeValue} size={200} marginSize={2} />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                {state.variant !== 'alert' && state.variant !== 'url-display' && state.variant !== 'qr-display' && (
                    <Button onClick={() => close(false)}>キャンセル</Button>
                )}
                <Button
                    variant="contained"
                    color={state.variant === 'confirm' ? (state.confirmColor ?? 'error') : 'primary'}
                    onClick={() => close(true)}
                >
                    {state.variant === 'confirm' ? (state.confirmLabel ?? '削除') : 'OK'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;