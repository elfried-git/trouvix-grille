import type { AIProfile } from "@/lib/types";

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

function countSquaresCompletedByMove(
  grid: AIGrid,
  row: number,
  col: number,
  playerId: string
): number {
  const offsets: [number, number][] = [
    [0, 0],
    [0, -1],
    [-1, 0],
    [-1, -1],
  ];
  let count = 0;
  for (const [dr, dc] of offsets) {
    const r0 = row + dr;
    const c0 = col + dc;
    if (!inBounds(r0, c0) || !inBounds(r0 + 1, c0 + 1)) continue;
    if (
      (r0 === row && c0 === col || grid[r0][c0] === playerId) &&
      (r0 === row && c0 + 1 === col || grid[r0][c0 + 1] === playerId) &&
      (r0 + 1 === row && c0 === col || grid[r0 + 1][c0] === playerId) &&
      (r0 + 1 === row && c0 + 1 === col || grid[r0 + 1][c0 + 1] === playerId)
    ) {
      count++;
    }
  }
  return count;
}

// Find all empty cells that would complete a 2x2 square for playerId.
function findWinningCells(grid: AIGrid, playerId: string): AICell[] {
  const wins: AICell[] = [];
  for (let r = 0; r < AI_ROWS; r++) {
    for (let c = 0; c < AI_COLS; c++) {
      if (grid[r][c] !== null) continue;
      if (countSquaresCompletedByMove(grid, r, c, playerId) > 0) {
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

// Threat squares with exactly one open cell can be won on the next turn.
function countImmediateThreats(grid: AIGrid, playerId: string): number {
  return findWinningCells(grid, playerId).length;
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

function countForks(grid: AIGrid, playerId: string): number {
  let forks = 0;
  for (const { row, col } of emptyCells(grid)) {
    const test = cloneGrid(grid);
    test[row][col] = playerId;
    const threats = countThreats(test, playerId);
    if (threats >= 2) forks += 1;
  }
  return forks;
}

function opponentImmediateWinCells(grid: AIGrid, opponentIds: string[]): AICell[] {
  const cells: AICell[] = [];
  for (const oppId of opponentIds) {
    for (const win of findWinningCells(grid, oppId)) {
      if (!cells.some((c) => c.row === win.row && c.col === win.col)) {
        cells.push(win);
      }
    }
  }
  return cells;
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
  opponentIds: string[],
  profile: AIProfile = "gpt"
): AICell | null {
  const empties = emptyCells(grid);
  if (empties.length === 0) return null;

  // The high difficulty setting uses the same strong tactical priorities for
  // every profile; profiles only influence positional style and tie-breaking.
  const difficulty = 0.95;

  // === 1. Immediate win ===
  const myWins = findWinningCells(grid, aiPlayerId);
  if (myWins.length > 0) {
    return myWins.reduce((best, move) =>
      countSquaresCompletedByMove(grid, move.row, move.col, aiPlayerId) >
      countSquaresCompletedByMove(grid, best.row, best.col, aiPlayerId)
        ? move
        : best
    );
  }

  // === 2. Block opponent's immediate win ===
  const opponentWins = opponentImmediateWinCells(grid, opponentIds);
  const oppWinSet = new Set(opponentWins.map((c) => `${c.row},${c.col}`));

  let bestScore = -Infinity;
  let bestMoves: AICell[] = [];

  const strategies: Record<AIProfile, { block: number; threat: number; potential: number; fork: number; risk: number; neutralize: number; center: number; adjacency: number }> = {
    gpt: { block: 50000, threat: 7800, potential: 420, fork: 25000, risk: 32000, neutralize: 5200, center: 6, adjacency: 50 },
    gemini: { block: 48000, threat: 8500, potential: 650, fork: 36000, risk: 30000, neutralize: 5000, center: 7, adjacency: 55 },
    claude: { block: 80000, threat: 7200, potential: 400, fork: 26000, risk: 58000, neutralize: 9000, center: 8, adjacency: 35 },
    grok: { block: 42000, threat: 10800, potential: 300, fork: 22000, risk: 22000, neutralize: 4200, center: 4, adjacency: 100 },
    copilot: { block: 65000, threat: 8200, potential: 600, fork: 28000, risk: 42000, neutralize: 7600, center: 14, adjacency: 48 },
    kimi: { block: 55000, threat: 9000, potential: 740, fork: 38000, risk: 38000, neutralize: 6500, center: 10, adjacency: 62 },
    siri: { block: 55000, threat: 9000, potential: 740, fork: 38000, risk: 38000, neutralize: 6500, center: 10, adjacency: 62 },
  };
  const strategy = strategies[profile] ?? strategies.gpt;
  const threatsBefore = opponentIds.map((id) => countImmediateThreats(grid, id));
  const candidateScores: { cell: AICell; score: number; opponentWins: number }[] = [];
  let fewestOpponentWins = Infinity;

  for (const cell of empties) {
    const { row, col } = cell;
    let score = 0;

    // Blocking: if this cell is an opponent's winning cell, big bonus
    if (oppWinSet.has(`${row},${col}`)) {
      score += strategy.block;
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
    score += myThreatsAfter * strategy.threat * difficulty;
    const myImmediateThreats = countImmediateThreats(afterAI, aiPlayerId);
    score += myImmediateThreats * 18000 * difficulty;

    // Potential squares (2/4)
    const myPotentialAfter = countPotential(afterAI, aiPlayerId);
    score += myPotentialAfter * strategy.potential;

    // === 3b. Fork creation: if this move creates multiple immediate threats, big bonus ===
    const myForksAfter = countForks(afterAI, aiPlayerId);
    score += myForksAfter * strategy.fork * difficulty;

    // === 4. Anti-suicide: after AI plays, can any opponent win immediately? ===
    let oppImmediateWinCount = 0;
    for (let i = 0; i < opponentIds.length; i++) {
      const oppId = opponentIds[i];
      const winsAfter = countImmediateThreats(afterAI, oppId);
      oppImmediateWinCount += winsAfter;
      // Block the opponent's developing 2-of-4 patterns before they mature.
      const oppPotentialBefore = countPotential(grid, oppId);
      const oppPotentialAfter = countPotential(afterAI, oppId);
      score += (oppPotentialBefore - oppPotentialAfter) * 900 * difficulty;
      score -= Math.max(0, winsAfter - threatsBefore[i]) * 16000 * difficulty;
    }
    fewestOpponentWins = Math.min(fewestOpponentWins, oppImmediateWinCount);
    if (oppImmediateWinCount > 0) {
      score -= oppImmediateWinCount > 1 ? strategy.risk * 4 : strategy.risk * 1.8;
    }

    // === 5. Reduce opponent's existing threats ===
    for (const oppId of opponentIds) {
      const oppThreatsBefore = countThreats(grid, oppId);
      const oppThreatsAfter = countThreats(afterAI, oppId);
      if (oppThreatsAfter < oppThreatsBefore) {
        score += strategy.neutralize;
      }
      if (oppThreatsAfter === 0 && oppThreatsBefore > 0) {
        score += strategy.neutralize * 0.86; // fully neutralize an existing threat
      }
    }

    // === 5b. Penalize moves that create opponent forks ===
    let opponentForks = 0;
    for (const oppId of opponentIds) {
      opponentForks += countForks(afterAI, oppId);
    }
    if (opponentForks > 0) {
      score -= opponentForks * 45000 * difficulty;
    }

    // === 6. Center preference ===
    const centerR = (AI_ROWS - 1) / 2;
    const centerC = (AI_COLS - 1) / 2;
    const dist = Math.abs(row - centerR) + Math.abs(col - centerC);
    score += (20 - dist) * strategy.center;

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
    score += adj * strategy.adjacency;

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

    candidateScores.push({ cell, score, opponentWins: oppImmediateWinCount });
  }

  // Never prefer a positional bonus over preventing an opponent's immediate win.
  const safestCandidates = candidateScores.filter(
    (candidate) => candidate.opponentWins === fewestOpponentWins
  );
  const shortlist = safestCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  for (const candidate of shortlist) {
    const afterAI = cloneGrid(grid);
    afterAI[candidate.cell.row][candidate.cell.col] = aiPlayerId;
    let worstReply = 0;

    for (let i = 0; i < opponentIds.length; i++) {
      const opponentId = opponentIds[i];
      const threatsBeforeReply = countThreats(afterAI, opponentId);
      const potentialBeforeReply = countPotential(afterAI, opponentId);

      for (const reply of emptyCells(afterAI)) {
        afterAI[reply.row][reply.col] = opponentId;
        const completedSquares = countSquaresCompletedByMove(
          afterAI,
          reply.row,
          reply.col,
          opponentId
        );
        const threatsAfterReply = countThreats(afterAI, opponentId);
        const potentialAfterReply = countPotential(afterAI, opponentId);
        const aiWinningReplies = countImmediateThreats(afterAI, aiPlayerId);
        const replyScore =
          completedSquares * 100000 +
          Math.max(0, threatsAfterReply - threatsBeforeReply) * 10000 +
          Math.max(0, potentialAfterReply - potentialBeforeReply) * 500 -
          aiWinningReplies * 14000;
        worstReply = Math.max(worstReply, replyScore);
        afterAI[reply.row][reply.col] = null;
      }
    }

    const finalScore = candidate.score - worstReply * difficulty;
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMoves = [candidate.cell];
    } else if (finalScore === bestScore) {
      bestMoves.push(candidate.cell);
    }
  }

  // Pick randomly among equally-best moves (for variety)
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}
