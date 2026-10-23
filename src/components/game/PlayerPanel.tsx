"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/lib/types";
import type { GridCell } from "@/store/game-store";
import { Crown, Timer, Trophy } from "lucide-react";
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
      <h3 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-[0.16em] text-amber-100">
        <Trophy className="h-4 w-4 text-amber-300" /> Joueurs
      </h3>
      <div className="flex max-h-[440px] flex-col gap-2 overflow-y-auto scroll-romantic pr-1">
        {players.map((p) => {
          const isCurrent = p.id === currentPlayerId;
          const isLeader = leader && p.id === leader.id && p.score > 0;
          const delta =
            lastDelta && lastDelta.playerId === p.id ? lastDelta.delta : null;
          const accent = p.color || "#a78bfa";
          return (
            <motion.div
              key={p.id}
              layout
              style={{
                background: `linear-gradient(#1b111c, #1b111c) padding-box, linear-gradient(115deg, ${accent}, ${accent}33 62%, #ffffff18) border-box`,
                boxShadow: isCurrent ? `0 0 24px ${accent}55, inset 0 0 24px ${accent}16` : `0 5px 18px #00000035`,
              }}
              className={`relative overflow-hidden rounded-2xl border border-transparent p-4 transition-all sm:p-3 ${
                isCurrent ? "scale-[1.015]" : "hover:-translate-y-0.5 hover:shadow-xl"
              }`}
            >
              <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl opacity-25" style={{ backgroundColor: accent }} />
              <div aria-hidden="true" className="absolute bottom-0 left-4 right-4 h-px opacity-50" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
              <div className="flex items-center gap-3">
                <div className="relative rounded-full p-[2px] shadow-lg" style={{ background: `linear-gradient(135deg, #ffffff, ${accent}, #24142b)` }}>
                  <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" ring={false} />
                  {isLeader && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-300 text-[11px] text-amber-950 shadow"><Crown className="h-3 w-3" /></span>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-display text-base font-bold text-white">
                      {p.name}
                    </p>
                    {p.isAI && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: `${accent}55` }}>
                        IA
                      </span>
                    )}
                    {isCurrent && (
                      <span className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: accent }}>
                        <Timer className="h-2.5 w-2.5" /> À toi
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-white/60">
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
                    className="font-display text-3xl font-black text-white sm:text-2xl"
                  >
                    {p.score}
                  </motion.p>
                  <p className="text-sm text-muted-foreground">points</p>
                  <AnimatePresence>
                    {delta !== null && delta !== 0 && (
                      <motion.span
                        initial={{ opacity: 0, y: 0 }}
                        animate={{ opacity: 1, y: -16 }}
                        exit={{ opacity: 0 }}
                        className={`absolute -top-1 right-0 text-sm font-bold ${
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
