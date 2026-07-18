const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'src', 'components', 'game', 'WinnerScreen.tsx');
const content = `"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGameStore } from "@/store/game-store";
import { Avatar } from "./Avatar";
import { Crown, RotateCcw, Home, Swords } from "lucide-react";

export function WinnerScreen() {
  const players = useGameStore((s) => s.players);
  const restart = useGameStore((s) => s.restart);
  const backHome = useGameStore((s) => s.backHome);
  const rematchTied = useGameStore((s) => s.rematchTied);
  const statusMessage = useGameStore((s) => s.statusMessage);

  const ranked = [...players].sort((a, b) => b.score - a.score);
  const maxScore = ranked.length > 0 ? ranked[0].score : 0;
  const tiedPlayers = ranked.filter((p) => p.score === maxScore);
  const isTie = tiedPlayers.length > 1;
  const winner = !isTie ? ranked[0] : null;

  if (ranked.length === 0) return null;

  if (isTie) {
    return (
      <Dialog open={true}>
        <DialogContent
          showCloseButton={false}
          className="max-w-4xl rounded-[2rem] border-4 border-violet-400/50 bg-violet-950/95 p-8 shadow-[0_0_120px_-20px_rgba(79,70,229,0.55)]"
        >
          <DialogHeader className="text-center">
            <DialogTitle className="text-5xl font-black uppercase tracking-[0.25em] text-violet-200">
              Fin du match
            </DialogTitle>
            <DialogDescription className="mt-4 text-lg leading-8 text-violet-100/90">
              {statusMessage || "Le match est termine. Voici le resultat final."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-10 space-y-8">
            <div className="rounded-3xl border border-violet-400/30 bg-violet-950/80 p-6 text-left shadow-xl">
              <h2 className="mb-3 text-xl font-semibold text-violet-100">Egalite parfaite</h2>
              <p className="text-sm leading-7 text-violet-200/80">
                {tiedPlayers.length} joueurs sont a egalite. Un challenge decisif va les departager.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-violet-400/20 bg-violet-950/80 p-5 shadow-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-violet-300/90">En lice pour le challenge</p>
                <div className="mt-4 space-y-3">
                  {tiedPlayers.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-violet-500/30 bg-violet-900/60 p-3">
                      <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                      <div>
                        <p className="font-semibold text-violet-100">{p.name}</p>
                        <p className="text-sm text-violet-300">{p.score} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-violet-400/20 bg-violet-950/80 p-5 shadow-xl">
                <p className="text-xs uppercase tracking-[0.3em] text-violet-300/90">Elimines</p>
                <div className="mt-4 space-y-3">
                  {ranked.filter((p) => p.score < maxScore).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-violet-500/20 bg-violet-900/60 p-3 opacity-60">
                      <Avatar avatar={p.emoji} color={p.color} size={36} emojiSize="text-lg" />
                      <div>
                        <p className="font-medium line-through text-violet-300">{p.name}</p>
                        <p className="text-sm text-violet-400">{p.score} pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={rematchTied} size="lg" className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400">
              <Swords className="mr-2 h-5 w-5" /> Lancer le challenge decisif
            </Button>
            <Button onClick={backHome} size="lg" variant="outline">
              <Home className="mr-2 h-5 w-5" /> Accueil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl rounded-[2rem] border-4 border-amber-400/50 bg-slate-950/95 p-8 shadow-[0_0_120px_-20px_rgba(245,158,11,0.45)]"
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-5xl font-black uppercase tracking-[0.25em] text-amber-200">Fin du match</DialogTitle>
          <DialogDescription className="mt-4 text-lg leading-8 text-amber-100/90">{statusMessage || "Le match est termine. Voici le classement final."}</DialogDescription>
        </DialogHeader>

        <div className="mt-10 flex flex-col items-center gap-10">
          <div className="relative w-full">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-[0_0_60px_-20px_rgba(245,158,11,0.7)] sm:h-28 sm:w-28">
              <Avatar avatar={winner!.emoji} color={winner!.color} size={96} emojiSize="text-5xl" ring={true} className="ring-8 ring-white/20" />
            </div>
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3">
                <h1 className="font-display text-4xl sm:text-5xl font-black text-gold-gradient drop-shadow-lg">{winner!.name}</h1>
                <span className="rounded-full bg-amber-400/20 px-3 py-1 text-sm font-semibold text-amber-100">Champion</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-amber-200">
                <Crown className="h-6 w-6 text-amber-300 drop-shadow" />
                <span className="text-lg font-bold">{winner!.score} pts</span>
              </div>
            </div>
          </div>

          <div className="w-full rounded-3xl border border-amber-500/20 bg-slate-950/70 p-6 shadow-xl">
            <div className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-200/80">Classement</p>
              <div className="mt-4 space-y-3">
                {ranked.map((p, i) => (
                  <div key={p.id} className={`flex items-center gap-3 rounded-2xl border p-4 sm:p-3 ${p.id === winner!.id ? "border-amber-400/60 bg-gradient-to-br from-amber-500/10 to-rose-500/5 shadow-lg" : "border-border/50 bg-card/40"}`}>
                    <span className="w-6 text-center font-display text-lg font-bold text-amber-200">{i + 1}</span>
                    {p.id === winner!.id ? (
                      <div className="flex items-center gap-3">
                        <Avatar avatar={p.emoji} color={p.color} size={64} emojiSize="text-3xl" />
                        <div>
                          <span className="flex-1 text-left font-bold text-amber-100 text-lg">{p.name}</span>
                          <div className="mt-1 text-sm text-amber-200/90 font-display font-black">{p.score} pts</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Avatar avatar={p.emoji} color={p.color} size={44} emojiSize="text-xl" />
                        <span className="flex-1 text-left font-medium">{p.name}</span>
                        <span className="font-display text-2xl font-bold sm:text-xl">{p.score} pts</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={restart} size="lg" className="bg-gradient-to-r from-rose-600 to-rose-500 text-white hover:from-rose-500 hover:to-rose-400">
              <RotateCcw className="mr-2 h-5 w-5" /> Rejouer
            </Button>
            <Button onClick={backHome} size="lg" variant="outline">
              <Home className="mr-2 h-5 w-5" /> Accueil
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
'