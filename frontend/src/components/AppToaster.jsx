import { useEffect, useState } from 'react';
import { Toaster, resolveValue } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_STYLES = {
    success: {
        icon: CheckCircle2,
        badge: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
        accent: 'before:bg-emerald-500 dark:before:bg-emerald-400',
        bar: 'bg-emerald-500 dark:bg-emerald-400',
    },
    error: {
        icon: XCircle,
        badge: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
        accent: 'before:bg-red-500 dark:before:bg-red-400',
        bar: 'bg-red-500 dark:bg-red-400',
    },
    loading: {
        icon: Loader2,
        badge: 'bg-brand-100 text-brand-600 dark:bg-gold-500/20 dark:text-gold-400',
        accent: 'before:bg-brand-500 dark:before:bg-gold-400',
        bar: 'bg-brand-500 dark:bg-gold-400',
    },
    blank: {
        icon: Info,
        badge: 'bg-brand-100 text-brand-600 dark:bg-gold-500/20 dark:text-gold-400',
        accent: 'before:bg-brand-500 dark:before:bg-gold-400',
        bar: 'bg-brand-500 dark:bg-gold-400',
    },
};

function ToastCard({ t }) {
    const style = TYPE_STYLES[t.type] || TYPE_STYLES.blank;
    const Icon = style.icon;
    const duration = t.duration || 4000;
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (t.type === 'loading' || !t.visible) return;
        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const pct = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(pct);
            if (pct <= 0) clearInterval(interval);
        }, 30);
        return () => clearInterval(interval);
    }, [t.visible, t.type, duration]);

    return (
        <div
            className={`relative overflow-hidden max-w-sm w-full bg-white/95 dark:bg-ink-800/95 backdrop-blur-md border border-slate-200/80 dark:border-ink-600/80 shadow-xl shadow-slate-900/10 dark:shadow-black/30 rounded-2xl pl-1 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${style.accent}`}
            style={{
                opacity: t.visible ? 1 : 0,
                transition: 'opacity 280ms ease',
            }}
        >
            <div className="flex items-start gap-3 px-3.5 py-3">
                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${style.badge}`}>
                    <Icon size={16} className={t.type === 'loading' ? 'animate-spin' : ''} />
                </span>
                <p className="flex-1 text-sm font-medium text-slate-800 dark:text-gold-100 leading-snug pt-1">
                    {resolveValue(t.message, t)}
                </p>
                {t.type !== 'loading' && (
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="shrink-0 mt-0.5 text-slate-300 dark:text-gold-300/40 hover:text-slate-500 dark:hover:text-gold-200 transition"
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
            {t.type !== 'loading' && (
                <div className="h-0.5 w-full bg-slate-100 dark:bg-ink-700">
                    <div
                        className={`h-full ${style.bar}`}
                        style={{ width: `${progress}%`, transition: progress === 100 ? 'none' : 'width 30ms linear' }}
                    />
                </div>
            )}
        </div>
    );
}

export default function AppToaster() {
    return (
        <Toaster position="top-center" gutter={10}>
            {(t) => <ToastCard t={t} />}
        </Toaster>
    );
}