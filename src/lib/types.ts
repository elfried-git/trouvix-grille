export type Phase = "home" | "setup" | "playing" | "gameover" | "online-setup" | "online-playing" | "reviews";

export type AIProfile = "gpt" | "gemini" | "claude" | "grok" | "copilot" | "kimi" | "siri";
export const AI_PROFILE_AVATARS: Record<AIProfile, string> = {
  gpt: "/images/ai-profiles/gpt.png",
  gemini: "/images/ai-profiles/gemini.png",
  claude: "/images/ai-profiles/claude.png",
  grok: "/images/ai-profiles/grok.png",
  copilot: "/images/ai-profiles/copilot.png",
  kimi: "/images/ai-profiles/siri.png", // Keep older saved games compatible.
  siri: "/images/ai-profiles/siri.png",
};

export interface Player {
  id: string;
  name: string;
  color: string; // hex
  emoji: string; // emoji string OR data URL (uploaded photo) — used as avatar
  score: number;
  alignments: number; // number of 4-in-a-row made
  bombardmentUsed?: boolean;
  isAI?: boolean; // true for AI-controlled players
  aiProfile?: AIProfile;
}

// Helper: returns true if the avatar is a photo (data URL or public asset URL) vs an emoji
export function isPhotoAvatar(avatar: string): boolean {
  return avatar.startsWith("data:") || avatar.startsWith("/");
}

// Legacy types kept for the (now unused) cards module / DB compatibility.
export type CardCategory = "histoire" | "geographie" | "sciences" | "arts" | "sport" | "joker";

export interface Cell {
  index: number;
  type: string;
  row: number;
  col: number;
}

export type CellType = string;

export interface CardData {
  id: string;
  category: CardCategory;
  prompt: string;
  answer?: string | null;
  points: number;
}

export interface CategoryMeta {
  key: CardCategory;
  label: string;
  emoji: string;
  short: string;
  color: string;
  bg: string;
  border: string;
  ring: string;
  description: string;
  basePoints: string;
}

export type TurnPhase = "idle" | "rolling" | "moving" | "card" | "ended";
