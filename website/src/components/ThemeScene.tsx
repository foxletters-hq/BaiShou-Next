import { useEffect, useRef, type FC } from 'react';
import { useApp } from '../context/AppContext';
import {
  initBaishouRaindrop,
  type BaishouRaindropController,
} from '../scripts/baishouRaindrop';
import {
  initRainEffect,
  type RainEffectController,
} from '../scripts/rainEffect';

export const ThemeScene: FC = () => {
  const { theme } = useApp();
  const sceneRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raindropRef = useRef<BaishouRaindropController | null>(null);
  const fallbackRef = useRef<RainEffectController | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const rainCanvas = canvasRef.current;
    if (!scene || !rainCanvas) return;

    const clearStopTimer = () => {
      if (stopTimerRef.current !== null) {
        window.clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
    };

    const stopRainNow = () => {
      clearStopTimer();
      raindropRef.current?.stop();
      fallbackRef.current?.stop();
    };

    const ensureControllers = () => {
      if (!raindropRef.current) {
        raindropRef.current = initBaishouRaindrop(rainCanvas);
      }
      if (!raindropRef.current && !fallbackRef.current) {
        fallbackRef.current = initRainEffect(rainCanvas);
        rainCanvas.classList.add('is-ready');
      }
    };

    const syncScene = () => {
      const reducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      if (reducedMotion) {
        stopRainNow();
        scene.setAttribute('aria-hidden', 'true');
        return;
      }

      ensureControllers();
      const isDark =
        (document.documentElement.dataset.theme || theme) === 'dark';

      if (!isDark) {
        scene.setAttribute('aria-hidden', 'true');
        raindropRef.current?.warmup();
        clearStopTimer();
        stopTimerRef.current = window.setTimeout(() => {
          if (document.documentElement.dataset.theme !== 'dark') {
            stopRainNow();
          }
        }, 560);
        return;
      }

      clearStopTimer();
      scene.setAttribute('aria-hidden', 'false');

      if (raindropRef.current) {
        fallbackRef.current?.stop();
        raindropRef.current.start();
        return;
      }

      fallbackRef.current?.start();
    };

    syncScene();
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    motionQuery.addEventListener('change', syncScene);

    return () => {
      motionQuery.removeEventListener('change', syncScene);
      clearStopTimer();
    };
  }, [theme]);

  useEffect(() => {
    return () => {
      raindropRef.current?.destroy();
      fallbackRef.current?.destroy();
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      className="theme-scene"
      data-theme-scene
      aria-hidden="true"
    >
      <div
        className="theme-wallpaper theme-wallpaper--light"
        style={{ backgroundImage: "url('/assets/images/bg/day-snowlake.jpg')" }}
      />
      <div className="theme-dark-layer">
        <div
          className="theme-wallpaper theme-wallpaper--dark-fallback"
          style={{ backgroundImage: "url('/assets/images/dark-city-bg.jpg')" }}
        />
        <canvas
          ref={canvasRef}
          className="theme-canvas theme-canvas--rain"
          data-rain-canvas
        />
      </div>
    </div>
  );
};

export default ThemeScene;
