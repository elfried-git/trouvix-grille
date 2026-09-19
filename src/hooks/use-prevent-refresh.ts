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

    // 3) Block ONLY the overscroll bounce, never the in-game scroll itself.
    //    The game scrolls inside its own container (the layout gives the
    //    in-game <main> `overflow-y-auto`), so the browser page never scrolls.
    //    We therefore measure the REAL scrollable element under the finger
    //    rather than `window`, and only neutralise the gesture when it would
    //    carry that element PAST an edge — which is what browsers turn into
    //    pull-to-refresh in either direction.
    let touchStartX = 0;
    let touchStartY = 0;

    // Walk up from the touched node to the first element that can actually
    // scroll vertically. Falls back to the document element (browser page).
    const findScrollable = (node: EventTarget | null): HTMLElement => {
      let el = node instanceof Element ? (node as HTMLElement) : null;
      while (el && el !== document.body && el !== document.documentElement) {
        const style = window.getComputedStyle(el);
        const canScrollY =
          /(auto|scroll|overlay)/.test(style.overflowY) &&
          el.scrollHeight > el.clientHeight;
        if (canScrollY) return el;
        el = el.parentElement;
      }
      return document.documentElement;
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0]?.clientX ?? 0;
      touchStartY = e.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      const x = e.touches[0]?.clientX ?? 0;
      const y = e.touches[0]?.clientY ?? 0;
      const dx = x - touchStartX;
      const dy = y - touchStartY;

      const vertical = Math.abs(dy) > Math.abs(dx);
      if (vertical) {
        const scroller = findScrollable(e.target);
        const isDoc = scroller === document.documentElement;
        const viewport = isDoc
          ? window.innerHeight
          : scroller.clientHeight;
        const scrollTop = isDoc ? window.scrollY : scroller.scrollTop;
        const maxScroll = scroller.scrollHeight - viewport;

        // Not scrollable at all: the whole area is an overscroll zone, so any
        // vertical drag is a refresh candidate → block in both directions.
        if (maxScroll <= 1) {
          e.preventDefault();
          return;
        }

        const atTop = scrollTop <= 0;
        const atBottom = scrollTop >= maxScroll - 1;
        const pullingDown = dy > 0;
        const pullingUp = dy < 0;

        // Block ONLY when the gesture would go PAST an edge:
        //  - at the very top, dragging further down (or the reversed drag up on
        //    some OEM skins) would overscroll;
        //  - at the very bottom, dragging further up (or the reversed drag
        //    down) would overscroll.
        const overscrollsTop = atTop && (pullingDown || pullingUp);
        const overscrollsBottom = atBottom && (pullingUp || pullingDown);
        if (overscrollsTop || overscrollsBottom) {
          e.preventDefault();
          return;
        }
        // Otherwise we are mid-scroll inside the game → let the scroll happen.
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
