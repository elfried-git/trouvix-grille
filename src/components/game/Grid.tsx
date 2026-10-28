"use client";

import { useGameStore, GAME_CONSTANTS } from "@/store/game-store";
import type { Player } from "@/lib/types";
import { vividColor } from "@/lib/color";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BombardmentDropZone } from "./BombardmentDnd";

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
  const lastSquareerId = useGameStore((s) => s.lastSquareerId);
  const formedSquares = useGameStore((s) => s.formedSquares);
  const placePawn = useGameStore((s) => s.placePawn);
  const bombardmentEventId = useGameStore((s) => s.bombardmentEventId);
  const [bombardmentFlash, setBombardmentFlash] = useState(false);
  const handledBombardmentRef = useRef(bombardmentEventId);

  useEffect(() => {
    if (bombardmentEventId == null || bombardmentEventId === handledBombardmentRef.current) return;
    handledBombardmentRef.current = bombardmentEventId;
    setBombardmentFlash(true);
    const timeout = window.setTimeout(() => setBombardmentFlash(false), 1500);
    return () => window.clearTimeout(timeout);
  }, [bombardmentEventId]);

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
  const squareCenter = lastSquareCells?.length
    ? {
        x: ((lastSquareCells.reduce((sum, cell) => sum + cell.col, 0) / lastSquareCells.length + 0.5) / COLS) * 100,
        y: ((lastSquareCells.reduce((sum, cell) => sum + cell.row, 0) / lastSquareCells.length + 0.5) / ROWS) * 100,
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-[min(680px,calc(100vw-1rem))]">
      {/* Board */}
      <BombardmentDropZone className={`relative rounded-2xl border border-amber-400/30 bg-gradient-to-br from-[oklch(0.22_0.025_24)] to-[oklch(0.15_0.018_22)] p-1 shadow-2xl sm:rounded-3xl sm:p-2 ${bombardmentFlash ? "bombardment-flash" : ""}`}>
        <div
          aria-label="Grille de jeu, 10 lignes et 10 colonnes"
          className="relative z-10 grid gap-px rounded-xl bg-[oklch(0.23_0.02_22)] p-px sm:gap-1.5 sm:p-1.5"
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
                    <div
                      className={`absolute inset-[1px] flex items-center justify-center overflow-hidden rounded-full text-base leading-none shadow-[inset_0_2px_5px_rgba(255,255,255,0.5),inset_0_-5px_8px_rgba(0,0,0,0.35),0_3px_8px_rgba(0,0,0,0.65)] ${
                        isFresh
                          ? "square-cell-pop z-20 ring-4 ring-white ring-offset-2 ring-offset-[#17100f] shadow-[0_0_14px_rgba(34,211,238,1)]"
                          : isSquareCell
                            ? "z-10 ring-[3px] ring-cyan-100 ring-offset-2 ring-offset-[#17100f] shadow-[0_0_10px_rgba(34,211,238,0.95)]"
                            : "ring-2 ring-white/50"
                      }`}
                      style={{
                        background: `radial-gradient(circle at 32% 24%, rgba(255,255,255,.65), transparent 23%), linear-gradient(145deg, ${playerColor(cellVal)}, color-mix(in srgb, ${playerColor(cellVal)} 94%, black))`,
                      }}
                    >
                      <span aria-hidden="true" className="pointer-events-none absolute left-[18%] top-[12%] h-[22%] w-[38%] -rotate-45 rounded-full bg-white/50 blur-[1px]" />
                    </div>
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
        {squareCenter && lastSquareCells && (
          <motion.svg
            key={`${lastSquareerId}-${lastSquareCells.map(({ row, col }) => `${row}:${col}`).join(",")}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-30 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <motion.circle
              cx={squareCenter.x}
              cy={squareCenter.y}
              initial={{ r: 0, opacity: 0.85 }}
              animate={{ r: 150, opacity: 0 }}
              transition={{ duration: 0.48, ease: "easeOut" }}
              fill="none"
              stroke={vividColor(players.find((player) => player.id === lastSquareerId)?.color ?? "#f59e0b")}
              strokeWidth="0.55"
              vectorEffect="non-scaling-stroke"
            />
          </motion.svg>
        )}
      </BombardmentDropZone>
    </div>
  );
}
