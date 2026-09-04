import { useEffect, useState } from 'react';
import { Toaster, resolveValue } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_STYLES = {
    success: {
        icon: CheckCircle2,
        badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
        bar: 'bg-emerald-500 dark:bg-emerald-400',
    },
    error: {
        icon: XCircle,
        badge: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
        bar: 'bg-red-500 dark:bg-red-400',
    },
    loading: {
        icon: Loader2,
        badge: 'bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400',
        bar: 'bg-brand-500 dark:bg-brand-400',
    },
    blank: {
        icon: Info,
        badge: 'bg-brand-50 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400',
        bar: 'bg-brand-500 dark:bg-brand-400',
    },
};

function ToastCard({ t }) {
    const style = TYPE_STYLES[t.type] || TYPE_STYLES.blank;
    const Icon = style.icon;
    const duration = t.duration || 4000;
    const [progress, setProgress] = useState(100);
    const [hovered, setHovered] = useState(false);
    const [entered, setEntered] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setEntered(true));
        return () => cancelAnimationFrame(id);
    }, []);

    useEffect(() => {
        if (t.type === 'loading' || !t.visible || hovered) return;
        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = Date.now() - start;
            const pct = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(pct);
            if (pct <= 0) clearInterval(interval);
        }, 30);
        return () => clearInterval(interval);
    }, [t.visible, t.type, duration, hovered]);

    const visible = t.visible && entered;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="relative max-w-[22rem] w-full"
            style={{
                opacity: visible ? 1 : 0,
                transform: visible
                    ? `translateY(0) scale(${hovered ? 1.015 : 1})`
                    : 'translateY(-12px) scale(0.93)',
                transition: 'opacity 280ms cubic-bezier(0.22, 1, 0.36, 1), transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
        >
            <div
                className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-ink-600
                           bg-white dark:bg-ink-800
                           shadow-xl shadow-slate-900/10 dark:shadow-black/30"
            >
                <div className="flex items-start gap-3 px-3.5 py-3">
                    <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${style.badge}`}>
                        <Icon size={16} className={t.type === 'loading' ? 'animate-spin' : ''} />
                    </span>

                    <p className="flex-1 text-sm font-medium text-slate-800 dark:text-brand-100 leading-snug pt-1">
                        {resolveValue(t.message, t)}
                    </p>

                    {t.type !== 'loading' && (
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="shrink-0 mt-0.5 text-slate-300 dark:text-brand-300/40 hover:text-slate-500 dark:hover:text-brand-200 transition"
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