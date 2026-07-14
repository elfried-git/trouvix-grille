"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Grid } from "./Grid";
import { PlayerPanel } from "./PlayerPanel";
import { Avatar } from "./Avatar";
import { useGameStore, GAME_CONSTANTS } from "@/store/game-store";
import { findBestMove } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Flag, Home, Timer, Target, ScrollText, Square, Pause, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function GameScreen() {
  const players = useGameStore((s) => s.players);
  const grid = useGameStore((s) => s.grid);
  const phase = useGameStore((s) => s.phase);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const turnTimeLeft = useGameStore((s) => s.turnTimeLeft);
  const statusMessage = useGameStore((s) => s.statusMessage);
  const resolving = useGameStore((s) => s.resolving);
  const isPaused = useGameStore((s) => s.isPaused);
  const lastSquareCells = useGameStore((s) => s.lastSquareCells);
  const lastSquareerId = useGameStore((s) => s.lastSquareerId);
  const formedSquares = useGameStore((s) => s.formedSquares);
  const togglePause = useGameStore((s) => s.togglePause);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const currentRound = useGameStore((s) => s.currentRound);
  const lastDelta = useGameStore((s) => s.lastDelta);
  const tick = useGameStore((s) => s.tick);
  const endGameNow = useGameStore((s) => s.endGameNow);
  const backHome = useGameStore((s) => s.backHome);

  const current = players[currentPlayerIndex];

  // 10-second turn timer (ticks every 100ms, paused automatically via store)
  useEffect(() => {
    const id = setInterval(() => tick(0.1), 100);
    return () => clearInterval(id);
  }, [tick]);

  // === AI auto-play ===
  // When it's an AI's turn (and not resolving/paused), compute its move and play it.
  const placePawn = useGameStore((s) => s.placePawn);
  useEffect(() => {
    if (
      phase !== "playing" ||
      resolving ||
      isPaused ||
      !current ||
      !current.isAI
    )
      return;
    // Small delay for realism (let the player see the turn change)
    const id = setTimeout(() => {
      // Re-check conditions after the timeout (state may have changed)
      const s = useGameStore.getState();
      if (
        s.phase !== "playing" ||
        s.resolving ||
        s.isPaused ||
        s.players[s.currentPlayerIndex]?.id !== current.id
      )
        return;
      const aiPlayer = s.players[s.currentPlayerIndex];
      if (!aiPlayer?.isAI) return;
      const opponentIds = s.players
        .filter((p) => p.id !== aiPlayer.id)
        .map((p) => p.id);
      const move = findBestMove(s.grid, aiPlayer.id, opponentIds);
      if (move) {
        s.placePawn(move.row, move.col);
      }
    }, 900);
    return () => clearTimeout(id);
  }, [currentPlayerIndex, resolving, isPaused, phase, current, grid, placePawn]);

  const timePct = Math.max(
    0,
    Math.min(100, (turnTimeLeft / GAME_CONSTANTS.TURN_SECONDS) * 100)
  );
  const urgent = turnTimeLeft <= 3 && !resolving && !isPaused;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-black sm:text-2xl">
            <span className="text-red-gradient">Trouv</span>
            <span className="text-gold-gradient">ix</span>
          </span>
          <span className="hidden text-xs uppercase tracking-widest text-amber-200/60 sm:inline">
            Carré
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/5 px-3 py-1.5 text-sm text-amber-200/90 sm:text-xs">
            <Square className="h-3.5 w-3.5" />
            Carré {currentRound}/{totalRounds}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/5 px-3 py-1.5 text-sm text-rose-200/90 sm:text-xs">
            <Target className="h-3.5 w-3.5" />
            Carré = +1
          </div>
          {/* Pause / Resume button */}
          <Button
            variant="outline"
            size="sm"
            onClick={togglePause}
            disabled={resolving}
            className={`h-10 gap-1.5 sm:h-8 ${
              isPaused
                ? "border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10"
                : "border-amber-400/40 text-amber-200 hover:bg-amber-500/10"
            }`}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            <span className="hidden sm:inline">{isPaused ? "Reprendre" : "Pause"}</span>
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-1.5 sm:h-8">
                <ScrollText className="h-4 w-4" />
                <span className="hidden sm:inline">Règles</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto scroll-romantic">
              <DialogHeader>
                <DialogTitle className="font-display text-2xl text-gold-gradient">
                  Règles du jeu
                </DialogTitle>
              </DialogHeader>
              <RulesContent totalRounds={totalRounds} />
            </DialogContent>
          </Dialog>
          <Button
            variant="outline"
            size="sm"
            onClick={endGameNow}
            className="h-10 gap-1.5 border-rose-400/40 text-rose-200 hover:bg-rose-500/10 sm:h-8"
          >
            <Flag className="h-4 w-4" />
            <span className="hidden sm:inline">Terminer</span>
          </Button>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Grid + timer + status */}
        <div className="flex flex-col gap-4">
          {/* Timer bar */}
          <div className="glass-card rounded-2xl p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar
                  avatar={current?.emoji ?? "❓"}
                  color={current?.color ?? "#52525b"}
                  size={44}
                  emojiSize="text-xl"
                />
                <div>
                  <p className="text-xs text-muted-foreground sm:text-[11px]">Tour de</p>
                  <p className="font-display text-base font-bold leading-tight">
                    {current?.name}
                  </p>
                </div>
              </div>
              <div
                className={`flex items-center gap-1.5 font-display text-3xl font-black tabular-nums sm:text-2xl ${
                  isPaused
                    ? "text-emerald-300"
                    : urgent
                      ? "text-rose-400"
                      : "text-amber-200"
                }`}
              >
                {isPaused ? (
                  <>
                    <Pause className="h-5 w-5" /> Pause
                  </>
                ) : (
                  <>
                    <Timer className={`h-5 w-5 ${urgent ? "animate-pulse" : ""}`} />
                    {turnTimeLeft.toFixed(1)}s
                  </>
                )}
              </div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: urgent
                    ? "linear-gradient(90deg, #f43f5e, #f59e0b)"
                    : `linear-gradient(90deg, ${current?.color ?? "#f59e0b"}, #fbbf24)`,
                }}
                animate={{ width: isPaused ? `${timePct}%` : `${timePct}%` }}
                transition={{ duration: 0.1, ease: "linear" }}
              />
            </div>
          </div>

          {/* Squares formed — per-player counter badges */}
          {formedSquares.length > 0 && !resolving && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {players.map((p) => {
                const count = formedSquares.filter((sq) => sq.playerId === p.id).length;
                if (count === 0) return null;
                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold"
                    style={{
                      borderColor: `${p.color}80`,
                      backgroundColor: `${p.color}15`,
                    }}
                  >
                    <Avatar avatar={p.emoji} color={p.color} size={20} emojiSize="text-xs" />
                    <span style={{ color: p.color }}>{p.name}</span>
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-black text-white"
                      style={{ backgroundColor: p.color }}
                    >
                      {count}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* The board */}
          <Grid
            players={players}
            currentPlayerId={current?.id ?? null}
            isPaused={isPaused}
          />
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          <PlayerPanel
            players={players}
            currentPlayerId={current?.id ?? null}
            lastDelta={lastDelta}
            grid={grid}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={backHome}
            className="text-muted-foreground hover:text-foreground"
          >
            <Home className="mr-1.5 h-4 w-4" /> Quitter la partie
          </Button>
        </div>
      </div>
    </div>
  );
}

function RulesContent({ totalRounds }: { totalRounds: number }) {
  return (
    <div className="space-y-4 text-sm text-muted-foreground">
      <section>
        <h3 className="font-display text-base font-semibold text-foreground">Le but</h3>
        <p className="mt-1">
          Place tes pions <span className="font-semibold text-amber-200">où tu le souhaites</span> dans
          la grille. Forme un <span className="font-semibold text-amber-200">carré de 4 pions</span> de
          ta couleur (un bloc 2×2) pour marquer 1 point. Les pions <span className="font-semibold text-amber-200">restent dans la grille</span> jusqu'à la fin du match — chaque carré formé reste visible. À la fin des {totalRounds} carrés, le joueur
          avec le plus de points devient le Champion Ultime.
        </p>
      </section>
      <section>
        <h3 className="font-display text-base font-semibold text-foreground">
          Placement libre
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Clique sur n'importe quelle case vide de la grille.</li>
          <li>Contrairement à un Puissance 4, le pion ne tombe pas : il reste où tu le poses.</li>
          <li>Stratégie : occupe l'espace, bloque l'adversaire, construis ton carré.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-display text-base font-semibold text-foreground">
          Le chrono (10 s)
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Tu as <span className="font-semibold text-rose-200">10 secondes</span> pour jouer.
          </li>
          <li>Si le chrono expire, tu perds la main et le tour passe au joueur suivant.</li>
          <li>
            Bouton <span className="font-semibold text-amber-200">⏸️ Pause</span> : mets la partie en
            pause à tout moment (le chrono est gelé).
          </li>
        </ul>
      </section>
      <section>
        <h3 className="font-display text-base font-semibold text-foreground">
          Le carré (2×2)
        </h3>
        <p className="mt-1">
          Un carré est formé de 4 pions de ta couleur disposés en bloc 2 lignes × 2 colonnes, côte à
          côte. Dès que tu complètes un carré, tu marques 1 point.
        </p>
        <div className="mt-2 inline-flex flex-col gap-0.5 rounded-lg bg-muted/40 p-2">
          {[0, 1].map((r) => (
            <div key={r} className="flex gap-0.5">
              {[0, 1].map((c) => (
                <span
                  key={c}
                  className="h-5 w-5 rounded-full bg-rose-500 ring-1 ring-white/40"
                />
              ))}
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs italic">Exemple de carré gagnant.</p>
      </section>
      <section>
        <h3 className="font-display text-base font-semibold text-foreground">
          Fin de partie
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Les {totalRounds} carrés sont formés, ou</li>
          <li>La grille est pleine, ou</li>
          <li>Un joueur appuie sur « Terminer ».</li>
          <li>Le joueur au meilleur score devient le Champion Ultime.</li>
        </ul>
      </section>
    </div>
  );
}