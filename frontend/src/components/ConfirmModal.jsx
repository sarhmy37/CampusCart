import { AlertTriangle } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', onConfirm, onCancel }) {
    // Only lock/unlock if nothing already has the body locked (e.g. a parent
    // drawer or modal that opened this ConfirmModal). Prevents this modal
    // from stealing or releasing a lock it doesn't own.
    const didLockRef = useRef(false);

    useEffect(() => {
        if (open) {
            if (document.body.style.position !== 'fixed') {
                const scrollY = window.scrollY;
                document.body.style.position = 'fixed';
                document.body.style.top = `-${scrollY}px`;
                document.body.style.left = '0';
                document.body.style.right = '0';
                document.body.style.overflow = 'hidden';
                document.body.style.touchAction = 'none';
                document.documentElement.style.overscrollBehavior = 'none';
                didLockRef.current = true;
            }
        } else if (didLockRef.current) {
            const scrollY = document.body.style.top;
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.left = '';
            document.body.style.right = '';
            document.body.style.overflow = '';
            document.body.style.touchAction = '';
            document.documentElement.style.overscrollBehavior = '';
            if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
            didLockRef.current = false;
        }
        return () => {
            if (didLockRef.current) {
                const scrollY = document.body.style.top;
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.left = '';
                document.body.style.right = '';
                document.body.style.overflow = '';
                document.body.style.touchAction = '';
                document.documentElement.style.overscrollBehavior = '';
                if (scrollY) window.scrollTo(0, parseInt(scrollY || '0') * -1);
                didLockRef.current = false;
            }
        };
    }, [open]);

    if (!open) return null;

        return createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-white dark:bg-ink-800 border border-transparent dark:border-ink-600 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in duration-150">
                <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 flex items-center justify-center mb-4">
                    <AlertTriangle size={20} />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-gold-50 text-lg">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-gold-200/60 mt-1.5">{message}</p>

                <div className="flex gap-2 mt-6">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-ink-600 text-slate-600 dark:text-gold-200/70 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-ink-700 transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
                    >
                        {confirmLabel}
                    </button>
                                </div>
            </div>
        </div>,
        document.body
    );
}