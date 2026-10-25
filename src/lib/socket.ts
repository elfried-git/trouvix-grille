"use client";

import { io, Socket } from "socket.io-client";

type Listener = (...args: any[]) => void;

class CloudflareGameSocket {
  connected = false;
  id?: string;
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<Listener>>();
  private onceListeners = new Map<string, Set<Listener>>();
  private queuedPackets: string[] = [];
  private acknowledgements = new Map<string, (value: any) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 500;
  private nextAckId = 0;
  private stopped = false;

  constructor(private baseUrl: string) {
    this.connect();
  }

  connect() {
    this.stopped = false;
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return this;
    }
    this.openConnection();
    return this;
  }

  on(event: string, listener: Listener) {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(event, set);
    return this;
  }

  once(event: string, listener: Listener) {
    const set = this.onceListeners.get(event) ?? new Set<Listener>();
    set.add(listener);
    this.onceListeners.set(event, set);
    return this;
  }

  off(event: string, listener?: Listener) {
    if (!listener) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
    } else {
      this.listeners.get(event)?.delete(listener);
      this.onceListeners.get(event)?.delete(listener);
    }
    return this;
  }

  emit(event: string, ...args: any[]) {
    const ack = typeof args[args.length - 1] === "function" ? args.pop() as Listener : undefined;
    const packet: Record<string, any> = { t: "event", e: event, d: args[0] };
    if (ack) {
      const ackId = String(++this.nextAckId);
      packet.a = ackId;
      this.acknowledgements.set(ackId, ack);
      setTimeout(() => {
        const pending = this.acknowledgements.get(ackId);
        if (!pending) return;
        this.acknowledgements.delete(ackId);
        pending({ error: "Le serveur ne répond pas." });
      }, 15000);
    }
    const encoded = JSON.stringify(encodeBinary(packet));
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(encoded);
    else this.queuedPackets.push(encoded);
    return this;
  }

  disconnect() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, "client disconnect");
    this.ws = null;
    this.connected = false;
    return this;
  }

  private openConnection() {
    if (this.stopped || typeof window === "undefined") return;
    const url = new URL(this.baseUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    ws.onmessage = (event) => this.handlePacket(event.data);
    ws.onopen = () => { this.reconnectDelay = 500; };
    ws.onerror = () => { /* close event schedules a reconnect */ };
    ws.onclose = () => {
      const wasConnected = this.connected;
      this.connected = false;
      this.id = undefined;
      if (wasConnected) this.dispatch("disconnect", "transport close");
      if (!this.stopped) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.7, 5000);
      }
    };
  }

  private handlePacket(raw: unknown) {
    let packet: any;
    try {
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw as ArrayBuffer);
      packet = decodeBinary(JSON.parse(text));
    } catch { return; }

    if (packet.t === "connect") {
      this.id = packet.id;
      this.connected = true;
      this.dispatch("connect");
      for (const queued of this.queuedPackets.splice(0)) this.ws?.send(queued);
    } else if (packet.t === "ack") {
      const callback = this.acknowledgements.get(packet.a);
      if (callback) {
        this.acknowledgements.delete(packet.a);
        callback(packet.d);
      }
    } else if (packet.t === "event" && typeof packet.e === "string") {
      this.dispatch(packet.e, packet.d);
    }
  }

  private dispatch(event: string, ...args: any[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
    const oneShot = this.onceListeners.get(event);
    if (oneShot) {
      this.onceListeners.delete(event);
      for (const listener of oneShot) listener(...args);
    }
  }
}

function encodeBinary(value: any): any {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer
      ? new Uint8Array(value)
      : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
    }
    return { __trouvixBinary: true, data: btoa(binary) };
  }
  if (Array.isArray(value)) return value.map(encodeBinary);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeBinary(item)]));
  }
  return value;
}

function decodeBinary(value: any): any {
  if (Array.isArray(value)) return value.map(decodeBinary);
  if (value && typeof value === "object") {
    if (value.__trouvixBinary === true && typeof value.data === "string") {
      const binary = atob(value.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes.buffer;
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeBinary(item)]));
  }
  return value;
}

let socket: Socket | CloudflareGameSocket | null = null;
type GameSocket = {
  connected: boolean;
  connect(): any;
  on(event: string, listener: (...args: any[]) => void): any;
  once(event: string, listener: (...args: any[]) => void): any;
  off(event: string, listener?: (...args: any[]) => void): any;
  emit(event: string, ...args: any[]): any;
  disconnect(): any;
};

/**
 * Determine the game service URL.
 *
 * - In production (Vercel): uses NEXT_PUBLIC_GAME_SERVICE_URL env var
 *   e.g. "https://trouvix-game-service.trouvix-grille.workers.dev"
 * - In local dev (sandbox): uses the Caddy gateway with XTransformPort=3003
 *   e.g. "/?XTransformPort=3003"
 */
function getGameServiceUrl(): string {
  // Priority: env var > local dev gateway
  const envUrl = process.env.NEXT_PUBLIC_GAME_SERVICE_URL;
  if (envUrl && envUrl.length > 0) {
    return envUrl;
  }
  // Keep production connected to the migrated backend even if the Vercel
  // environment variable was omitted from a deployment configuration.
  if (process.env.NODE_ENV === "production") {
    return "https://trouvix-game-service.trouvix-grille.workers.dev";
  }
  // Local dev (sandbox): Caddy gateway routes to the game-service on port 3003
  return "/?XTransformPort=3003";
}

export function getSocket(): GameSocket {
  if (!socket) {
    const url = getGameServiceUrl();

    // Local development keeps using the existing Socket.IO Bun service. The
    // production backend uses Cloudflare's native WebSocket endpoint.
    socket = process.env.NODE_ENV === "production" && url.startsWith("https://")
      ? new CloudflareGameSocket(url)
      : io(url, {
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
  return socket as unknown as GameSocket;
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
  isPrivate?: boolean;
  isBenchouChallenge?: boolean;
  phase: "lobby" | "playing" | "gameover";
  players: OnlinePlayer[];
  currentPlayerIndex: number;
  grid: (string | null)[][];
  turnTimeLeft: number;
  turnDeadlineAt?: number | null;
  statusMessage: string;
  winnerId: string | null;
  tiedPlayerIds: string[];
  lastSquareCells: { row: number; col: number }[] | null;
  lastSquareerId: string | null;
  squareEventId?: number | null;
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
