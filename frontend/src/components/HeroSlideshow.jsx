import { useEffect, useState } from 'react';

// Fixed reference point — every slideshow on the page computes its position
// from elapsed real time relative to this, instead of its own local state.
// That means switching screens and coming back doesn't reset it: whatever
// frame it "should" be on by the clock is what renders immediately on mount.
const EPOCH = 0;

function computeIndex(length, interval) {
    if (length <= 0) return 0;
    return Math.floor((Date.now() - EPOCH) / interval) % length;
}

/**
 * Full-bleed background slideshow. Crossfades through a list of images.
 * Usage: <HeroSlideshow images={['/a.jpg', '/b.jpg']} interval={5000} />
 * Place it as the first child of a `relative` container, then put your
 * gradient overlay + content after it, same as a single <img> would be used.
 */
export default function HeroSlideshow({ images, interval = 5000 }) {
    const [index, setIndex] = useState(() => computeIndex(images.length, interval));

    useEffect(() => {
        if (images.length <= 1) return;

        // Re-sync immediately in case `images.length` or `interval` changed,
        // then align the recurring tick to the real time boundary rather
        // than starting a fresh `interval`-length wait from mount time.
        setIndex(computeIndex(images.length, interval));

        const msIntoCurrentSlide = (Date.now() - EPOCH) % interval;
        const msUntilNextSlide = interval - msIntoCurrentSlide;

        const alignTimeout = setTimeout(() => {
            setIndex(computeIndex(images.length, interval));
            const timer = setInterval(() => {
                setIndex(computeIndex(images.length, interval));
            }, interval);
            // Stash so the outer cleanup below can clear it too
            alignTimeout.__innerTimer = timer;
        }, msUntilNextSlide);

        return () => {
            clearTimeout(alignTimeout);
            if (alignTimeout.__innerTimer) clearInterval(alignTimeout.__innerTimer);
        };
    }, [images.length, interval]);

    return (
        <div className="absolute inset-0">
            {images.map((src, i) => (
                <img
                    key={src}
                    src={src}
                    alt=""
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                        i === index ? 'opacity-100' : 'opacity-0'
                    }`}
                />
            ))}
        </div>
    );
}