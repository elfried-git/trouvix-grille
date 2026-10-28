"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

/**
 * 22 background images cycling 1 per day based on date:
 * - 5 initial user images (bricks, door, globe, dice, barcelona)
 * - 5 added user images (eiffel, liberty, plane, skyline, star)
 * - 4 latest added user images (headphones, eyes, mosque, boat)
 * - 5 premium chic images (lion, cybercity, dragon, samurai, phoenix)
 * - 3 football-themed images (football arena, world cup trophy, fire flower)
 */
const IMAGES = [
  "/images/backgrounds/bg-fire-flower.jpg",
  "/images/backgrounds/bg-worldcup.jpg",
  "/images/backgrounds/bg-football-arena.jpg",
  "/images/backgrounds/bg-lion.jpg",
  "/images/backgrounds/bg-galaxy_phoenix.jpg",
  "/images/backgrounds/bg-cybercity.jpg",
  "/images/backgrounds/bg-samurai.jpg",
  "/images/backgrounds/bg-dragon.jpg",
  "/images/backgrounds/bg-eiffel.png",
  "/images/backgrounds/bg-boat.png",
  "/images/backgrounds/bg-star.png",
  "/images/backgrounds/bg-skyline.png",
  "/images/backgrounds/bg-mosque.png",
  "/images/backgrounds/bg-liberty.png",
  "/images/backgrounds/bg-plane.png",
  "/images/backgrounds/bg-headphones.png",
  "/images/backgrounds/bg-globe.png",
  "/images/backgrounds/bg-dice.png",
  "/images/backgrounds/bg-barcelona.png",
  "/images/backgrounds/bg-door.png",
  "/images/backgrounds/bg-bricks.png",
  "/images/backgrounds/bg-eyes.png",
];

// Map bg-galaxy_phoenix if copied as bg-phoenix
const RESOLVED_IMAGES = IMAGES.map((src) =>
  src === "/images/backgrounds/bg-galaxy_phoenix.jpg" ? "/images/backgrounds/bg-phoenix.jpg" : src
);

/**
 * Calculates current image index based on days elapsed since epoch.
 * Changes automatically every 24 hours at midnight.
 */
function getDailyImageIndex(): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const dayNumber = Math.floor(Date.now() / msPerDay);
  return Math.abs(dayNumber) % RESOLVED_IMAGES.length;
}

export function BackgroundSlideshow() {
  const [imageIndex, setImageIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setImageIndex(getDailyImageIndex());
    setMounted(true);

    // Check once an hour if the day has turned
    const interval = setInterval(() => {
      setImageIndex(getDailyImageIndex());
    }, 1000 * 60 * 60);

    return () => clearInterval(interval);
  }, []);

  const currentImage = RESOLVED_IMAGES[imageIndex] ?? RESOLVED_IMAGES[0];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden"
    >
      {/* Background image container - sharp, vivid, elegant slow pan without jarring zoom */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transform: "scale(1.02)",
        }}
      >
        <Image
          src={currentImage}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover saturate-[1.35] contrast-[1.12] brightness-[0.88]"
        />
      </div>

      {/* 
        Balanced gradient protection overlay:
        - Keeps background image colors rich, vibrant & vivid
        - Protects readability of foreground texts, buttons, and cards
        - Transparent center allows pure artwork visibility
      */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            // Soft vignette on boundaries to frame the screen gracefully
            "radial-gradient(ellipse 95% 85% at 50% 40%, rgba(12, 7, 15, 0.40) 0%, rgba(8, 4, 10, 0.78) 100%)",
            // Subtle darkening on top (status/nav) and bottom (buttons/footer)
            "linear-gradient(to bottom, rgba(10, 5, 12, 0.75) 0%, rgba(10, 5, 12, 0.20) 25%, rgba(10, 5, 12, 0.25) 70%, rgba(8, 4, 10, 0.85) 100%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
