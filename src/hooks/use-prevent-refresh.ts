"use client";

import { useEffect } from "react";

/**
 * Blocks page refresh while a game is in progress.
 *
 * Why: refreshing (F5 / Ctrl+R / pull-to-refresh / closing the tab) wipes the
 * in-memory game state. In a live online room it also drops the player out of
 * the match unexpectedly, which disrupts everyone else — the host included.
 * So while the player is inside the game composition screen or the grid, we
 * make reloading impossible (or at least require an explicit confirmation).
 *
 * Mechanisms:
 *  - `beforeunload`: native browser confirmation dialog for F5, Ctrl+R,
 *    tab close and any navigation away.
 *  - `keydown`: intercepts the F5 / Ctrl+R / Cmd+R shortcuts (best effort).
 *  - `touchmove` + `overscroll-behavior`: disables mobile pull-to-refresh,
 *    which is the main accidental reload gesture on phones.
 *
 * @param active When true, the guards are installed; when it becomes false
 *               (game over, back home, explicit quit) everything is removed.
 */
export function usePreventRefresh(active: boolean) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const message =
      "Une partie est en cours. La quitter par actualisation ferait perdre " +
      "la progression de la grille. Quitter quand même ?";

    // 1) Native confirmation on refresh / reload / tab close / navigation.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers require returnValue to be set to show the dialog.
      e.returnValue = message;
      return message;
    };

    // 2) Block the reload keyboard shortcuts (F5, Ctrl+R, Cmd+R).
    const onKeyDown = (e: KeyboardEvent) => {
      const isReload =
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"));
      if (isReload) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 3) Disable mobile pull-to-refresh. It only triggers when the gesture
    // starts at the very top of the page and scrolls further up.
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      // Pulling down (finger moves down) while already at the top of the page.
      const pullingDown = y > touchStartY;
      if (pullingDown && window.scrollY <= 0) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    // Must be non-passive so preventDefault() actually blocks the gesture.
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    // Belt-and-braces: also lock the CSS overscroll behavior while active.
    const previousOverscroll = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = "none";

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      document.body.style.overscrollBehaviorY = previousOverscroll;
    };
  }, [active]);
}
