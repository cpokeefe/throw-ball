/**
 * Shared utilities for all CPU strategies.
 *
 * Re-exports geometry helpers and provides CPU-specific functions for:
 * - Map queries (walkability, player detection)
 * - Goal identification
 * - Throw scoring / line-of-sight checks
 * - Ball landing prediction
 * - BFS pathfinding
 * - Seeded RNG
 */

import { DIR_TO_DELTA, isAdjacent, isInside, manhattan, sameCoord } from "../geometry";
import { Coordinate, Direction, GameState, Tile } from "../types";

export { DIR_TO_DELTA, isAdjacent, isInside, manhattan, sameCoord };

export const CPU_DIRS: readonly Direction[] = ["N", "E", "S", "W"];

export function isWalkable(state: GameState, x: number, y: number): boolean {
  return isInside(x, y, state.map.width, state.map.height) && state.map.tiles[x][y] === Tile.Floor;
}

export function isPlayerAt(state: GameState, x: number, y: number): boolean {
  return sameCoord(state.players[1].position, { x, y }) || sameCoord(state.players[2].position, { x, y });
}

export function goalTileForPlayer(state: GameState, playerId: 1 | 2, swapped = state.goalsSwapped): Tile.Goal1 | Tile.Goal2 {
  if (!swapped) return playerId === 1 ? Tile.Goal1 : Tile.Goal2;
  return playerId === 1 ? Tile.Goal2 : Tile.Goal1;
}

export function opponentGoalTileForPlayer(state: GameState, playerId: 1 | 2): Tile.Goal1 | Tile.Goal2 {
  return goalTileForPlayer(state, playerId) === Tile.Goal1 ? Tile.Goal2 : Tile.Goal1;
}

export function ownGoalTileForPlayer(state: GameState, playerId: 1 | 2): Tile.Goal1 | Tile.Goal2 {
  return goalTileForPlayer(state, playerId);
}

/** LCG-based seeded random: returns [0..1) float and next state. */
export function randomUnit(rngState: number): [number, number] {
  let s = rngState >>> 0;
  s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
  return [s / 4294967296, s];
}

/**
 * Check if throwing from `from` in direction `dir` would reach the goal tile.
 * When ignoreP1 is true, pretend P1 isn't on the map (for planning where to move).
 */
export function throwScores(
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

/** Find a direction the CPU can throw from its current position to score. */
export function scoringThrowDir(state: GameState): Direction | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  const ordered: Direction[] = [cpu.direction, ...CPU_DIRS.filter(d => d !== cpu.direction)];
  for (const dir of ordered) {
    if (throwScores(state, cpu.position, dir, oppGoal, false)) return dir;
  }
  return null;
}

/** Best direction to throw toward opponent's side of the map (fallback when can't score). */
export function bestReleaseDir(state: GameState): Direction | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  const goalIsLeft = oppGoal === Tile.Goal1;
  const preferred: Direction[] = goalIsLeft ? ["W", "N", "S", "E"] : ["E", "N", "S", "W"];
  for (const dir of preferred) {
    const delta = DIR_TO_DELTA[dir];
    const x = cpu.position.x + delta.x;
    const y = cpu.position.y + delta.y;
    if (isWalkable(state, x, y) && !isPlayerAt(state, x, y)) return dir;
  }
  return null;
}

/** Predict where a ball currently in flight will come to rest. */
export function predictBallLanding(state: GameState): Coordinate {
  if (!state.ball.inFlight || state.ball.direction === null) return state.ball.position;
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

/** BFS from `from` toward `to`. Returns the first cardinal step direction, or null. */
export function bfsFirstStep(
  state: GameState,
  from: Coordinate,
  to: Coordinate,
  reachAdjacent: boolean,
): Direction | null {
  if (reachAdjacent ? isAdjacent(from, to) : sameCoord(from, to)) return null;

  const { width, height, tiles } = state.map;
  const p1 = state.players[1].position;
  const ball = state.ball.position;
  const key = (x: number, y: number): number => x * height + y;

  const visited = new Uint8Array(width * height);
  const origin: (Direction | null)[] = new Array(width * height).fill(null);
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

/** Find the average X coordinate of all opponent goal tiles. */
export function opponentGoalX(state: GameState): number {
  const goalTile = opponentGoalTileForPlayer(state, 2);
  let sumX = 0;
  let count = 0;
  for (let x = 0; x < state.map.width; x++) {
    for (let y = 0; y < state.map.height; y++) {
      if (state.map.tiles[x][y] === goalTile) { sumX += x; count++; }
    }
  }
  return count > 0 ? sumX / count : (goalTile === Tile.Goal1 ? 0 : state.map.width - 1);
}

/** Find the average Y coordinate of all opponent goal tiles. */
export function opponentGoalY(state: GameState): number {
  const goalTile = opponentGoalTileForPlayer(state, 2);
  let sumY = 0;
  let count = 0;
  for (let x = 0; x < state.map.width; x++) {
    for (let y = 0; y < state.map.height; y++) {
      if (state.map.tiles[x][y] === goalTile) { sumY += y; count++; }
    }
  }
  return count > 0 ? sumY / count : state.map.height / 2;
}

/** Find the first legal cardinal direction to move in (N, E, S, W order). */
export function anyLegalDir(state: GameState): Direction | null {
  const cpu = state.players[2];
  for (const dir of CPU_DIRS) {
    const d = DIR_TO_DELTA[dir];
    const nx = cpu.position.x + d.x;
    const ny = cpu.position.y + d.y;
    if (isWalkable(state, nx, ny) && !isPlayerAt(state, nx, ny)) return dir;
  }
  return null;
}
