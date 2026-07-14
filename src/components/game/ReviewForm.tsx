"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ReviewFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmitted?: () => void;
}

export function ReviewForm({ open, onOpenChange, onSubmitted }: ReviewFormProps) {
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset form whenever the dialog is closed
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setName("");
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

  const trimmedName = name.trim();
  const trimmedComment = comment.trim();
  const isValid =
    trimmedName.length >= 1 &&
    trimmedName.length <= 40 &&
    rating >= 1 &&
    rating <= 5 &&
    trimmedComment.length >= 3 &&
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
          name: trimmedName,
          rating,
          comment: trimmedComment,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        const msg = data.error || "Une erreur est survenue. Réessaie.";
        setError(msg);
        toast({
          title: "Oups",
          description: msg,
          variant: "destructive",
        });
        return;
      }
      setSuccess(true);
      toast({
        title: "Merci pour ton avis ! ⭐",
        description: "Ton avis sera visible après sa validation.",
        duration: 3000,
      });
      onSubmitted?.();
    } catch {
      const msg = "Une erreur est survenue. Réessaie.";
      setError(msg);
      toast({
        title: "Oups",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card max-w-md rounded-2xl border-amber-400/30 p-6">
        {success ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 ring-2 ring-emerald-400/40">
              <Check className="h-8 w-8 text-emerald-300" />
            </div>
            <div>
              <p className="font-display text-xl font-bold text-amber-100">
                Merci pour ton avis ! ⭐
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ton avis sera visible après sa validation.
              </p>
            </div>
            <Button
              onClick={handleClose}
              className="mt-2 bg-gradient-to-r from-amber-500 to-amber-400 text-black hover:from-amber-400 hover:to-amber-300"
            >
              Fermer
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-gold-gradient">
                Laisser un avis
              </DialogTitle>
              <DialogDescription>
                Partage ton expérience avec Trouvix Grille. Tous les avis sont
                modérés par Benchou Ferrari.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="review-name" className="text-sm text-amber-100/90">
                  Ton nom
                </Label>
                <Input
                  id="review-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Votre nom"
                  maxLength={40}
                  className="bg-background/60"
                  autoComplete="off"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-sm text-amber-100/90">Ta note</Label>
                <div className="flex items-center gap-3">
                  <StarRating
                    value={rating}
                    onChange={setRating}
                    size={28}
                  />
                  {rating > 0 && (
                    <span className="font-display text-sm font-semibold text-amber-200">
                      {rating}/5
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label
                  htmlFor="review-comment"
                  className="text-sm text-amber-100/90"
                >
                  Ton commentaire
                </Label>
                <Textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Partagez votre expérience…"
                  maxLength={500}
                  className="scroll-romantic min-h-24 bg-background/60"
                />
                <div className="flex justify-end text-xs text-muted-foreground">
                  {comment.length}/500
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {error}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
                className="border-amber-400/30 bg-amber-500/5 text-amber-100 hover:bg-amber-500/15"
              >
                Annuler
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || loading}
                className="bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Publier mon avis
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}