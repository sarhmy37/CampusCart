import { useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import Toast from 'react-native-toast-message';

const PAGE_READY_TIMEOUT_MS = 15000;

// RN's Image.prefetch returns a promise that resolves when the image is
// cached (or rejects on error). We swallow errors so one bad URL doesn't
// hang the whole screen.
async function preloadImage(src?: string) {
  if (!src) return;
  try {
    await Image.prefetch(src);
  } catch {}
}

// RN has no programmatic "wait for video to be ready" outside a rendered
// component, so for videos we just preload the metadata and cap the wait.
// In practice, the actual <VideoView> handles playback readiness.
function preloadVideo(src?: string) {
  if (!src) return Promise.resolve();
  // No-op placeholder — if you want, you can fetch the first byte range
  // here to warm the cache. For now, resolve immediately.
  return Promise.resolve();
}

type UsePageReadyParams<T> = {
  load: () => Promise<T>;
  videos?: string[];
  images?: string[];
  deps?: any[];
};

export function usePageReady<T = any>({
  load,
  videos = [],
  images = [],
  deps = [],
}: UsePageReadyParams<T>) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<T | null>(null);
  const attemptId = useRef(0);

  const run = () => {
    const currentAttempt = ++attemptId.current;
    setStatus('loading');

    const slowTimer = setTimeout(() => {
      if (attemptId.current === currentAttempt) {
        Toast.show({
          type: 'info',
          text1: 'Still loading — check your internet connection.',
          visibilityTime: 6000,
        });
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

  useEffect(() => {
    const cleanup = run();
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { status, data, retry: run };
}