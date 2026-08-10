import { useEffect, useRef, useState } from 'react';

/**
 * Reveals an element with a fade/slide transition the first time
 * it scrolls into view. Respects prefers-reduced-motion.
 */
export default function useReveal(options = {}) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) {
            setVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.unobserve(node);
                }
            },
            { threshold: 0.15, rootMargin: '0px 0px -60px 0px', ...options }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return [ref, visible];
}