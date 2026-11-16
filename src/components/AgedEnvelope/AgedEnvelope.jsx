import { useRef } from "react";
import WaxSeal from "./WaxSeal.jsx";
import { LetterPaper } from "../LetterSheet/LetterSheet.jsx";
import { Stamps, Postmark, OwlPostMark } from "./Postage.jsx";
import "./AgedEnvelope.css";

// An old paper envelope built in 3D with CSS.
// stage: "front" (address side) -> "back" (wax seal side) -> "opening" (seal breaks, flap opens)
export default function AgedEnvelope({ name, address, seal, stage, onFlip, onBreakSeal, children }) {
  const sceneRef = useRef(null);

  // Tilt the envelope towards the mouse so its depth shows.
  function handlePointerMove(event) {
    if (event.pointerType !== "mouse") return;
    const rect = sceneRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    sceneRef.current.style.setProperty("--tilt-y", `${x * 18}deg`);
    sceneRef.current.style.setProperty("--tilt-x", `${y * -14}deg`);
  }

  function handlePointerLeave() {
    sceneRef.current.style.setProperty("--tilt-y", "0deg");
    sceneRef.current.style.setProperty("--tilt-x", "0deg");
  }

  // Up to 3 characters in the seal; falls back to the name's first letter.
  const sealText = (seal.text || name.charAt(0)).slice(0, 3);

  return (
    <div
      ref={sceneRef}
      className={`envelope-scene stage-${stage}`}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="envelope-float">
        <div className="envelope-tilt">
          <div className="envelope-body">
            {/* paper thickness along the four edges */}
            <div className="envelope-edge edge-top" />
            <div className="envelope-edge edge-bottom" />
            <div className="envelope-edge edge-left" />
            <div className="envelope-edge edge-right" />

            {/* FRONT: the address side */}
            <button
              className="envelope-face envelope-front aged-paper"
              onClick={onFlip}
              disabled={stage !== "front"}
              aria-label="Turn the envelope over"
            >
              <Stamps />
              <Postmark />
              <div className="envelope-address">
                {address.map((line, i) => (
                  <p key={line} className={i === 0 ? "address-name" : undefined}>
                    {line}
                  </p>
                ))}
              </div>
              <OwlPostMark />
            </button>

            {/* BACK: folds, flap and wax seal */}
            <div className="envelope-face envelope-back">
              <div className="envelope-interior aged-paper" />
              <div className="envelope-letter">
                <LetterPaper />
                {children}
              </div>

              <div className="fold-shadow fold-sides">
                <div className="fold fold-left aged-paper" />
                <div className="fold fold-right aged-paper" />
              </div>
              <div className="fold-shadow fold-bottom-wrap">
                <div className="fold fold-bottom aged-paper" />
              </div>

              <div className="envelope-flap">
                <div className="fold-shadow flap-outer-wrap">
                  <div className="flap-outer aged-paper" />
                </div>
                <div className="flap-inner aged-paper" />
                <WaxSeal text={sealText} color={seal.color} part="top" className="seal-on-flap" />
              </div>

              <WaxSeal text={sealText} color={seal.color} part="bottom" className="seal-on-pocket" />
              <button
                className="flip-back-button"
                onClick={onFlip}
                disabled={stage !== "back"}
                aria-label="Turn the envelope back over"
              />
              <button
                className="seal-button"
                onClick={onBreakSeal}
                disabled={stage !== "back"}
                aria-label="Break the wax seal"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="envelope-ground-shadow" />
    </div>
  );
}
