"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Determine the game service URL.
 *
 * - In production (Vercel): uses NEXT_PUBLIC_GAME_SERVICE_URL env var
 *   e.g. "https://trouvix-game.up.railway.app"
 * - In local dev (sandbox): uses the Caddy gateway with XTransformPort=3003
 *   e.g. "/?XTransformPort=3003"
 */
function getGameServiceUrl(): string {
  // Priority: env var > local dev gateway
  const envUrl = process.env.NEXT_PUBLIC_GAME_SERVICE_URL;
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }
  // Local dev (sandbox): Caddy gateway routes to the game-service on port 3003
  return "/?XTransformPort=3003";
}

export function getSocket(): Socket {
  if (!socket) {
    const url = getGameServiceUrl();

    socket = io(url, {
      // "polling" first: an HTTP request reaches a cold/sleeping host
      // (e.g. Railway free plan) much faster than a raw WebSocket handshake,
      // then Socket.IO transparently upgrades to WebSocket. Trying
      // "websocket" first makes the very first connection look stuck.
      transports: ["polling", "websocket"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 20000,
      // In production, CORS is handled by the remote server
      // In local dev, Caddy proxies the request
    });

    // Expose the resolved URL so callers (wake helper) can reuse it.
    (socket as any).__trouvixUrl = url;

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

/**
 * Ping the game-service over plain HTTP to wake it up.
 *
 * On hosts like Railway's free plan the service goes to sleep after a period
 * of inactivity; the first request has to spin the container back up (a "cold
 * start" of ~10-30s). Firing a cheap HTTP GET to /health *before* opening the
 * Socket.IO connection starts that wake-up in the background, so by the time
 * the user clicks "Créer"/"Rejoindre" the server is already responding.
 *
 * Safe to call multiple times: it never throws and ignores failures.
 */
export function wakeGameService(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined") return resolve();
      const url = getGameServiceUrl();
      // Local dev uses the Caddy gateway with a XTransformPort query param —
      // there's no /health route through it, and no cold start either, so skip.
      if (url.startsWith("/")) return resolve();

      const healthUrl = url.replace(/\/+$/, "") + "/health";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      fetch(healthUrl, { method: "GET", signal: controller.signal, cache: "no-store" })
        .catch(() => {})
        .finally(() => {
          clearTimeout(timer);
          resolve();
        });
    } catch {
      resolve();
    }
  });
}

// Types shared with the server
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
  maxPlayers: number;
  isBenchouChallenge?: boolean;
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
  endReason: string | null;
}

export interface SetupPlayer {
  name: string;
  color: string;
  emoji: string;
}
