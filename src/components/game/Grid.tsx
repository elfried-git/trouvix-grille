"use client";

import { motion } from "framer-motion";
import { useGameStore, GAME_CONSTANTS } from "@/store/game-store";
import type { Player } from "@/lib/types";

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
  const playerColor = (id: string | null) =>
    players.find((p) => p.id === id)?.color ?? "#52525b";
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
    <div className="mx-auto w-full max-w-[min(560px,calc(100vw-1.5rem))]">
      {/* Board */}
      <div className="relative rounded-2xl border border-amber-400/20 bg-gradient-to-br from-[oklch(0.22_0.025_24)] to-[oklch(0.15_0.018_22)] p-1 shadow-2xl sm:rounded-3xl sm:p-2">
        <div
          className="grid gap-0.5 sm:gap-1.5"
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
                  className="group relative aspect-square touch-manipulation rounded-full bg-[oklch(0.10_0.015_22)] ring-1 ring-black/40 outline-none transition disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-300/60"
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
                      style={{ backgroundColor: playerColor(cellVal) }}
                    >
                      {/* Star badge on cells that are part of a formed square */}
                      {isSquareCell && !isFresh && (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs drop-shadow">
                          ⭐
                        </span>
                      )}
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
