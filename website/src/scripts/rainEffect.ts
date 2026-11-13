type RainDrop = {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  width: number;
};

export type RainEffectController = {
  start: () => void;
  stop: () => void;
  destroy: () => void;
};

const createDrop = (canvas: HTMLCanvasElement, randomY = false): RainDrop => ({
  x: Math.random() * canvas.width,
  y: randomY ? Math.random() * canvas.height : -(10 + Math.random() * 40),
  length: 12 + Math.random() * 28,
  speed: 5 + Math.random() * 9,
  opacity: 0.08 + Math.random() * 0.34,
  width: 0.6 + Math.random() * 1.1,
});

export const initRainEffect = (canvas: HTMLCanvasElement): RainEffectController | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const drops: RainDrop[] = [];
  let animationId = 0;
  let running = false;

  const initDrops = () => {
    drops.length = 0;
    const density = Math.min(1.35, Math.max(0.55, window.devicePixelRatio || 1));
    const count = Math.floor((canvas.width * canvas.height) / (9000 / density));
    for (let i = 0; i < count; i += 1) {
      drops.push(createDrop(canvas, true));
    }
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { innerWidth, innerHeight } = window;
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initDrops();
  };

  const draw = () => {
    if (!running) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const drop of drops) {
      ctx.globalAlpha = drop.opacity;
      ctx.lineWidth = drop.width;
      ctx.strokeStyle = 'rgba(186, 206, 232, 0.75)';
      ctx.beginPath();
      const drift = drop.length * 0.18;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drift, drop.y + drop.length);
      ctx.stroke();

      drop.y += drop.speed;
      drop.x -= drop.speed * 0.18;

      if (drop.y - drop.length > window.innerHeight) {
        Object.assign(drop, createDrop(canvas));
      }
    }

    ctx.globalAlpha = 1;
    animationId = window.requestAnimationFrame(draw);
  };

  const start = () => {
    if (running) return;
    running = true;
    resize();
    draw();
  };

  const stop = () => {
    running = false;
    window.cancelAnimationFrame(animationId);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const onResize = () => {
    if (!running) return;
    resize();
  };

  window.addEventListener('resize', onResize);

  return {
    start,
    stop,
    destroy: () => {
      stop();
      window.removeEventListener('resize', onResize);
    },
  };
};
