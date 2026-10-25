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
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 18 }}
          className="relative z-10 flex w-full flex-col items-center text-center"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-6xl shadow-[0_0_50px_-5px_rgba(139,92,246,0.6)]"
          >
            ⚖️
          </motion.div>

          <p className="mt-6 font-display text-base uppercase tracking-[0.3em] text-violet-200/80">Égalité parfaite</p>
          <h1 className="mt-2 font-display text-5xl font-black text-violet-200 sm:text-6xl">{maxScore} pts</h1>
          <p className="mt-3 text-lg leading-relaxed text-muted-foreground">{tiedPlayers.length} joueurs sont à égalité. Un challenge décisif va les départager.</p>

          <div className="mt-8 w-full max-w-md">
            <p className="mb-2 font-display text-base uppercase tracking-widest text-violet-300/80">En lice pour le challenge</p>
            <div className="flex flex-col gap-2">
              {tiedPlayers.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  style={{ background: `linear-gradient(#1b111c, #1b111c) padding-box, linear-gradient(110deg, ${p.color}, ${p.color}45 65%, #ffffff22) border-box`, boxShadow: `0 0 22px ${p.color}35` }}
                  className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-transparent p-4 shadow-xl"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ backgroundColor: `${p.color}66` }}>{i + 1}</span>
                  <div className="rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, #fff, ${p.color})` }}><Avatar avatar={p.emoji} color={p.color} size={48} emojiSize="text-2xl" ring={false} /></div>
                  <span className="flex-1 text-left text-lg font-bold text-white">{p.name}</span>
                  <span className="rounded-xl px-3 py-1 font-display text-xl font-black text-white sm:text-lg" style={{ backgroundColor: `${p.color}33` }}>{p.score} pts</span>
                </motion.div>
              ))}
            </div>
          </div>

          {ranked.filter((p) => p.score < maxScore).length > 0 && (
            <div className="mt-4 w-full max-w-md">
              <p className="mb-2 font-display text-base uppercase tracking-widest text-muted-foreground/60">Éliminés</p>
              <div className="flex flex-col gap-2">
                {ranked.filter((p) => p.score < maxScore).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/20 p-3 opacity-40">
                    <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                    <span className="flex-1 text-left text-base font-medium line-through">{p.name}</span>
                    <span className="font-display text-xl font-bold">{p.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={rematchTied} size="lg" className="h-14 px-7 text-lg bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400">
              <Swords className="mr-2 h-6 w-6" /> Lancer le challenge decisif
            </Button>
            <Button onClick={restart} size="lg" className="h-14 px-7 text-lg bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400">
              <RotateCcw className="mr-2 h-6 w-6" /> Rejouer
            </Button>
            <Button onClick={backHome} size="lg" variant="outline" className="h-14 px-7 text-lg">
              <Home className="mr-2 h-6 w-6" /> Accueil
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
