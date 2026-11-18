import { useEffect, useRef, useState } from "react";
import "./scene3d.css";

// A 3D backdrop behind the letter. `load` imports the scene's module (so
// three.js and the scene code only download when needed); while it loads, or
// if the browser can't do WebGL, the 2D version (`Fallback`) is shown instead.
export default function Scene3D({ load, create, Fallback }) {
  const hostRef = useRef(null);
  const [state, setState] = useState("loading"); // loading | ready | failed

  useEffect(() => {
    let scene = null;
    let cancelled = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    load()
      .then((module) => module[create](hostRef.current, { reduceMotion }))
      .then((s) => {
        if (cancelled) return s.dispose();
        scene = s;
        setState("ready");
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setState("failed");
      });
    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, [load, create]);

  return (
    <>
      {state !== "ready" && <Fallback />}
      <div className={`scene3d is-${state}`} aria-hidden="true">
        <div className="scene3d-canvas" ref={hostRef} />
      </div>
    </>
  );
}
