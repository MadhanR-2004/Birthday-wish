import { lazy, Suspense, useState } from "react";
import CastleNight from "./components/scenes/CastleNight/CastleNight.jsx";
import GrandHall from "./components/scenes/GrandHall/GrandHall.jsx";
import SceneSwitcher from "./components/scenes/SceneSwitcher.jsx";
import Scene3D from "./components/scenes3d/Scene3D.jsx";
// Name, seal, address, letter text and memories all live in this file:
import { BIRTHDAY } from "./birthdayConfig.js";
import { fillInName } from "./personalise.js";

const CONFIG = fillInName(BIRTHDAY);

// Big chunks load on demand; if a download is cut off (say, the network
// blips), try once more before giving up.
const retry = (load) => () => load().catch(() => new Promise((r) => setTimeout(r, 800)).then(load));

// The 3D memory basin is large (three.js), so it only loads when it's opened.
const loadMemoryBasin = retry(() => import("./components/MemoryBasin/MemoryBasin.jsx"));
const MemoryBasin = lazy(loadMemoryBasin);
// So is the 3D tower room.
const loadTowerRoom = retry(() => import("./components/TowerRoom/TowerRoom.jsx"));
const TowerRoom = lazy(loadTowerRoom);

// The backdrops behind the letter are 3D scenes (loaded after the page
// appears); the 2D versions show while they load, or if 3D isn't possible.
const loadCastle = () => import("./components/scenes3d/castleScene.js");
const loadHall = () => import("./components/scenes3d/hallScene.js");
const Castle3D = () => <Scene3D load={loadCastle} create="createCastleScene" Fallback={CastleNight} />;
const Hall3D = () => <Scene3D load={loadHall} create="createHallScene" Fallback={GrandHall} />;

const SCENES = {
  castle: { label: "Castle", Scene: Castle3D },
  hall: { label: "Great hall", Scene: Hall3D },
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
  const [view, setView] = useState("letter");
  // the room plays its story the first time; coming back from the basin, it's for exploring
  const [exploreRoom, setExploreRoom] = useState(false);
  const { Scene } = SCENES[scene];
  const hasMemories = CONFIG.memories.length > 0;

  function handleSceneChange(key) {
    setScene(key);
    saveScene(key);
  }

  if (view === "room") {
    return (
      <Suspense fallback={<div className="memory-loading" aria-label="Loading the tower room" />}>
        <TowerRoom
          config={CONFIG}
          explore={exploreRoom}
          onLeave={() => setView("letter")}
          onOpenMemories={hasMemories ? () => setView("memories") : undefined}
        />
      </Suspense>
    );
  }

  if (view === "memories") {
    return (
      <Suspense fallback={<div className="memory-loading" aria-label="Loading the memory basin" />}>
        <MemoryBasin
          memories={CONFIG.memories}
          onLeave={() => setView("letter")}
          onExplore={() => {
            setExploreRoom(true);
            setView("room");
          }}
        />
      </Suspense>
    );
  }

  return (
    <>
      <Scene />
      <SceneSwitcher scenes={SCENES} current={scene} onChange={handleSceneChange} />
      {hasMemories && (
        <button
          className="memory-entry"
          onClick={() => setView("memories")}
          onPointerEnter={loadMemoryBasin}
          onFocus={loadMemoryBasin}
        >
          <span aria-hidden="true">✦</span> Memory basin
        </button>
      )}
      {/* The opening: the owl is on her way to the tower with the letter.
          It's delivered (and read) in the tower room; the memory basin is
          the finale. */}
      <main className="stage opening">
        <section className="opening-card" aria-labelledby="opening-title">
          <p className="opening-kicker">Tonight, by owl post</p>
          <h1 id="opening-title" className="opening-title">
            A letter for {CONFIG.name}
          </h1>
          <p className="opening-text">{CONFIG.owlName} is flying to the tower with something for you…</p>
          <button
            className="opening-button"
            onClick={() => {
              setExploreRoom(false);
              setView("room");
            }}
            onPointerEnter={loadTowerRoom}
            onFocus={loadTowerRoom}
          >
            Follow her to the tower
          </button>
        </section>
      </main>
    </>
  );
}
