"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { ColorSwatch } from "./ColorSwatch";
import { isPhotoAvatar } from "@/lib/types";
import { AI_PROFILE_AVATARS, type AIProfile } from "@/lib/types";
import { Swords, Users, Minus, Plus, Target, X } from "lucide-react";

// Six couleurs très distinctes pour les six joueurs maximum.
const COLOR_PALETTE = [
  "#ff1744", // rouge
  "#ffd600", // jaune
  "#00c853", // vert
  "#2979ff", // bleu
  "#ff6d00", // orange
  "#d500f9", // violet
];

const AI_OPTIONS: { id: AIProfile; name: string; style: string; color: string; selectedColor: string; border: string }[] = [
  { id: "gpt", name: "GPT", style: "Équilibré", color: "bg-blue-950/80", selectedColor: "bg-blue-800/90", border: "border-blue-400/40" },
  { id: "gemini", name: "GEMINI", style: "Créatif", color: "bg-rose-950/80", selectedColor: "bg-rose-800/90", border: "border-rose-400/40" },
  { id: "claude", name: "CLAUDE", style: "Prudent", color: "bg-emerald-950/80", selectedColor: "bg-emerald-800/90", border: "border-emerald-400/40" },
  { id: "grok", name: "GROK", style: "Offensif", color: "bg-red-950/80", selectedColor: "bg-red-800/90", border: "border-red-400/40" },
  { id: "copilot", name: "COPILOT", style: "Méthodique", color: "bg-amber-950/80", selectedColor: "bg-amber-800/90", border: "border-amber-400/40" },
  { id: "siri", name: "SIRI", style: "Tactique", color: "bg-violet-950/80", selectedColor: "bg-violet-800/90", border: "border-violet-400/40" },
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
  // Each AI profile has its own portrait; human players can upload an avatar.
  const [emojis, setEmojis] = useState<string[]>(Array.from({ length: 6 }, (_, i) => i > 0 ? AI_PROFILE_AVATARS[AI_OPTIONS[i % AI_OPTIONS.length].id] : ""));
  // isAI: true = AI-controlled player (uses its selected AI portrait)
  const [isAI, setIsAI] = useState<boolean[]>([false, true, true, true, true, true]);
  const [aiProfiles, setAiProfiles] = useState<AIProfile[]>(["gpt", "gemini", "claude", "grok", "copilot", "siri"]);
  const [rounds, setRounds] = useState(10);

  // Validation: every visible human player must have a name. AI players are filled automatically.
  const playersValid = Array.from({ length: count }).every(
    (_, i) => isAI[i] || names[i].trim().length > 0
  );

  const toggleAI = (i: number) => {
    const next = [...isAI];
    next[i] = !next[i];
    setIsAI(next);
    // When enabling AI: assign its default name and profile portrait.
    if (next[i]) {
      if (!names[i].trim()) {
        const nn = [...names];
        nn[i] = getDefaultAIName(i);
        setNames(nn);
      }
      const aiAvatar = AI_PROFILE_AVATARS[aiProfiles[i]];
      if (emojis[i] !== aiAvatar) {
        const ne = [...emojis];
        ne[i] = aiAvatar;
        setEmojis(ne);
      }
    } else {
      // When disabling AI: clear its automatically assigned profile icon.
      if (Object.values(AI_PROFILE_AVATARS).includes(emojis[i])) {
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
    const nextEmojis = [...emojis];
    nextEmojis[1] = AI_PROFILE_AVATARS[profile];
    setEmojis(nextEmojis);
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
      const profileAvatar = AI_PROFILE_AVATARS[aiProfiles[i]];
      if (nextEmojis[i] !== profileAvatar) {
        nextEmojis[i] = profileAvatar;
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
        emoji: isAI[i] ? AI_PROFILE_AVATARS[aiProfiles[i]] : emojis[i],
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
            Retour
          </Button>
        </div>

        <div className="mb-1">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-200/90">
            <Swords className="h-3.5 w-3.5" /> Partie locale
          </div>
          <h2 className="font-display text-4xl font-black tracking-tight text-gold-gradient drop-shadow-[0_4px_18px_rgba(245,158,11,0.18)] sm:text-5xl">
            Composer votre jeu
          </h2>
        </div>

        {/* Player count */}
        <div className="relative mt-7 flex flex-col gap-3 overflow-hidden rounded-2xl border border-amber-200/15 bg-gradient-to-br from-amber-300/[0.08] via-card/60 to-rose-400/[0.04] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.14)] sm:flex-row sm:items-center sm:justify-between">
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
        <div className="relative mt-4 flex flex-col gap-3 overflow-hidden rounded-2xl border border-rose-200/15 bg-gradient-to-br from-rose-300/[0.07] via-card/60 to-violet-400/[0.04] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.14)] sm:flex-row sm:items-center sm:justify-between">
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
              className={`relative overflow-hidden rounded-2xl border p-4 shadow-[0_10px_28px_rgba(0,0,0,0.16)] transition ${
                nameMissing
                  ? "border-rose-300/30 bg-gradient-to-br from-rose-400/[0.09] via-card/60 to-transparent"
                  : isAI[i]
                    ? "border-violet-300/25 bg-gradient-to-br from-violet-400/[0.09] via-card/60 to-transparent"
                    : "border-amber-200/15 bg-gradient-to-br from-amber-300/[0.06] via-card/60 to-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0 rounded-full bg-gradient-to-br from-white/90 via-amber-200/75 to-rose-400/80 p-[2px] shadow-[0_0_22px_rgba(251,191,36,0.18)]">
                  <Avatar
                    avatar={emojis[i]}
                    color={colors[i]}
                    size={50}
                    emojiSize="text-2xl"
                    ring={false}
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
                    className={`mt-1 h-14 rounded-xl bg-black/25 text-base shadow-inner shadow-black/20 transition focus-visible:ring-amber-300/40 sm:text-lg ${
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
                  {isAI[i] ? "IA active" : "IA"}
                </button>
                {/* Upload photo button (hidden for AI players) — photo is optional */}
                {!isAI[i] && (
                  <label
                    className="flex h-12 cursor-pointer items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-4 text-base font-medium text-amber-200 transition hover:bg-amber-500/20"
                    title="Téléverser une photo (optionnel)"
                  >
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
                <div className="mt-4 rounded-2xl border border-violet-300/20 bg-gradient-to-br from-violet-400/[0.1] to-fuchsia-500/[0.04] p-3 shadow-inner shadow-black/20">
                  <p className="mb-2 text-base font-semibold text-violet-100">Choisis ton adversaire IA</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {AI_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => chooseAiProfile(option.id)}
                        aria-pressed={aiProfiles[1] === option.id}
                        className={`group relative isolate min-h-[4.5rem] overflow-hidden rounded-2xl border px-4 py-3 text-left text-white shadow-[0_8px_18px_rgba(0,0,0,0.28)] transition-[transform,box-shadow,filter] duration-300 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-gradient-to-br before:from-white/10 before:via-transparent before:to-black/25 before:content-[''] hover:-translate-y-1 hover:shadow-[0_14px_26px_rgba(0,0,0,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${option.color} ${option.border} ${aiProfiles[1] === option.id ? `${option.selectedColor} ring-2 ring-amber-100/80 shadow-[0_0_24px_rgba(255,198,76,0.25)]` : "hover:brightness-125"}`}
                      >
                        {aiProfiles[1] === option.id && (
                          <span
                            aria-hidden="true"
                            className="ai-selection-border-blink pointer-events-none absolute inset-0 rounded-2xl border-2 border-amber-100"
                          />
                        )}
                        <span className="relative z-10 flex w-full flex-col items-center justify-center gap-1.5 py-1">
                          <span className="font-display text-lg font-black italic tracking-[0.12em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)] transition-all duration-300 group-hover:scale-110 group-hover:tracking-[0.17em]">
                            {option.name}
                          </span>
                          <span
                            aria-hidden="true"
                            className={`h-0.5 rounded-full bg-white/65 transition-all duration-300 ${aiProfiles[1] === option.id ? "w-10" : "w-5 group-hover:w-10"}`}
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Color picker */}
              <div className="mt-4 grid w-full grid-cols-6 items-center justify-items-center gap-y-2 rounded-xl border border-white/[0.06] bg-black/15 px-2 py-2.5">
                {COLOR_PALETTE.map((color) => {
                  const selected = colors[i] === color;
                  const usedByOther = colors
                    .slice(0, count)
                    .some((c, idx) => idx !== i && c === color);
                  return (
                    <ColorSwatch
                      key={color}
                      color={color}
                      selected={selected}
                      disabled={isAI[i] || (usedByOther && !selected)}
                      onClick={() => setColor(i, color)}
                      sizeClass="h-[34px] w-[34px] sm:h-11 sm:w-11"
                      title={
                        isAI[i]
                          ? "Couleur verrouillée pour l'IA"
                          : usedByOther && !selected
                            ? "Couleur déjà prise"
                            : "Choisir cette couleur"
                      }
                    />
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
          className="mt-6 h-14 w-full rounded-2xl bg-gradient-to-r from-rose-600 via-pink-600 to-rose-500 text-base font-bold text-white shadow-[0_10px_28px_rgba(244,63,94,0.2)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Lancer le match ({rounds} rounds)
        </Button>
      </motion.div>
    </div>
  );
}
