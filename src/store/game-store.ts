"use client";

import { create } from "zustand";
import { toast } from "@/hooks/use-toast";
import type { Phase, Player } from "@/lib/types";

// ====== Game constants ======
const ROWS = 10;
const COLS = 10;
const TURN_SECONDS = 10; // 10 seconds per move
const ROUND_OPTIONS = [5, 10, 15] as const;

export const GAME_CONSTANTS = {
  ROWS,
  COLS,
  TURN_SECONDS,
  ROUND_OPTIONS,
};

export type GridCell = string | null; // player id or null

export interface SetupPlayer {
  name: string;
  color: string;
  emoji: string;
  isAI?: boolean;
}

interface GameState {
  phase: Phase;
  players: Player[];
  currentPlayerIndex: number;
  grid: GridCell[][];
  turnTimeLeft: number; // seconds (float)
  statusMessage: string;
  winnerId: string | null;
  lastSquareCells: { row: number; col: number }[] | null; // just-formed square (brief celebration)
  lastSquareerId: string | null;
  formedSquares: { cells: { row: number; col: number }[]; playerId: string }[]; // ALL squares formed (persistent highlight)
  resolving: boolean;
  isPaused: boolean;
  totalRounds: number; // chosen match length (5, 10, 15)
  currentRound: number; // rounds elapsed so far (squares formed by anyone)
  lastDelta: { playerId: string; delta: number } | null;
  endReason: string | null; // 'rounds' | 'board-full' | 'stalemate' | null

  goToSetup: () => void;
  goToOnlineSetup: () => void;
  goToReviews: () => void;
  startGame: (players: SetupPlayer[], rounds: number) => void;
  backHome: () => void;
  placePawn: (row: number, col: number) => void; // free placement
  togglePause: () => void;
  tick: (dt: number) => void;
  endGameNow: () => void;
  restart: () => void;
  rematchTied: () => void; // restart with only the tied players (those sharing the max score)
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyGrid(): GridCell[][] {
  return Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => null as GridCell)
  );
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS;
}

// Find all 2x2 squares completed by placing a pawn at (row, col).
// A single placement can complete multiple adjacent squares.
function findCompletedSquares(
  grid: GridCell[][],
  row: number,
  col: number,
  playerId: string
): { row: number; col: number }[][] {
  const offsets: [number, number][] = [
    [0, 0], // pawn is top-left
    [0, -1], // pawn is top-right
    [-1, 0], // pawn is bottom-left
    [-1, -1], // pawn is bottom-right
  ];
  const squares: { row: number; col: number }[][] = [];
  for (const [dr, dc] of offsets) {
    const r0 = row + dr;
    const c0 = col + dc;
    if (!inBounds(r0, c0) || !inBounds(r0 + 1, c0 + 1)) continue;
    const cells = [
      { row: r0, col: c0 },
      { row: r0, col: c0 + 1 },
      { row: r0 + 1, col: c0 },
      { row: r0 + 1, col: c0 + 1 },
    ];
    if (cells.every((cell) => grid[cell.row][cell.col] === playerId)) {
      squares.push(cells);
    }
  }
  return squares;
}

function isBoardFull(grid: GridCell[][]): boolean {
  return grid.every((row) => row.every((c) => c !== null));
}

// Check if ANY 2×2 block on the grid can still be completed by a single player.
// A block is "still possible" if all its filled cells belong to the SAME player
// (and at least one cell is empty). If a block has cells from 2+ different players,
// it can NEVER be completed — it's blocked.
function canAnyPlayerFormSquare(grid: GridCell[][], players: Player[]): boolean {
  if (players.length === 0) return false;
  for (let r0 = 0; r0 <= ROWS - 2; r0++) {
    for (let c0 = 0; c0 <= COLS - 2; c0++) {
      const cells = [
        grid[r0][c0],
        grid[r0][c0 + 1],
        grid[r0 + 1][c0],
        grid[r0 + 1][c0 + 1],
      ];
      const filled = cells.filter((c) => c !== null);
      if (filled.length === 0) return true;
      if (filled.length === 4) continue;
      const owner = filled[0];
      if (filled.every((c) => c === owner)) {
        return true;
      }
    }
  }
  return false;
}

function computeWinner(players: Player[]): string | null {
  if (players.length === 0) return null;
  let best = players[0];
  for (const p of players) if (p.score > best.score) best = p;
  return best.id;
}

function showEndGameToast(message: string) {
  toast({
    title: "Fin du match",
    description: message,
    duration: 5000,
  });
}

export const useGameStore = create<GameState>((set, get) => {
  return {
    phase: "home",
    players: [],
    currentPlayerIndex: 0,
    grid: emptyGrid(),
    turnTimeLeft: TURN_SECONDS,
    statusMessage: "",
    winnerId: null,
    lastSquareCells: null,
    lastSquareerId: null,
    formedSquares: [],
    resolving: false,
    isPaused: false,
    totalRounds: 10,
    currentRound: 0,
    lastDelta: null,
    endReason: null,

    goToSetup: () => set({ phase: "setup" }),
    goToOnlineSetup: () => set({ phase: "online-setup" }),
    goToReviews: () => set({ phase: "reviews" }),

    backHome: () =>
      set({
        phase: "home",
        players: [],
        currentPlayerIndex: 0,
        grid: emptyGrid(),
        turnTimeLeft: TURN_SECONDS,
        statusMessage: "",
        winnerId: null,
        lastSquareCells: null,
        lastSquareerId: null,
        formedSquares: [],
        resolving: false,
        isPaused: false,
        currentRound: 0,
        lastDelta: null,
    endReason: null,
      }),

    startGame: (setupPlayers, rounds) => {
      if (setupPlayers.length < 2) return;
      const players: Player[] = setupPlayers.map((p) => ({
        id: makeId(),
        name: p.name.trim() || `Joueur ${Math.floor(Math.random() * 100)}`,
        color: p.color,
        emoji: p.emoji,
        score: 0,
        alignments: 0,
        isAI: p.isAI ?? false,
      }));
      set({
        players,
        currentPlayerIndex: 0,
        phase: "playing",
        grid: emptyGrid(),
        turnTimeLeft: TURN_SECONDS,
        statusMessage: `${players[0].name} commence ! 10 secondes par coup. ⏱️`,
        winnerId: null,
        lastSquareCells: null,
        lastSquareerId: null,
        formedSquares: [],
        resolving: false,
        isPaused: false,
        totalRounds: rounds,
        currentRound: 0,
        lastDelta: null,
    endReason: null,
      });
    },

    togglePause: () => {
      const state = get();
      if (state.phase !== "playing" || state.resolving) return;
      const next = !state.isPaused;
      set({
        isPaused: next,
        statusMessage: next
          ? "⏸️ Partie en pause."
          : `${state.players[state.currentPlayerIndex]?.name} reprend. ⏱️`,
      });
    },

    placePawn: (row, col) => {
      const state = get();
      if (state.phase !== "playing" || state.resolving || state.isPaused) return;
      if (!inBounds(row, col)) return;

      const grid = state.grid.map((r) => [...r]);
      // Free placement: cell must be empty
      if (grid[row][col] !== null) {
        set({ statusMessage: "Case déjà occupée ! Choisis une case vide." });
        return;
      }

      const cur = state.players[state.currentPlayerIndex];
      grid[row][col] = cur.id;
      const squares = findCompletedSquares(grid, row, col, cur.id);

      if (squares.length > 0) {
        const points = squares.length;
        const players = state.players.map((p) =>
          p.id === cur.id
            ? {
                ...p,
                score: p.score + points,
                alignments: p.alignments + points,
              }
            : p
        );
        const newRound = state.currentRound + points;
        const lastSquareCells = Array.from(
          new Set(squares.flatMap((sq) => sq.map((cell) => `${cell.row},${cell.col}`)))
        ).map((coord) => {
          const [rowStr, colStr] = coord.split(",");
          return { row: Number(rowStr), col: Number(colStr) };
        });

        set({
          grid,
          players,
          lastSquareCells,
          lastSquareerId: cur.id,
          formedSquares: [
            ...state.formedSquares,
            ...squares.map((cells) => ({ cells, playerId: cur.id })),
          ],
          resolving: true,
          lastDelta: { playerId: cur.id, delta: points },
          currentRound: newRound,
          statusMessage: `🟦 ${cur.name} forme ${
            points === 1 ? "un carré" : `${points} carrés`
          } ! +${points} point${points > 1 ? "s" : ""} (Carré ${newRound}/${state.totalRounds})`,
        });

        setTimeout(() => {
          const s = get();
          if (s.phase !== "playing") return;
          if (s.currentRound >= s.totalRounds) {
            const winnerId = computeWinner(s.players);
            set({
              phase: "gameover",
              winnerId,
              endReason: "rounds",
              resolving: false,
              lastSquareCells: null,
              statusMessage: `Match terminé après ${s.totalRounds} carrés ! 🏆`,
            });
            return;
          }
          // Stalemate: no player can form a square anymore
          if (!canAnyPlayerFormSquare(s.grid, s.players)) {
            const winnerId = computeWinner(s.players);
            showEndGameToast(
              "Plus aucun carré possible — la partie se termine. Rejoue ou retourne à l'accueil."
            );
            set({
              phase: "gameover",
              winnerId,
              endReason: "stalemate",
              resolving: false,
              lastSquareCells: null,
              statusMessage: "Plus aucun carré possible ! Fin du match.",
            });
            return;
          }
          const nextIndex = (s.currentPlayerIndex + 1) % s.players.length;
          const next = s.players[nextIndex];
          set({
            resolving: false,
            lastSquareCells: null,
            currentPlayerIndex: nextIndex,
            turnTimeLeft: TURN_SECONDS,
            statusMessage: `Carré ${s.currentRound}/${s.totalRounds} — à ${next.name} ! ⏱️`,
          });
        }, 1700);
        return;
      }

      if (isBoardFull(grid)) {
        // Board full, no more moves possible → end the match
        const winnerId = computeWinner(state.players);
        set({
          grid,
          resolving: true,
          endReason: "board-full",
          statusMessage: "Plateau plein ! Fin du match.",
        });
        setTimeout(() => {
          const s = get();
          if (s.phase !== "playing") return;
          set({
            phase: "gameover",
            winnerId,
            endReason: "board-full",
            resolving: false,
            lastSquareCells: null,
            statusMessage: "Plateau plein — match terminé ! 🏆",
          });
        }, 1200);
        return;
      }

      // Stalemate: no player can form a square anymore (even if board not full)
      if (!canAnyPlayerFormSquare(grid, state.players)) {
        const winnerId = computeWinner(state.players);
        showEndGameToast(
          "Plus aucun carré possible — la partie se termine. Rejoue ou retourne à l'accueil."
        );
        set({
          grid,
          resolving: true,
          endReason: "stalemate",
          statusMessage: "Plus aucun carré possible ! Fin du match.",
        });
        setTimeout(() => {
          const s = get();
          if (s.phase !== "playing") return;
          set({
            phase: "gameover",
            winnerId,
            endReason: "stalemate",
            resolving: false,
            lastSquareCells: null,
            statusMessage: "Plus aucun carré possible — match terminé ! 🏆",
          });
        }, 1200);
        return;
      }

      const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
      const next = state.players[nextIndex];
      set({
        grid,
        currentPlayerIndex: nextIndex,
        turnTimeLeft: TURN_SECONDS,
        statusMessage: `À ${next.name} de jouer. ⏱️`,
      });
    },

    tick: (dt) => {
      const state = get();
      if (state.phase !== "playing" || state.resolving || state.isPaused) return;
      const tl = state.turnTimeLeft - dt;
      if (tl <= 0) {
        const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
        const next = state.players[nextIndex];
        set({
          turnTimeLeft: TURN_SECONDS,
          currentPlayerIndex: nextIndex,
          statusMessage: `À ${next.name} de jouer. ⏱️`,
        });
      } else {
        set({ turnTimeLeft: tl });
      }
    },

    endGameNow: () => {
      const state = get();
      const winnerId = computeWinner(state.players);
      set({
        phase: "gameover",
        winnerId,
        resolving: false,
        isPaused: false,
        statusMessage: "Partie terminée !",
      });
    },

    // Restart the match but keep the same players and match settings
    // (same order, same isAI flags, same totalRounds). Scores and grid are reset.
    restart: () => {
      const state = get();
      if (state.players.length < 2) {
        // fallback: go home if not enough players
        set({
          phase: "home",
          players: [],
          currentPlayerIndex: 0,
          grid: emptyGrid(),
          turnTimeLeft: TURN_SECONDS,
          statusMessage: "",
          winnerId: null,
          lastSquareCells: null,
          lastSquareerId: null,
          formedSquares: [],
          resolving: false,
          isPaused: false,
          currentRound: 0,
          lastDelta: null,
          endReason: null,
        });
        return;
      }

      // Reset players' scores/alignments but keep identity and order
      const newPlayers = state.players.map((p) => ({ ...p, score: 0, alignments: 0 }));
      set({
        players: newPlayers,
        currentPlayerIndex: 0,
        phase: "playing",
        grid: emptyGrid(),
        turnTimeLeft: TURN_SECONDS,
        statusMessage: `${newPlayers[0].name} commence ! ${TURN_SECONDS} secondes par coup. ⏱️`,
        winnerId: null,
        lastSquareCells: null,
        lastSquareerId: null,
        formedSquares: [],
        resolving: false,
        isPaused: false,
        currentRound: 0,
        lastDelta: null,
        endReason: null,
      });
    },

    rematchTied: () => {
      const state = get();
      if (state.players.length === 0) return;
      // Find the max score
      const maxScore = Math.max(...state.players.map((p) => p.score));
      // Keep only players sharing the max score
      const tied = state.players.filter((p) => p.score === maxScore);
      if (tied.length <= 1) return; // no tie → nothing to do
      // Reset tied players' scores, drop the others, start a new game
      const newPlayers: Player[] = tied.map((p) => ({
        ...p,
        score: 0,
        alignments: 0,
      }));
      set({
        players: newPlayers,
        currentPlayerIndex: 0,
        phase: "playing",
        grid: emptyGrid(),
        turnTimeLeft: TURN_SECONDS,
        statusMessage: `Challenge décisif entre ${newPlayers.map((p) => p.name).join(" et ")} ! ⏱️`,
        winnerId: null,
        lastSquareCells: null,
        lastSquareerId: null,
        formedSquares: [],
        resolving: false,
        isPaused: false,
        currentRound: 0,
        lastDelta: null,
    endReason: null,
      });
    },
  };
});
