import { useRef } from "react";
import TextSparkles from "./TextSparkles.jsx";

// When the heading and each line fade in (seconds after the memory opens).
const HEADING_DELAY = 0.3;
const lineDelay = (i) => 0.9 + i * 0.7;

// Inside a memory: an optional photo dissolving into the mist, and the words
// surfacing one line at a time, giving off sparkles as they appear.
export default function MemoryView({ memory, index, leaving, headingRef, onSurface }) {
  const innerRef = useRef(null);

  return (
    <article className={`mb-memory-view ${leaving ? "is-leaving" : ""}`} aria-labelledby="mb-memory-title">
      <div className="mb-memory-inner" ref={innerRef}>
        {memory.pictures.length > 0 && (
          <div className="mb-memory-photo">
            <img src={memory.pictures[0]} alt="" />
          </div>
        )}
        <p className="kicker mb-kicker">
          MEMORY {String(index + 1).padStart(2, "0")} · {memory.when.toUpperCase()}
        </p>
        <h2
          id="mb-memory-title"
          className="mb-memory-heading"
          ref={headingRef}
          tabIndex={-1}
          data-sparkle-delay={HEADING_DELAY}
          style={{ animationDelay: `${HEADING_DELAY}s` }}
        >
          {memory.title}
        </h2>
        {memory.paragraphs.map((text, i) => (
          <p
            key={i}
            className="mb-memory-line"
            data-sparkle-delay={lineDelay(i)}
            style={{ animationDelay: `${lineDelay(i)}s` }}
          >
            {text}
          </p>
        ))}
        <button className="mb-button" onClick={onSurface} disabled={leaving}>
          Rise back out
        </button>
        <TextSparkles containerRef={innerRef} active={!leaving} />
      </div>
    </article>
  );
}
