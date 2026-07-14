"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { Timer, Square, Users, Grid3x3, Trophy, Dices, Sparkles, Pause, Globe, Gamepad2, MessageSquareQuote } from "lucide-react";

const FEATURES = [
  { icon: Square, label: "Forme un carré 2×2", desc: "4 pions en bloc", color: "text-rose-300" },
  { icon: Grid3x3, label: "Placement libre", desc: "Pose où tu veux", color: "text-amber-300" },
  { icon: Timer, label: "10 s / coup", desc: "Joue vite ou perds la main", color: "text-emerald-300" },
  { icon: Pause, label: "Pause à tout moment", desc: "Chrono gelé", color: "text-fuchsia-300" },
  { icon: Users, label: "2 à 8 joueurs", desc: "Couleurs au choix", color: "text-lime-300" },
  { icon: Trophy, label: "Champion Ultime", desc: "Meilleur score gagne", color: "text-sky-300" },
];

const FLOAT_ICONS = ["🟥", "🟨", "🟦", "⏱️", "🎯", "🏆", "⬜", "✨"];

export function HomeScreen() {
  const goToSetup = useGameStore((s) => s.goToSetup);
  const goToOnlineSetup = useGameStore((s) => s.goToOnlineSetup);
  const goToReviews = useGameStore((s) => s.goToReviews);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-10">
      {/* Floating icons */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl opacity-20"
            style={{ left: `${10 + i * 11}%`, bottom: "-40px" }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -800, opacity: [0, 0.4, 0] }}
            transition={{ duration: 10 + i * 2, repeat: Infinity, delay: i * 1.5 }}
          >
            {FLOAT_ICONS[i]}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        {/* Logo Trouvix */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, type: "spring", stiffness: 120 }}
          className="mb-4"
        >
          <img
            src="/trouvix-logo.svg"
            alt="Logo Trouvix Grille"
            width={96}
            height={96}
            className="h-24 w-24 drop-shadow-[0_8px_24px_-6px_oklch(0.60_0.215_25/0.5)] sm:h-[88px] sm:w-[88px]"
          />
        </motion.div>

        <div className="mb-4 flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/5 px-4 py-1.5 text-xs uppercase tracking-[0.25em] text-amber-200/80">
          <Sparkles className="h-3 w-3" />
          Le Jeu du Carré
        </div>

        <h1 className="font-display text-6xl font-black tracking-tight sm:text-7xl md:text-8xl">
          <span className="text-red-gradient">Trouv</span>
          <span className="text-gold-gradient">ix</span>
        </h1>

        <p className="mt-4 max-w-xl font-display text-base italic text-amber-100/70 sm:text-lg">
          Place tes pions <span className="font-semibold text-amber-200">où tu veux</span> dans la
          grille et forme un <span className="font-semibold text-rose-200">carré de 4 pions</span>{" "}
          (2×2) pour marquer. <span className="font-semibold text-amber-200">10 secondes</span> par
          coup, pause à tout moment. De 2 à 8 joueurs. 🏆
        </p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <Button
            onClick={goToSetup}
            size="lg"
            className="h-14 w-full rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-8 text-base font-semibold text-white shadow-[0_8px_30px_-6px_oklch(0.60_0.215_25/0.6)] transition hover:from-rose-500 hover:to-rose-400 hover:shadow-[0_8px_36px_-4px_oklch(0.60_0.215_25/0.8)] sm:w-auto"
          >
            <Gamepad2 className="mr-2 h-5 w-5" />
            S'entraîner
          </Button>
          <Button
            onClick={goToOnlineSetup}
            size="lg"
            variant="outline"
            className="h-14 w-full rounded-full border-amber-400/50 bg-amber-500/10 px-8 text-base font-semibold text-amber-200 transition hover:bg-amber-500/20 sm:w-auto"
          >
            <Globe className="mr-2 h-5 w-5" />
            Jouer en ligne
          </Button>
          <Button
            onClick={goToReviews}
            size="lg"
            variant="outline"
            className="h-14 w-full rounded-full border-amber-400/40 bg-amber-500/5 px-8 text-base font-semibold text-amber-100/90 transition hover:border-amber-400/70 hover:bg-amber-500/15 sm:w-auto"
          >
            <MessageSquareQuote className="mr-2 h-5 w-5" />
            Avis
          </Button>
        </motion.div>

        {/* Features grid */}
        <div className="mt-14 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
              className="glass-card flex flex-col items-center gap-2 rounded-2xl p-5 text-center sm:p-4"
            >
              <f.icon className={`h-9 w-9 sm:h-7 sm:w-7 ${f.color}`} />
              <p className="font-display text-base font-semibold sm:text-sm">{f.label}</p>
              <p className="text-xs text-muted-foreground sm:text-[11px]">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><Grid3x3 className="h-4 w-4 text-rose-300" /> Grille 10×10</span>
          <span className="flex items-center gap-2"><Timer className="h-4 w-4 text-amber-300" /> 10s par coup</span>
          <span className="flex items-center gap-2"><Users className="h-4 w-4 text-amber-300" /> 2 à 8 joueurs</span>
        </div>
      </motion.div>
    </div>
  );
}