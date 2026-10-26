"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { Timer, Square, Users, Grid3x3, Trophy, MousePointerClick, Globe2, LockKeyhole, Bomb } from "lucide-react";
import { TutorialVideoScreen } from "./TutorialVideoScreen";
import { ReviewForm } from "./ReviewForm";
import { TrouvixHeroTitle } from "./TrouvixHeroTitle";
import { enableNotifications, prepareNotificationAudio } from "@/lib/admin-notifications";
import { toast } from "sonner";

const FEATURES = [
  { icon: Square, label: "Forme un carré 2×2", desc: "4 pions en bloc", color: "text-rose-300" },
  { icon: Grid3x3, label: "Placement libre", desc: "Pose où tu veux", color: "text-amber-300" },
  { icon: Timer, label: "10 s / coup", desc: "Joue vite ou perds la main", color: "text-emerald-300" },
  { icon: MousePointerClick, label: "Gérer la partie", desc: "Clique sur ton profil pour mettre la partie en pause. Clique sur le profil de ton adversaire pour quitter la partie.", color: "text-fuchsia-300" },
  { icon: Users, label: "2 à 6 joueurs", desc: "Couleurs au choix", color: "text-lime-300" },
  { icon: Trophy, label: "Champion Ultime", desc: "Meilleur score gagne", color: "text-sky-300" },
];

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
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        {/* Logo & Titre Trouvix avec effet Wow (Assemblage du carré magique & shimmer) */}
        <TrouvixHeroTitle />

        <div className="mt-8 flex w-full max-w-xl flex-col items-center gap-3 sm:w-auto">
          {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
            <Button
              onClick={handleEnableNotifications}
              variant="outline"
              size="sm"
              className="h-10 gap-2 rounded-full border-sky-300/40 bg-sky-500/10 px-4 text-sky-100 hover:bg-sky-500/20"
            >
              Activer les notifications
            </Button>
          )}
          <div className="grid w-full grid-cols-2 items-start gap-3 sm:w-auto sm:flex sm:items-start">
            <Button
              onClick={goToSetup}
              size="lg"
              className="h-14 w-full min-w-0 rounded-full bg-gradient-to-r from-rose-600 to-rose-500 px-3 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_oklch(0.60_0.215_25/0.6)] transition hover:from-rose-500 hover:to-rose-400 hover:shadow-[0_8px_36px_-4px_oklch(0.60_0.215_25/0.8)] sm:w-auto sm:px-8 sm:text-base"
            >
              Jouer en local
            </Button>
            <Button
              onClick={() => {
                prepareNotificationAudio();
                goToOnlineSetup();
              }}
              size="lg"
              variant="outline"
              className="h-14 w-full min-w-0 rounded-full border-amber-400/50 bg-amber-500/10 px-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 sm:w-auto sm:px-8 sm:text-base"
            >
              Jouer en ligne
            </Button>
          </div>
          <div className="col-span-2 grid w-full grid-cols-2 gap-3 sm:hidden">
            <span className="col-span-2 flex justify-center">
            <Button
              onClick={() => setReviewOpen(true)}
              variant="outline"
              size="sm"
              className="review-button-blink group h-11 w-full gap-2 rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 px-3 font-bold text-[#27120b] shadow-lg transition-[filter] hover:brightness-110"
            >
              Votre avis
            </Button>
            </span>
          </div>
          <Button
            onClick={() => setReviewOpen(true)}
            variant="outline"
            size="sm"
            className="review-button-blink group hidden h-11 gap-2 rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 px-5 font-bold text-[#27120b] shadow-lg transition-[filter] hover:brightness-110 sm:inline-flex"
          >
            Votre avis
          </Button>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.2 }}
          className="mt-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6"
        >
          <div className="glass-card flex flex-col items-center gap-2 rounded-2xl p-5 text-center sm:p-4">
            <Globe2 className="h-10 w-10 text-emerald-300" />
            <p className="font-display text-base font-semibold">Salon public</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Visible dans la liste, rejoignable par tous.
            </p>
          </div>
          <div className="glass-card flex flex-col items-center gap-2 rounded-2xl p-5 text-center sm:p-4">
            <LockKeyhole className="h-10 w-10 text-violet-300" />
            <p className="font-display text-base font-semibold">Salon privé</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Caché de la liste, accessible par code ou invitation.
            </p>
          </div>
        </motion.div>

        <div className="glass-card mt-3 flex w-full items-center gap-4 rounded-2xl p-4 text-left sm:p-5">
          <Bomb className="h-9 w-9 shrink-0 text-orange-300" />
          <div>
            <p className="font-display text-base font-semibold">Bombardement</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Dès 3 points, détruis les menaces adverses une fois par partie. Ton tour se termine.
            </p>
          </div>
        </div>

        {/* Features grid */}
        <div className="mt-14 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="glass-card flex flex-col items-center gap-2 rounded-2xl p-5 text-center sm:p-4"
            >
              <f.icon className={`h-10 w-10 ${f.color}`} />
              <p className="font-display text-base font-semibold">{f.label}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Info complémentaire au même format, sans répéter les règles des cartes */}
        <div className="mt-10 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          <div className="glass-card flex flex-col items-center gap-2 rounded-2xl p-5 text-center sm:p-4">
            <Grid3x3 className="h-10 w-10 text-rose-300" />
            <p className="font-display text-base font-semibold">Grille 10×10</p>
            <p className="text-sm leading-relaxed text-muted-foreground">100 cases pour jouer</p>
          </div>
        </div>

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
