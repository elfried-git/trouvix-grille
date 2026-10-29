"use client";

import { useEffect, useMemo, useState } from "react";

// Loader de fêtes : neige, cadeau qui tremble, messages du Père Noël et prénoms qui défilent.
// Affiché pendant le suspens du tirage, sans carte ni popin.
const MESSAGES = [
  "Le Père Noël vérifie sa liste deux fois…",
  "Les lutins mélangent les chapeaux…",
  "Rudolph chauffe le traîneau…",
  "Les rennes font la queue devant le sapin…",
  "Chut, les cadeaux se cachent…",
  "Encore quelques flocons et c'est prêt !",
];

const MESSAGE_MS = 950;
const NAME_MS = 110;

const SNOW = Array.from({ length: 40 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: -((i * 0.73) % 6),
  duration: 5 + ((i * 7) % 5),
  size: 6 + ((i * 3) % 9),
  opacity: 0.35 + ((i * 11) % 6) / 10,
}));

const STYLES = `
@keyframes gl-fall { from { transform: translate3d(0, -10vh, 0); } to { transform: translate3d(12px, 115vh, 0); } }
@keyframes gl-wiggle { 0%, 100% { transform: rotate(0deg); } 20% { transform: rotate(-9deg); } 40% { transform: rotate(8deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(5deg); } }
@keyframes gl-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
@keyframes gl-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes gl-pop { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
@keyframes gl-twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
@media (prefers-reduced-motion: reduce) { .gl-anim { animation: none !important; } }
`;

export function GiftLoader({ names, durationMs = 3800 }: { names: string[]; durationMs?: number }) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState(0);

  useEffect(() => {
    const nameTimer = window.setInterval(() => setStep((s) => s + 1), NAME_MS);
    const messageTimer = window.setInterval(() => setMessage((m) => m + 1), MESSAGE_MS);
    return () => {
      window.clearInterval(nameTimer);
      window.clearInterval(messageTimer);
    };
  }, []);

  const currentName = names.length ? names[step % names.length] : "";
  const flakes = useMemo(() => SNOW, []);

  return (
    <section
      role="status"
      aria-live="polite"
      className="relative flex min-h-[62vh] w-full flex-col items-center justify-center overflow-hidden px-4 py-12 text-center"
    >
      <style>{STYLES}</style>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0">
        {flakes.map((flake, i) => (
          <span
            key={i}
            className="gl-anim absolute top-0 rounded-full bg-white"
            style={{
              left: `${flake.left}%`,
              width: flake.size,
              height: flake.size,
              opacity: flake.opacity,
              animation: `gl-fall ${flake.duration}s linear ${flake.delay}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-emerald-200/80">Tirage en cours</p>

        {/* Cadeau qui tremble et qui se balance */}
        <div className="gl-anim relative h-28 w-28" style={{ animation: "gl-bob 1.6s ease-in-out infinite" }}>
          <div
            className="gl-anim absolute inset-0 origin-bottom"
            style={{ animation: "gl-wiggle 1.4s ease-in-out infinite" }}
          >
            <div className="absolute bottom-0 left-1/2 h-[68%] w-[78%] -translate-x-1/2 rounded-b-xl bg-gradient-to-br from-red-500 to-red-700 shadow-[inset_-6px_0_0_rgba(0,0,0,0.15)]">
              <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-yellow-300" />
            </div>
            <div className="absolute left-1/2 top-[26%] h-[18%] w-[92%] -translate-x-1/2 rounded-md bg-gradient-to-br from-red-400 to-red-600">
              <div className="absolute inset-y-0 left-1/2 w-3 -translate-x-1/2 bg-yellow-300" />
            </div>
            <div className="absolute left-1/2 top-[14%] h-7 w-7 -translate-x-1/2 rounded-full border-[5px] border-yellow-300" />
          </div>
          <span
            aria-hidden="true"
            className="gl-anim absolute -right-2 -top-2 text-2xl text-yellow-200"
            style={{ animation: "gl-twinkle 1.2s ease-in-out infinite" }}
          >
            ✦
          </span>
          <span
            aria-hidden="true"
            className="gl-anim absolute -left-3 top-6 text-lg text-yellow-200"
            style={{ animation: "gl-twinkle 1.6s ease-in-out 0.4s infinite" }}
          >
            ✦
          </span>
        </div>

        <h2 className="font-display text-2xl font-black text-yellow-200 sm:text-3xl">
          La magie de Noël opère…
        </h2>

        <p
          key={message}
          className="gl-anim min-h-[2.75em] max-w-sm text-base font-medium text-white/85"
          style={{ animation: "gl-pop 0.45s ease-out both" }}
        >
          {MESSAGES[message % MESSAGES.length]}
        </p>

        <p
          key={`name-${step % Math.max(names.length, 1)}`}
          className="min-h-[1.4em] font-display text-3xl font-black text-white drop-shadow-[0_2px_10px_rgba(22,163,74,0.7)] sm:text-4xl"
        >
          {currentName}
        </p>

        {/* Barre façon canne en sucre, qui se remplit pendant le suspens */}
        <div className="h-4 w-full max-w-xs overflow-hidden rounded-full border border-white/20 bg-white/10">
          <div
            className="gl-anim h-full origin-left rounded-full bg-[repeating-linear-gradient(45deg,#dc2626_0_10px,#ffffff_10px_20px)]"
            style={{ animation: `gl-fill ${durationMs}ms linear both` }}
          />
        </div>
      </div>
    </section>
  );
}
