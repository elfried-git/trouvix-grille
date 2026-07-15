"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOnlineStore } from "@/store/online-store";
import type { PublicRoom } from "@/store/online-store";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { ReviewsBoard } from "./ReviewsBoard";
import { AdminRoomsBoard } from "./AdminRoomsBoard";
import { isPhotoAvatar } from "@/lib/types";
import {
  ArrowLeft,
  Camera,
  X,
  Users,
  Copy,
  Check,
  Plus,
  Swords,
  LogIn,
  Wifi,
  WifiOff,
  AlertCircle,
  Bot,
  Bell,
  ShieldCheck,
  UserMinus,
  Gamepad2,
} from "lucide-react";
import { toast } from "sonner";

// 16 elegant distinct colors (matches SetupScreen palette)
const COLOR_PALETTE = [
  "#9f1239", "#b8860b", "#0f766e", "#a16207",
  "#6d28d9", "#0e7490", "#be185d", "#166534",
  "#1e3a8a", "#7c2d12", "#4a044e", "#0c4a6e",
  "#854d0e", "#155e75", "#9d174d", "#365314",
];
const ROUND_OPTIONS = [5, 10, 15];

type Tab = "menu" | "create" | "join" | "benchou" | "lobby";

export function OnlineSetupScreen() {
  const backHome = useGameStore((s) => s.backHome);
  // Use precise selectors to avoid re-rendering on every state-update (timer ticks at 10Hz)
  const onlineConnected = useOnlineStore((s) => s.connected);
  const onlineRoomCode = useOnlineStore((s) => s.roomCode);
  const onlineMyPlayerId = useOnlineStore((s) => s.myPlayerId);
  const onlineState = useOnlineStore((s) => s.state);
  const onlineError = useOnlineStore((s) => s.errorMessage);
  const onlinePending = useOnlineStore((s) => s.pendingAction);
  const onlineChallenges = useOnlineStore((s) => s.challenges);
  const onlineIsBenchou = useOnlineStore((s) => s.isBenchou);
  const onlineChallengeDeclined = useOnlineStore((s) => s.challengeDeclined);
  const onlineCreateRoom = useOnlineStore((s) => s.createRoom);
  const onlineJoinRoom = useOnlineStore((s) => s.joinRoom);
  const onlineChallengeBenchou = useOnlineStore((s) => s.challengeBenchou);
  const onlineRegisterAsBenchou = useOnlineStore((s) => s.registerAsBenchou);
  const onlineAcceptChallenge = useOnlineStore((s) => s.acceptChallenge);
  const onlineDeclineChallenge = useOnlineStore((s) => s.declineChallenge);
  const onlineStartGame = useOnlineStore((s) => s.startGame);
  const onlineLeaveRoom = useOnlineStore((s) => s.leaveRoom);
  const onlineTeardown = useOnlineStore((s) => s.teardown);
  const onlineClearError = useOnlineStore((s) => s.clearError);
  const onlineTryReconnect = useOnlineStore((s) => s.tryReconnect);
  const onlinePublicRooms = useOnlineStore((s) => s.publicRooms);
  const onlineListPublicRooms = useOnlineStore((s) => s.listPublicRooms);
  const onlineKickPlayer = useOnlineStore((s) => s.kickPlayer);
  const onlineAdminListRooms = useOnlineStore((s) => s.adminListRooms);

  const [tab, setTab] = useState<Tab>("menu");

  // Player profile (shared by create + join)
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [emoji, setEmoji] = useState(""); // data URL or empty
  const [rounds, setRounds] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState(6); // host defines max players (2-6)
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [benchouPin, setBenchouPin] = useState("");
  const [showPinForm, setShowPinForm] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Socket init + reconnect is handled by the parent OnlineRouter (called once)

  // Validation: name is required; photo is optional
  const profileValid = name.trim().length > 0;

  // Determine which "tab" to show. If we have a room + player id, we're in the lobby
  // (overrides the local tab state so create/join success naturally lands in lobby).
  const inLobby = !!onlineRoomCode && !!onlineMyPlayerId;
  const activeTab: Tab = inLobby ? "lobby" : tab;

  // Request the public room list when on the menu tab (refresh every 5s)
  useEffect(() => {
    if (activeTab !== "menu") return;
    onlineListPublicRooms();
    const id = setInterval(() => onlineListPublicRooms(), 5000);
    return () => clearInterval(id);
  }, [activeTab, onlineListPublicRooms]);

  // Request the admin room list when Benchou is connected (refresh every 5s)
  useEffect(() => {
    if (!onlineIsBenchou) return;
    onlineAdminListRooms();
    const id = setInterval(() => onlineAdminListRooms(), 5000);
    return () => clearInterval(id);
  }, [onlineIsBenchou, onlineAdminListRooms]);

  // Join a public room directly from the list — clickable as long as not full
  const handleJoinPublic = async (room: PublicRoom) => {
    if (room.isFull || onlinePending) return;
    // If no name entered yet, focus the name field and toast
    if (!name.trim()) {
      toast.error("Saisis ton prénom pour rejoindre un salon.");
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    await onlineJoinRoom(room.roomCode, { name: name.trim(), color, emoji });
  };

  const handleCreate = async () => {
    if (!profileValid) return;
    await onlineCreateRoom({ name: name.trim(), color, emoji }, rounds, maxPlayers);
  };

  const handleJoin = async () => {
    if (!profileValid || joinCode.trim().length < 4) return;
    await onlineJoinRoom(joinCode.trim(), { name: name.trim(), color, emoji });
  };

  // Challenge Benchou Ferrari — creates a room and sends a notification
  const handleBenchou = async () => {
    if (!profileValid || onlinePending) return;
    await onlineChallengeBenchou({ name: name.trim(), color, emoji }, rounds);
  };

  const uploadPhoto = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setEmoji(reader.result as string);
    reader.readAsDataURL(file);
  };

  const copyCode = () => {
    if (onlineRoomCode) {
      navigator.clipboard?.writeText(onlineRoomCode);
      setCopied(true);
      toast.success("Code copié !");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const serverState = onlineState;
  const amHost = serverState?.hostId === onlineMyPlayerId;
  const players = serverState?.players ?? [];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-6 sm:p-8"
      >
        {/* Header — single context-aware back button */}
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (activeTab === "lobby") {
                // In the lobby: leave the room and go home
                onlineLeaveRoom();
                backHome();
              } else if (activeTab === "menu") {
                // On the online menu: go back to the home screen
                onlineTeardown();
                backHome();
              } else {
                // On create/join form: go back to the online menu
                setTab("menu");
              }
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {activeTab === "lobby" ? "Quitter le salon" : activeTab === "menu" ? "Retour" : "Menu"}
          </Button>
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              onlineConnected
                ? "bg-emerald-500/10 text-emerald-300"
                : "bg-rose-500/10 text-rose-300"
            }`}
          >
            {onlineConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {onlineConnected ? "Connecté" : "Hors ligne"}
          </span>
        </div>

        {/* Error — hidden when the PIN form is open (error shown inline in the form) */}
        {onlineError && !showPinForm && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{onlineError}</span>
            <button
              onClick={onlineClearError}
              className="ml-auto text-rose-300 hover:text-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* === MENU TAB === */}
        {activeTab === "menu" && (
          <div>
            <h2 className="text-center font-display text-3xl font-bold text-gold-gradient sm:text-4xl">
              Jouer en ligne
            </h2>

            {/* Compact profile — name + color, shared with create/benchou */}
            <div className="mt-6 rounded-xl border border-border/60 bg-card/40 p-4 sm:p-3">
              <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                Ton profil <span className="text-rose-400">*</span>
              </Label>
              <div className="mt-2 flex items-center gap-3">
                <Avatar avatar={emoji} color={color} size={44} emojiSize="text-xl" />
                <div className="flex-1">
                  <Input
                    ref={nameInputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Saisis ton prénom"
                    maxLength={18}
                    className={`h-11 bg-background/60 sm:h-10 ${
                      !name.trim() ? "border-rose-400/60" : "border-border/60"
                    }`}
                  />
                </div>
                <label
                  className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 sm:h-10 sm:px-2.5"
                  title="Téléverser une photo (optionnel)"
                >
                  <Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {/* Compact color picker */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {COLOR_PALETTE.map((c) => {
                  const selected = color === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`relative h-7 w-7 rounded-full ring-2 transition ${
                        selected
                          ? "ring-white scale-110"
                          : "ring-white/20 hover:ring-white/50"
                      }`}
                      style={{ backgroundColor: c }}
                      title="Choisir"
                    >
                      {selected && (
                        <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action cards */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setTab("create")}
                className="group rounded-2xl border border-amber-400/30 bg-amber-500/5 p-6 text-left transition hover:border-amber-400/60 hover:bg-amber-500/10"
              >
                <Plus className="mb-3 h-8 w-8 text-amber-300" />
                <p className="font-display text-lg font-bold text-foreground">
                  Créer un salon
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Choisis le nombre de rounds et de joueurs, invite tes amis.
                </p>
              </button>
              <button
                onClick={() => setTab("benchou")}
                className="group rounded-2xl border border-violet-400/30 bg-violet-500/5 p-6 text-left transition hover:border-violet-400/60 hover:bg-violet-500/10"
              >
                <div className="mb-3 flex items-center gap-3">
                  <img
                    src="/benchou-ferrari-small.jpg"
                    alt="Benchou Ferrari"
                    width={48}
                    height={48}
                    loading="eager"
                    fetchPriority="high"
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-violet-400/40"
                  />
                  <Bot className="h-7 w-7 text-violet-300" />
                </div>
                <p className="font-display text-lg font-bold text-foreground">
                  Jouer avec Benchou Ferrari
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sollicite Benchou Ferrari pour une partie. Il recevra une notification.
                </p>
              </button>
            </div>

            {/* Benchou Ferrari admin access with PIN */}
            <div className="mt-6 border-t border-border/40 pt-4 text-center">
              {!showPinForm && !onlineIsBenchou && (
                <button
                  onClick={() => setShowPinForm(true)}
                  className="group inline-flex items-center gap-2.5 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500/5 to-rose-500/5 px-4 py-2 text-xs font-medium text-amber-100/70 transition-all hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-100 hover:shadow-[0_4px_20px_-4px_oklch(0.60_0.215_25/0.4)]"
                >
                  <img
                    src="/benchou-ferrari-small.jpg"
                    alt="Benchou Ferrari"
                    width={20}
                    height={20}
                    loading="eager"
                    fetchPriority="high"
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-amber-400/40 transition group-hover:ring-amber-400/70"
                  />
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-300/80 transition group-hover:text-amber-300" />
                  <span className="tracking-wide">Je suis Benchou Ferrari</span>
                </button>
              )}
              {showPinForm && !onlineIsBenchou && (
                <div className="mx-auto max-w-xs space-y-3">
                  <p className="text-xs text-muted-foreground">
                    🔐 Saisis le code PIN pour t'identifier en tant que Benchou Ferrari.
                  </p>
                  <Input
                    type="password"
                    value={benchouPin}
                    onChange={(e) => { setBenchouPin(e.target.value); onlineClearError(); }}
                    placeholder="Code PIN"
                    maxLength={6}
                    className="bg-background/60 text-center text-lg tracking-[0.3em]"
                  />
                  {/* Error message displayed right here, next to the input — not at the top */}
                  {onlineError && showPinForm && (
                    <p className="text-center text-xs font-medium text-rose-300">
                      ⚠️ {onlineError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setShowPinForm(false); setBenchouPin(""); onlineClearError(); }}
                      className="flex-1"
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        await onlineRegisterAsBenchou(benchouPin);
                        if (onlineIsBenchou) {
                          setShowPinForm(false);
                          setBenchouPin("");
                          onlineClearError();
                        }
                      }}
                      disabled={benchouPin.length < 4 || onlinePending}
                      className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white"
                    >
                      Valider
                    </Button>
                  </div>
                </div>
              )}
              {onlineIsBenchou && (
                <p className="text-xs text-emerald-300">
                  ✓ Connecté en tant que Benchou Ferrari
                </p>
              )}
            </div>

            {/* Challenge notifications panel (visible when registered as Benchou) */}
            {onlineIsBenchou && onlineChallenges.length > 0 && (
              <div className="mt-4 rounded-xl border border-violet-400/40 bg-violet-500/10 p-4">
                <p className="mb-3 flex items-center gap-1.5 font-display text-sm font-bold text-violet-200">
                  <Bell className="h-4 w-4" />
                  Défis reçus ({onlineChallenges.length})
                </p>
                <div className="flex flex-col gap-2">
                  {onlineChallenges.map((ch) => (
                    <div
                      key={ch.id}
                      className="flex items-center gap-3 rounded-lg border border-violet-400/30 bg-card/40 p-3"
                    >
                      <Avatar avatar={ch.challengerEmoji} color={ch.challengerColor} size={36} emojiSize="text-lg" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-foreground">{ch.challengerName}</p>
                        <p className="text-xs text-muted-foreground">Match en {ch.totalRounds} rounds</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onlineDeclineChallenge(ch.id)}
                          disabled={onlinePending}
                          className="border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                        >
                          Refuser
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onlineAcceptChallenge(ch.id)}
                          disabled={onlinePending}
                          className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400"
                        >
                          Accepter
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews board — visible only for Benchou Ferrari (admin) */}
            {onlineIsBenchou && (
              <div className="mt-4">
                <ReviewsBoard />
              </div>
            )}

            {/* Admin rooms board — visible only for Benchou Ferrari (super admin) */}
            {onlineIsBenchou && (
              <div className="mt-4">
                <AdminRoomsBoard />
              </div>
            )}

            {/* Public rooms list — visible to everyone on the menu */}
            {onlinePublicRooms.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 flex items-center gap-1.5 text-xs uppercase tracking-widest text-amber-200/70">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  Salons ouverts ({onlinePublicRooms.length})
                </p>
                <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto scroll-romantic pr-1">
                  {onlinePublicRooms.map((room) => (
                    <div
                      key={room.roomCode}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                        room.isFull
                          ? "border-muted-foreground/20 bg-muted/5 opacity-60"
                          : "border-border/40 bg-card/40 hover:border-amber-400/40 hover:bg-amber-500/5"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-bold tracking-wider text-amber-200">
                            {room.roomCode}
                          </span>
                          {room.isFull && (
                            <span className="rounded-full bg-muted/20 px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                              Complet
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Hôte : {room.hostName} · {room.playerCount}/{room.maxPlayers} joueurs · {room.totalRounds} rounds
                        </p>
                      </div>
                      <Button
                        size="sm"
                        disabled={room.isFull || onlinePending}
                        onClick={() => handleJoinPublic(room)}
                        className={`h-8 shrink-0 gap-1 whitespace-nowrap ${
                          room.isFull
                            ? "cursor-not-allowed opacity-50"
                            : "bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400"
                        }`}
                      >
                        {room.isFull ? (
                          <span className="text-xs">Complet</span>
                        ) : (
                          <>
                            <LogIn className="h-3.5 w-3.5" /> Rejoindre
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === CREATE / JOIN TAB (profile form) === */}
        {(activeTab === "create" || activeTab === "join" || activeTab === "benchou") && (
          <div>
            <h2 className="font-display text-2xl font-bold text-gold-gradient sm:text-3xl">
              {activeTab === "create"
                ? "Créer un salon"
                : activeTab === "benchou"
                  ? "Jouer avec Benchou Ferrari"
                  : "Rejoindre un salon"}
            </h2>

            {/* Benchou Ferrari preview */}
            {activeTab === "benchou" && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-violet-400/30 bg-violet-500/5 p-3">
                <img
                  src="/benchou-ferrari-small.jpg"
                  alt="Benchou Ferrari"
                  width={56}
                  height={56}
                  loading="eager"
                  fetchPriority="high"
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-400/40"
                />
                <div>
                  <p className="font-display text-sm font-bold text-violet-200">Benchou Ferrari</p>
                  <p className="text-xs text-muted-foreground">Je suis prêt à te défier. 😂</p>
                </div>
              </div>
            )}

            {/* Profile */}
            <div className="mt-6 rounded-xl border border-border/60 bg-card/40 p-4 sm:p-3">
              <Label className="flex items-center gap-1 text-xs text-muted-foreground">
                Ton profil <span className="text-rose-400">*</span>
              </Label>
              <div className="mt-2 flex items-center gap-3">
                <Avatar avatar={emoji} color={color} size={52} emojiSize="text-2xl" />
                <div className="flex-1">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Saisis ton nom"
                    maxLength={18}
                    className={`h-11 bg-background/60 sm:h-10 ${
                      !name.trim() ? "border-rose-400/60" : "border-border/60"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-1.5">
                <label
                  className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 text-xs font-medium text-amber-200 transition hover:bg-amber-500/20 sm:h-7 sm:gap-1 sm:px-2.5 sm:text-[11px]"
                  title="Téléverser une photo (optionnel)"
                >
                  <Camera className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  {isPhotoAvatar(emoji) ? "Photo ✓" : "Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
                {isPhotoAvatar(emoji) && (
                  <button
                    onClick={() => setEmoji("")}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10 px-3 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 sm:h-7 sm:px-2.5 sm:text-[11px]"
                    title="Retirer la photo"
                  >
                    <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                )}
              </div>
              {/* Color picker */}
              <div className="mt-2 flex flex-wrap gap-2 sm:gap-1.5">
                {COLOR_PALETTE.map((c) => {
                  const taken =
                    serverState?.players.some((p) => p.color === c) ?? false;
                  const selected = color === c;
                  return (
                    <button
                      key={c}
                      onClick={() => !taken && setColor(c)}
                      disabled={taken && !selected}
                      className={`relative h-9 w-9 rounded-full ring-2 transition sm:h-7 sm:w-7 ${
                        selected
                          ? "ring-white scale-110"
                          : taken
                            ? "ring-transparent opacity-30"
                            : "ring-white/30 hover:ring-white/60"
                      }`}
                      style={{ backgroundColor: c }}
                      title={taken && !selected ? "Couleur déjà prise" : "Choisir"}
                    >
                      {selected && (
                        <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow sm:h-3.5 sm:w-3.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Round choice (create only) */}
            {(activeTab === "create" || activeTab === "benchou") && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-300" />
                  <span className="font-medium">Longueur du match</span>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
                  {ROUND_OPTIONS.map((r) => (
                    <Button
                      key={r}
                      variant={rounds === r ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRounds(r)}
                      className={`h-11 sm:h-8 ${
                        rounds === r
                          ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white"
                          : ""
                      }`}
                    >
                      {r} rounds
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Max players choice (create only — host defines how many can join) */}
            {activeTab === "create" && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-300" />
                  <span className="font-medium">Nombre max de joueurs</span>
                </div>
                <div className="grid grid-cols-5 gap-2 sm:flex sm:gap-2">
                  {[2, 3, 4, 5, 6].map((mp) => (
                    <Button
                      key={mp}
                      variant={maxPlayers === mp ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMaxPlayers(mp)}
                      className={`h-11 px-3 sm:h-8 ${
                        maxPlayers === mp
                          ? "bg-gradient-to-r from-amber-600 to-amber-500 text-white"
                          : ""
                      }`}
                    >
                      {mp}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Join code input (join only) */}
            {activeTab === "join" && (
              <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-4">
                <Label className="text-xs text-muted-foreground">Code du salon</Label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ex : AB3K7M"
                  maxLength={6}
                  className="mt-1 bg-background/60 font-display text-lg tracking-[0.3em] uppercase"
                />
              </div>
            )}

            <Button
              onClick={activeTab === "benchou" ? handleBenchou : activeTab === "create" ? handleCreate : handleJoin}
              disabled={!profileValid || onlinePending || (activeTab === "join" && joinCode.trim().length < 4)}
              size="lg"
              className={
                activeTab === "benchou"
                  ? "mt-4 w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400 disabled:opacity-50"
                  : "mt-4 w-full bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 disabled:opacity-50"
              }
            >
              {activeTab === "benchou" ? (
                <>
                  <Swords className="mr-2 h-5 w-5" /> Lancer le défi
                </>
              ) : activeTab === "create" ? (
                <>
                  <Plus className="mr-2 h-5 w-5" /> Créer le salon
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" /> Rejoindre
                </>
              )}
            </Button>
          </div>
        )}

        {/* === LOBBY TAB === */}
        {activeTab === "lobby" && serverState && (
          <div>
            {/* Room code */}
            <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 text-center">
              <p className="text-xs uppercase tracking-widest text-amber-200/70">
                Code du salon
              </p>
              <div className="mt-1 flex items-center justify-center gap-3">
                <p className="font-display text-4xl font-black tracking-[0.2em] text-gold-gradient sm:text-3xl">
                  {serverState.roomCode}
                </p>
                <button
                  onClick={copyCode}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200 transition hover:bg-amber-500/20 sm:h-9 sm:w-9 sm:p-2"
                  title="Copier le code"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Partage ce code avec tes amis pour qu'ils te rejoignent.
              </p>
            </div>

            {/* Players */}
            <div className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-widest text-amber-200/70">
                <Users className="h-3.5 w-3.5" />
                Joueurs ({players.length}/{serverState.maxPlayers || 6})
              </p>
              <div className="flex flex-col gap-2">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 rounded-xl border p-4 sm:p-3 ${
                      p.id === serverState.hostId
                        ? "border-amber-400/40 bg-amber-500/5"
                        : "border-border/60 bg-card/40"
                    }`}
                  >
                    <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 font-medium">
                        {p.name}
                        {/* Online status indicator */}
                        {p.connected !== false ? (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase text-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            Connecté
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold uppercase text-rose-300">
                            <span className="h-2 w-2 rounded-full bg-rose-400" />
                            Hors ligne
                          </span>
                        )}
                      </span>
                    </div>
                    {p.id === serverState.hostId && (
                      <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-200">
                        Hôte
                      </span>
                    )}
                    {p.id === onlineMyPlayerId && (
                      <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-200">
                        Toi
                      </span>
                    )}
                    {/* Host can kick other players (lobby only) */}
                    {amHost && p.id !== onlineMyPlayerId && serverState.phase === "lobby" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 shrink-0 gap-1 px-2 text-xs text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                        onClick={() => onlineKickPlayer(p.id)}
                        disabled={onlinePending}
                        title={`Retirer ${p.name} du salon`}
                      >
                        <UserMinus className="h-3.5 w-3.5" /> Retirer
                      </Button>
                    )}
                  </div>
                ))}
                {players.length < 2 && (
                  <p className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
                    En attente d'au moins un autre joueur...
                  </p>
                )}
              </div>
            </div>

            {/* Status */}
            <p className="mb-4 text-center text-sm text-muted-foreground">
              {serverState.statusMessage}
            </p>

            {/* Declined challenge banner */}
            {onlineChallengeDeclined && (
              <div className="mb-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-center">
                <p className="text-sm font-bold text-rose-200">
                  😔 Benchou Ferrari a décliné ton défi.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tu peux quitter le salon ou réessayer plus tard.
                </p>
              </div>
            )}

            {/* Host actions */}
            {amHost ? (
              <Button
                onClick={onlineStartGame}
                disabled={players.length < 2}
                size="lg"
                className="w-full bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 disabled:opacity-50"
              >
                <Swords className="mr-2 h-5 w-5" />
                Lancer la partie
              </Button>
            ) : (
              <p className="text-center text-sm text-amber-200/70">
                En attente de l'hôte pour lancer la partie...
              </p>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // Leave room but keep socket alive for quick rejoin
                onlineLeaveRoom();
                setTab("menu");
                // Don't clear name/emoji — user might just want to modify, not re-enter everything
              }}
              className="mt-3 w-full text-muted-foreground hover:text-foreground"
            >
              Retour au menu en ligne
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}