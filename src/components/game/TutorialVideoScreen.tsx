"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Shield,
  Square,
  Trophy,
  Lightbulb,
  ChevronRight,
  ChevronLeft,
  Flame,
  MousePointer2,
  Tv,
} from "lucide-react";

interface DemoStep {
  id: number;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  tip: string;
  activePlayer: "A" | "B";
  p1Score: number;
  p2Score: number;
  // Board state for this step: [row, col, player]
  pawns: [number, number, "A" | "B"][];
  // Target cell currently being played / animated
  targetCell: [number, number, "A" | "B"];
  // If a 2x2 square is completed
  squareCells?: [number, number][];
  // If a blocking move is highlighted
  blockedCell?: [number, number];
  // Special banner overlay
  banner?: { text: string; icon: string; color: string };
  // Emoji reaction popup
  reaction?: { emoji: string; text: string };
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: 1,
    badge: "Étape 1/6 • Le coup d'envoi",
    badgeColor: "from-rose-500 to-amber-500",
    title: "Placement libre sur la grille",
    description: "Chaque joueur pose 1 pion par tour sur n'importe quelle case libre. Pas de gravité : le pion reste exactement là où tu le places !",
    tip: "Commence au centre : c'est la zone qui offre le plus d'angles pour former des carrés.",
    activePlayer: "A",
    p1Score: 0,
    p2Score: 0,
    pawns: [[2, 2, "A"]],
    targetCell: [2, 2, "A"],
    reaction: { emoji: "🎯", text: "Premier pion posé !" },
  },
  {
    id: 2,
    badge: "Étape 2/6 • La réplique",
    badgeColor: "from-amber-500 to-yellow-500",
    title: "L'adversaire prend position",
    description: "Léa réplique immédiatement en occupant une case voisine. Les deux joueurs cherchent à contrôler l'espace.",
    tip: "Observe toujours attentivement où l'adversaire s'installe pour anticiper ses intentions.",
    activePlayer: "B",
    p1Score: 0,
    p2Score: 0,
    pawns: [
      [2, 2, "A"],
      [1, 1, "B"],
    ],
    targetCell: [1, 1, "B"],
  },
  {
    id: 3,
    badge: "Étape 3/6 • La tactique en L",
    badgeColor: "from-violet-500 to-fuchsia-500",
    title: "Préparer un carré de 4 pions",
    description: "Le but est d'assembler un carré de 2×2 (4 pions). En formant un angle en « L » avec 3 pions, Alex prépare son attaque !",
    tip: "Dès que tu as 3 pions en angle droit, il ne te manque plus qu'une seule case pour marquer.",
    activePlayer: "A",
    p1Score: 0,
    p2Score: 0,
    pawns: [
      [2, 2, "A"],
      [1, 1, "B"],
      [2, 3, "A"],
      [3, 2, "A"],
    ],
    targetCell: [3, 2, "A"],
    reaction: { emoji: "👀", text: "Le piège en L est prêt !" },
  },
  {
    id: 4,
    badge: "Étape 4/6 • CARRÉ VALIDÉ !",
    badgeColor: "from-emerald-400 to-cyan-500",
    title: "Fermeture du carré = +1 Point !",
    description: "Alex pose son 4e pion en bas à droite : le carré 2×2 est complet ! Il s'illumine instantanément et rapporte 1 point !",
    tip: "Chaque carré formé rapporte 1 point. Le premier à atteindre le nombre de carrés cibles gagne la partie !",
    activePlayer: "A",
    p1Score: 1,
    p2Score: 0,
    pawns: [
      [2, 2, "A"],
      [1, 1, "B"],
      [2, 3, "A"],
      [3, 2, "A"],
      [3, 3, "A"],
    ],
    targetCell: [3, 3, "A"],
    squareCells: [
      [2, 2],
      [2, 3],
      [3, 2],
      [3, 3],
    ],
    banner: { text: "+1 POINT ! CARRÉ COMPLÉTÉ", icon: "🏆", color: "from-amber-400 to-rose-500" },
    reaction: { emoji: "🔥", text: "Boom ! Carré magique !" },
  },
  {
    id: 5,
    badge: "Étape 5/6 • Menace adverse",
    badgeColor: "from-yellow-400 to-amber-600",
    title: "Léa prépare son contre",
    description: "Léa aligne à son tour 3 pions jaunes en haut. La case centrale devient critique : si Léa la joue, elle marque aussi !",
    tip: "Sois vigilant : le meilleur joueur attaque tout en surveillant la défense !",
    activePlayer: "B",
    p1Score: 1,
    p2Score: 0,
    pawns: [
      [2, 2, "A"],
      [2, 3, "A"],
      [3, 2, "A"],
      [3, 3, "A"],
      [0, 1, "B"],
      [0, 2, "B"],
      [1, 2, "B"],
    ],
    targetCell: [1, 2, "B"],
    squareCells: [
      [2, 2],
      [2, 3],
      [3, 2],
      [3, 3],
    ],
    reaction: { emoji: "⚠️", text: "Danger imminent !" },
  },
  {
    id: 6,
    badge: "Étape 6/6 • LE BLOCAGE HÉROÏQUE !",
    badgeColor: "from-sky-400 to-indigo-600",
    title: "Bloquer le carré de l'adversaire",
    description: "Alex repère la menace et pose son pion rouge en (1, 1) juste sous le nez de Léa. Le carré adverse est définitivement cassé !",
    tip: "Bloquer au bon moment est aussi précieux que marquer soi-même : ça brise le rythme de l'adversaire !",
    activePlayer: "A",
    p1Score: 1,
    p2Score: 0,
    pawns: [
      [2, 2, "A"],
      [2, 3, "A"],
      [3, 2, "A"],
      [3, 3, "A"],
      [0, 1, "B"],
      [0, 2, "B"],
      [1, 2, "B"],
      [1, 1, "A"],
    ],
    targetCell: [1, 1, "A"],
    squareCells: [
      [2, 2],
      [2, 3],
      [3, 2],
      [3, 3],
    ],
    blockedCell: [1, 1],
    banner: { text: "BLOCAGE RÉUSSI ! MENACE ANNULÉE", icon: "🛡️", color: "from-sky-400 to-blue-600" },
    reaction: { emoji: "😎", text: "Joli réflexe !" },
  },
];

const BOARD_SIZE = 5;
const STEP_DURATION_MS = 3600;

export function TutorialVideoScreen() {
  const goToSetup = useGameStore((s) => s.goToSetup);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  const step = DEMO_STEPS[currentStepIdx];

  // Auto-play loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = 50;
    const progressIncrement = (interval / STEP_DURATION_MS) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrentStepIdx((idx) => (idx + 1) % DEMO_STEPS.length);
          return 0;
        }
        return prev + progressIncrement;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, currentStepIdx]);

  // Update animated cursor position whenever target cell changes
  useEffect(() => {
    const [row, col] = step.targetCell;
    const cellPct = 100 / BOARD_SIZE;
    setCursorPos({
      x: (col + 0.5) * cellPct,
      y: (row + 0.5) * cellPct,
    });
  }, [step]);

  const handleNext = useCallback(() => {
    setProgress(0);
    setCurrentStepIdx((idx) => (idx + 1) % DEMO_STEPS.length);
  }, []);

  const handlePrev = useCallback(() => {
    setProgress(0);
    setCurrentStepIdx((idx) => (idx - 1 + DEMO_STEPS.length) % DEMO_STEPS.length);
  }, []);

  const handleRestart = useCallback(() => {
    setProgress(0);
    setCurrentStepIdx(0);
    setIsPlaying(true);
  }, []);

  return (
    <div className="mx-auto w-full max-w-4xl px-2 sm:px-4">
      {/* Video Player / Arcade Screen Container */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-300/30 bg-gradient-to-b from-[#1c121e]/95 via-[#120b14]/98 to-[#0a060b] p-3 shadow-[0_16px_50px_rgba(0,0,0,0.65),0_0_30px_rgba(251,191,36,0.12)] ring-1 ring-white/10 sm:p-6">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-rose-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-amber-400/15 blur-3xl" />

        {/* Top Video Header Bar (macOS / Arcade style) */}
        <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3 sm:mb-6">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
            <span className="h-3 w-3 rounded-full bg-amber-400/80 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            <span className="h-3 w-3 rounded-full bg-emerald-400/80 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="ml-2 flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-rose-300">
              <span className="h-2 w-2 animate-ping rounded-full bg-rose-400" />
              EN DIRECT • DÉMO ANIMÉE
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleRestart}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-white"
              title="Recommencer depuis le début"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-amber-300/30 bg-amber-400/10 px-3 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20"
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isPlaying ? "Pause" : "Lecture"}
            </button>
          </div>
        </div>

        {/* Main Content Area: Board (Left/Top) + Explanation (Right/Bottom) */}
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:gap-6 lg:items-center">
          {/* LEFT: Game Board Visualizer */}
          <div className="flex flex-col items-center">
            {/* Live Players HUD in Demo */}
            <div className="mb-3 grid w-full max-w-[320px] grid-cols-2 gap-2 sm:max-w-[360px]">
              {/* Player A (Alex / Red) */}
              <div
                className={`flex items-center gap-2 rounded-xl border p-2 transition-all ${
                  step.activePlayer === "A"
                    ? "border-rose-400/60 bg-rose-500/20 shadow-[0_0_16px_rgba(244,63,94,0.35)] ring-1 ring-white/20"
                    : "border-white/10 bg-black/25 opacity-70"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-base shadow">
                  🦊
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">Alex (Toi)</p>
                  <p className="font-display text-xs font-black text-rose-300">{step.p1Score} pt</p>
                </div>
                {step.activePlayer === "A" && (
                  <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                )}
              </div>

              {/* Player B (Léa / Gold) */}
              <div
                className={`flex items-center gap-2 rounded-xl border p-2 transition-all ${
                  step.activePlayer === "B"
                    ? "border-amber-400/60 bg-amber-500/20 shadow-[0_0_16px_rgba(251,191,36,0.35)] ring-1 ring-white/20"
                    : "border-white/10 bg-black/25 opacity-70"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-base shadow">
                  🦁
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">Léa</p>
                  <p className="font-display text-xs font-black text-amber-300">{step.p2Score} pt</p>
                </div>
                {step.activePlayer === "B" && (
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </div>
            </div>

            {/* The 5x5 Stylized Demo Board */}
            <div
              ref={boardContainerRef}
              className="relative aspect-square w-full max-w-[280px] sm:max-w-[340px] rounded-2xl border-2 border-amber-400/35 bg-gradient-to-br from-[#22131f] to-[#140b15] p-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.7),inset_0_2px_4px_rgba(255,255,255,0.1)]"
            >
              {/* Floating Reaction Bubble */}
              <AnimatePresence>
                {step.reaction && (
                  <motion.div
                    key={`react-${step.id}`}
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="pointer-events-none absolute -top-4 right-2 z-30 flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-black/80 px-3 py-1 shadow-lg backdrop-blur-md"
                  >
                    <span className="text-base">{step.reaction.emoji}</span>
                    <span className="text-[11px] font-bold text-amber-200">{step.reaction.text}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Banner Overlay for Big Moments (Square formed or Blocked) */}
              <AnimatePresence>
                {step.banner && (
                  <motion.div
                    key={`banner-${step.id}`}
                    initial={{ opacity: 0, scale: 0.7, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="pointer-events-none absolute inset-x-2 top-2 z-30 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 px-3 py-1.5 shadow-[0_4px_20px_rgba(244,63,94,0.6)]"
                  >
                    <span className="text-base">{step.banner.icon}</span>
                    <span className="font-display text-xs font-black tracking-wide text-white drop-shadow">
                      {step.banner.text}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Grid 5x5 */}
              <div
                className="relative grid h-full w-full gap-1.5 rounded-xl bg-black/40 p-1 sm:gap-2"
                style={{
                  gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: BOARD_SIZE }).map((_, r) =>
                  Array.from({ length: BOARD_SIZE }).map((__, c) => {
                    const pawn = step.pawns.find(([pr, pc]) => pr === r && pc === c);
                    const isTarget = step.targetCell[0] === r && step.targetCell[1] === c;
                    const isSquare = step.squareCells?.some(([sr, sc]) => sr === r && sc === c);
                    const isBlocked = step.blockedCell?.[0] === r && step.blockedCell?.[1] === c;

                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`relative flex aspect-square items-center justify-center rounded-full transition-all duration-300 ${
                          isSquare
                            ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-black shadow-[0_0_14px_rgba(34,211,238,0.9)] z-20"
                            : isBlocked
                            ? "ring-2 ring-sky-400 ring-offset-1 ring-offset-black z-20 shadow-[0_0_12px_rgba(56,189,248,0.8)]"
                            : "bg-[#180f1a] ring-1 ring-white/10"
                        }`}
                      >
                        {pawn ? (
                          <motion.div
                            initial={isTarget ? { scale: 0, rotate: -20 } : false}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 260, damping: 18 }}
                            className={`relative h-[90%] w-[90%] rounded-full shadow-[inset_0_2px_4px_rgba(255,255,255,0.6),0_3px_8px_rgba(0,0,0,0.8)] ${
                              pawn[2] === "A"
                                ? "bg-gradient-to-br from-rose-500 via-rose-600 to-rose-900"
                                : "bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-800"
                            }`}
                          >
                            {/* Gloss reflection 3D */}
                            <span className="pointer-events-none absolute left-[20%] top-[14%] h-[26%] w-[42%] -rotate-45 rounded-full bg-white/60 blur-[0.6px]" />
                            {isSquare && (
                              <motion.span
                                animate={{ scale: [1, 1.25, 1] }}
                                transition={{ repeat: Infinity, duration: 1.2 }}
                                className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs"
                              >
                                ✨
                              </motion.span>
                            )}
                            {isBlocked && (
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] sm:text-xs">
                                🛡️
                              </span>
                            )}
                          </motion.div>
                        ) : isTarget ? (
                          /* Ghost preview pulse for current play */
                          <motion.div
                            animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.8, 0.95, 0.8] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                            className="h-[80%] w-[80%] rounded-full border-2 border-dashed border-amber-300/60 bg-amber-400/20"
                          />
                        ) : null}
                      </div>
                    );
                  })
                )}

                {/* Animated Virtual Cursor Target */}
                {cursorPos && (
                  <motion.div
                    className="pointer-events-none absolute z-30"
                    initial={false}
                    animate={{
                      left: `${cursorPos.x}%`,
                      top: `${cursorPos.y}%`,
                    }}
                    transition={{ type: "spring", stiffness: 120, damping: 16 }}
                    style={{ transform: "translate(-10%, -10%)" }}
                  >
                    <motion.div
                      animate={{ scale: [1, 0.82, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
                      className="relative flex items-center gap-1 rounded-full bg-black/80 px-2 py-0.5 text-white shadow-xl ring-1 ring-amber-300 backdrop-blur-sm"
                    >
                      <MousePointer2 className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                      <span className="text-[10px] font-bold text-amber-200">
                        {step.activePlayer === "A" ? "Alex" : "Léa"}
                      </span>
                    </motion.div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Scene Explanations & Coach Tips */}
          <div className="flex flex-col justify-between gap-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
              >
                {/* Step badge */}
                <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow">
                  <span className={`h-2 w-2 rounded-full bg-white animate-pulse`} />
                  <span>{step.badge}</span>
                </div>

                <h3 className="font-display text-xl font-black text-white sm:text-2xl">
                  {step.title}
                </h3>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {step.description}
                </p>

                {/* Pro tip card */}
                <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-3 text-amber-100 shadow-inner">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <p className="text-xs font-medium leading-relaxed sm:text-sm">
                    <span className="font-bold text-amber-200">Astuce : </span>
                    {step.tip}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Bottom Timeline & Step Navigation */}
            <div className="space-y-3">
              {/* Progress timeline bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1 font-semibold text-amber-200">
                    <Tv className="h-3.5 w-3.5 text-amber-300" /> Démonstration interactive
                  </span>
                  <span className="font-mono tabular-nums">
                    {currentStepIdx + 1} / {DEMO_STEPS.length}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 transition-all duration-100"
                    style={{
                      width: `${((currentStepIdx + progress / 100) / DEMO_STEPS.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Controls & Quick Action Button */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrev}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-white"
                    title="Étape précédente"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground transition hover:bg-white/10 hover:text-white"
                    title="Étape suivante"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {/* Step dots */}
                  <div className="ml-1.5 flex items-center gap-1">
                    {DEMO_STEPS.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setCurrentStepIdx(i);
                          setProgress(0);
                        }}
                        className={`h-2 rounded-full transition-all ${
                          i === currentStepIdx
                            ? "w-6 bg-amber-400"
                            : "w-2 bg-white/20 hover:bg-white/40"
                        }`}
                        title={`Aller à l'étape ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  onClick={goToSetup}
                  size="sm"
                  className="h-9 rounded-xl bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 px-4 text-xs font-black uppercase tracking-wider text-white shadow-[0_4px_16px_rgba(244,63,94,0.4)] transition hover:scale-105 active:scale-95 sm:text-sm"
                >
                  <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  Jouer maintenant
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
