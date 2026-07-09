"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/game-store";
import { CATEGORY_META } from "@/lib/cells";
import type { CardCategory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Sparkles, Eye, EyeOff, Check, X, Star, Ban, Gift } from "lucide-react";

export function CardModal() {
  const card = useGameStore((s) => s.currentCard);
  const revealed = useGameStore((s) => s.cardRevealed);
  const setRevealed = (v: boolean) =>
    useGameStore.setState({ cardRevealed: v });
  const resolveCard = useGameStore((s) => s.resolveCard);
  const applyJoker = useGameStore((s) => s.applyJoker);
  const players = useGameStore((s) => s.players);
  const currentPlayerIndex = useGameStore((s) => s.currentPlayerIndex);
  const current = players[currentPlayerIndex];

  return (
    <AnimatePresence>
      {card && current && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.85, y: 30, rotateX: -10 }}
            animate={{ scale: 1, y: 0, rotateX: 0 }}
            exit={{ scale: 0.85, y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
            className="relative w-full max-w-lg"
          >
            <CardContent
              category={card.category}
              prompt={card.prompt}
              answer={card.answer}
              points={card.points}
              revealed={revealed}
              onToggleReveal={() => setRevealed(!revealed)}
              currentName={current.name}
              onResolve={resolveCard}
              onApplyJoker={applyJoker}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ContentProps {
  category: CardCategory;
  prompt: string;
  answer?: string | null;
  points: number;
  revealed: boolean;
  onToggleReveal: () => void;
  currentName: string;
  onResolve: (r: "success" | "fail" | "exceptional" | "refused" | "skip") => void;
  onApplyJoker: () => void;
}

function CardContent({
  category,
  prompt,
  answer,
  points,
  revealed,
  onToggleReveal,
  currentName,
  onResolve,
  onApplyJoker,
}: ContentProps) {
  const meta = CATEGORY_META[category];
  const isJoker = category === "joker";
  const isSciences = category === "sciences";
  const hasAnswer = Boolean(answer);

  return (
    <div className={`glass-card relative overflow-hidden rounded-3xl border-2 ${meta.border} p-6 shadow-2xl sm:p-8`}>
      {/* Top ribbon */}
      <div className={`absolute left-0 right-0 top-0 flex items-center justify-between px-5 py-2 ${meta.bg} border-b ${meta.border}`}>
        <span className={`flex items-center gap-2 font-display text-sm font-bold uppercase tracking-widest ${meta.color}`}>
          <span className="text-lg">{meta.emoji}</span>
          {meta.short}
        </span>
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.basePoints}</span>
      </div>

      <div className="mt-8 flex flex-col items-center gap-5 text-center">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
          {isJoker ? "Carte Joker !" : `Question pour ${currentName}`}
        </p>

        <motion.p
          key={prompt}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-display text-xl font-medium leading-snug text-foreground sm:text-2xl"
        >
          {prompt}
        </motion.p>

        {/* Answer reveal (any trivia card with an answer) */}
        {hasAnswer && (
          <div className="w-full">
            <button
              onClick={onToggleReveal}
              className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1.5 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20"
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {revealed ? "Masquer la réponse" : "Révéler la réponse"}
            </button>
            <AnimatePresence>
              {revealed && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2"
                >
                  <p className="text-sm text-amber-100">
                    <span className="font-semibold">Réponse :</span> {answer}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Instructions per category */}
        <p className="text-xs italic text-muted-foreground">
          {isJoker
            ? "Applique l'effet décrit sur la carte."
            : isSciences
              ? "Tente ta chance ! Une réponse exceptionnelle rapporte +5. Passer coûte -2."
              : "Réponds, puis validez la réponse ensemble."}
        </p>

        {/* Resolution buttons */}
        <div className="mt-2 w-full">
          {isJoker ? (
            <Button
              onClick={onApplyJoker}
              size="lg"
              className="w-full bg-gradient-to-r from-sky-600 to-sky-500 text-white hover:from-sky-500 hover:to-sky-400"
            >
              <Gift className="mr-2 h-5 w-5" />
              Appliquer & Continuer
            </Button>
          ) : isSciences ? (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => onResolve("success")}
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400"
              >
                <Check className="mr-2 h-4 w-4" />
                Réussi +{points}
              </Button>
              <Button
                onClick={() => onResolve("exceptional")}
                className="bg-gradient-to-r from-amber-500 to-yellow-400 text-black hover:from-amber-400 hover:to-yellow-300"
              >
                <Star className="mr-2 h-4 w-4" />
                Exceptionnel +5
              </Button>
              <Button
                onClick={() => onResolve("fail")}
                variant="outline"
                className="border-muted-foreground/40"
              >
                <X className="mr-2 h-4 w-4" />
                Échoué (0)
              </Button>
              <Button
                onClick={() => onResolve("refused")}
                variant="outline"
                className="border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
              >
                <Ban className="mr-2 h-4 w-4" />
                Passer -2
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => onResolve("success")}
                size="lg"
                className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400"
              >
                <Check className="mr-2 h-4 w-4" />
                Bonne réponse +{points}
              </Button>
              <Button
                onClick={() => onResolve("fail")}
                size="lg"
                variant="outline"
                className="border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
              >
                <X className="mr-2 h-4 w-4" />
                Mauvaise réponse
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Decorative corner */}
      <div className="pointer-events-none absolute -right-6 -top-6 text-6xl opacity-10">
        {meta.emoji}
      </div>
      <Sparkles className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 text-amber-300/40" />
    </div>
  );
}
