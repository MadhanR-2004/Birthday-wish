import { useEffect, useRef, useState } from "react";
import "./OwlCarrier.css";

// The owl's 3D code (three.js) is large, so it loads after the page appears.
const loadOwl = () => import("./owlScene.js");

const ARRIVE_TIME = 2.8; // seconds to fly in
const LEAVE_TIME = 1.7; // seconds to fly off after letting go
const SETTLE_TIME = 0.9; // seconds for the envelope to settle once released
const WAIT_LIMIT = 4000; // ms to wait for the owl before showing the envelope alone

const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// A snowy owl flies in carrying the envelope (children) in its talons. While
// `holding` is true it hovers, the envelope swinging beneath it; when it turns
// false the owl lets go and flies off, and the envelope settles into place.
// `after` is shown under the envelope (the hint) and moves with it.
export default function OwlCarrier({ holding, onUnavailable, after, children }) {
  const carrierRef = useRef(null);
  const swingRef = useRef(null);
  const hostRef = useRef(null);
  const holdingRef = useRef(holding);
  const [mode, setMode] = useState(holding ? "waiting" : "done");

  useEffect(() => {
    holdingRef.current = holding;
  }, [holding]);

  useEffect(() => {
    if (mode !== "waiting") return undefined;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const carrier = carrierRef.current;
    const swing = swingRef.current;
    const host = hostRef.current;
    let owl = null;
    let raf = 0;
    let cancelled = false;

    function giveUp() {
      if (cancelled) return;
      cancelled = true;
      setMode("done");
      onUnavailable?.();
    }
    const timeout = setTimeout(giveUp, WAIT_LIMIT);

    // Where the carried envelope sits: scaled down and moved so the owl and
    // envelope together are centred on screen.
    const layout = { scale: 1, y: 0 };
    function measure() {
      const saved = carrier.style.transform;
      carrier.style.transform = "none";
      const rect = carrier.getBoundingClientRect();
      carrier.style.transform = saved;
      const owlHeight = host.offsetHeight;
      const total = owlHeight + rect.height;
      layout.scale = Math.max(0.45, Math.min(0.8, (window.innerHeight - 40) / total));
      const top = (window.innerHeight - layout.scale * total) / 2 + layout.scale * owlHeight;
      layout.y = top - rect.top;
    }

    // Swing of the envelope beneath the talons: a damped pendulum pushed by
    // the owl's sideways acceleration.
    const pendulum = { angle: 0, speed: 0 };
    const motion = { x: 0, lastX: 0, lastV: 0 };
    function swingStep(dt, damping = 1.1) {
      const v = (motion.x - motion.lastX) / dt;
      const accel = (v - motion.lastV) / dt;
      motion.lastX = motion.x;
      motion.lastV = v;
      const push = -accel / 320;
      pendulum.speed += (-10 * Math.sin(pendulum.angle) - damping * pendulum.speed + push) * dt;
      pendulum.angle = Math.max(-0.45, Math.min(0.45, pendulum.angle + pendulum.speed * dt));
      return pendulum.angle;
    }

    loadOwl()
      .then(({ createOwl }) => {
        if (cancelled) return;
        try {
          owl = createOwl(host, { reduceMotion });
        } catch {
          giveUp();
          return;
        }
        clearTimeout(timeout);
        measure();
        window.addEventListener("resize", measure);
        setMode("carried");
        run();
      })
      .catch(giveUp);

    function run() {
      let stage = reduceMotion ? "hover" : "arrive";
      let stageTime = 0;
      let leaveFrom = null;
      let last = performance.now();
      let time = 0;
      let carrierY = layout.y;
      let carrierScale = layout.scale;
      // Start out of view (top right) before the first frame is painted.
      if (!reduceMotion) {
        carrier.style.transform = `translate(${window.innerWidth * 0.6}px, ${layout.y - window.innerHeight * 0.75}px) scale(${layout.scale * 0.45})`;
      }

      function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min((now - last) / 1000, 0.05) || 0.016;
        last = now;
        time += dt;
        stageTime += dt;

        if (stage !== "leave" && !holdingRef.current) {
          stage = "leave";
          stageTime = 0;
          host.classList.add("is-leaving");
        }

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        let x = 0;
        let y = layout.y;
        let scale = layout.scale;
        const target = { flapRate: 2.1, roll: 0, yaw: 0, pitch: 0 };

        if (stage === "arrive") {
          const k = Math.min(stageTime / ARRIVE_TIME, 1);
          const e = easeOut(k);
          x = lerp(vw * 0.6, 0, e);
          y = lerp(layout.y - vh * 0.75, layout.y, e);
          scale = lerp(layout.scale * 0.45, layout.scale, e);
          target.flapRate = 2.6;
          target.roll = -0.35 * (1 - e);
          target.yaw = -0.45 * (1 - e);
          target.pitch = 0.2 * (1 - e);
          if (k >= 1) {
            stage = "hover";
            stageTime = 0;
          }
        } else if (stage === "hover" && !reduceMotion) {
          x = Math.sin(time * 0.55) * 14;
          target.roll = -Math.cos(time * 0.55) * 0.05;
        } else if (stage === "leave") {
          // the owl climbs away (its canvas moves by CSS); the envelope settles
          if (!leaveFrom) leaveFrom = { x: motion.x, y: carrierY, scale: carrierScale };
          const k = Math.min(stageTime / SETTLE_TIME, 1);
          const e = easeInOut(k);
          x = lerp(leaveFrom.x, 0, e);
          y = lerp(leaveFrom.y, 0, e);
          scale = lerp(leaveFrom.scale, 1, e);
          target.flapRate = 3;
          target.yaw = -0.9;
          target.pitch = -0.35;
          target.roll = 0.3;
          if (stageTime >= LEAVE_TIME) {
            finish();
            return;
          }
        }

        const phase = owl.animate(dt, target);
        // the owl rises a little on each downstroke, and the envelope with it
        const bob = stage === "leave" || reduceMotion ? 0 : Math.sin(phase) * -5;
        motion.x = x;
        const angle = reduceMotion ? 0 : swingStep(dt, stage === "leave" ? 6 : 1.1) * (stage === "leave" ? 1 - Math.min(stageTime / SETTLE_TIME, 1) : 1);
        carrierY = y + bob;
        carrierScale = scale;
        carrier.style.transform = `translate(${x}px, ${carrierY}px) scale(${scale})`;
        swing.style.transform = `rotate(${angle}rad)`;
      }
      raf = requestAnimationFrame(frame);
    }

    function finish() {
      cancelAnimationFrame(raf);
      owl?.dispose();
      owl = null;
      carrier.style.transform = "";
      swing.style.transform = "";
      window.removeEventListener("resize", measure);
      if (!cancelled) setMode("done");
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      owl?.dispose();
      owl = null;
      carrier.style.transform = "";
      swing.style.transform = "";
      host.classList.remove("is-leaving");
    };
    // Runs once per visit of the owl; `holding` is read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`owl-carrier is-${mode}`} ref={carrierRef}>
      <div className="owl-envelope-box">
        <div className="owl-swing" ref={swingRef}>
          {children}
        </div>
        <div className="owl-host" ref={hostRef} aria-hidden="true" />
      </div>
      {after}
    </div>
  );
}
