"use client";

import { motion } from "framer-motion";
import { CELLS, CATEGORY_META } from "@/lib/cells";
import type { Player, CellType } from "@/lib/types";
import { getCellCoord } from "@/lib/cells";

interface BoardProps {
  players: Player[];
  currentPlayerId: string | null;
}

const TYPE_STYLES: Record<CellType, { bg: string; ring: string; label: string; emoji: string }> = {
  start: { bg: "bg-gradient-to-br from-amber-500/30 to-amber-700/30", ring: "ring-amber-400/50", label: "Départ", emoji: "🚩" },
  end: { bg: "bg-gradient-to-br from-rose-500/40 to-rose-700/40", ring: "ring-rose-400/60", label: "Arrivée", emoji: "🏆" },
  histoire: { bg: "bg-rose-500/15", ring: "ring-rose-400/30", label: "Histoire", emoji: "🏛️" },
  geographie: { bg: "bg-amber-500/15", ring: "ring-amber-400/30", label: "Géographie", emoji: "🌍" },
  sciences: { bg: "bg-emerald-500/15", ring: "ring-emerald-400/30", label: "Sciences", emoji: "🔬" },
  arts: { bg: "bg-fuchsia-500/15", ring: "ring-fuchsia-400/30", label: "Arts", emoji: "🎭" },
  sport: { bg: "bg-lime-500/15", ring: "ring-lime-400/30", label: "Sport", emoji: "🏆" },
  joker: { bg: "bg-sky-500/15", ring: "ring-sky-400/30", label: "Joker", emoji: "🎁" },
};

export function Board({ players, currentPlayerId }: BoardProps) {
  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <div className="relative aspect-square w-full rounded-3xl border border-amber-400/20 bg-gradient-to-br from-[oklch(0.20_0.02_24)] to-[oklch(0.14_0.015_22)] p-2 shadow-2xl sm:p-3">
        <div className="relative grid h-full w-full gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))", gridTemplateRows: "repeat(16, minmax(0, 1fr))" }}
        >
          {CELLS.map((cell) => {
            const style = TYPE_STYLES[cell.type];
            const isStart = cell.type === "start";
            const isEnd = cell.type === "end";
            return (
              <div
                key={cell.index}
                className={`relative flex items-center justify-center rounded-md ring-1 ${style.bg} ${style.ring} text-[8px] sm:text-[10px] md:text-xs`}
                style={{
                  gridColumn: cell.col + 1,
                  gridRow: cell.row + 1,
                }}
                title={`Case ${cell.index} — ${style.label}`}
              >
                <span className="leading-none">{style.emoji}</span>
                {(isStart || isEnd) && (
                  <span className="absolute -bottom-0.5 left-0 right-0 text-center text-[6px] font-semibold text-amber-100/80 sm:text-[8px]">
                    {isStart ? "DÉPART" : "ARRIVÉE"}
                  </span>
                )}
              </div>
            );
          })}

          {/* Center decoration */}
          <div
            className="pointer-events-none flex flex-col items-center justify-center text-center"
            style={{ gridColumn: "4 / 13", gridRow: "4 / 13" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col items-center gap-1"
            >
              <div className="text-2xl sm:text-3xl">🎓</div>
              <h2 className="font-display text-lg font-bold tracking-wide text-gold-gradient sm:text-3xl md:text-4xl">
                DUO DÉFI
              </h2>
              <p className="font-display text-[10px] italic tracking-widest text-amber-200/70 sm:text-sm">
                Culture Générale
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-base sm:text-xl">
                <span>🏛️</span>
                <span>🌍</span>
                <span>🔬</span>
                <span>🎭</span>
                <span>🏆</span>
                <span>🎁</span>
              </div>
            </motion.div>
          </div>

          {/* Pawns overlay */}
          {players.map((p, i) => {
            const pos = p.position < 0 ? 0 : p.position;
            const { row, col } = getCellCoord(pos);
            const left = ((col + 0.5) / 16) * 100;
            const top = ((row + 0.5) / 16) * 100;
            // offset for multiple pawns
            const sameCellCount = players.filter(
              (pp) => (pp.position < 0 ? 0 : pp.position) === pos
            ).length;
            const myIndex = players
              .filter((pp) => (pp.position < 0 ? 0 : pp.position) === pos)
              .findIndex((pp) => pp.id === p.id);
            const offsetX = sameCellCount > 1 ? (myIndex - (sameCellCount - 1) / 2) * 14 : 0;
            const isCurrent = p.id === currentPlayerId;
            return (
              <motion.div
                key={p.id}
                className="pointer-events-none absolute z-20"
                initial={false}
                animate={{ left: `${left}%`, top: `${top}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 16, duration: 1 }}
                style={{
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className={`relative flex h-6 w-6 items-center justify-center rounded-full text-xs shadow-lg sm:h-8 sm:w-8 sm:text-base ${
                    isCurrent ? "ring-2 ring-amber-300 pulse-glow" : "ring-2 ring-white/30"
                  }`}
                  style={{ backgroundColor: p.color, marginLeft: `${offsetX}px` }}
                  title={p.name}
                >
                  <span className="drop-shadow">{p.emoji}</span>
                  {isCurrent && (
                    <motion.span
                      layoutId={`pawn-ring-${p.id}`}
                      className="absolute -inset-1 rounded-full border-2 border-amber-300/70"
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
