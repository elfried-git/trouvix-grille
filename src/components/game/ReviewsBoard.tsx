"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Star,
  Trash2,
  Loader2,
  MessageSquare,
  CheckCircle2,
  Heart,
  Eye,
  EyeOff,
} from "lucide-react";

interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  visible: boolean;
  adminLiked: boolean;
}

/**
 * Board Avis/Suggestions — utilisé dans le dashboard Benchou Ferrari.
 * L'admin peut : supprimer, masquer/afficher, liker (coup de cœur).
 */
export function ReviewsBoard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      // ?all=true pour récupérer aussi les avis masqués (admin only)
      const res = await fetch("/api/reviews?all=true", { cache: "no-store" });
      if (!res.ok) throw new Error("Erreur");
      const data = await res.json();
      setReviews(data.reviews ?? []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // Met à jour localement un avis après une action admin
  const updateReview = (id: string, patch: Partial<Review>) => {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleDelete = async (id: string, name: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      setReviews((prev) => prev.filter((r) => r.id !== id));
      showToast(`Avis de ${name} supprimé.`);
    } catch {
      showToast("Erreur lors de la suppression.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleVisible = async (id: string, current: boolean, name: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: !current }),
      });
      if (!res.ok) throw new Error("Erreur");
      updateReview(id, { visible: !current });
      showToast(!current ? `Avis de ${name} affiché.` : `Avis de ${name} masqué.`);
    } catch {
      showToast("Erreur lors de la mise à jour.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleLike = async (id: string, current: boolean, name: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminLiked: !current }),
      });
      if (!res.ok) throw new Error("Erreur");
      updateReview(id, { adminLiked: !current });
      showToast(!current ? `Coup de cœur pour ${name} ! ❤️` : `Coup de cœur retiré de ${name}.`);
    } catch {
      showToast("Erreur lors de la mise à jour.");
    } finally {
      setBusyId(null);
    }
  };

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  return (
    <div className="rounded-2xl border border-violet-400/30 bg-violet-500/5 p-4 sm:p-5">
      {/* En-tête */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-bold text-violet-100">
          <MessageSquare className="h-4 w-4 text-violet-300" />
          Avis &amp; Suggestions
          {reviews.length > 0 && (
            <span className="rounded-full bg-violet-400/20 px-2 py-0.5 text-[10px] font-bold text-violet-200">
              {reviews.length}
            </span>
          )}
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={loadReviews}
          disabled={loading}
          className="h-7 border-violet-400/30 px-2 text-[11px] text-violet-200 hover:bg-violet-500/10"
        >
          {loading ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1 h-3 w-3" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Stats + distribution */}
      {reviews.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-[auto_1fr]">
          <div className="flex items-center justify-center gap-3 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
            <p className="font-display text-3xl font-black text-violet-200">
              {avgRating.toFixed(1)}
            </p>
            <div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-3 w-3 ${
                      s <= Math.round(avgRating)
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {reviews.length} avis
              </p>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1">
            {distribution.map(({ star, count }) => {
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="flex w-7 items-center gap-0.5 text-[10px] text-muted-foreground">
                    {star}
                    <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-400"
                    />
                  </div>
                  <span className="w-6 text-right text-[10px] text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des avis */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-violet-300" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/30 bg-card/20 p-6 text-center">
          <p className="text-2xl">📭</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Aucun avis pour l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto scroll-romantic pr-3">
          <AnimatePresence mode="popLayout">
            {reviews.map((r, i) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
                className={`relative overflow-visible rounded-xl border p-3 transition ${
                  !r.visible
                    ? "border-muted-foreground/20 bg-muted/5 opacity-60"
                    : r.adminLiked
                      ? "border-amber-400/50 bg-gradient-to-br from-amber-500/10 to-rose-500/5"
                      : "border-border/30 bg-card/30 hover:border-violet-400/30"
                }`}
              >
                {/* Badge "Admin a aimé" + "Masqué" */}
                <div className="absolute right-2 top-2 flex gap-1">
                  {r.adminLiked && r.visible && (
                    <span className="flex items-center gap-0.5 rounded-full border border-rose-500/50 bg-rose-500/15 px-1.5 py-0.5 text-[8px] font-bold text-rose-200">
                      <Heart className="h-2 w-2 fill-rose-500 text-rose-500" />
                      Admin a aimé
                    </span>
                  )}
                  {!r.visible && (
                    <span className="flex items-center gap-0.5 rounded-full border border-muted-foreground/30 bg-muted/20 px-1.5 py-0.5 text-[8px] font-bold uppercase text-muted-foreground">
                      <EyeOff className="h-2 w-2" />
                      Masqué
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold text-white"
                      style={{
                        background: `linear-gradient(135deg, hsl(${
                          (r.authorName.charCodeAt(0) * 7) % 360
                        }, 70%, 55%), hsl(${
                          (r.authorName.charCodeAt(0) * 7 + 40) % 360
                        }, 70%, 45%))`,
                      }}
                    >
                      {r.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-display text-xs font-semibold text-foreground">
                        {r.authorName}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {formatDate(r.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-0.5 ${r.adminLiked || !r.visible ? "mt-4" : ""}`}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`h-3 w-3 ${
                          s <= r.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-transparent text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/80">
                  {r.comment}
                </p>

                {/* Actions admin : Masquer/Afficher · Liker · Supprimer */}
                <div className="mt-2.5 flex flex-wrap justify-end gap-1.5">
                  {/* Masquer / Afficher */}
                  <button
                    onClick={() => toggleVisible(r.id, r.visible, r.authorName)}
                    disabled={busyId === r.id}
                    className={`flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold transition disabled:opacity-40 ${
                      r.visible
                        ? "border-amber-400/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                        : "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                    }`}
                    title={r.visible ? "Masquer l'avis" : "Afficher l'avis"}
                  >
                    {r.visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {r.visible ? "Masquer" : "Afficher"}
                  </button>

                  {/* Coup de cœur (like) */}
                  <button
                    onClick={() => toggleLike(r.id, r.adminLiked, r.authorName)}
                    disabled={busyId === r.id}
                    className={`flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-[10px] font-semibold transition disabled:opacity-40 ${
                      r.adminLiked
                        ? "border-rose-400/60 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                        : "border-rose-400/30 bg-rose-500/5 text-rose-200/70 hover:bg-rose-500/15"
                    }`}
                    title={r.adminLiked ? "Retirer le coup de cœur" : "Mettre un coup de cœur"}
                  >
                    <Heart className={`h-3 w-3 ${r.adminLiked ? "fill-rose-400" : ""}`} />
                    {r.adminLiked ? "Aimé" : "Liker"}
                  </button>

                  {/* Supprimer */}
                  <button
                    onClick={() => handleDelete(r.id, r.authorName)}
                    disabled={busyId === r.id}
                    className="flex h-7 shrink-0 items-center gap-1 rounded-lg border border-rose-400/50 bg-rose-500/10 px-2 text-[10px] font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
                    title="Supprimer définitivement"
                  >
                    {busyId === r.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Suppr.
                  </button>
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
            className="mt-3 rounded-lg border border-violet-400/40 bg-background/90 px-3 py-1.5 text-center text-xs font-medium text-violet-100 backdrop-blur"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}