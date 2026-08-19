import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import usePullToRefresh from '../hooks/usePullToRefresh';

export default function PullToRefresh({ children, onRefresh }) {
    const containerRef = useRef(null);
    const { isPulling, pullProgress, isRefreshing, pullDistance } = usePullToRefresh({
        onRefresh,
        threshold: 120,
    });

    // Calculate the transform offset
    const offset = isRefreshing ? 100 : pullDistance;

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden"
            style={{
                transform: `translateY(${offset}px)`,
                transition: isRefreshing ? 'transform 0.3s ease-out' : 'none',
            }}
        >
            {/* Pull indicator - logo that appears in the gap */}
            <div
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none"
                style={{
                    top: `-${Math.max(80 - pullDistance, 20)}px`,
                    opacity: Math.min(pullProgress * 1.5, 1),
                    transform: `scale(${0.5 + pullProgress * 0.5})`,
                    transition: isRefreshing ? 'all 0.3s ease-out' : 'none',
                }}
            >
                <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-600 to-accent-500 dark:from-gold-600 dark:to-gold-400 flex items-center justify-center text-white dark:text-ink-900 font-extrabold text-xl shadow-lg">
                        C
                    </div>
                    {isRefreshing ? (
                        <Loader2 size={16} className="text-brand-600 dark:text-gold-400 animate-spin" />
                    ) : (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-gold-200/50">
                            {pullProgress > 0.7 ? 'Release to refresh' : 'Pull to refresh'}
                        </span>
                    )}
                </div>
            </div>

            {/* Content */}
            {children}
        </div>
    );
}