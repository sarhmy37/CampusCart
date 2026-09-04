import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { LOGO_LIGHT, LOGO_DARK } from '../data/media';

const PULL_THRESHOLD = 70;
const MAX_PULL = 110;
const REFRESH_HOLD_MS = 700;

export default function PullToRefresh({ children }) {
    const { theme } = useTheme();
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(null);
    const dragging = useRef(false);

    useEffect(() => {
    // Any modal/drawer that locks body scroll (ProfileDrawer, ConfirmModal,
    // VerifyModal, etc.) sets document.body.style.position = 'fixed'.
    // While that's true, window.scrollY is pinned at 0 even though the user
    // isn't actually at the top of the page — so we must not treat that as
    // "safe to pull-to-refresh".
    const isScrollLocked = () => document.body.style.position === 'fixed';

    const onTouchStart = (e) => {
        if (isScrollLocked()) return;
        if (e.target.closest('[data-ptr-ignore]')) return;
        if (window.scrollY === 0 && !refreshing) {
            startY.current = e.touches[0].clientY;
            dragging.current = true;
            setIsDragging(true);
        }
    };

    const onTouchMove = (e) => {
        if (!dragging.current || startY.current === null || refreshing) return;
        if (isScrollLocked()) {
            // A modal opened mid-drag — bail out cleanly instead of pulling.
            dragging.current = false;
            setIsDragging(false);
            setPullDistance(0);
            startY.current = null;
            return;
        }
        const diff = e.touches[0].clientY - startY.current;

        if (diff > 0 && window.scrollY === 0) {
            e.preventDefault();
            setPullDistance(Math.min(diff * 0.5, MAX_PULL));
        }
    };

    const onTouchEnd = () => {
        if (!dragging.current) return;
        dragging.current = false;
        setIsDragging(false);

        if (pullDistance >= PULL_THRESHOLD) {
            setRefreshing(true);
            setPullDistance(PULL_THRESHOLD);
            setTimeout(() => window.location.reload(), REFRESH_HOLD_MS);
        } else {
            setPullDistance(0);
        }
        startY.current = null;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
        window.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
    };
}, [pullDistance, refreshing]);

    const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

    return (
        <>
            <div
                className="relative overflow-hidden flex flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white dark:from-ink-800 dark:via-ink-900 dark:to-ink-900"
                style={{
                    height: `${pullDistance}px`,
                    transition: isDragging ? 'none' : 'height 0.3s ease-out',
                }}
            >
                {/* Diagonal shimmer sweep, only while actively refreshing */}
                {refreshing && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/60 dark:via-brand-300/10 to-transparent animate-shimmerSweep" />
                    </div>
                )}

                <div className="relative flex items-center justify-center w-12 h-12">
                    {/* Expanding glow rings */}
                    {refreshing && (
                        <>
                            <span className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-brand-400/40 dark:bg-brand-500/30 animate-glowPulse" />
                            <span
                                className="absolute inset-0 m-auto w-10 h-10 rounded-full bg-brand-400/30 dark:bg-brand-500/20 animate-glowPulse"
                                style={{ animationDelay: '0.3s' }}
                            />
                        </>
                    )}

                    <img
                        src={theme === 'dark' ? LOGO_LIGHT : LOGO_DARK}
                        alt="TreX"
                        className={`relative h-7 sm:h-9 w-auto object-contain drop-shadow-sm ${refreshing ? 'animate-heartbeat' : ''}`}
                        style={
                            refreshing
                                ? undefined
                                : {
                                      opacity: progress,
                                      transform: `scale(${0.6 + progress * 0.4})`,
                                  }
                        }
                    />
                </div>

                {/* Wordmark, styled like the navbar, fades/scales in as you pull */}
                <div
                    className="flex items-center font-serif font-black italic tracking-tight whitespace-nowrap mt-1.5"
                    style={{
                        opacity: refreshing ? 1 : progress * 0.85,
                        transform: `translateY(${refreshing ? 0 : (1 - progress) * 4}px)`,
                    }}
                >
                    <span className="text-xs text-slate-900 dark:text-white">Tre</span>
                    <span className="text-xs text-slate-900 dark:text-white mx-0.5">-</span>
                    <span className="text-sm text-brand-600 dark:text-brand-400 leading-none">X</span>
                </div>

                {/* Subtle status label, only while refreshing */}
                {refreshing && (
                    <span className="mt-1 text-[10px] font-medium tracking-wide text-slate-400 dark:text-brand-300/50 uppercase">
                        Refreshing
                    </span>
                )}
            </div>
            {children}
        </>
    );
}