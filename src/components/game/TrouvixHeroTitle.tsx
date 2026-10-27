"use client";

/**
 * TrouvixHeroTitle - Style Pro, Propre et Moderne en Jaune & Rouge :
 * - Typographie majuscule contemporaine, géométrique et percutante
 * - Découpage élégant de la marque : "TROUV" (Rouge Rubis dégradé) & "IX" (Or/Jaune Impérial dégradé)
 * - Légère ombre portée portée nette et professionnelle (effet studio)
 * - Badge épuré et minimaliste "LE JEU DU CARRÉ" pour parfaire la signature officielle
 */
export function TrouvixHeroTitle() {
  return (
    <div className="relative flex flex-col items-center justify-center select-none py-2">
      {/* Titre Trouvix Principal */}
      <h1
        className="trouvix-pro-title relative flex items-baseline tracking-tight font-black uppercase text-6xl sm:text-7xl md:text-8xl select-none"
        aria-label="Trouvix"
      >
        <span className="trouvix-pro-red">Tr</span>
        <span className="trouvix-pro-yellow">ouv</span>
        <span className="trouvix-pro-red">ix</span>
      </h1>

      {/* Sous-titre épuré & pro */}
      <div className="mt-2 flex items-center gap-2">
        <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-amber-400/60" />
        <span className="text-[11px] font-semibold tracking-[0.25em] uppercase text-amber-200/80 sm:text-xs">
          Le Jeu du Carré
        </span>
        <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-amber-400/60" />
      </div>
    </div>
  );
}
