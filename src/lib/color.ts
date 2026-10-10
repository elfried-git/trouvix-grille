/**
 * Small color helpers used to derive a player's timer-bar gradient from the
 * single hex color he picked in the setup screen.
 *
 * Everything works on #rrggbb (or #rgb). Invalid input falls back to a neutral
 * amber so the UI never breaks on a malformed color.
 */

const FALLBACK = "#f59e0b";

/** Parse "#rgb" or "#rrggbb" into [r, g, b] (0-255). Returns null if invalid. */
function parseHex(hex: string): [number, number, number] | null {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Mix `hex` toward `target` by `amount` (0 = unchanged, 1 = fully target).
 * Used to build a light/dark variant of the player's own color.
 */
function mix(hex: string, target: [number, number, number], amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return FALLBACK;
  const a = Math.max(0, Math.min(1, amount));
  return toHex([
    rgb[0] + (target[0] - rgb[0]) * a,
    rgb[1] + (target[1] - rgb[1]) * a,
    rgb[2] + (target[2] - rgb[2]) * a,
  ]);
}

/** A lighter version of the color (toward white). */
export function lighten(hex: string, amount = 0.35): string {
  return mix(hex, [255, 255, 255], amount);
}

/** A darker version of the color (toward black). */
export function darken(hex: string, amount = 0.35): string {
  return mix(hex, [0, 0, 0], amount);
}

/**
 * The CSS gradient for the turn timer bar, derived entirely from the current
 * player's color: a darker edge -> his color -> a lighter edge. So the bar
 * visibly takes on the color the player chose.
 */
export function playerBarGradient(hex: string): string {
  const base = parseHex(hex) ? hex : FALLBACK;
  return `linear-gradient(90deg, ${darken(base, 0.28)}, ${base}, ${lighten(base, 0.4)})`;
}

/**
 * Return a vivid, high-saturation version of the player's color.
 *
 * Player colors can be pale (pastel) which makes the turn timer bar hard to
 * read against the dark board. This boosts saturation (and ensures a minimum
 * value) while keeping the exact hue, so the bar stays the player's own color
 * — solid and clearly identifiable — for the whole turn (no gradient).
 */
export function vividColor(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return FALLBACK;
  const [r0, g0, b0] = rgb;
  const max = Math.max(r0, g0, b0);
  const min = Math.min(r0, g0, b0);
  const v = max / 255; // HSV value in [0, 1]
  const s = max === 0 ? 0 : (max - min) / max; // HSV saturation in [0, 1]

  // Push saturation up (keep already-vivid colors as-is)
  const s2 = Math.min(1, Math.max(s, Math.min(1, s * 1.35 + 0.2)));
  // Ensure a minimum brightness so the bar is clearly visible on the dark board
  const v2 = Math.max(v, 0.85);

  // HSV -> RGB
  const c = v2 * s2;
  const hh = (() => {
    if (max === min) return 0;
    if (max === r0) return ((g0 - b0) / (max - min)) % 6;
    if (max === g0) return (b0 - r0) / (max - min) + 2;
    return (r0 - g0) / (max - min) + 4;
  })();
  const h6 = ((hh % 6) + 6) % 6;
  const x = c * (1 - Math.abs((h6 % 2) - 1));
  const m = v2 - c;
  const seg = Math.floor(h6);
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (seg === 0) [rp, gp, bp] = [c, x, 0];
  else if (seg === 1) [rp, gp, bp] = [x, c, 0];
  else if (seg === 2) [rp, gp, bp] = [0, c, x];
  else if (seg === 3) [rp, gp, bp] = [0, x, c];
  else if (seg === 4) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return toHex([(rp + m) * 255, (gp + m) * 255, (bp + m) * 255]);
}
