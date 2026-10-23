"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { Timer, Square, Users, Grid3x3, Trophy, Dices, Pause, Globe, Star, Bell } from "lucide-react";
import { TutorialVideoScreen } from "./TutorialVideoScreen";
import { ReviewForm } from "./ReviewForm";
import { enableNotifications } from "@/lib/admin-notifications";
import { toast } from "sonner";

const FEATURES = [
  { icon: Square, label: "Forme un carré 2×2", desc: "4 pions en bloc", color: "text-rose-300" },
  { icon: Grid3x3, label: "Placement libre", desc: "Pose où tu veux", color: "text-amber-300" },
  { icon: Timer, label: "10 s / coup", desc: "Joue vite ou perds la main", color: "text-emerald-300" },
  { icon: Pause, label: "Pause à tout moment", desc: "Chrono gelé", color: "text-fuchsia-300" },
  { icon: Users, label: "2 à 6 joueurs", desc: "Couleurs au choix", color: "text-lime-300" },
  { icon: Trophy, label: "Champion Ultime", desc: "Meilleur score gagne", color: "text-sky-300" },
];

const FLOAT_ICONS = ["🟥", "🟨", "🟦", "⏱️", "🎯", "🏆", "⬜", "✨"];

export function HomeScreen() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const goToSetup = useGameStore((s) => s.goToSetup);
  const goToOnlineSetup = useGameStore((s) => s.goToOnlineSetup);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  const handleEnableNotifications = async () => {
    const permission = await enableNotifications();
    setNotificationPermission(permission);
    if (permission === "granted") toast.success("Notifications activées pour les nouveaux salons.");
    else if (permission === "denied") toast.error("Autorise les notifications de Trouvix dans les réglages du téléphone.");
    else toast.error("Les notifications ne sont pas disponibles dans ce navigateur.");
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-4 pb-16 pt-10">
      {/* Floating icons */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl opacity-20"
            style={{ left: `${10 + i * 11}%`, bottom: "-40px" }}
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -800, opacity: [0, 0.4, 0] }}
            transition={{ duration: 10 + i * 2, repeat: Infinity, delay: i * 1.5 }}
          >
            {FLOAT_ICONS[i]}
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        {/* Logo Trouvix */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.7, type: "spring", stiffness: 120 }}
          className="mb-4"
        >
          <img
            src="/trouvix-logo.svg"
            alt="Logo Trouvix Grille"
            width={96}
            height={96}
            className="h-24 w-24 drop-shadow-[0_8px_24px_-6px_oklch(0.60_0.215_25/0.5)] sm:h-[88px] sm:w-[88px]"
          />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.28, rotate: 3 }}
          animate={{ opacity: 1, scale: [0.28, 1.18, 1], rotate: -1 }}
          transition={{ duration: 1.15, delay: 0.12, times: [0, 0.72, 1], ease: [0.16, 1, 0.3, 1] }}
          className="trouvix-wordmark text-6xl sm:text-7xl md:text-8xl"
          aria-label="Trouvix"
        >
          <span className="trouvix-wordmark-red">Trouv</span>
          <span className="trouvix-wordmark-gold">ix</span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
            <Button
              onClick={handleEnableNotifications}
              variant="outline"
              size="sm"
              className="h-10 gap-2 rounded-full border-sky-300/40 bg-sky-500/10 px-4 text-sky-100 hover:bg-sky-500/20"
            >
              <Bell className="h-4 w-4" /> Activer les notifications
            </Button>
          )}
          <Button
            onClick={goToSetup}
            size="lg"
            className="h-14 w-full rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-8 text-base font-semibold text-white shadow-[0_8px_30px_-6px_oklch(0.60_0.215_25/0.6)] transition hover:from-rose-500 hover:to-rose-400 hover:shadow-[0_8px_36px_-4px_oklch(0.60_0.215_25/0.8)] sm:w-auto"
          >
            <Dices className="mr-2 h-5 w-5" />
            Jouer en local
          </Button>
          <Button
            onClick={goToOnlineSetup}
            size="lg"
            variant="outline"
            className="h-14 w-full rounded-full border-amber-400/50 bg-amber-500/10 px-8 text-base font-semibold text-amber-200 transition hover:bg-amber-500/20 sm:w-auto"
          >
            <Globe className="mr-2 h-5 w-5" />
            Jouer en ligne
          </Button>
        </motion.div>

        {/* Features grid */}
        <div className="mt-14 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.08 }}
              className="glass-card flex flex-col items-center gap-2 rounded-2xl p-5 text-center sm:p-4"
            >
              <f.icon className={`h-10 w-10 ${f.color}`} />
              <p className="font-display text-base font-semibold">{f.label}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2 text-base"><Grid3x3 className="h-5 w-5 text-rose-300" /> Grille 10×10</span>
          <span className="flex items-center gap-2 text-base"><Timer className="h-5 w-5 text-amber-300" /> 10s par coup</span>
          <span className="flex items-center gap-2 text-base"><Users className="h-5 w-5 text-amber-300" /> 2 à 6 joueurs</span>
        </div>

        {/* Rubrique avis / suggestions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <Button
            onClick={() => setReviewOpen(true)}
            variant="outline"
            size="sm"
            className="review-button-blink group h-11 gap-2 rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 px-5 font-bold text-[#27120b] shadow-lg transition hover:-translate-y-0.5 hover:brightness-110"
          >
            <Star className="h-4 w-4 fill-current transition-transform group-hover:rotate-12 group-hover:scale-110" /> Votre avis
          </Button>
                </motion.div>
              </motion.div>

              {/* Démo — hors du conteneur centré, sinon poussée hors écran et coupée */}
              <div className="mt-16 w-full">
                <div className="mb-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                  <h2 className="font-display text-2xl font-black tracking-wide">
                    <span className="text-red-gradient">Démo</span>
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                </div>
                <TutorialVideoScreen />
              </div>
            <ReviewForm open={reviewOpen} onOpenChange={setReviewOpen} />
          </div>
          );
        }
