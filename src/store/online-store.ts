"use client";

import { create } from "zustand";
import { getSocket, disconnectSocket } from "@/lib/socket";
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
  createdAt: number;
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
  players: AdminRoomPlayer[];
}

interface OnlineStore {
  connected: boolean;
  myPlayerId: string | null;
  roomCode: string | null;
  state: OnlineGameState | null;
  errorMessage: string | null;
  pendingAction: boolean;
  challenges: Challenge[]; // pending challenges for Benchou Ferrari
  isBenchou: boolean; // true if this client registered as Benchou Ferrari
  benchouPin: string; // stored PIN for admin API calls (reviews, etc.)
  publicRooms: PublicRoom[]; // all lobby-phase rooms visible to everyone
  adminRooms: AdminRoom[]; // all rooms with full details (Benchou only)
  kicked: boolean; // true when this player was kicked by host/admin
  reactions: { id: string; emoji: string; timestamp: number }[]; // floating emoji reactions

  // lifecycle
  init: () => void;
  teardown: () => void;

  // actions
  createRoom: (player: SetupPlayer, totalRounds: number, maxPlayers?: number) => Promise<void>;
  joinRoom: (roomCode: string, player: SetupPlayer) => Promise<void>;
  challengeBenchou: (player: SetupPlayer, totalRounds: number) => Promise<void>;
  registerAsBenchou: (pin: string) => Promise<void>;
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
  adminListRooms: () => void;
  adminKickPlayer: (roomCode: string, playerId: string) => Promise<void>;
  adminDeleteRoom: (roomCode: string) => Promise<void>;
  clearKicked: () => void;
  sendReaction: (emoji: string) => void;
}

export const useOnlineStore = create<OnlineStore>((set, get) => ({
  connected: false,
  myPlayerId: null,
  roomCode: null,
  state: null,
  errorMessage: null,
  pendingAction: false,
  challenges: [],
  isBenchou: false,
  challengeDeclined: false,
  publicRooms: [],
  adminRooms: [],
  kicked: false,
  benchouPin: "",
  reactions: [],

  init: () => {
    const socket = getSocket();
    // Guard: don't re-attach listeners if THIS socket instance already has them
    if ((socket as any).__trouvixListeners) return;
    (socket as any).__trouvixListeners = true;

    if (socket.connected) set({ connected: true });
    socket.on("connect", () => {
      set({ connected: true });
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
    socket.on("disconnect", () => set({ connected: false }));
    socket.on("state-update", (payload: { state: OnlineGameState }) => {
      // Always set a NEW object reference so Zustand detects the change
      // (socket.io may reuse the same parsed object in some edge cases)
      set({
        state: { ...payload.state },
        roomCode: payload.state.roomCode,
      });
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
    socket.on("admin-rooms", (payload: { rooms: AdminRoom[] }) => {
      set({ adminRooms: payload.rooms ?? [] });
    });
    // Kicked by host or admin
    socket.on("kicked", (payload: { reason: string }) => {
      set({
        kicked: true,
        myPlayerId: null,
        roomCode: null,
        state: null,
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
    // Room destroyed by host leaving or admin deleting — everyone goes home
    socket.on("room-destroyed", (payload: { reason: string }) => {
      const reason = payload?.reason;
      set({
        myPlayerId: null,
        roomCode: null,
        state: null,
        kicked: true,
        errorMessage:
          reason === "admin-deleted"
            ? "Le salon a été supprimé par l'administrateur."
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
      myPlayerId: null,
      roomCode: null,
      state: null,
      errorMessage: null,
      pendingAction: false,
      challenges: [],
      isBenchou: false,
      challengeDeclined: false,
      publicRooms: [],
      adminRooms: [],
      kicked: false,
      reactions: [],
    });
  },

  createRoom: async (player, totalRounds, maxPlayers) => {
    const socket = getSocket();
    get().init();
    set({ errorMessage: null, pendingAction: true });

    // Wait for socket connection before emitting
    if (!socket.connected) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => resolve(), 5000);
        socket.once("connect", () => { clearTimeout(t); resolve(); });
      });
    }

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        set({ pendingAction: false, errorMessage: "Le serveur ne répond pas. Réessaie." });
        resolve();
      }, 8000);

      socket.emit(
        "create-room",
        { player, totalRounds, maxPlayers },
        (res: { roomCode?: string; playerId?: string; error?: string }) => {
          clearTimeout(timeout);
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

  joinRoom: async (roomCode, player) => {
    const socket = getSocket();
    get().init(); // ensure listeners
    const upperCode = roomCode.toUpperCase();
    set({ errorMessage: null, pendingAction: true, roomCode: upperCode });

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
        { roomCode: upperCode, player },
        (res: { playerId?: string; error?: string }) => {
          clearTimeout(timeout);
          set({ pendingAction: false });
          if (res?.error) {
            set({ errorMessage: res.error, roomCode: null });
          } else if (res?.playerId) {
            set({ myPlayerId: res.playerId, roomCode: upperCode });
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
    return new Promise<void>((resolve) => {
      socket.emit("register-as-benchou", { pin }, (res: { ok?: boolean; pendingChallenges?: Challenge[]; error?: string }) => {
        if (res?.error) {
          set({ errorMessage: res.error });
        } else if (res?.ok) {
          set({ isBenchou: true, benchouPin: pin, challenges: res.pendingChallenges ?? [] });
        }
        resolve();
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
    if (socket.connected) {
      socket.emit("place-pawn", { row, col }, (res: { ok?: boolean; error?: string }) => {
        if (res?.error && process.env.NODE_ENV !== "production") {
          console.log("[place-pawn] server error:", res.error);
        }
      });
    }
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
    // Emit leave-room but DON'T destroy the socket — keep it alive for rejoin
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("leave-room");
    }
    try {
      localStorage.removeItem("trouvix_room");
      localStorage.removeItem("trouvix_player");
    } catch {}
    set({
      myPlayerId: null,
      roomCode: null,
      state: null,
      errorMessage: null,
      challenges: [],
      isBenchou: false,
      challengeDeclined: false,
      kicked: false,
      reactions: [],
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

  clearKicked: () => set({ kicked: false, errorMessage: null }),

  sendReaction: (emoji) => {
    const socket = getSocket();
    if (socket.connected) {
      socket.emit("send-reaction", { emoji });
    }
  },
}));