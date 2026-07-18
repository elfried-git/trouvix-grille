"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { Crown, RotateCcw, Home, Trophy, Sparkles, Brain, Star, Swords } from "lucide-react";

const PERKS = [
  { icon: Brain, label: "Tu choisis la categorie de la prochaine manche" },
  { icon: Star, label: "Tu relances en premier a la prochaine partie" },
  { icon: Trophy, label: "Tu portes fièrement le titre pour la soiree" },
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
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-6xl shadow-[0_0_50px_-5px_rgba(139,92,246,0.6)] sm:h-28 sm:w-28"
          >
            ⚖️
          </motion.div>

          <p className="mt-6 font-display text-sm uppercase tracking-[0.3em] text-violet-200/80">Egalite parfaite</p>
          <h1 className="mt-2 font-display text-5xl font-black text-violet-200 sm:text-6xl">{maxScore} pts</h1>
          <p className="mt-3 text-base text-muted-foreground">{tiedPlayers.length} joueurs sont a egalite. Un challenge decisif va les departager.</p>

          <div className="mt-8 w-full max-w-md">
            <p className="mb-2 font-display text-xs uppercase tracking-widest text-violet-300/80">En lice pour le challenge</p>
            <div className="flex flex-col gap-2">
              {tiedPlayers.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.1 }}
                  className="flex items-center gap-3 rounded-xl border-2 border-violet-400/50 bg-violet-500/10 p-4 shadow-[0_0_20px_-5px_rgba(139,92,246,0.4)] sm:p-3"
                >
                  <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                  <span className="flex-1 text-left font-bold text-violet-100">{p.name}</span>
                  <span className="font-display text-2xl font-bold text-violet-200 sm:text-xl">{p.score} pts</span>
                </motion.div>
              ))}
            </div>
          </div>

          {ranked.filter((p) => p.score < maxScore).length > 0 && (
            <div className="mt-4 w-full max-w-md">
              <p className="mb-2 font-display text-xs uppercase tracking-widest text-muted-foreground/60">Elimines</p>
              <div className="flex flex-col gap-2">
                {ranked.filter((p) => p.score < maxScore).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border/30 bg-card/20 p-3 opacity-40">
                    <Avatar avatar={p.emoji} color={p.color} size={36} emojiSize="text-lg" />
                    <span className="flex-1 text-left font-medium line-through">{p.name}</span>
                    <span className="font-display text-lg font-bold">{p.score} pts</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={rematchTied} size="lg" className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400">
              <Swords className="mr-2 h-5 w-5" /> Lancer le challenge decisif
            </Button>
            <Button onClick={backHome} size="lg" variant="outline">
              <Home className="mr-2 h-5 w-5" /> Accueil
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">Seuls les joueurs a egalite participent au challenge. Le premier a avoir plus de points gagne.</p>
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
            {['🏆', '⭐', '✨', '👑', '🎉'][i % 5]}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 150, damping: 18 }}
        className="relative z-10 flex w-full flex-col items-center text-center"
      >
        <div className="mb-6 flex w-full justify-center">
          <div className="relative flex w-full max-w-3xl items-center justify-center">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-amber-400/10 via-rose-400/6 to-violet-400/6 blur-3xl opacity-80 animate-pulse" />
            <div className="relative z-10 flex w-full flex-col items-center gap-3 rounded-2xl p-6">
              <div className="rounded-full bg-white/5 p-1 shadow-xl">
                <Avatar avatar={winner!.emoji} color={winner!.color} size={120} emojiSize="text-6xl" ring={true} className="ring-8 ring-white/20" />
              </div>
              <div className="mt-3 flex flex-col items-center">
                <div className="flex items-center gap-3">
                  <h1 className="font-display text-4xl sm:text-5xl font-black text-gold-gradient drop-shadow-lg">{winner!.name}</h1>
                  <span className="rounded-full bg-amber-400/20 px-3 py-1 text-sm font-semibold text-amber-100">Champion</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-amber-200">
                  <Crown className="h-6 w-6 text-amber-300 drop-shadow" />
                  <span className="text-lg font-bold">{winner!.score} pts</span>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <Button onClick={restart} size="lg" className="bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400">
                  <RotateCcw className="mr-2 h-5 w-5" /> Rejouer
                </Button>
                <Button onClick={backHome} size="lg" variant="outline">
                  <Home className="mr-2 h-5 w-5" /> Accueil
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Ranking */}
        <div className="mt-8 w-full max-w-md">
          <p className="mb-2 font-display text-xs uppercase tracking-widest text-muted-foreground">Classement</p>
          <div className="flex flex-col gap-2">
            {ranked.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-xl border p-4 sm:p-3 ${
                  p.id === winner!.id
                    ? "border-amber-400/60 bg-gradient-to-br from-amber-500/10 to-rose-500/5 shadow-lg"
                    : "border-border/50 bg-card/40"
                }`}
              >
                <span className="w-6 text-center font-display text-lg font-bold text-amber-200">{i + 1}</span>
                {p.id === winner!.id ? (
                  <div className="flex items-center gap-3">
                    <Avatar avatar={p.emoji} color={p.color} size={64} emojiSize="text-3xl" />
                    <div>
                      <span className="flex-1 text-left font-bold text-amber-100 text-lg">{p.name}</span>
                      <div className="mt-1 text-sm text-amber-200/90 font-display font-black">{p.score} pts</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                    <span className="flex-1 text-left font-medium">{p.name}</span>
                    <span className="font-display text-2xl font-bold sm:text-xl">{p.score} pts</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-amber-400" /> Merci d'avoir joue a Trouvix - Le Jeu du Carre
        </p>
      </motion.div>
    </div>
  );
}
