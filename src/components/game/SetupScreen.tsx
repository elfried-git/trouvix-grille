"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { isPhotoAvatar } from "@/lib/types";
import type { AIProfile } from "@/lib/types";
import { ArrowLeft, ArrowRight, Swords, Users, Minus, Plus, Target, Check, Camera, X, Bot } from "lucide-react";

// Elegant color palette — 16 distinct deep tones (so up to 6 players always have a unique choice)
const COLOR_PALETTE = [
  "#ff1744", // rouge vif
  "#ffc400", // jaune solaire
  "#00c9a7", // turquoise
  "#ff7a00", // orange pop
  "#8b5cf6", // violet
  "#00b8f0", // cyan
  "#f72585", // rose
  "#22c55e", // vert
  "#4361ee", // bleu
  "#f43f5e", // corail
  "#c026d3", // magenta
  "#0891b2", // bleu lagon
  "#a3e635", // citron vert
  "#14b8a6", // jade
  "#fb7185", // rose clair
  "#84cc16", // lime
];

const AI_OPTIONS: { id: AIProfile; name: string; style: string; color: string; selectedColor: string; border: string }[] = [
  { id: "gpt", name: "GPT", style: "Équilibré", color: "bg-blue-950/80", selectedColor: "bg-blue-800/90", border: "border-blue-400/40" },
  { id: "gemini", name: "GEMINI", style: "Créatif", color: "bg-rose-950/80", selectedColor: "bg-rose-800/90", border: "border-rose-400/40" },
  { id: "claude", name: "CLAUDE", style: "Prudent", color: "bg-emerald-950/80", selectedColor: "bg-emerald-800/90", border: "border-emerald-400/40" },
  { id: "grok", name: "GROK", style: "Offensif", color: "bg-red-950/80", selectedColor: "bg-red-800/90", border: "border-red-400/40" },
  { id: "copilot", name: "COPILOT", style: "Méthodique", color: "bg-amber-950/80", selectedColor: "bg-amber-800/90", border: "border-amber-400/40" },
  { id: "kimi", name: "KIMI 2", style: "Tactique", color: "bg-violet-950/80", selectedColor: "bg-violet-800/90", border: "border-violet-400/40" },
];
const AI_NAMES = AI_OPTIONS.map((ai) => ai.name);

const getDefaultAIName = (index: number) => AI_NAMES[index] ?? `IA ${index + 1}`;

const ROUND_OPTIONS = [5, 10, 15];

export function SetupScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const backHome = useGameStore((s) => s.backHome);
  const [count, setCount] = useState(2);
  // Names default to empty — each player must type their own name
  const [names, setNames] = useState<string[]>(Array.from({ length: 6 }, () => ""));
  const [colors, setColors] = useState<string[]>([...COLOR_PALETTE]);
  // Avatar state: empty string = no photo yet (photo is required for humans); data URL = uploaded photo
  const [emojis, setEmojis] = useState<string[]>(Array.from({ length: 6 }, () => ""));
  // isAI: true = AI-controlled player (no photo required, robot avatar)
  const [isAI, setIsAI] = useState<boolean[]>([false, true, true, true, true, true]);
  const [aiProfiles, setAiProfiles] = useState<AIProfile[]>(["gpt", "gemini", "claude", "grok", "copilot", "kimi"]);
  const [rounds, setRounds] = useState(10);

  // Validation: every visible human player must have a name. AI players are filled automatically.
  const playersValid = Array.from({ length: count }).every(
    (_, i) => isAI[i] || names[i].trim().length > 0
  );

  const toggleAI = (i: number) => {
    const next = [...isAI];
    next[i] = !next[i];
    setIsAI(next);
    // When enabling AI: auto-fill name + robot emoji if empty
    if (next[i]) {
      if (!names[i].trim()) {
        const nn = [...names];
        nn[i] = getDefaultAIName(i);
        setNames(nn);
      }
      if (!isPhotoAvatar(emojis[i])) {
        const ne = [...emojis];
        ne[i] = "🤖";
        setEmojis(ne);
      }
    } else {
      // When disabling AI: clear the robot emoji if it was set automatically
      if (emojis[i] === "🤖") {
        const ne = [...emojis];
        ne[i] = "";
        setEmojis(ne);
      }
      if (AI_NAMES.includes(names[i]) || names[i] === getDefaultAIName(i)) {
        const nn = [...names];
        nn[i] = "";
        setNames(nn);
      }
    }
  };

  const updateName = (i: number, v: string) => {
    const next = [...names];
    next[i] = v;
    setNames(next);
  };

  const setColor = (i: number, color: string) => {
    const next = [...colors];
    // Enforce uniqueness: if another visible player already has this color, swap with them
    const ownerIdx = next
      .slice(0, count)
      .findIndex((c, idx) => idx !== i && c === color);
    if (ownerIdx >= 0) {
      next[ownerIdx] = next[i]; // give the other player my old color
    }
    next[i] = color;
    setColors(next);
  };

  const chooseAiProfile = (profile: AIProfile) => {
    const nextProfiles = [...aiProfiles];
    nextProfiles[1] = profile;
    setAiProfiles(nextProfiles);
    const nextNames = [...names];
    nextNames[1] = AI_OPTIONS.find((option) => option.id === profile)?.name ?? "GPT";
    setNames(nextNames);
  };

  // Upload a photo as avatar (read file as data URL)
  const uploadPhoto = (i: number, file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const next = [...emojis];
      next[i] = dataUrl; // store the photo data URL in the emoji slot
      setEmojis(next);
    };
    reader.readAsDataURL(file);
  };

  // Clear photo → revert to plain colored bubble (empty string)
  const clearPhoto = (i: number) => {
    const next = [...emojis];
    next[i] = "";
    setEmojis(next);
  };

  useEffect(() => {
    const nextAI = [...isAI];
    const nextNames = [...names];
    const nextEmojis = [...emojis];

    for (let i = 1; i < count; i++) {
      nextAI[i] = true;
      if (!nextNames[i].trim()) {
        nextNames[i] = getDefaultAIName(i);
      }
      if (!isPhotoAvatar(nextEmojis[i])) {
        nextEmojis[i] = "🤖";
      }
    }

    setIsAI(nextAI);
    setNames(nextNames);
    setEmojis(nextEmojis);
  }, [count]);

  const handleStart = () => {
    if (!playersValid) return;
    const setupPlayers = Array.from({ length: count }).map((_, i) => {
      const aiName = getDefaultAIName(i);
      return {
        name: isAI[i] ? names[i].trim() || aiName : names[i].trim(),
        color: colors[i],
        emoji: isAI[i] ? emojis[i] || "🤖" : emojis[i],
        isAI: isAI[i],
        aiProfile: isAI[i] ? aiProfiles[i] : undefined,
      };
    });
    startGame(setupPlayers, rounds);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-3xl p-6 sm:p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={backHome}
            className="h-12 px-4 text-base text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-5 w-5" /> Retour
          </Button>
        </div>

        <h2 className="font-display text-4xl font-bold text-gold-gradient sm:text-5xl">
          Composer votre jeu
        </h2>

        {/* Player count */}
        <div className="mt-8 flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-amber-300" />
            <span className="font-medium">Nombre de joueurs</span>
          </div>
          <div className="flex items-center justify-between gap-4 self-end sm:gap-3 sm:self-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCount((c) => Math.max(2, c - 1))}
              disabled={count <= 2}
              className="h-12 w-12"
            >
              <Minus className="h-5 w-5" />
            </Button>
            <span className="w-10 text-center font-display text-3xl font-bold">
              {count}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCount((c) => Math.min(6, c + 1))}
              disabled={count >= 6}
              className="h-12 w-12"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Round choice */}
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-rose-300" />
            <span className="font-medium">Longueur du match</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
            {ROUND_OPTIONS.map((r) => (
              <Button
                key={r}
                variant={rounds === r ? "default" : "outline"}
                size="sm"
                onClick={() => setRounds(r)}
                className={`h-12 text-base ${
                  rounds === r
                    ? "bg-gradient-to-r from-rose-600 to-rose-500 text-white"
                    : ""
                }`}
              >
                {r} rounds
              </Button>
            ))}
          </div>
        </div>

        {/* Players list */}
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: count }).map((_, i) => {
            const isPhoto = isPhotoAvatar(emojis[i]);
            const hasName = names[i].trim().length > 0;
            const nameMissing = !hasName && !isAI[i];
            return (
            <div
              key={i}
              className={`rounded-xl border p-4 transition ${
                nameMissing
                  ? "border-rose-400/40 bg-card/40"
                  : isAI[i]
                    ? "border-violet-400/40 bg-violet-500/5"
                    : "border-border/60 bg-card/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Avatar
                    avatar={emojis[i]}
                    color={colors[i]}
                    size={52}
                    emojiSize="text-2xl"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor={`name-${i}`} className="flex items-center gap-1 text-base text-muted-foreground">
                    Joueur {i + 1}
                    <span className="text-rose-400" title="Obligatoire">*</span>
                  </Label>
                  <Input
                    id={`name-${i}`}
                    value={names[i]}
                    onChange={(e) => updateName(i, e.target.value)}
                    placeholder="Saisis ton nom"
                    maxLength={18}
                    disabled={isAI[i]}
                    className={`mt-1 h-14 text-lg bg-background/60 ${
                      isAI[i]
                        ? "cursor-not-allowed opacity-60"
                        : nameMissing
                          ? "border-rose-400/60 focus-visible:border-rose-400"
                          : "border-border/60"
                    }`}
                  />
                </div>
              </div>
              {/* AI toggle + Avatar picker */}
              <div className="mt-3 flex flex-wrap items-center gap-2 pl-1 sm:gap-1.5">
                {/* AI toggle */}
                <button
                  onClick={() => toggleAI(i)}
                  disabled={isAI[i]}
                  className={`flex h-12 items-center gap-2 rounded-full border px-4 text-base font-medium transition ${
                    isAI[i]
                      ? "border-violet-400/60 bg-violet-500/20 text-violet-200 cursor-not-allowed"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                  title={
                    isAI[i]
                      ? "IA verrouillée : aucune intervention possible"
                      : "Activer l'IA (joue automatiquement)"
                  }
                >
                  <Bot className="h-5 w-5" />
                  {isAI[i] ? "IA active" : "IA"}
                </button>
                {/* Upload photo button (hidden for AI players) — photo is optional */}
                {!isAI[i] && (
                  <label
                    className="flex h-12 cursor-pointer items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 text-base font-medium text-amber-200 transition hover:bg-amber-500/20"
                    title="Téléverser une photo (optionnel)"
                  >
                  <Camera className="h-5 w-5" />
                    {isPhoto ? "Photo ✓" : "Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => uploadPhoto(i, e.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
                {/* Clear photo (only if a photo is set and not AI) */}
                {!isAI[i] && isPhoto && (
                  <button
                    onClick={() => clearPhoto(i)}
                    className="flex h-12 items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 text-base font-medium text-rose-200 transition hover:bg-rose-500/20"
                    title="Retirer la photo"
                  >
                  <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              {count === 2 && i === 1 && isAI[i] && (
                <div className="mt-4 rounded-lg border border-violet-400/20 bg-violet-950/20 p-3">
                  <p className="mb-2 text-base font-semibold text-violet-100">Choisis ton adversaire IA</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {AI_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => chooseAiProfile(option.id)}
                        aria-pressed={aiProfiles[1] === option.id}
                        className={`group relative min-h-[4.5rem] overflow-hidden rounded-xl border px-4 py-3 text-left text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${option.color} ${option.border} ${aiProfiles[1] === option.id ? `${option.selectedColor} ring-2 ring-white/80 shadow-lg` : "hover:brightness-125"}`}
                      >
                        {aiProfiles[1] === option.id && (
                          <span
                            aria-hidden="true"
                            className="ai-selection-border-blink pointer-events-none absolute inset-0 rounded-xl border-2 border-amber-200"
                          />
                        )}
                        <span className="relative z-10 block font-display text-base font-bold tracking-wide">{option.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Color picker */}
              <div className="mt-3 flex flex-wrap gap-2.5 pl-1 sm:gap-1.5">
                {COLOR_PALETTE.map((color) => {
                  const selected = colors[i] === color;
                  const usedByOther = colors
                    .slice(0, count)
                    .some((c, idx) => idx !== i && c === color);
                  return (
                    <button
                      key={color}
                      onClick={() => setColor(i, color)}
                      disabled={isAI[i] || (usedByOther && !selected)}
                      className={`relative h-12 w-12 rounded-full border border-white/30 shadow-md transition duration-200 hover:scale-110 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                        selected
                          ? "scale-110 ring-4 ring-white ring-offset-2 ring-offset-background shadow-lg"
                          : usedByOther
                            ? "ring-transparent opacity-30"
                            : "ring-black/20 hover:ring-2 hover:ring-white/80"
                      } ${isAI[i] ? "cursor-not-allowed opacity-50" : ""}`}
                      style={{ backgroundColor: color }}
                      title={
                        isAI[i]
                          ? "Couleur verrouillée pour l'IA"
                          : usedByOther && !selected
                            ? "Couleur déjà prise"
                            : "Choisir cette couleur"
                      }
                    >
                      {selected && (
                        <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>

        <Button
          onClick={handleStart}
          size="lg"
          disabled={!playersValid}
          className="mt-6 h-14 w-full bg-gradient-to-r from-rose-600 to-rose-500 text-base text-white hover:from-rose-500 hover:to-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Swords className="mr-2 h-5 w-5" />
          Lancer le match ({rounds} rounds)
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
}
