import { useEffect, useState } from 'react';

/**
 * Full-bleed background slideshow. Crossfades through a list of images.
 * Usage: <HeroSlideshow images={['/a.jpg', '/b.jpg']} interval={5000} />
 * Place it as the first child of a `relative` container, then put your
 * gradient overlay + content after it, same as a single <img> would be used.
 */
export default function HeroSlideshow({ images, interval = 5000 }) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (images.length <= 1) return;
        const timer = setInterval(() => {
            setIndex((i) => (i + 1) % images.length);
        }, interval);
        return () => clearInterval(timer);
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