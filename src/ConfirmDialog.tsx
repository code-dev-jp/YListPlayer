import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography
} from '@mui/material';

export interface DialogState {
    open: boolean;
    variant: 'alert' | 'confirm' | 'prompt' | 'url-display';
    title: string;
    message?: string;
    defaultValue?: string;
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
                    <Typography variant="body2" sx={{ mb: (isPrompt || isUrlDisplay) ? 2 : 0 }}>
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
                {isUrlDisplay && (
                    <TextField
                        fullWidth
                        size="small"
                        value={state.defaultValue ?? ''}
                        InputProps={{ readOnly: true }}
                        onFocus={(e) => e.target.select()}
                        sx={{ fontFamily: 'monospace' }}
                    />
                )}
            </DialogContent>
            <DialogActions>
                {state.variant !== 'alert' && state.variant !== 'url-display' && (
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