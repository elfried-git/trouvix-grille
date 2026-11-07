"use client";

import { useEffect } from "react";

/**
 * DomProtection : Composant de sécurité défensive côté client.
 * Protège le code, le DOM et les requêtes contre l'inspection :
 * 1. Désactive le clic droit (menu contextuel / "Inspecter l'élément")
 * 2. Bloque les raccourcis d'ouverture des DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, etc.)
 * 3. Neutralise les sorties console en production pour éviter la fuite de données
 * 4. Affiche un avertissement de sécurité dissuasif dans la console
 * 5. Détecte l'ouverture des outils de développement et nettoie la console
 */
export function DomProtection() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Désactiver le menu contextuel (clic droit -> Inspecter)
    const handleContextMenu = (e: MouseEvent) => {
      // Bloque le menu contextuel partout pour empêcher "Inspecter"
      e.preventDefault();
      return false;
    };

    // 2. Intercepter les touches raccourcis DevTools et code source
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === "F12" || e.keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      const isModifier = e.ctrlKey || e.metaKey;

      if (isModifier) {
        const key = e.key.toLowerCase();

        // Ctrl/Cmd + Shift + I (Inspecteur DevTools)
        // Ctrl/Cmd + Shift + J (Console)
        // Ctrl/Cmd + Shift + C (Sélecteur d'élément DOM)
        // Ctrl/Cmd + Shift + K (Console Firefox)
        if (e.shiftKey && (key === "i" || key === "j" || key === "c" || key === "k")) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }

        // Ctrl/Cmd + U (Afficher le code source)
        // Ctrl/Cmd + S (Enregistrer la page)
        if (key === "u" || key === "s") {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }
    };

    // 3. Bannière de sécurité et neutralisation des logs sensibles en production
    const isProd = process.env.NODE_ENV === "production";

    const bannerShownKey = "__trouvix_security_banner__";
    if (!(window as unknown as Record<string, boolean>)[bannerShownKey]) {
      (window as unknown as Record<string, boolean>)[bannerShownKey] = true;
      try {
        console.log(
          "%c⛔ ACCÈS RESTREINT & SÉCURISÉ",
          "color: #ef4444; font-size: 26px; font-weight: 900; background: #18181b; padding: 6px 12px; border-radius: 6px;"
        );
        console.log(
          "%cCe site est protégé contre l'inspection du DOM, le vol de requêtes et l'ingénierie inverse. Aucune information confidentielle n'est exposée.",
          "color: #f59e0b; font-size: 13px; font-weight: 600; padding: 4px;"
        );
      } catch {
        // En cas d'environnement restreint
      }
    }

    if (isProd) {
      // En production, masquer les logs informatifs pour éviter toute fuite d'état interne
      try {
        console.log = () => { };
        console.info = () => { };
        console.debug = () => { };
        console.dir = () => { };
        console.table = () => { };
      } catch {
        // Ignoré
      }
    }

    // 4. Détecteur de DevTools (différence de taille fenêtre / viewport)
    let resizeTimer: number;
    const checkDevTools = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > 160 || heightDiff > 160) {
        if (isProd) {
          try {
            console.clear();
          } catch { }
        }
      }
    };

    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(checkDevTools, 200);
    };

    // Attacher les écouteurs
    document.addEventListener("contextmenu", handleContextMenu, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("resize", handleResize);
      window.clearTimeout(resizeTimer);
    };
  }, []);

  return null;
}
