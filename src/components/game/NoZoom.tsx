"use client";

import { useEffect } from "react";

// Empêche le zoom navigateur (pincement tactile, Ctrl+molette, Ctrl +/-/0)
// qui faisait planter le jeu. Le zoom du viewport est aussi bloqué dans layout.tsx.
export function NoZoom() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ["+", "-", "=", "0", "_"].includes(e.key)) {
        e.preventDefault();
      }
    };
    const gestures = ["gesturestart", "gesturechange", "gestureend"] as const;

    gestures.forEach((g) => document.addEventListener(g, prevent, { passive: false }));
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKey);
    return () => {
      gestures.forEach((g) => document.removeEventListener(g, prevent));
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  return null;
}
