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
  const { name, owlName, secret } = config;
  const needsWord = !!secret?.date;
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
  const [visiting, setVisiting] = useState(null); // { title } while looking at one thing
  const [walking, setWalking] = useState(false); // walking about the room
  const [spell, setSpell] = useState("own"); // which spell the wand casts
  const spellIndex = Math.max(0, SPELLS.findIndex(([key]) => key === spell));
  function pickSpell(step) {
    const [key] = SPELLS[(spellIndex + step + SPELLS.length) % SPELLS.length];
    setSpell(key);
    sceneRef.current?.setSpell(key);
  }
  const [lumos, setLumos] = useState(false); // the wand's tip lit up
  // the letter is sealed with our important date (unless you've already opened it)
  const [unlocked, setUnlocked] = useState(explore || !needsWord);
  const requestReadRef = useRef(null);
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
          song: config.song ? `${import.meta.env.BASE_URL}${config.song.replace(/^\//, "")}` : "",
          // two pictures hidden under the gilded painting (by default, the first two memory pictures)
          hiddenPictures: (config.hiddenPictures?.length ? config.hiddenPictures : (config.memories ?? []).flatMap((m) => m.pictures ?? []))
            .slice(0, 2)
            .map((f) => `${import.meta.env.BASE_URL}${f.replace(/^\//, "")}`),
          favourites: (config.favourites ?? []).filter((f) => f?.file).map((f) => ({ title: f.title ?? "", url: `${import.meta.env.BASE_URL}${f.file.replace(/^\//, "")}` })),
          explore,
          reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          onProgress: setProgress,
          onReadLetter: () => requestReadRef.current(),
          onVisit: setVisiting,
          onWalk: setWalking,
          onLumos: setLumos,
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
      if (holding && !step && !/input|textarea/i.test(e.target?.tagName ?? "")) {
        if (e.key === "q" || e.key === "Q") return pickSpell(-1);
        if (e.key === "e" || e.key === "E") return pickSpell(1);
      }
      if (e.key !== "Escape") return;
      if (reading) closeLetter();
      else if (walking) sceneRef.current?.walk(false);
      else if (step?.mode === "found") sceneRef.current?.closeFound();
      else if (visiting) sceneRef.current?.leaveVisit();
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
  const requestRead = readLetter;
  requestReadRef.current = requestRead;
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
        onClick={reading ? closeLetter : walking ? () => sceneRef.current?.walk(false) : visiting ? () => sceneRef.current?.leaveVisit() : onLeave}
        aria-label={reading || visiting || walking ? "Back to the room" : "Back to the start"}
        title={reading || visiting || walking ? "Back to the room" : "Back to the start"}
      >
        ←
      </button>

      {reading && (
        <div className="tr-reading">
          <main className="stage">
            <BirthdayLetter config={config} withOwl={false} lock={unlocked ? null : secret} onUnlock={() => setUnlocked(true)} />
          </main>
        </div>
      )}

      {status === "ready" && !reading && (
        <>
          <div className="tr-top-right">
            {storyOver && !walking && !visiting && (
              <button className="tr-pill" onClick={() => sceneRef.current?.walk(true)}>
                Walk around
              </button>
            )}
            {letterReady && storyOver && (
              <button className="tr-pill is-gold" onClick={requestRead}>
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
                {step.mode === "found" && (
                  <button className="tr-story-close" onClick={() => sceneRef.current?.closeFound()} aria-label="Close and choose the next one" title="Close">
                    ×
                  </button>
                )}
                {step.mode === "found" ? (
                  <p className="tr-story-text">Cast it again as many times as you like. Tap × when you're ready for the next one.</p>
                ) : (
                  <p className={`tr-story-text ${step.prompt ? "" : "is-waiting"}`}>{step.prompt ?? "\u00a0"}</p>
                )}
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
                    <button className="tr-pill is-gold" onClick={step.mode === "basin" ? onOpenMemories : requestRead}>
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
              <div className="tr-spellbar" role="group" aria-label="Your wand">
                <button className="tr-spell-step" onClick={() => pickSpell(-1)} aria-label="Previous spell" title="Previous spell (Q)">
                  ‹
                </button>
                <div className="tr-spell-now" aria-live="polite">
                  <span key={spell} className="tr-spell-name">
                    {SPELLS[spellIndex][1]}
                  </span>
                  <span className="tr-spell-hint">
                    tap anything to cast{walking && <span className="tr-walk-keys"> · W A S D to walk</span>}
                  </span>
                </div>
                <button className="tr-spell-step" onClick={() => pickSpell(1)} aria-label="Next spell" title="Next spell (E)">
                  ›
                </button>
                <button className={`tr-spell-lumos ${lumos ? "is-on" : ""}`} aria-pressed={lumos} onClick={() => sceneRef.current?.lumos(!lumos)} aria-label="Lumos: light the wand" title="Lumos">
                  ✦
                </button>
                {walking ? (
                  <button className="tr-visit-close" onClick={() => sceneRef.current?.walk(false)} aria-label="Stop walking" title="Stop walking">
                    ×
                  </button>
                ) : (
                  <button className="tr-visit-close" onClick={() => sceneRef.current?.setWand(false)} aria-label="Put the wand down" title="Put the wand down">
                    ×
                  </button>
                )}
              </div>
            )}
            {!step && walking && !holding && (
              <div className="tr-visit" role="group" aria-label="Walking around">
                <span className="tr-visit-name">
                  <span className="tr-walk-keys">Drag to look · W A S D or arrows to walk · </span>tap anything for its magic
                </span>
                <button className="tr-visit-close" onClick={() => sceneRef.current?.walk(false)} aria-label="Stop walking" title="Stop walking">
                  ×
                </button>
              </div>
            )}
            {!step && visiting && (
              <div className="tr-visit" role="group" aria-label={visiting.title}>
                <span className="tr-visit-name">{visiting.title}</span>
                <button className="tr-pill is-gold" onClick={() => sceneRef.current?.again()}>
                  Do it again
                </button>
                <button className="tr-visit-close" onClick={() => sceneRef.current?.leaveVisit()} aria-label="Back to the whole room" title="Back to the whole room">
                  ×
                </button>
              </div>
            )}
            {!step && !holding && !visiting && !walking && tip && <p className="tr-tip">Tap any glowing light to see what it does</p>}
          </div>
          {walking && <WalkStick onMove={(x, y) => sceneRef.current?.setStick(x, y)} />}
        </>
      )}
    </div>
  );
}

// The spells the wand can cast ("own" is each thing's own magic)
const SPELLS = [
  ["own", "Its own magic"],
  ["leviosa", "Wingardium Leviosa"],
  ["accio", "Accio"],
  ["engorgio", "Engorgio"],
  ["reducio", "Reducio"],
  ["colovaria", "Colovaria"],
  ["incendio", "Incendio"],
];

// An on-screen stick for walking on touch screens: push it the way you want
// to go (up is forwards).
function WalkStick({ onMove }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);
  function move(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const r = rect.width / 2;
    let x = (e.clientX - rect.left - r) / r;
    let y = (e.clientY - rect.top - r) / r;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    setKnob({ x, y });
    onMove(x, -y);
  }
  function stop() {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  }
  return (
    <div
      className="tr-stick"
      aria-hidden="true"
      onPointerDown={(e) => {
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => active.current && move(e)}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <span className="tr-stick-knob" style={{ transform: `translate(${knob.x * 34}px, ${knob.y * 34}px)` }} />
    </div>
  );
}
