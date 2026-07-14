"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { isPhotoAvatar } from "@/lib/types";
import { ArrowLeft, ArrowRight, Swords, Users, Minus, Plus, Target, Check, Camera, X, Bot } from "lucide-react";

// Elegant color palette — 16 distinct deep tones (so up to 6 players always have a unique choice)
const COLOR_PALETTE = [
  "#9f1239", // carmin profond
  "#b8860b", // or sombre
  "#0f766e", // sarcelle
  "#a16207", // ambre brûlé
  "#6d28d9", // violet royal
  "#0e7490", // bleu canard
  "#be185d", // magenta foncé
  "#166534", // émeraude forêt
  "#1e3a8a", // bleu nuit
  "#7c2d12", // brun cuivré
  "#4a044e", // prune profond
  "#0c4a6e", // bleu pétrole
  "#854d0e", // bronze
  "#155e75", // cyan foncé
  "#9d174d", // framboise
  "#365314", // olive sombre
];

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
  const [isAI, setIsAI] = useState<boolean[]>(Array.from({ length: 6 }, () => false));
  const [rounds, setRounds] = useState(10);

  // Validation: every visible player must have a name. Photo is now OPTIONAL.
  const playersValid = Array.from({ length: count }).every(
    (_, i) => names[i].trim().length > 0
  );

  const toggleAI = (i: number) => {
    const next = [...isAI];
    next[i] = !next[i];
    setIsAI(next);
    // When enabling AI: auto-fill name + robot emoji if empty
    if (next[i]) {
      if (!names[i].trim()) {
        const nn = [...names];
        nn[i] = "IA Trouvix";
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
      if (names[i] === "IA Trouvix") {
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

  const handleStart = () => {
    if (!playersValid) return;
    const setupPlayers = Array.from({ length: count }).map((_, i) => ({
      name: names[i].trim(),
      color: colors[i],
      emoji: emojis[i],
      isAI: isAI[i],
    }));
    startGame(setupPlayers, rounds);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-10">
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
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Retour
          </Button>
        </div>

        <h2 className="font-display text-3xl font-bold text-gold-gradient sm:text-4xl">
          Composition du jeu
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
              className="h-12 w-12 sm:h-9 sm:w-9"
            >
              <Minus className="h-5 w-5 sm:h-4 sm:w-4" />
            </Button>
            <span className="w-10 text-center font-display text-3xl font-bold sm:w-8 sm:text-2xl">
              {count}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCount((c) => Math.min(6, c + 1))}
              disabled={count >= 6}
              className="h-12 w-12 sm:h-9 sm:w-9"
            >
              <Plus className="h-5 w-5 sm:h-4 sm:w-4" />
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
                className={`h-12 text-sm sm:h-8 sm:text-xs ${
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
              className={`rounded-xl border p-4 transition sm:p-3 ${
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
                  <Label htmlFor={`name-${i}`} className="flex items-center gap-1 text-xs text-muted-foreground">
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
                    className={`mt-1 h-12 text-base bg-background/60 sm:h-10 sm:text-sm ${
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
                  className={`flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition sm:h-7 sm:gap-1 sm:px-2.5 sm:text-[11px] ${
                    isAI[i]
                      ? "border-violet-400/60 bg-violet-500/20 text-violet-200"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/60"
                  }`}
                  title={isAI[i] ? "Désactiver l'IA" : "Activer l'IA (joue automatiquement)"}
                >
                  <Bot className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  {isAI[i] ? "IA active" : "IA"}
                </button>
                {/* Upload photo button (hidden for AI players) — photo is optional */}
                {!isAI[i] && (
                  <label
                    className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 text-sm font-medium text-amber-200 transition hover:bg-amber-500/20 sm:h-7 sm:gap-1 sm:px-2.5 sm:text-[11px]"
                    title="Téléverser une photo (optionnel)"
                  >
                    <Camera className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
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
                    className="flex h-11 items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 sm:h-7 sm:px-2.5 sm:text-[11px]"
                    title="Retirer la photo"
                  >
                    <X className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  </button>
                )}
              </div>
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
                      className={`relative h-10 w-10 rounded-full ring-2 transition sm:h-7 sm:w-7 ${
                        selected
                          ? "ring-white scale-110"
                          : usedByOther
                            ? "ring-transparent opacity-30"
                            : "ring-white/30 hover:ring-white/60"
                      }`}
                      style={{ backgroundColor: color }}
                      title={usedByOther && !selected ? "Couleur déjà prise" : "Choisir cette couleur"}
                      disabled={usedByOther && !selected}
                    >
                      {selected && (
                        <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow sm:h-3.5 sm:w-3.5" />
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