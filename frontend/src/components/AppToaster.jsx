import { useEffect, useState } from 'react';
import { Toaster, resolveValue } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_STYLES = {
    success: {
        icon: CheckCircle2,
        iconColor: 'text-emerald-500 dark:text-emerald-400',
        tint: 'bg-emerald-400/10 dark:bg-emerald-400/10',
        glow: 'bg-emerald-400/50',
        bar: 'bg-emerald-500/70 dark:bg-emerald-400/70',
    },
    error: {
        icon: XCircle,
        iconColor: 'text-red-500 dark:text-red-400',
        tint: 'bg-red-400/10 dark:bg-red-400/10',
        glow: 'bg-red-400/50',
        bar: 'bg-red-500/70 dark:bg-red-400/70',
    },
    loading: {
        icon: Loader2,
        iconColor: 'text-brand-600 dark:text-gold-300',
        tint: 'bg-brand-400/10 dark:bg-gold-400/10',
        glow: 'bg-brand-400/50 dark:bg-gold-400/50',
        bar: 'bg-brand-500/70 dark:bg-gold-400/70',
    },
    blank: {
        icon: Info,
        iconColor: 'text-brand-600 dark:text-gold-300',
        tint: 'bg-brand-400/10 dark:bg-gold-400/10',
        glow: 'bg-brand-400/50 dark:bg-gold-400/50',
        bar: 'bg-brand-500/70 dark:bg-gold-400/70',
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
            className="relative max-w-sm w-full"
            style={{
                opacity: visible ? 1 : 0,
                transform: visible
                    ? `translateY(0) scale(${hovered ? 1.015 : 1})`
                    : 'translateY(-14px) scale(0.92)',
                filter: visible ? 'blur(0px)' : 'blur(4px)',
                transition: 'opacity 380ms cubic-bezier(0.22, 1, 0.36, 1), transform 380ms cubic-bezier(0.22, 1, 0.36, 1), filter 380ms ease',
            }}
        >
            {/* Soft colored glow bleeding out from behind the glass */}
            <div className={`absolute -inset-1.5 rounded-[30px] blur-xl opacity-40 ${style.glow}`} />

            <div
                className={`relative overflow-hidden rounded-[26px] border border-white/60 dark:border-white/[0.08] ${style.tint}`}
                style={{
                    backdropFilter: 'blur(28px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
                    background:
                        'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.25) 100%)',
                    boxShadow:
                        '0 1px 1px rgba(255,255,255,0.6) inset, 0 -1px 1px rgba(0,0,0,0.04) inset, 0 12px 32px -8px rgba(0,0,0,0.18)',
                }}
            >
                {/* Specular highlight along the top edge, like glass catching light */}
                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/90 dark:via-white/30 to-transparent" />

                {/* Dark-mode tint layer (the light-mode gradient above washes out too much on dark bg) */}
                <div className="absolute inset-0 hidden dark:block bg-ink-900/40" />

                <div className="relative flex items-start gap-3 px-4 py-3.5">
                    <span className="relative shrink-0 w-8 h-8 flex items-center justify-center">
                        <span
                            className="absolute inset-0 rounded-full border border-white/50 dark:border-white/10"
                            style={{
                                backdropFilter: 'blur(6px)',
                                WebkitBackdropFilter: 'blur(6px)',
                                background: 'linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0.2))',
                            }}
                        />
                        <Icon size={17} className={`relative ${style.iconColor} ${t.type === 'loading' ? 'animate-spin' : ''}`} />
                    </span>

                    <p className="flex-1 text-[13.5px] font-medium text-slate-800 dark:text-gold-50 leading-snug pt-1.5 tracking-[-0.01em]">
                        {resolveValue(t.message, t)}
                    </p>

                    {t.type !== 'loading' && (
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="shrink-0 mt-1 w-5 h-5 rounded-full flex items-center justify-center text-slate-400/70 dark:text-gold-200/40 hover:text-slate-700 dark:hover:text-gold-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
                        >
                            <X size={12.5} />
                        </button>
                    )}
                </div>

                {t.type !== 'loading' && (
                    <div className="relative px-4 pb-2.5 -mt-1">
                        <div className="h-[3px] w-full rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
                            <div
                                className={`h-full rounded-full ${style.bar}`}
                                style={{ width: `${progress}%`, transition: progress === 100 ? 'none' : 'width 30ms linear' }}
                            />
                        </div>
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