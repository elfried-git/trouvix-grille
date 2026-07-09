"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getGameServiceUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_GAME_SERVICE_URL;
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }
  return "https://trouvix-game-service-production.up.railway.app";
}

export function getSocket(): Socket {
  if (!socket) {
    const url = getGameServiceUrl();
    socket = io(url, {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 10000,
    });
    if (process.env.NODE_ENV !== "production") {
      console.log("[socket] connecting to:", url);
    }
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export interface OnlinePlayer {
  id: string;
  name: string;
  color: string;
  emoji: string;
  score: number;
  alignments: number;
  isAI?: boolean;
  connected?: boolean;
}

export interface OnlineGameState {
  roomCode: string;
  hostId: string;
  totalRounds: number;
  phase: "lobby" | "playing" | "gameover";
  players: OnlinePlayer[];
  currentPlayerIndex: number;
  grid: (string | null)[][];
  turnTimeLeft: number;
  statusMessage: string;
  winnerId: string | null;
  tiedPlayerIds: string[];
  lastSquareCells: { row: number; col: number }[] | null;
  lastSquareerId: string | null;
  formedSquares: { cells: { row: number; col: number }[]; playerId: string }[];
  resolving: boolean;
  isPaused: boolean;
  currentRound: number;
  lastDelta: { playerId: string; delta: number } | null;
}

export interface SetupPlayer {
  name: string;
  color: string;
  emoji: string;
}