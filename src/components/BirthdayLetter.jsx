import { useEffect, useRef, useState } from "react";
import AgedEnvelope from "./AgedEnvelope/AgedEnvelope.jsx";
import LetterSheet, { LetterGreeting } from "./LetterSheet/LetterSheet.jsx";
import BurntEdgesFilter from "./LetterSheet/BurntEdgesFilter.jsx";
import OwlCarrier from "./OwlCarrier/OwlCarrier.jsx";

// How long the seal-breaking, flap-opening and letter-sliding takes (ms).
const OPEN_TIME = 2400;
// How long the owl takes to let go and the envelope to settle (ms).
const RELEASE_TIME = 900;

const HINTS = {
  carried: "Tap the envelope to take it from the owl",
  front: "Tap the envelope to turn it over",
  back: "Tap the wax seal to open it, or the envelope to turn it back",
  opening: "",
};

// The owl flies in carrying the envelope; the first tap takes it from the
// owl (which flies off). After that, taps turn the envelope over as usual.
// "front" <-> "back" (tap the envelope to flip it either way)
// ... -> "open" -> press the letter's corner -> "flown" -> Read it again -> "front"
// "back" -> tap the seal -> "opening" -> "open"
// config already has {name} filled in (see personalise.js).
export default function BirthdayLetter({ config, withOwl = true, onOpenMemories }) {
  const [stage, setStage] = useState("front");
  // "holding" -> tap -> "letting-go" -> "gone"; back to "holding" on Read it again
  const [owl, setOwl] = useState(withOwl ? "holding" : "gone");
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function handleFlip() {
    if (owl === "letting-go") return;
    if (stage === "front" && owl === "holding") {
      setOwl("letting-go");
      timers.current.push(setTimeout(() => setOwl("gone"), RELEASE_TIME));
      return;
    }
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
        <div className="read-again-actions">
          <button
            className="read-again-button"
            onClick={() => {
              // without the owl (in the tower room) the envelope just comes back
              setOwl(withOwl ? "holding" : "gone");
              setStage("front");
            }}
          >
            Read it again
          </button>
          {onOpenMemories && (
            <button className="read-again-button is-secondary" onClick={onOpenMemories}>
              Visit the memory basin
            </button>
          )}
        </div>
      </div>
    );
  }

  const hint = owl === "holding" && stage === "front" ? HINTS.carried : owl === "letting-go" ? "" : HINTS[stage];

  return (
    <>
      <BurntEdgesFilter />
      <OwlCarrier
        holding={owl === "holding"}
        onUnavailable={() => setOwl("gone")}
        after={<p className={`envelope-hint ${hint ? "" : "is-hidden"}`}>{hint || "\u00a0"}</p>}
      >
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
      </OwlCarrier>
    </>
  );
}
