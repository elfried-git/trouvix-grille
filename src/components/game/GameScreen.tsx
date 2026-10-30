"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Grid } from "./Grid";
import { Avatar } from "./Avatar";
import { useGameStore, GAME_CONSTANTS } from "@/store/game-store";
import { findBestMove } from "@/lib/ai";
import { vividColor } from "@/lib/color";
import { Button } from "@/components/ui/button";
import { Home, Timer, ScrollText, Pause } from "lucide-react";
import { BOMBARDMENT_UNLOCK_SCORE, findBombardmentTargets } from "@/lib/bombardment";
import { BombardmentToken } from "./BombardmentToken";
import { BombardmentDndProvider } from "./BombardmentDnd";
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
  const bombardmentEventId = useGameStore((s) => s.bombardmentEventId);
  const bombardmentPlayerId = useGameStore((s) => s.bombardmentPlayerId);
  const phase = useGameStore((s) => s.phase);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const turnTimeLeft = useGameStore((s) => s.turnTimeLeft);
  const resolving = useGameStore((s) => s.resolving);
  const isPaused = useGameStore((s) => s.isPaused);
  const togglePause = useGameStore((s) => s.togglePause);
  const totalRounds = useGameStore((s) => s.totalRounds);
  const currentRound = useGameStore((s) => s.currentRound);
  const lastDelta = useGameStore((s) => s.lastDelta);
  const tick = useGameStore((s) => s.tick);
  const bombard = useGameStore((s) => s.bombard);
  const endGameNow = useGameStore((s) => s.endGameNow);
  const backHome = useGameStore((s) => s.backHome);

  const current = players[currentPlayerIndex];

  // 10-second turn timer (ticks every 100ms, paused automatically via store)
  useEffect(() => {
    if (phase !== "playing" || resolving || isPaused) return;
    const id = setInterval(() => tick(0.1), 100);
    return () => clearInterval(id);
  }, [phase, resolving, isPaused, tick]);

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
      const opponentIds = s.players.filter((p) => p.id !== aiPlayer.id).map((p) => p.id);
      if (
        aiPlayer.score >= BOMBARDMENT_UNLOCK_SCORE &&
        !aiPlayer.bombardmentUsed &&
        findBombardmentTargets(s.grid, opponentIds).length > 0
      ) {
        s.bombard();
        return;
      }
      const move = findBestMove(s.grid, aiPlayer.id, opponentIds, aiPlayer.aiProfile);
      if (move) {
        s.placePawn(move.row, move.col);
      }
    }, 900);
    return () => clearTimeout(id);
  }, [currentPlayerIndex, resolving, isPaused, phase, current, grid, placePawn, bombard]);

  const timePct = Math.max(
    0,
    Math.min(100, (turnTimeLeft / GAME_CONSTANTS.TURN_SECONDS) * 100)
  );
  const urgent = turnTimeLeft <= 3 && !resolving && !isPaused;
  // Vivid, high-saturation color of the current player — same color the whole turn
  const turnColor = vividColor(current?.color ?? "#f59e0b");
  const bombTargets = current
    ? findBombardmentTargets(
      grid,
      players.filter((player) => player.id !== current.id).map((player) => player.id),
    )
    : [];
  return (
    <BombardmentDndProvider onBombard={bombard}>
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-6">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="trouvix-wordmark text-2xl" aria-label="Trouvix">
            <span className="trouvix-wordmark-red">Trouv</span>
            <span className="trouvix-wordmark-gold">ix</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-12 gap-2 px-4 text-base">
                <ScrollText className="h-4 w-4" />
                <span>Règles</span>
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
        </div>
      </div>

      {/* Main layout */}
      <div className="mx-auto flex w-full max-w-[700px] flex-1 flex-col gap-3 sm:gap-4">
        {/* Players list with live scores and active turn highlight */}
        <div className={`grid ${players.length <= 2 ? "grid-cols-2 max-w-md mx-auto justify-items-center" : players.length === 3 ? "grid-cols-3 max-w-xl mx-auto justify-items-center" : "grid-cols-2 sm:grid-cols-4"} gap-2 sm:gap-3 w-full`}>
          {players.map((p) => {
            const isActive = p.id === current?.id;
            const canClick = !(resolving && p.id === current?.id);
            return (
              <div
                role="button"
                tabIndex={canClick ? 0 : -1}
                aria-disabled={!canClick}
                onClick={(e) => {
                  if (!canClick) return;
                  if ((e.target as HTMLElement).closest("[data-bombardment-token]")) return;
                  if (p.id === current?.id) togglePause();
                  else endGameNow();
                }}
                onKeyDown={(e) => {
                  if (!canClick) return;
                  if (e.key === "Enter" || e.key === " ") {
                    if ((e.target as HTMLElement).closest("[data-bombardment-token]")) return;
                    e.preventDefault();
                    if (p.id === current?.id) togglePause();
                    else endGameNow();
                  }
                }}
                aria-label={p.id === current?.id ? `${isPaused ? "Reprendre" : "Mettre en pause"} la partie` : `Terminer la partie depuis le profil de ${p.name}`}
                title={p.id === current?.id ? `${isPaused ? "Reprendre" : "Mettre en pause"} la partie` : "Terminer la partie"}
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
                className={`w-full max-w-[150px] sm:max-w-[170px] mx-auto cursor-pointer text-inherit flex min-w-0 flex-col items-center gap-0.5 rounded-xl border-2 p-1 sm:p-1.5 text-center transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                  canClick ? "" : "cursor-wait opacity-80 "
                }${
                  isActive
                    ? "ring-2 ring-white/50 shadow-xl"
                    : "bg-card/40 border-border/40 opacity-75 backdrop-blur-md"
                }`}
              >
                <span className="relative z-20 inline-flex">
                  <Avatar
                    avatar={p.emoji}
                    color={p.color}
                    size={26}
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
                <div className="flex min-w-0 w-full flex-col items-center">
                  <div className="flex max-w-full min-h-[1.25rem] items-center justify-center gap-1">
                    <span className={`whitespace-normal break-words text-sm sm:text-base font-bold leading-tight ${isActive ? "text-white" : "text-foreground"}`}>
                      {p.name}
                    </span>
                    {p.bombardmentUsed ? (
                      <motion.span
                        key={`${p.id}-${bombardmentEventId}`}
                        initial={bombardmentPlayerId === p.id ? { opacity: 0, scale: 0.3 } : false}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                        className="pointer-events-none h-6 w-6 shrink-0 sm:h-7 sm:w-7"
                        aria-hidden="true"
                      >
                        <Image src="/images/boule-de-feu.png" alt="" width={224} height={230} className="h-full w-full object-contain" />
                      </motion.span>
                    ) : p.score >= BOMBARDMENT_UNLOCK_SCORE && !p.isAI ? (
                      <BombardmentToken
                        enabled={isActive && !resolving && !isPaused && phase === "playing"}
                        hasTargets={isActive && bombTargets.length > 0}
                        playerId={p.id}
                      />
                    ) : p.score >= BOMBARDMENT_UNLOCK_SCORE ? (
                      <span
                        title="Boule de feu disponible pour cette IA"
                        aria-label="Boule de feu disponible pour cette IA"
                        className="inline-flex h-6 w-6 shrink-0 sm:h-7 sm:w-7"
                      >
                        <Image src="/images/boule-de-feu.png" alt="" width={224} height={230} className="h-full w-full object-contain" />
                      </span>
                    ) : null}
                  </div>
                  {p.isAI && (
                    <span className="mt-0.5 rounded bg-violet-400/20 px-1.5 py-0.5 text-xs font-semibold text-violet-200">
                      IA
                    </span>
                  )}
                </div>
                <span className={`font-display text-base sm:text-lg font-black leading-none ${isActive ? "text-amber-300" : "text-amber-200/80"}`}>
                  {p.score} <span className="text-xs font-normal text-muted-foreground">pts</span>
                </span>
                <div className="mt-0.5 h-7 w-full" aria-hidden={!isActive}>
                {isActive && (
                  <div className="w-full space-y-1">
                    <div
                      className="flex items-center justify-center gap-1 font-display text-xs font-black tabular-nums"
                      style={{ color: isPaused ? "#34d399" : turnColor }}
                    >
                      {isPaused ? (
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

        {current && !current.isAI && current.score >= BOMBARDMENT_UNLOCK_SCORE && !current.bombardmentUsed && (
          <button
            type="button"
            className="sr-only focus:not-sr-only focus:fixed focus:bottom-4 focus:left-1/2 focus:z-50 focus:-translate-x-1/2 focus:rounded-lg focus:bg-orange-600 focus:px-4 focus:py-2 focus:text-white"
            disabled={resolving || isPaused || bombTargets.length === 0}
            onClick={bombard}
          >
            Utiliser le bombardement au clavier
          </button>
        )}

        {/* The board */}
        <Grid players={players} currentPlayerId={current?.id ?? null} isPaused={isPaused} />

        {/* Quit button */}
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={backHome}
            className="h-12 px-4 text-base text-muted-foreground hover:text-foreground"
          >
            <Home className="mr-1.5 h-4 w-4" /> Quitter la partie
          </Button>
        </div>
      </div>
    </div>
    </BombardmentDndProvider>
  );
}

function RulesContent({ totalRounds }: { totalRounds: number }) {
  return (
    <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
      <section>
        <h3 className="font-display text-lg font-semibold text-foreground">Le but</h3>
        <p className="mt-1">
          Place tes pions <span className="font-semibold text-amber-200">où tu le souhaites</span> dans
          la grille. Forme un <span className="font-semibold text-amber-200">carré de 4 pions</span> de
          ta couleur (un bloc 2×2) pour marquer 1 point. Les pions <span className="font-semibold text-amber-200">restent dans la grille</span> jusqu'à la fin du match — chaque carré formé reste visible. À la fin des {totalRounds} carrés, le joueur
          avec le plus de points devient le Champion Ultime.
        </p>
      </section>
      <section>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Placement libre
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Clique sur n'importe quelle case vide de la grille.</li>
          <li>Contrairement à un Puissance 4, le pion ne tombe pas : il reste où tu le poses.</li>
          <li>Stratégie : occupe l'espace, bloque l'adversaire, construis ton carré.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-display text-lg font-semibold text-foreground">
          Le chrono (10 s)
        </h3>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Tu as <span className="font-semibold text-rose-200">10 secondes</span> pour jouer.
          </li>
          <li>Si le chrono expire, tu perds la main et le tour passe au joueur suivant.</li>
          <li>
            Appuie sur le profil du joueur actif pour mettre la partie en pause ou la reprendre.
          </li>
          <li>À partir de 3 points, glisse la boule de feu sur la grille pour détruire les 3 pions du premier carré adverse presque formé. Utilisable une fois ; le bombardement termine ton tour.</li>
        </ul>
      </section>
      <section>
        <h3 className="font-display text-lg font-semibold text-foreground">
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
        <p className="mt-2 text-sm italic">Exemple de carré gagnant.</p>
      </section>
      <section>
        <h3 className="font-display text-lg font-semibold text-foreground">
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
