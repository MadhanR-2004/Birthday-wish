const number = (i) => String(i + 1).padStart(2, "0");

// The row of memories to choose from, along the bottom of the screen.
export default function MemoryPicker({ memories, disabled, cardRefs, onHover, onChoose }) {
  return (
    <section className="mb-picker" aria-labelledby="mb-picker-title" inert={disabled}>
      {/* <p className="kicker mb-kicker">THE MEMORY BASIN</p> */}
      <h1 id="mb-picker-title" className="mb-title">
        Choose a memory to fall into
      </h1>
      <ul className="mb-memories">
        {memories.map((memory, i) => (
          <li key={i}>
            <button
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="mb-memory"
              onPointerEnter={() => onHover(true)}
              onPointerLeave={() => onHover(false)}
              onFocus={() => onHover(true)}
              onBlur={() => onHover(false)}
              onClick={() => onChoose(i)}
            >
              <span className="mb-memory-number" aria-hidden="true">
                {number(i)}
              </span>
              <span className="mb-memory-text">
                <span className="mb-memory-when">{memory.when}</span>
                <span className="mb-memory-title">{memory.title}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
