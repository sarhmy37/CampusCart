import { useEffect, useState } from 'react';
import { Toaster, resolveValue } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const TYPE_STYLES = {
    success: {
        icon: CheckCircle2,
        iconColor: 'text-emerald-500 dark:text-emerald-400',
        glow: 'bg-emerald-400/40 dark:bg-emerald-400/25',
        bar: 'bg-emerald-500/80 dark:bg-emerald-400/80',
    },
    error: {
        icon: XCircle,
        iconColor: 'text-red-500 dark:text-red-400',
        glow: 'bg-red-400/40 dark:bg-red-400/25',
        bar: 'bg-red-500/80 dark:bg-red-400/80',
    },
    loading: {
        icon: Loader2,
        iconColor: 'text-brand-600 dark:text-gold-300',
        glow: 'bg-brand-400/40 dark:bg-gold-400/25',
        bar: 'bg-brand-500/80 dark:bg-gold-400/80',
    },
    blank: {
        icon: Info,
        iconColor: 'text-brand-600 dark:text-gold-300',
        glow: 'bg-brand-400/40 dark:bg-gold-400/25',
        bar: 'bg-brand-500/80 dark:bg-gold-400/80',
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
                filter: visible ? 'blur(0px)' : 'blur(3px)',
                transition: 'opacity 340ms cubic-bezier(0.22, 1, 0.36, 1), transform 340ms cubic-bezier(0.22, 1, 0.36, 1), filter 340ms ease',
            }}
        >
            {/* Soft colored glow bleeding out from behind the glass */}
            <div className={`absolute -inset-1 rounded-[22px] blur-lg opacity-60 ${style.glow}`} />

            <div
                className="relative overflow-hidden rounded-2xl border border-white/60 dark:border-white/10
                           bg-gradient-to-b from-white/70 to-white/40 dark:from-white/[0.08] dark:to-white/[0.04]
                           backdrop-blur-2xl backdrop-saturate-150
                           shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_10px_28px_-6px_rgba(0,0,0,0.16)]
                           dark:shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_10px_28px_-6px_rgba(0,0,0,0.5)]"
            >
                {/* Specular highlight along the top edge */}
                <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-white/80 dark:via-white/20 to-transparent" />

                <div className="relative flex items-start gap-2.5 px-3.5 py-3">
                    <span className="relative shrink-0 w-7 h-7 flex items-center justify-center">
                        <span className="absolute inset-0 rounded-full border border-white/50 dark:border-white/10 bg-white/40 dark:bg-white/[0.06] backdrop-blur-md" />
                        <Icon size={15} className={`relative ${style.iconColor} ${t.type === 'loading' ? 'animate-spin' : ''}`} />
                    </span>

                    <p className="flex-1 text-[13px] font-medium text-slate-800 dark:text-gold-50 leading-snug pt-1 tracking-[-0.01em]">
                        {resolveValue(t.message, t)}
                    </p>

                    {t.type !== 'loading' && (
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="shrink-0 mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center text-slate-400/70 dark:text-gold-200/40 hover:text-slate-700 dark:hover:text-gold-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {t.type !== 'loading' && (
                    <div className="relative px-3.5 pb-2 -mt-0.5">
                        <div className="h-[2.5px] w-full rounded-full bg-black/[0.06] dark:bg-white/[0.08] overflow-hidden">
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