"use client";

import { useGameStore } from "@/store/game-store";
import { HomeScreen } from "@/components/game/HomeScreen";
import { SetupScreen } from "@/components/game/SetupScreen";
import { GameScreen } from "@/components/game/GameScreen";
import { WinnerScreen } from "@/components/game/WinnerScreen";
import { OnlineRouter } from "@/components/game/OnlineRouter";
import { ReviewsScreen } from "@/components/game/ReviewsScreen";
import { usePreventRefresh } from "@/hooks/use-prevent-refresh";

export default function Home() {
  const phase = useGameStore((s) => s.phase);

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
      </main>
    </div>
  );
}
