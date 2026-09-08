// GameCanvas.tsx — Babylon-in-React integration contract for the game-dev skill.
// React = picture frame, Babylon = canvas, godogen game code = the painting.
//
// Place at client/src/components/GameCanvas.tsx and render it as the ONLY content
// of the "/" route. The Babylon engine owns the full-screen <canvas>; all gameplay
// lives in framework-agnostic TS modules under client/src/game/ (ported from godogen).
//
// Critical safety rules (see references/manus-adaptations.md):
//  - Initialize the engine exactly once; guard against React StrictMode double-mount.
//  - Always engine.dispose() on unmount and remove every listener.
//  - Tie the render loop to the component lifecycle.
//  - Handle window resize.

import { useEffect, useRef } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type GameHandle } from "@/game/scene";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // StrictMode in React 19 mounts effects twice in dev; this ref prevents a
  // second Babylon engine from being created on the same canvas.
  const startedRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });

    // createGameScene wires up the whole godogen-style game (GameWorld, Player,
    // obstacles, input, scoring). It returns a handle for cleanup.
    let handle: GameHandle | null = null;
    createGameScene(engine, canvas).then((h) => {
      handle = h;
      engine.runRenderLoop(() => h.scene.render());
    });

    const onResize = () => engine.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      handle?.dispose();
      engine.dispose();
      startedRef.current = false;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 h-full w-full outline-none"
      style={{ touchAction: "none" }}
    />
  );
}
