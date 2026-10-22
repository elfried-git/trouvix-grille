"use client";

import { create } from "zustand";
import { getSocket, disconnectSocket, wakeGameService } from "@/lib/socket";
import type { OnlineGameState, SetupPlayer } from "@/lib/socket";

export interface Challenge {
  id: string;
  roomCode: string;
  challengerName: string;
  challengerColor: string;
  challengerEmoji: string;
  totalRounds: number;
  createdAt: number;
  status: "pending" | "accepted" | "expired";
}

export interface PublicRoom {
  roomCode: string;
  hostName: string;
  hostEmoji: string;
  hostColor: string;
  playerCount: number;
  maxPlayers: number;
  isFull: boolean;
  totalRounds: number;
  phase?: "lobby" | "playing" | "gameover";
  createdAt: number;
  isBenchouChallenge?: boolean;
}

export interface AdminRoomPlayer {
  id: string;
  name: string;
  color: string;
  emoji: string;
  score: number;
  isHost: boolean;
  isAI: boolean;
  connected: boolean;
}

function persistPlayerProfile(player: SetupPlayer) {
  try {
    localStorage.setItem("trouvix_profile", JSON.stringify({
      name: player.name.trim().slice(0, 18),
      color: player.color,
      // Avoid putting uploaded photo data URLs into localStorage.
      emoji: player.emoji.startsWith("data:") ? "" : player.emoji.slice(0, 24),
    }));
  } catch {}
}

export interface AdminRoom {
  roomCode: string;
  hostName: string;
  hostId: string;
  phase: "lobby" | "playing" | "gameover";
  playerCount: number;
  maxPlayers: number;
  isFull: boolean;
  totalRounds: number;
  currentRound: number;
  createdAt: number;
  isBenchouChallenge?: boolean;
  players: AdminRoomPlayer[];
}

interface OnlineStore {
  connected: boolean;
  connecting: boolean; // true while we're (re)connecting to the game service
  myPlayerId: string | null;
  roomCode: string | null;
  state: OnlineGameState | null;
  optimisticPawn: { row: number; col: number; playerId: string; roomCode: string } | null;
  errorMessage: string | null;
  pendingAction: boolean;
  challenges: Challenge[]; // pending challenges for Benchou Ferrari
  isBenchou: boolean; // true if this client registered as Benchou Ferrari
  benchouPin: string; // stored PIN for admin API calls (reviews, etc.)
  publicRooms: PublicRoom[]; // all lobby-phase rooms visible to everyone
  adminRooms: AdminRoom[]; // all rooms with full details (Benchou only)
  kicked: boolean; // true when this player was kicked by host/admin
  kickedToOnline: boolean; // redirect the after-kick screen to the online menu instead of home
  reactions: { id: string; emoji: string; timestamp: number }[]; // floating emoji reactions
  squareEvent: { eventId: number; playerId: string; color: string; cells: { row: number; col: number }[] } | null;

  // lifecycle
  init: () => void;
  teardown: () => void;

  // actions
  createRoom: (player: SetupPlayer, totalRounds: number, maxPlayers?: number) => Promise<void>;
  joinRoom: (roomCode: string, player: SetupPlayer, allowColorReassignment?: boolean) => Promise<void>;
  challengeBenchou: (player: SetupPlayer, totalRounds: number) => Promise<void>;
  registerAsBenchou: (pin: string) => Promise<boolean>;
  acceptChallenge: (challengeId: string) => Promise<void>;
  declineChallenge: (challengeId: string) => Promise<void>;
  challengeDeclined: boolean; // true when Benchou declined the current challenge
  startGame: () => void;
  placePawn: (row: number, col: number) => void;
  togglePause: () => void;
  endGame: () => void;
  restart: () => void;
  rematchTied: () => void;
  leaveRoom: () => void;
  tryReconnect: () => boolean;
  clearError: () => void;
  // room management
  listPublicRooms: () => void;
  kickPlayer: (playerId: string) => Promise<void>;
  destroyRoom: () => Promise<void>;
  adminListRooms: () => void;
  adminKickPlayer: (roomCode: string, playerId: string) => Promise<void>;
  adminDeleteRoom: (roomCode: string) => Promise<void>;
  clearKicked: () => void;
  sendReaction: (emoji: string) => void;
}

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  connected: false,
  connecting: true,
  myPlayerId: null,
  roomCode: null,
  state: null,
  optimisticPawn: null,
  errorMessage: null,
  pendingAction: false,
  challenges: [],
  isBenchou: false,
  challengeDeclined: false,
  publicRooms: [],
  adminRooms: [],
  kicked: false,
  kickedToOnline: false,
  benchouPin: "",
  reactions: [],
  squareEvent: null,

  init: () => {
    const socket = getSocket();
    // Guard: don't re-attach listeners if THIS socket instance already has them
    if ((socket as any).__trouvixListeners) return;
    (socket as any).__trouvixListeners = true;

    // Wake the (possibly sleeping) game service over HTTP while Socket.IO
    // negotiates. This makes the first connection much faster on hosts that
    // put the service to sleep (Railway free plan cold start).
    wakeGameService();

    if (socket.connected) set({ connected: true, connecting: false });
    else set({ connecting: true });
    socket.on("connect", () => {
      const wasInRoom = Boolean(get().roomCode && get().myPlayerId);
      set({ connected: true, connecting: false });
      if (wasInRoom) get().tryReconnect();
      // Auto-fetch public rooms immediately on connect (reactivity)
      socket.emit("list-public-rooms", {}, (res: { rooms?: PublicRoom[] }) => {
        if (res?.rooms) set({ publicRooms: res.rooms });
      });
      // If this client is Benchou, also fetch admin rooms
      if (get().isBenchou) {
        socket.emit("admin-list-rooms", {}, (res: { rooms?: AdminRoom[] }) => {
          if (res?.rooms) set({ adminRooms: res.rooms });
        });
      }
    });
    socket.on("disconnect", () => set({ connected: false, connecting: true }));
    socket.on("state-update", (payload: { state: OnlineGameState }) => {
      // Always set a NEW object reference so Zustand detects the change
      // (socket.io may reuse the same parsed object in some edge cases)
      const nextState = { ...payload.state };
      const optimisticPawn = get().optimisticPawn;
      const formingPlayer = nextState.players.find((p) => p.id === nextState.lastSquareerId);
      const eventId = nextState.squareEventId;
      const currentEvent = get().squareEvent;
      set({
        state: nextState,
        optimisticPawn: optimisticPawn && (
          optimisticPawn.roomCode !== nextState.roomCode ||
          nextState.phase !== "playing" ||
          nextState.grid[optimisticPawn.row]?.[optimisticPawn.col] != null
        ) ? null : optimisticPawn,
        roomCode: payload.state.roomCode,
        ...(eventId && (nextState.lastSquareCells?.length ?? 0) >= 4 && formingPlayer && currentEvent?.eventId !== eventId
          ? { squareEvent: { eventId, playerId: formingPlayer.id, color: formingPlayer.color, cells: nextState.lastSquareCells } }
          : {}),
      });
    });
    socket.on("square-formed", (payload: { eventId: number; playerId: string; color: string; cells: { row: number; col: number }[] }) => {
      if (!payload || !Number.isFinite(payload.eventId) || typeof payload.playerId !== "string" || typeof payload.color !== "string" || !Array.isArray(payload.cells) || payload.cells.length < 4) return;
      if (get().squareEvent?.eventId !== payload.eventId) {
        set({ squareEvent: { eventId: payload.eventId, playerId: payload.playerId, color: payload.color, cells: payload.cells } });
      }
    });
    socket.on("error", (payload: { message: string }) => {
      set({ errorMessage: payload.message });
    });
    // Receive challenge notifications (for Benchou Ferrari)
    socket.on("benchou-challenge", (payload: { challenge: Challenge }) => {
      const challenge = payload.challenge;
      set((s) => ({
        challenges: s.challenges.some((c) => c.id === challenge.id)
          ? s.challenges
          : [...s.challenges, challenge],
      }));
      // Play a notification sound + browser notification
      if (typeof window !== "undefined") {
        // Browser notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("🎮 Défi Trouvix Grille", {
            body: `${challenge.challengerName} vous sollicite pour une partie ! Cliquez pour rejoindre.`,
            icon: "/trouvix-logo.svg",
            tag: challenge.id,
          });
        }
        // Sound (simple beep via Web Audio API)
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 880;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.5);
        } catch {}
      }
    });
    // Challenge declined by Benchou Ferrari (received by the challenger)
    socket.on("challenge-declined", (payload: { challengeId: string }) => {
      set({ challengeDeclined: true });
    });
    // Public room list (broadcast to everyone when rooms change)
    socket.on("public-rooms", (payload: { rooms: PublicRoom[] }) => {
      set({ publicRooms: payload.rooms ?? [] });
    });
    // Admin room list (sent only to Benchou Ferrari)
    socket.on("admin-rooms-update", (payload: { rooms: AdminRoom[] }) => {
      set({ adminRooms: payload.rooms ?? [] });
    });
    // Kicked by host or admin
    socket.on("kicked", (payload: { reason: string }) => {
      set({
        kicked: true,
        myPlayerId: null,
        roomCode: null,
        state: null,
        optimisticPawn: null,
        errorMessage: payload?.reason === "removed-by-admin" ? "Tu as été retiré par l'administrateur." : "Tu as été retiré du salon par l'hôte.",
      });
      try {
        localStorage.removeItem("trouvix_room");
        localStorage.removeItem("trouvix_player");
      } catch {}
    });
    // Floating emoji reactions (broadcast to the room)
    socket.on("reaction-received", (payload: { playerId: string; emoji: string; timestamp: number }) => {
      if (!payload?.emoji) return;
      const reaction = {
        id: `${payload.playerId}-${payload.timestamp}-${Math.random().toString(36).slice(2, 6)}`,
        emoji: payload.emoji,
        timestamp: payload.timestamp,
      };
      set((s) => ({ reactions: [...s.reactions, reaction] }));
      // Auto-remove after 3s (matches the animation duration)
      setTimeout(() => {
        set((s) => ({ reactions: s.reactions.filter((r) => r.id !== reaction.id) }));
      }, 3000);
    });
    // Room destroyed — the host closed it (or an admin deleted it).
    // • host-destroyed / new-game → everyone goes back to the ONLINE menu so the
    //   host can start a fresh game from scratch (new room, new settings).
    // • otherwise (admin / host left) → back to the home screen.
    socket.on("room-destroyed", (payload: { reason: string }) => {
      const reason = payload?.reason;
      set({
        myPlayerId: null,
        roomCode: null,
        state: null,
        optimisticPawn: null,
        kicked: true,
        kickedToOnline: reason === "host-destroyed" || reason === "new-game",
        errorMessage:
          reason === "admin-deleted"
            ? "Le salon a été supprimé par l'administrateur."
            : reason === "host-destroyed" || reason === "new-game"
              ? "L'hôte a fermé le salon. Crée ou rejoins une nouvelle partie."
              : "L'hôte a quitté le salon. La partie est terminée.",
      });
      try {
        localStorage.removeItem("trouvix_room");
        localStorage.removeItem("trouvix_player");
      } catch {}
    });
  },

  teardown: () => {
    // Clean up the listeners flag so init() can re-attach on a new socket
    try {
      const socket = getSocket();
      delete (socket as any).__trouvixListeners;
    } catch {}
    disconnectSocket();
    set({
      connected: false,
      connecting: false,
      myPlayerId: null,
      roomCode: null,
      state: null,
      optimisticPawn: null,
      errorMessage: null,
      pendingAction: false,
      challenges: [],
      isBenchou: false,
      challengeDeclined: false,
      publicRooms: [],
      adminRooms: [],
      kicked: false,
      reactions: [],
      squareEvent: null,
    });
  },

  createRoom: async (player, totalRounds, maxPlayers) => {
    const socket = getSocket();
    get().init();
    set({ errorMessage: null, pendingAction: true, squareEvent: null });

    // A sleeping production service may take 10–30 seconds to wake. Start the
    // health request and wait for a real Socket.IO connection before emitting;
    // emitting while disconnected only buffers the request and causes false
    // timeouts (and duplicate rooms when the host retries).
    void wakeGameService();
    const connected = socket.connected || await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.off("connect", onConnect);
        resolve(result);
      };
      const onConnect = () => finish(true);
      const timer = setTimeout(() => finish(false), 45_000);
      socket.once("connect", onConnect);
      socket.connect();
    });

    if (!connected) {
      set({
        pendingAction: false,
        errorMessage: "Le serveur de jeu met trop de temps à démarrer. Vérifie ta connexion puis réessaie.",
      });
      return;
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        set({
          pendingAction: false,
          errorMessage: "La création du salon n’a pas été confirmée. Vérifie si le salon apparaît avant de réessayer.",
        });
        resolve();
      }, 20_000);

      socket.emit(
        "create-room",
        { player, totalRounds, maxPlayers },
        (res: { roomCode?: string; playerId?: string; error?: string }) => {
          clearTimeout(timeout);
          set({ pendingAction: false });
          if (res?.error) {
            set({ errorMessage: res.error });
          } else if (res?.roomCode && res?.playerId) {
            set({ myPlayerId: res.playerId, roomCode: res.roomCode, errorMessage: null });
            persistPlayerProfile(player);
            try {
              localStorage.setItem("trouvix_room", res.roomCode);
              localStorage.setItem("trouvix_player", res.playerId);
            } catch {}
          }
          resolve();
        }
      );
    });
  },

  joinRoom: async (roomCode, player, allowColorReassignment = false) => {
    const socket = getSocket();
    get().init(); // ensure listeners
    const upperCode = roomCode.toUpperCase();
    set({ errorMessage: null, pendingAction: true, roomCode: upperCode, squareEvent: null });

    // Wait for socket to be connected before emitting (max 5s)
    const ensureConnected = (): Promise<void> => {
      return new Promise((resolve) => {
        if (socket.connected) return resolve();
        const timeout = setTimeout(() => resolve(), 5000);
        socket.once("connect", () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    };
    await ensureConnected();

    return new Promise<void>((resolve) => {
      // Timeout: if server doesn't respond in 8s, show error
      const timeout = setTimeout(() => {
        set({ pendingAction: false, errorMessage: "Le serveur ne répond pas. Réessaie." });
        resolve();
      }, 8000);

      socket.emit(
        "join-room",
        { roomCode: upperCode, player, allowColorReassignment },
        (res: { playerId?: string; color?: string; error?: string }) => {
          clearTimeout(timeout);
          set({ pendingAction: false });
          if (res?.error) {
            set({ errorMessage: res.error, roomCode: null });
          } else if (res?.playerId) {
            set({ myPlayerId: res.playerId, roomCode: upperCode });
            persistPlayerProfile({ ...player, color: res.color ?? player.color });
            try {
              localStorage.setItem("trouvix_room", upperCode);
              localStorage.setItem("trouvix_player", res.playerId);
            } catch {}
          }
          resolve();
        }
      );
    });
  },

  challengeBenchou: async (player, totalRounds) => {
    const socket = getSocket();
    get().init(); // ensure listeners
    set({ errorMessage: null, pendingAction: true });
    return new Promise<void>((resolve) => {
      socket.emit(
        "challenge-benchou",
        { player, totalRounds },
        (res: { roomCode?: string; playerId?: string; challengeId?: string; error?: string }) => {
          set({ pendingAction: false });
          if (res?.error) {
            set({ errorMessage: res.error });
          } else if (res?.roomCode && res?.playerId) {
            set({ myPlayerId: res.playerId, roomCode: res.roomCode });
            try {
              localStorage.setItem("trouvix_room", res.roomCode);
              localStorage.setItem("trouvix_player", res.playerId);
            } catch {}
          }
          resolve();
        }
      );
    });
  },

  registerAsBenchou: async (pin) => {
    const socket = getSocket();
    get().init(); // ensure listeners
    set({ errorMessage: null });
    // Request browser notification permission
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    }
    return new Promise<boolean>((resolve) => {
      socket.emit("register-as-benchou", { pin }, (res: { ok?: boolean; pendingChallenges?: Challenge[]; error?: string }) => {
        if (res?.error) {
          set({ errorMessage: res.error });
          resolve(false);
        } else if (res?.ok) {
          set({ isBenchou: true, benchouPin: pin, challenges: res.pendingChallenges ?? [] });
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  },

  acceptChallenge: async (challengeId) => {
    const socket = getSocket();
    set({ errorMessage: null, pendingAction: true });
    return new Promise<void>((resolve) => {
      socket.emit("accept-challenge", { challengeId }, (res: { ok?: boolean; roomCode?: string; playerId?: string; error?: string }) => {
        set({ pendingAction: false });
        if (res?.error) {
          set({ errorMessage: res.error });
        } else if (res?.ok && res?.roomCode && res?.playerId) {
          set({ myPlayerId: res.playerId, roomCode: res.roomCode });
          // Remove accepted challenge from the list
          set((s) => ({
            challenges: s.challenges.filter((c) => c.id !== challengeId),
          }));
          try {
            localStorage.setItem("trouvix_room", res.roomCode);
            localStorage.setItem("trouvix_player", res.playerId);
          } catch {}
        }
        resolve();
      });
    });
  },

  declineChallenge: async (challengeId) => {
    const socket = getSocket();
    set({ errorMessage: null, pendingAction: true });
    return new Promise<void>((resolve) => {
      socket.emit("decline-challenge", { challengeId }, (res: { ok?: boolean; error?: string }) => {
        set({ pendingAction: false });
        if (res?.error) {
          set({ errorMessage: res.error });
        } else if (res?.ok) {
          // Remove declined challenge from the list
          set((s) => ({
            challenges: s.challenges.filter((c) => c.id !== challengeId),
          }));
        }
        resolve();
      });
    });
  },

  startGame: () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("start-game");
    }
  },

  placePawn: (row, col) => {
    const socket = getSocket();
    const { state, myPlayerId, optimisticPawn: pendingPawn } = get();
    const currentPlayer = state?.players[state.currentPlayerIndex];
    if (
      !socket.connected || !state || !myPlayerId || pendingPawn || state.phase !== "playing" ||
      state.isPaused || state.resolving || !currentPlayer ||
      state.grid[row]?.[col] != null ||
      (currentPlayer.id !== myPlayerId && !(currentPlayer.isAI && state.hostId === myPlayerId))
    ) return;

    const optimisticPawn = { row, col, playerId: currentPlayer.id, roomCode: state.roomCode };
    set({ optimisticPawn });
    window.setTimeout(() => {
      if (get().optimisticPawn === optimisticPawn) set({ optimisticPawn: null });
    }, 4000);

    socket.emit("place-pawn", { row, col }, (res: { ok?: boolean; error?: string }) => {
      if (res?.error) {
        if (get().optimisticPawn === optimisticPawn) set({ optimisticPawn: null });
        if (process.env.NODE_ENV !== "production") {
          console.log("[place-pawn] server error:", res.error);
        }
      }
    });
  },

  togglePause: () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("toggle-pause");
    }
  },

  endGame: () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("end-game");
    }
  },

  restart: () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("restart");
    }
  },

  rematchTied: () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("rematch-tied");
    }
  },

  leaveRoom: () => {
    // Emit leave-room but DON'T destroy the socket — keep it alive for rejoin.
    // The server keeps the room alive for 10 minutes after everyone leaves, so
    // the host (and the players) can come back with the same code.
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("leave-room");
    }
    // Keep trouvix_room / trouvix_player so the online screen can offer to
    // rejoin the same room (host regains his role) during the grace window.
    set({
      myPlayerId: null,
      roomCode: null,
      state: null,
      optimisticPawn: null,
      errorMessage: null,
      challenges: [],
      isBenchou: false,
      challengeDeclined: false,
      kicked: false,
      reactions: [],
      squareEvent: null,
    });
  },

  // Try to reconnect to a previous session (after page reload).
  // Returns true if a rejoin was attempted.
  tryReconnect: () => {
    try {
      const savedRoom = localStorage.getItem("trouvix_room");
      const savedPlayer = localStorage.getItem("trouvix_player");
      if (savedRoom && savedPlayer) {
        const socket = getSocket();
        const sendRejoin = () => {
          socket.emit("rejoin-room", { roomCode: savedRoom, playerId: savedPlayer }, (res: { ok?: boolean }) => {
            if (res?.ok) {
              set({ myPlayerId: savedPlayer, roomCode: savedRoom });
            } else {
              // Room/player no longer exists — clear storage
              localStorage.removeItem("trouvix_room");
              localStorage.removeItem("trouvix_player");
            }
          });
        };
        if (socket.connected) sendRejoin();
        else socket.once("connect", sendRejoin);
        return true;
      }
    } catch {}
    return false;
  },

  clearError: () => set({ errorMessage: null }),

  // ====== Room management ======

  listPublicRooms: () => {
    const socket = getSocket();
    const doFetch = () => {
      socket.emit("list-public-rooms", {}, (res: { rooms?: PublicRoom[] }) => {
        if (res?.rooms) set({ publicRooms: res.rooms });
      });
    };
    // Wait for connection if needed (reactivity: fetch ASAP)
    if (socket.connected) doFetch();
    else socket.once("connect", doFetch);
  },

  kickPlayer: async (playerId) => {
    const socket = getSocket();
    if (!socket.connected) return;
    set({ pendingAction: true });
    return new Promise<void>((resolve) => {
      socket.emit("kick-player", { playerId }, (res: { ok?: boolean; error?: string }) => {
        set({ pendingAction: false });
        if (res?.error) set({ errorMessage: res.error });
        resolve();
      });
    });
  },

  // Host-only: close the room for everyone immediately.
  destroyRoom: async () => {
    const socket = getSocket();
    set({ pendingAction: true });
    return new Promise<void>((resolve) => {
      const done = () => {
        set({ pendingAction: false });
        resolve();
      };
      if (!socket.connected) return done();
      socket.emit("destroy-room", {}, (res: { ok?: boolean; error?: string }) => {
        if (res?.error) set({ errorMessage: res.error });
        done();
      });
    });
  },

  adminListRooms: () => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("admin-list-rooms", {}, (res: { rooms?: AdminRoom[] }) => {
        if (res?.rooms) set({ adminRooms: res.rooms });
      });
    }
  },

  adminKickPlayer: async (roomCode, playerId) => {
    const socket = getSocket();
    if (!socket.connected) return;
    set({ pendingAction: true });
    return new Promise<void>((resolve) => {
      socket.emit("admin-kick-player", { roomCode, playerId }, (res: { ok?: boolean; error?: string }) => {
        set({ pendingAction: false });
        if (res?.error) set({ errorMessage: res.error });
        resolve();
      });
    });
  },

  adminDeleteRoom: async (roomCode) => {
    const socket = getSocket();
    if (!socket.connected) return;
    set({ pendingAction: true });
    return new Promise<void>((resolve) => {
      socket.emit("admin-delete-room", { roomCode }, (res: { ok?: boolean; error?: string }) => {
        set({ pendingAction: false });
        if (res?.error) set({ errorMessage: res.error });
        resolve();
      });
    });
  },

  clearKicked: () => set({ kicked: false, kickedToOnline: false, errorMessage: null }),

  sendReaction: (emoji) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("send-reaction", { emoji });
    }
  },
}));
