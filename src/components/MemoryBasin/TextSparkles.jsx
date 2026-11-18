import { useEffect, useRef } from "react";

// Little blue sparkles that burst out of each line of a memory as it
// appears, then keep drifting up off the words while you read.
// Lines opt in with data-sparkle-delay="<seconds until the line appears>".
export default function TextSparkles({ containerRef, active }) {
  const canvasRef = useRef(null);
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sources = [...containerRef.current.querySelectorAll("[data-sparkle-delay]")].map((el) => ({
      el,
      delay: parseFloat(el.dataset.sparkleDelay) || 0,
      burst: false,
      carry: 0,
    }));
    const particles = [];

    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    function spawn(rect, origin, burst) {
      particles.push({
        x: rect.left - origin.left + Math.random() * rect.width,
        y: rect.top - origin.top + rect.height * (0.15 + Math.random() * 0.7),
        vx: (Math.random() - 0.5) * (burst ? 60 : 16),
        vy: -(burst ? 30 + Math.random() * 70 : 12 + Math.random() * 28),
        life: 0,
        max: (burst ? 1 : 1.6) + Math.random() * 1.4,
        size: 0.8 + Math.random() * 1.8,
        star: Math.random() < 0.35,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let raf = 0;
    const start = performance.now();
    let last = start;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const t = (now - start) / 1000;
      const origin = canvas.getBoundingClientRect();

      if (activeRef.current) {
        for (const s of sources) {
          if (t < s.delay + 0.2) continue;
          const rect = s.el.getBoundingClientRect();
          const area = rect.width * rect.height;
          if (!s.burst) {
            s.burst = true;
            const count = Math.min(60, 12 + area / 900);
            for (let i = 0; i < count; i++) spawn(rect, origin, true);
          }
          s.carry += dt * Math.min(6, 1 + area / 15000);
          while (s.carry >= 1) {
            s.carry -= 1;
            spawn(rect, origin, false);
          }
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) {
          particles.splice(i, 1);
          continue;
        }
        p.vx *= 1 - dt * 0.8;
        p.x += p.vx * dt + Math.sin(p.life * 3 + p.phase) * 0.15;
        p.y += p.vy * dt;

        const k = p.life / p.max;
        const twinkle = 0.6 + 0.4 * Math.sin(p.life * 12 + p.phase);
        const a = Math.min(k * 6, 1) * (1 - k) * twinkle;

        ctx.fillStyle = `rgba(50, 200, 240, ${a * 0.25})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(215, 248, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        if (p.star) {
          const len = p.size * 5;
          ctx.strokeStyle = `rgba(150, 230, 255, ${a * 0.8})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(p.x - len, p.y);
          ctx.lineTo(p.x + len, p.y);
          ctx.moveTo(p.x, p.y - len);
          ctx.lineTo(p.x, p.y + len);
          ctx.stroke();
        }
      }
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  return <canvas ref={canvasRef} className="mb-sparkles" aria-hidden="true" />;
}
