import { useState, useEffect, useRef } from 'react';

export default function usePullToRefresh({ onRefresh, threshold = 120 } = {}) {
    const [isPulling, setIsPulling] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const currentY = useRef(0);
    const isPullingRef = useRef(false);

    useEffect(() => {
        let isDragging = false;
        let startYPos = 0;

        const handleTouchStart = (e) => {
            // Only enable pull-to-refresh at the top of the page
            if (window.scrollY > 0) return;
            
            startYPos = e.touches[0].clientY;
            isDragging = true;
            startY.current = startYPos;
            currentY.current = startYPos;
        };

        const handleTouchMove = (e) => {
            if (!isDragging) return;
            
            const currentYPos = e.touches[0].clientY;
            const diff = currentYPos - startY.current;
            
            // Only allow downward pull
            if (diff < 0) {
                setIsPulling(false);
                setPullProgress(0);
                return;
            }

            // Check if user is at the top
            if (window.scrollY > 0) {
                setIsPulling(false);
                setPullProgress(0);
                return;
            }

            // Prevent page scroll while pulling
            if (diff > 20) {
                e.preventDefault();
            }

            const progress = Math.min(diff / threshold, 1);
            setPullProgress(progress);
            
            if (diff > 20) {
                setIsPulling(true);
                isPullingRef.current = true;
            }
            
            currentY.current = currentYPos;
        };

        const handleTouchEnd = (e) => {
            if (!isDragging) return;
            
            const diff = currentY.current - startY.current;
            
            if (diff > threshold && isPullingRef.current) {
                // Trigger refresh
                setIsRefreshing(true);
                setIsPulling(false);
                setPullProgress(0);
                
                if (onRefresh) {
                    onRefresh().finally(() => {
                        setIsRefreshing(false);
                        isPullingRef.current = false;
                    });
                } else {
                    // Default: reload the page
                    window.location.reload();
                }
            } else {
                setIsPulling(false);
                setPullProgress(0);
                isPullingRef.current = false;
            }
            
            isDragging = false;
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [onRefresh, threshold]);

    return {
        isPulling,
        pullProgress,
        isRefreshing,
        pullDistance: pullProgress * threshold,
    };
}