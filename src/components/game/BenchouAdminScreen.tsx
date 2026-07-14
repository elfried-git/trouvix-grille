"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useGameStore } from "@/store/game-store";
import { useOnlineStore } from "@/store/online-store";
import type { Challenge } from "@/store/online-store";
import { useToast } from "@/hooks/use-toast";
import { Avatar } from "./Avatar";
import {
  ArrowLeft,
  ShieldCheck,
  Bell,
  Check,
  X,
  Loader2,
  Inbox,
  LogOut,
  Users,
  Clock,
  ChevronDown,
  Gamepad2,
  Trophy,
  Sparkles,
} from "lucide-react";

// ===== Helpers =====
function formatChallengeAge(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  return `il y a ${diffD} jour${diffD > 1 ? "s" : ""}`;
}

// ===== Main Component =====
export function BenchouAdminScreen() {
  const backHome = useGameStore((s) => s.backHome);
  const goToOnlineSetup = useGameStore((s) => s.goToOnlineSetup);
  const { toast } = useToast();

  const benchouPin = useOnlineStore((s) => s.benchouPin);
  const isBenchou = useOnlineStore((s) => s.isBenchou);
  const challenges = useOnlineStore((s) => s.challenges);
  const onlineState = useOnlineStore((s) => s.state);
  const pendingAction = useOnlineStore((s) => s.pendingAction);
  const onlineAcceptChallenge = useOnlineStore((s) => s.acceptChallenge);
  const onlineDeclineChallenge = useOnlineStore((s) => s.declineChallenge);
  const onlineTeardown = useOnlineStore((s) => s.teardown);

  const [sollicitationsOpen, setSollicitationsOpen] = useState(true);
  const [acceptedChallenge, setAcceptedChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    const online = useOnlineStore.getState();
    online.init();
    online.tryReconnect();
  }, []);

  useEffect(() => {
    if (acceptedChallenge && onlineState?.phase === "playing") {
      goToOnlineSetup();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAcceptedChallenge(null);
    }
  }, [acceptedChallenge, onlineState, goToOnlineSetup]);

  const handleAcceptChallenge = async (challenge: Challenge) => {
    setAcceptedChallenge(challenge);
    await onlineAcceptChallenge(challenge.id);
    toast({
      title: "Défi accepté !",
      description: `En attente que ${challenge.challengerName} lance la partie…`,
    });
  };

  const handleDeclineChallenge = async (challengeId: string) => {
    await onlineDeclineChallenge(challengeId);
    toast({
      title: "Défi refusé",
      description: "Le joueur a été notifié.",
    });
  };

  const handleLogout = () => {
    onlineTeardown();
    toast({
      title: "Déconnecté",
      description: "Tu as quitté l'espace Benchou Ferrari.",
    });
    backHome();
  };

  if (!benchouPin) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card flex w-full flex-col items-center gap-5 rounded-2xl p-10 text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/15 ring-2 ring-violet-400/30">
            <ShieldCheck className="h-10 w-10 text-violet-300" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-black text-violet-200">
              Espace Benchou Ferrari
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu dois te connecter pour accéder au tableau de bord. Le lien
              « Je suis Benchou Ferrari » se trouve sur la page « Jouer en
              ligne ».
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={goToOnlineSetup}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Aller à « Jouer en ligne »
            </Button>
            <Button onClick={backHome} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Accueil
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const totalTasks = challenges.length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={backHome}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Retour
        </Button>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-center"
        >
          <ShieldCheck className="h-6 w-6 text-violet-300" />
          <h1 className="font-display text-2xl font-black text-violet-200 sm:text-3xl">
            Espace Benchou Ferrari
          </h1>
        </motion.div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-rose-300"
          title="Se déconnecter"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Benchou identity card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-center gap-4 rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 p-4"
      >
        <img
          src="/benchou-ferrari-small.jpg"
          alt="Benchou Ferrari"
          width={56}
          height={56}
          loading="eager"
          fetchPriority="high"
          className="h-14 w-14 rounded-full object-cover ring-2 ring-violet-400/50"
        />
        <div className="flex-1">
          <p className="font-display text-lg font-bold text-violet-100">
            Benchou Ferrari
          </p>
          <p className="flex items-center gap-1.5 text-xs text-violet-200/70">
            {isBenchou ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                En ligne — Super Admin
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Session active (socket hors ligne)
              </>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-black text-violet-200">
            {totalTasks}
          </p>
          <p className="text-xs text-violet-200/60">
            {totalTasks > 1 ? "actions" : "action"}
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue="sollicitations" className="w-full">
        <TabsList className="grid w-full grid-cols-2 rounded-full bg-violet-500/10 p-1">
          <TabsTrigger
            value="sollicitations"
            className="rounded-full data-[state=active]:bg-violet-500/30 data-[state=active]:text-violet-100"
          >
            <Bell className="mr-1.5 h-4 w-4" />
            Sollicitations
            {challenges.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-500 px-1.5 text-xs font-bold text-white">
                {challenges.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="tournoi"
            className="rounded-full data-[state=active]:bg-amber-500/30 data-[state=active]:text-amber-100"
          >
            <Trophy className="mr-1.5 h-4 w-4" />
            Tournoi
          </TabsTrigger>
        </TabsList>

        {/* === Tab 1: Sollicitations === */}
        <TabsContent value="sollicitations" className="mt-4 space-y-4">
          {/* Waiting card */}
          <AnimatePresence>
            {acceptedChallenge && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/10 p-5 shadow-[0_0_30px_-8px_oklch(0.70_0.15_160/0.4)]"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar
                      avatar={acceptedChallenge.challengerEmoji}
                      color={acceptedChallenge.challengerColor}
                      size={56}
                      emojiSize="text-2xl"
                    />
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-background">
                      <Loader2 className="h-3 w-3 animate-spin text-white" />
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-base font-bold text-emerald-100">
                      Défi accepté — {acceptedChallenge.challengerName}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-emerald-200/80">
                      <Clock className="h-3.5 w-3.5" />
                      En attente que l'hôte lance la partie…
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-200/50">
                      Salon :{" "}
                      <span className="font-mono font-bold">
                        {acceptedChallenge.roomCode}
                      </span>{" "}
                      · Match en {acceptedChallenge.totalRounds} rounds
                    </p>
                  </div>
                  <Gamepad2 className="h-8 w-8 text-emerald-300/60" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Collapsible: Défis reçus */}
          <Collapsible
            open={sollicitationsOpen}
            onOpenChange={setSollicitationsOpen}
            className="rounded-2xl border border-violet-400/30 bg-violet-500/5 p-4"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-violet-300" />
                <h2 className="font-display text-lg font-bold text-violet-200">
                  Défis reçus ({challenges.length})
                </h2>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-violet-300/70 transition-transform duration-200 ${
                  sollicitationsOpen ? "rotate-180" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-4">
                {challenges.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/5 p-8 text-center text-sm text-violet-100/70">
                    <Inbox className="h-10 w-10 text-violet-300/50" />
                    <p className="font-medium">Aucune sollicitation pour le moment</p>
                    <p className="text-xs text-violet-200/50">
                      Les joueurs qui te défient apparaîtront ici.
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[55vh] space-y-3 overflow-y-auto scroll-romantic pr-1">
                    {challenges.map((ch, i) => (
                      <motion.div
                        key={ch.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="rounded-xl border border-violet-400/30 bg-card/40 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <Avatar
                            avatar={ch.challengerEmoji}
                            color={ch.challengerColor}
                            size={48}
                            emojiSize="text-xl"
                          />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="font-bold text-foreground">
                                {ch.challengerName}
                              </span>
                              <span className="flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-200">
                                <Users className="h-3 w-3" />
                                Match en {ch.totalRounds} rounds
                              </span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatChallengeAge(ch.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Code du salon :{" "}
                              <span className="font-mono font-bold text-violet-200">
                                {ch.roomCode}
                              </span>
                            </p>
                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeclineChallenge(ch.id)}
                                disabled={pendingAction}
                                className="border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                              >
                                {pendingAction ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="mr-1 h-3.5 w-3.5" />
                                )}
                                Refuser
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleAcceptChallenge(ch)}
                                disabled={pendingAction}
                                className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white hover:from-violet-500 hover:to-fuchsia-400"
                              >
                                {pendingAction ? (
                                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="mr-1 h-3.5 w-3.5" />
                                )}
                                Accepter
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </TabsContent>

        {/* === Tab 2: Tournoi === */}
        <TabsContent value="tournoi" className="mt-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-2xl p-8 text-center"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
              <Trophy className="h-8 w-8 text-white" />
            </div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-amber-200">
              <Sparkles className="h-3 w-3" />
              Bientôt disponible
            </div>
            <h2 className="font-display text-xl font-bold text-amber-100">
              Gestion des tournois
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vous pourrez bientôt créer et gérer des tournois depuis cet espace.
              Les inscriptions, les phases d'élimination et les résultats seront
              accessibles ici.
            </p>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Footer hint */}
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Les sollicitations expirent si le salon est fermé.
      </p>
    </div>
  );
}