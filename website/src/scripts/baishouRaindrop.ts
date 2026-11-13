type RaindropFXInstance = {
  start: () => Promise<void>;
  stop: () => void;
  destroy: () => void;
  resize: (width: number, height: number) => void;
};

type RaindropFXConstructor = new (options: {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  background: HTMLImageElement | HTMLCanvasElement;
  mist?: boolean;
  dropletsPerSeconds?: number;
  spawnLimit?: number;
  raindropDiffuseLight?: number[];
  raindropSpecularLight?: number[];
  backgroundBlurSteps?: number;
}) => RaindropFXInstance;

declare global {
  interface Window {
    RaindropFX?: RaindropFXConstructor;
  }
}

const RAINDROP_SCRIPT = '/vendor/baishou/raindrop-fx.js';
const BACKGROUND_URL = '/assets/images/dark-city-bg.jpg';

export type BaishouRaindropController = {
  start: () => void;
  stop: () => void;
  warmup: () => void;
  destroy: () => void;
};

const hasWebGL2 = () => {
  try {
    const test = document.createElement('canvas');
    return !!(test.getContext('webgl2') || test.getContext('experimental-webgl2'));
  } catch {
    return false;
  }
};

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });

const loadBackground = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load background ${url}`));
    image.src = url;
  });

export const initBaishouRaindrop = (
  canvas: HTMLCanvasElement
): BaishouRaindropController | null => {
  if (!hasWebGL2()) return null;

  let fx: RaindropFXInstance | null = null;
  let running = false;
  let wantRunning = false;
  let initPromise: Promise<void> | null = null;
  let width = 0;
  let height = 0;
  let background: HTMLImageElement | null = null;
  let scriptReady = false;

  const syncCanvasSize = (force = false) => {
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    if (!force && width === nextWidth && height === nextHeight) return false;
    width = nextWidth;
    height = nextHeight;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    return true;
  };

  const ensureAssets = async () => {
    if (!scriptReady) {
      await loadScript(RAINDROP_SCRIPT);
      scriptReady = true;
    }
    if (!window.RaindropFX) throw new Error('RaindropFX is unavailable');
    if (!background) {
      background = await loadBackground(BACKGROUND_URL);
    }
  };

  const ensureFx = () => {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      await ensureAssets();
      if (!window.RaindropFX || !background) return;
      syncCanvasSize(true);
      fx = new window.RaindropFX({
        canvas,
        width,
        height,
        background,
        mist: false,
        dropletsPerSeconds: 280,
        spawnLimit: 900,
        raindropDiffuseLight: [0.45, 0.5, 0.6],
        raindropSpecularLight: [0.15, 0.15, 0.15],
        backgroundBlurSteps: 4,
      });
      await fx.start();
      running = true;
      canvas.classList.add('is-ready');
      if (!wantRunning) {
        fx.stop();
        running = false;
      }
    })().catch((error) => {
      console.warn('[BaishouRaindrop] init failed', error);
      initPromise = null;
    });
    return initPromise;
  };

  const start = () => {
    wantRunning = true;
    if (!fx) {
      void ensureFx();
      return;
    }
    if (syncCanvasSize(false)) {
      try {
        fx.resize(width, height);
      } catch {
        /* ignore resize errors */
      }
    }
    if (!running) {
      running = true;
      void fx.start();
    }
    canvas.classList.add('is-ready');
  };

  const stop = () => {
    wantRunning = false;
    if (!fx || !running) return;
    try {
      fx.stop();
    } catch {
      /* ignore stop errors */
    }
    running = false;
  };

  const onResize = () => {
    if (!fx || !syncCanvasSize(false)) return;
    try {
      fx.resize(width, height);
    } catch {
      /* ignore resize errors */
    }
  };

  window.addEventListener('resize', onResize);

  return {
    start,
    stop,
    warmup: () => void ensureFx(),
    destroy: () => {
      stop();
      try {
        fx?.destroy();
      } catch {
        /* ignore cleanup errors */
      }
      fx = null;
      initPromise = null;
      window.removeEventListener('resize', onResize);
    },
  };
};


