 "use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

/**
 * Luxury cinematic background slideshow with a seamless Ken-Burns effect.
 *
 * Key design principles:
 * 1. Continuous, unbroken motion: an image gently drifts throughout its whole
 *    lifecycle without freezing or jumping abruptly.
 * 2. Long, velvet cross-fades: 2.4s transition where the outgoing and incoming
 *    images seamlessly melt into each other.
 * 3. Soft atmospheric grading: low opacity + dark vignette veil + subtle bokeh blur
 *    so the Trouvix brand, gold accents, and game buttons pop with crystal clarity.
 */

const IMAGES = [
  "/images/backgrounds/bg-star.png",
  "/images/backgrounds/bg-skyline.png",
  "/images/backgrounds/bg-eiffel.png",
  "/images/backgrounds/bg-dice.png",
  "/images/backgrounds/bg-globe.png",
  "/images/backgrounds/bg-barcelona.png",
  "/images/backgrounds/bg-boat.png",
  "/images/backgrounds/bg-plane.png",
  "/images/backgrounds/bg-liberty.png",
  "/images/backgrounds/bg-door.png",
  "/images/backgrounds/bg-bricks.png",
];

/** Subtle, alternating cinematic camera motions for each slide. */
const MOTIONS = [
  // 0: Soft zoom-in towards center
  {
    from: "scale(1.00) translate3d(0, 0, 0)",
    to: "scale(1.08) translate3d(0, -1.2%, 0)",
  },
  // 1: Gentle zoom-out with subtle leftward drift
  {
    from: "scale(1.08) translate3d(1.2%, 0.8%, 0)",
    to: "scale(1.02) translate3d(-0.8%, -0.4%, 0)",
  },
  // 2: Warm zoom-in with slight rightward pan
  {
    from: "scale(1.01) translate3d(-1.2%, 0.6%, 0)",
    to: "scale(1.09) translate3d(0.8%, -0.8%, 0)",
  },
  // 3: Elegant slow zoom-out
  {
    from: "scale(1.07) translate3d(0, -0.8%, 0)",
    to: "scale(1.01) translate3d(0, 0.6%, 0)",
  },
];

/** Time each slide stays as the primary active slide (ms). */
const SLIDE_INTERVAL = 8_000;
/** Cross-dissolve fade duration (ms). */
const FADE_DURATION = 2_400;
/** Total duration of the camera motion per slide (ms). Slightly longer than interval + fade for unbroken momentum. */
const MOTION_DURATION = SLIDE_INTERVAL + FADE_DURATION + 1_000;
/** Maximum opacity of the imagery — subtle atmospheric depth. */
const MAX_OPACITY = 0.28;

interface SlideSlot {
  imageIndex: number;
  motionIndex: number;
  /** True when the slide is visible (opacity > 0) */
  visible: boolean;
  /** True when the Ken-Burns zoom/pan has started */
  moving: boolean;
  /** Monotonic key to force a clean re-mount when recycling this slot */
  key: number;
}

export function BackgroundSlideshow() {
  const [slotA, setSlotA] = useState<SlideSlot>({
    imageIndex: 0,
    motionIndex: 0,
    visible: true,
    moving: false,
    key: 0,
  });

  const [slotB, setSlotB] = useState<SlideSlot>({
    imageIndex: 1,
    motionIndex: 1,
    visible: false,
    moving: false,
    key: 1,
  });

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let nextImageIndex = 2;
    let nextMotionIndex = 2;
    let activeSlot: "A" | "B" = "A";

    // Trigger initial motion for Slot A on the very next paint
    const initialFrame = requestAnimationFrame(() => {
      if (!mountedRef.current) return;
      setSlotA((s) => ({ ...s, moving: true }));
    });

    const intervalId = window.setInterval(() => {
      if (!mountedRef.current) return;

      const currentNextImg = nextImageIndex % IMAGES.length;
      const currentNextMotion = nextMotionIndex % MOTIONS.length;
      nextImageIndex++;
      nextMotionIndex++;

      if (activeSlot === "A") {
        // Transition from A -> B:
        // 1. Prepare slot B with new image, start position and visible
        setSlotB((prev) => ({
          imageIndex: currentNextImg,
          motionIndex: currentNextMotion,
          visible: true,
          moving: false,
          key: prev.key + 2,
        }));

        // Next frame: kick off B's motion and start fading A out
        requestAnimationFrame(() => {
          if (!mountedRef.current) return;
          setSlotB((prev) => ({ ...prev, moving: true }));
          setSlotA((prev) => ({ ...prev, visible: false }));
        });

        activeSlot = "B";
      } else {
        // Transition from B -> A:
        // 1. Prepare slot A with new image, start position and visible
        setSlotA((prev) => ({
          imageIndex: currentNextImg,
          motionIndex: currentNextMotion,
          visible: true,
          moving: false,
          key: prev.key + 2,
        }));

        // Next frame: kick off A's motion and start fading B out
        requestAnimationFrame(() => {
          if (!mountedRef.current) return;
          setSlotA((prev) => ({ ...prev, moving: true }));
          setSlotB((prev) => ({ ...prev, visible: false }));
        });

        activeSlot = "A";
      }
    }, SLIDE_INTERVAL);

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(initialFrame);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden"
    >
      {/* Slide Slot A */}
      <SlideLayer slot={slotA} priority={slotA.imageIndex === 0} />

      {/* Slide Slot B */}
      <SlideLayer slot={slotB} priority={false} />

      {/* Luxury atmospheric veil: Soft vignette + vertical mood gradient + micro-blur */}
      <div
        className="absolute inset-0 backdrop-blur-[1.5px]"
        style={{
          background: [
            // Deep cinematic radial vignette: keeps the center luminous and edges velvety
            "radial-gradient(ellipse 90% 80% at 50% 42%, rgba(20, 13, 22, 0.58) 0%, rgba(10, 6, 12, 0.90) 100%)",
            // Soft vertical shading for header and bottom buttons
            "linear-gradient(to bottom, rgba(14, 8, 16, 0.85) 0%, rgba(14, 8, 16, 0.32) 22%, rgba(14, 8, 16, 0.45) 75%, rgba(10, 5, 12, 0.92) 100%)",
          ].join(", "),
        }}
      />
    </div>
  );
}

function SlideLayer({ slot, priority }: { slot: SlideSlot; priority: boolean }) {
  const motion = MOTIONS[slot.motionIndex % MOTIONS.length];

  return (
    <div
      key={slot.key}
      style={{
        position: "absolute",
        inset: 0,
        opacity: slot.visible ? MAX_OPACITY : 0,
        transform: slot.moving ? motion.to : motion.from,
        transitionProperty: "opacity, transform",
        transitionDuration: `${FADE_DURATION}ms, ${MOTION_DURATION}ms`,
        transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1), cubic-bezier(0.25, 1, 0.5, 1)",
        willChange: "opacity, transform",
      }}
    >
      <Image
        src={IMAGES[slot.imageIndex]}
        alt=""
        fill
        sizes="100vw"
        priority={priority}
        className="object-cover saturate-[1.2] contrast-[1.05] brightness-[0.92]"
      />
    </div>
  );
}
