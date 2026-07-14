"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { Trophy, ArrowLeft, Sparkles, Users, Crown, Clock } from "lucide-react";

export function TournoiScreen() {
  const backHome = useGameStore((s) => s.backHome);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass-card w-full rounded-3xl p-8 text-center sm:p-10"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
          className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-[0_0_40px_-5px_oklch(0.80_0.14_84/0.6)]"
        >
          <Trophy className="h-12 w-12 text-white" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1.5 text-xs uppercase tracking-[0.2em] text-amber-200"
        >
          <Sparkles className="h-3 w-3" />
          Bientôt disponible
        </motion.div>

        <h1 className="font-display text-4xl font-black text-gold-gradient sm:text-5xl">
          Tournoi
        </h1>

        <p className="mt-4 text-base text-amber-100/80 sm:text-lg">
          Bienvenue dans l'espace <span className="font-bold text-amber-200">Tournoi</span> de
          Trouvix Grille !
        </p>

        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          Très prochainement, vous aurez la possibilité de participer à des{" "}
          <span className="font-semibold text-amber-200">tournois de la grille</span> et
          d'affronter d'autres joueurs dans des compétitions passionnantes.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-center"
          >
            <Users className="mx-auto mb-2 h-7 w-7 text-amber-300" />
            <p className="text-xs font-bold text-amber-100">Inscriptions</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              4 à 6 joueurs par tournoi
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-center"
          >
            <Crown className="mx-auto mb-2 h-7 w-7 text-amber-300" />
            <p className="text-xs font-bold text-amber-100">Élimination</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Le gagnant avance au tour suivant
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-center"
          >
            <Clock className="mx-auto mb-2 h-7 w-7 text-amber-300" />
            <p className="text-xs font-bold text-amber-100">Chronométré</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Rapidité et stratégie récompensées
            </p>
          </motion.div>
        </div>

        <p className="mt-8 text-sm italic text-amber-200/60">
          Reste connecté — les inscriptions ouvrent bientôt ! 🏆
        </p>

        <Button
          onClick={backHome}
          variant="outline"
          size="lg"
          className="mt-8 rounded-full border-amber-400/40 bg-amber-500/5 text-amber-200 hover:bg-amber-500/15"
        >
          <ArrowLeft className="mr-2 h-5 w-5" />
          Retour à l'accueil
        </Button>
      </motion.div>
    </div>
  );
}