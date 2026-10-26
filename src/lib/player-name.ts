export const MIN_PLAYER_NAME_LENGTH = 2;
export const MAX_PLAYER_NAME_LENGTH = 5;

const playerNameSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function getPlayerNameLength(name: string): number {
  return Array.from(playerNameSegmenter.segment(name.trim())).length;
}

export function limitPlayerName(name: string): string {
  return Array.from(playerNameSegmenter.segment(name))
    .slice(0, MAX_PLAYER_NAME_LENGTH)
    .map(({ segment }) => segment)
    .join("");
}

export function isValidPlayerName(name: string): boolean {
  const length = getPlayerNameLength(name);
  return length >= MIN_PLAYER_NAME_LENGTH && length <= MAX_PLAYER_NAME_LENGTH;
}
