"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useOnlineStore } from "@/store/online-store";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { ResultRanking, WinnerHero } from "./GameResultPresentation";
import { Button } from "@/components/ui/button";
import { findBestMove } from "@/lib/ai";
import { vividColor } from "@/lib/color";
import { Bomb, Home, Timer, Pause, WifiOff, Swords, RotateCcw, Plus, Volume2, VolumeX } from "lucide-react";
import { areReactionSoundsEnabled, setReactionSoundsEnabled } from "@/lib/reaction-sounds";
import { BOMBARDMENT_UNLOCK_SCORE, findBombardmentTargets } from "@/lib/bombardment";

// ===== Reaction emojis =====
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🔥", "👏", "💪", "💔", "😭", "😡"];

const ROWS = 10;
const COLS = 10;

export function OnlineGameScreen() {
  const state = useOnlineStore((s) => s.state);
  const optimisticPawn = useOnlineStore((s) => s.optimisticPawn);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [reactionSoundsOn, setReactionSoundsOn] = useState(true);
  useEffect(() => setReactionSoundsOn(areReactionSoundsEnabled()), []);
  useEffect(() => {
    if (!state || state.phase !== "playing" || state.isPaused || state.turnDeadlineAt == null) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [state?.phase, state?.isPaused, state?.turnDeadlineAt]);
  const myId = useOnlineStore((s) => s.myPlayerId);
  const placePawnAction = useOnlineStore((s) => s.placePawn);
  const bombardAction = useOnlineStore((s) => s.bombard);
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
  const stateSquareEvent = useMemo(() => state?.squareEventId != null && (state.lastSquareCells?.length ?? 0) >= 4
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
      if (
        aiPlayer.score >= BOMBARDMENT_UNLOCK_SCORE &&
        !aiPlayer.bombardmentUsed &&
        findBombardmentTargets(s.grid, opponentIds).length > 0
      ) {
        useOnlineStore.getState().bombard();
        return;
      }
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
  const [bombardmentFlash, setBombardmentFlash] = useState(false);
  const handledBombardmentRef = useRef<number | null>(state?.bombardmentEventId ?? null);

  useEffect(() => {
    const eventId = state?.bombardmentEventId;
    if (eventId == null || eventId === handledBombardmentRef.current) return;
    handledBombardmentRef.current = eventId;
    setBombardmentFlash(true);
    const timeout = window.setTimeout(() => setBombardmentFlash(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [state?.bombardmentEventId]);

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
    if (cells.length >= 4) {
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
  const turnTimeLeft = state.turnDeadlineAt != null && state.phase === "playing" && !state.isPaused
    ? Math.max(0, (state.turnDeadlineAt - clockNow) / 1000)
    : state.turnTimeLeft;
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
  const bombTargets = current
    ? findBombardmentTargets(
        state.grid,
        players.filter((player) => player.id !== current.id).map((player) => player.id),
      )
    : [];

  const inAnySquare = (r: number, c: number) =>
    state.formedSquares.some((sq) =>
      sq.cells.some((cell) => cell.row === r && cell.col === c)
    );
  const inLastSquare = (r: number, c: number) =>
    !!state.lastSquareCells?.some((cell) => cell.row === r && cell.col === c) ||
    !!activeSquareEvent?.cells.some((cell) => cell.row === r && cell.col === c);

  const timePct = Math.max(0, Math.min(100, (turnTimeLeft / 10) * 100));
  const urgent = turnTimeLeft <= 3 && !state.resolving && !state.isPaused;
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
      return (
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 150, damping: 18 }}
            className="flex w-full flex-col items-center text-center"
          >
            <motion.div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-3xl shadow-[0_0_30px_-5px_oklch(0.60_0.20_300/0.6)]"
            >
              ⚖️
            </motion.div>
            <p className="mt-3 font-display text-sm uppercase tracking-[0.2em] text-violet-200/80">
              Égalité
            </p>
            <h1 className="mt-1 font-display text-4xl font-black text-violet-200 sm:text-5xl">
              {maxScore} pts
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tiedPlayers.length} joueurs à départager
            </p>

            <div className="mt-4 w-full max-w-md">
              <div className="flex flex-col gap-2">
                {tiedPlayers.map((p) => (
                  <motion.div
                    key={p.id}
                    style={{ background: `linear-gradient(#1b111c, #1b111c) padding-box, linear-gradient(110deg, ${p.color}, ${p.color}45 65%, #ffffff22) border-box`, boxShadow: `0 0 22px ${p.color}35` }}
                    className={`flex items-center gap-3 rounded-2xl border-2 border-transparent px-3 py-2 shadow-xl ${
                      p.connected === false ? "opacity-50" : ""
                    }`}
                  >
                    <div className="rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, #fff, ${p.color})` }}><Avatar avatar={p.emoji} color={p.color} size={40} emojiSize="text-xl" ring={false} /></div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className={`font-display font-bold text-white truncate ${p.connected === false ? "line-through text-muted-foreground" : ""}`}>
                        {p.name}
                      </p>
                      {p.connected === false && (
                        <span className="text-sm font-bold text-rose-300">A quitté le salon</span>
                      )}
                    </div>
                    <span className="rounded-xl px-3 py-1 font-display text-base font-black text-white" style={{ backgroundColor: `${p.color}33` }}>{p.score} pts</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {amHost ? (
                <>
                  <Button
                    onClick={rematchTiedAction}
                    size="lg"
                    disabled={!hasEnoughTiedToRematch}
                    className="h-12 px-5 text-base bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Swords className="mr-2 h-5 w-5" />
                    Départager
                  </Button>
                  <Button
                    onClick={restartAction}
                    size="lg"
                    disabled={!hasEnoughPlayersToRestart}
                    className="h-12 px-5 text-base bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="mr-2 h-5 w-5" />
                    Rejouer
                  </Button>
                  <Button
                    onClick={handleNewGame}
                    size="lg"
                    variant="outline"
                    className="h-12 px-5 text-base"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Nouveau salon
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={handleNewGame}
                    size="lg"
                    className="h-12 px-5 text-base bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400 shadow-md"
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Nouveau salon
                  </Button>
                </>
              )}
              <Button onClick={handleQuit} size="lg" variant="outline" className="h-12 px-5 text-base">
                <Home className="mr-2 h-5 w-5" /> Accueil
              </Button>
              {amHost && !hasEnoughPlayersToRestart && (
                <p className="w-full text-center text-xs text-rose-300/90 mt-1 font-medium">
                  Aucun autre joueur connecté.
                </p>
              )}
              {!amHost && (
                <p className="w-full text-center text-xs text-violet-200/80 mt-1">
                  En attente de l&apos;hôte pour le départage.
                </p>
              )}
            </div>
          </motion.div>
        </div>
      );
    }

    // === SINGLE WINNER SCREEN ===
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center px-4 py-6 sm:justify-center sm:py-10">
        {singleWinner && <WinnerHero winner={singleWinner} />}
        {singleWinner && (
          <ResultRanking players={ranked} winnerId={singleWinner.id} showConnectionStatus />
        )}

        <div className="mt-6 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          {amHost ? (
            <>
              <Button
                onClick={restartAction}
                size="lg"
                disabled={!hasEnoughPlayersToRestart}
                className="h-14 w-full rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-6 text-lg text-white shadow-[0_10px_28px_-12px_rgba(244,63,94,0.75)] transition hover:-translate-y-0.5 hover:from-rose-500 hover:to-rose-400 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
              >
                <RotateCcw className="mr-2 h-6 w-6" /> Rejouer
              </Button>
              <Button
                onClick={handleNewGame}
                size="lg"
                variant="outline"
                className="h-14 w-full rounded-xl border-white/15 bg-white/[0.03] px-6 text-lg hover:bg-white/[0.08] sm:w-auto"
              >
                <Plus className="mr-2 h-6 w-6" /> Nouvelle partie
              </Button>
            </>
          ) : (
            <Button
              onClick={handleNewGame}
              size="lg"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 px-6 text-base text-white shadow-[0_10px_28px_-12px_rgba(245,158,11,0.7)] transition hover:-translate-y-0.5 hover:from-amber-500 hover:to-amber-400"
            >
              <Plus className="mr-2 h-5 w-5" /> Nouvelle partie
            </Button>
          )}
          <Button
            onClick={handleQuit}
            size="lg"
            variant="outline"
            className="h-14 w-full rounded-xl border-white/15 bg-white/[0.03] px-6 text-lg hover:bg-white/[0.08] sm:w-auto"
          >
            <Home className="mr-2 h-6 w-6" /> Accueil
          </Button>
          {amHost && !hasEnoughPlayersToRestart && (
            <p className="w-full text-center text-sm text-rose-300/90">
              Plus aucun autre joueur dans le salon. Crée une nouvelle partie ou retourne à l’accueil.
            </p>
          )}
          {!amHost && (
            <p className="w-full text-center text-sm text-amber-200/80">
              Tu peux aussi attendre que l’hôte relance la partie.
            </p>
          )}
        </div>
      </div>
    );
  }

  // === PLAYING ===
  return (
    <>
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col overflow-x-clip px-2 pb-1.5 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:py-6">
      {/* Top bar */}
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
        <div className="flex items-center gap-2">
          <span className="trouvix-wordmark text-xl sm:text-2xl" aria-label="Trouvix">
            <span className="trouvix-wordmark-red">Trouv</span>
            <span className="trouvix-wordmark-gold">ix</span>
          </span>
        </div>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-2 sm:gap-4">
          {/* Professional score counter & players list — above the grid */}
          <div className="glass-card shrink-0 rounded-2xl p-2 sm:space-y-3 sm:p-4">
            {/* Players list with live scores and active turn highlight */}
            <div className={`grid ${players.length <= 2 ? "grid-cols-2" : "grid-cols-4"} gap-1 sm:gap-2`}>
              {players.map((p) => {
                const isActive = p.id === current?.id;
                const isMe = p.id === myId;
                const isDisconnected = p.connected === false;
                return (
                  <button
                    type="button"
                    disabled={(state.resolving && isMe) || !myId}
                    onClick={() => {
                      if (isMe) togglePauseAction();
                      else endGameAction();
                    }}
                    aria-label={isMe ? `${state.isPaused ? "Reprendre" : "Mettre en pause"} la partie` : `Terminer la partie depuis le profil de ${p.name}`}
                    title={isMe ? `${state.isPaused ? "Reprendre" : "Mettre en pause"} la partie` : "Terminer la partie"}
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
                    className={`w-full cursor-pointer text-inherit flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1 text-center transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-wait sm:gap-1.5 sm:rounded-xl sm:px-2 sm:py-2 ${
                      isActive
                        ? "border-2 ring-1 ring-white/30 scale-[1.02]"
                        : "bg-card/40 border-border/40 opacity-75"
                    } ${isDisconnected ? "opacity-40 line-through" : ""}`}
                  >
              <Avatar
                avatar={p.emoji}
                      color={p.color}
                        size={36}
                      emojiSize="text-lg"
                      ring={false}
                      className={isActive ? "ring-2" : "ring-2 ring-white/20"}
                      style={
                        isActive
                          ? { boxShadow: `0 0 0 2px ${p.color}, 0 0 12px 2px ${p.color}cc` }
                          : undefined
                      }
                    />
                    <div className="flex min-w-0 w-full flex-wrap items-center justify-center gap-x-1">
                      <span className={`max-w-full truncate text-xs font-bold leading-tight sm:text-base ${isActive ? "text-white" : "text-foreground"}`}>
                        {p.name}
                      </span>
                      {isMe && (
                        <span className="rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-semibold leading-none text-amber-200 sm:px-1.5 sm:text-xs">
                          Toi
                        </span>
                      )}
                      {p.isAI && (
                        <span className="rounded bg-violet-400/20 px-1 py-0.5 text-[9px] font-semibold leading-none text-violet-200 sm:px-1.5 sm:text-xs">
                          IA
                        </span>
                      )}
                      {p.score >= BOMBARDMENT_UNLOCK_SCORE && !p.bombardmentUsed && (
                        <Bomb aria-label="Bombardement disponible" className="h-3.5 w-3.5 text-orange-300 sm:h-4 sm:w-4" />
                      )}
                    </div>
                    <span className={`font-display text-sm font-black leading-none sm:text-lg ${isActive ? "text-amber-300" : "text-amber-200/80"}`}>
                      {p.score} <span className="text-[10px] font-normal text-muted-foreground sm:text-xs">pts</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Seconds countdown & progress bar */}
            <div className="mt-1 space-y-1 border-t border-border/30 pt-1 sm:mt-0 sm:space-y-1.5 sm:pt-1">
              <div className="flex items-center justify-end">
                <div
                  className="flex items-center gap-1 font-display text-sm font-black tabular-nums sm:text-lg"
                  style={{ color: state.isPaused ? "#34d399" : turnColor }}
                >
                  {state.isPaused ? (
                    <>
                      <Pause className="h-4 w-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Timer className="h-4 w-4" />
                      {turnTimeLeft.toFixed(1)}s
                    </>
                  )}
                </div>
              </div>

              {/* Countdown progress bar — solid, vivid player color (no gradient) */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10 sm:h-4">
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

          {isMyTurn && !current?.isAI && current && current.score >= BOMBARDMENT_UNLOCK_SCORE && !current.bombardmentUsed && (
            <div className="mx-auto w-full max-w-md shrink-0 text-center">
              <Button
                type="button"
                variant="outline"
                disabled={state.resolving || state.isPaused || bombTargets.length === 0}
                onClick={bombardAction}
                aria-label="Utiliser le bombardement"
                title={bombTargets.length > 0 ? "Bombarder les pions adverses qui menacent un carré (consomme le tour)" : "Aucun carré adverse imminent"}
                className="h-11 gap-2 border-orange-400/60 bg-gradient-to-r from-orange-500/20 to-red-600/20 px-4 text-sm text-orange-100 shadow-[0_0_18px_rgba(249,115,22,0.2)] sm:h-12 sm:px-5 sm:text-base"
              >
                <Bomb className="h-5 w-5 text-orange-300" />
                Bombarder
              </Button>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Détruit les pions adverses d’un carré presque formé. Utilisable une fois ; ton tour se termine.
              </p>
            </div>
          )}

          {/* Board */}
          <div className="mx-auto w-full min-w-0 max-w-[min(640px,calc(100vw-1rem))] shrink-0">
            <div ref={boardRef} className={`relative rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[oklch(0.22_0.025_24)] to-[oklch(0.15_0.018_22)] p-1 shadow-2xl sm:rounded-3xl sm:p-2 ${bombardmentFlash ? "bombardment-flash" : ""}`}>
              <div className="relative z-20 grid gap-[2px] rounded-xl bg-[oklch(0.18_0.02_22)] p-px sm:gap-1.5 sm:p-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
                {Array.from({ length: ROWS }).map((_, row) =>
                  Array.from({ length: COLS }).map((__, col) => {
                    const cellVal = state.grid[row][col] ?? (
                      optimisticPawn?.roomCode === state.roomCode && optimisticPawn.row === row && optimisticPawn.col === col
                        ? optimisticPawn.playerId
                        : null
                    );
                    const filled = cellVal !== null;
                    const isSquareCell = inAnySquare(row, col);
                    const isFresh = inLastSquare(row, col);
                    const rawCellColor = players.find((p) => p.id === cellVal)?.color ?? "#52525b";
                    const cellColor = vividColor(rawCellColor);
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
                        className={`group relative aspect-square touch-manipulation rounded-full bg-[oklch(0.14_0.015_22)] ring-1 ring-white/10 outline-none transition focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-amber-300 ${
                          canPlay ? "cursor-pointer" : "cursor-default"
                        }`}
                        aria-label={`Placer un pion ligne ${row + 1} colonne ${col + 1}`}
                      >
                        {filled ? (
                          <motion.div
                            initial={false}
                            animate={isFresh
                              ? { scale: [1, 1.2, 1], opacity: 1, filter: ["brightness(1)", "brightness(1.7)", "brightness(1)"] }
                              : { scale: 1, opacity: 1 }}
                            transition={isFresh
                              ? { duration: 0.32, repeat: 1, ease: "easeInOut" }
                              : { duration: 0 }}
                            className={`absolute inset-[1px] flex items-center justify-center overflow-hidden rounded-full text-base leading-none shadow-[inset_0_2px_5px_rgba(255,255,255,0.5),inset_0_-5px_8px_rgba(0,0,0,0.35),0_3px_8px_rgba(0,0,0,0.65)] sm:text-xl ${
                              isFresh
                                ? "z-20 scale-105 ring-4 ring-white ring-offset-2 ring-offset-[#17100f]"
                                : isSquareCell
                                  ? "z-10 ring-[3px] ring-cyan-100 ring-offset-2 ring-offset-[#17100f] shadow-[0_0_10px_rgba(34,211,238,0.95)]"
                                  : "ring-2 ring-white/50"
                            }`}
                            style={{
                              background: `radial-gradient(circle at 32% 24%, rgba(255,255,255,.65), transparent 23%), linear-gradient(145deg, ${cellColor}, color-mix(in srgb, ${cellColor} 94%, black))`,
                              boxShadow: isFresh
                                ? "0 0 0 2px #fff, 0 0 7px 3px rgba(34,211,238,0.95), 0 0 18px 7px rgba(34,211,238,0.75), 0 0 34px 12px rgba(34,211,238,0.5)"
                                : undefined,
                              filter: isFresh ? `drop-shadow(0 0 8px ${squareHighlightColor})` : undefined,
                            }}
                          >
                            <span aria-hidden="true" className="pointer-events-none absolute left-[18%] top-[12%] h-[22%] w-[38%] -rotate-45 rounded-full bg-white/50 blur-[1px]" />
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
                  <p className="rounded-full bg-black/60 px-4 py-2 text-base text-amber-100">
                    En attente du tour de {current?.name}...
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reaction bar */}
          <div className="mx-auto w-full max-w-[340px] shrink-0 sm:max-w-[390px]">
            <div className="mb-1 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const enabled = !reactionSoundsOn;
                  setReactionSoundsOn(enabled);
                  setReactionSoundsEnabled(enabled);
                }}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
                aria-label={reactionSoundsOn ? "Désactiver le son des réactions" : "Activer le son des réactions"}
                title={reactionSoundsOn ? "Couper le son des réactions" : "Activer le son des réactions"}
              >
                {reactionSoundsOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                Son {reactionSoundsOn ? "activé" : "coupé"}
              </button>
            </div>
            <div className="grid w-full min-w-0 grid-cols-5 items-center gap-1 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.09] via-rose-400/[0.06] to-violet-400/[0.09] p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.04] sm:gap-2 sm:p-2">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReactionAction(emoji)}
                  className="flex aspect-square w-full min-w-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20 text-xl leading-none shadow-inner shadow-black/20 transition-all hover:scale-105 hover:border-amber-200/40 hover:bg-white/[0.08] active:scale-95 sm:rounded-2xl sm:text-2xl"
                  title={`Réagir avec ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Quit button */}
          <div className="flex shrink-0 justify-center pt-0 sm:pt-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleQuit}
              className="h-9 px-3 text-sm text-muted-foreground hover:text-foreground sm:h-12 sm:px-4 sm:text-base"
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
