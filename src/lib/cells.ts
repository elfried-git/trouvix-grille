import type { Cell, CellType, CardCategory, CategoryMeta } from "./types";

// Board is a 16x16 grid. Cells wrap the perimeter (60 cells total).
// Path: bottom row (left→right) → right col (bottom→top) → top row (right→left) → left col (top→bottom).
export function getCellCoord(index: number): { row: number; col: number } {
  if (index <= 15) return { row: 15, col: index };
  if (index <= 30) return { row: 15 - (index - 15), col: 15 };
  if (index <= 45) return { row: 0, col: 15 - (index - 30) };
  return { row: index - 45, col: 0 };
}

// Distribution of cell types across 60 cells.
// Cell 0 = Départ (start), Cell 59 = Arrivée (end).
// Cells 1..58 (58 cells) typed: Histoire 12, Géographie 12, Sciences 12, Arts 11, Sport 6, Joker 5 = 58
const TYPE_SEQUENCE: CellType[] = [
  // index 0
  "start",
  // indices 1-58: interleave the typed cells in a varied but deterministic pattern
  "histoire", "geographie", "sciences", "arts", "sport",
  "histoire", "geographie", "joker", "sciences", "histoire",
  "arts", "geographie", "sport", "sciences", "histoire",
  "geographie", "arts", "joker", "sciences", "histoire",
  "geographie", "sport", "arts", "sciences", "histoire",
  "geographie", "sciences", "arts", "joker", "histoire",
  "geographie", "sciences", "sport", "arts", "geographie",
  "histoire", "sciences", "arts", "geographie", "joker",
  "histoire", "sciences", "sport", "arts", "geographie",
  "histoire", "sciences", "arts", "geographie", "joker",
  "histoire", "sciences", "sport", "arts", "geographie",
  "histoire", "sciences", "arts",
  // index 59
  "end",
];

export const CELLS: Cell[] = TYPE_SEQUENCE.map((type, index) => {
  const { row, col } = getCellCoord(index);
  return { index, type, row, col };
});

export function nextCellOfType(fromIndex: number, type: CardCategory): number {
  for (let i = 1; i <= 60; i++) {
    const idx = (fromIndex + i) % 60;
    if (CELLS[idx]?.type === type) return idx;
  }
  return fromIndex;
}

export const CATEGORY_META: Record<CardCategory, CategoryMeta> = {
  histoire: {
    key: "histoire",
    label: "Histoire & Politique",
    emoji: "🏛️",
    short: "Histoire",
    color: "text-rose-300",
    bg: "bg-rose-500/15",
    border: "border-rose-400/40",
    ring: "ring-rose-400/40",
    description: "Empires, révolutions, figures politiques, traités, décolonisation.",
    basePoints: "+3 points",
  },
  geographie: {
    key: "geographie",
    label: "Géographie",
    emoji: "🌍",
    short: "Géographie",
    color: "text-amber-300",
    bg: "bg-amber-500/15",
    border: "border-amber-400/40",
    ring: "ring-amber-400/40",
    description: "Fleuves, montagnes, mers, drapeaux, frontières, pays du monde.",
    basePoints: "+2 points",
  },
  sciences: {
    key: "sciences",
    label: "Sciences & Nature",
    emoji: "🔬",
    short: "Sciences",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15",
    border: "border-emerald-400/40",
    ring: "ring-emerald-400/40",
    description: "Biologie, physique, chimie, astres, inventions, corps humain.",
    basePoints: "+3 à +5 points",
  },
  arts: {
    key: "arts",
    label: "Arts & Spectacle",
    emoji: "🎭",
    short: "Arts",
    color: "text-fuchsia-300",
    bg: "bg-fuchsia-500/15",
    border: "border-fuchsia-400/40",
    ring: "ring-fuchsia-400/40",
    description: "Peinture, littérature, théâtre, cinéma, musique, architecture.",
    basePoints: "+2 points",
  },
  sport: {
    key: "sport",
    label: "Sport & Jeux",
    emoji: "🏆",
    short: "Sport",
    color: "text-lime-300",
    bg: "bg-lime-500/15",
    border: "border-lime-400/40",
    ring: "ring-lime-400/40",
    description: "Football, JO, tennis, rugby, athlétisme, champions, records.",
    basePoints: "+2 points",
  },
  joker: {
    key: "joker",
    label: "Joker",
    emoji: "🎁",
    short: "Joker",
    color: "text-sky-300",
    bg: "bg-sky-500/15",
    border: "border-sky-400/40",
    ring: "ring-sky-400/40",
    description: "Une action spéciale inattendue.",
    basePoints: "Effet spécial",
  },
};

// Pawn presets for players (neutral knowledge-game theme)
export const PAWN_PRESETS: { color: string; emoji: string; label: string }[] = [
  { color: "#e11d48", emoji: "🦊", label: "Renard" },
  { color: "#d4af37", emoji: "🦁", label: "Lion" },
  { color: "#f5f5f4", emoji: "🦌", label: "Cerf" },
  { color: "#1c1917", emoji: "🐯", label: "Tigre" },
];
