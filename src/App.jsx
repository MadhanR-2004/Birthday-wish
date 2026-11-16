import { useState } from "react";
import CastleNight from "./components/scenes/CastleNight/CastleNight.jsx";
import GrandHall from "./components/scenes/GrandHall/GrandHall.jsx";
import SceneSwitcher from "./components/scenes/SceneSwitcher.jsx";
import BirthdayLetter from "./components/BirthdayLetter.jsx";
// Name, seal, address and letter text all live in this file:
import { BIRTHDAY } from "./birthdayConfig.js";

const SCENES = {
  castle: { label: "Castle", Scene: CastleNight },
  hall: { label: "Great hall", Scene: GrandHall },
};

const STORAGE_KEY = "funtime-scene";

// Remember the chosen scene in this browser (if storage is available).
function loadScene() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved in SCENES ? saved : "castle";
  } catch {
    return "castle";
  }
}

function saveScene(key) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // storage blocked: the choice just won't be remembered
  }
}

export default function App() {
  const [scene, setScene] = useState(loadScene);
  const { Scene } = SCENES[scene];

  function handleSceneChange(key) {
    setScene(key);
    saveScene(key);
  }

  return (
    <>
      <Scene />
      <SceneSwitcher scenes={SCENES} current={scene} onChange={handleSceneChange} />
      <main className="stage">
        <BirthdayLetter config={BIRTHDAY} />
      </main>
    </>
  );
}
