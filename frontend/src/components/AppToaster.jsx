import { Toaster, resolveValue } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, Loader2 } from 'lucide-react';

export default function AppToaster() {
    return (
        <Toaster position="top-center" gutter={10}>
            {(t) => (
                <div
                    className="flex items-center gap-3 max-w-sm w-full bg-white dark:bg-ink-800 border border-slate-200 dark:border-ink-600 shadow-lg rounded-2xl px-4 py-3"
                    style={{
                        opacity: t.visible ? 1 : 0,
                        transition: 'opacity 250ms ease',
                    }}
                >
                    <span className="shrink-0">
                        {t.type === 'success' && (
                            <CheckCircle2 size={18} className="text-emerald-500 dark:text-emerald-400" />
                        )}
                        {t.type === 'error' && (
                            <XCircle size={18} className="text-red-500 dark:text-red-400" />
                        )}
                        {t.type === 'loading' && (
                            <Loader2 size={18} className="text-brand-500 dark:text-gold-400 animate-spin" />
                        )}
                        {t.type === 'blank' && (
                            <Info size={18} className="text-brand-500 dark:text-gold-400" />
                        )}
                    </span>
                    <p className="text-sm font-medium text-slate-800 dark:text-gold-100 leading-snug">
                        {resolveValue(t.message, t)}
                    </p>
                </div>
            )}
        </Toaster>
    );
}