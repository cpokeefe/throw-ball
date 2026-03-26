/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STRATEGY 0 — ORIGINAL CPU (before any changes)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This is the exact CPU logic from before the strategy system was added,
 * preserved as a baseline for comparison. Below is a breakdown of how
 * it works and where it tends to get stuck.
 *
 * ─── OVERVIEW ───
 *
 *   The original CPU follows a priority chain each decision tick:
 *
 *     1. If flying → do nothing (wait for fly to finish).
 *     2. If adjacent to a loose ball → grab it (ACTION).
 *     3. If adjacent to P1 who has ball → punch (ACTION).
 *     4. If CPU has ball → run the "with ball" subroutine.
 *     5. If CPU doesn't have ball → run the "without ball" subroutine.
 *
 * ─── WITH BALL ───
 *
 *   cpuWithBall tries three things in order:
 *
 *   A) CAN I SCORE FROM HERE? (cpuScoringThrowDir)
 *      Ray-cast from the CPU's current position in each cardinal
 *      direction (trying the direction it's already facing first).
 *      If the ray hits the opponent's goal tile without being blocked
 *      by walls or P1, that direction is a scoring throw.
 *      → If found and already facing it: throw (ACTION).
 *      → If found but facing wrong way: turn to face it (MOVE).
 *
 *   B) AM I OUT OF STEPS? (stepsLeft === 0)
 *      The ball carrier can only take 5 steps before being forced to
 *      throw. When out of steps, cpuFaceAndThrow picks the "best
 *      release direction" — prioritizing toward the opponent's goal
 *      side — and throws.
 *
 *   C) FIND A SCORING POSITION (cpuFindScoringTarget)
 *      This is the expensive part. Scans EVERY floor tile on the
 *      entire map, and for each one checks if throwing in any
 *      direction would score — BUT with ignoreP1=true, meaning it
 *      pretends P1 doesn't exist for this check. Picks the closest
 *      such tile by Manhattan distance, then BFS-paths toward it.
 *
 *      ⚠ KEY BUG: This is the #1 source of "getting stuck." The CPU
 *      walks to a tile where it WOULD be able to score if P1 wasn't
 *      there. But when it arrives, P1 IS there, so the actual throw
 *      check (with ignoreP1=false) fails. The CPU then falls through
 *      to cpuFaceAndThrow, which just throws in a bad direction.
 *      Next tick, if it grabs the ball again, it repeats the cycle.
 *
 *   D) FALLBACK: cpuFaceAndThrow — face the opponent's side and throw.
 *
 * ─── WITHOUT BALL ───
 *
 *   cpuWithoutBall tries three things:
 *
 *   A) FLY HANDLING
 *      If fly is already armed: pick the best fly direction toward
 *      the ball target, or un-arm fly if no good direction exists.
 *      If fly is not armed and the ball is far (≥8 Manhattan): arm fly.
 *
 *   B) BFS TO BALL (cpuBfsFirstStep)
 *      Standard BFS pathfinding from CPU position toward the ball
 *      (or predicted ball landing if it's in flight). Uses cardinal
 *      directions only. Cannot path through P1 or the ball tile.
 *      reachAdjacent=true means it stops when it reaches a cell
 *      adjacent to the target (so it can grab with ACTION).
 *
 *      ⚠ STUCK SCENARIO: If P1 is blocking the only path to the ball,
 *      BFS returns null. Falls through to cpuMoveAnywhere.
 *
 *   C) cpuMoveAnywhere — tries N, E, S, W in fixed order. Takes the
 *      first one that actually changes position. If ALL are blocked
 *      (very rare — boxed in), returns state unchanged = CPU is frozen.
 *
 * ─── HELPER FUNCTIONS ───
 *
 *   cpuBallTarget:
 *     If ball is on the ground → target is ball position.
 *     If ball is in flight → ray-cast along its direction until it
 *     would hit a wall. Target is the last walkable tile (predicted
 *     landing spot).
 *
 *   cpuThrowScores:
 *     Ray-cast from a position in a direction. Checks:
 *     - First tile must be walkable and not blocked by a player.
 *     - Subsequent tiles must be floor or goal. If goal → true.
 *     - If wall, out of bounds, or player → false.
 *     The ignoreP1 flag skips the player-blocking check, used for
 *     planning (finding where to walk) vs. actual throwing.
 *
 *   cpuBfsFirstStep:
 *     BFS on the floor grid. Treats P1 and (optionally) the ball
 *     as impassable obstacles. Returns only the FIRST step direction,
 *     not the full path. The "origin" array tracks which direction
 *     was taken from the start for each cell, so backtracking is O(1).
 *
 *   cpuShouldFly / cpuBestFlyDir:
 *     Only considers fly if target is ≥8 tiles away. Simulates
 *     sliding in each direction until hitting a wall/player/ball.
 *     Only considers directions with a slide run ≥3 tiles. Picks
 *     the direction whose landing position is closest to the target.
 *
 * ─── KNOWN ISSUES ───
 *
 *   1. PLANNING VS EXECUTION MISMATCH (the big one):
 *      cpuFindScoringTarget uses ignoreP1=true to find where to walk,
 *      but cpuScoringThrowDir uses ignoreP1=false to actually throw.
 *      The CPU walks to a "scoring position" that only works if P1
 *      isn't in the way, then finds P1 IS in the way, can't score,
 *      and throws randomly.
 *
 *   2. NO ANTI-STUCK MECHANISM:
 *      No position history, no timeout, no random jitter. If BFS
 *      fails and cpuMoveAnywhere tries N/E/S/W in that fixed order,
 *      it will always pick the same direction, potentially oscillating
 *      forever between two tiles.
 *
 *   3. cpuMoveAnywhere IS TOO SIMPLE:
 *      Fixed order (N, E, S, W) with no randomization means the CPU
 *      always breaks ties the same way. In corridors, this creates
 *      predictable and repetitive movement.
 *
 *   4. DIFFICULTY ONLY CHANGES SPEED:
 *      Easy/medium/hard only change the tick rate (500/250/100ms).
 *      The CPU makes the SAME decisions at all difficulties — just
 *      faster or slower.
 */

import { applyAction, applyMove, toggleFly } from "../update";
import { GameState, Coordinate, Direction, Tile } from "../types";
import {
  CPU_DIRS,
  DIR_TO_DELTA,
  isAdjacent,
  isInside,
  isWalkable,
  isPlayerAt,
  manhattan,
  sameCoord,
  opponentGoalTileForPlayer,
} from "./cpuUtils";

const CPU_MIN_FLY_RUN = 3;
const CPU_FLY_DISTANCE_THRESHOLD = 8;

/**
 * Main entry point. Called every CPU tick (100–500ms depending on difficulty).
 * Always controls player 2.
 */
export function applyCpuDecision(state: GameState): GameState {
  const cpu = state.players[2];
  const p1 = state.players[1];

  // While flying, the CPU can't do anything — fly auto-advances via advanceAutoFly
  if (cpu.isFlying) return state;

  // Priority 1: if standing next to a loose ball, grab it immediately
  if (!cpu.hasBall && !state.ball.inFlight && isAdjacent(cpu.position, state.ball.position)) {
    return applyAction(state, 2);
  }

  // Priority 2: if standing next to P1 who has the ball, punch to try to steal
  if (isAdjacent(cpu.position, p1.position) && p1.hasBall) {
    return applyAction(state, 2);
  }

  // Branch: different logic depending on whether CPU has the ball
  return cpu.hasBall ? cpuWithBall(state) : cpuWithoutBall(state);
}

/**
 * CPU has the ball. Try to score, or navigate to a scoring position,
 * or just throw it toward the opponent's side as a last resort.
 */
function cpuWithBall(state: GameState): GameState {
  const cpu = state.players[2];

  // Step A: can we score from right here?
  // Ray-casts in all 4 directions (current facing first) to check
  // if the throw would reach the opponent's goal without being blocked.
  const throwDir = cpuScoringThrowDir(state);
  if (throwDir !== null) {
    // Already facing the scoring direction → throw
    if (cpu.direction === throwDir) return applyAction(state, 2);
    // Need to turn first → face that direction (also moves 1 tile)
    return applyMove(state, 2, throwDir);
  }

  // Step B: out of movement budget → forced to throw in the best available direction
  if (cpu.stepsLeft === 0) {
    return cpuFaceAndThrow(state);
  }

  // Step C: find the nearest floor tile that has line-of-sight to goal
  // (ignoring P1 for the planning check — this is the source of the bug)
  const target = cpuFindScoringTarget(state);
  if (target !== null) {
    // BFS toward that tile; reachAdjacent=false means we want to stand ON the tile
    const step = cpuBfsFirstStep(state, cpu.position, target, false);
    if (step !== null) return applyMove(state, 2, step);
  }

  // Step D: nothing worked — just throw toward the opponent's side
  return cpuFaceAndThrow(state);
}

/**
 * Face the best open direction (toward opponent's goal side) and throw.
 * Used as a last resort when the CPU can't find a scoring position.
 */
function cpuFaceAndThrow(state: GameState): GameState {
  const cpu = state.players[2];
  const releaseDir = cpuBestReleaseDir(state);
  // If not already facing the release direction, turn first
  if (releaseDir !== null && cpu.direction !== releaseDir) {
    return applyMove(state, 2, releaseDir);
  }
  // Throw (or waste the tick if blocked — applyAction handles that)
  return applyAction(state, 2);
}

/**
 * Pick the "best" direction to throw when we can't score directly.
 * Prefers throwing toward the opponent's goal side (W if goal is left,
 * E if goal is right), then N/S as neutral options, then backward.
 * Only picks directions where the first tile is walkable and unoccupied.
 */
function cpuBestReleaseDir(state: GameState): Direction | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  const goalIsLeft = oppGoal === Tile.Goal1;
  const preferred: Direction[] = goalIsLeft
    ? ["W", "N", "S", "E"]
    : ["E", "N", "S", "W"];

  for (const dir of preferred) {
    const delta = DIR_TO_DELTA[dir];
    const x = cpu.position.x + delta.x;
    const y = cpu.position.y + delta.y;
    if (isWalkable(state, x, y) && !isPlayerAt(state, x, y)) {
      return dir;
    }
  }
  return null;
}

/**
 * CPU doesn't have the ball. Chase it — with fly for long distances,
 * BFS for short, and a dumb fallback if BFS fails.
 */
function cpuWithoutBall(state: GameState): GameState {
  const cpu = state.players[2];
  const target = cpuBallTarget(state);

  // If fly is already armed, pick a fly direction toward the ball target
  if (cpu.flyArmed) {
    const dir = cpuBestFlyDir(state, target);
    if (dir !== null) return applyMove(state, 2, dir); // triggers the fly slide
    return toggleFly(state, 2); // no good fly direction → un-arm
  }

  // Consider arming fly if the ball is far away (≥8 tiles)
  if (cpuShouldFly(state, target)) {
    return toggleFly(state, 2);
  }

  // BFS toward the ball; reachAdjacent=true so we stop next to it (to grab)
  const step = cpuBfsFirstStep(state, cpu.position, target, true);
  if (step !== null) return applyMove(state, 2, step);

  // BFS failed (path blocked by P1, walls, or ball itself) — try any direction
  return cpuMoveAnywhere(state);
}

/**
 * Determine what the CPU should be chasing:
 * - If ball is on the ground → just go to the ball's current position.
 * - If ball is in flight → predict where it will land by ray-casting
 *   along its flight direction until hitting a non-walkable tile.
 */
function cpuBallTarget(state: GameState): Coordinate {
  if (!state.ball.inFlight || state.ball.direction === null) {
    return state.ball.position;
  }
  const delta = DIR_TO_DELTA[state.ball.direction];
  let x = state.ball.position.x;
  let y = state.ball.position.y;
  for (;;) {
    const nx = x + delta.x;
    const ny = y + delta.y;
    if (!isWalkable(state, nx, ny)) return { x, y };
    x = nx;
    y = ny;
  }
}

/**
 * Absolute last resort: try each direction N, E, S, W in that fixed order.
 * Take the first one that results in the CPU actually moving.
 * If completely boxed in, returns state unchanged (CPU is frozen).
 *
 * ⚠ This fixed ordering (always tries N first) is a source of
 * predictable/repetitive behavior when BFS fails.
 */
function cpuMoveAnywhere(state: GameState): GameState {
  const cpu = state.players[2];
  for (const dir of CPU_DIRS) {
    const moved = applyMove(state, 2, dir);
    if (!sameCoord(moved.players[2].position, cpu.position)) {
      return moved;
    }
  }
  return state;
}

// ── Scoring helpers ──────────────────────────────────────────

/**
 * Check if the CPU can score from its current position in any direction.
 * Tries the direction the CPU is already facing first (so it doesn't
 * need to turn). Returns the first scoring direction, or null.
 */
function cpuScoringThrowDir(state: GameState): Direction | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  const ordered = [cpu.direction, ...CPU_DIRS.filter(d => d !== cpu.direction)];
  for (const dir of ordered) {
    if (cpuThrowScores(state, cpu.position, dir, oppGoal, false)) return dir;
  }
  return null;
}

/**
 * Ray-cast from `from` in direction `dir`. Returns true if the ray
 * reaches `goalTile` without being blocked.
 *
 * When ignoreP1=false (actual throw check): P1 blocks the ray.
 * When ignoreP1=true (planning check): pretends P1 doesn't exist.
 *
 * The first tile must be walkable and unblocked (can't throw into
 * the wall directly in front of you).
 */
function cpuThrowScores(
  state: GameState,
  from: Coordinate,
  dir: Direction,
  goalTile: Tile.Goal1 | Tile.Goal2,
  ignoreP1: boolean,
): boolean {
  const delta = DIR_TO_DELTA[dir];
  let x = from.x + delta.x;
  let y = from.y + delta.y;
  if (!isWalkable(state, x, y)) return false;
  if (!ignoreP1 && isPlayerAt(state, x, y)) return false;

  for (;;) {
    x += delta.x;
    y += delta.y;
    if (!isInside(x, y, state.map.width, state.map.height)) return false;
    if (!ignoreP1 && isPlayerAt(state, x, y)) return false;
    const tile = state.map.tiles[x][y];
    if (tile === goalTile) return true;
    if (tile !== Tile.Floor) return false;
  }
}

/**
 * Scan EVERY floor tile on the map. For each one, check if throwing
 * in any direction would score (with ignoreP1=true — this is
 * "optimistic" planning that assumes P1 won't be in the way).
 * Return the closest such tile to the CPU by Manhattan distance.
 *
 * ⚠ This is the root cause of the stuck loop: the CPU walks to a
 * cell that's a scoring line IF P1 vanished, arrives, and then
 * cpuScoringThrowDir (with ignoreP1=false) finds P1 is blocking,
 * so it can't actually score. Falls through to cpuFaceAndThrow.
 */
function cpuFindScoringTarget(state: GameState): Coordinate | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  let best: Coordinate | null = null;
  let bestDist = Infinity;

  for (let x = 0; x < state.map.width; x += 1) {
    for (let y = 0; y < state.map.height; y += 1) {
      if (state.map.tiles[x][y] !== Tile.Floor) continue;
      for (const dir of CPU_DIRS) {
        if (cpuThrowScores(state, { x, y }, dir, oppGoal, true)) {
          const dist = manhattan(cpu.position, { x, y });
          if (dist < bestDist) {
            bestDist = dist;
            best = { x, y };
          }
          break;
        }
      }
    }
  }
  return best;
}

/**
 * BFS on the floor grid from `from` toward `to`.
 * - P1 is always treated as an impassable obstacle.
 * - If reachAdjacent=true, the ball tile is ALSO impassable (so the
 *   CPU can't step on the ball — it needs to stop adjacent to grab).
 * - Returns only the first step direction, not the full path. Uses an
 *   "origin" array that records which direction was first taken from
 *   the start for each discovered cell.
 * - Returns null if no path exists (boxed in or target unreachable).
 */
function cpuBfsFirstStep(
  state: GameState,
  from: Coordinate,
  to: Coordinate,
  reachAdjacent: boolean,
): Direction | null {
  if (reachAdjacent ? isAdjacent(from, to) : sameCoord(from, to)) return null;

  const { width, height, tiles } = state.map;
  const p1 = state.players[1].position;
  const ball = state.ball.position;
  const size = width * height;
  const key = (x: number, y: number): number => x * height + y;

  const visited = new Uint8Array(size);
  const origin: (Direction | null)[] = new Array(size).fill(null);
  const start = key(from.x, from.y);
  visited[start] = 1;

  const queue: number[] = [start];
  let head = 0;

  while (head < queue.length) {
    const ci = queue[head++];
    const cx = (ci / height) | 0;
    const cy = ci % height;

    for (const dir of CPU_DIRS) {
      const d = DIR_TO_DELTA[dir];
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (!isInside(nx, ny, width, height)) continue;
      const ni = key(nx, ny);
      if (visited[ni]) continue;
      if (tiles[nx][ny] !== Tile.Floor) continue;
      if (nx === p1.x && ny === p1.y) continue;
      if (reachAdjacent && nx === ball.x && ny === ball.y) continue;

      visited[ni] = 1;
      origin[ni] = origin[ci] ?? dir;

      const reached = reachAdjacent
        ? isAdjacent({ x: nx, y: ny }, to)
        : nx === to.x && ny === to.y;
      if (reached) return origin[ni]!;

      queue.push(ni);
    }
  }
  return null;
}

// ── Fly helpers ──────────────────────────────────────────────

/**
 * Should the CPU arm fly? Only if the ball target is at least 8 tiles
 * away AND there's a fly direction that would bring us closer.
 */
function cpuShouldFly(state: GameState, target: Coordinate): boolean {
  if (manhattan(state.players[2].position, target) < CPU_FLY_DISTANCE_THRESHOLD) return false;
  return cpuBestFlyDir(state, target) !== null;
}

/**
 * Find the best direction to fly toward `target`.
 * For each cardinal direction, simulate the fly slide (step until
 * hitting wall, P1, or ball). Only consider directions with a slide
 * run of ≥3 tiles. Pick the one whose landing position is closest
 * to the target (must be closer than current position, otherwise
 * flying is pointless).
 */
function cpuBestFlyDir(state: GameState, target: Coordinate): Direction | null {
  const cpu = state.players[2];
  const p1 = state.players[1].position;
  const currentDist = manhattan(cpu.position, target);

  let bestDir: Direction | null = null;
  let bestDist = currentDist;

  for (const dir of CPU_DIRS) {
    const delta = DIR_TO_DELTA[dir];
    let x = cpu.position.x;
    let y = cpu.position.y;
    let run = 0;

    for (;;) {
      const nx = x + delta.x;
      const ny = y + delta.y;
      if (!isWalkable(state, nx, ny)) break;
      if (nx === p1.x && ny === p1.y) break;
      if (sameCoord(state.ball.position, { x: nx, y: ny })) break;
      x = nx;
      y = ny;
      run += 1;
    }

    if (run < CPU_MIN_FLY_RUN) continue;
    const landDist = manhattan({ x, y }, target);
    if (landDist < bestDist) {
      bestDist = landDist;
      bestDir = dir;
    }
  }
  return bestDir;
}
