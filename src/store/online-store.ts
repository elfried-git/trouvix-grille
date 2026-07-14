"use client";

import { create } from "zustand";
import { getSocket, disconnectSocket } from "@/lib/socket";
import type { OnlineGameState, SetupPlayer } from "@/lib/socket";

// ===== Benchou session persistence (sessionStorage) =====
const BENCHOU_PIN_KEY = "trouvix_benchou_pin";

function saveBenchouPin(pin: string) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(BENCHOU_PIN_KEY, pin);
    }
  } catch {}
}

function loadBenchouPin(): string | null {
  try {
    if (typeof window !== "undefined") {
      return window.sessionStorage.getItem(BENCHOU_PIN_KEY);
    }
  } catch {}
  return null;
}

function clearBenchouPin() {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(BENCHOU_PIN_KEY);
    }
  } catch {}
}

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

interface OnlineStore {
  connected: boolean;
  myPlayerId: string | null;
  roomCode: string | null;
  state: OnlineGameState | null;
  errorMessage: string | null;
  pendingAction: boolean;
  challenges: Challenge[];
  isBenchou: boolean;
  benchouPin: string | null;
  challengeDeclined: boolean;

  init: () => void;
  teardown: () => void;

  createRoom: (player: SetupPlayer, totalRounds: number) => Promise<void>;
  joinRoom: (roomCode: string, player: SetupPlayer) => Promise<void>;
  challengeBenchou: (player: SetupPlayer, totalRounds: number) => Promise<void>;
  registerAsBenchou: (pin: string) => Promise<void>;
  acceptChallenge: (challengeId: string) => Promise<void>;
  declineChallenge: (challengeId: string) => Promise<void>;
  startGame: () => void;
  placePawn: (row: number, col: number) => void;
  togglePause: () => void;
  endGame: () => void;
  restart: () => void;
  rematchTied: () => void;
  leaveRoom: () => void;
  tryReconnect: () => boolean;
  clearError: () => void;
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
  benchouPin: typeof window !== "undefined" ? loadBenchouPin() : null,
  challengeDeclined: false,

  init: () => {
    const socket = getSocket();
    if ((socket as any).__trouvixListeners) return;
    (socket as any).__trouvixListeners = true;

    if (socket.connected) set({ connected: true });

    const onSocketReady = () => {
      set({ connected: true });
      const { benchouPin } = get();
      if (benchouPin) {
        socket.emit(
          "register-as-benchou",
          { pin: benchouPin },
          (res: { ok?: boolean; pendingChallenges?: Challenge[] }) => {
            if (res?.ok) {
              set({
                isBenchou: true,
                challenges: res.pendingChallenges ?? get().challenges,
              });
            }
          }
        );
      }
      try {
        const savedRoom = localStorage.getItem("trouvix_room");
        const savedPlayer = localStorage.getItem("trouvix_player");
        if (savedRoom && savedPlayer) {
          socket.emit("rejoin-room", { roomCode: savedRoom, playerId: savedPlayer });
        }
      } catch {}
    };

    socket.on("connect", onSocketReady);
    if (socket.connected) onSocketReady();

    socket.on("disconnect", () => set({ connected: false }));
    socket.on("state-update", (payload: { state: OnlineGameState }) => {
      set({
        state: { ...payload.state },
        roomCode: payload.state.roomCode,
      });
    });
    socket.on("error", (payload: { message: string }) => {
      set({ errorMessage: payload.message });
    });
    socket.on("benchou-challenge", (payload: { challenge: Challenge }) => {
      const challenge = payload.challenge;
      set((s) => ({
        challenges: s.challenges.some((c) => c.id === challenge.id)
          ? s.challenges
          : [...s.challenges, challenge],
      }));
      if (typeof window !== "undefined") {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("🎮 Défi Trouvix Grille", {
            body: `${challenge.challengerName} vous sollicite pour une partie ! Cliquez pour rejoindre.`,
            icon: "/trouvix-logo.svg",
            tag: challenge.id,
          });
        }
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
    socket.on("challenge-declined", (payload: { challengeId: string }) => {
      set({ challengeDeclined: true });
    });
  },

  teardown: () => {
    try {
      const socket = getSocket();
      delete (socket as any).__trouvixListeners;
    } catch {}
    disconnectSocket();
    clearBenchouPin();
    set({
      connected: false,
      myPlayerId: null,
      roomCode: null,
      state: null,
      errorMessage: null,
      pendingAction: false,
      challenges: [],
      isBenchou: false,
      benchouPin: null,
      challengeDeclined: false,
    });
  },

  createRoom: async (player, totalRounds) => {
    const socket = getSocket();
    get().init();
    set({ errorMessage: null, pendingAction: true });

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
        { player, totalRounds },
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
    get().init();
    const upperCode = roomCode.toUpperCase();
    set({ errorMessage: null, pendingAction: true, roomCode: upperCode });

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
    get().init();
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
    get().init();
    set({ errorMessage: null });
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
          saveBenchouPin(pin);
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
      challengeDeclined: false,
    });
  },

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
}));