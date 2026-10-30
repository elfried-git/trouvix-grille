"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useOnlineStore } from "@/store/online-store";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { ResultRanking, WinnerHero } from "./GameResultPresentation";
import { Button } from "@/components/ui/button";
import { findBestMove } from "@/lib/ai";
import { vividColor, pawnColor } from "@/lib/color";
import { Home, Timer, Pause, WifiOff, Swords, RotateCcw, Plus, Volume2, VolumeX } from "lucide-react";
import { areReactionSoundsEnabled, setReactionSoundsEnabled } from "@/lib/reaction-sounds";
import { BOMBARDMENT_UNLOCK_SCORE, findBombardmentTargets } from "@/lib/bombardment";
import { BombardmentToken } from "./BombardmentToken";
import { BombardmentDndProvider, BombardmentDropZone } from "./BombardmentDnd";

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
    : null, [state]);

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
      const opponentIds = s.players.filter((p) => p.id !== aiPlayer.id).map((p) => p.id);
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
  const boardRef = useRef<HTMLDivElement>(null);
  const [reactionBounds, setReactionBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
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
    const updateBounds = () => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      setReactionBounds({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };
    updateBounds();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateBounds) : null;
    if (boardRef.current) observer?.observe(boardRef.current);
    window.addEventListener("resize", updateBounds);
    window.addEventListener("scroll", updateBounds, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateBounds);
      window.removeEventListener("scroll", updateBounds, true);
    };
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
    !!activeSquareEvent?.cells.some((cell) => cell.row === r && cell.col === c);

  const timePct = Math.max(0, Math.min(100, (turnTimeLeft / 10) * 100));
  const urgent = turnTimeLeft <= 3 && !state.resolving && !state.isPaused;
  // Vivid, high-saturation color of the current player — same color the whole turn
  const turnColor = vividColor(current?.color ?? "#f59e0b");
  const squareHighlightColor = vividColor(
    activeSquareEvent?.color ?? state.players.find((player) => player.id === state.lastSquareerId)?.color ?? "#f59e0b"
  );
  const squareCenter = activeSquareEvent
    ? {
        x: ((activeSquareEvent.cells.reduce((sum, cell) => sum + cell.col, 0) / activeSquareEvent.cells.length + 0.5) / COLS) * 100,
        y: ((activeSquareEvent.cells.reduce((sum, cell) => sum + cell.row, 0) / activeSquareEvent.cells.length + 0.5) / ROWS) * 100,
      }
    : null;

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
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-start px-4 pt-3 pb-4 sm:justify-center sm:py-4">
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

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {(amHost || connectedTiedPlayers.some((p) => p.id === myId)) && (
                <Button
                  onClick={rematchTiedAction}
                  size="lg"
                  disabled={!hasEnoughTiedToRematch}
                  className="h-14 px-8 text-lg font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-[0_8px_24px_rgba(139,92,246,0.5)] transition hover:scale-105 hover:from-violet-500 hover:to-fuchsia-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Swords className="mr-2 h-6 w-6" />
                  Départager
                </Button>
              )}
              <Button
                onClick={handleNewGame}
                size="lg"
                variant="outline"
                className="h-14 px-6 text-base"
              >
                <Plus className="mr-2 h-5 w-5" />
                Nouveau salon
              </Button>
              <Button onClick={handleQuit} size="lg" variant="outline" className="h-14 px-6 text-base">
                <Home className="mr-2 h-5 w-5" /> Accueil
              </Button>
              {!hasEnoughTiedToRematch && (
                <p className="w-full text-center text-xs text-rose-300/90 mt-1 font-medium">
                  Les autres joueurs à égalité ne sont plus connectés.
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
    <BombardmentDndProvider onBombard={bombardAction}>
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

      <div className="mx-auto flex min-h-0 w-full max-w-[700px] flex-1 flex-col gap-2 sm:gap-3">
        {/* Players list with live scores and active turn highlight */}
        <div className={`grid ${players.length <= 2 ? "grid-cols-2 max-w-md mx-auto" : players.length === 3 ? "grid-cols-3 max-w-xl mx-auto" : "grid-cols-2 sm:grid-cols-4"} gap-1.5 sm:gap-2.5 w-full shrink-0`}>
          {players.map((p) => {
            const isActive = p.id === current?.id;
            const isMe = p.id === myId;
            const isDisconnected = p.connected === false;
            const canClick = !((state.resolving && isMe) || !myId);
            return (
              <div
                role="button"
                tabIndex={canClick ? 0 : -1}
                aria-disabled={!canClick}
                onClick={(e) => {
                  if (!canClick) return;
                  if ((e.target as HTMLElement).closest("[data-bombardment-token]")) return;
                  if (isMe) togglePauseAction();
                  else endGameAction();
                }}
                onKeyDown={(e) => {
                  if (!canClick) return;
                  if (e.key === "Enter" || e.key === " ") {
                    if ((e.target as HTMLElement).closest("[data-bombardment-token]")) return;
                    e.preventDefault();
                    if (isMe) togglePauseAction();
                    else endGameAction();
                  }
                }}
                aria-label={isMe ? `${state.isPaused ? "Reprendre" : "Mettre en pause"} la partie` : `Terminer la partie depuis le profil de ${p.name}`}
                title={isMe ? `${state.isPaused ? "Reprendre" : "Mettre en pause"} la partie` : "Terminer la partie"}
                key={p.id}
                style={
                  isActive
                    ? {
                        borderColor: turnColor,
                        backgroundColor: `${turnColor}22`,
                        boxShadow: `0 0 20px -2px ${turnColor}, 0 0 36px ${turnColor}60, inset 0 0 12px ${turnColor}25`,
                      }
                    : undefined
                }
                className={`w-full cursor-pointer text-inherit flex min-w-0 flex-col items-center gap-1 rounded-xl border-2 p-1.5 sm:p-2 text-center transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                  canClick ? "" : "cursor-wait opacity-80 "
                }${
                  isActive
                    ? "ring-2 ring-white/50 shadow-xl"
                    : "bg-card/40 border-border/40 opacity-75 backdrop-blur-md"
                } ${isDisconnected ? "opacity-40 line-through" : ""}`}
              >
                <span className="relative z-20 inline-flex">
                  <Avatar
                    avatar={p.emoji}
                    color={p.color}
                    size={42}
                    emojiSize="text-xl sm:text-2xl"
                    ring={false}
                    className={isActive ? "ring-2" : "ring-2 ring-white/20"}
                    style={
                      isActive
                        ? { boxShadow: `0 0 0 2px ${p.color}, 0 0 14px 2px ${p.color}cc` }
                        : undefined
                    }
                  />
                </span>
                <div className="flex min-w-0 w-full min-h-[1.25rem] flex-wrap items-center justify-center gap-x-1">
                  <span className={`whitespace-normal break-words text-center text-xs sm:text-sm font-bold leading-tight ${isActive ? "text-white" : "text-foreground"}`}>
                    {p.name}
                  </span>
                  {p.bombardmentUsed ? (
                    <motion.span
                      key={`${p.id}-${state.bombardmentEventId}`}
                      initial={state.bombardmentPlayerId === p.id ? { opacity: 0, scale: 0.3 } : false}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="pointer-events-none h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                      aria-hidden="true"
                    >
                      <Image src="/images/boule-de-feu.png" alt="" width={224} height={230} className="h-full w-full object-contain" />
                    </motion.span>
                  ) : p.score >= BOMBARDMENT_UNLOCK_SCORE && !p.isAI ? (
                    <BombardmentToken
                      enabled={isMe && isMyTurn && !state.resolving && !state.isPaused && state.phase === "playing"}
                      hasTargets={isMe && isMyTurn && bombTargets.length > 0}
                      playerId={p.id}
                    />
                  ) : p.score >= BOMBARDMENT_UNLOCK_SCORE ? (
                    <span
                      title="Boule de feu disponible pour cette IA"
                      aria-label="Boule de feu disponible pour cette IA"
                      className="inline-flex h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                    >
                      <Image src="/images/boule-de-feu.png" alt="" width={224} height={230} className="h-full w-full object-contain" />
                    </span>
                  ) : null}
                  {isMe && (
                    <span className="rounded bg-amber-400/20 px-1 py-0.5 text-[9px] font-semibold leading-none text-amber-200 sm:px-1.5 sm:text-[10px]">
                      Toi
                    </span>
                  )}
                  {p.isAI && (
                    <span className="rounded bg-violet-400/20 px-1 py-0.5 text-[9px] font-semibold leading-none text-violet-200 sm:px-1.5 sm:text-[10px]">
                      IA
                    </span>
                  )}
                </div>
                <span className={`font-display text-sm sm:text-base font-black leading-none ${isActive ? "text-amber-300" : "text-amber-200/80"}`}>
                  {p.score} <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">pts</span>
                </span>
                <div className="mt-0.5 h-7 w-full" aria-hidden={!isActive}>
                {isActive && (
                  <div className="w-full space-y-1">
                    <div
                      className="flex items-center justify-center gap-1 font-display text-[10px] sm:text-xs font-black tabular-nums"
                      style={{ color: state.isPaused ? "#34d399" : turnColor }}
                    >
                      {state.isPaused ? (
                        <>
                          <Pause className="h-3 w-3" /> Pause
                        </>
                      ) : (
                        <>
                          <Timer className="h-3 w-3" />
                          {turnTimeLeft.toFixed(1)}s
                        </>
                      )}
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/40 ring-1 ring-white/10">
                      <motion.div
                        className="h-full rounded-full transition-all"
                        style={{
                          backgroundColor: turnColor,
                          boxShadow: `0 0 10px ${turnColor}`,
                        }}
                        animate={{ width: `${timePct}%` }}
                        transition={{ duration: 0.1, ease: "linear" }}
                      />
                    </div>
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>

          {isMyTurn && !current?.isAI && current && current.score >= BOMBARDMENT_UNLOCK_SCORE && !current.bombardmentUsed && (
            <button
              type="button"
              className="sr-only focus:not-sr-only focus:fixed focus:bottom-4 focus:left-1/2 focus:z-50 focus:-translate-x-1/2 focus:rounded-lg focus:bg-orange-600 focus:px-4 focus:py-2 focus:text-white"
              disabled={state.resolving || state.isPaused || bombTargets.length === 0}
              onClick={bombardAction}
            >
              Utiliser le bombardement au clavier
            </button>
          )}

          {/* Board */}
          <div ref={boardRef} className="mx-auto w-full min-w-0 max-w-[min(680px,calc(100vw-1rem))] shrink-0">
            <BombardmentDropZone
              className={`relative rounded-2xl border-2 border-amber-400/35 bg-gradient-to-br from-[#22131f] to-[#140b15] p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_2px_4px_rgba(255,255,255,0.1)] sm:rounded-3xl ${bombardmentFlash ? "bombardment-flash" : ""}`}
            >
              <div className="relative z-20 grid gap-1.5 rounded-xl bg-black/40 p-1 sm:gap-2 bg-[radial-gradient(circle,rgba(251,191,36,0.12)_1.5px,transparent_2px)] bg-[length:14px_14px]" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}>
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
                    const cellColor = pawnColor(rawCellColor);
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
                        className={`group relative aspect-square touch-manipulation rounded-full bg-[#180f1a] ring-1 ring-amber-300/15 shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] outline-none transition focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-amber-300 ${
                          canPlay ? "cursor-pointer" : "cursor-default"
                        }`}
                        aria-label={`Placer un pion ligne ${row + 1} colonne ${col + 1}`}
                      >
                        {filled ? (
                          <div
                            className={`absolute inset-[5%] flex items-center justify-center overflow-hidden rounded-full text-base leading-none shadow-[inset_0_2px_5px_rgba(255,255,255,0.5),inset_0_-5px_8px_rgba(0,0,0,0.35),0_3px_8px_rgba(0,0,0,0.65)] sm:text-xl ${
                              isFresh
                                ? "square-cell-pop z-20 ring-4 ring-white ring-offset-2 ring-offset-[#17100f]"
                                : isSquareCell
                                  ? "z-10 ring-[3px] ring-cyan-100 ring-offset-2 ring-offset-[#17100f] shadow-[0_0_10px_rgba(34,211,238,0.95)]"
                                  : ""
                            }`}
                            style={{
                              background: `radial-gradient(circle at 32% 24%, rgba(255,255,255,.65), transparent 23%), linear-gradient(145deg, ${cellColor}, color-mix(in srgb, ${cellColor} 94%, black))`,
                            }}
                          >
                            <span aria-hidden="true" className="pointer-events-none absolute left-[18%] top-[12%] h-[22%] w-[38%] -rotate-45 rounded-full bg-white/50 blur-[1px]" />
                          </div>
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

              <AnimatePresence>
                {activeSquareEvent && squareCenter && (
                  <motion.svg
                    key={`square-ripple-${activeSquareEvent.eventId}`}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-40 h-full w-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <motion.circle
                      cx={squareCenter.x}
                      cy={squareCenter.y}
                      initial={{ r: 0, opacity: 0.85 }}
                      animate={{ r: 150, opacity: 0 }}
                      transition={{ duration: 0.48, ease: "easeOut" }}
                      fill="none"
                      stroke={squareHighlightColor}
                      strokeWidth="0.55"
                      vectorEffect="non-scaling-stroke"
                    />
                  </motion.svg>
                )}
              </AnimatePresence>

              {/* Not-your-turn overlay */}
              {!isMyTurn && state.phase === "playing" && !state.resolving && !state.isPaused && (
                <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center rounded-3xl bg-black/30 p-4">
                  <p className="rounded-full bg-black/60 px-4 py-2 text-base text-amber-100">
                    En attente du tour de {current?.name}...
                  </p>
                </div>
              )}
            </BombardmentDropZone>
          </div>

          {/* Floating emoji reactions portal above grid */}
          {typeof document !== "undefined" && reactionBounds && reactions.length > 0 && createPortal(
            <div className="pointer-events-none fixed inset-0" style={{ zIndex: 2147483647 }}>
              <AnimatePresence>
                {reactions.map((reaction) => {
                  const startTop = reactionBounds.top + reactionBounds.height * 0.88;
                  const middleTop = reactionBounds.top + reactionBounds.height * 0.45;
                  const centerLeft = reactionBounds.left + reactionBounds.width / 2 + ((reaction.timestamp % 9) - 4) * 24;
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
                      className="absolute -ml-7 -mt-7 select-none text-6xl drop-shadow-[0_4px_12px_rgba(0,0,0,0.85)] sm:text-7xl"
                    >
                      {reaction.emoji}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>,
            document.body
          )}

          {/* Reaction bar */}
          <div className="mx-auto w-full max-w-[360px] shrink-0 sm:max-w-[420px]">
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
            <div className="grid w-full min-w-0 grid-cols-5 items-center gap-1.5 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.09] via-rose-400/[0.06] to-violet-400/[0.09] p-2 shadow-[0_8px_24px_rgba(0,0,0,0.24)] ring-1 ring-white/[0.04] sm:gap-2.5 sm:p-2.5">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => sendReactionAction(emoji)}
                  className="flex aspect-square w-full min-w-0 items-center justify-center rounded-xl border border-white/[0.07] bg-black/20 text-2xl leading-none shadow-inner shadow-black/20 transition-all hover:scale-110 hover:border-amber-200/40 hover:bg-white/[0.08] active:scale-95 sm:rounded-2xl sm:text-3xl"
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
    </>
    </BombardmentDndProvider>
  );
}
