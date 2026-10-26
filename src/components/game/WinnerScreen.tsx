"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { RotateCcw, Home, Swords } from "lucide-react";
import { ResultRanking, WinnerHero } from "./GameResultPresentation";

export function WinnerScreen() {
  const players = useGameStore((s) => s.players);
  const restart = useGameStore((s) => s.restart);
  const backHome = useGameStore((s) => s.backHome);
  const rematchTied = useGameStore((s) => s.rematchTied);

  const ranked = [...players].sort((a, b) => b.score - a.score);
  const maxScore = ranked.length > 0 ? ranked[0].score : 0;
  const tiedPlayers = ranked.filter((p) => p.score === maxScore);
  const isTie = tiedPlayers.length > 1;
  const winner = !isTie ? ranked[0] : null;

  if (ranked.length === 0) return null;

  // === TIE SCREEN ===
  if (isTie) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 18 }}
          className="relative z-10 flex w-full flex-col items-center text-center"
        >
          <motion.div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-3xl shadow-[0_0_30px_-5px_rgba(139,92,246,0.6)]"
          >
            ⚖️
          </motion.div>

          <p className="mt-3 font-display text-sm uppercase tracking-[0.2em] text-violet-200/80">Égalité</p>
          <h1 className="mt-1 font-display text-4xl font-black text-violet-200 sm:text-5xl">{maxScore} pts</h1>
          <p className="mt-1 text-sm text-muted-foreground">{tiedPlayers.length} joueurs à départager</p>

          <div className="mt-4 w-full max-w-md">
            <div className="flex flex-col gap-2">
              {tiedPlayers.map((p) => (
                <motion.div
                  key={p.id}
                  style={{ background: `linear-gradient(#1b111c, #1b111c) padding-box, linear-gradient(110deg, ${p.color}, ${p.color}45 65%, #ffffff22) border-box`, boxShadow: `0 0 22px ${p.color}35` }}
                  className="flex min-h-14 items-center gap-3 rounded-2xl border-2 border-transparent px-3 py-2 shadow-xl"
                >
                  <div className="rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, #fff, ${p.color})` }}><Avatar avatar={p.emoji} color={p.color} size={40} emojiSize="text-xl" ring={false} /></div>
                  <span className="flex-1 text-left text-lg font-bold text-white">{p.name}</span>
                  <span className="rounded-xl px-3 py-1 font-display text-base font-black text-white" style={{ backgroundColor: `${p.color}33` }}>{p.score} pts</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={rematchTied} size="lg" className="h-12 px-5 text-base bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400">
              <Swords className="mr-2 h-5 w-5" /> Départager
            </Button>
            <Button onClick={restart} size="lg" className="h-12 px-5 text-base bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400">
              <RotateCcw className="mr-2 h-5 w-5" /> Rejouer
            </Button>
            <Button onClick={backHome} size="lg" variant="outline" className="h-12 px-5 text-base">
              <Home className="mr-2 h-5 w-5" /> Accueil
            </Button>
          </div>

        </motion.div>
      </div>
    );
  }

  // === SINGLE WINNER SCREEN ===
  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-6 sm:justify-center sm:py-10">
      <div className="pointer-events-none absolute left-[12%] top-10 text-2xl text-amber-300/70">✦</div>
      <div className="pointer-events-none absolute right-[12%] top-24 text-lg text-rose-300/70">✧</div>
      <WinnerHero winner={winner!} />
      <ResultRanking players={ranked} winnerId={winner!.id} />
      <div className="mt-6 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center">
        <Button
          onClick={restart}
          size="lg"
          className="h-14 w-full rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-7 text-lg text-white shadow-[0_10px_28px_-12px_rgba(244,63,94,0.75)] transition hover:-translate-y-0.5 hover:from-rose-500 hover:to-rose-400 sm:w-auto"
        >
          <RotateCcw className="mr-2 h-6 w-6" /> Rejouer
        </Button>
        <Button
          onClick={backHome}
          size="lg"
          variant="outline"
          className="h-14 w-full rounded-xl border-white/15 bg-white/[0.03] px-6 text-lg hover:bg-white/[0.08] sm:w-auto"
        >
          <Home className="mr-2 h-6 w-6" /> Accueil
        </Button>
      </div>
      <p className="mt-5 text-base text-muted-foreground">
        Bien joué ! Une autre manche ?
      </p>
    </div>
  );
}
