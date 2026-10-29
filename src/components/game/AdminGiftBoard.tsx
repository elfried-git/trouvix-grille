"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getSocket } from "@/lib/socket";
import type { GiftHistoryEntry } from "@/lib/gift-draw";
import { Gift, Loader2, RefreshCw, Trash2 } from "lucide-react";

interface GiftAdminListAck {
  ok?: boolean;
  error?: string;
  enabled?: boolean;
  entries?: GiftHistoryEntry[];
  spaces?: number;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/** Panneau admin : activation du cadeau de Noël et historique des tirages. */
export function AdminGiftBoard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [spaces, setSpaces] = useState(0);
  const [entries, setEntries] = useState<GiftHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) return;
    setLoading(true);
    socket.emit("admin-gift-list-history", {}, (res: GiftAdminListAck) => {
      setLoading(false);
      if (res?.error) return setError(res.error);
      if (typeof res?.enabled === "boolean") setEnabled(res.enabled);
      if (res?.entries) setEntries(res.entries);
      if (typeof res?.spaces === "number") setSpaces(res.spaces);
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    load();
    socket.on("connect", load);
    return () => {
      socket.off("connect", load);
    };
  }, [load]);

  const toggle = () => {
    if (enabled === null || pending) return;
    const socket = getSocket();
    if (!socket.connected) return setError("Connexion au serveur indisponible.");
    setPending(true);
    setError(null);
    socket.emit("admin-gift-set-enabled", { enabled: !enabled }, (res: GiftAdminListAck) => {
      setPending(false);
      if (res?.error) return setError(res.error);
      if (typeof res?.enabled === "boolean") setEnabled(res.enabled);
      if (res?.enabled === false) setSpaces(0);
    });
  };

  const remove = (id: string) => {
    const socket = getSocket();
    if (!socket.connected) return setError("Connexion au serveur indisponible.");
    socket.emit("admin-gift-delete-history", { id }, (res: GiftAdminListAck) => {
      if (res?.error) return setError(res.error);
      if (res?.entries) setEntries(res.entries);
    });
  };

  return (
    <section className="glass-card space-y-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-black text-white">
          <Gift className="h-5 w-5 text-yellow-300" />
          Cadeau Noël
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {enabled === null ? "…" : enabled ? `Activé · ${spaces} espace(s) en cours` : "Désactivé"}
          </span>
          <Button
            onClick={toggle}
            disabled={enabled === null || pending}
            variant={enabled ? "outline" : "default"}
            size="sm"
            className="rounded-full font-bold"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {enabled ? "Désactiver" : "Activer"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Désactiver supprime tous les espaces en cours. L&apos;historique reste jusqu&apos;à suppression manuelle.
      </p>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-widest text-amber-200/70">
          Historique des tirages ({entries.length})
        </p>
        <Button onClick={load} disabled={loading} variant="ghost" size="sm" className="rounded-full">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun tirage terminé pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">
                  Espace {entry.code} · {entry.capacity} places · hôte {entry.hostName}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatDate(entry.drawnAt)}</span>
                  <Button
                    onClick={() => remove(entry.id)}
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer ce tirage"
                    className="h-7 w-7 text-red-300 hover:text-red-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="mb-1 text-xs text-muted-foreground">
                Participants : {entry.participants.map((p) => p.name).join(", ")}
              </p>
              <ul className="grid gap-0.5 text-xs text-white/90 sm:grid-cols-2">
                {entry.pairs.map((pair) => (
                  <li key={`${pair.giver}-${pair.receiver}`}>
                    {pair.giver} <span className="text-amber-200">→</span> {pair.receiver}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}