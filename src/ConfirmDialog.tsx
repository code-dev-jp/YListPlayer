import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography
} from '@mui/material';

export interface DialogState {
    open: boolean;
    variant: 'alert' | 'confirm' | 'prompt';
    title: string;
    message?: string;
    defaultValue?: string;
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
        state.onResult?.(ok, result);
        onChange({ ...state, open: false });
    };

    const isPrompt = state.variant === 'prompt';

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
                    <Typography variant="body2" sx={{ mb: isPrompt ? 2 : 0 }}>
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
            </DialogContent>
            <DialogActions>
                {state.variant !== 'alert' && (
                    <Button onClick={() => close(false)}>キャンセル</Button>
                )}
                <Button
                    variant="contained"
                    color={state.variant === 'confirm' ? 'error' : 'primary'}
                    onClick={() => close(true)}
                >
                    {state.variant === 'confirm' ? '削除' : 'OK'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;