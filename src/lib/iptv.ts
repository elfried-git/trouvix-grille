// Parser de playlist M3U IPTV (format iptv-org).
export const IPTV_PLAYLIST_URL = "https://iptv-org.github.io/iptv/index.country.m3u";

export type TvChannel = {
  id: string;
  name: string;
  country: string;
  logo: string;
  url: string;
  // Hauteur déduite du nom, ex. "(1080p)" -> 1080. null si inconnue.
  height: number | null;
  // Tags iptv-org : [Geo-blocked] = lecture possible seulement dans le pays ; [Not 24/7] = pas diffusée en continu.
  geoBlocked: boolean;
  notAlwaysOn: boolean;
};

export type TvCountry = {
  name: string;
  channels: TvChannel[];
};

const ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

export function parseM3U(text: string): TvChannel[] {
  const lines = text.split(/\r?\n/);
  const channels: TvChannel[] = [];
  let pending: Omit<TvChannel, "url" | "id"> | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const comma = line.indexOf(",");
      const head = comma >= 0 ? line.slice(0, comma) : line;
      const displayName = comma >= 0 ? line.slice(comma + 1).trim() : "";
      const attrs: Record<string, string> = {};
      let m: RegExpExecArray | null;
      ATTR_RE.lastIndex = 0;
      while ((m = ATTR_RE.exec(head))) attrs[m[1]] = m[2];

      const heightMatch = displayName.match(/\((\d{3,4})p\)/i);
      const fhdTag = /\bFHD\b/i.test(displayName);
      const hdTag = /\bHD\b/i.test(displayName);
      let height: number | null = heightMatch ? Number(heightMatch[1]) : null;
      if (height === null && fhdTag) height = 1080;
      if (height === null && hdTag) height = 720;

      const tags = [...displayName.matchAll(/\[([^\]]*)\]/g)]
        .flatMap((m) => m[1].split(";").map((t) => t.trim().toLowerCase()));
      const cleanName = displayName
        .replace(/\[[^\]]*\]/g, "")
        .replace(/\s*\(\d{3,4}p\)\s*$/i, "")
        .replace(/\s{2,}/g, " ")
        .trim();

      pending = {
        name: cleanName || "Chaîne",
        geoBlocked: tags.includes("geo-blocked"),
        notAlwaysOn: tags.includes("not 24/7"),
        country: attrs["group-title"] || "Autre",
        logo: attrs["tvg-logo"] || "",
        height,
      };
      continue;
    }

    if (line.startsWith("#")) continue;

    if (pending) {
      channels.push({ ...pending, id: `${channels.length}-${line}`, url: line });
      pending = null;
    }
  }

  return channels;
}

export function groupByCountry(channels: TvChannel[]): TvCountry[] {
  const map = new Map<string, TvChannel[]>();
  for (const c of channels) {
    const list = map.get(c.country);
    if (list) list.push(c);
    else map.set(c.country, [c]);
  }
  const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
  return Array.from(map, ([name, list]) => ({ name, channels: list }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

// Mixed content : un site en https ne peut pas lire un flux http.
export function isPlayable(c: TvChannel): boolean {
  return c.url.startsWith("https://");
}
