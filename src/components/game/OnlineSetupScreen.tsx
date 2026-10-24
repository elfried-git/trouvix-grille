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
import { ColorSwatch } from "./ColorSwatch";
import { AdminRoomsBoard } from "./AdminRoomsBoard";
import { ReviewsBoard } from "./ReviewsBoard";
import { isPhotoAvatar } from "@/lib/types";
import {
  X,
  Users,
  Copy,
  Check,
  Swords,
  Wifi,
  WifiOff,
  AlertCircle,
  Bell,
  ShieldCheck,
  Gamepad2,
} from "lucide-react";
import { toast } from "sonner";

// Six couleurs très distinctes pour les six joueurs maximum.
const COLOR_PALETTE = [
  "#ff1744", "#ffd600", "#00c853",
  "#2979ff", "#ff6d00", "#d500f9",
];
const ROUND_OPTIONS = [5, 10, 15];

type Tab = "menu" | "create" | "join" | "benchou" | "lobby";

export function OnlineSetupScreen() {
  const backHome = useGameStore((s) => s.backHome);
  // Use precise selectors to avoid re-rendering on every state-update (timer ticks at 10Hz)
  const onlineConnected = useOnlineStore((s) => s.connected);
  const onlineConnecting = useOnlineStore((s) => s.connecting);
  const onlineRoomCode = useOnlineStore((s) => s.roomCode);
  const onlineMyPlayerId = useOnlineStore((s) => s.myPlayerId);
  const onlineState = useOnlineStore((s) => s.state);
  const onlineError = useOnlineStore((s) => s.errorMessage);
  const onlinePending = useOnlineStore((s) => s.pendingAction);
  const onlineChallenges = useOnlineStore((s) => s.challenges);
  const onlineIsBenchou = useOnlineStore((s) => s.isBenchou);
  const onlineBenchouAvatar = useOnlineStore((s) => s.benchouAvatar);
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
  const onlineDestroyRoom = useOnlineStore((s) => s.destroyRoom);
  const onlineAdminListRooms = useOnlineStore((s) => s.adminListRooms);
  const onlineAdminDeleteRoom = useOnlineStore((s) => s.adminDeleteRoom);

  const [tab, setTab] = useState<Tab>("menu");

  // Player profile (shared by create + join)
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [emoji, setEmoji] = useState(""); // data URL or empty
  const [rounds, setRounds] = useState(10);
  const [maxPlayers, setMaxPlayers] = useState(2); // default room size is 1v1; host can choose 2-6
  const [joinCode, setJoinCode] = useState("");
  const [inviteRoomCode, setInviteRoomCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [confirmRoomDelete, setConfirmRoomDelete] = useState<string | null>(null);
  const [confirmDestroyRoom, setConfirmDestroyRoom] = useState(false);
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

  // Invitation URLs prefill the room code. Returning players join directly
  // with their saved profile; first-time visitors only need to enter a name.
  useEffect(() => {
    const roomCode = sessionStorage.getItem("trouvix_invite_room");
    if (!roomCode) return;
    sessionStorage.removeItem("trouvix_invite_room");
    window.setTimeout(() => sessionStorage.removeItem("trouvix_invite_pending"), 0);
    setInviteRoomCode(roomCode);
    setJoinCode(roomCode);
    setTab("join");

    try {
      const savedProfile = JSON.parse(localStorage.getItem("trouvix_profile") || "null") as {
        name?: string;
        color?: string;
        emoji?: string;
      } | null;
      if (!savedProfile?.name?.trim()) return;
      const profile = {
        name: savedProfile.name.trim(),
        color: COLOR_PALETTE.includes(savedProfile.color ?? "") ? savedProfile.color! : COLOR_PALETTE[0],
        emoji: savedProfile.emoji ?? "",
      };
      setName(profile.name);
      setColor(profile.color);
      setEmoji(profile.emoji);
      void onlineJoinRoom(roomCode, profile, true);
    } catch {
      // Invalid saved profile: keep the invitation code prefilled for manual join.
    }
  }, [onlineJoinRoom]);

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

  // Super-admin (Benchou Ferrari) deletes a room: everyone inside — host included —
  // is ejected and sent back to the home screen.
  const handleAdminDeleteRoom = async (roomCode: string) => {
    await onlineAdminDeleteRoom(roomCode);
    setConfirmRoomDelete(null);
    toast.success(`Salon ${roomCode} supprimé.`);
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

  const shareRoomInvite = async () => {
    if (!onlineRoomCode) return;
    const inviteUrl = new URL("/", window.location.origin);
    inviteUrl.searchParams.set("salon", onlineRoomCode);
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Invitation à jouer à Trouvix Grille",
          text: `Rejoins mon salon ${onlineRoomCode} sur Trouvix Grille.`,
          url: inviteUrl.toString(),
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl.toString());
        toast.success("Lien d’invitation copié !");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("Impossible de partager le lien. Réessaie.");
    }
  };

  const copyRoomInvite = async () => {
    if (!onlineRoomCode) return;
    const inviteUrl = new URL("/", window.location.origin);
    inviteUrl.searchParams.set("salon", onlineRoomCode);
    try {
      await navigator.clipboard.writeText(inviteUrl.toString());
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 1800);
      toast.success("Lien d’invitation copié !");
    } catch {
      toast.error("Impossible de copier le lien. Réessaie.");
    }
  };

  const serverState = onlineState;
  const amHost = serverState?.hostId === onlineMyPlayerId;
  const players = serverState?.players ?? [];

  // Public rooms shown on the menu.
  // Benchou Ferrari 1v1 challenges are STRICTLY private and excluded from this list.
  const openRooms = onlinePublicRooms.filter(
    (r) => !r.isBenchouChallenge && (!r.phase || r.phase === "lobby")
  );

  // The host can only launch once every seat is taken: the capacity chosen at
  // creation (roomMaxPlayers) is the number of players required to start.
  // Benchou 1v1 challenge rooms require exactly 2 players (Host + Benchou)
  const isBenchouChallengeRoom =
    (serverState as any)?.isBenchouChallenge ||
    players.some((p) => p.name === "Benchou Ferrari");
  const roomMaxPlayers = isBenchouChallengeRoom
    ? 2
    : serverState?.maxPlayers || 2;
  const connectedCount = players.filter((p) => p.connected !== false).length;
  const roomFull = connectedCount >= roomMaxPlayers;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-6 sm:p-8"
      >
        {/* Header — single context-aware back button */}
        <div className="mb-6 flex items-center justify-between">
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
            className="h-11 px-3 text-base text-muted-foreground hover:text-foreground"
          >
            {activeTab === "lobby" ? "Quitter le salon" : activeTab === "menu" ? "Retour" : "Menu"}
          </Button>
          <span
            className={`flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-base font-medium ${
              onlineConnected
                ? "bg-emerald-500/10 text-emerald-300"
                : onlineConnecting
                  ? "bg-amber-500/10 text-amber-300"
                  : "bg-rose-500/10 text-rose-300"
            }`}
          >
            {onlineConnected ? (
              <Wifi className="h-4 w-4" />
            ) : onlineConnecting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            {onlineConnected ? "Connecté" : onlineConnecting ? "Connexion…" : "Hors ligne"}
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
            <div className="text-center">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90 shadow-[0_0_20px_rgba(251,191,36,0.08)]">
                <Gamepad2 className="h-3.5 w-3.5" /> Multijoueur
              </div>
              <h2 className="font-display text-4xl font-black tracking-tight text-gold-gradient drop-shadow-[0_4px_18px_rgba(245,158,11,0.18)] sm:text-5xl">
                Jouer en ligne
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">La partie commence avec toi.</p>
            </div>

            {/* Compact profile — name + color, shared with create/benchou */}
            <div className="relative mt-6 overflow-hidden rounded-2xl border border-amber-200/15 bg-gradient-to-br from-rose-400/[0.08] via-card/70 to-amber-300/[0.07] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.2)] sm:p-5">
              <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-amber-300/[0.08] blur-3xl" />
              <Label className="relative flex items-center gap-1 text-sm font-semibold text-amber-100/90 sm:text-base">
                Ton profil <span className="text-rose-400">*</span>
              </Label>
              <div className="relative mt-2 flex items-center gap-3">
                <div className="shrink-0 rounded-full bg-gradient-to-br from-white/90 via-amber-200/75 to-rose-400/80 p-[2px] shadow-[0_0_22px_rgba(251,191,36,0.2)]">
                  <Avatar avatar={emoji} color={color} size={54} emojiSize="text-2xl" ring={false} />
                </div>
                <div className="flex-1">
                  <Input
                    ref={nameInputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Saisis ton prénom"
                    maxLength={18}
                    className={`h-14 rounded-xl bg-black/25 text-base shadow-inner shadow-black/20 transition focus-visible:ring-amber-300/40 sm:text-lg ${
                      !name.trim() ? "border-rose-400/60" : "border-border/60"
                    }`}
                  />
                </div>
                <label
                  className="flex h-14 min-w-14 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-amber-300/35 bg-amber-300/[0.09] px-4 text-base font-medium text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-amber-200/60 hover:bg-amber-300/[0.16] active:scale-95"
                  title="Téléverser une photo (optionnel)"
                >
                  Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              {/* Compact color picker */}
              <div className="relative mt-4 grid w-full grid-cols-6 items-center justify-items-center gap-y-2 rounded-xl border border-white/[0.06] bg-black/15 px-2 py-2.5">
                {COLOR_PALETTE.map((c) => {
                  const selected = color === c;
                  return (
                    <ColorSwatch
                      key={c}
                      color={c}
                      selected={selected}
                      onClick={() => setColor(c)}
                      sizeClass="h-[34px] w-[34px] sm:h-11 sm:w-11"
                      title="Choisir"
                    />
                  );
                })}
              </div>
            </div>

            {/* Action cards */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {/* Join by code — the JOIN card */}
              <button
                onClick={() => setTab("join")}
                className="group relative min-h-36 overflow-hidden rounded-2xl border border-emerald-300/25 bg-gradient-to-br from-emerald-400/[0.13] via-emerald-500/[0.04] to-transparent p-5 text-left shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-1 hover:border-emerald-200/60 hover:shadow-[0_14px_32px_rgba(16,185,129,0.14)] active:translate-y-0 sm:min-h-40 sm:p-6"
              >
                <p className="font-display text-lg font-bold text-foreground sm:text-xl">Rejoindre un salon</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">Entre le code pour retrouver tes amis.</p>
              </button>
              <button
                onClick={() => setTab("create")}
                className="group relative min-h-36 overflow-hidden rounded-2xl border border-amber-300/25 bg-gradient-to-br from-amber-400/[0.14] via-orange-500/[0.05] to-transparent p-5 text-left shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-1 hover:border-amber-200/60 hover:shadow-[0_14px_32px_rgba(245,158,11,0.14)] active:translate-y-0 sm:min-h-40 sm:p-6"
              >
                <p className="font-display text-xl font-bold text-foreground">
                  Créer un salon
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Lance ta partie et invite tes amis.
                </p>
              </button>
              <button
                onClick={() => setTab("benchou")}
                className="group relative min-h-36 overflow-hidden rounded-2xl border border-violet-300/25 bg-gradient-to-br from-violet-400/[0.13] via-fuchsia-500/[0.04] to-transparent p-5 text-left shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition duration-300 hover:-translate-y-1 hover:border-violet-200/60 hover:shadow-[0_14px_32px_rgba(168,85,247,0.16)] active:translate-y-0 sm:min-h-40 sm:p-6"
              >
                <div className="mb-3 flex items-center gap-3">
                  <img
                    src={onlineBenchouAvatar}
                    alt="Benchou Ferrari"
                    width={48}
                    height={48}
                    loading="eager"
                    fetchPriority="high"
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-violet-400/40"
                  />
                </div>
                <p className="font-display text-xl font-bold text-foreground">
                  Jouer contre Benchou
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Défie Benchou en duel privé.
                </p>
              </button>
            </div>

            {/* Benchou Ferrari admin access with PIN */}
            <div className="mt-6 border-t border-border/40 pt-4 text-center">
              {!showPinForm && !onlineIsBenchou && (
                <button
                  onClick={() => setShowPinForm(true)}
                  className="group inline-flex min-h-12 items-center gap-2.5 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500/5 to-rose-500/5 px-5 py-3 text-base font-medium text-amber-100/90 transition-all hover:border-amber-400/60 hover:bg-amber-500/10 hover:text-amber-100 hover:shadow-[0_4px_20px_-4px_oklch(0.60_0.215_25/0.4)]"
                >
                  <img
                    src={onlineBenchouAvatar}
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
                  <p className="text-base leading-relaxed text-muted-foreground">
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
                    <p className="text-center text-sm font-medium text-rose-300">
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
                        const success = await onlineRegisterAsBenchou(benchouPin);
                        if (success) {
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
                <div className="mx-auto mt-4 flex max-w-lg flex-col items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] p-4 sm:flex-row sm:text-left">
                  <img
                    src={onlineBenchouAvatar}
                    alt="Photo de profil de Benchou Ferrari"
                    className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-300/50"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-emerald-200">Connecté en tant que Benchou Ferrari</p>
                  </div>
                </div>
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
                        <p className="text-sm text-muted-foreground">Match en {ch.totalRounds} rounds</p>
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

            {/* Super Admin Rooms Board (visible only to Benchou Ferrari) */}
            {onlineIsBenchou && (
              <div className="mt-6 space-y-6">
                <AdminRoomsBoard />
                <ReviewsBoard />
              </div>
            )}

            {/* Public rooms list — visible to everyone on the menu */}
            {openRooms.length > 0 && (
              <div className="mt-6">
                <p className="mb-3 flex items-center gap-1.5 text-sm uppercase tracking-widest text-amber-200/70">
                  <Gamepad2 className="h-3.5 w-3.5" />
                  Salons ouverts ({openRooms.length})
                  <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
                    · mis à jour en direct
                  </span>
                </p>
                <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto scroll-romantic pr-1">
                  {openRooms.map((room) => (
                    <div
                      key={room.roomCode}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                        room.isFull
                          ? "border-muted-foreground/20 bg-muted/5 opacity-70"
                          : "border-border/40 bg-card/40 hover:border-amber-400/40 hover:bg-amber-500/5"
                      }`}
                    >
                      {/* Host avatar — shows the host's photo/color so players recognize them */}
                      <Avatar
                        avatar={room.hostEmoji}
                        color={room.hostColor || COLOR_PALETTE[0]}
                        size={40}
                        emojiSize="text-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* Room code — the join key, shown prominently and copyable */}
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(room.roomCode);
                              toast.success("Code copié !");
                            }}
                            className="group flex min-h-11 items-center gap-2 rounded-md bg-background/60 px-3 py-2 font-mono text-base font-bold tracking-wider text-amber-200 transition hover:bg-amber-500/20"
                            title="Copier le code"
                          >
                            {room.roomCode}
                            <Copy className="h-2.5 w-2.5 opacity-0 transition group-hover:opacity-60" />
                          </button>
                          {room.isFull && (
                            <span className="rounded-full bg-muted/20 px-2 py-1 text-xs font-bold uppercase text-muted-foreground">
                              Complet
                            </span>
                          )}
                          {onlineIsBenchou && room.phase && room.phase !== "lobby" && (
                            <span className="rounded-full border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs font-bold uppercase text-emerald-200">
                              {room.phase === "playing" ? "En jeu" : "Terminé"}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-base text-muted-foreground">
                          Hôte : <span className="font-medium text-foreground/80">{room.hostName}</span> · {room.totalRounds} rounds
                        </p>
                        {/* Waiting-players gauge */}
                        <div className="mt-1 flex items-center gap-2">
                          <div className="flex items-center gap-1 text-sm font-medium text-amber-200/80">
                            <Users className="h-3 w-3" />
                            {room.playerCount}/{room.maxPlayers} en attente
                          </div>
                          <div className="flex gap-0.5">
                            {Array.from({ length: room.maxPlayers }).map((_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 w-1.5 rounded-full ${
                                  i < room.playerCount
                                    ? room.isFull
                                      ? "bg-rose-400"
                                      : "bg-emerald-400"
                                    : "bg-muted-foreground/25"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        disabled={room.isFull || onlinePending}
                        onClick={() => handleJoinPublic(room)}
                        className={`h-11 shrink-0 gap-1 whitespace-nowrap px-4 text-sm ${
                          room.isFull
                            ? "cursor-not-allowed opacity-50"
                            : "bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400"
                        }`}
                      >
                        {room.isFull ? (
                          <span className="text-sm">Complet</span>
                        ) : (
                          <>
                            Rejoindre
                          </>
                        )}
                      </Button>
                      {/* Super-admin only: delete the room (everyone is ejected) */}
                      {onlineIsBenchou && (
                        confirmRoomDelete === room.roomCode ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-11 px-3 text-sm text-muted-foreground hover:text-foreground"
                              onClick={() => setConfirmRoomDelete(null)}
                              disabled={onlinePending}
                            >
                              Non
                            </Button>
                            <Button
                              size="sm"
                              className="h-11 gap-1 whitespace-nowrap bg-rose-600 px-3 text-sm text-white hover:bg-rose-500"
                              onClick={() => handleAdminDeleteRoom(room.roomCode)}
                              disabled={onlinePending}
                              title={`Supprimer le salon ${room.roomCode}`}
                            >
                              Suppr.
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-11 shrink-0 gap-1 whitespace-nowrap border-rose-400/50 bg-rose-500/10 px-3 text-sm font-semibold text-rose-200 hover:bg-rose-500/20"
                            onClick={() => setConfirmRoomDelete(room.roomCode)}
                            disabled={onlinePending}
                            title={`Supprimer le salon ${room.roomCode}`}
                          >
                            Supprimer
                          </Button>
                        )
                      )}
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
            <div className="mb-5">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90">
                {activeTab === "benchou" ? <Swords className="h-3.5 w-3.5" /> : <Gamepad2 className="h-3.5 w-3.5" />}
                {activeTab === "benchou" ? "Duel privé" : "Multijoueur"}
              </div>
              <h2 className="font-display text-3xl font-black tracking-tight text-gold-gradient drop-shadow-[0_4px_18px_rgba(245,158,11,0.18)] sm:text-4xl">
                {activeTab === "create"
                  ? "Créer un salon"
                  : activeTab === "benchou"
                    ? "Jouer contre Benchou"
                    : "Rejoindre un salon"}
              </h2>
            </div>

            {/* Benchou Ferrari preview */}
            {activeTab === "benchou" && (
              <div className="relative mt-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-violet-300/30 bg-gradient-to-br from-violet-400/[0.14] via-fuchsia-500/[0.05] to-transparent p-4 shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                <img
                  src={onlineBenchouAvatar}
                  alt="Benchou Ferrari"
                  width={56}
                  height={56}
                  loading="eager"
                  fetchPriority="high"
                  className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-200/50 shadow-[0_0_22px_rgba(167,139,250,0.25)]"
                />
                <div>
                  <p className="font-display text-sm font-bold text-violet-200">Benchou Ferrari</p>
                  <p className="text-base leading-relaxed text-muted-foreground">Défi privé · 1 contre 1 🔥</p>
                </div>
              </div>
            )}

            {/* Profile */}
            <div className="relative mt-4 overflow-hidden rounded-2xl border border-amber-200/15 bg-gradient-to-br from-rose-400/[0.08] via-card/70 to-amber-300/[0.07] p-4 shadow-[0_12px_36px_rgba(0,0,0,0.2)] sm:p-5">
              <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-amber-300/[0.08] blur-3xl" />
              <Label className="relative flex items-center gap-1 text-sm font-semibold text-amber-100/90 sm:text-base">
                Ton profil <span className="text-rose-400">*</span>
              </Label>
              <div className="relative mt-2 flex items-center gap-3">
                <div className="shrink-0 rounded-full bg-gradient-to-br from-white/90 via-amber-200/75 to-rose-400/80 p-[2px] shadow-[0_0_22px_rgba(251,191,36,0.2)]">
                  <Avatar avatar={emoji} color={color} size={50} emojiSize="text-2xl" ring={false} />
                </div>
                <div className="flex-1">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Saisis ton nom"
                    maxLength={18}
                    className={`h-14 rounded-xl bg-black/25 text-base shadow-inner shadow-black/20 transition focus-visible:ring-amber-300/40 sm:text-lg ${
                      !name.trim() ? "border-rose-400/60" : "border-border/60"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300/[0.09] px-4 text-sm font-semibold text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition hover:border-amber-200/60 hover:bg-amber-300/[0.16] active:scale-95 sm:text-base"
                  title="Téléverser une photo (optionnel)"
                >
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
                    className="flex h-12 items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 text-base font-medium text-rose-200 transition hover:bg-rose-500/20"
                    title="Retirer la photo"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              {/* Color picker */}
              <div className="relative mt-4 grid w-full grid-cols-6 items-center justify-items-center gap-y-2 rounded-xl border border-white/[0.06] bg-black/15 px-2 py-2.5">
                {COLOR_PALETTE.map((c) => {
                  const taken =
                    serverState?.players.some((p) => p.color === c) ?? false;
                  const selected = color === c;
                  return (
                    <ColorSwatch
                      key={c}
                      color={c}
                      selected={selected}
                      disabled={taken && !selected}
                      onClick={() => !taken && setColor(c)}
                      sizeClass="h-[34px] w-[34px] sm:h-11 sm:w-11"
                      title={taken && !selected ? "Couleur déjà prise" : "Choisir"}
                    />
                  );
                })}
              </div>
            </div>

            {/* Round choice (create only) */}
            {(activeTab === "create" || activeTab === "benchou") && (
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-300/[0.08] via-card/60 to-rose-400/[0.04] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.14)] sm:flex-row sm:items-center sm:justify-between">
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
                      className={`h-12 px-4 text-base ${
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
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-300/[0.08] via-card/60 to-rose-400/[0.04] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.14)] sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-300" />
                  <span className="font-medium">Joueurs dans le salon</span>
                </div>
                <div className="grid grid-cols-5 gap-2 sm:flex sm:gap-2">
                  {[2, 3, 4, 5, 6].map((mp) => (
                    <Button
                      key={mp}
                      variant={maxPlayers === mp ? "default" : "outline"}
                      size="sm"
                      onClick={() => setMaxPlayers(mp)}
                      aria-pressed={maxPlayers === mp}
                      className={`h-12 px-4 text-base ${
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
              <div className="mt-4 rounded-2xl border border-emerald-200/15 bg-gradient-to-br from-emerald-400/[0.08] via-card/60 to-sky-400/[0.04] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.14)]">
                <Label className="text-sm font-semibold text-emerald-100/90 sm:text-base">Code du salon</Label>
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ex : AB3K7M"
                  maxLength={6}
                  className="mt-2 h-12 rounded-xl border-white/10 bg-black/25 font-display text-lg tracking-[0.3em] uppercase shadow-inner shadow-black/20"
                />
                {inviteRoomCode && (
                  <p className="mt-2 text-sm text-emerald-200/80">
                    Invitation reçue : le code du salon est déjà renseigné.
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={activeTab === "benchou" ? handleBenchou : activeTab === "create" ? handleCreate : handleJoin}
              disabled={!profileValid || onlinePending || (activeTab === "join" && joinCode.trim().length < 4)}
              size="lg"
              className={`group relative mt-4 h-14 w-full overflow-hidden rounded-2xl text-base font-bold text-white shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${
                activeTab === "benchou"
                  ? "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-500 shadow-[0_10px_28px_rgba(168,85,247,0.2)] hover:brightness-110"
                  : activeTab === "join"
                    ? "bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-500 shadow-[0_10px_28px_rgba(16,185,129,0.18)] hover:brightness-110"
                    : "bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 shadow-[0_10px_28px_rgba(244,63,94,0.2)] hover:brightness-110"
              }`}
            >
              {activeTab === "benchou" ? (
                "Lancer le défi"
              ) : activeTab === "create" ? (
                "Créer le salon"
              ) : (
                "Rejoindre"
              )}
            </Button>
          </div>
        )}

        {/* === LOBBY TAB === */}
        {activeTab === "lobby" && serverState && (
          <div>
            {/* Room code */}
            <div className="mb-4 min-w-0 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-3 text-center sm:p-4">
              <p className="text-sm uppercase tracking-widest text-amber-200/70">
                Code du salon
              </p>
              <div className="mt-1 flex min-w-0 items-center justify-center gap-2">
                <p className="min-w-0 break-all font-display text-3xl font-black tracking-[0.14em] text-gold-gradient sm:text-4xl sm:tracking-[0.2em]">
                  {serverState.roomCode}
                </p>
                <button
                  onClick={copyCode}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200 transition hover:bg-amber-500/20"
                  title="Copier le code"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Envoie ce code à tes amis.
              </p>
              <div className="mt-3 flex min-w-0 flex-wrap gap-2">
                  <Button
                    onClick={shareRoomInvite}
                    className="h-auto min-h-12 min-w-0 flex-1 gap-2 whitespace-normal bg-gradient-to-r from-emerald-700 to-emerald-600 px-3 py-2 text-sm text-white hover:from-emerald-600 hover:to-emerald-500 sm:text-base"
                  >
                    <span>Partager l’invitation</span>
                  </Button>
                  <Button
                    type="button"
                    onClick={copyRoomInvite}
                    variant="outline"
                    size="icon"
                    title="Copier le lien d’invitation"
                    aria-label="Copier le lien d’invitation"
                    className="h-12 w-12 shrink-0 border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                  >
                    {inviteCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
              </div>
            </div>

            {/* Players */}
            <div className="mb-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm uppercase tracking-widest text-amber-200/70">
                <Users className="h-3.5 w-3.5" />
                Joueurs ({players.length}/{roomMaxPlayers})
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
                    <Avatar avatar={p.emoji} color={p.color} size={52} emojiSize="text-2xl" />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-base font-medium">
                        {p.name}
                        {/* Online status indicator */}
                        {p.connected !== false ? (
                          <span className="flex items-center gap-1 text-sm font-bold text-emerald-300">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            Connecté
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm font-bold text-rose-300">
                            <span className="h-2 w-2 rounded-full bg-rose-400" />
                            Hors ligne
                          </span>
                        )}
                      </span>
                    </div>
                    {p.id === serverState.hostId && (
                      <span className="rounded-full bg-amber-400/20 px-2 py-1 text-xs font-bold uppercase text-amber-200">
                        Hôte
                      </span>
                    )}
                    {p.id === onlineMyPlayerId && (
                      <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-xs font-bold uppercase text-emerald-200">
                        Toi
                      </span>
                    )}
                    {/* Host can kick other players (lobby only) */}
                    {amHost && p.id !== onlineMyPlayerId && serverState.phase === "lobby" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-11 shrink-0 gap-1 px-3 text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                        onClick={() => onlineKickPlayer(p.id)}
                        disabled={onlinePending}
                        title={`Retirer ${p.name} du salon`}
                      >
                        Retirer
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Declined challenge banner */}
            {onlineChallengeDeclined && (
              <div className="mb-4 rounded-xl border border-rose-400/40 bg-rose-500/10 p-4 text-center">
                <p className="text-sm font-bold text-rose-200">
                  😔 Benchou Ferrari a décliné ton défi.
                </p>
                <p className="mt-2 text-base text-muted-foreground">
                  Tu peux quitter le salon ou réessayer plus tard.
                </p>
              </div>
            )}

            {/* Host / Guest Actions */}
            {amHost ? (
              <div className="space-y-3 pt-2">
              <Button
                onClick={onlineStartGame}
                  disabled={!roomFull}
                  size="lg"
                  className="w-full bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 disabled:opacity-40"
                >
                  {roomFull
                    ? "Lancer la partie"
                    : `En attente de joueurs (${connectedCount}/${roomMaxPlayers})`}
                </Button>

                {confirmDestroyRoom ? (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDestroyRoom(false)}
                      className="flex-1"
                      disabled={onlinePending}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      onClick={async () => {
                        setConfirmDestroyRoom(false);
                        await onlineDestroyRoom();
                      }}
                      disabled={onlinePending}
                      className="flex-1 bg-rose-600 text-white hover:bg-rose-500"
                    >
                      Confirmer la fermeture
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDestroyRoom(true)}
                    disabled={onlinePending}
                    className="w-full text-muted-foreground hover:text-rose-300"
                  >
                    Fermer le salon
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-center text-sm text-amber-200">
                  ⏳ En attente de l'hôte pour lancer la partie...
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onlineLeaveRoom();
                    setTab("menu");
                  }}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Quitter le salon
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
