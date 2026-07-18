"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import {
  Star,
  MessageSquare,
  Send,
  Home,
  Loader2,
  Check,
  Trash2,
  Heart,
} from "lucide-react";

interface Review {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  adminLiked?: boolean;
}

export function ReviewsScreen() {
  const backHome = useGameStore((s) => s.backHome);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Formulaire
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/reviews", { cache: "no-store" });
         if (!res.ok) {
           const data = await res.json().catch(() => ({}));
           const msg = data.error ?? "Impossible de charger les avis.";
           throw new Error(msg);
      }
      const data = await res.json();
      setReviews(data.reviews ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Impossible de charger les avis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(false);

    if (rating < 1 || rating > 5) {
      setError("Sélectionne une note entre 1 et 5 étoiles.");
      return;
    }
    if (!comment.trim()) {
      setError("Écris ton commentaire.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim() || "Anonyme",
          rating,
          comment: comment.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
           const msg = data.error ?? "Impossible de charger les avis.";
        throw new Error(msg);
      }
      // Réinitialise le formulaire
      setAuthorName("");
      setRating(0);
      setComment("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      // Recharge la liste
      await loadReviews();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setSubmitting(false);
    }
  };

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:py-10">
      {/* Titre */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 text-center"
      >
        <div className="mb-3 flex justify-center">
          <img
            src="/trouvix-logo.svg"
            alt="Logo Trouvix Grille"
            width={96}
            height={96}
            className="h-24 w-24 drop-shadow-[0_8px_24px_-6px_oklch(0.60_0.215_25/0.5)] sm:h-[88px] sm:w-[88px]"
          />
        </div>
        <h1 className="font-display text-4xl font-black text-gold-gradient sm:text-5xl">
          VOS AVIS
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Partage ton expérience et aide-nous à améliorer Trouvix Grille. ⭐
        </p>
      </motion.div>

      {/* Stats globales */}
      {reviews.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 flex items-center justify-center gap-6 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4"
        >
          <div className="text-center">
            <p className="font-display text-3xl font-black text-amber-200">
              {avgRating.toFixed(1)}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Moyenne
            </p>
          </div>
          <div className="h-10 w-px bg-border/40" />
          <div className="text-center">
            <p className="font-display text-3xl font-black text-amber-200">
              {reviews.length}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {reviews.length > 1 ? "Avis" : "Avis"}
            </p>
          </div>
        </motion.div>
      )}

      {/* Formulaire de soumission */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10 rounded-3xl border border-amber-400/20 bg-gradient-to-br from-card/60 to-card/20 p-6 shadow-xl sm:p-7"
      >
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-amber-100">
          <Send className="h-4 w-4 text-amber-300" />
          Laisse ton avis
        </h2>

        {/* Nom (optionnel) */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Ton prénom <span className="text-muted-foreground/60">(optionnel)</span>
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            maxLength={40}
            placeholder="Anonyme"
            className="w-full rounded-xl border border-border/50 bg-background/60 px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
          />
        </div>

        {/* Étoiles */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Ta note <span className="text-rose-300">*</span>
          </label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoverRating || rating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                  aria-label={`${star} étoile${star > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`h-9 w-9 transition-colors ${
                      active
                        ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_oklch(0.80_0.14_84/0.5)]"
                        : "fill-transparent text-muted-foreground/40"
                    }`}
                  />
                </button>
              );
            })}
            {rating > 0 && (
              <span className="ml-2 text-sm font-semibold text-amber-200">
                {rating}/5
              </span>
            )}
          </div>
        </div>

        {/* Commentaire */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Ton commentaire <span className="text-rose-300">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={50}
            rows={3}
            placeholder="Dis-nous ce que tu as aimé..."
            className="w-full resize-none rounded-xl border border-border/50 bg-background/60 px-4 py-3 text-sm text-foreground outline-none transition focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
          />
          <p className="mt-1 text-right text-[10px] text-muted-foreground/60">
            {comment.length}/50
          </p>
        </div>

        {/* Erreur / Succès */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200"
            >
              ⚠️ {error}
            </motion.p>
          )}
          {success && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-3 flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200"
            >
              <Check className="h-3.5 w-3.5" /> Merci ! Ton avis a été publié.
            </motion.p>
          )}
        </AnimatePresence>

        {/* Bouton publier */}
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400 sm:w-auto"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publication...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" /> Publier mon avis
            </>
          )}
        </Button>
      </motion.div>

      {/* Liste des avis */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-amber-100">
          <MessageSquare className="h-4 w-4 text-amber-300" />
          Avis
          {reviews.length > 0 && (
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200">
              {reviews.length}
            </span>
          )}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/40 bg-card/20 p-10 text-center">
            <p className="text-3xl">💭</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun avis pour l&apos;instant. Sois le premier à partager le tien !
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {reviews.map((r, i) => (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.04 }}
                  className={`relative overflow-hidden rounded-2xl border p-4 transition ${
                    r.adminLiked
                      ? "border-amber-400/60 bg-gradient-to-br from-amber-500/10 to-rose-500/5 hover:from-amber-500/15"
                      : "border-border/40 bg-card/40 hover:border-amber-400/30 hover:bg-card/60"
                  }`}
                >
                  {/* Badge "Admin a aimé votre avis" */}
                  {r.adminLiked && (
                    <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold tracking-wide text-rose-200 shadow-sm">
                      <Heart className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                      Admin a aimé votre avis
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-bold text-white"
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
                        <p className="font-display text-sm font-semibold text-foreground">
                          {r.authorName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDate(r.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-0.5 ${r.adminLiked ? "mt-5" : ""}`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            s <= r.rating
                              ? "fill-amber-400 text-amber-400"
                              : "fill-transparent text-muted-foreground/30"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/80">
                    {r.comment}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-10 flex justify-center">
        <Button variant="ghost" size="sm" onClick={backHome}>
          <Home className="mr-1.5 h-4 w-4" /> Retour à l&apos;accueil
        </Button>
      </div>
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
    });
  } catch {
    return "";
  }
}

// Icône suppression (réutilisée côté admin)
export function TrashIcon({ className }: { className?: string }) {
  return <Trash2 className={className} />;
}
