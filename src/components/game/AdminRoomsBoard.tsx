"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnlineStore, type AdminRoom, type AdminRoomPlayer } from "@/store/online-store";
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
  Trophy,
  LockKeyhole,
} from "lucide-react";

interface WinnerInfo {
  isGameOver: boolean;
  isTie: boolean;
  score: number;
  winners: AdminRoomPlayer[];
  winnerIds: Set<string>;
}

/**
 * Calcule ou extrait les gagnants d'un salon.
 * Supporte le winnerId/tiedPlayerIds du serveur et le calcul automatique par scores.
 */
function getRoomWinners(room: AdminRoom): WinnerInfo | null {
  const isGameOver = room.phase === "gameover";
  if (!room.players || room.players.length === 0) return null;

  // 1. Si égalité déclarée par le serveur
  if (room.tiedPlayerIds && room.tiedPlayerIds.length > 1) {
    const tied = room.players.filter((p) => room.tiedPlayerIds!.includes(p.id));
    if (tied.length > 0) {
      return {
        isGameOver,
        isTie: true,
        score: tied[0].score ?? 0,
        winners: tied,
        winnerIds: new Set(tied.map((p) => p.id)),
      };
    }
  }

  // 2. Si vainqueur unique déclaré par le serveur
  if (room.winnerId) {
    const single = room.players.find((p) => p.id === room.winnerId);
    if (single) {
      return {
        isGameOver,
        isTie: false,
        score: single.score ?? 0,
        winners: [single],
        winnerIds: new Set([single.id]),
      };
    }
  }

  // 3. Fallback : calcul à partir du score maximal des joueurs
  const maxScore = Math.max(...room.players.map((p) => p.score ?? 0));
  if (maxScore <= 0 && !isGameOver) return null;

  const topPlayers = room.players.filter((p) => (p.score ?? 0) === maxScore);
  if (topPlayers.length > 1) {
    return {
      isGameOver,
      isTie: true,
      score: maxScore,
      winners: topPlayers,
      winnerIds: new Set(topPlayers.map((p) => p.id)),
    };
  }
  if (topPlayers.length === 1 && (isGameOver || maxScore > 0)) {
    return {
      isGameOver,
      isTie: false,
      score: maxScore,
      winners: topPlayers,
      winnerIds: new Set([topPlayers[0].id]),
    };
  }

  return null;
}

/**
 * Board Salons — visible uniquement par Benchou Ferrari (super admin).
 * Affiche TOUS les salons (lobby + playing + gameover) avec mise en valeur des vainqueurs.
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
  const [filter, setFilter] = useState<"all" | "active" | "gameover" | "history">("all");

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
    setToast(`Salon ${roomCode} déplacé dans l'historique.`);
    setTimeout(() => setToast(null), 2500);
  };

  const phaseLabel = (phase: string) =>
    phase === "lobby" ? "En attente" : phase === "playing" ? "En jeu" : "Terminé";
  const phaseColor = (phase: string) =>
    phase === "lobby"
      ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
      : phase === "playing"
        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
        : "border-amber-400/50 bg-amber-500/20 text-amber-200 font-bold";

  // Salons filtrés
  const filteredRooms = useMemo(() => {
    if (filter === "active") return rooms.filter((r) => r.phase === "lobby" || r.phase === "playing");
    if (filter === "gameover") return rooms.filter((r) => r.phase === "gameover");
    if (filter === "history") return rooms.filter((r) => r.archivedAt !== undefined);
    return rooms;
  }, [rooms, filter]);

  const completedCount = useMemo(() => rooms.filter((r) => r.phase === "gameover").length, [rooms]);
  const activeCount = useMemo(() => rooms.filter((r) => !r.archivedAt && (r.phase === "lobby" || r.phase === "playing")).length, [rooms]);
  const historyCount = useMemo(() => rooms.filter((r) => r.archivedAt !== undefined).length, [rooms]);

  return (
    <div className="rounded-2xl border border-rose-400/30 bg-rose-500/5 p-4 sm:p-5">
      {/* En-tête */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-rose-100">
            <Gamepad2 className="h-4 w-4 text-rose-300" />
            Gestion des salons
          </h3>
          {rooms.length > 0 && (
            <span className="rounded-full bg-rose-400/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">
              {rooms.length}
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            adminListRooms();
            setLoading(true);
            setTimeout(() => setLoading(false), 800);
          }}
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

      {/* Onglets de filtrage */}
      {rooms.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              filter === "all"
                ? "bg-rose-500/30 text-rose-100 border border-rose-400/50 font-bold"
                : "bg-background/40 text-muted-foreground hover:text-foreground border border-border/20"
            }`}
          >
            Tous ({rooms.length})
          </button>
          <button
            onClick={() => setFilter("gameover")}
            className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              filter === "gameover"
                ? "bg-amber-500/25 text-amber-200 border border-amber-400/50 font-bold shadow-sm"
                : "bg-background/40 text-muted-foreground hover:text-amber-200 border border-border/20"
            }`}
          >
            <Trophy className="h-3 w-3 text-amber-300" />
            Vainqueurs ({completedCount})
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              filter === "active"
                ? "bg-emerald-500/25 text-emerald-200 border border-emerald-400/50 font-bold"
                : "bg-background/40 text-muted-foreground hover:text-emerald-200 border border-border/20"
            }`}
          >
            En cours ({activeCount})
          </button>
          <button
            onClick={() => setFilter("history")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
              filter === "history"
                ? "bg-slate-500/25 text-slate-200 border border-slate-400/50 font-bold"
                : "bg-background/40 text-muted-foreground hover:text-foreground border border-border/20"
            }`}
          >
            Historique ({historyCount})
          </button>
        </div>
      )}

      {/* Liste des salons */}
      {filteredRooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/30 bg-card/20 p-6 text-center">
          <p className="text-2xl">{filter === "gameover" ? "🏆" : filter === "history" ? "🗂️" : "📭"}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {filter === "gameover"
              ? "Aucun match terminé avec un vainqueur pour l'instant."
              : filter === "history"
                ? "Aucun salon archivé pour l'instant."
              : rooms.length === 0
                ? "Aucun salon actif pour l'instant."
                : "Aucun salon dans cette catégorie."}
          </p>
        </div>
      ) : (
        <div className="flex max-h-[500px] flex-col gap-3 overflow-y-auto scroll-romantic pr-1.5">
          <AnimatePresence mode="popLayout">
            {filteredRooms.map((room) => {
              const winInfo = getRoomWinners(room);
              const isGameOver = room.phase === "gameover";

              return (
                <motion.div
                  key={room.roomCode}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`overflow-visible rounded-xl border p-3 transition-colors ${
                    isGameOver
                      ? "border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-card/50 to-card/40 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.15)]"
                      : "border-border/30 bg-card/40"
                  }`}
                >
                  {/* Header du salon */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-background/60 px-2 py-0.5 font-mono text-sm font-bold tracking-wider text-amber-200">
                        {room.roomCode}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${phaseColor(
                          room.phase
                        )}`}
                      >
                        {isGameOver && <Trophy className="mr-1 inline h-2.5 w-2.5 text-amber-300" />}
                        {phaseLabel(room.phase)}
                      </span>
                      {room.isBenchouChallenge && (
                        <span className="rounded-full border border-violet-400/50 bg-violet-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-200">
                          ⚔️ Défi 1v1
                        </span>
                      )}
                      {room.isPrivate && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-200">
                          <LockKeyhole className="h-2.5 w-2.5" />
                          Privé
                        </span>
                      )}
                      {room.archivedAt !== undefined && (
                        <span className="rounded-full border border-slate-400/40 bg-slate-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-200">
                          Historique
                        </span>
                      )}
                      {room.archivedAt !== undefined && (
                        <span className="text-[10px] text-muted-foreground">
                          Créé le {new Date(room.createdAt).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {room.phase === "playing" && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Carré {room.currentRound}/{room.totalRounds}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {room.playerCount}/{room.maxPlayers}
                      </span>
                      {room.archivedAt !== undefined ? null : confirmDelete === room.roomCode ? (
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

                  {/* ======================================================== */}
                  {/* MISE EN AVANT DU / DES GAGNANTS                          */}
                  {/* ======================================================== */}
                  {isGameOver && winInfo && (
                    <div className="mt-2.5">
                      {!winInfo.isTie && winInfo.winners[0] ? (
                        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-400/60 bg-gradient-to-r from-amber-500/25 via-yellow-500/15 to-amber-500/5 p-2.5 shadow-[0_0_15px_rgba(245,158,11,0.18)]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <Avatar
                                avatar={winInfo.winners[0].emoji}
                                color={winInfo.winners[0].color}
                                size={34}
                                emojiSize="text-xs"
                              />
                              <span className="absolute -top-1.5 -right-1 text-xs drop-shadow">
                                👑
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                                  <Trophy className="h-3 w-3 text-amber-300" />
                                  Vainqueur du salon
                                </span>
                                <span className="rounded-full border border-amber-400/50 bg-amber-400/30 px-1.5 py-0.2 text-[9px] font-black text-amber-100">
                                  {winInfo.score} carré{winInfo.score > 1 ? "s" : ""}
                                </span>
                              </div>
                              <p className="truncate text-xs font-bold text-amber-100">
                                {winInfo.winners[0].name}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-200">
                            <span>🏆 1er</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2.5 rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent p-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-xl shrink-0">🤝</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                                  Égalité en tête ({winInfo.score} carré{winInfo.score > 1 ? "s" : ""})
                                </span>
                              </div>
                              <p className="truncate text-xs font-bold text-amber-100">
                                {winInfo.winners.map((w) => w.name).join(" · ")}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full border border-amber-400/40 bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                            Ex æquo
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leader en cours de partie */}
                  {!isGameOver && room.phase === "playing" && winInfo && winInfo.score > 0 && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-200">
                      <Crown className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                      <span className="font-semibold text-amber-300">En tête :</span>
                      <span className="font-bold text-white truncate max-w-[140px]">
                        {winInfo.winners.map((w) => w.name).join(", ")}
                      </span>
                      <span className="text-amber-200/80 font-mono text-[11px]">
                        ({winInfo.score} carré{winInfo.score > 1 ? "s" : ""})
                      </span>
                    </div>
                  )}

                  {/* Joueurs du salon avec scores */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {room.players.map((p) => {
                      const isWinner = winInfo?.winnerIds?.has(p.id) && (isGameOver || (p.score ?? 0) > 0);

                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 transition-all ${
                            isWinner
                              ? "border-amber-400/70 bg-gradient-to-r from-amber-500/25 to-yellow-500/10 text-amber-100 shadow-[0_0_10px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50"
                              : "border-border/30 bg-background/40"
                          }`}
                        >
                          <Avatar avatar={p.emoji} color={p.color} size={22} emojiSize="text-[10px]" />
                          <span className="max-w-[85px] truncate text-[11px] font-medium text-foreground">
                            {p.name}
                          </span>

                          {/* Badge de score */}
                          <span
                            className={`rounded px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                              isWinner
                                ? "bg-amber-400/30 text-amber-100"
                                : "bg-muted/40 text-muted-foreground"
                            }`}
                            title={`${p.score ?? 0} carrés formés`}
                          >
                            {p.score ?? 0} {p.score === 1 ? "pt" : "pts"}
                          </span>

                          {/* Badges d'état */}
                          {isWinner && (
                            <span title={isGameOver ? "Vainqueur !" : "En tête"}>
                              {isGameOver ? "🏆" : "👑"}
                            </span>
                          )}
                          {p.isHost && (
                            <span title="Hôte du salon">
                              <Crown className="h-2.5 w-2.5 text-amber-300" />
                            </span>
                          )}
                          {p.isAI && <Bot className="h-2.5 w-2.5 text-violet-300" />}
                          {p.connected === false && <WifiOff className="h-2.5 w-2.5 text-rose-400" />}

                          {!room.archivedAt && (
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
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
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
