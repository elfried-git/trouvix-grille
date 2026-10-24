"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playTrouvixMagicChime } from "@/lib/reaction-sounds";

// 8 particles shooting outward in all directions during the 2x2 square snap
const SPARKLE_BURST = [
  { id: 0, angle: 0, dist: 95, size: "text-lg", char: "✦", color: "text-amber-300" },
  { id: 1, angle: 45, dist: 110, size: "text-base", char: "✨", color: "text-rose-400" },
  { id: 2, angle: 90, dist: 95, size: "text-lg", char: "✦", color: "text-yellow-200" },
  { id: 3, angle: 135, dist: 110, size: "text-base", char: "✨", color: "text-amber-400" },
  { id: 4, angle: 180, dist: 95, size: "text-lg", char: "✦", color: "text-rose-400" },
  { id: 5, angle: 225, dist: 110, size: "text-base", char: "✨", color: "text-amber-300" },
  { id: 6, angle: 270, dist: 95, size: "text-lg", char: "✦", color: "text-yellow-200" },
  { id: 7, angle: 315, dist: 110, size: "text-base", char: "✨", color: "text-rose-300" },
];

export function TrouvixHeroTitle() {
  const [replayCount, setReplayCount] = useState(0);

  const handleHeroClick = useCallback(() => {
    playTrouvixMagicChime();
    setReplayCount((c) => c + 1);
  }, []);

  return (
    <div
      key={replayCount}
      onClick={handleHeroClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleHeroClick();
        }
      }}
      className="group relative flex flex-col items-center justify-center cursor-pointer select-none focus:outline-none"
      aria-label="Trouvix — Cliquez pour relancer l'effet magique"
      title="Touchez pour relancer l'effet magique"
    >
      {/* Ambient background bloom */}
      <motion.div
        className="pointer-events-none absolute -inset-10 rounded-full bg-gradient-radial from-rose-500/30 via-amber-500/20 to-transparent blur-3xl -z-10"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 0.7, scale: 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      {/* ======================================================== */}
      {/* 1. L'ASSEMBLAGE DU CARRE MAGIQUE (4 pions 2x2 qui claquent) */}
      {/* ======================================================== */}
      <div className="relative mb-3 flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center">
        {/* The 4 converging magic tiles */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-2 p-1 pointer-events-none">
          {/* Top-Left: Red Ruby tile */}
          <motion.div
            initial={{ opacity: 0, x: -90, y: -80, rotate: -45, scale: 0.2 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 280,
              damping: 20,
            }}
            className="relative rounded-2xl bg-gradient-to-br from-rose-400 via-rose-600 to-red-700 p-0.5 shadow-[0_0_16px_rgba(244,63,94,0.7)] ring-1 ring-white/30"
          >
            <div className="h-full w-full rounded-[14px] bg-gradient-to-b from-white/30 to-transparent" />
          </motion.div>

          {/* Top-Right: Warm Gold tile */}
          <motion.div
            initial={{ opacity: 0, x: 90, y: -80, rotate: 45, scale: 0.2 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 280,
              damping: 20,
            }}
            className="relative rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-[0_0_16px_rgba(245,158,11,0.7)] ring-1 ring-white/30"
          >
            <div className="h-full w-full rounded-[14px] bg-gradient-to-b from-white/30 to-transparent" />
          </motion.div>

          {/* Bottom-Left: Warm Gold tile */}
          <motion.div
            initial={{ opacity: 0, x: -90, y: 80, rotate: -45, scale: 0.2 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 280,
              damping: 20,
            }}
            className="relative rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-[0_0_16px_rgba(245,158,11,0.7)] ring-1 ring-white/30"
          >
            <div className="h-full w-full rounded-[14px] bg-gradient-to-b from-white/30 to-transparent" />
          </motion.div>

          {/* Bottom-Right: Red Ruby tile */}
          <motion.div
            initial={{ opacity: 0, x: 90, y: 80, rotate: 45, scale: 0.2 }}
            animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              type: "spring",
              stiffness: 280,
              damping: 20,
            }}
            className="relative rounded-2xl bg-gradient-to-br from-rose-400 via-rose-600 to-red-700 p-0.5 shadow-[0_0_16px_rgba(244,63,94,0.7)] ring-1 ring-white/30"
          >
            <div className="h-full w-full rounded-[14px] bg-gradient-to-b from-white/30 to-transparent" />
          </motion.div>
        </div>

        {/* Shockwave 1: Golden ring expanding at snap (delay 0.48s) */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0.95 }}
          animate={{ scale: 2.8, opacity: 0 }}
          transition={{ delay: 0.48, duration: 0.75, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-300 shadow-[0_0_24px_rgba(250,204,21,0.9)]"
        />

        {/* Shockwave 2: Ruby ring expanding slightly after */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0.9 }}
          animate={{ scale: 3.4, opacity: 0 }}
          transition={{ delay: 0.54, duration: 0.85, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-full border border-rose-500 shadow-[0_0_24px_rgba(244,63,94,0.8)]"
        />

        {/* Center Flash on impact */}
        <motion.div
          initial={{ scale: 0.3, opacity: 1 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ delay: 0.48, duration: 0.55, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-full bg-gradient-radial from-white via-amber-200/70 to-transparent blur-md"
        />

        {/* 8 Starburst particles shooting outward */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {SPARKLE_BURST.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const targetX = Math.round(Math.cos(rad) * p.dist);
            const targetY = Math.round(Math.sin(rad) * p.dist);

            return (
              <motion.span
                key={p.id}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: targetX,
                  y: targetY,
                  scale: [0, 1.4, 0],
                  opacity: [1, 1, 0],
                }}
                transition={{
                  delay: 0.48,
                  duration: 0.75,
                  ease: "easeOut",
                }}
                className={`absolute select-none ${p.size} ${p.color} drop-shadow-[0_0_8px_currentColor]`}
              >
                {p.char}
              </motion.span>
            );
          })}
        </div>

        {/* The Official Trouvix Logo: emerges in full glory from the impact */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3, rotate: -12 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{
            delay: 0.46,
            duration: 0.7,
            type: "spring",
            stiffness: 240,
            damping: 18,
          }}
          className="relative z-10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
        >
          <img
            src="/trouvix-logo.svg"
            alt="Logo Trouvix Grille"
            width={112}
            height={112}
            className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-[0_10px_28px_-6px_oklch(0.60_0.215_25/0.7)]"
          />
        </motion.div>
      </div>

      {/* ======================================================== */}
      {/* 2. LE TEXTE « TROUVIX » AVEC ZOOM ÉLASTIQUE & SHIMMER    */}
      {/* ======================================================== */}
      <motion.div
        initial={{ opacity: 0, scale: 0.35, y: 25 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{
          delay: 0.35,
          duration: 0.8,
          type: "spring",
          stiffness: 220,
          damping: 18,
        }}
        className="relative flex flex-col items-center"
      >
        {/* Glow halo behind wordmark */}
        <motion.div
          className="pointer-events-none absolute -inset-x-8 -inset-y-3 rounded-full bg-gradient-to-r from-rose-600/30 via-amber-500/25 to-rose-600/30 blur-2xl -z-10"
          animate={{
            scale: [0.96, 1.05, 0.96],
            opacity: [0.35, 0.65, 0.35],
          }}
          transition={{
            repeat: Infinity,
            duration: 3,
            ease: "easeInOut",
          }}
        />

        <div className="relative inline-flex items-baseline">
          {/* Main Wordmark Heading */}
          <h1
            className="trouvix-hero-wordmark text-6xl sm:text-7xl md:text-8xl select-none"
            aria-label="Trouvix"
          >
            <span className="trouvix-wordmark-red transition-transform duration-200 group-hover:-translate-y-0.5">
              Trouv
            </span>
            <span className="trouvix-wordmark-gold transition-transform duration-200 group-hover:-translate-y-0.5">
              ix
            </span>
          </h1>

          {/* Shimmer Light Beam: sweeps across the text from left to right */}
          <div className="pointer-events-none absolute -inset-y-2 -inset-x-6 overflow-hidden rounded-2xl">
            <motion.div
              initial={{ x: "-120%", opacity: 0 }}
              animate={{
                x: "420%",
                opacity: [0, 0.9, 0.9, 0],
              }}
              transition={{
                delay: 1.1,
                duration: 1.0,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="h-full w-28 bg-gradient-to-r from-transparent via-white/85 to-transparent skew-x-[-22deg] blur-[0.5px] mix-blend-overlay"
            />
          </div>

          {/* Interactive Golden Star ✦ with dynamic spin & sparkle release */}
          <motion.span
            initial={{ scale: 0, rotate: -180, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{
              delay: 1.15,
              duration: 0.7,
              type: "spring",
              stiffness: 240,
              damping: 14,
            }}
            className="absolute -top-3 -right-6 sm:-top-4 sm:-right-8 select-none font-sans text-2xl sm:text-3xl text-amber-200 drop-shadow-[0_0_12px_rgba(255,205,78,0.95)]"
          >
            ✦
          </motion.span>

          {/* Floating mini sparkles near the star */}
          <motion.span
            initial={{ opacity: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], y: -20, scale: [0, 1.2, 0] }}
            transition={{ delay: 1.45, duration: 0.9 }}
            className="pointer-events-none absolute -top-6 -right-2 text-xs text-yellow-300 drop-shadow-[0_0_6px_#fde047]"
          >
            ✨
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 0, scale: 0 }}
            animate={{ opacity: [0, 1, 0], y: -16, scale: [0, 1, 0] }}
            transition={{ delay: 1.55, duration: 0.9 }}
            className="pointer-events-none absolute -top-3 -right-10 text-xs text-amber-300 drop-shadow-[0_0_6px_#fcd34d]"
          >
            ✨
          </motion.span>
        </div>

        {/* Subtitle badge: Le jeu du carré */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.6 }}
          className="mt-2 flex items-center justify-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3.5 py-1 text-xs sm:text-sm font-semibold tracking-wide text-amber-200 shadow-sm transition-colors group-hover:border-amber-400/40 group-hover:bg-amber-500/20"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span>Le jeu du carré · 2×2</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
