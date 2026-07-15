"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { Crown, RotateCcw, Home, Trophy, Sparkles, Brain, Star, Swords } from "lucide-react";

const PERKS = [
  { icon: Brain, label: "Tu choisis la catégorie de la prochaine manche" },
  { icon: Star, label: "Tu relances en premier à la prochaine partie" },
  { icon: Trophy, label: "Tu portes fièrement le titre pour la soirée" },
];

export function WinnerScreen() {
  const players = useGameStore((s) => s.players);
  const winnerId = useGameStore((s) => s.winnerId);
  const endReason = useGameStore((s) => s.endReason);
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
          {/* End-reason banner (stalemate / board-full) */}
          {endReason && endReason !== "rounds" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-200"
            >
              {endReason === "stalemate" ? (
                <>🚫 Plus aucun carré possible — la partie s'arrête ici.</>
              ) : endReason === "board-full" ? (
                <>🟦 Plateau plein — la partie s'arrête ici.</>
              ) : null}
            </motion.div>
          )}
          {/* Tie icon */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-6xl shadow-[0_0_50px_-5px_oklch(0.60_0.20_300/0.6)] sm:h-28 sm:w-28"
          >
            ⚖️
          </motion.div>

          <p className="mt-6 font-display text-sm uppercase tracking-[0.3em] text-violet-200/80">
            Égalité parfaite
          </p>
          <h1 className="mt-2 font-display text-5xl font-black text-violet-200 sm:text-6xl">
            {maxScore} pts
          </h1>
          <p className="mt-3 text-base text-muted-foreground">
            {tiedPlayers.length} joueurs sont à égalité. Un challenge décisif va les départager.
          </p>

          {/* Tied players highlighted */}
          <div className="mt-8 w-full max-w-md">
            <p className="mb-2 font-display text-xs uppercase tracking-widest text-violet-300/80">
              En lice pour le challenge
            </p>
            <div className="flex flex-col gap-2">
              {tiedPlayers.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3 rounded-xl border-2 border-violet-400/50 bg-violet-500/10 p-4 shadow-[0_0_20px_-5px_oklch(0.60_0.20_300/0.4)] sm:p-3"
                >
                  <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                  <span className="flex-1 text-left font-bold text-violet-100">{p.name}</span>
                  <span className="font-display text-2xl font-bold text-violet-200 sm:text-xl">{p.score} pts</span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Eliminated players (grayed out) */}
          {ranked.filter((p) => p.score < maxScore).length > 0 && (
            <div className="mt-4 w-full max-w-md">
              <p className="mb-2 font-display text-xs uppercase tracking-widest text-muted-foreground/60">
                Éliminés
              </p>
              <div className="flex flex-col gap-2">
                {ranked.filter((p) => p.score < maxScore).map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/20 p-3 opacity-40"
                  >
                    <Avatar avatar={p.emoji} color={p.color} size={36} emojiSize="text-lg" />
                    <span className="flex-1 text-left font-medium line-through">{p.name}</span>
                    <span className="font-display text-lg font-bold">{p.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Challenge decisive button */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={rematchTied}
              size="lg"
              className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400"
            >
              <Swords className="mr-2 h-5 w-5" />
              Lancer le challenge décisif
            </Button>
            <Button onClick={backHome} size="lg" variant="outline">
              <Home className="mr-2 h-5 w-5" />
              Accueil
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Seuls les joueurs à égalité participent au challenge. Le premier à avoir plus de points gagne.
          </p>
        </motion.div>
      </div>
    );
  }

  // === SINGLE WINNER SCREEN ===
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10">
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-3xl"
            style={{ left: `${5 + i * 7}%` }}
            initial={{ y: -50, opacity: 0, rotate: 0 }}
            animate={{ y: "110vh", opacity: [0, 1, 1, 0], rotate: 360 }}
            transition={{ duration: 6 + (i % 4), repeat: Infinity, delay: i * 0.4 }}
          >
            {["🏆", "⭐", "✨", "👑", "🎉"][i % 5]}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 18 }}
        className="relative z-10 flex w-full flex-col items-center text-center"
      >
        {/* End-reason banner (stalemate / board-full) */}
        {endReason && endReason !== "rounds" && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200"
          >
            {endReason === "stalemate" ? (
              <>🚫 Plus aucun carré possible — la partie s'arrête ici.</>
            ) : endReason === "board-full" ? (
              <>🟦 Plateau plein — la partie s'arrête ici.</>
            ) : null}
          </motion.div>
        )}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-6xl shadow-[0_0_50px_-5px_oklch(0.80_0.14_84/0.7)] sm:h-28 sm:w-28"
        >
          <Avatar
            avatar={winner!.emoji}
            color={winner!.color}
            size={96}
            emojiSize="text-5xl"
            ring={false}
            className="ring-4 ring-white/40"
          />
        </motion.div>

        <p className="mt-6 font-display text-sm uppercase tracking-[0.3em] text-amber-200/80">
          Le Champion Ultime
        </p>
        <h1 className="mt-2 font-display text-5xl font-black text-gold-gradient sm:text-6xl">
          {winner!.name}
        </h1>
        <p className="mt-3 flex items-center gap-2 text-amber-200/80">
          <Crown className="h-5 w-5 text-amber-300" />
          avec {winner!.score} points
        </p>

        {/* Legendary card */}
        <motion.div
          initial={{ rotate: -3, opacity: 0 }}
          animate={{ rotate: -3, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 w-full max-w-md -rotate-3 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-br from-amber-950/60 to-black/60 p-6 shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-amber-400/30 pb-2">
            <span className="font-display text-xs uppercase tracking-widest text-amber-300">
              Carte Légendaire
            </span>
            <span className="text-2xl">🏆</span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-amber-100">
            Champion Ultime
          </p>
          <p className="mt-1 text-sm text-amber-100/70">
            Privilèges honorifiques :
          </p>
          <div className="mt-4 flex flex-col gap-2">
            {PERKS.map((perk) => (
              <div
                key={perk.label}
                className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
              >
                <perk.icon className="h-4 w-4 text-amber-300" />
                {perk.label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Ranking */}
        <div className="mt-8 w-full max-w-md">
          <p className="mb-2 font-display text-xs uppercase tracking-widest text-muted-foreground">
            Classement
          </p>
          <div className="flex flex-col gap-2">
            {ranked.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border p-4 sm:p-3 ${
                  p.id === winner!.id
                    ? "border-amber-400/50 bg-amber-500/10"
                    : "border-border/50 bg-card/40"
                }`}
              >
                <span className="w-6 text-center font-display text-lg font-bold text-amber-200">
                  {i + 1}
                </span>
                <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                <span className="flex-1 text-left font-medium">{p.name}</span>
                <span className="font-display text-2xl font-bold sm:text-xl">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={restart}
            size="lg"
            className="bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            Rejouer
          </Button>
          <Button onClick={backHome} size="lg" variant="outline">
            <Home className="mr-2 h-5 w-5" />
            Accueil
          </Button>
        </div>

        <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-amber-400" />
          Merci d'avoir joué à Trouvix — Le Jeu du Carré
        </p>
      </motion.div>
    </div>
  );
}