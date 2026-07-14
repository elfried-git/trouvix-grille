"use client";

import { create } from "zustand";
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

  goToSetup: () => void;
  goToOnlineSetup: () => void;
  goToBenchouAdmin: () => void;
  goToTournoi: () => void;
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

// Check if the freshly placed pawn at (row,col) completes a 2x2 square
// (the pawn is one of the 4 cells of a 2x2 block all owned by the player).
function checkSquare(
  grid: GridCell[][],
  row: number,
  col: number,
  playerId: string
): { row: number; col: number }[] | null {
  const offsets: [number, number][] = [
    [0, 0], // pawn is top-left
    [0, -1], // pawn is top-right
    [-1, 0], // pawn is bottom-left
    [-1, -1], // pawn is bottom-right
  ];
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
      return cells;
    }
  }
  return null;
}

function isBoardFull(grid: GridCell[][]): boolean {
  return grid.every((row) => row.every((c) => c !== null));
}

function computeWinner(players: Player[]): string | null {
  if (players.length === 0) return null;
  let best = players[0];
  for (const p of players) if (p.score > best.score) best = p;
  return best.id;
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

    goToSetup: () => set({ phase: "setup" }),
    goToOnlineSetup: () => set({ phase: "online-setup" }),
    goToBenchouAdmin: () => set({ phase: "benchou-admin" }),
    goToTournoi: () => set({ phase: "tournoi" }),

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
      const square = checkSquare(grid, row, col, cur.id);

      if (square) {
        const players = state.players.map((p) =>
          p.id === cur.id
            ? { ...p, score: p.score + 1, alignments: p.alignments + 1 }
            : p
        );
        const newRound = state.currentRound + 1;
        set({
          grid,
          players,
          lastSquareCells: square,
          lastSquareerId: cur.id,
          formedSquares: [
            ...state.formedSquares,
            { cells: square, playerId: cur.id },
          ],
          resolving: true,
          lastDelta: { playerId: cur.id, delta: 1 },
          currentRound: newRound,
          statusMessage: `🟦 ${cur.name} forme un carré ! +1 point (Carré ${newRound}/${state.totalRounds})`,
        });

        setTimeout(() => {
          const s = get();
          if (s.phase !== "playing") return;
          if (s.currentRound >= s.totalRounds) {
            const winnerId = computeWinner(s.players);
            set({
              phase: "gameover",
              winnerId,
              resolving: false,
              lastSquareCells: null,
              statusMessage: `Match terminé après ${s.totalRounds} carrés ! 🏆`,
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
          statusMessage: "Plateau plein ! Fin du match.",
        });
        setTimeout(() => {
          const s = get();
          if (s.phase !== "playing") return;
          set({
            phase: "gameover",
            winnerId,
            resolving: false,
            lastSquareCells: null,
            statusMessage: "Plateau plein — match terminé ! 🏆",
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

    restart: () =>
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
      }),

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
      });
    },
  };
});