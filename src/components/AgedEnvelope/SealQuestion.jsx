import { useRef, useState } from "react";

const digits = (text) => text.replace(/\D/g, "");
// "14022024" -> "14 / 02 / 2024", as you type
const shape = (d) => [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join(" / ");
// "14/2/2024", "14-02-2024" -> "14022024"
function key(date) {
  const [d = "", m = "", y = ""] = date.split(/\D+/).filter(Boolean);
  return d.padStart(2, "0") + m.padStart(2, "0") + y;
}

// Under the sealed envelope: one question, one field. The seal only breaks
// for our important date. It checks itself once the whole date is typed in.
// `nudge` bumps when the seal is tapped too early, to shake the field.
export default function SealQuestion({ date, hint, nudge, onRight }) {
  const [value, setValue] = useState("");
  const [tries, setTries] = useState(0);
  const [right, setRight] = useState(false);
  const field = useRef(null);
  const answer = key(date);

  function check(typed) {
    if (right || typed.length < 8) return;
    if (typed === answer) {
      setRight(true);
      field.current?.blur();
      onRight();
    } else {
      setTries((n) => n + 1);
      setValue(""); // clear it for the next try
    }
  }

  return (
    <form
      className="seal-question"
      onSubmit={(e) => {
        e.preventDefault();
        check(value);
      }}
    >
      <input
        key={`${tries}-${nudge}`} // remount to replay the shake
        ref={field}
        className={`seal-question-input ${tries || nudge ? "is-wrong" : ""} ${right ? "is-right" : ""}`}
        value={shape(value)}
        onChange={(e) => {
          const typed = digits(e.target.value).slice(0, 8);
          setValue(typed);
          check(typed); // may clear it again
        }}
        placeholder="Our important date"
        aria-label="Our important date, as day, month, year"
        aria-describedby="seal-question-note"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={tries + nudge > 0}
        readOnly={right}
      />
      <p id="seal-question-note" className="seal-question-note" aria-live="polite">
        {right ? "The seal melts away…" : tries >= 2 && hint ? hint : tries ? "Not quite. Try again." : "DD / MM / YYYY"}
      </p>
    </form>
  );
}
