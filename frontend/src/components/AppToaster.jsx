import { useEffect, useState } from 'react';
import { Toaster, resolveValue } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_STYLES = {
    success: {
        icon: CheckCircle2,
        badge: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400',
        glow: 'bg-emerald-400',
        accent: 'before:bg-emerald-500 dark:before:bg-emerald-400',
        bar: 'from-emerald-400 to-emerald-600 dark:from-emerald-300 dark:to-emerald-500',
        shadow: 'shadow-emerald-500/20 dark:shadow-emerald-400/10',
    },
    error: {
        icon: XCircle,
        badge: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400',
        glow: 'bg-red-400',
        accent: 'before:bg-red-500 dark:before:bg-red-400',
        bar: 'from-red-400 to-red-600 dark:from-red-300 dark:to-red-500',
        shadow: 'shadow-red-500/20 dark:shadow-red-400/10',
    },
    loading: {
        icon: Loader2,
        badge: 'bg-brand-100 text-brand-600 dark:bg-gold-500/20 dark:text-gold-400',
        glow: 'bg-brand-400 dark:bg-gold-400',
        accent: 'before:bg-brand-500 dark:before:bg-gold-400',
        bar: 'from-brand-400 to-brand-600 dark:from-gold-300 dark:to-gold-500',
        shadow: 'shadow-brand-500/20 dark:shadow-gold-400/10',
    },
    blank: {
        icon: Info,
        badge: 'bg-brand-100 text-brand-600 dark:bg-gold-500/20 dark:text-gold-400',
        glow: 'bg-brand-400 dark:bg-gold-400',
        accent: 'before:bg-brand-500 dark:before:bg-gold-400',
        bar: 'from-brand-400 to-brand-600 dark:from-gold-300 dark:to-gold-500',
        shadow: 'shadow-brand-500/20 dark:shadow-gold-400/10',
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
            className={`relative overflow-hidden max-w-sm w-full bg-white/95 dark:bg-ink-800/95 backdrop-blur-md border border-slate-200/80 dark:border-ink-600/80 shadow-xl ${style.shadow} rounded-2xl pl-1 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 ${style.accent}`}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible
                    ? `translateY(0) scale(${hovered ? 1.02 : 1})`
                    : 'translateY(-10px) scale(0.94)',
                transition: 'opacity 320ms cubic-bezier(0.34, 1.56, 0.64, 1), transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease',
            }}
        >
            <div className="flex items-start gap-3 px-3.5 py-3">
                <span className="relative shrink-0 w-8 h-8 flex items-center justify-center">
                    <span className={`absolute inset-0 rounded-full blur-md opacity-30 ${style.glow}`} />
                    <span className={`relative w-8 h-8 rounded-full flex items-center justify-center ${style.badge}`}>
                        <Icon size={16} className={t.type === 'loading' ? 'animate-spin' : ''} />
                    </span>
                </span>
                <p className="flex-1 text-sm font-medium text-slate-800 dark:text-gold-100 leading-snug pt-1.5">
                    {resolveValue(t.message, t)}
                </p>
                {t.type !== 'loading' && (
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center text-slate-300 dark:text-gold-300/40 hover:text-slate-600 dark:hover:text-gold-100 hover:bg-slate-100 dark:hover:bg-ink-700 transition"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>
            {t.type !== 'loading' && (
                <div className="h-1 w-full bg-slate-100 dark:bg-ink-700">
                    <div
                        className={`h-full bg-gradient-to-r ${style.bar} rounded-r-full`}
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