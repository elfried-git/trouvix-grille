"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useOnlineStore } from "@/store/online-store";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { Button } from "@/components/ui/button";
import { findBestMove } from "@/lib/ai";
import { vividColor } from "@/lib/color";
import { Flag, Home, Timer, Pause, Play, Crown, WifiOff, Swords, RotateCcw, Plus } from "lucide-react";

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
  const restartAction = useOnlineStore((s) => s.restart);
  const leaveRoomAction = useOnlineStore((s) => s.leaveRoom);
  const destroyRoomAction = useOnlineStore((s) => s.destroyRoom);
  const backHome = useGameStore((s) => s.backHome);
  const goToOnlineSetup = useGameStore((s) => s.goToOnlineSetup);
  const reactions = useOnlineStore((s) => s.reactions);
  const squareEvent = useOnlineStore((s) => s.squareEvent);
  const sendReactionAction = useOnlineStore((s) => s.sendReaction);

  // The game state is the source of truth. The dedicated socket event is only
  // an optimization for starting the celebration immediately.
  const stateSquareEvent = useMemo(() => state?.squareEventId != null && state.lastSquareCells?.length === 4
    ? {
        eventId: state.squareEventId,
        playerId: state.lastSquareerId ?? "",
        color: state.players.find((player) => player.id === state.lastSquareerId)?.color ?? "#f59e0b",
        cells: state.lastSquareCells,
      }
    : null, [state?.squareEventId, state?.lastSquareCells, state?.lastSquareerId, state?.players]);

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

  // === Ripple shockwave when a square is formed ===
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; color: string }>>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [reactionBoardRect, setReactionBoardRect] = useState<DOMRect | null>(null);
  const [activeSquareEvent, setActiveSquareEvent] = useState<{ eventId: number; playerId: string; color: string; cells: { row: number; col: number }[] } | null>(null);
  const handledSquareEventRef = useRef<number | null>(null);

  useEffect(() => {
    const board = boardRef.current;
    if (!board) {
      setReactionBoardRect(null);
      return;
    }

    const updateBoardRect = () => setReactionBoardRect(board.getBoundingClientRect());
    updateBoardRect();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateBoardRect) : null;
    observer?.observe(board);
    window.addEventListener("resize", updateBoardRect);
    window.addEventListener("scroll", updateBoardRect, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateBoardRect);
      window.removeEventListener("scroll", updateBoardRect, true);
    };
  }, [state?.phase]);

  const removeRipple = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  useEffect(() => {
    const event = squareEvent ?? stateSquareEvent;
    if (!event || event.eventId === handledSquareEventRef.current) return;
    const cells = event.cells;
    if (cells.length === 4) {
      setActiveSquareEvent(event);
      setTimeout(() => {
        setActiveSquareEvent((active) => active?.eventId === event.eventId ? null : active);
      }, 700);
      // Compute center of the square in percentage of the grid
      const avgRow = cells.reduce((s, c) => s + c.row, 0) / cells.length;
      const avgCol = cells.reduce((s, c) => s + c.col, 0) / cells.length;
      const centerX = ((avgCol + 0.5) / COLS) * 100;
      const centerY = ((avgRow + 0.5) / ROWS) * 100;
      const color = vividColor(event.color);
      const now = Date.now();
      // Spawn 3 concentric ripple rings with staggered timing
      setRipples((prev) => [
        ...prev,
        { id: now, x: centerX, y: centerY, color },
        { id: now + 1, x: centerX, y: centerY, color },
        { id: now + 2, x: centerX, y: centerY, color },
      ]);
      handledSquareEventRef.current = event.eventId;
    }
  }, [squareEvent, stateSquareEvent]);

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
  const currentBoardRect = boardRef.current?.getBoundingClientRect();
  const reactionBounds = typeof window === "undefined"
    ? null
    : currentBoardRect && currentBoardRect.width > 0 && currentBoardRect.height > 0
      ? currentBoardRect
      : reactionBoardRect && reactionBoardRect.width > 0 && reactionBoardRect.height > 0
        ? reactionBoardRect
        : { left: 0, top: window.innerHeight * 0.1, width: window.innerWidth, height: window.innerHeight * 0.65 };
  const current = players[state.currentPlayerIndex];
  const isMyTurn = current?.id === myId;
  const amHost = state.hostId === myId;

  const inAnySquare = (r: number, c: number) =>
    state.formedSquares.some((sq) =>
      sq.cells.some((cell) => cell.row === r && cell.col === c)
    );
  const inLastSquare = (r: number, c: number) =>
    !!state.lastSquareCells?.some((cell) => cell.row === r && cell.col === c) ||
    !!activeSquareEvent?.cells.some((cell) => cell.row === r && cell.col === c);

  const timePct = Math.max(0, Math.min(100, (state.turnTimeLeft / 10) * 100));
  const urgent = state.turnTimeLeft <= 3 && !state.resolving && !state.isPaused;
  // Vivid, high-saturation color of the current player — same color the whole turn
  const turnColor = vividColor(current?.color ?? "#f59e0b");
  const squareHighlightColor = vividColor(
    activeSquareEvent?.color ?? state.players.find((player) => player.id === state.lastSquareerId)?.color ?? "#f59e0b"
  );

  const handleQuit = () => {
    leaveRoomAction();
    backHome();
  };

  const handleNewGame = () => {
    if (amHost) {
      destroyRoomAction();
    } else {
      leaveRoomAction();
      try {
        localStorage.removeItem("trouvix_room");
        localStorage.removeItem("trouvix_player");
      } catch {}
      goToOnlineSetup();
    }
  };

  // === GAME OVER ===
  if (state.phase === "gameover") {
    const ranked = [...players].sort((a, b) => b.score - a.score);
    const maxScore = ranked.length > 0 ? ranked[0].score : 0;
    const tiedPlayerIds = state.tiedPlayerIds ?? [];
    const connectedPlayers = players.filter((p) => p.connected !== false);
    const hasEnoughPlayersToRestart = connectedPlayers.length >= 2;
    const isTie = tiedPlayerIds.length > 1;
    const tiedPlayers = ranked.filter((p) => tiedPlayerIds.includes(p.id));
    const connectedTiedPlayers = tiedPlayers.filter((p) => p.connected !== false);
    const hasEnoughTiedToRematch = connectedTiedPlayers.length >= 2;
    const singleWinner = !isTie ? ranked[0] : null;

    // === TIE SCREEN ===
    if (isTie) {
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
                    className={`flex items-center gap-3 rounded-xl border-2 border-violet-400/50 bg-violet-500/10 p-4 shadow-[0_0_20px_-5px_oklch(0.60_0.20_300/0.4)] sm:p-3 ${
                      p.connected === false ? "opacity-50" : ""
                    }`}
                  >
                    <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                    <div className="min-w-0 flex-1 text-left">
                      <p className={`font-bold text-violet-100 truncate ${p.connected === false ? "line-through text-muted-foreground" : ""}`}>
                        {p.name}
                      </p>
                      {p.connected === false && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-300">A quitté le salon</span>
                      )}
                    </div>
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
                <>
                  <Button
                    onClick={rematchTiedAction}
                    size="lg"
                    disabled={!hasEnoughTiedToRematch}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Swords className="mr-2 h-5 w-5" />
                    Lancer le challenge décisif
                  </Button>
                  <Button
                    onClick={restartAction}
                    size="lg"
                    disabled={!hasEnoughPlayersToRestart}
                    className="bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="mr-2 h-5 w-5" />
                    Rejouer
                  </Button>
                  <Button
                    onClick={handleNewGame}
                    size="lg"
                    variant="outline"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Nouvelle partie
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleNewGame}
                    size="lg"
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400 shadow-md"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Nouvelle partie (Créer un salon)
                  </Button>
                </>
              )}
              <Button onClick={handleQuit} size="lg" variant="outline">
                <Home className="mr-2 h-5 w-5" /> Accueil
              </Button>
              {amHost && !hasEnoughPlayersToRestart && (
                <p className="w-full text-center text-xs text-rose-300/90 mt-2 font-medium">
                  ⚠️ Plus aucun autre joueur dans le salon. Crée une nouvelle partie ou retourne à l'accueil.
                </p>
              )}
              {!amHost && (
                <p className="w-full text-center text-xs text-violet-200/60 mt-1">
                  ⏳ Tu peux aussi attendre que l'hôte lance le challenge décisif.
                </p>
              )}
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
                  } ${p.connected === false ? "opacity-50" : ""}`}
                >
                  <span className="w-6 text-center font-display text-lg font-bold text-amber-200">
                    {i + 1}
                  </span>
                  <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className={`truncate font-display text-sm font-semibold ${p.connected === false ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {p.name}
                    </p>
                    {p.id === singleWinner?.id && p.connected !== false && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Champion</span>
                    )}
                    {p.connected === false && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-300">A quitté le salon</span>
                    )}
                  </div>
                  <span className="font-display text-2xl font-bold sm:text-xl">{p.score} pts</span>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {amHost ? (
              <>
                <Button
                  onClick={restartAction}
                  size="lg"
                  disabled={!hasEnoughPlayersToRestart}
                  className="bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="mr-2 h-5 w-5" /> Rejouer
                </Button>
                <Button
                  onClick={handleNewGame}
                  size="lg"
                  variant="outline"
                >
                  <Plus className="mr-2 h-5 w-5" /> Nouvelle partie
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleNewGame}
                  size="lg"
                  className="bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-500 hover:to-amber-400 shadow-md"
                >
                  <Plus className="mr-2 h-5 w-5" /> Nouvelle partie (Créer un salon)
                </Button>
              </>
            )}
            <Button onClick={handleQuit} size="lg" variant="outline">
              <Home className="mr-2 h-5 w-5" /> Accueil
            </Button>
            {amHost && !hasEnoughPlayersToRestart && (
              <p className="w-full text-center text-xs text-rose-300/90 mt-2 font-medium">
                ⚠️ Plus aucun autre joueur dans le salon. Crée une nouvelle partie ou retourne à l'accueil.
              </p>
            )}
            {!amHost && (
              <p className="w-full text-center text-xs text-amber-200/60 mt-1">
                ⏳ Tu peux aussi attendre que l'hôte relance la partie.
              </p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // === PLAYING ===
  return (
    <>
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-display text-xl font-black sm:text-2xl">
            <span className="text-red-gradient">Trouv</span>
            <span className="text-gold-gradient">ix</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
          {/* Professional score counter & players list — above the grid */}
          <div className="glass-card rounded-2xl p-3 sm:p-4 space-y-3">
            {/* Players list with live scores and active turn highlight */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              {players.map((p) => {
                const isActive = p.id === current?.id;
                const isMe = p.id === myId;
                const isDisconnected = p.connected === false;
                return (
                  <div
                    key={p.id}
                    style={
                      isActive
                        ? {
                            borderColor: p.color,
                            backgroundColor: `${p.color}28`,
                            boxShadow: `0 0 18px -2px ${p.color}80`,
                          }
                        : undefined
                    }
                    className={`flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-2 py-2 text-center transition-all ${
                      isActive
                        ? "border-2 ring-1 ring-white/30 scale-[1.02]"
                        : "bg-card/40 border-border/40 opacity-75"
                    } ${isDisconnected ? "opacity-40 line-through" : ""}`}
                  >
                    <Avatar
                      avatar={p.emoji}
                      color={p.color}
                      size={44}
                      emojiSize="text-xl"
                      ring={false}
                      className={isActive ? "ring-2" : "ring-2 ring-white/20"}
                      style={
                        isActive
                          ? { boxShadow: `0 0 0 2px ${p.color}, 0 0 12px 2px ${p.color}cc` }
                          : undefined
                      }
                    />
                    <div className="flex min-w-0 w-full flex-col items-center">
                      <span className={`w-full truncate text-xs font-bold leading-tight ${isActive ? "text-white" : "text-foreground"}`}>
                        {p.name}
                      </span>
                      {isMe && (
                        <span className="mt-0.5 rounded bg-amber-400/20 px-1 text-[8px] font-semibold text-amber-200">
                          Toi
                        </span>
                      )}
                      {p.isAI && (
                        <span className="mt-0.5 rounded bg-violet-400/20 px-1 text-[8px] font-semibold text-violet-200">
                          IA
                        </span>
                      )}
                    </div>
                    <span className={`font-display text-lg font-black leading-none ${isActive ? "text-amber-300" : "text-amber-200/80"}`}>
                      {p.score} <span className="text-[9px] font-normal text-muted-foreground">pts</span>
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Seconds countdown & progress bar */}
            <div className="space-y-1.5 pt-1 border-t border-border/30">
              <div className="flex items-center justify-end">
                <div
                  className="flex items-center gap-1 font-display text-sm sm:text-base font-black tabular-nums"
                  style={{ color: state.isPaused ? "#34d399" : turnColor }}
                >
                  {state.isPaused ? (
                    <>
                      <Pause className="h-4 w-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Timer className="h-4 w-4" />
                      {state.turnTimeLeft.toFixed(1)}s
                    </>
                  )}
                </div>
              </div>

              {/* Countdown progress bar — solid, vivid player color (no gradient) */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                <motion.div
                  className="h-full rounded-full transition-all"
                  style={{
                    backgroundColor: turnColor,
                    boxShadow: `0 0 14px ${turnColor}`,
                  }}
                  animate={{ width: `${timePct}%` }}
                  transition={{ duration: 0.25, ease: "linear" }}
                />
              </div>
            </div>
          </div>

          {/* Board */}
          <div className="mx-auto w-full max-w-[min(560px,calc(100vw-1.5rem))]">
            <div ref={boardRef} className="relative rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[oklch(0.22_0.025_24)] to-[oklch(0.15_0.018_22)] p-1.5 shadow-2xl sm:p-2">
              <div className="relative z-20 grid gap-1 rounded-xl bg-[oklch(0.18_0.02_22)] sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
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
                            initial={isFresh ? { scale: 1, opacity: 1 } : { scale: 0.3, opacity: 0 }}
                            animate={isFresh
                              ? { scale: [1, 1.2, 1], opacity: 1, filter: ["brightness(1)", "brightness(1.7)", "brightness(1)"] }
                              : { scale: 1, opacity: 1 }}
                            transition={isFresh
                              ? { duration: 0.32, repeat: 1, ease: "easeInOut" }
                              : { type: "spring", stiffness: 360, damping: 18 }}
                            className={`absolute inset-[2px] rounded-full shadow-lg ${
                              isFresh
                                ? "ring-4 z-20"
                                : isSquareCell
                                  ? "ring-[3px] ring-amber-300/80 z-10"
                                  : "ring-2 ring-white/30"
                            }`}
                            style={{
                              backgroundColor: cellColor,
                              boxShadow: isFresh
                                ? `0 0 0 2px #fff, 0 0 7px 3px ${squareHighlightColor}, 0 0 18px 7px ${squareHighlightColor}, 0 0 34px 12px ${squareHighlightColor}bb`
                                : undefined,
                              filter: isFresh ? `drop-shadow(0 0 8px ${squareHighlightColor})` : undefined,
                            }}
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

              {/* Flash the whole grid from the square's position for every player. */}
              <AnimatePresence>
                {activeSquareEvent && (
                  <motion.div
                    key={`square-flash-${activeSquareEvent.eventId}`}
                    className="pointer-events-none absolute inset-0 z-30 rounded-3xl"
                    style={{
                      background: `radial-gradient(circle at ${((activeSquareEvent.cells.reduce((sum, cell) => sum + cell.col, 0) / 4 + 0.5) / COLS) * 100}% ${((activeSquareEvent.cells.reduce((sum, cell) => sum + cell.row, 0) / 4 + 0.5) / ROWS) * 100}%, ${squareHighlightColor}66 0%, transparent 62%)`,
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.65, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                )}
              </AnimatePresence>

              {/* Ripple shockwave overlay */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl z-40">
                <AnimatePresence>
                  {ripples.map((ripple, i) => {
                    // Stagger: ring index is ripple.id % 3 gives 0, 1, 2
                    const ringIndex = ripple.id % 3;
                    return (
                      <motion.div
                        key={ripple.id}
                        className="absolute rounded-full"
                        style={{
                          left: `${ripple.x}%`,
                          top: `${ripple.y}%`,
                          width: 30,
                          height: 30,
                          marginLeft: -15,
                          marginTop: -15,
                          border: `${3 - ringIndex * 0.5}px solid ${ripple.color}`,
                          boxShadow: `0 0 ${20 - ringIndex * 4}px ${ripple.color}aa, 0 0 ${50 - ringIndex * 10}px ${ripple.color}44`,
                        }}
                        initial={{ scale: 0.3, opacity: 1 }}
                        animate={{ scale: 15, opacity: 0 }}
                        transition={{
                          duration: 0.5 + ringIndex * 0.06,
                          delay: ringIndex * 0.06,
                          ease: "easeOut",
                        }}
                        onAnimationComplete={() => removeRipple(ripple.id)}
                      />
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
          <div className="flex w-full flex-nowrap items-center justify-between gap-0 px-1 py-1 sm:justify-center sm:gap-3 sm:px-3 sm:py-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReactionAction(emoji)}
                className="shrink-0 rounded-full px-0 py-0 text-base leading-none transition-transform hover:scale-125 active:scale-95 sm:px-1.5 sm:text-xl"
                title={`Réagir avec ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* Quit button */}
          <div className="flex justify-center pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleQuit}
              className="text-muted-foreground hover:text-foreground"
            >
              <Home className="mr-1.5 h-4 w-4" /> Quitter la partie
            </Button>
          </div>
      </div>
    </div>
    {typeof document !== "undefined" && reactionBounds && reactions.length > 0 && createPortal(
      <div className="pointer-events-none fixed inset-0" style={{ zIndex: 2147483647 }}>
        <AnimatePresence>
          {reactions.map((reaction) => {
            const startTop = reactionBounds.top + reactionBounds.height * 0.88;
            const middleTop = reactionBounds.top + reactionBounds.height * 0.5;
            const centerLeft = reactionBounds.left + reactionBounds.width / 2 + (reaction.timestamp % 80) - 40;
            return (
              <motion.div
                key={reaction.id}
                initial={{ opacity: 0, top: startTop, left: centerLeft, scale: 0.5 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  top: [startTop, reactionBounds.top + reactionBounds.height * 0.72, middleTop, middleTop],
                  scale: [0.5, 1.3, 1, 0.8],
                }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 3, ease: "easeOut" }}
                className="absolute -ml-6 -mt-6 text-5xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              >
                {reaction.emoji}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>,
      document.body
    )}
    </>
  );
}
