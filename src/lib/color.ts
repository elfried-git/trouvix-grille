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
