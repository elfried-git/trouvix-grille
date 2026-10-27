"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Background images that cycle with a smooth Ken-Burns-like zoom + fade effect.
 * They are rendered with very low opacity so they never compete with the
 * foreground content (buttons, text, cards). A dark gradient overlay further
 * tones them down.
 *
 * Because globals.css has `animation: none !important`, we drive the
 * slideshow with JS intervals + inline styles instead of CSS keyframes.
 */

const IMAGES = [
  "/images/backgrounds/bg-bricks.png",
  "/images/backgrounds/bg-eiffel.png",
  "/images/backgrounds/bg-door.png",
  "/images/backgrounds/bg-liberty.png",
  "/images/backgrounds/bg-globe.png",
  "/images/backgrounds/bg-plane.png",
  "/images/backgrounds/bg-dice.png",
  "/images/backgrounds/bg-skyline.png",
  "/images/backgrounds/bg-barcelona.png",
  "/images/backgrounds/bg-star.png",
];

/** How long each image stays visible (ms). */
const DISPLAY_DURATION = 5_000;
/** Cross-fade duration (ms). */
const FADE_DURATION = 1_500;
/** Subtle zoom growth per slide (adds dynamism). */
const SCALE_FROM = 1.0;
const SCALE_TO = 1.08;
/** Maximum opacity for the background images — vivid but not overwhelming. */
const MAX_OPACITY = 0.40;

export function BackgroundSlideshow() {
  const [slide, setSlide] = useState({
    current: 0,
    next: 1,
    /** 0 = only current visible, 1 = fully transitioned to next. */
    fade: 0,
    phase: "display" as "display" | "fading",
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timerId: ReturnType<typeof setTimeout>;
    let animFrame: number;

    // Mutable indices so the closure always sees the latest values
    let cur = 0;
    let nxt = 1;

    function startDisplay() {
      if (!mountedRef.current) return;
      setSlide({ current: cur, next: nxt, fade: 0, phase: "display" });
      timerId = setTimeout(startFade, DISPLAY_DURATION);
    }

    function startFade() {
      if (!mountedRef.current) return;
      const t0 = performance.now();

      function tick(now: number) {
        if (!mountedRef.current) return;
        const t = Math.min((now - t0) / FADE_DURATION, 1);
        setSlide({ current: cur, next: nxt, fade: t, phase: "fading" });

        if (t < 1) {
          animFrame = requestAnimationFrame(tick);
        } else {
          // Swap: next becomes current
          cur = nxt;
          nxt = (nxt + 1) % IMAGES.length;
          startDisplay();
        }
      }

      animFrame = requestAnimationFrame(tick);
    }

    startDisplay();

    return () => {
      mountedRef.current = false;
      clearTimeout(timerId);
      cancelAnimationFrame(animFrame);
    };
  }, []);

  const { current, next, fade, phase } = slide;

  const currentScale =
    phase === "fading"
      ? SCALE_TO
      : SCALE_FROM + (SCALE_TO - SCALE_FROM) * 0.5;
  const nextScale = SCALE_FROM + (SCALE_TO - SCALE_FROM) * fade;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden"
    >
      {/* Current image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: MAX_OPACITY * (1 - fade),
          transform: `scale(${currentScale})`,
          willChange: "opacity, transform",
        }}
      >
        <Image
          src={IMAGES[current]}
          alt=""
          fill
          sizes="100vw"
          className="object-cover saturate-[1.5] contrast-[1.15] brightness-[1.15]"
          priority={current === 0}
        />
      </div>

      {/* Next image (fading in) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: MAX_OPACITY * fade,
          transform: `scale(${nextScale})`,
          willChange: "opacity, transform",
        }}
      >
        <Image
          src={IMAGES[next]}
          alt=""
          fill
          sizes="100vw"
          className="object-cover saturate-[1.5] contrast-[1.15] brightness-[1.15]"
        />
      </div>

      {/* Subtle vignette overlay — light enough to let colors pop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            "radial-gradient(ellipse 90% 70% at 50% 40%, transparent 0%, rgba(0,0,0,0.45) 100%)",
            "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, transparent 25%, transparent 75%, rgba(0,0,0,0.35) 100%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
