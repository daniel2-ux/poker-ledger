import { useEffect, useRef } from 'react';

// Full-screen background: a field of fine glints drifting slowly, twinkling, with a few
// that flare into four-point stars as they "catch the light". Original canvas implementation.

const TINTS = [
  [255, 255, 255],
  [255, 255, 255],
  [214, 220, 255],
  [190, 198, 255],
  [255, 244, 220]
];

const rand = (a, b) => a + Math.random() * (b - a);

function makeGlint(w, h) {
  const depth = Math.random(); // 0 = far, 1 = near
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: 0.5 + depth * 1.3,
    soft: Math.random() < 0.12, // a few large, blurry, dim ones for depth
    base: 0.25 + depth * 0.5,
    speed: 3 + depth * 9, // px per second
    phase: Math.random() * Math.PI * 2,
    rate: rand(0.4, 1.6),
    tint: TINTS[(Math.random() * TINTS.length) | 0]
  };
}

export default function Starfield({ density = 1, drift = -0.35, flares = 3 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let glints = [];
    let stars = [];
    let raf = 0;
    let last = 0;
    let nextFlare = 0;
    const dirX = Math.cos(drift);
    const dirY = Math.sin(drift);

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(520, (w * h) / 2200) * density);
      glints = Array.from({ length: count }, () => makeGlint(w, h));
      if (reduced) draw(0, 0);
    };

    const drawFlare = (x, y, size, alpha) => {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 0.5);
      glow.addColorStop(0, `rgba(255,255,255,${alpha})`);
      glow.addColorStop(0.25, `rgba(220,226,255,${alpha * 0.35})`);
      glow.addColorStop(1, 'rgba(220,226,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // four tapered spikes
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + 0.12;
        const len = size * (k % 2 === 0 ? 1 : 0.7);
        const ex = x + Math.cos(a) * len;
        const ey = y + Math.sin(a) * len;
        const g = ctx.createLinearGradient(x, y, ex, ey);
        g.addColorStop(0, `rgba(255,255,255,${alpha})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    };

    function draw(t, dt) {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < glints.length; i++) {
        const g = glints[i];
        g.x += dirX * g.speed * dt;
        g.y += dirY * g.speed * dt;
        if (g.x < -4) g.x = w + 4;
        else if (g.x > w + 4) g.x = -4;
        if (g.y < -4) g.y = h + 4;
        else if (g.y > h + 4) g.y = -4;
        // mostly steady, with a sharp brief glint when the sine peaks
        const s = Math.sin(t * g.rate + g.phase);
        const flash = Math.pow(Math.max(0, s), 12);
        const a = Math.min(1, g.base * (0.55 + 0.25 * s) + flash * 0.9);
        const [r, gr, b] = g.tint;
        if (g.soft) {
          ctx.fillStyle = `rgba(${r},${gr},${b},${a * 0.22})`;
          ctx.beginPath();
          ctx.arc(g.x, g.y, g.r * 3.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${r},${gr},${b},${a})`;
          const d = g.r * (1 + flash * 0.8);
          ctx.fillRect(g.x - d / 2, g.y - d / 2, d, d);
        }
      }
      // flares: pick a glint now and then and let it bloom for a second or two
      if (!reduced && t > nextFlare && stars.length < flares && glints.length) {
        stars.push({ g: glints[(Math.random() * glints.length) | 0], born: t, life: rand(1.6, 3.2), size: rand(16, 34) });
        nextFlare = t + rand(0.5, 1.8);
      }
      stars = stars.filter(st => {
        const p = (t - st.born) / st.life;
        if (p >= 1) return false;
        const env = Math.sin(p * Math.PI);
        drawFlare(st.g.x, st.g.y, st.size * (0.5 + env * 0.5), env * 0.95);
        return true;
      });
    }

    const loop = now => {
      const t = now / 1000;
      const dt = Math.min(0.05, last ? t - last : 0);
      last = t;
      draw(t, dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduced || raf) return;
      last = 0;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [density, drift, flares]);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
