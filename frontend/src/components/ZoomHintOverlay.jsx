import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const DISMISS_SHRINK_THRESHOLD = 40;
const CARD_WIDTH = 260;
const VIEWPORT_MARGIN = 12;

export default function ZoomHintOverlay({ open, anchorRect, onDismiss }) {
    const initialDistance = useRef(null);

    useEffect(() => {
        if (!open) return;

        const getDistance = (touches) => {
            const [a, b] = touches;
            return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        };

        const handleTouchStart = (e) => {
            if (e.touches.length === 2) {
                initialDistance.current = getDistance(e.touches);
            }
        };

        const handleTouchMove = (e) => {
            if (e.touches.length === 2 && initialDistance.current != null) {
                const current = getDistance(e.touches);
                if (initialDistance.current - current > DISMISS_SHRINK_THRESHOLD) {
                    onDismiss();
                }
            }
        };

        document.addEventListener('touchstart', handleTouchStart);
        document.addEventListener('touchmove', handleTouchMove);
        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            initialDistance.current = null;
        };
    }, [open, onDismiss]);

    if (!open || !anchorRect) return null;

    // Position right under the input, clamped so it never overflows off-screen
    let left = anchorRect.left;
    const maxLeft = window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN;
    left = Math.min(Math.max(left, VIEWPORT_MARGIN), Math.max(maxLeft, VIEWPORT_MARGIN));
    const top = anchorRect.bottom + 8;

    return (
        <div className="fixed inset-0 z-[200] pointer-events-none">
            <div
                className="pointer-events-auto flex flex-col items-center gap-2.5 bg-white/95 dark:bg-ink-800/95 backdrop-blur-md border border-slate-200 dark:border-ink-600 rounded-2xl shadow-xl px-4 py-3.5 relative"
                style={{ position: 'fixed', top, left, width: CARD_WIDTH }}
            >
                <button
                    onClick={onDismiss}
                    className="absolute top-2 right-2 text-slate-300 dark:text-gold-300/40 hover:text-slate-500 dark:hover:text-gold-200 transition"
                >
                    <X size={14} />
                </button>

                <PinchIcon />

                <p className="text-xs font-semibold text-slate-800 dark:text-gold-100 text-center leading-snug">
                    Pinch your fingers together to zoom back out
                </p>
            </div>
        </div>
    );
}

function PinchIcon() {
    return (
        <div className="relative w-14 h-14">
            <span className="pinch-dot pinch-dot-left" />
            <span className="pinch-dot pinch-dot-right" />
        </div>
    );
}