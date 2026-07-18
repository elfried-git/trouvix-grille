"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useOnlineStore } from "@/store/online-store";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { Button } from "@/components/ui/button";
import { findBestMove } from "@/lib/ai";
import { Flag, Home, Timer, Square, Target, Pause, Play, Crown, WifiOff, Swords } from "lucide-react";

// ===== Reaction emojis =====
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🔥", "👏", "💪", "💔", "😭", "😡"];

const ROWS = 10;
const COLS = 10;

export function OnlineGameScreen() {
  const state = useOnlineStore((s) => s.state);
  const myId = useOnlineStore((s) => s.myPlayerId);
  const placePawnAction = useOnlineStore((s) => s.placePawn);
  const togglePauseAction = useOnlineStore((s) => s.togglePause);
  const endGameAction = useOnlineStore((s) => s.endGame);
  const rematchTiedAction = useOnlineStore((s) => s.rematchTied);
  const leaveRoomAction = useOnlineStore((s) => s.leaveRoom);
  const backHome = useGameStore((s) => s.backHome);
  const reactions = useOnlineStore((s) => s.reactions);
  const sendReactionAction = useOnlineStore((s) => s.sendReaction);

  // === AI auto-play (host computes moves for AI players) ===
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current);
      aiTimerRef.current = null;
    }
    if (!state) return;
    const current = state.players[state.currentPlayerIndex];
    const amHost = state.hostId === myId;
    if (
      state.phase !== "playing" ||
      state.resolving ||
      state.isPaused ||
      !current ||
      !current.isAI ||
      !amHost
    )
      return;
    aiTimerRef.current = setTimeout(() => {
      const s = useOnlineStore.getState().state;
      if (!s || s.phase !== "playing" || s.resolving || s.isPaused) return;
      const aiPlayer = s.players[s.currentPlayerIndex];
      if (!aiPlayer?.isAI) return;
      const opponentIds = s.players
        .filter((p) => p.id !== aiPlayer.id)
        .map((p) => p.id);
      const move = findBestMove(s.grid, aiPlayer.id, opponentIds);
      if (move) {
        useOnlineStore.getState().placePawn(move.row, move.col);
      }
    }, 900);
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, [state?.currentPlayerIndex, state?.resolving, state?.isPaused, state?.phase, myId]);

  if (!state) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div>
          <WifiOff className="mx-auto mb-3 h-10 w-10 text-rose-300" />
          <p className="text-sm text-muted-foreground">
            Connexion au salon perdue.
          </p>
          <Button onClick={backHome} className="mt-4">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  const players = state.players;
  const current = players[state.currentPlayerIndex];
  const isMyTurn = current?.id === myId;
  const amHost = state.hostId === myId;

  const inAnySquare = (r: number, c: number) =>
    state.formedSquares.some((sq) =>
      sq.cells.some((cell) => cell.row === r && cell.col === c)
    );
  const inLastSquare = (r: number, c: number) =>
    !!state.lastSquareCells?.some((cell) => cell.row === r && cell.col === c);

  const timePct = Math.max(0, Math.min(100, (state.turnTimeLeft / 10) * 100));
  const urgent = state.turnTimeLeft <= 3 && !state.resolving && !state.isPaused;

  const handleQuit = () => {
    leaveRoomAction();
    backHome();
  };

  // === GAME OVER ===
  if (state.phase === "gameover") {
    const ranked = [...players].sort((a, b) => b.score - a.score);
    const maxScore = ranked.length > 0 ? ranked[0].score : 0;
    const tiedPlayerIds = state.tiedPlayerIds ?? [];
    const isTie = tiedPlayerIds.length > 1;
    const singleWinner = !isTie ? ranked[0] : null;

    // === TIE SCREEN ===
    if (isTie) {
      const tiedPlayers = ranked.filter((p) => tiedPlayerIds.includes(p.id));
      const eliminated = ranked.filter((p) => !tiedPlayerIds.includes(p.id));
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 150, damping: 18 }}
            className="flex w-full flex-col items-center text-center"
          >
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

            {eliminated.length > 0 && (
              <div className="mt-4 w-full max-w-md">
                <p className="mb-2 font-display text-xs uppercase tracking-widest text-muted-foreground/60">
                  Éliminés
                </p>
                <div className="flex flex-col gap-2">
                  {eliminated.map((p) => (
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
              {amHost ? (
                <Button
                  onClick={rematchTiedAction}
                  size="lg"
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400"
                >
                  <Swords className="mr-2 h-5 w-5" />
                  Lancer le challenge décisif
                </Button>
              ) : (
                <p className="text-sm text-violet-200/70">En attente de l'hôte pour le challenge...</p>
              )}
              <Button onClick={handleQuit} size="lg" variant="outline">
                <Home className="mr-2 h-5 w-5" /> Accueil
              </Button>
            </div>
          </motion.div>
        </div>
      );
    }

    // === SINGLE WINNER SCREEN ===
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 18 }}
          className="flex w-full flex-col items-center text-center"
        >
            <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
            className="flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_0_50px_-5px_oklch(0.80_0.14_84/0.7)] sm:h-28 sm:w-28"
          >
            <Avatar
              avatar={singleWinner?.emoji ?? ""}
              color={singleWinner?.color ?? "#52525b"}
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
            {singleWinner?.name ?? "—"}
          </h1>
          <p className="mt-3 flex items-center gap-2 text-amber-200/80">
            <Crown className="h-5 w-5 text-amber-300" />
            avec {singleWinner?.score ?? 0} points
          </p>

          {/* Ranking — all players with their names and scores */}
          <div className="mt-8 w-full max-w-md">
            <p className="mb-2 font-display text-xs uppercase tracking-widest text-muted-foreground">
              Classement
            </p>
            <div className="flex flex-col gap-2">
              {ranked.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`flex items-center gap-3 rounded-xl border p-4 sm:p-3 ${
                    p.id === singleWinner?.id
                      ? "border-amber-400/50 bg-amber-500/10"
                      : "border-border/50 bg-card/40"
                  }`}
                >
                  <span className="w-6 text-center font-display text-lg font-bold text-amber-200">
                    {i + 1}
                  </span>
                  <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-display text-sm font-semibold text-foreground">{p.name}</p>
                    {p.id === singleWinner?.id && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Champion</span>
                    )}
                  </div>
                  <span className="font-display text-2xl font-bold sm:text-xl">{p.score} pts</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={handleQuit} size="lg" variant="outline">
              <Home className="mr-2 h-5 w-5" /> Accueil
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // === PLAYING ===
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-black sm:text-2xl">
            <span className="text-red-gradient">Trouv</span>
            <span className="text-gold-gradient">ix</span>
          </span>
          <span className="rounded-full border border-amber-400/30 bg-amber-500/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-amber-200/80">
            Salon {state.roomCode}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/5 px-3 py-1.5 text-sm text-amber-200/90 sm:text-xs">
            <Square className="h-3.5 w-3.5" />
            Carré {state.currentRound}/{state.totalRounds}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/5 px-3 py-1.5 text-sm text-rose-200/90 sm:text-xs">
            <Target className="h-3.5 w-3.5" />
            Carré = +1
          </div>
          {amHost && (
            <Button
              variant="outline"
              size="sm"
              onClick={togglePauseAction}
              disabled={state.resolving}
              className={`h-10 gap-1.5 sm:h-8 ${
                state.isPaused
                  ? "border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/10"
                  : "border-amber-400/40 text-amber-200 hover:bg-amber-500/10"
              }`}
            >
              {state.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              <span className="hidden sm:inline">{state.isPaused ? "Reprendre" : "Pause"}</span>
            </Button>
          )}
          {amHost && (
            <Button
              variant="outline"
              size="sm"
              onClick={endGameAction}
              className="h-10 gap-1.5 border-rose-400/40 text-rose-200 hover:bg-rose-500/10 sm:h-8"
            >
              <Flag className="h-4 w-4" />
              <span className="hidden sm:inline">Terminer</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Grid + timer */}
        <div className="flex flex-col gap-4">
          {/* Professional score counter — above the grid */}
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar avatar={current?.emoji ?? ""} color={current?.color ?? "#52525b"} size={44} emojiSize="text-xl" />
                <div>
                  <p className="text-xs text-muted-foreground sm:text-[11px]">
                    {isMyTurn ? "À toi de jouer" : "Tour de"}
                  </p>
                  <p className="font-display text-base font-bold leading-tight">{current?.name}</p>
                </div>
              </div>
              <div
                className={`flex items-center gap-1.5 font-display text-3xl font-black tabular-nums sm:text-2xl ${
                  state.isPaused ? "text-emerald-300" : urgent ? "text-rose-400" : "text-amber-200"
                }`}
              >
                {state.isPaused ? (
                  <>
                    <Pause className="h-5 w-5" /> Pause
                  </>
                ) : (
                  <>
                    <Timer className={`h-5 w-5 ${urgent ? "animate-pulse" : ""}`} />
                    {state.turnTimeLeft.toFixed(1)}s
                  </>
                )}
              </div>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: urgent
                    ? "linear-gradient(90deg, #f43f5e, #f59e0b)"
                    : `linear-gradient(90deg, ${current?.color ?? "#f59e0b"}, #fbbf24)`,
                }}
                animate={{ width: `${timePct}%` }}
                transition={{ duration: 0.25, ease: "linear" }}
              />
            </div>
          </div>

          {/* Board */}
          <div className="mx-auto w-full max-w-[min(560px,calc(100vw-1.5rem))]">
            <div className="relative rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[oklch(0.22_0.025_24)] to-[oklch(0.15_0.018_22)] p-1.5 shadow-2xl sm:p-2">
              <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
                {Array.from({ length: ROWS }).map((_, row) =>
                  Array.from({ length: COLS }).map((__, col) => {
                    const cellVal = state.grid[row][col];
                    const filled = cellVal !== null;
                    const isSquareCell = inAnySquare(row, col);
                    const isFresh = inLastSquare(row, col);
                    const cellColor = players.find((p) => p.id === cellVal)?.color ?? "#52525b";
                    const canPlay = isMyTurn && !filled && !state.resolving && !state.isPaused && state.phase === "playing";
                    return (
                      <button
                        key={`${row}-${col}`}
                        type="button"
                        disabled={!canPlay}
                        onClick={() => {
                          if (!canPlay) return;
                          placePawnAction(row, col);
                        }}
                        className={`group relative aspect-square touch-manipulation rounded-full bg-[oklch(0.10_0.015_22)] ring-1 ring-black/40 outline-none transition focus-visible:ring-2 focus-visible:ring-amber-300/60 ${
                          canPlay ? "cursor-pointer" : "cursor-default"
                        }`}
                        aria-label={`Placer un pion ligne ${row + 1} colonne ${col + 1}`}
                      >
                        {filled ? (
                          <motion.div
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 360, damping: 18 }}
                            className={`absolute inset-[2px] rounded-full shadow-lg ${
                              isFresh
                                ? "ring-4 ring-amber-200 pulse-glow z-20"
                                : isSquareCell
                                  ? "ring-[3px] ring-amber-300/80 z-10"
                                  : "ring-2 ring-white/30"
                            }`}
                            style={{ backgroundColor: cellColor }}
                          >
                            {isSquareCell && !isFresh && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs drop-shadow">⭐</span>
                            )}
                          </motion.div>
                        ) : (
                          canPlay && (
                            <div
                              className="absolute inset-[2px] rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-50"
                              style={{ backgroundColor: current?.color }}
                            />
                          )
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Floating reactions */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                <AnimatePresence>
                  {reactions.map((r) => {
                    const xOffset = ((r.timestamp % 80) - 40);
                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 40, scale: 0.5 }}
                        animate={{
                          opacity: [0, 1, 1, 0],
                          y: [40, -20, -80, -160],
                          scale: [0.5, 1.3, 1, 0.8],
                          x: xOffset,
                        }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 3, ease: "easeOut" }}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2"
                      >
                        <span className="text-5xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                          {r.emoji}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>

              {/* Not-your-turn overlay */}
              {!isMyTurn && state.phase === "playing" && !state.resolving && !state.isPaused && (
                <div className="pointer-events-none absolute inset-0 flex items-end justify-center rounded-3xl bg-black/30 p-4">
                  <p className="rounded-full bg-black/60 px-4 py-1.5 text-xs text-amber-100">
                    En attente du tour de {current?.name}...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reaction bar */}
          <div className="glass-card flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl px-3 py-2 sm:flex-nowrap sm:gap-1.5 sm:px-3 sm:py-2.5">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReactionAction(emoji)}
                className="rounded-full px-1.5 py-0.5 text-2xl transition-transform hover:scale-125 active:scale-95 sm:text-xl"
                title={`Réagir avec ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-amber-200/70">
              Joueurs
            </h3>
            <div className="flex max-h-[440px] flex-col gap-2 overflow-y-auto scroll-romantic pr-1">
              {players.map((p) => {
                const isCurrent = p.id === current?.id;
                const isLeader = [...players].sort((a, b) => b.score - a.score)[0]?.id === p.id && p.score > 0;
                const pionCount = state.grid.flat().filter((c) => c === p.id).length;
                return (
                  <motion.div
                    key={p.id}
                    layout
                    className={`relative overflow-hidden rounded-xl border p-4 transition-all sm:p-3 ${
                      isCurrent
                        ? "border-amber-400/60 bg-amber-500/10 shadow-[0_0_20px_-5px_oklch(0.80_0.14_84/0.4)]"
                        : "border-border/60 bg-card/40"
                    }`}
                  >
                    {isCurrent && <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-300 to-rose-500" />}
                    <div className="flex items-center gap-3">
                      <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-display text-sm font-semibold text-foreground">{p.name}</p>
                          {isLeader && <Crown className="h-3.5 w-3.5 text-amber-300" />}
                          {p.isAI && <span className="rounded-full bg-violet-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-200">IA</span>}
                          {p.connected === false && <span className="rounded-full bg-rose-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-300">Hors ligne</span>}
                          {isCurrent && <span className="flex items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200"><Timer className="h-2.5 w-2.5" />À toi</span>}
                          {p.id === state.hostId && <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200">Hôte</span>}
                        </div>
                        <p className="text-xs text-muted-foreground sm:text-[11px]">{p.alignments} carré{p.alignments > 1 ? "s" : ""} · {pionCount} pion{pionCount > 1 ? "s" : ""}</p>
                      </div>
                      <p className={`font-display text-3xl font-bold sm:text-2xl ${p.connected === false ? "opacity-40" : ""}`}>{p.score}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleQuit} className="text-muted-foreground hover:text-foreground">
            <Home className="mr-1.5 h-4 w-4" /> Quitter la partie
          </Button>
        </div>
      </div>
    </div>
  );
}
