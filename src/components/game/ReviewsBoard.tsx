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
} from "lucide-react";

interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

/**
 * Board Avis/Suggestions — utilisé dans le dashboard Benchou Ferrari.
 * Affiche la liste des avis avec possibilité de suppression (admin).
 * Compact et intégrable dans un panel existant.
 */
export function ReviewsBoard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/reviews", { cache: "no-store" });
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

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      setReviews((prev) => prev.filter((r) => r.id !== id));
      setToast("Avis supprimé.");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Erreur lors de la suppression.");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setDeletingId(null);
    }
  };

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  // Distribution des notes
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
          {/* Note moyenne */}
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

          {/* Distribution */}
          <div className="flex flex-col justify-center gap-1">
            {distribution.map(({ star, count }) => {
              const pct =
                reviews.length > 0 ? (count / reviews.length) * 100 : 0;
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
        <div className="flex max-h-[400px] flex-col gap-2 overflow-y-auto scroll-romantic pr-3">
          <AnimatePresence mode="popLayout">
            {reviews.map((r, i) => (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: i * 0.03 }}
                className="relative overflow-visible rounded-xl border border-border/30 bg-card/30 p-3 transition hover:border-violet-400/30"
              >
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
                  <div className="flex items-center gap-0.5">
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

                {/* Bouton de suppression — action immédiate, sans confirmation */}
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 gap-1 whitespace-nowrap border-rose-400/50 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:border-rose-400 hover:bg-rose-500/20 hover:text-rose-100"
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                  >
                    {deletingId === r.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5" /> Supprimer
                      </>
                    )}
                  </Button>
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
