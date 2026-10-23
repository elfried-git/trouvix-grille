"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Check, Sparkles } from "lucide-react";
import { StarRating } from "./StarRating";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStore } from "@/store/online-store";

interface ReviewFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmitted?: () => void;
}

export function ReviewForm({ open, onOpenChange, onSubmitted }: ReviewFormProps) {
  const { toast } = useToast();

  const adminAvatar = useOnlineStore((s) => s.benchouAvatar);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setRating(0);
        setComment("");
        setLoading(false);
        setError(null);
        setSuccess(false);
      }, 250);
      return () => clearTimeout(t);
    }
    setError(null);
    setSuccess(false);
  }, [open]);

  const trimmedComment = comment.trim();
  const isValid =
    rating >= 1 &&
    rating <= 5 &&
    trimmedComment.length <= 500;

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: "Anonyme",
          rating,
          comment: trimmedComment,
        }),
      });
      const data = await res.json().catch(() => ({})) as { review?: unknown; error?: string };
      if (!res.ok || data.error) {
        const msg = data.error || "Une erreur est survenue. Réessaie.";
        setError(msg);
        toast({ title: "Oups", description: msg, variant: "destructive" });
        return;
      }
      setSuccess(true);
      onSubmitted?.();
    } catch {
      const msg = "Une erreur est survenue. Réessaie.";
      setError(msg);
      toast({ title: "Oups", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="glass-card max-w-md rounded-2xl border-amber-400/30 p-6">
        {success ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/40">
              <Check className="h-8 w-8 text-emerald-300" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-amber-100">Merci pour ton avis ! ⭐</p>
              <p className="mt-1 text-sm text-muted-foreground">Merci de nous aider à améliorer le jeu.</p>
            </div>
            <Button onClick={handleClose} className="mt-2 bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-amber-300">Fermer</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-gold-gradient">Votre avis</DialogTitle>
              <DialogDescription>Votre avis est anonyme. Seule votre note est obligatoire.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
                <img src={adminAvatar || "/benchou-ferrari-small.jpg"} alt="Profil de Benchou Ferrari" className="h-12 w-12 rounded-full border border-amber-400/40 object-cover" />
                <div>
                  <p className="font-semibold text-amber-100">Benchou Ferrari</p>
                  <p className="text-sm text-muted-foreground">Administrateur</p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-base text-amber-100/90">Ta note</Label>
                <div className="flex items-center gap-3">
                  <StarRating value={rating} onChange={setRating} size={36} />
                  {rating > 0 && <span className="font-display text-sm font-semibold text-amber-200">{rating}/5</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review-comment" className="text-base text-amber-100/90">Commentaire <span className="text-muted-foreground">(facultatif)</span></Label>
                <Textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Un mot à partager ?" maxLength={500} className="scroll-romantic min-h-24 bg-background/60 text-base leading-relaxed" />
                <div className="flex justify-end text-sm text-muted-foreground">{comment.length}/500</div>
              </div>
              {error && <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleClose} disabled={loading} className="border-amber-400/30 bg-amber-500/5 text-amber-100 hover:bg-amber-500/15">Annuler</Button>
              <Button onClick={handleSubmit} disabled={!isValid || loading} className="bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Envoi…</> : <><Sparkles className="mr-2 h-4 w-4" /> Soumettre l’avis</>}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
