"use client";

import { motion } from "framer-motion";
import { Crown, Trophy } from "lucide-react";
import { Avatar } from "./Avatar";

export interface GameResultPlayer {
  id: string;
  name: string;
  color: string;
  emoji: string;
  score: number;
  connected?: boolean;
}

export function WinnerHero({ winner }: { winner: GameResultPlayer }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 145, damping: 20 }}
      className="relative isolate w-full max-w-xl overflow-hidden rounded-[2rem] border border-amber-300/25 bg-gradient-to-b from-amber-400/[0.12] via-card/75 to-card/55 px-4 py-4 text-center shadow-[0_24px_70px_-38px_rgba(245,158,11,0.52)] sm:px-10 sm:py-9"
    >
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/70 to-transparent" />
      <div className="pointer-events-none absolute -right-12 -top-16 -z-10 h-48 w-48 rounded-full bg-amber-300/[0.08] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 -z-10 h-48 w-48 rounded-full bg-rose-400/[0.08] blur-3xl" />

      <motion.div
        animate={{ y: [0, -5, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative mx-auto mb-2 w-fit sm:mb-5"
      >
        <div className="rounded-full border border-amber-200/35 bg-amber-300/[0.08] p-1.5 shadow-[0_0_36px_-12px_rgba(251,191,36,0.7)] sm:p-2">
          <div className="rounded-full border-2 border-amber-300/75 bg-background/50 p-1">
            <Avatar
              avatar={winner.emoji}
              color={winner.color}
              size={54}
              emojiSize="text-3xl"
              ring={false}
              className="ring-4 ring-white/25"
            />
          </div>
        </div>
        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-lg sm:h-9 sm:w-9">
          <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </motion.div>

      <p className="whitespace-nowrap font-display text-[0.68rem] font-bold uppercase tracking-[0.2em] text-amber-200/75 sm:text-sm sm:tracking-[0.28em]">
        Le champion ultime
      </p>
      <h1 className="mt-1 break-words font-display text-2xl font-black leading-tight text-gold-gradient drop-shadow-lg sm:mt-2 sm:text-5xl">
        {winner.name}
      </h1>
      <p className="mt-2 hidden text-xs text-muted-foreground sm:mt-4 sm:block sm:text-sm">
        La grille a parlé. Place à la revanche ?
      </p>
    </motion.section>
  );
}

export function ResultRanking({
  players,
  winnerId,
  showConnectionStatus = false,
}: {
  players: GameResultPlayer[];
  winnerId: string;
  showConnectionStatus?: boolean;
}) {
  return (
    <section className="mt-5 w-full max-w-xl sm:mt-7">
      <div className="mb-3 flex items-center px-1">
        <h2 className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-[0.16em] text-foreground/85">
          <Trophy className="h-4 w-4 text-amber-300" />
          Classement
        </h2>
      </div>
      <div className="flex flex-col gap-2.5">
        {players.map((player, index) => {
          const isWinner = player.id === winnerId;
          const disconnected = showConnectionStatus && player.connected === false;
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: disconnected ? 0.6 : 1, x: 0 }}
              transition={{ delay: 0.12 + index * 0.07, duration: 0.28 }}
              className={`relative flex min-h-[3.75rem] items-center gap-2.5 overflow-hidden rounded-2xl border px-3 py-2 shadow-sm transition-colors sm:min-h-[4.5rem] sm:gap-4 sm:px-4 sm:py-2.5 ${
                isWinner
                  ? "border-amber-300/45 bg-gradient-to-r from-amber-400/[0.14] via-rose-400/[0.07] to-card/65 shadow-[0_8px_28px_-20px_rgba(251,191,36,0.65)]"
                  : "border-white/[0.08] bg-card/45 hover:bg-card/65"
              }`}
            >
              {isWinner && (
                <div className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-rose-400" />
              )}
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-base font-black ${
                  isWinner
                    ? "bg-amber-300/15 text-amber-200 ring-1 ring-amber-200/30"
                    : "bg-white/[0.06] text-muted-foreground"
                }`}
              >
                {index + 1}
              </span>
              <Avatar
                avatar={player.emoji}
                color={player.color}
                size={44}
                emojiSize="text-2xl"
                className="ring-2 ring-white/15"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className={`truncate font-display text-base font-bold sm:text-lg ${disconnected ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {player.name}
                </p>
                {isWinner && !disconnected && (
                  <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-amber-300">
                    Champion
                  </span>
                )}
                {disconnected && (
                  <span className="text-xs font-semibold text-rose-300">A quitté le salon</span>
                )}
              </div>
              <span className={`shrink-0 font-display text-xl font-black tabular-nums sm:text-2xl ${isWinner ? "text-amber-100" : "text-foreground/90"}`}>
                {player.score}
                <span className="ml-1 text-xs font-semibold text-muted-foreground sm:text-sm">pts</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
