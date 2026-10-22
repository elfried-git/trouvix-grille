"use client";

import { motion } from "framer-motion";
import { useGameStore, GAME_CONSTANTS } from "@/store/game-store";
import type { Player } from "@/lib/types";
import { vividColor } from "@/lib/color";

const { ROWS, COLS } = GAME_CONSTANTS;

interface GridProps {
  players: Player[];
  currentPlayerId: string | null;
  isPaused: boolean;
}

export function Grid({ players, currentPlayerId, isPaused }: GridProps) {
  const grid = useGameStore((s) => s.grid);
  const resolving = useGameStore((s) => s.resolving);
  const lastSquareCells = useGameStore((s) => s.lastSquareCells);
  const formedSquares = useGameStore((s) => s.formedSquares);
  const placePawn = useGameStore((s) => s.placePawn);

  const cur = players.find((p) => p.id === currentPlayerId) ?? null;
  const playerColor = (id: string | null) => {
    const color = players.find((p) => p.id === id)?.color ?? "#52525b";
    return vividColor(color);
  };
  const interactive = !!cur && !resolving && !isPaused && !cur.isAI;

  // Cells part of ANY formed square (persistent golden highlight)
  const inAnySquare = (r: number, c: number) =>
    formedSquares.some((sq) =>
      sq.cells.some((cell) => cell.row === r && cell.col === c)
    );
  // Cells of the just-formed square (extra pulse animation)
  const inLastSquare = (r: number, c: number) =>
    !!lastSquareCells?.some((cell) => cell.row === r && cell.col === c);

  return (
    <div className="mx-auto w-full max-w-[min(640px,calc(100vw-1rem))]">
      {/* Board */}
      <div className="relative rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[oklch(0.22_0.025_24)] to-[oklch(0.15_0.018_22)] p-1 shadow-2xl sm:rounded-3xl sm:p-2">
        <div
          aria-label="Grille de jeu, 10 lignes et 10 colonnes"
          className="relative z-10 grid gap-px rounded-xl bg-[oklch(0.23_0.02_22)] p-px sm:gap-1 sm:p-1"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: ROWS }).map((_, row) =>
            Array.from({ length: COLS }).map((__, col) => {
              const cellVal = grid[row][col];
              const filled = cellVal !== null;
              const isSquareCell = inAnySquare(row, col);
              const isFresh = inLastSquare(row, col);
              return (
                <button
                  key={`${row}-${col}`}
                  type="button"
                  disabled={filled || !interactive}
                  onClick={() => placePawn(row, col)}
                  className="group relative aspect-square touch-manipulation rounded-full bg-[oklch(0.14_0.015_22)] ring-1 ring-white/10 outline-none transition disabled:cursor-not-allowed focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-amber-300"
                  aria-label={filled ? `Case occupée, ligne ${row + 1} colonne ${col + 1}` : `Placer un pion ligne ${row + 1} colonne ${col + 1}`}
                >
                  {filled ? (
                    <motion.div
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 360, damping: 18 }}
                      className={`absolute inset-[1px] flex items-center justify-center overflow-hidden rounded-full text-base leading-none shadow-[inset_0_2px_5px_rgba(255,255,255,0.5),inset_0_-5px_8px_rgba(0,0,0,0.35),0_3px_8px_rgba(0,0,0,0.65)] transition-transform ${
                        isFresh
                          ? "z-20 scale-105 ring-4 ring-white ring-offset-2 ring-offset-[#17100f] shadow-[0_0_14px_rgba(34,211,238,1)] pulse-glow"
                          : isSquareCell
                            ? "z-10 ring-[3px] ring-cyan-100 ring-offset-2 ring-offset-[#17100f] shadow-[0_0_10px_rgba(34,211,238,0.95)]"
                            : "ring-2 ring-white/50"
                      }`}
                      style={{
                        background: `radial-gradient(circle at 32% 24%, rgba(255,255,255,.65), transparent 23%), linear-gradient(145deg, ${playerColor(cellVal)}, color-mix(in srgb, ${playerColor(cellVal)} 94%, black))`,
                      }}
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute left-[18%] top-[12%] h-[22%] w-[38%] -rotate-45 rounded-full bg-white/50 blur-[1px]" />
                    </motion.div>
                  ) : (
                    // Ghost preview of the current player's pawn
                    interactive && (
                      <div
                        className="absolute inset-[2px] rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-50"
                        style={{ backgroundColor: cur!.color }}
                      />
                    )
                  )}
                </button>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
