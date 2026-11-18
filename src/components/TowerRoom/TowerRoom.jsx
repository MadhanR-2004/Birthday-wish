import { useEffect, useRef, useState } from "react";
import BirthdayLetter from "../BirthdayLetter.jsx";
import "./TowerRoom.css";

// The tower room, in 3D. The scene itself lives in roomScene.js. First it
// plays as a story with one instruction at the bottom: take the letter, pick
// up the wand, choose what to enchant (in any order), read the letter, and
// finally head on to the memory basin. If you stay (or come back from the
// basin), the room is yours to explore: tap any glowing light, watch what it
// does, and the view comes back to the whole room by itself.
export default function TowerRoom({ config, onLeave, onOpenMemories, explore = false }) {
  const { name, owlName } = config;
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | failed
  const [progress, setProgress] = useState(0);
  const [line, setLine] = useState("");
  const [letterReady, setLetterReady] = useState(false);
  const [reading, setReading] = useState(false);
  const [holding, setHolding] = useState(false);
  const [hover, setHover] = useState(null); // { label, x, y } under the mouse
  const [tip, setTip] = useState(false);
  const [step, setStep] = useState(undefined); // the story's current step, or null once it's over
  const pointerRef = useRef({ x: 0, y: 0 });
  const leaveRef = useRef(onLeave);
  useEffect(() => {
    leaveRef.current = onLeave;
  }, [onLeave]);

  useEffect(() => {
    let room = null;
    let cancelled = false;
    // Give the loading screen a moment to paint before the heavy work.
    const start = setTimeout(async () => {
      try {
        const { createRoomScene } = await import("./roomScene.js");
        if (cancelled) return;
        room = await createRoomScene(hostRef.current, {
          name,
          owlName,
          withBasin: !!onOpenMemories,
          explore,
          reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          onProgress: setProgress,
          onReadLetter: () => setReading(true),
          onNarrate: setLine,
          onLetterReady: setLetterReady,
          onWand: setHolding,
          onHover: (label) => setHover(label ? { label, ...pointerRef.current } : null),
          onStep: setStep,
        });
        if (cancelled) {
          room.dispose();
          return;
        }
        sceneRef.current = room;
        setStatus("ready");
      } catch (error) {
        console.error(error);
        if (!cancelled) setStatus("failed");
      }
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(start);
      room?.dispose();
      sceneRef.current = null;
    };
  }, [name, owlName, explore]);

  // the narration line fades after a while
  useEffect(() => {
    if (!line) return undefined;
    const t = setTimeout(() => setLine(""), 6000);
    return () => clearTimeout(t);
  }, [line]);

  // once the story's over, a single tip about exploring, then it goes
  const storyOver = step === null;
  useEffect(() => {
    if (!storyOver) return undefined;
    setTip(true);
    const t = setTimeout(() => setTip(false), 7000);
    return () => clearTimeout(t);
  }, [storyOver]);

  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (reading) closeLetter();
      else if (step) return; // the story keeps the wand in your hand
      else if (holding) sceneRef.current?.setWand(false);
      else leaveRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function readLetter() {
    setReading(true);
  }
  function closeLetter() {
    setReading(false);
    // after reading, the story points on to the memory basin
    if (step) sceneRef.current?.letterRead();
  }
  return (
    <div
      className={`tower-room is-${status}`}
      onPointerMove={(e) => {
        pointerRef.current = { x: e.clientX, y: e.clientY };
        if (hover) setHover((h) => h && { ...h, x: e.clientX, y: e.clientY });
      }}
    >
      <div className="tr-canvas" ref={hostRef} />

      {status !== "ready" && (
        <div className="tr-loading" role="status">
          <p className="tr-loading-title">{status === "failed" ? "The tower door is stuck" : "Climbing the tower stairs…"}</p>
          {status === "loading" && (
            <div className="tr-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          {status === "failed" && <p className="tr-loading-note">This browser couldn't draw the 3D room.</p>}
        </div>
      )}

      {/* top: back on the left; the letter and replay on the right */}
      <button
        className="tr-round tr-back"
        onClick={reading ? closeLetter : onLeave}
        aria-label={reading ? "Back to the room" : "Back to the start"}
        title={reading ? "Back to the room" : "Back to the start"}
      >
        ←
      </button>

      {reading && (
        <div className="tr-reading">
          <main className="stage">
            <BirthdayLetter config={config} withOwl={false} />
          </main>
        </div>
      )}

      {status === "ready" && !reading && (
        <>
          <div className="tr-top-right">
            {letterReady && storyOver && (
              <button className="tr-pill is-gold" onClick={readLetter}>
                Read the letter
              </button>
            )}
            <button className="tr-round" onClick={() => sceneRef.current?.replay()} aria-label={`Watch ${owlName} deliver the letter again`} title="Watch the delivery again">
              ↻
            </button>
          </div>

          <p className={`tr-narration ${line ? "" : "is-hidden"}`} aria-live="polite">
            {line || " "}
          </p>

          {hover && (!holding || step) && (
            <div className="tr-tooltip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
              {hover.label}
            </div>
          )}

          <div className="tr-bottom">
            {step && (
              <div className="tr-story" role="status" aria-live="polite">
                <div className="tr-steps" aria-label={`Step ${step.index + 1} of ${step.total}`}>
                  {Array.from({ length: step.total }, (_, i) => (
                    <span key={i} className={i < step.index ? "is-done" : i === step.index ? "is-now" : ""} />
                  ))}
                </div>
                <p className={`tr-story-text ${step.prompt ? "" : "is-waiting"}`}>{step.prompt ?? "\u00a0"}</p>
                {step.choices?.length > 0 && (
                  <div className="tr-choices">
                    {step.choices.map((c) => (
                      <button key={c.key} className="tr-pill tr-choice" onClick={() => sceneRef.current?.choose(c.key)}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="tr-story-actions">
                  {step.action && (
                    <button className="tr-pill is-gold" onClick={step.mode === "basin" ? onOpenMemories : readLetter}>
                      {step.action}
                    </button>
                  )}
                  {step.mode === "basin" && (
                    <button className="tr-skip" onClick={() => sceneRef.current?.finishStory()}>
                      Stay in the room
                    </button>
                  )}
                  {step.mode === "cast" && (
                    <button className="tr-skip" onClick={() => sceneRef.current?.chooseAgain()}>
                      Choose something else
                    </button>
                  )}
                </div>
              </div>
            )}

            {!step && holding && (
              <div className="tr-wandbar" role="status">
                <span>
                  <strong>Wand ready.</strong> Tap anything to cast a spell.
                </span>
                <button className="tr-pill" onClick={() => sceneRef.current?.setWand(false)}>
                  Put it down
                </button>
              </div>
            )}
            {!step && !holding && tip && <p className="tr-tip">Tap any glowing light to see what it does</p>}
          </div>
        </>
      )}
    </div>
  );
}
