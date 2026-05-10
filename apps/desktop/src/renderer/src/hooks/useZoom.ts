import { useEffect } from 'react';

const STORAGE_KEY = 'baishou-zoom-factor';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const STEP = 0.1;

function getSavedZoom(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const val = parseFloat(saved);
      if (!isNaN(val) && val >= MIN_ZOOM && val <= MAX_ZOOM) return val;
    }
  } catch {}
  return 1;
}

function applyZoom(factor: number) {
  const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(factor * 100) / 100));
  (window as any).api.zoom.setFactor(clamped);
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
  } catch {}
}

export function useZoom() {
  useEffect(() => {
    applyZoom(getSavedZoom());

    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;

      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        applyZoom(getSavedZoom() + STEP);
      } else if (e.key === '-') {
        e.preventDefault();
        applyZoom(getSavedZoom() - STEP);
      } else if (e.key === '0') {
        e.preventDefault();
        applyZoom(1);
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -STEP : STEP;
      applyZoom(getSavedZoom() + delta);
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wheel', onWheel);
    };
  }, []);
}
