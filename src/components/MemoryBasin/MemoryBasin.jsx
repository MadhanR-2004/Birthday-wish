import { useEffect, useRef, useState } from "react";
import { createBasinScene } from "./basinScene.js";
import MemoryPicker from "./MemoryPicker.jsx";
import MemoryView from "./MemoryView.jsx";
import "./MemoryBasin.css";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A stone basin of silver memories. Pick one and fall into it.
// phase: "choosing" -> "diving" -> "remembering" -> "surfacing" -> "choosing"
export default function MemoryBasin({ memories, onLeave, onExplore }) {
  const hostRef = useRef(null);
  const basinRef = useRef(null);
  const cardRefs = useRef([]);
  const headingRef = useRef(null);
  const [phase, setPhase] = useState("choosing");
  const [chosen, setChosen] = useState(null);
  const [noWebGL, setNoWebGL] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let basin;
    try {
      basin = createBasinScene(hostRef.current, { reduceMotion });
    } catch {
      setNoWebGL(true);
      return undefined;
    }
    basinRef.current = basin;
    return () => {
      basin.dispose();
      basinRef.current = null;
    };
  }, []);

  // Move keyboard focus to wherever the person now is.
  useEffect(() => {
    if (phase === "remembering") headingRef.current?.focus({ preventScroll: true });
    if (phase === "choosing" && chosen !== null) cardRefs.current[chosen]?.focus({ preventScroll: true });
  }, [phase, chosen]);

  async function handleChoose(index) {
    if (phase !== "choosing") return;
    const basin = basinRef.current;
    setChosen(index);
    setPhase("diving");
    if (basin) await basin.dive({ pictures: memories[index].pictures });
    else await wait(700);
    if (basinRef.current !== basin) return;
    setPhase("remembering");
  }

  async function handleSurface() {
    if (phase !== "remembering") return;
    const basin = basinRef.current;
    setPhase("surfacing");
    if (basin) await basin.surface();
    else await wait(600);
    if (basinRef.current !== basin) return;
    setPhase("choosing");
  }

  useEffect(() => {
    function onKey(event) {
      if (event.key !== "Escape") return;
      if (phase === "remembering") handleSurface();
      else if (phase === "choosing") onLeave();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const choosing = phase === "choosing";
  const inMemory = phase === "remembering" || phase === "surfacing";

  return (
    <div className={`memory-basin phase-${phase} ${noWebGL ? "no-webgl" : ""}`}>
      <div className="mb-canvas" ref={hostRef} aria-hidden="true" />

      <button className="mb-leave" onClick={onLeave} inert={!choosing}>
        <span aria-hidden="true">←</span> <span className="mb-wide">Back to the </span>start
      </button>

      {onExplore && (
        <button className="mb-leave mb-explore" onClick={onExplore} inert={!choosing}>
          <span className="mb-wide">Explore the </span>tower room <span aria-hidden="true">→</span>
        </button>
      )}

      <MemoryPicker
        memories={memories}
        disabled={!choosing}
        cardRefs={cardRefs}
        onHover={(on) => basinRef.current?.setFocus(on)}
        onChoose={handleChoose}
      />

      {inMemory && chosen !== null && (
        <MemoryView
          memory={memories[chosen]}
          index={chosen}
          leaving={phase === "surfacing"}
          headingRef={headingRef}
          onSurface={handleSurface}
        />
      )}
    </div>
  );
}
