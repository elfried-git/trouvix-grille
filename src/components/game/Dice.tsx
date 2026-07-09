"use client";

import { motion } from "framer-motion";

interface DiceProps {
  value: number | null;
  isRolling: boolean;
  onRoll: () => void;
  disabled?: boolean;
}

const DOT_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Dice({ value, isRolling, onRoll, disabled }: DiceProps) {
  const face = value ?? 1;
  const dots = DOT_POSITIONS[face];

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.button
        type="button"
        onClick={onRoll}
        disabled={disabled || isRolling}
        whileHover={!disabled && !isRolling ? { scale: 1.06 } : {}}
        whileTap={!disabled && !isRolling ? { scale: 0.94 } : {}}
        className={`dice-face relative grid h-20 w-20 grid-cols-3 grid-rows-3 gap-1 rounded-2xl p-3 transition disabled:cursor-not-allowed ${
          isRolling ? "dice-rolling" : ""
        } ${disabled ? "opacity-60" : "cursor-pointer pulse-glow"}`}
        aria-label="Lancer le dé"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="flex items-center justify-center">
            {dots.includes(i) && (
              <span className="h-3 w-3 rounded-full bg-rose-700/90 shadow-inner" />
            )}
          </span>
        ))}
      </motion.button>
      <p className="font-display text-sm tracking-wide text-amber-200/80">
        {isRolling
          ? "Le dé tourne..."
          : value
            ? `Tu as fait ${value}`
            : "Lance le dé"}
      </p>
    </div>
  );
}
