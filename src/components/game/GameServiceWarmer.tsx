"use client";

import { useEffect } from "react";
import { getSocket, wakeGameService } from "@/lib/socket";
import { useOnlineStore } from "@/store/online-store";

/**
 * Warm up the game-service as early as possible.
 *
 * Mounted once at the top of the app (see app/page.tsx), BEFORE the user ever
 * reaches the "en ligne" screen. It:
 *   1. fires an HTTP GET to /health (wakes a sleeping host such as Railway's
 *      free plan while the rest of the page is still loading), and
 *   2. opens the Socket.IO connection immediately.
 *
 * Result: by the time the player opens the online menu, the "En ligne" badge
 * is already green instead of waiting for a cold start.
 */
export function GameServiceWarmer() {
  useEffect(() => {
    // Wake the server over HTTP (no-op in local dev where there's no cold start).
    wakeGameService();
    // Open the socket now and attach the store listeners so the connection is
    // established and the "connected" state is already true.
    getSocket();
    useOnlineStore.getState().init();

    // If the socket is closed later (e.g. the player leaves the online screen,
    // which calls teardown()), re-open it and re-warm the server so the next
    // visit to the online menu is instant too. Poll cheaply on visibility.
    const rearm = () => {
      if (document.visibilityState !== "visible") return;
      const online = useOnlineStore.getState();
      if (online.connected) return;
      wakeGameService();
      online.init();
    };
    document.addEventListener("visibilitychange", rearm);
    return () => document.removeEventListener("visibilitychange", rearm);
  }, []);

  return null;
}