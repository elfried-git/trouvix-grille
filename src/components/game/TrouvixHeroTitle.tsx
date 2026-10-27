"use client";

import Image from "next/image";

export function TrouvixHeroTitle() {
  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Logo officiel Trouvix Grille */}
      <div className="relative mb-3 flex items-center justify-center">
        <Image
          src="/trouvix-logo.svg"
          alt="Logo Trouvix Grille"
          width={120}
          height={120}
          priority
          className="h-24 w-24 sm:h-28 sm:w-28 drop-shadow-[0_10px_28px_-6px_oklch(0.60_0.215_25/0.7)]"
        />
      </div>

      {/* Titre Trouvix — Statique, sans animation ni clic */}
      <div className="relative flex flex-col items-center">
        <div className="relative inline-flex items-baseline">
          <h1
            className="trouvix-hero-wordmark text-6xl sm:text-7xl md:text-8xl select-none"
            aria-label="Trouvix"
          >
            <span className="trouvix-wordmark-red">
              Trouv
            </span>
            <span className="trouvix-wordmark-gold">
              ix
            </span>
          </h1>
        </div>
      </div>
    </div>
  );
}
