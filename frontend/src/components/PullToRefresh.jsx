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
        const onTouchStart = (e) => {
            if (window.scrollY === 0 && !refreshing) {
                startY.current = e.touches[0].clientY;
                dragging.current = true;
                setIsDragging(true);
            }
        };

        const onTouchMove = (e) => {
            if (!dragging.current || startY.current === null || refreshing) return;
            const diff = e.touches[0].clientY - startY.current;

            if (diff > 0 && window.scrollY === 0) {
                e.preventDefault(); // stop native bounce from doubling up with our gap
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
        window.addEventListener('touchmove', onTouchMove, { passive: false }); // must be non-passive to preventDefault
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
                className="overflow-hidden flex items-center justify-center bg-white dark:bg-ink-900"
                style={{
                    height: `${pullDistance}px`,
                    transition: isDragging ? 'none' : 'height 0.3s ease-out',
                }}
            >
                <img
                    src={theme === 'dark' ? LOGO_LIGHT : LOGO_DARK}
                    alt=""
                    className={`w-8 h-8 object-contain ${refreshing ? 'animate-pulse' : ''}`}
                    style={{
                        opacity: progress,
                        transform: `scale(${0.6 + progress * 0.4})`,
                    }}
                />
            </div>
            {children}
        </>
    );
}