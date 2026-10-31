"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Copy, Gift, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/game-store";
import { getSocket } from "@/lib/socket";
import {
  GIFT_ALLOWED_CAPACITIES,
  GIFT_NAME_MAX_LENGTH,
  GIFT_TITLE,
  validateGiftName,
  type GiftSpaceView,
  type GiftYou,
} from "@/lib/gift-draw";
import { BackgroundSlideshow } from "./BackgroundSlideshow";
import { GiftLoader } from "./GiftLoader";

const REVEAL_MS = 3800;

const CLIENT_ID_KEY = "trouvix_gift_client_id";
const CLIENT_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

interface GiftAck {
  ok?: boolean;
  error?: string;
  view?: GiftSpaceView;
  you?: GiftYou;
}

function readOrCreateClientId(): string {
  try {
    const saved = localStorage.getItem(CLIENT_ID_KEY);
    if (saved && CLIENT_ID_PATTERN.test(saved)) return saved;
  } catch {
    // Stockage indisponible (navigation privée stricte) : on en génère un par onglet.
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const created = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  try {
    localStorage.setItem(CLIENT_ID_KEY, created);
  } catch {
    // Ignoré : l'identifiant reste valable pour cette session.
  }
  return created;
}

function request(event: string, payload: Record<string, unknown>): Promise<GiftAck> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(
      () => resolve({ error: "Le serveur ne répond pas. Réessaie dans un instant." }),
      15000,
    );
    getSocket().emit(event, payload, (response: GiftAck) => {
      window.clearTimeout(timer);
      resolve(response ?? { error: "Réponse vide du serveur." });
    });
  });
}

// Le fond et les couleurs suivent l'accueil : vert sapin, rouge, or.
const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const radius = i % 2 ? 2.2 : 5;
  const angle = ((-90 + i * 36) * Math.PI) / 180;
  return `${(32 + radius * Math.cos(angle)).toFixed(2)},${(7 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(" ");

function ChristmasTree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 80" className={className} aria-hidden="true">
      <rect x="28" y="70" width="8" height="8" rx="1" fill="#7c2d12" />
      <polygon points="32,9 50,34 14,34" fill="#16a34a" />
      <polygon points="32,24 56,54 8,54" fill="#15803d" />
      <polygon points="32,40 62,70 2,70" fill="#166534" />
      <polygon points={STAR_POINTS} fill="#facc15" />
      <circle cx="23" cy="44" r="2.6" fill="#ef4444" />
      <circle cx="41" cy="60" r="2.6" fill="#ef4444" />
      <circle cx="31" cy="61" r="2.6" fill="#fde047" />
      <circle cx="44" cy="30" r="2.2" fill="#fde047" />
    </svg>
  );
}

function PartyBalloon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 84" className={className} aria-hidden="true">
      <ellipse cx="32" cy="30" rx="22" ry="26" fill="#facc15" />
      <ellipse cx="23" cy="20" rx="5" ry="9" fill="#ffffff" opacity="0.45" transform="rotate(20 23 20)" />
      <polygon points="29,55 35,55 32,60" fill="#ca8a04" />
      <path d="M32 60 Q 27 70 34 82" stroke="#e5e7eb" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function GiftScreen() {
  const backHome = useGameStore((s) => s.backHome);
  const clientRef = useRef<string>("");
  const codeRef = useRef<string | null>(null);

  const [code, setCode] = useState<string | null>(null);
  const [view, setView] = useState<GiftSpaceView | null>(null);
  const [you, setYou] = useState<GiftYou | null>(null);
  const [capacity, setCapacity] = useState<number>(GIFT_ALLOWED_CAPACITIES[0]);
  const [name, setName] = useState("");
  const [hostName, setHostName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [copied, setCopied] = useState(false);
  // Popup : l'hôte a quitté, l'espace n'existe plus.
  const [hostLeft, setHostLeft] = useState(false);
  // Pourquoi l'espace a disparu : départ de l'hôte, ou fonctionnalité désactivée par l'admin.
  const [closeReason, setCloseReason] = useState<"host-left" | "disabled">("host-left");
  // Suspens : affiché quand le tirage arrive pendant que la personne regarde la page.
  const [revealing, setRevealing] = useState(false);
  // Suspens à chaque nouveau tirage (chaque tirage), jamais à l'ouverture d'un espace déjà tiré.
  const drawnAt = view ? view.drawnAt : undefined;
  const lastDrawnAt = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (drawnAt === undefined) return;
    const previous = lastDrawnAt.current;
    lastDrawnAt.current = drawnAt;
    if (previous !== undefined && drawnAt !== null && drawnAt !== previous) {
      setRevealing(true);
      window.setTimeout(() => setRevealing(false), REVEAL_MS);
    }
  }, [drawnAt]);

  const applySpace = useCallback((space: GiftSpaceView, mine: GiftYou | undefined) => {
    setView(space);
    setYou(mine ?? null);
    setError(null);
  }, []);

  const openSpace = useCallback(
    async (requested: string) => {
      setOpening(true);
      const res = await request("gift:open", { code: requested, clientId: clientRef.current });
      setOpening(false);
      if (res.error || !res.view) {
        codeRef.current = null;
        setCode(null);
        setView(null);
        setYou(null);
        setError(res.error ?? "Espace introuvable. Le lien est peut-être expiré.");
        window.history.replaceState({}, "", "/");
        return;
      }
      codeRef.current = res.view.code;
      setCode(res.view.code);
      applySpace(res.view, res.you);
    },
    [applySpace],
  );

  useEffect(() => {
    clientRef.current = readOrCreateClientId();
    const socket = getSocket();
    const onUpdate = (payload: { view?: GiftSpaceView }) => {
      if (payload?.view && payload.view.code === codeRef.current) setView(payload.view);
    };
    // Après une coupure, on relit l'espace pour rattraper ce qui a été manqué.
    const onConnect = () => {
      if (codeRef.current) void openSpace(codeRef.current);
    };
    const onClosed = (payload: { code?: string; reason?: string }) => {
      if (!payload?.code || payload.code !== codeRef.current) return;
      codeRef.current = null;
      setCode(null);
      setView(null);
      setYou(null);
      setError(null);
      setCloseReason(payload.reason === "disabled" ? "disabled" : "host-left");
      setHostLeft(true);
      window.history.replaceState({}, "", "/");
    };
    socket.on("gift:update", onUpdate);
    socket.on("gift:closed", onClosed);
    socket.on("connect", onConnect);

    const initial = new URLSearchParams(window.location.search).get("cadeau")?.trim().toUpperCase();
    if (initial) void openSpace(initial);

    return () => {
      socket.off("gift:update", onUpdate);
      socket.off("gift:closed", onClosed);
      socket.off("connect", onConnect);
    };
  }, [openSpace]);

  const createSpace = async () => {
    const checked = validateGiftName(hostName);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await request("gift:create", { clientId: clientRef.current, capacity, hostName: checked.name });
    setBusy(false);
    if (res.error || !res.view) {
      setError(res.error ?? "Impossible de créer l'espace.");
      return;
    }
    codeRef.current = res.view.code;
    setCode(res.view.code);
    applySpace(res.view, res.you);
    window.history.replaceState({}, "", `/?cadeau=${res.view.code}`);
  };

  const register = async (event: FormEvent) => {
    event.preventDefault();
    if (!code) return;
    const checked = validateGiftName(name);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await request("gift:register", { code, clientId: clientRef.current, name: checked.name });
    setBusy(false);
    if (res.error || !res.view) {
      setError(res.error ?? "Impossible de valider ton nom.");
      return;
    }
    applySpace(res.view, res.you);
    setName("");
  };

  const drawGifts = async () => {
    if (!code) return;
    setBusy(true);
    setError(null);
    const res = await request("gift:draw", { code, clientId: clientRef.current });
    setBusy(false);
    if (res.error || !res.view) {
      setError(res.error ?? "Le tirage a échoué, réessaie.");
      return;
    }
    applySpace(res.view, res.you);
  };

  const leave = () => {
    // L'hôte qui quitte ferme l'espace pour tout le monde.
    if (you?.isHost && codeRef.current) {
      getSocket().emit("gift:close", { code: codeRef.current, clientId: clientRef.current });
    }
    codeRef.current = null;
    window.history.replaceState({}, "", "/");
    backHome();
  };

  const shareUrl = code && typeof window !== "undefined" ? `${window.location.origin}/?cadeau=${code}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copie impossible. Sélectionne le lien à la main.");
    }
  };

  const participants = view?.participants ?? [];
  const isHost = !!you?.isHost;
  const registered = !!you?.participantId;
  const remaining = view ? view.capacity - participants.length : 0;
  const full = remaining <= 0;
  const canDraw = isHost && !!view && !view.drawn && view.hostRegistered && full;
  const emptySlots = Math.max(0, remaining);

  return (
    <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-16 pt-8">
      <BackgroundSlideshow />
      {hostLeft && (
        <div role="dialog" aria-modal="true" aria-labelledby="gift-host-left-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="glass-card flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl p-6 text-center">
            <Gift className="h-10 w-10 text-yellow-300" />
            <h2 id="gift-host-left-title" className="font-display text-2xl font-black text-white">
            {closeReason === "disabled" ? "Cadeau de Noël indisponible" : "L'hôte a quitté l'espace"}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {closeReason === "disabled"
                ? "L'administrateur a désactivé le cadeau de Noël. Cet espace n'existe plus."
                : "Veuillez recommencer."}
            </p>
            <Button
              onClick={() => {
                setHostLeft(false);
                backHome();
              }}
              variant="outline"
              size="lg"
              className="h-11 rounded-full border-amber-400/40 bg-amber-500/5 px-5 text-base text-amber-200 hover:bg-amber-500/15 w-full"
            >
              Retour à l&apos;accueil
            </Button>
          </div>
        </div>
      )}
      <div className="relative z-10 flex w-full flex-col items-center gap-6 text-center">
        <header className="flex items-end gap-3">
          <ChristmasTree className="h-16 w-14 drop-shadow-[0_4px_12px_rgba(22,163,74,0.5)]" />
          <h1 className="font-display text-4xl font-black tracking-wide text-white drop-shadow-[0_2px_10px_rgba(220,38,38,0.6)] sm:text-5xl">
            {GIFT_TITLE}
          </h1>
          <PartyBalloon className="h-20 w-16 drop-shadow-[0_4px_12px_rgba(250,204,21,0.5)]" />
        </header>

        {error && (
          <p role="alert" className="w-full max-w-md rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-2 text-sm text-red-100">
            {error}
          </p>
        )}

        {/* 1. Création de l'espace par l'hôte */}
        {!code && !opening && (
          <section className="glass-card flex w-full max-w-md flex-col items-center gap-5 rounded-2xl p-6">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tirage au sort : chacun offre à quelqu&apos;un et reçoit de quelqu&apos;un. Personne ne s&apos;offre à soi-même, et deux personnes ne s&apos;offrent jamais l&apos;une à l&apos;autre.
            </p>
            <div className="flex w-full flex-col gap-2">
              <p className="text-sm font-semibold">Nombre de participants</p>
              <div role="radiogroup" aria-label="Nombre de participants" className="grid grid-cols-3 gap-2">
                {GIFT_ALLOWED_CAPACITIES.map((value) => {
                  const selected = capacity === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setCapacity(value)}
                      className={`h-12 rounded-xl border text-lg font-bold transition ${
                        selected
                          ? "border-yellow-300 bg-gradient-to-br from-[#15803d] to-[#166534] text-white shadow-[0_0_18px_-4px_rgba(250,204,21,0.7)]"
                          : "border-white/15 bg-white/5 text-muted-foreground hover:bg-white/10"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2">
              <label htmlFor="gift-host-name" className="text-sm font-semibold">Ton prénom (tu es l&apos;hôte)</label>
              <input
                id="gift-host-name"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                maxLength={GIFT_NAME_MAX_LENGTH}
                autoComplete="off"
                placeholder="Ex. Camille"
                className="h-11 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm"
              />
            </div>
            <Button
              onClick={createSpace}
              disabled={busy}
              size="lg"
              className="h-14 w-full gap-3 rounded-full border-0 bg-gradient-to-r from-[#15803d] via-[#dc2626] to-[#15803d] text-base font-extrabold uppercase tracking-wide text-white shadow-[0_8px_30px_-6px_rgba(220,38,38,0.6)] transition hover:brightness-110"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
              Créer l&apos;espace
            </Button>
          </section>
        )}

        {opening && !view && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Ouverture de l&apos;espace…
          </div>
        )}

        {/* 2. Espace ouvert : partage, inscriptions, tirage */}
        {view && !view.drawn && (
          <section className="glass-card flex w-full max-w-md flex-col gap-5 rounded-2xl p-6 text-left">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Lien à partager</p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Lien à partager"
                  className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 text-sm"
                />
                <Button onClick={copyLink} variant="outline" size="sm" className="h-10 gap-2 rounded-lg">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copié" : "Copier"}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  <Users className="h-4 w-4 text-emerald-300" /> Participants
                </span>
                <span className="text-muted-foreground">
                  {participants.length} / {view.capacity}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#16a34a] via-[#facc15] to-[#dc2626] transition-all"
                  style={{ width: `${(participants.length / view.capacity) * 100}%` }}
                />
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {participants.map((p) => (
                  <li
                    key={p.id}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm"
                  >
                    <span className="truncate font-semibold">{p.name}</span>
                    {p.isHost && (
                      <span className="shrink-0 rounded-full bg-yellow-300/20 px-2 py-0.5 text-[10px] font-bold uppercase text-yellow-200">
                        Hôte
                      </span>
                    )}
                  </li>
                ))}
                {Array.from({ length: emptySlots }, (_, i) => {
                  const reserved = !view.hostRegistered && i === emptySlots - 1;
                  return (
                    <li
                      key={`empty-${i}`}
                      className="flex items-center justify-center rounded-xl border border-dashed border-white/20 px-3 py-2 text-xs text-muted-foreground"
                    >
                      {reserved ? "Réservée à l'hôte" : "Place libre"}
                    </li>
                  );
                })}
              </ul>
            </div>

            {!registered && (
              <form onSubmit={register} className="flex flex-col gap-2">
                <label htmlFor="gift-name" className="text-sm font-semibold">
                  {isHost ? "Ton prénom (tu réserves ta place)" : "Ton prénom"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="gift-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={GIFT_NAME_MAX_LENGTH}
                    autoComplete="off"
                    placeholder="Ex. Camille"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 text-sm"
                  />
                  <Button type="submit" disabled={busy} className="h-11 rounded-lg px-4 font-bold">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider"}
                  </Button>
                </div>
              </form>
            )}

            {registered && canDraw && (
              <Button
                onClick={drawGifts}
                disabled={busy}
                size="lg"
                className="h-14 w-full gap-3 rounded-full border-0 bg-gradient-to-r from-[#15803d] via-[#dc2626] to-[#15803d] text-base font-extrabold uppercase tracking-wide text-white shadow-[0_8px_30px_-6px_rgba(220,38,38,0.6)] transition hover:brightness-110"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
                Lancer le tirage
              </Button>
            )}
            {registered && !canDraw && (isHost || full) && (
              <p className="text-center text-sm text-muted-foreground">
                {isHost
                  ? `En attente de ${remaining} personne${remaining > 1 ? "s" : ""} pour lancer le tirage.`
                  : "Tout le monde est là. L'hôte va lancer le tirage."}
              </p>
            )}
          </section>
        )}

        {/* 3. Résultat, visible en direct par tout le monde */}
        {view && view.drawn && revealing && (
          <GiftLoader names={participants.map((p) => p.name)} durationMs={REVEAL_MS} />
        )}

        {view && view.drawn && !revealing && (
          <section className="glass-card w-full max-w-2xl rounded-2xl p-4 sm:p-6">
            <h2 className="mb-4 text-center font-display text-3xl font-black text-yellow-200 sm:text-4xl">Qui offre à qui</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[300px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="text-sm uppercase tracking-wide text-muted-foreground">
                    <th className="w-12 border-b border-white/15 px-2 py-3 font-semibold">N°</th>
                    <th className="border-b border-white/15 px-3 py-3 font-semibold">Tirage</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((giver, index) => {
                    const assignment = view.assignments.find((a) => a.giverId === giver.id);
                    const receiver = participants.find((p) => p.id === assignment?.receiverId);
                    const isMine = giver.id === you?.participantId;
                    return (
                      <tr key={giver.id} className={isMine ? "bg-yellow-300/10" : ""}>
                        <td className="border-b border-white/10 px-2 py-4 text-center text-lg font-black text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="border-b border-white/10 px-3 py-4 leading-relaxed">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg sm:text-xl">
                            <span className="font-extrabold text-emerald-200">{giver.name}</span>
                            {giver.isHost && (
                              <span className="rounded-full bg-yellow-300/20 px-2 py-0.5 text-xs font-bold uppercase text-yellow-200">
                                Hôte
                              </span>
                            )}
                            {isMine && (
                              <span className="rounded-full bg-yellow-300/20 px-2 py-0.5 text-xs font-bold uppercase text-yellow-200">
                                Toi
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-base sm:text-lg">
                            <span className="text-sm text-muted-foreground sm:text-base">donnera son cadeau à</span>
                            <span className="font-extrabold text-rose-200">{receiver?.name ?? "?"}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Personne ne s&apos;offre à soi-même, et aucune paire ne s&apos;offre mutuellement.
            </p>
          </section>
        )}

        <button
          type="button"
          onClick={leave}
          className="mx-auto flex h-11 rounded-full border-amber-400/40 bg-amber-500/5 px-5 text-base text-amber-200 hover:bg-amber-500/15 w-full max-w-xs items-center justify-center"
        >
          Retour à l&apos;accueil
        </button>
      </div>
    </div>
  );
}