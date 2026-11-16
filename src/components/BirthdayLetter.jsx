import { useEffect, useRef, useState } from "react";
import AgedEnvelope from "./AgedEnvelope/AgedEnvelope.jsx";
import LetterSheet, { LetterGreeting } from "./LetterSheet/LetterSheet.jsx";
import BurntEdgesFilter from "./LetterSheet/BurntEdgesFilter.jsx";

// How long the seal-breaking, flap-opening and letter-sliding takes (ms).
const OPEN_TIME = 2400;

const HINTS = {
  front: "Tap the envelope to turn it over",
  back: "Tap the wax seal to open it, or the envelope to turn it back",
  opening: "",
};

// Replaces every {name} in the settings with the actual name.
function fillInName(config) {
  const fill = (text) => text.replaceAll("{name}", config.name);
  return {
    ...config,
    address: config.address.map(fill),
    letter: {
      ...config.letter,
      label: fill(config.letter.label),
      greeting: fill(config.letter.greeting),
      paragraphs: config.letter.paragraphs.map(fill),
      signature: fill(config.letter.signature),
    },
  };
}

// "front" <-> "back" (tap the envelope to flip it either way)
// ... -> "open" -> press the letter's corner -> "flown" -> Read it again -> "front"
// "back" -> tap the seal -> "opening" -> "open"
export default function BirthdayLetter({ config: settings }) {
  const config = fillInName(settings);
  const [stage, setStage] = useState("front");
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function handleFlip() {
    if (stage === "front") setStage("back");
    else if (stage === "back") setStage("front");
  }

  function handleBreakSeal() {
    if (stage !== "back") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setStage("opening");
    timers.current.push(setTimeout(() => setStage("open"), reduceMotion ? 0 : OPEN_TIME));
  }

  if (stage === "open") {
    return (
      <>
        <BurntEdgesFilter />
        <LetterSheet letter={config.letter} onFlownAway={() => setStage("flown")} />
      </>
    );
  }

  if (stage === "flown") {
    return (
      <div className="read-again">
        <p className="read-again-note">The letter has flown off into the night sky…</p>
        <button className="read-again-button" onClick={() => setStage("front")}>
          Read it again
        </button>
      </div>
    );
  }

  return (
    <>
      <BurntEdgesFilter />
      <AgedEnvelope
        address={config.address}
        seal={config.seal}
        name={config.name}
        stage={stage}
        onFlip={handleFlip}
        onBreakSeal={handleBreakSeal}
      >
        <LetterGreeting letter={config.letter} />
      </AgedEnvelope>
      <p className={`envelope-hint ${HINTS[stage] ? "" : "is-hidden"}`}>{HINTS[stage] || "\u00a0"}</p>
    </>
  );
}
