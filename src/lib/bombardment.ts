export interface BombardmentCell {
  row: number;
  col: number;
}

export type BombardmentGrid = (string | null)[][];

export const BOMBARDMENT_UNLOCK_SCORE = 3;

export function findBombardmentTargets(
  grid: BombardmentGrid,
  opponentIds: string[],
): BombardmentCell[] {
  const opponentSet = new Set(opponentIds);

  for (let row = 0; row < grid.length - 1; row++) {
    for (let col = 0; col < (grid[row]?.length ?? 0) - 1; col++) {
      const cells = [
        { row, col },
        { row, col: col + 1 },
        { row: row + 1, col },
        { row: row + 1, col: col + 1 },
      ];
      const filled = cells.filter(({ row: r, col: c }) => grid[r]?.[c] != null);
      const owner = filled[0] ? grid[filled[0].row][filled[0].col] : null;
      if (
        filled.length !== 3 ||
        owner === null ||
        !opponentSet.has(owner) ||
        !filled.every(({ row: r, col: c }) => grid[r][c] === owner)
      ) {
        continue;
      }
      return filled;
    }
  }

  return [];
}
