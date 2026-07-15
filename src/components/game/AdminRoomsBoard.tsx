"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnlineStore, type AdminRoom } from "@/store/online-store";
import { Avatar } from "./Avatar";
import {
  Users,
  Trash2,
  Loader2,
  RefreshCw,
  Crown,
  Gamepad2,
  Bot,
  WifiOff,
} from "lucide-react";

/**
 * Board Salons — visible uniquement par Benchou Ferrari (super admin).
 * Affiche TOUS les salons (lobby + playing + gameover) avec leurs joueurs.
 * L'admin peut retirer un joueur ou supprimer un salon.
 */
export function AdminRoomsBoard() {
  const rooms = useOnlineStore((s) => s.adminRooms);
  const adminListRooms = useOnlineStore((s) => s.adminListRooms);
  const adminKickPlayer = useOnlineStore((s) => s.adminKickPlayer);
  const adminDeleteRoom = useOnlineStore((s) => s.adminDeleteRoom);
  const pending = useOnlineStore((s) => s.pendingAction);

  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    adminListRooms();
    const id = setInterval(() => adminListRooms(), 5000);
    setTimeout(() => setLoading(false), 1500);
    return () => clearInterval(id);
  }, [adminListRooms]);

  const handleKick = async (roomCode: string, playerId: string, playerName: string) => {
    setBusyId(`${roomCode}-${playerId}`);
    await adminKickPlayer(roomCode, playerId);
    setBusyId(null);
    setToast(`${playerName} retiré du salon ${roomCode}.`);
    setTimeout(() => setToast(null), 2500);
  };

  const handleDelete = async (roomCode: string) => {
    setBusyId(`del-${roomCode}`);
    await adminDeleteRoom(roomCode);
    setBusyId(null);
    setConfirmDelete(null);
    setToast(`Salon ${roomCode} supprimé.`);
    setTimeout(() => setToast(null), 2500);
  };

  const phaseLabel = (phase: string) =>
    phase === "lobby" ? "En attente" : phase === "playing" ? "En jeu" : "Terminé";
  const phaseColor = (phase: string) =>
    phase === "lobby"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
      : phase === "playing"
        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
        : "border-muted-foreground/30 bg-muted/10 text-muted-foreground";

  return (
    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/5 p-4 sm:p-5">
      {/* En-tête */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-rose-100">
          <Gamepad2 className="h-4 w-4 text-rose-300" />
          Gestion des salons
          {rooms.length > 0 && (
            <span className="rounded-full bg-rose-400/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
              {rooms.length}
            </span>
          )}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { adminListRooms(); setLoading(true); setTimeout(() => setLoading(false), 800); }}
          disabled={pending}
          className="h-7 border-rose-400/30 px-2 text-[11px] text-rose-200 hover:bg-rose-500/10"
        >
          {loading ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3 w-3" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Liste des salons */}
      {rooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/30 bg-card/20 p-6 text-center">
          <p className="text-2xl">📭</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Aucun salon actif pour l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="flex max-h-[460px] flex-col gap-2.5 overflow-y-auto scroll-romantic pr-2">
          <AnimatePresence mode="popLayout">
            {rooms.map((room) => (
              <motion.div
                key={room.roomCode}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="overflow-visible rounded-xl border border-border/30 bg-card/40 p-3"
              >
                {/* Header du salon */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-background/60 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-amber-200">
                      {room.roomCode}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${phaseColor(room.phase)}`}>
                      {phaseLabel(room.phase)}
                    </span>
                    {room.phase === "playing" && (
                      <span className="text-[10px] text-muted-foreground">
                        Carré {room.currentRound}/{room.totalRounds}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {room.playerCount}/{room.maxPlayers}
                    </span>
                    {confirmDelete === room.roomCode ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                          onClick={() => setConfirmDelete(null)}
                          disabled={busyId === `del-${room.roomCode}`}
                        >
                          Non
                        </Button>
                        <Button
                          size="sm"
                          className="h-6 bg-rose-600 px-1.5 text-[10px] text-white hover:bg-rose-500"
                          onClick={() => handleDelete(room.roomCode)}
                          disabled={busyId === `del-${room.roomCode}`}
                        >
                          {busyId === `del-${room.roomCode}` ? (
                            <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          ) : (
                            "Suppr. ?"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 shrink-0 gap-1 whitespace-nowrap border-rose-400/50 bg-rose-500/10 px-2 text-[10px] font-semibold text-rose-200 hover:bg-rose-500/20"
                        onClick={() => setConfirmDelete(room.roomCode)}
                        disabled={busyId === `del-${room.roomCode}`}
                      >
                        <Trash2 className="h-3 w-3" /> Salon
                      </Button>
                    )}
                  </div>
                </div>

                {/* Joueurs du salon */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {room.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1.5 rounded-lg border border-border/30 bg-background/40 px-2 py-1"
                    >
                      <Avatar avatar={p.emoji} color={p.color} size={22} emojiSize="text-[10px]" />
                      <span className="max-w-[80px] truncate text-[11px] font-medium text-foreground">
                        {p.name}
                      </span>
                      {p.isHost && <Crown className="h-2.5 w-2.5 text-amber-300" />}
                      {p.isAI && <Bot className="h-2.5 w-2.5 text-violet-300" />}
                      {p.connected === false && <WifiOff className="h-2.5 w-2.5 text-rose-400" />}
                      <button
                        onClick={() => handleKick(room.roomCode, p.id, p.name)}
                        disabled={busyId === `${room.roomCode}-${p.id}`}
                        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-rose-300 transition hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-40"
                        title={`Retirer ${p.name}`}
                      >
                        {busyId === `${room.roomCode}-${p.id}` ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-2.5 w-2.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 rounded-lg border border-rose-400/40 bg-background/90 px-3 py-1.5 text-center text-xs font-medium text-rose-100 backdrop-blur"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
