"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/lib/types";
import type { GridCell } from "@/store/game-store";
import { Crown, Timer } from "lucide-react";
import { Avatar } from "./Avatar";

interface PlayerPanelProps {
  players: Player[];
  currentPlayerId: string | null;
  lastDelta: { playerId: string; delta: number } | null;
  grid: GridCell[][];
}

export function PlayerPanel({
  players,
  currentPlayerId,
  lastDelta,
  grid,
}: PlayerPanelProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const leader = sorted[0];

  // Count pions each player has on the grid
  const pionCount = (id: string) =>
    grid.reduce(
      (sum, row) => sum + row.filter((cell) => cell === id).length,
      0
    );

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-display text-sm font-semibold uppercase tracking-widest text-amber-200/70">
        Joueurs
      </h3>
      <div className="flex max-h-[440px] flex-col gap-2 overflow-y-auto scroll-romantic pr-1">
        {players.map((p) => {
          const isCurrent = p.id === currentPlayerId;
          const isLeader = leader && p.id === leader.id && p.score > 0;
          const delta =
            lastDelta && lastDelta.playerId === p.id ? lastDelta.delta : null;
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
              {isCurrent && (
                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-amber-300 to-rose-500" />
              )}
              <div className="flex items-center gap-3">
                <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-display text-sm font-semibold text-foreground">
                      {p.name}
                    </p>
                    {isLeader && <Crown className="h-3.5 w-3.5 text-amber-300" />}
                    {p.isAI && (
                      <span className="rounded-full bg-violet-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-200">
                        IA
                      </span>
                    )}
                    {isCurrent && (
                      <span className="flex items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200">
                        <Timer className="h-2.5 w-2.5" /> À toi
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground sm:text-[11px]">
                    {p.alignments} carré{p.alignments > 1 ? "s" : ""} · {pionCount(p.id)} pion{pionCount(p.id) > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="relative text-right">
                  <motion.p
                    key={p.score}
                    initial={{
                      scale: 1.3,
                      color:
                        delta && delta > 0
                          ? "#fbbf24"
                          : delta && delta < 0
                            ? "#f87171"
                            : "#f5f0e8",
                    }}
                    animate={{ scale: 1, color: "#f5f0e8" }}
                    className="font-display text-3xl font-bold sm:text-2xl"
                  >
                    {p.score}
                  </motion.p>
                  <p className="text-[9px] text-muted-foreground">points</p>
                  <AnimatePresence>
                    {delta !== null && delta !== 0 && (
                      <motion.span
                        initial={{ opacity: 0, y: 0 }}
                        animate={{ opacity: 1, y: -16 }}
                        exit={{ opacity: 0 }}
                        className={`absolute -top-1 right-0 text-xs font-bold ${
                          delta > 0 ? "text-amber-300" : "text-rose-400"
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
