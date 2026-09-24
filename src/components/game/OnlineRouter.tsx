"use client";

import { useEffect } from "react";
import { useOnlineStore } from "@/store/online-store";
import { useGameStore } from "@/store/game-store";
import { OnlineSetupScreen } from "./OnlineSetupScreen";
import { OnlineGameScreen } from "./OnlineGameScreen";

export function OnlineRouter() {
  const state = useOnlineStore((s) => s.state);
  const kicked = useOnlineStore((s) => s.kicked);
  const kickedToOnline = useOnlineStore((s) => s.kickedToOnline);
  const clearKicked = useOnlineStore((s) => s.clearKicked);
  const backHome = useGameStore((s) => s.backHome);
  const goToOnlineSetup = useGameStore((s) => s.goToOnlineSetup);

  // Initialize socket ONCE on mount. Try reconnect only if we have saved data.
  useEffect(() => {
    const online = useOnlineStore.getState();
    online.init();
    // Only try reconnect if we have saved room/player — skip if user explicitly left
    try {
      const savedRoom = localStorage.getItem("trouvix_room");
      const savedPlayer = localStorage.getItem("trouvix_player");
      if (savedRoom && savedPlayer) {
        online.tryReconnect();
      }
    } catch {}
    return () => {
      // Don't teardown on unmount of router — only when explicitly leaving
    };
  }, []);

  // When kicked (host left / admin deleted) — show a brief message, then:
  // • if the host closed the room to start a NEW game, land on the ONLINE menu
  //   so the player can compose a fresh game from scratch;
  // • otherwise, go back to the home screen.
  useEffect(() => {
    if (kicked) {
      const id = setTimeout(() => {
        clearKicked();
        if (kickedToOnline) goToOnlineSetup();
        else backHome();
      }, 3500);
      return () => clearTimeout(id);
    }
  }, [kicked, kickedToOnline, clearKicked, backHome, goToOnlineSetup]);

  // If we have a server state and the phase is "playing" or "gameover", show the game screen.
  // Otherwise (lobby or no state), show the setup/lobby screen.
  if (state && (state.phase === "playing" || state.phase === "gameover")) {
    return <OnlineGameScreen />;
  }
  return <OnlineSetupScreen />;
}
