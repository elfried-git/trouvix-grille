"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ReviewForm } from "./ReviewForm";
import { StarRating } from "./StarRating";
import { useGameStore } from "@/store/game-store";
import { useOnlineStore } from "@/store/online-store";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  MessageSquareQuote,
  ShieldCheck,
  Check,
  X,
  Loader2,
  Inbox,
} from "lucide-react";

// ===== Types =====
interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface ReviewsData {
  reviews: Review[];
  average: number;
  total: number;
  distribution: Record<number, number>;
  page: number;
  limit: number;
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
  if (diffH < 24) return `il y a ${diffH} h${diffH > 1 ? "" : ""}`;
  if (diffD < 7) return `il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;

  // Older than a week — full French date
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

// Stable color palette for avatars
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
export function ReviewsScreen() {
  const backHome = useGameStore((s) => s.backHome);
  const { toast } = useToast();

  const benchouPin = useOnlineStore((s) => s.benchouPin);

  const [data, setData] = useState<ReviewsData | null>(null);
  const [loading, setLoading] = useState(true);

  // ReviewForm dialog
  const [formOpen, setFormOpen] = useState(false);

  // Pending reviews (admin only, shown when isBenchou is true)
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  // Per-pending-review admin note inputs (keyed by review id)
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  // Per-pending-review action loading
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const fetchApproved = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reviews?page=1&limit=50", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as ReviewsData;
      if (res.ok && Array.isArray(json.reviews)) {
        setData(json);
      } else {
        setData({
          reviews: [],
          average: 0,
          total: 0,
          distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          page: 1,
          limit: 20,
        });
      }
    } catch {
      setData({
        reviews: [],
        average: 0,
        total: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        page: 1,
        limit: 20,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPending = useCallback(
    async (pin: string) => {
      setPendingLoading(true);
      try {
        const res = await fetch("/api/reviews/pending", {
          headers: { "x-benchou-pin": pin },
          cache: "no-store",
        });
        if (res.status === 401) {
          // PIN is wrong / session expired — clear the pending list
          setPendingReviews([]);
          toast({
            title: "Session expirée",
            description: "Reconnecte-toi sur la page « Jouer en ligne ».",
            variant: "destructive",
          });
          return;
        }
        const json = (await res.json().catch(() => ({}))) as {
          reviews?: Review[];
        };
        setPendingReviews(json.reviews ?? []);
      } catch {
        toast({
          title: "Erreur",
          description: "Impossible de charger les avis en attente.",
          variant: "destructive",
        });
      } finally {
        setPendingLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchApproved();
  }, [fetchApproved]);

  // When a Benchou PIN is available (from sessionStorage or a fresh login),
  // automatically load the pending reviews.
  useEffect(() => {
    if (benchouPin) {
      fetchPending(benchouPin);
    } else {
      setPendingReviews([]);
      setAdminNotes({});
      setActionLoading({});
    }
  }, [benchouPin, fetchPending]);

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
      // Refresh both lists
      await Promise.all([fetchApproved(), fetchPending(benchouPin)]);
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
      // Refresh both lists
      await Promise.all([fetchApproved(), fetchPending(benchouPin)]);
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

  const reviews = data?.reviews ?? [];

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
          <MessageSquareQuote className="h-6 w-6 text-amber-300" />
          <h1 className="font-display text-2xl font-black text-gold-gradient sm:text-3xl">
            Avis des joueurs
          </h1>
        </motion.div>
        <div className="w-[80px]" />
      </div>

      {/* "Laisser un avis" button */}
      <div className="mb-6 flex justify-center">
        <Button
          onClick={() => setFormOpen(true)}
          size="lg"
          className="h-12 rounded-full bg-gradient-to-r from-rose-600 to-amber-500 px-8 text-base font-semibold text-white shadow-[0_8px_30px_-6px_oklch(0.60_0.215_25/0.6)] hover:from-rose-500 hover:to-amber-400"
        >
          Laisser un avis
        </Button>
      </div>

      {/* Admin pending section — shown automatically when a Benchou PIN is
          available (set via the "Je suis Benchou Ferrari" PIN login on the
          "Jouer en ligne" page, persisted in sessionStorage) */}
      {benchouPin && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-violet-400/40 bg-violet-500/10 p-5"
        >
          <div className="mb-4 flex items-center gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-violet-200">
              <ShieldCheck className="h-5 w-5" />
              Avis en attente de validation ({pendingReviews.length})
            </h2>
          </div>

          {pendingLoading ? (
            <div className="space-y-2">
              {[0, 1].map((i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl bg-violet-500/15" />
              ))}
            </div>
          ) : pendingReviews.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/5 p-6 text-center text-sm text-violet-100/70">
              <Inbox className="h-8 w-8 text-violet-300/70" />
              Aucun avis en attente. Tout est à jour ✨
            </div>
          ) : (
            <div className="max-h-[40vh] space-y-3 overflow-y-auto scroll-romantic pr-1">
              {pendingReviews.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor(
                        r.name
                      )} font-display text-base font-bold text-white shadow-lg`}
                    >
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-semibold text-violet-100">
                          {r.name}
                        </span>
                        <StarRating value={r.rating} readOnly size={14} />
                        <span className="text-xs text-violet-200/60">
                          {formatRelativeDate(r.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-violet-100/80">
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
                          className="h-8 flex-1 border-violet-400/30 bg-background/60 text-sm"
                        />
                        <div className="flex gap-2">
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
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-card rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-11 w-11 shrink-0 rounded-full bg-amber-400/10" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3 bg-amber-400/10" />
                  <Skeleton className="h-3 w-1/4 bg-amber-400/10" />
                  <Skeleton className="h-3 w-full bg-amber-400/10" />
                  <Skeleton className="h-3 w-4/5 bg-amber-400/10" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card flex flex-col items-center gap-4 rounded-2xl p-10 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
            <MessageSquareQuote className="h-8 w-8 text-amber-300" />
          </div>
          <div>
            <p className="font-display text-lg font-bold text-amber-100">
              Aucun avis pour le moment.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Soyez le premier à donner votre avis !
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto scroll-romantic pr-1">
          {reviews.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="glass-card rounded-2xl p-5"
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
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                    {r.comment}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review form dialog */}
      <ReviewForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmitted={fetchApproved}
      />
    </div>
  );
}