"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import { ArrowLeft, Loader2, Radio, Search, Tv, AlertTriangle } from "lucide-react";
import {
  IPTV_PLAYLIST_URL,
  groupByCountry,
  isPlayable,
  parseM3U,
  type TvChannel,
  type TvCountry,
} from "@/lib/iptv";

type QualityFilter = "all" | "hd" | "fhd";
type LevelOption = { index: number; height: number };
type PlayerStatus = "idle" | "loading" | "playing" | "error";

// Cache mémoire : la playlist (≈13 000 chaînes) n'est téléchargée qu'une fois par session.
let cachedCountries: TvCountry[] | null = null;
let cachedTotal = 0;
let cachedPlayable = 0;

function qualityLabel(height: number | null): string | null {
  if (height === null) return null;
  if (height >= 1080) return "FHD";
  if (height >= 720) return "HD";
  return `${height}p`;
}

function matchesQuality(c: TvChannel, filter: QualityFilter): boolean {
  if (filter === "all") return true;
  if (c.height === null) return false;
  return filter === "fhd" ? c.height >= 1080 : c.height >= 720;
}

export function TvScreen({ onBack }: { onBack: () => void }) {
  const [countries, setCountries] = useState<TvCountry[] | null>(cachedCountries);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [channelQuery, setChannelQuery] = useState("");
  const [quality, setQuality] = useState<QualityFilter>("all");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [channel, setChannel] = useState<TvChannel | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [levels, setLevels] = useState<LevelOption[]>([]);
  const [levelChoice, setLevelChoice] = useState<number>(-1); // -1 = Auto
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (cachedCountries) return;
    let cancelled = false;
    fetch(IPTV_PLAYLIST_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const all = parseM3U(text);
        const playable = all.filter(isPlayable);
        cachedTotal = all.length;
        cachedPlayable = playable.length;
        cachedCountries = groupByCountry(playable);
        setCountries(cachedCountries);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Impossible de charger la liste des chaînes. Réessaie plus tard.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Lecteur HLS : recrée l'instance à chaque changement de chaîne.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return;

    setStatus("loading");
    setLevels([]);
    setLevelChoice(-1);

    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, capLevelToPlayerSize: false, startLevel: -1 });
      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        const seen = new Map<number, number>();
        data.levels.forEach((l, i) => {
          if (l.height && !seen.has(l.height)) seen.set(l.height, i);
        });
        setLevels(
          Array.from(seen, ([height, index]) => ({ index, height })).sort((a, b) => b.height - a.height),
        );
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setStatus("error");
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = channel.url;
      video.play().catch(() => {});
    } else {
      setStatus("error");
      return;
    }

    const onPlaying = () => setStatus("playing");
    const onWaiting = () => setStatus((s) => (s === "error" ? s : "loading"));
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);

    return () => {
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      hls?.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [channel]);

  // Choix de qualité : Auto ou un palier fixe (HD 720p, FHD 1080p…).
  const pickLevel = (index: number) => {
    setLevelChoice(index);
    if (hlsRef.current) hlsRef.current.currentLevel = index;
  };

  const filteredCountries = useMemo(() => {
    if (!countries) return [];
    const q = countryQuery.trim().toLowerCase();
    return q ? countries.filter((c) => c.name.toLowerCase().includes(q)) : countries;
  }, [countries, countryQuery]);

  const activeCountry = useMemo(
    () => countries?.find((c) => c.name === selectedCountry) ?? null,
    [countries, selectedCountry],
  );

  const visibleChannels = useMemo(() => {
    if (!activeCountry) return [];
    const q = channelQuery.trim().toLowerCase();
    return activeCountry.channels.filter(
      (c) => matchesQuality(c, quality) && (!q || c.name.toLowerCase().includes(q)),
    );
  }, [activeCountry, channelQuery, quality]);

  const openCountry = (name: string) => {
    setSelectedCountry(name);
    setChannelQuery("");
  };

  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-16 pt-6">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-bold text-foreground transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <h1 className="flex items-center gap-2 font-display text-2xl font-black">
          <Tv className="h-6 w-6 text-emerald-300" />
          <span className="text-red-gradient">TV</span>
        </h1>
        <span className="w-[88px]" />
      </div>

      {channel && (
        <div className="glass-card flex flex-col gap-3 rounded-2xl p-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              controls
              playsInline
              autoPlay
              muted={false}
              className="h-full w-full bg-black"
            />
            {status === "loading" && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Radio className="h-4 w-4 shrink-0 text-emerald-300" />
              <p className="truncate font-display text-base font-bold">{channel.name}</p>
              {qualityLabel(channel.height) && (
                <span className="rounded-md bg-emerald-400/15 px-2 py-0.5 text-xs font-bold text-emerald-200">
                  {qualityLabel(channel.height)}
                </span>
              )}
            </div>
            {levels.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <QualityChip active={levelChoice === -1} onClick={() => pickLevel(-1)}>
                  Auto
                </QualityChip>
                {levels.map((l) => (
                  <QualityChip key={l.index} active={levelChoice === l.index} onClick={() => pickLevel(l.index)}>
                    {l.height >= 720 ? `${qualityLabel(l.height)} · ${l.height}p` : `${l.height}p`}
                  </QualityChip>
                ))}
              </div>
            )}
          </div>

          {status === "error" && (
            <p className="flex items-center gap-2 text-sm text-amber-200">
              <AlertTriangle className="h-4 w-4" />
              Cette chaîne ne se lit pas dans le navigateur (flux indisponible ou bloqué). Essaie une autre chaîne.
            </p>
          )}
        </div>
      )}

      {loadError && <p className="text-sm text-rose-300">{loadError}</p>}

      {!countries && !loadError && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Chargement des chaînes…
        </div>
      )}

      {countries && (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          {/* Pays A-Z */}
          <div className="glass-card flex min-h-0 flex-col gap-2 rounded-2xl p-3 md:max-h-[70vh]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder="Rechercher un pays"
                className="h-10 w-full rounded-full border border-white/15 bg-black/30 pl-9 pr-3 text-sm outline-none focus:border-emerald-300/60"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredCountries.length} pays · {cachedPlayable} chaînes HTTPS sur {cachedTotal}
            </p>
            <ul className="flex flex-col gap-1 overflow-y-auto pr-1">
              {filteredCountries.map((c) => (
                <li key={c.name}>
                  <button
                    onClick={() => openCountry(c.name)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      selectedCountry === c.name
                        ? "bg-emerald-400/20 font-bold text-emerald-100"
                        : "text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{c.channels.length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Chaînes du pays */}
          <div className="glass-card flex min-h-0 flex-col gap-3 rounded-2xl p-3 md:max-h-[70vh]">
            {!activeCountry ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Choisis un pays pour voir ses chaînes.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="mr-auto font-display text-lg font-bold">{activeCountry.name}</h2>
                  <QualityChip active={quality === "all"} onClick={() => setQuality("all")}>
                    Toutes
                  </QualityChip>
                  <QualityChip active={quality === "hd"} onClick={() => setQuality("hd")}>
                    HD
                  </QualityChip>
                  <QualityChip active={quality === "fhd"} onClick={() => setQuality("fhd")}>
                    FHD
                  </QualityChip>
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={channelQuery}
                    onChange={(e) => setChannelQuery(e.target.value)}
                    placeholder="Rechercher une chaîne"
                    className="h-10 w-full rounded-full border border-white/15 bg-black/30 pl-9 pr-3 text-sm outline-none focus:border-emerald-300/60"
                  />
                </div>
                <ul className="grid gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                  {visibleChannels.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => setChannel(c)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                          channel?.id === c.id
                            ? "border-emerald-300/60 bg-emerald-400/15"
                            : "border-white/10 bg-black/20 hover:border-white/25 hover:bg-white/5"
                        }`}
                      >
                        {c.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.logo}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 shrink-0 rounded-md bg-white/10 object-contain"
                            onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/10">
                            <Tv className="h-4 w-4 text-muted-foreground" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
                        {qualityLabel(c.height) && (
                          <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-bold">
                            {qualityLabel(c.height)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                  {visibleChannels.length === 0 && (
                    <li className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      Aucune chaîne pour ce filtre.
                    </li>
                  )}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function QualityChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded-full border px-3 text-xs font-bold transition ${
        active
          ? "border-emerald-300/70 bg-emerald-400/25 text-emerald-100"
          : "border-white/15 bg-white/5 text-foreground hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}
