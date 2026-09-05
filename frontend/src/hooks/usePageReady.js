import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

// If loading is still going after this long, nudge the user to check their
// connection — the page keeps loading in the background either way.
const PAGE_READY_TIMEOUT_MS = 60000;

// Safety cap per video — some mobile browsers restrict preloading without a
// user gesture and never fire 'canplaythrough', so we don't want to hang
// the whole page forever waiting on one video.
const VIDEO_PRELOAD_SAFETY_MS = 8000;

function preloadImage(src) {
    return new Promise((resolve) => {
        if (!src) return resolve();
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // one bad image shouldn't block the page
        img.src = src;
    });
}

function preloadVideo(src) {
    return new Promise((resolve) => {
        if (!src) return resolve();
        let settled = false;
        const done = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.oncanplaythrough = done;
        video.onloadeddata = done; // fallback for browsers that skip canplaythrough
        video.onerror = done;
        video.src = src;
        video.load();

        setTimeout(done, VIDEO_PRELOAD_SAFETY_MS);
    });
}

/**
 * Gates an entire page/screen behind one loading state: waits for a data
 * loader AND any videos/images used on that page to finish loading, then
 * reveals everything at once instead of letting pieces pop in one by one.
 *
 * @param {() => Promise<any>} load - resolves to the page's data
 * @param {string[]} [videos] - video URLs used on this page (e.g. header bg)
 * @param {string[]} [images] - image URLs used on this page
 * @param {any[]} [deps] - re-run when these change
 */
export function usePageReady({ load, videos = [], images = [], deps = [] }) {
    const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
    const [data, setData] = useState(null);
    const attemptId = useRef(0);

    const run = () => {
        const currentAttempt = ++attemptId.current;
        setStatus('loading');

        const slowTimer = setTimeout(() => {
            if (attemptId.current === currentAttempt) {
                toast('Still loading — check your internet connection.', { icon: '⚠️', duration: 6000 });
            }
        }, PAGE_READY_TIMEOUT_MS);

        Promise.all([
            load(),
            Promise.all(videos.filter(Boolean).map(preloadVideo)),
            Promise.all(images.filter(Boolean).map(preloadImage)),
        ])
            .then(([result]) => {
                if (attemptId.current !== currentAttempt) return;
                clearTimeout(slowTimer);
                setData(result);
                setStatus('ready');
            })
            .catch(() => {
                if (attemptId.current !== currentAttempt) return;
                clearTimeout(slowTimer);
                setStatus('error');
            });

        return () => clearTimeout(slowTimer);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => run(), deps);

    return { status, data, retry: run };
}