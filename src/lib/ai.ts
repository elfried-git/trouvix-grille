// Strong AI for the Trouvix 2x2 square game.
// Strategy (heuristic evaluation, 2-ply lookahead on critical moves):
//   1. Win immediately if possible (complete a 2x2 square)
//   2. Block opponent's immediate win (opponent has 3/4 of a square)
//   3. Create threats (reach 3/4 of a square)
//   4. Avoid giving the opponent a winning move (suicide check)
//   5. Prefer central cells + adjacency to own pions
//   6. Break opponent forks (situations where opponent has 2+ threats)

export const AI_ROWS = 10;
export const AI_COLS = 10;
export type AIGrid = (string | null)[][];
export interface AICell {
  row: number;
  col: number;
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < AI_ROWS && c >= 0 && c < AI_COLS;
}

// Check if placing playerId at (row,col) completes a 2x2 square.
function checkSquare(
  grid: AIGrid,
  row: number,
  col: number,
  playerId: string
): boolean {
  const offsets: [number, number][] = [
    [0, 0],
    [0, -1],
    [-1, 0],
    [-1, -1],
  ];
  for (const [dr, dc] of offsets) {
    const r0 = row + dr;
    const c0 = col + dc;
    if (!inBounds(r0, c0) || !inBounds(r0 + 1, c0 + 1)) continue;
    if (
      grid[r0][c0] === playerId &&
      grid[r0][c0 + 1] === playerId &&
      grid[r0 + 1][c0] === playerId &&
      grid[r0 + 1][c0 + 1] === playerId
    ) {
      return true;
    }
  }
  return false;
}

// Find all empty cells that would complete a 2x2 square for playerId.
function findWinningCells(grid: AIGrid, playerId: string): AICell[] {
  const wins: AICell[] = [];
  for (let r = 0; r < AI_ROWS; r++) {
    for (let c = 0; c < AI_COLS; c++) {
      if (grid[r][c] !== null) continue;
      const test = grid.map((row) => [...row]);
      test[r][c] = playerId;
      if (checkSquare(test, r, c, playerId)) {
        wins.push({ row: r, col: c });
      }
    }
  }
  return wins;
}

// Count 3/4 squares (threats) for playerId: a 2x2 block with exactly 3 of playerId and 1 empty.
function countThreats(grid: AIGrid, playerId: string): number {
  let count = 0;
  for (let r = 0; r < AI_ROWS - 1; r++) {
    for (let c = 0; c < AI_COLS - 1; c++) {
      const cells = [grid[r][c], grid[r][c + 1], grid[r + 1][c], grid[r + 1][c + 1]];
      const mine = cells.filter((v) => v === playerId).length;
      const empty = cells.filter((v) => v === null).length;
      if (mine === 3 && empty === 1) count++;
    }
  }
  return count;
}

// Count 2/4 squares (potential) for playerId: a 2x2 block with 2 of playerId and 2 empty.
function countPotential(grid: AIGrid, playerId: string): number {
  let count = 0;
  for (let r = 0; r < AI_ROWS - 1; r++) {
    for (let c = 0; c < AI_COLS - 1; c++) {
      const cells = [grid[r][c], grid[r][c + 1], grid[r + 1][c], grid[r + 1][c + 1]];
      const mine = cells.filter((v) => v === playerId).length;
      const empty = cells.filter((v) => v === null).length;
      const opp = cells.filter((v) => v !== null && v !== playerId).length;
      if (mine === 2 && empty === 2 && opp === 0) count++;
    }
  }
  return count;
}

function emptyCells(grid: AIGrid): AICell[] {
  const cells: AICell[] = [];
  for (let r = 0; r < AI_ROWS; r++) {
    for (let c = 0; c < AI_COLS; c++) {
      if (grid[r][c] === null) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

function cloneGrid(grid: AIGrid): AIGrid {
  return grid.map((row) => [...row]);
}

/**
 * Find the best move for the AI.
 * @param grid current grid
 * @param aiPlayerId the AI's player id
 * @param opponentIds array of opponent player ids (1+)
 * @returns the chosen cell, or null if no move possible
 */
export function findBestMove(
  grid: AIGrid,
  aiPlayerId: string,
  opponentIds: string[]
): AICell | null {
  const empties = emptyCells(grid);
  if (empties.length === 0) return null;

  // === 1. Immediate win ===
  const myWins = findWinningCells(grid, aiPlayerId);
  if (myWins.length > 0) {
    return myWins[0];
  }

  // === 2. Block opponent's immediate win ===
  // Collect all opponent winning cells (must block all if multiple = fork, block the one that matters most)
  const opponentWins: AICell[] = [];
  for (const oppId of opponentIds) {
    opponentWins.push(...findWinningCells(grid, oppId));
  }
  // Deduplicate
  const oppWinSet = new Set(opponentWins.map((c) => `${c.row},${c.col}`));

  let bestScore = -Infinity;
  let bestMoves: AICell[] = [];

  for (const cell of empties) {
    const { row, col } = cell;
    let score = 0;

    // Blocking: if this cell is an opponent's winning cell, big bonus
    if (oppWinSet.has(`${row},${col}`)) {
      score += 50000;
    }

    // Simulate AI placing here
    const afterAI = cloneGrid(grid);
    afterAI[row][col] = aiPlayerId;

    // (already handled win above, but re-check for safety)
    if (checkSquare(afterAI, row, col, aiPlayerId)) {
      score += 100000;
    }

    // === 3. Create threats ===
    const myThreatsAfter = countThreats(afterAI, aiPlayerId);
    // More aggressive: larger bonus for creating threats
    score += myThreatsAfter * 6000;

    // Potential squares (2/4)
    const myPotentialAfter = countPotential(afterAI, aiPlayerId);
    score += myPotentialAfter * 300;

    // === 4. Anti-suicide: after AI plays, can any opponent win? ===
    let oppCanWin = false;
    for (const oppId of opponentIds) {
      const oppWins2 = findWinningCells(afterAI, oppId);
      if (oppWins2.length > 0) {
        oppCanWin = true;
        break;
      }
    }
    if (oppCanWin) {
      // Reduce anti-suicide penalty to be more willing to take risks,
      // but still avoid obvious blunders. If multiple opponents can win, penalize more.
      const oppImmediateWins = opponentIds.reduce((acc, oppId) => acc + findWinningCells(afterAI, oppId).length, 0);
      score -= oppImmediateWins > 1 ? 60000 : 20000;
    }

    // === 5. Reduce opponent's existing threats ===
    // Count opponent threats before and after AI's move (did we break one?)
    for (const oppId of opponentIds) {
      const oppThreatsBefore = countThreats(grid, oppId);
      const oppThreatsAfter = countThreats(afterAI, oppId);
      if (oppThreatsAfter < oppThreatsBefore) {
        score += 3000; // we blocked/broke an opponent threat
      }
    }

    // === Fork creation: if this move creates multiple immediate threats, big bonus ===
    if (myThreatsAfter >= 2) {
      score += 20000;
    }

    // === 6. Center preference ===
    const centerR = (AI_ROWS - 1) / 2;
    const centerC = (AI_COLS - 1) / 2;
    const dist = Math.abs(row - centerR) + Math.abs(col - centerC);
    score += (20 - dist) * 6; // stronger center preference

    // === 7. Adjacency to own pions (build clusters) ===
    let adj = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (inBounds(nr, nc) && grid[nr][nc] === aiPlayerId) adj++;
      }
    }
    score += adj * 50; // favor building clusters aggressively

    // === 8. Avoid cells adjacent to opponent clusters (don't feed their squares) ===
    let oppAdj = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = row + dr;
        const nc = col + dc;
        if (
          inBounds(nr, nc) &&
          grid[nr][nc] !== null &&
          grid[nr][nc] !== aiPlayerId
        ) {
          oppAdj++;
        }
      }
    }
    score -= oppAdj * 5;

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [cell];
    } else if (score === bestScore) {
      bestMoves.push(cell);
    }
  }

  // Pick randomly among equally-best moves (for variety)
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
