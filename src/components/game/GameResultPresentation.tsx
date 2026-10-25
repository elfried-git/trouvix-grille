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
      className="relative isolate w-full max-w-xl overflow-hidden rounded-[2rem] border border-amber-300/35 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,158,11,0.18),transparent_58%),radial-gradient(ellipse_at_100%_100%,rgba(225,29,72,0.1),transparent_46%),linear-gradient(145deg,rgba(48,30,20,0.96),rgba(31,19,20,0.98)_55%,rgba(24,14,16,0.98))] px-5 py-5 text-center shadow-[0_24px_70px_-38px_rgba(245,158,11,0.52),inset_0_1px_0_rgba(255,229,160,0.12)] sm:px-10 sm:py-9"
    >
      <div className="pointer-events-none absolute inset-2 rounded-[1.6rem] border border-white/[0.035]" />
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/75 to-transparent" />

      <motion.div
        animate={{ y: [0, -5, 0], rotate: [0, 2, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 mx-auto mb-3 w-fit sm:mb-5"
      >
        <Avatar
          avatar={winner.emoji}
          color={winner.color}
          size={80}
          emojiSize="text-5xl"
          ring={false}
        />
        <span className="absolute -bottom-1 -right-2 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-lg sm:h-10 sm:w-10">
          <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
      </motion.div>

      <p className="relative z-10 whitespace-nowrap font-display text-xs font-bold uppercase tracking-[0.2em] text-amber-200/75 sm:text-sm sm:tracking-[0.28em]">
        Le champion ultime
      </p>
      <h1 className="relative z-10 mt-1 break-words font-display text-3xl font-black leading-tight text-gold-gradient drop-shadow-lg sm:mt-2 sm:text-5xl">
        {winner.name}
      </h1>
      <p className="relative z-10 mt-2 hidden text-xs text-muted-foreground sm:mt-4 sm:block sm:text-sm">
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
        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-[0.16em] text-foreground/85">
          <Trophy className="h-5 w-5 text-amber-300" />
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
              className={`relative flex min-h-[4.25rem] items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-2.5 shadow-sm transition-colors sm:min-h-[4.5rem] sm:gap-4 sm:px-4 sm:py-2.5 ${
                isWinner
                  ? "border-amber-300/45 bg-gradient-to-r from-amber-400/[0.14] via-rose-400/[0.07] to-card/65 shadow-[0_8px_28px_-20px_rgba(251,191,36,0.65)]"
                  : "border-white/[0.08] bg-card/45 hover:bg-card/65"
              }`}
            >
              {isWinner && (
                <div className="pointer-events-none absolute inset-y-2 left-0 w-1 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-rose-400" />
              )}
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-lg font-black ${
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
                size={48}
                emojiSize="text-3xl"
                className="ring-2 ring-white/15"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className={`truncate font-display text-lg font-bold sm:text-lg ${disconnected ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {player.name}
                </p>
                {isWinner && !disconnected && (
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                    Champion
                  </span>
                )}
                {disconnected && (
                  <span className="text-sm font-semibold text-rose-300">A quitté le salon</span>
                )}
              </div>
              <span className={`shrink-0 font-display text-2xl font-black tabular-nums sm:text-2xl ${isWinner ? "text-amber-100" : "text-foreground/90"}`}>
                {player.score}
                <span className="ml-1 text-sm font-semibold text-muted-foreground sm:text-sm">pts</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
