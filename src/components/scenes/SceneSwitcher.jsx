import "./SceneSwitcher.css";

// A small toggle in the corner for choosing the background scene.
export default function SceneSwitcher({ scenes, current, onChange }) {
  return (
    <nav className="scene-switcher" aria-label="Choose a background">
      {Object.entries(scenes).map(([key, scene]) => (
        <button
          key={key}
          className="scene-option"
          aria-pressed={current === key}
          onClick={() => onChange(key)}
        >
          {scene.label}
        </button>
      ))}
    </nav>
  );
}
