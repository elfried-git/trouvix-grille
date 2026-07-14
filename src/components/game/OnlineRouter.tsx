"use client";

import { useEffect, useRef } from "react";
import { useOnlineStore } from "@/store/online-store";
import { useGameStore } from "@/store/game-store";
import { OnlineSetupScreen } from "./OnlineSetupScreen";
import { OnlineGameScreen } from "./OnlineGameScreen";

export function OnlineRouter() {
  const state = useOnlineStore((s) => s.state);
  const roomCode = useOnlineStore((s) => s.roomCode);
  const backHome = useGameStore((s) => s.backHome);
  const hadRoomRef = useRef(false);

  useEffect(() => {
    const online = useOnlineStore.getState();
    online.init();
    try {
      const savedRoom = localStorage.getItem("trouvix_room");
      const savedPlayer = localStorage.getItem("trouvix_player");
      if (savedRoom && savedPlayer) {
        online.tryReconnect();
      }
    } catch {}
    return () => {};
  }, []);

  useEffect(() => {
    if (roomCode) {
      hadRoomRef.current = true;
    } else if (hadRoomRef.current && !state) {
      hadRoomRef.current = false;
      backHome();
    }
  }, [roomCode, state, backHome]);

  if (state && (state.phase === "playing" || state.phase === "gameover")) {
    return <OnlineGameScreen />;
  }
  return <OnlineSetupScreen />;
}