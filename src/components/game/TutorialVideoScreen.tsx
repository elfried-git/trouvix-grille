"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { Play, Pause, StepForward, StepBack, Home, Lightbulb, MousePointer, ShieldOff, Square, Trophy, RefreshCw } from "lucide-react";

interface SceneStep {
  title: string;
  description: string;
  tip?: string;
  icon: React.ReactNode;
}

const SCENES: SceneStep[] = [
  { title: "Le Plateau 10×10", description: "Le jeu se déroule sur une grille de 10 cases sur 10. Chaque joueur place ses pions un par tour, où il le souhaite, sur n'importe quelle case vide.", icon: <MousePointer className="h-5 w-5" /> },
  { title: "Placement Libre", description: "Clique sur une case vide pour y placer ton pion. Contrairement au Puissance 4, ton pion reste là où tu le poses. Stratégie : occupe l'espace intelligemment !", tip: "Préfère le centre de la grille : plus de possibilités de carrés !", icon: <MousePointer className="h-5 w-5" /> },
  { title: "Former un Carré 2×2", description: "Le but du jeu : d'aligner 4 de tes pions en un bloc carré de 2×2 (2 lignes × 2 colonnes). Dès que tu complètes un carré, tu marques 1 point.", tip: "Construis en L ou en T pour arriver plus vite au carré !", icon: <Square className="h-5 w-5" /> },
  { title: "Compléter un Carré", description: "Quand tu places ton 4e pion pour fermer un carré 2×2, tu marques 1 point. La case devient verrouillée et le tour passe au joueur suivant.", tip: "Cherche toujours à avoir 3 pions en L ou en T pour être prêt à compléter au prochain tour !", icon: <Square className="h-5 w-5" /> },
  { title: "Bloquer l'Adversaire", description: "Si tu vois que ton adversaire a déjà 3 pions disposés en L ou en T (prêts à former un carré), place un pion sur la case qui lui manque pour le bloquer.", tip: "Un bon joueur attaque ET défend en même temps. Observe les deux !", icon: <ShieldOff className="h-5 w-5" /> },
  { title: "Contrer une Menace", description: "Quand l'adversaire est sur le point de compléter son carré au prochain coup, place immédiatement ton pion sur la case clé pour annuler sa menace.", tip: "Anticipe les menaces avant qu'elles ne deviennent trop évidentes !", icon: <ShieldOff className="h-5 w-5" /> },
  { title: "Stratégie : Double Menace", description: "Crée une situation où tu as 2 carrés potentiels en même temps. L'adversaire ne pourra en bloquer qu'un, et tu marqueras sur l'autre.", tip: "Maître du jeu : force l'adversaire à choisir entre deux maux !", icon: <Lightbulb className="h-5 w-5" /> },
  { title: "Gérer le Chrono", description: "Tu as 10 secondes par coup. Si le temps expire, tu perds ton tour. Utilise le bouton Pause si tu as besoin de réfléchir plus longtemps.", tip: "En fin de chrono, pose vite un pion même au hasard plutôt que de passer !", icon: <Trophy className="h-5 w-5" /> },
  { title: "Fin de Partie", description: "La partie se termine quand tous les carrés sont formés, que la grille est pleine, ou qu'un joueur décide d'arrêter. Le meilleur score gagne !", tip: "Même en retard, continue ! Un retournement est toujours possible.", icon: <Trophy className="h-5 w-5" /> },
  { title: "Prêt à Jouer ?", description: "Tu connais maintenant toutes les bases du Trouvix ! Placement stratégique, formation de carrés, blocage adverse, double menace et gestion du chrono. Lance une partie et applique ces techniques.", tip: "Le meilleur apprentissage reste la pratique. Joue et analyse tes parties pour progresser !", icon: <Play className="h-5 w-5" /> },
];

const DEMO_SIZE = 5;
type DemoGrid = (string | null)[][];

function emptyGrid(): DemoGrid {
  return Array.from({ length: DEMO_SIZE }, () => Array.from({ length: DEMO_SIZE }, () => null));
}

const DEMO_STEPS = [
  { cells: [] },
  { cells: [[2, 2, "A"]] },
  { cells: [[2, 2, "A"], [1, 1, "B"], [2, 3, "A"]] },
  { cells: [[2, 2, "A"], [1, 1, "B"], [2, 3, "A"], [3, 1, "B"], [3, 2, "A"], [3, 3, "A"]], highlight: [[2, 2], [2, 3], [3, 2], [3, 3]] },
  { cells: [[0, 0, "A"], [0, 1, "B"], [0, 2, "B"], [1, 2, "B"]] },
  { cells: [[0, 0, "A"], [0, 1, "B"], [0, 2, "B"], [1, 2, "B"], [1, 1, "A"]], highlight: [[0, 1], [0, 2], [1, 2]] },
  { cells: [[2, 2, "A"], [1, 1, "B"], [3, 2, "A"], [2, 0, "B"], [3, 3, "A"], [2, 3, "A"]], highlight: [[2, 2], [3, 3], [2, 3], [3, 2]] },
  { cells: [[2, 2, "A"], [1, 1, "B"]] },
  { cells: [[0, 0, "A"], [0, 1, "A"], [1, 0, "A"], [1, 1, "A"], [2, 2, "B"], [2, 3, "B"], [3, 2, "B"], [3, 3, "B"]], highlight: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { cells: [[0, 0, "A"], [0, 1, "A"], [1, 0, "A"], [1, 1, "A"], [2, 2, "B"], [2, 3, "B"], [3, 2, "B"], [3, 3, "B"], [4, 0, "A"], [4, 4, "B"]], highlight: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 2], [2, 3], [3, 2], [3, 3]] },
];

export function TutorialVideoScreen() {
  const backHome = useGameStore((s) => s.backHome);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [demoGrid, setDemoGrid] = useState<DemoGrid>(emptyGrid());
  const [highlightCells, setHighlightCells] = useState<number[][]>([]);

  const currentScene = SCENES[currentStep] ?? SCENES[0];
  const isLastStep = currentStep >= SCENES.length - 1;
  const isFirstStep = currentStep === 0;

  const goToNext = useCallback(() => {
    if (currentStep < SCENES.length - 1) setCurrentStep((s) => s + 1);
  }, [currentStep]);

  const goToPrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = setTimeout(() => {
      if (isLastStep) { setIsPlaying(false); return; }
      goToNext();
    }, 5000);
    return () => clearTimeout(id);
  }, [isPlaying, currentStep, goToNext, isLastStep]);

  useEffect(() => {
    const stepIdx = Math.min(currentStep, DEMO_STEPS.length - 1);
    const step = DEMO_STEPS[stepIdx];
    const grid = emptyGrid();
    for (const [r, c, p] of step.cells) grid[r][c] = p;
    setDemoGrid(grid);
    setHighlightCells(step.highlight ?? []);
  }, [currentStep]);

  const togglePlay = () => {
    if (isLastStep && !isPlaying) setCurrentStep(0);
    setIsPlaying((p) => !p);
  };

  const progressPct = ((currentStep + 1) / SCENES.length) * 100;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-end">
            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 font-display text-sm font-bold text-amber-200">
              {currentStep + 1}/{SCENES.length}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-400" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3 }} />
          </div>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${DEMO_SIZE}, minmax(0, 1fr))`, width: "min(320px, 100%)" }}>
            {Array.from({ length: DEMO_SIZE }).map((_, row) =>
              Array.from({ length: DEMO_SIZE }).map((__, col) => {
                const val = demoGrid[row][col];
                const filled = val !== null;
                const hl = highlightCells.some(([r, c]) => r === row && c === col);
                return (
                  <div key={`${row}-${col}`} className={`relative aspect-square rounded-full transition-all duration-300 ${hl ? "ring-2 ring-amber-300 z-10" : "ring-1 ring-black/40"}`}
                    style={{ backgroundColor: filled ? (val === "A" ? "#9f1239" : "#b8860b") : "oklch(0.10 0.015 22)" }}>
                    {filled && <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white/90 drop-shadow sm:text-[10px]">{val === "A" ? "R" : "J"}</span>}
                    {hl && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[8px] font-bold text-black">*</motion.span>}
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#9f1239" }} /> Joueur R = Toi</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: "#b8860b" }} /> Joueur J = Adversaire</span>
          </div>
          <div className="glass-card flex items-center justify-center gap-4 rounded-2xl p-3">
            <button onClick={goToPrev} disabled={isFirstStep} className="flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-card/40 text-muted-foreground transition hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"><StepBack className="h-4 w-4" /></button>
            <button onClick={togglePlay} className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-lg transition hover:from-rose-500 hover:to-rose-400">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
            </button>
            <button onClick={goToNext} disabled={isLastStep} className="flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-card/40 text-muted-foreground transition hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"><StepForward className="h-4 w-4" /></button>
            {!isFirstStep && (
              <button onClick={() => { setCurrentStep(0); setIsPlaying(false); }} className="flex h-8 items-center gap-1 rounded-full border border-border/30 px-3 text-[11px] text-muted-foreground transition hover:text-foreground">
                <RefreshCw className="h-3 w-3" /> Début
              </button>
)}
          </div>
          </div>
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            <motion.div key={currentStep} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }} className="glass-card flex flex-1 flex-col rounded-3xl p-6 sm:p-8">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 ring-1 ring-amber-400/30"><span className="text-rose-300">{currentScene.icon}</span></div>
              <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{currentScene.title}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{currentScene.description}</p>
              {currentScene.tip && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="mt-6 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <p className="text-sm font-medium text-amber-100">{currentScene.tip}</p>
                </motion.div>
              )}
              <div className="mt-auto flex items-center justify-center gap-2 pt-6">
                {SCENES.map((_, i) => (
                  <button key={i} onClick={() => { setCurrentStep(i); setIsPlaying(false); }}
                    className={`h-2 rounded-full transition-all duration-300 ${i === currentStep ? "w-8 bg-amber-400" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"}`}
                    aria-label={`Étape ${i + 1}`} />
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="flex items-center gap-2">
            {isLastStep && (
              <Button size="sm" onClick={() => { setCurrentStep(0); setIsPlaying(false); }} className="ml-auto bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400">
                <RefreshCw className="mr-1.5 h-4 w-4" /> Revoir du début
              </Button>
            )}
          </div>
          </div>
        </div>
      </div>
  );
}
