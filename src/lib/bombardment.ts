export interface BombardmentCell {
  row: number;
  col: number;
}

export type BombardmentGrid = (string | null)[][];

export const BOMBARDMENT_UNLOCK_SCORE = 3;

/**
 * Finds target opponent pawns to destroy with the fireball.
 *
 * Each player with a fireball can use it independently on ANY of their turns,
 * without having to wait for another player or a specific rare pattern:
 *
 * 1. Priority 1 (Imminent square): Any 2x2 square where an opponent has 3 pawns.
 *    Destroys all 3 pawns, stopping the opponent's imminent score!
 * 2. Priority 2 (Square in preparation): Any 2x2 square where an opponent has 2 pawns.
 *    Destroys those pawns (up to 3).
 * 3. Priority 3 (Any opponent pawns on the grid): Destroys up to 3 opponent pawns,
 *    prioritizing strategic central pawns.
 *
 * Returns an array of target cells to clear from the grid.
 */
export function findBombardmentTargets(
  grid: BombardmentGrid,
  opponentIds: string[],
): BombardmentCell[] {
  const opponentSet = new Set(opponentIds);

  // 1. Priority 1: 2x2 blocks with 3 opponent pawns (imminent square threat)
  const imminentTargets = new Map<string, BombardmentCell>();
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
        filled.length === 3 &&
        owner !== null &&
        opponentSet.has(owner) &&
        filled.every(({ row: r, col: c }) => grid[r][c] === owner)
      ) {
        for (const cell of filled) imminentTargets.set(`${cell.row},${cell.col}`, cell);
      }
    }
  }
  if (imminentTargets.size > 0) {
    return [...imminentTargets.values()];
  }

  // 2. Priority 2: 2x2 blocks with 2 opponent pawns (emerging square setup)
  const pairTargets = new Map<string, BombardmentCell>();
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
        filled.length === 2 &&
        owner !== null &&
        opponentSet.has(owner) &&
        filled.every(({ row: r, col: c }) => grid[r][c] === owner)
      ) {
        for (const cell of filled) pairTargets.set(`${cell.row},${cell.col}`, cell);
        if (pairTargets.size >= 3) break;
      }
    }
    if (pairTargets.size >= 3) break;
  }
  if (pairTargets.size > 0) {
    return [...pairTargets.values()].slice(0, 3);
  }

  // 3. Priority 3: Any opponent pawns on the grid (up to 3 pawns, from center outwards)
  const allOpponentCells: { cell: BombardmentCell; dist: number }[] = [];
  const centerR = (grid.length - 1) / 2;
  const centerC = ((grid[0]?.length ?? 10) - 1) / 2;

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      const owner = grid[r][c];
      if (owner && opponentSet.has(owner)) {
        const dist = Math.hypot(r - centerR, c - centerC);
        allOpponentCells.push({ cell: { row: r, col: c }, dist });
      }
    }
  }

  if (allOpponentCells.length > 0) {
    allOpponentCells.sort((a, b) => a.dist - b.dist);
    return allOpponentCells.slice(0, 3).map((item) => item.cell);
  }

  return [];
}
