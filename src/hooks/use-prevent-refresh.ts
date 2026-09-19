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
 *  - `touchmove` + `overscroll-behavior`: disables mobile overscroll gestures
 *    in BOTH directions (pull-down refresh at the top, pull-up at the bottom)
 *    plus edge swipes, which are the main accidental reload/leave gestures on
 *    phones.
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

    // 3) Disable mobile overscroll gestures in BOTH directions.
    //    A downward drag at the top of the page triggers pull-to-refresh, and
    //    an upward drag at the bottom (or the reversed gesture at the top on
    //    some browsers/OEM skins) triggers the same reload — or a history
    //    navigation. So we blanket-block any gesture that overscrolls either
    //    vertical edge, regardless of the direction it came from.
    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0]?.clientX ?? 0;
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0;
      const y = e.touches[0]?.clientY ?? 0;
      const dx = x - touchStartX;
      const dy = y - touchStartY;

      const doc = document.documentElement;
      // Total scrollable distance. If the page fits without scrolling, the
      // whole viewport is an overscroll zone and every vertical gesture is a
      // refresh candidate.
      const scrollable = doc.scrollHeight - window.innerHeight;
      const atTop = window.scrollY <= 0;
      const atBottom = window.scrollY >= scrollable - 1;

      const vertical = Math.abs(dy) > Math.abs(dx);
      if (vertical && scrollable <= 1) {
        // Not scrollable at all → block any vertical gesture in both directions.
        e.preventDefault();
        return;
      }
      if (vertical) {
        const pullingDown = dy > 0;
        const pullingUp = dy < 0;
        // Block the refresh gesture at BOTH edges and BOTH directions:
        //  - at the top, any pull (down = classic refresh, up = reversed refresh)
        //  - at the bottom, any pull (up = classic bottom overscroll, down = reversed)
        if ((atTop && (pullingDown || pullingUp)) || (atBottom && (pullingUp || pullingDown))) {
          e.preventDefault();
          return;
        }
      }

      // Horizontal edge swipes (back/forward navigation) — also a way to leave
      // the game unexpectedly, so neutralize them when they start at an edge.
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const atLeftEdge = touchStartX <= 20 && dx > 0;
      const atRightEdge = touchStartX >= window.innerWidth - 20 && dx < 0;
      if (horizontal && (atLeftEdge || atRightEdge)) {
        e.preventDefault();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    // Must be non-passive so preventDefault() actually blocks the gesture.
    window.addEventListener("touchmove", onTouchMove, { passive: false });

    // Belt-and-braces: also lock the CSS overscroll behavior on both <html>
    // and <body> — some browsers honor one, some the other. Applies to the
    // X and Y axes so both refresh directions and edge swipes are covered.
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    document.documentElement.style.overscrollBehavior = "none";
    document.body.style.overscrollBehavior = "none";

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
    };
  }, [active]);
}
