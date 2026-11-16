import { useEffect, useRef, useState } from "react";
import { confetti, sparkles } from "party-js";
import "./LetterSheet.css";

const SPELL_COLORS = ["#C8102E", "#FFFFFF", "#F1CA4A", "#E4B724"];

// The aged, burnt paper behind the writing. Kept separate from the text so the
// burn filter only touches the paper.
export function LetterPaper() {
  return <div className="letter-paper aged-paper" aria-hidden="true" />;
}

export function LetterGreeting({ letter }) {
  return (
    <>
      <p className="kicker">{letter.label}</p>
      <h2 className="letter-heading">{letter.greeting}</h2>
    </>
  );
}

// The opened letter: old paper with fold creases, unfolding into view
// with a burst of confetti and sparkles. Pressing the curled corner sends
// it fluttering away into the sky; onFlownAway is called once it's gone.
export default function LetterSheet({ letter, onFlownAway }) {
  const sheetRef = useRef(null);
  const cornerRef = useRef(null);
  const celebrated = useRef(false);
  const [flying, setFlying] = useState(false);

  function handleLetItFly() {
    if (flying) return;
    sparkles(cornerRef.current, { count: 35 });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      onFlownAway();
      return;
    }
    setFlying(true);
  }

  function handleAnimationEnd(event) {
    if (event.animationName === "letter-fly-away") onFlownAway();
  }

  useEffect(() => {
    if (celebrated.current) return;
    celebrated.current = true;
    const timer = setTimeout(() => {
      confetti(sheetRef.current, { count: 90, colors: SPELL_COLORS });
      sparkles(sheetRef.current, { count: 40 });
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`letter-sheet-shadow ${flying ? "is-flying" : ""}`} onAnimationEnd={handleAnimationEnd}>
      <article ref={sheetRef} className="letter-sheet">
        <LetterPaper />
        <LetterGreeting letter={letter} />
        {letter.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
        <p className="signature">{letter.signature}</p>

        <button
          ref={cornerRef}
          className="letter-corner"
          onClick={handleLetItFly}
          disabled={flying}
          aria-label="Let the letter fly away"
        >
          <span className="letter-corner-hint" aria-hidden="true">
            let it fly
          </span>
          <span className="letter-corner-curl" aria-hidden="true" />
        </button>
      </article>
    </div>
  );
}
