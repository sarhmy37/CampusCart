const listeners = new Set<() => void>();

export function onLogoBounce(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function triggerLogoBounce() {
  listeners.forEach((fn) => fn());
}