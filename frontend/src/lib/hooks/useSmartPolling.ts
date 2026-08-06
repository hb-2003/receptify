import { useEffect, useRef, useCallback } from 'react';

// Visibility-aware polling hook that adjusts interval based on business status.
// Pauses polling when tab is hidden to conserve resources and prevent catch-up spikes.
export function useSmartPolling(
  callback: () => Promise<void>,
  intervalMs: number,
  enabled: boolean = true
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const tick = useCallback(async () => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (!enabled) return;

    try {
      await callbackRef.current();
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;

    const start = () => {
      if (intervalRef.current) return;
      intervalRef.current = setInterval(tick, intervalMs);
    };

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, tick]);
}
