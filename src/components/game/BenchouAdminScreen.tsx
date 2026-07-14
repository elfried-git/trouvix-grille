"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGameStore } from "@/store/game-store";
import { useOnlineStore } from "@/store/online-store";
import type { Challenge } from "@/store/online-store";
import { useToast } from "@/hooks/use-toast";
import { Avatar } from "./Avatar";
import { StarRating } from "./StarRating";
import {
  ArrowLeft,
  ShieldCheck,
  Bell,
  Check,
  X,
  Loader2,
  Inbox,
  LogOut,
  Users,
  MessageSquareQuote,
  Swords,
  Clock,
  Trash2,
  ChevronDown,
  Gamepad2,
} from "lucide-react";

// ===== Types =====
interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  validatedAt?: string | null;
}

// ===== Helpers =====
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH} h`;
  if (diffD < 7) return `il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return date.toLocaleDateString();
  }
}

function formatChallengeAge(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
}

const AVATAR_COLORS = [
  "from-rose-500 to-rose-700",
  "from-amber-400 to-amber-600",
  "from-emerald-400 to-emerald-600",
  "from-violet-400 to-violet-600",
  "from-fuchsia-400 to-fuchsia-600",
  "from-cyan-400 to-cyan-600",
  "from-orange-400 to-orange-600",
  "from-lime-400 to-lime-600",
  "from-pink-400 to-pink-600",
  "from-teal-400 to-teal-600",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function avatarColor(name: string): string {
  return AVATAR_COLORS[hashName(name) % AVATAR_COLORS.length];
}

// ===== Main Component =====
export function BenchouAdminScreen() {
  const backHome = useGameStore((s) => s.backHome);
  const goToOnlineSetup = useGameStore((s) => s.goToOnlineSetup);
  const { toast } = useToast();

  const benchouPin = useOnlineStore((s) => s.benchouPin);
  const isBenchou = useOnlineStore((s) => s.isBenchou);
  const challenges = useOnlineStore((s) => s.challenges);
  const onlineState = useOnlineStore((s) => s.state);
  const pendingAction = useOnlineStore((s) => s.pendingAction);
  const onlineAcceptChallenge = useOnlineStore((s) => s.acceptChallenge);
  const onlineDeclineChallenge = useOnlineStore((s) => s.declineChallenge);
  const onlineTeardown = useOnlineStore((s) => s.teardown);

  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);

  const [sollicitationsOpen, setSollicitationsOpen] = useState(true);
  const [pendingReviewsOpen, setPendingReviewsOpen] = useState(true);
  const [approvedReviewsOpen, setApprovedReviewsOpen] = useState(true);

  const [acceptedChallenge, setAcceptedChallenge] = useState<Challenge | null>(null);

  const [activeTab, setActiveTab] = useState<string>("sollicitations");
  const didAutoSwitch = useRef(false);

  useEffect(() => {
    const online = useOnlineStore.getState();
    online.init();
    online.tryReconnect();
  }, []);

  const fetchAllReviews = useCallback(
    async (pin: string) => {
      setReviewsLoading(true);
      try {
        const res = await fetch("/api/reviews/all", {
          headers: { "x-benchou-pin": pin },
          cache: "no-store",
        });
        if (res.status === 401) {
          setAllReviews([]);
          return;
        }
        const json = (await res.json().catch(() => ({}))) as {
          reviews?: Review[];
        };
        setAllReviews(json.reviews ?? []);
      } catch {
        setAllReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (benchouPin) {
      fetchAllReviews(benchouPin);
    } else {
      setAllReviews([]);
    }
  }, [benchouPin, fetchAllReviews]);

  const pendingReviews = allReviews.filter((r) => r.status === "pending");
  const approvedReviews = allReviews.filter((r) => r.status === "approved");

  useEffect(() => {
    if (didAutoSwitch.current) return;
    if (challenges.length > 0) {
      setActiveTab("sollicitations");
      didAutoSwitch.current = true;
    } else if (allReviews.length > 0 && !reviewsLoading) {
      setActiveTab("avis");
      didAutoSwitch.current = true;
    }
  }, [challenges.length, allReviews.length, reviewsLoading]);

  useEffect(() => {
    if (acceptedChallenge && onlineState?.phase === "playing") {
      setAcceptedChallenge(null);
      goToOnlineSetup();
    }
  }, [acceptedChallenge, onlineState, goToOnlineSetup]);

  const handleApprove = async (reviewId: string) => {
    if (!benchouPin) return;
    setActionLoading((s) => ({ ...s, [reviewId]: true }));
    try {
      const res = await fetch(`/api/reviews/${reviewId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-benchou-pin": benchouPin,
        },
      });
      if (res.status === 401) {
        toast({
          title: "Session expirée",
          description: "Reconnecte-toi sur la page « Jouer en ligne ».",
          variant: "destructive",
        });
        return;
      }
      if (!res.ok) {
        toast({
          title: "Erreur",
          description: "Impossible de valider cet avis.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Avis validé ✓",
        description: "L'avis est maintenant public.",
      });
      await fetchAllReviews(benchouPin);
    } catch {
      toast({
        title: "Erreur",
        description: "Réseau indisponible.",
        variant: "destructive",
      });
    } finally {
      setActionLoading((s) => ({ ...s, [reviewId]: false }));
    }
  };

  const handleReject = async (reviewId: string) => {
    if (!benchouPin) return;
    const note = (adminNotes[reviewId] || "").trim().slice(0, 300);
    setActionLoading((s) => ({ ...s, [reviewId]: true }));
    try {
      const res = await fetch(`/api/reviews/${reviewId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-benchou-pin": benchouPin,
        },
        body: JSON.stringify({ adminNote: note || undefined }),
      });
      if (res.status === 401) {
        toast({
          title: "Session expirée",
          description: "Reconnecte-toi sur la page « Jouer en ligne ».",
          variant: "destructive",
        });
        return;
      }
      if (!res.ok) {
        toast({
          title: "Erreur",
          description: "Impossible de rejeter cet avis.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Avis rejeté",
        description: note ? "Note enregistrée." : "L'avis a été rejeté.",
      });
      await fetchAllReviews(benchouPin);
    } catch {
      toast({
        title: "Erreur",
        description: "Réseau indisponible.",
        variant: "destructive",
      });
    } finally {
      setActionLoading((s) => ({ ...s, [reviewId]: false }));
    }
  };

  const handleDelete = async (reviewId: string) => {
    if (!benchouPin) return;
    setActionLoading((s) => ({ ...s, [reviewId]: true }));
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "DELETE",
        headers: { "x-benchou-pin": benchouPin },
      });
      if (res.status === 401) {
        toast({
          title: "Session expirée",
          description: "Reconnecte-toi sur la page « Jouer en ligne ».",
          variant: "destructive",
        });
        return;
      }
      if (!res.ok) {
        toast({
          title: "Erreur",
          description: "Impossible de supprimer cet avis.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Avis supprimé",
        description: "L'avis a été définitivement retiré.",
      });
      setDeleteTarget(null);
      await fetchAllReviews(benchouPin);
    } catch {
      toast({
        title: "Erreur",
        description: "Réseau indisponible.",
        variant: "destructive",
      });
    } finally {
      setActionLoading((s) => ({ ...s, [reviewId]: false }));
    }
  };

  const handleAcceptChallenge = async (challenge: Challenge) => {
    setAcceptedChallenge(challenge);
    setActiveTab("sollicitations");
    await onlineAcceptChallenge(challenge.id);
    toast({
      title: "Défi accepté !",
      description: `En attente que ${challenge.challengerName} lance la partie…`,
    });
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    await onlineDeclineChallenge(challengeId);
    toast({
      title: "Défi refusé",
      description: "Le joueur a été notifié.",
    });
  };

  const handleLogout = () => {
    onlineTeardown();
    toast({
      title: "Déconnecté",
      description: "Tu as quitté l'espace Benchou Ferrari.",
    });
    backHome();
  };

  if (!benchouPin) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card flex w-full flex-col items-center gap-5 rounded-2xl p-10 text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/15 ring-2 ring-violet-400/30">
            <ShieldCheck className="h-10 w-10 text-violet-300" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black text-violet-200">
              Espace Benchou Ferrari
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu dois te connecter pour accéder au tableau de bord. Le lien
              « Je suis Benchou Ferrari » se trouve sur la page « Jouer en
              ligne ».
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={goToOnlineSetup}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Aller à « Jouer en ligne »
            </Button>
            <Button onClick={backHome} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Accueil
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const totalTasks = challenges.length + pendingReviews.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={backHome}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour
        </Button>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-center"
        >
          <ShieldCheck className="h-6 w-6 text-violet-300" />
          <h1 className="font-display text-2xl font-black text-violet-200 sm:text-3xl">
            Espace Benchou Ferrari
          </h1>
        </motion.div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-rose-300"
          title="Se déconnecter"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Benchou identity card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center gap-4 rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4"
      >
        <img
          src="/benchou-ferrari-small.jpg"
          alt="Benchou Ferrari"
          width={56}
          height={56}
          loading="eager"
          fetchPriority="high"
          className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-400/50"
        />
        <div className="flex-1">
          <p className="font-display text-lg font-bold text-violet-100">
            Benchou Ferrari
          </p>
          <p className="flex items-center gap-1.5 text-xs text-violet-200/70">
            {isBenchou ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                En ligne — Super Admin
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Session active (socket hors ligne)
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-black text-violet-200">
            {totalTasks}
          </p>
          <p className="text-xs text-violet-200/60">
            {totalTasks > 1 ? "actions" : "action"}
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-full bg-violet-500/10 p-1">
          <TabsTrigger
            value="sollicitations"
            className="rounded-full data-[state=active]:bg-violet-500/30 data-[state=active]:text-violet-100"
          >
            <Swords className="mr-1.5 h-4 w-4" />
            Sollicitations
            {challenges.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 text-xs font-bold text-white">
                {challenges.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="avis"
            className="rounded-full data-[state=active]:bg-amber-500/30 data-[state=active]:text-amber-100"
          >
            <MessageSquareQuote className="mr-1.5 h-4 w-4" />
            Avis
            {pendingReviews.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
                {pendingReviews.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* === Tab 1: Sollicitations === */}
        <TabsContent value="sollicitations" className="mt-4 space-y-4">
          {/* Waiting card — shown after accepting a challenge, until the host starts the game */}
          <AnimatePresence>
            {acceptedChallenge && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/10 p-5 shadow-[0_0_30px_-8px_oklch(0.70_0.15_160/0.4)]"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar
                      avatar={acceptedChallenge.challengerEmoji}
                      color={acceptedChallenge.challengerColor}
                      size={56}
                      emojiSize="text-2xl"
                    />
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-base font-bold text-emerald-100">
                      Défi accepté — {acceptedChallenge.challengerName}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-emerald-200/80">
                      <Clock className="h-3.5 w-3.5" />
                      En attente que l'hôte lance la partie…
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-200/50">
                      Salon :{" "}
                      <span className="font-mono font-bold">
                        {acceptedChallenge.roomCode}
                      </span>{" "}
                      · Match en {acceptedChallenge.totalRounds} rounds
                    </p>
                  </div>
                  <Gamepad2 className="h-8 w-8 text-emerald-300/60" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsible: Défis reçus */}
          <Collapsible
            open={sollicitationsOpen}
            onOpenChange={setSollicitationsOpen}
            className="rounded-2xl border border-violet-400/30 bg-violet-500/5 p-4"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-violet-300" />
                <h2 className="font-display text-lg font-bold text-violet-200">
                  Défis reçus ({challenges.length})
                </h2>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-violet-300/70 transition-transform duration-200 ${
                  sollicitationsOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4">
                {challenges.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/5 p-8 text-center text-sm text-violet-100/70">
                    <Inbox className="h-10 w-10 text-violet-300/50" />
                    <p className="font-medium">Aucune sollicitation pour le moment</p>
                    <p className="text-xs text-violet-200/50">
                      Les joueurs qui te défient apparaîtront ici. Tu pourras
                      accepter ou refuser en un clic.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[55vh] space-y-3 overflow-y-auto scroll-romantic pr-1">
                    {challenges.map((ch, i) => (
                      <motion.div
                        key={ch.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="rounded-xl border border-violet-400/30 bg-card/40 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar
                            avatar={ch.challengerEmoji}
                            color={ch.challengerColor}
                            size={48}
                            emojiSize="text-xl"
                          />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-bold text-foreground">
                                {ch.challengerName}
                              </span>
                              <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-200">
                                <Users className="h-3 w-3" />
                                Match en {ch.totalRounds} rounds
                              </span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatChallengeAge(ch.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Code du salon :{" "}
                              <span className="font-mono font-bold text-violet-200">
                                {ch.roomCode}
                              </span>
                            </p>
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeclineChallenge(ch.id)}
                                disabled={pendingAction}
                                className="border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                              >
                                {pendingAction ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="mr-1 h-3.5 w-3.5" />
                                )}
                                Refuser
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleAcceptChallenge(ch)}
                                disabled={pendingAction}
                                className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400"
                              >
                                {pendingAction ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="mr-1 h-3.5 w-3.5" />
                                )}
                                Accepter
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        {/* === Tab 2: Avis === */}
        <TabsContent value="avis" className="mt-4">
          {reviewsLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <Skeleton
                  key={i}
                  className="h-28 w-full rounded-xl bg-amber-500/15"
                />
              ))}
            </div>
          ) : allReviews.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-8"
            >
              <div className="flex flex-col items-center gap-2 text-center text-sm text-amber-100/70">
                <Inbox className="h-10 w-10 text-amber-300/50" />
                <p className="font-medium">Aucun avis pour le moment</p>
                <p className="text-xs text-amber-200/50">
                  Les avis soumis par les joueurs apparaîtront ici pour
                  validation.
                </p>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-5">
              {/* --- Section 1: En attente de validation (collapsible) --- */}
              <Collapsible
                open={pendingReviewsOpen}
                onOpenChange={setPendingReviewsOpen}
                className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4"
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="h-5 w-5 text-amber-300" />
                    <h2 className="font-display text-lg font-bold text-amber-100">
                      En attente de validation ({pendingReviews.length})
                    </h2>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-amber-300/70 transition-transform duration-200 ${
                      pendingReviewsOpen ? "rotate-180" : ""
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4">
                    {pendingReviews.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-100/60">
                        <Check className="h-4 w-4 text-emerald-400" />
                        Tout est à jour ✨ Aucun avis en attente.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pendingReviews.map((r, i) => (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-xl border border-amber-400/30 bg-card/40 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor(
                                  r.name
                                )} font-display text-lg font-bold text-white shadow-lg`}
                              >
                                {r.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-semibold text-foreground">
                                    {r.name}
                                  </span>
                                  <StarRating value={r.rating} readOnly size={14} />
                                  <span className="text-xs text-muted-foreground">
                                    {formatRelativeDate(r.createdAt)}
                                  </span>
                                  <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                                    En attente
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                                  {r.comment}
                                </p>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <Input
                                    value={adminNotes[r.id] || ""}
                                    onChange={(e) =>
                                      setAdminNotes((s) => ({
                                        ...s,
                                        [r.id]: e.target.value,
                                      }))
                                    }
                                    placeholder="Note interne (optionnel)"
                                    maxLength={300}
                                    className="h-8 flex-1 border-amber-400/30 bg-background/60 text-sm"
                                  />
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleReject(r.id)}
                                      disabled={actionLoading[r.id]}
                                      className="bg-rose-600 text-white hover:bg-rose-500"
                                    >
                                      {actionLoading[r.id] ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <X className="mr-1 h-3.5 w-3.5" />
                                      )}
                                      Rejeter
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={() => handleApprove(r.id)}
                                      disabled={actionLoading[r.id]}
                                      className="bg-emerald-600 text-white hover:bg-emerald-500"
                                    >
                                      {actionLoading[r.id] ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="mr-1 h-3.5 w-3.5" />
                                      )}
                                      Valider
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setDeleteTarget(r)}
                                      disabled={actionLoading[r.id]}
                                      className="border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
                                      title="Supprimer définitivement"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* --- Section 2: Avis publiés (collapsible) --- */}
              <Collapsible
                open={approvedReviewsOpen}
                onOpenChange={setApprovedReviewsOpen}
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4"
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-emerald-400" />
                    <h2 className="font-display text-lg font-bold text-emerald-100">
                      Avis publiés ({approvedReviews.length})
                    </h2>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-emerald-400/70 transition-transform duration-200 ${
                      approvedReviewsOpen ? "rotate-180" : ""
                    }`}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-4">
                    {approvedReviews.length === 0 ? (
                      <div className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-4 text-sm text-emerald-100/60">
                        <Inbox className="h-4 w-4 text-emerald-400/50" />
                        Aucun avis publié pour le moment.
                      </div>
                    ) : (
                      <div className="max-h-[45vh] space-y-3 overflow-y-auto scroll-romantic pr-1">
                        {approvedReviews.map((r, i) => (
                          <motion.div
                            key={r.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="rounded-xl border border-emerald-400/30 bg-card/40 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor(
                                  r.name
                                )} font-display text-lg font-bold text-white shadow-lg`}
                              >
                                {r.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="font-semibold text-foreground">
                                    {r.name}
                                  </span>
                                  <StarRating value={r.rating} readOnly size={14} />
                                  <span className="text-xs text-muted-foreground">
                                    {formatRelativeDate(r.createdAt)}
                                  </span>
                                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
                                    Publié
                                  </span>
                                </div>
                                <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                                  {r.comment}
                                </p>
                                <div className="mt-3 flex justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setDeleteTarget(r)}
                                    disabled={actionLoading[r.id]}
                                    className="border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
                                  >
                                    {actionLoading[r.id] ? (
                                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    )}
                                    Supprimer
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="glass-card border-rose-400/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-200">
              <Trash2 className="h-5 w-5" />
              Supprimer cet avis ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. L'avis de{" "}
              <strong>{deleteTarget?.name}</strong> sera définitivement retiré et
              ne sera plus visible ni par les joueurs ni dans le tableau de bord.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteTarget && (
            <div className="rounded-lg border border-rose-400/20 bg-rose-500/5 p-3 text-sm text-foreground/70">
              <div className="mb-1 flex items-center gap-1.5">
                <StarRating value={deleteTarget.rating} readOnly size={12} />
                <span className="text-xs text-muted-foreground">
                  {deleteTarget.status === "approved" ? "Publié" : "En attente"}
                </span>
              </div>
              <p className="italic">&ldquo;{deleteTarget.comment}&rdquo;</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTarget ? actionLoading[deleteTarget.id] : false}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              disabled={deleteTarget ? actionLoading[deleteTarget.id] : false}
              className="bg-rose-600 text-white hover:bg-rose-500"
            >
              {deleteTarget && actionLoading[deleteTarget.id] ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer hint */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Les sollicitations expirent si le salon est fermé. Les avis rejetés
        restent invisibles pour les joueurs.
      </p>
    </div>
  );
}