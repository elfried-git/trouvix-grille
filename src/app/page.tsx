"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/game-store";
import { HomeScreen } from "@/components/game/HomeScreen";
import { SetupScreen } from "@/components/game/SetupScreen";
import { GameScreen } from "@/components/game/GameScreen";
import { WinnerScreen } from "@/components/game/WinnerScreen";
import { OnlineRouter } from "@/components/game/OnlineRouter";
import { ReviewsScreen } from "@/components/game/ReviewsScreen";
import { GiftScreen } from "@/components/game/GiftScreen";
import { GameServiceWarmer } from "@/components/game/GameServiceWarmer";
import { usePreventRefresh } from "@/hooks/use-prevent-refresh";

export default function Home() {
  const phase = useGameStore((s) => s.phase);
  const goToOnlineSetup = useGameStore((s) => s.goToOnlineSetup);
  const goToGift = useGameStore((s) => s.goToGift);

  // A shared ?salon=CODE URL opens the online lobby flow directly.
  useEffect(() => {
    const url = new URL(window.location.href);
    const roomCode = url.searchParams.get("salon")?.trim().toUpperCase();
    if (!roomCode || !/^[A-Z0-9]{4,8}$/.test(roomCode)) return;

    sessionStorage.setItem("trouvix_invite_room", roomCode);
    sessionStorage.setItem("trouvix_invite_pending", "1");
    url.searchParams.delete("salon");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    goToOnlineSetup();
  }, [goToOnlineSetup]);

  // Un lien ?cadeau=CODE ouvre directement l'espace Cadeau Noël.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("cadeau")) goToGift();
  }, [goToGift]);

  // In-game (composition + grid), both offline and online: block page refresh
  // so a stray F5 / pull-to-refresh can't wipe the match or eject a player.
  const lockedInGame =
    phase === "setup" ||
    phase === "playing" ||
    phase === "online-setup" ||
    phase === "online-playing";
  usePreventRefresh(lockedInGame);

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden">
      {/* Start waking + connecting to the game-service as soon as the app opens,
          so the online status is ready before the player reaches the menu. */}
      <GameServiceWarmer />
      <main
        className={`flex flex-1 flex-col ${
          // In-game screens scroll INSIDE the app, never the browser page.
          // The page itself is locked to the viewport height, so scrolling
          // can't spill over into a browser-level pull-to-refresh.
          lockedInGame
            ? "min-h-0 overflow-y-auto scroll-romantic overscroll-none"
            : "min-h-0 overflow-y-auto scroll-romantic"
        }`}
      >
        {phase === "home" && <HomeScreen />}
        {phase === "setup" && <SetupScreen />}
        {phase === "playing" && <GameScreen />}
        {phase === "gameover" && <WinnerScreen />}
        {(phase === "online-setup" || phase === "online-playing") && <OnlineRouter />}
        {phase === "reviews" && <ReviewsScreen />}
        {phase === "gift" && <GiftScreen />}
      </main>
    </div>
  );
}
