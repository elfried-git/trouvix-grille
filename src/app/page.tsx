"use client";

import { useGameStore } from "@/store/game-store";
import { HomeScreen } from "@/components/game/HomeScreen";
import { SetupScreen } from "@/components/game/SetupScreen";
import { GameScreen } from "@/components/game/GameScreen";
import { WinnerScreen } from "@/components/game/WinnerScreen";
import { OnlineRouter } from "@/components/game/OnlineRouter";
import { ReviewsScreen } from "@/components/game/ReviewsScreen";
import { BenchouAdminScreen } from "@/components/game/BenchouAdminScreen";

export default function Home() {
  const phase = useGameStore((s) => s.phase);

  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <main className="flex flex-1 flex-col">
        {phase === "home" && <HomeScreen />}
        {phase === "setup" && <SetupScreen />}
        {phase === "playing" && <GameScreen />}
        {phase === "gameover" && <WinnerScreen />}
        {(phase === "online-setup" || phase === "online-playing") && <OnlineRouter />}
        {phase === "avis" && <ReviewsScreen />}
        {phase === "benchou-admin" && <BenchouAdminScreen />}
      </main>
    </div>
  );
}