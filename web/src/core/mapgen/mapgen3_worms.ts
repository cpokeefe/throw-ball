/**
 * ══════════════════════════════════════════════════════════════
 * STRATEGY 3 — WORM COLONY TUNNELING
 * ══════════════════════════════════════════════════════════════
 *
 * An AGENT-BASED map generator inspired by biological tunneling organisms.
 * Multiple autonomous "worm" agents are released into a solid rock grid
 * and carve tunnels as they wander, occasionally excavating larger chambers.
 *
 * ── THE ALGORITHM ──
 *
 * 1. SOLID ROCK START
 *    The entire map begins as Wall — solid, impassable rock.
 *
 * 2. WORM SPAWNING
 *    6-10 worms are spawned at strategic positions:
 *      • 2 worms near the center (guarantees a central hub)
 *      • 1 worm near each goal edge (guarantees goal reachability)
 *      • 2-6 worms at random interior positions (variety)
 *
 *    Each worm is initialized with:
 *      - position: starting (x, y) coordinate
 *      - direction: one of N/E/S/W
 *      - lifetime: 60-200 steps before the worm "dies"
 *      - width: 1-2 tiles (how wide the tunnel is)
 *      - turnChance: 0.2-0.35 probability of changing direction each step
 *      - roomChance: 0.06-0.12 probability of carving a room each step
 *
 * 3. SIMULATION LOOP
 *    Each tick, every living worm:
 *      a) CARVES floor tiles at its current position (1-2 tiles wide)
 *      b) MAYBE TURNS: with probability turnChance, picks a new random
 *         direction. Worms prefer directions that lead into solid rock
 *         (floor-adjacent directions get a penalty), producing longer
 *         tunnels before they double back.
 *      c) MAYBE CARVES A ROOM: with probability roomChance, excavates
 *         a circular chamber (radius 2-4) centered on the worm. This
 *         creates natural "junction" rooms at random intervals.
 *      d) MOVES FORWARD one tile in its current direction
 *      e) BOUNCES off map edges instead of dying (reverses direction)
 *      f) LIFETIME decreases by 1; worm dies at 0
 *
 *    The simulation runs until all worms have expired.
 *
 * 4. POST-PROCESSING
 *    Flood-fill connectivity check + tunnel carving to guarantee
 *    all excavated regions are reachable from each other.
 *
 * ── GAMEPLAY CHARACTER ──
 * Winding, unpredictable tunnel networks with occasional large chambers.
 * Each seed produces a radically different layout. The overlapping paths
 * of multiple worms create natural intersections and alternate routes.
 * Tunnels tend to be narrow (1-2 tiles), making throws risky but
 * movement strategic.
 */

import { createRng, Random } from "../random";
import { isInside } from "../geometry";
import { GameMap, Tile } from "../types";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  createEmptyGrid,
  enforcePerimeter,
  placeGoals,
  ensureConnectivity,
  collectFloorClusters,
} from "./mapgenUtils";

interface Worm {
  x: number;
  y: number;
  /** Current heading: 0=N, 1=E, 2=S, 3=W */
  dir: number;
  lifetime: number;
  width: number;
  turnChance: number;
  roomChance: number;
}

const DIR_DX = [0, 1, 0, -1];
const DIR_DY = [1, 0, -1, 0];

export function generateWormColony(
  seed: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): GameMap {
  const rng = createRng(seed);
  const tiles = createEmptyGrid(width, height, Tile.Wall);

  const midX = (width / 2) | 0;
  const midY = (height / 2) | 0;

  // ── Spawn worms ──
  const worms: Worm[] = [];

  // Two worms near the center — ensures a navigable hub area
  worms.push(createWorm(rng, midX - 2, midY, rng.int(0, 4)));
  worms.push(createWorm(rng, midX + 2, midY, rng.int(0, 4)));

  // One worm near each goal edge — ensures goal connectivity
  worms.push(createWorm(rng, 4, midY + rng.int(-3, 4), 1));
  worms.push(createWorm(rng, width - 5, midY + rng.int(-3, 4), 3));

  // Additional random worms for variety
  const extraWorms = rng.int(2, 7);
  for (let i = 0; i < extraWorms; i++) {
    const wx = rng.int(5, width - 5);
    const wy = rng.int(3, height - 3);
    worms.push(createWorm(rng, wx, wy, rng.int(0, 4)));
  }

  // ── Run simulation ──
  let anyAlive = true;
  while (anyAlive) {
    anyAlive = false;
    for (const worm of worms) {
      if (worm.lifetime <= 0) continue;
      anyAlive = true;
      stepWorm(rng, worm, tiles, width, height);
    }
  }

  // ── Post-processing ──
  ensureConnectivity(tiles, width, height);
  enforcePerimeter(tiles, width, height);
  placeGoals(tiles, width, height);

  return {
    width,
    height,
    tiles,
    rooms: collectFloorClusters(tiles, width, height),
  };
}

function createWorm(rng: Random, x: number, y: number, dir: number): Worm {
  return {
    x,
    y,
    dir,
    lifetime: rng.int(60, 201),
    width: rng.int(1, 3),
    turnChance: 0.2 + rng.next() * 0.15,
    roomChance: 0.06 + rng.next() * 0.06,
  };
}

/**
 * Advances a single worm by one tick:
 *   1. Carve floor at current position
 *   2. Maybe turn
 *   3. Maybe excavate a room
 *   4. Move forward
 *   5. Bounce off edges
 */
function stepWorm(
  rng: Random,
  worm: Worm,
  tiles: Tile[][],
  width: number,
  height: number,
): void {
  // Carve the tunnel at current position
  carveAt(tiles, worm.x, worm.y, worm.width, width, height);

  // Random turn — biased toward unexplored (wall) directions
  if (rng.next() < worm.turnChance) {
    worm.dir = pickNewDirection(rng, worm, tiles, width, height);
  }

  // Random room excavation
  if (rng.next() < worm.roomChance) {
    const radius = rng.int(2, 5);
    carveCircle(tiles, worm.x, worm.y, radius, width, height);
  }

  // Move forward
  const nx = worm.x + DIR_DX[worm.dir];
  const ny = worm.y + DIR_DY[worm.dir];

  // Bounce off map edges (stay inside the 1-tile border)
  if (nx <= 1 || nx >= width - 2 || ny <= 1 || ny >= height - 2) {
    worm.dir = (worm.dir + 2) % 4; // reverse direction
  } else {
    worm.x = nx;
    worm.y = ny;
  }

  worm.lifetime--;
}

/**
 * Picks a new direction for the worm, weighted so that directions
 * leading into solid rock (Wall) are preferred. This makes worms
 * explore outward into new territory rather than retracing old tunnels.
 *
 * Each direction gets a score:
 *   - Direction leads to Wall → score 3
 *   - Direction leads to Floor → score 1
 *   - Direction goes off-map → score 0
 *
 * A direction is chosen proportionally to these scores.
 */
function pickNewDirection(
  rng: Random,
  worm: Worm,
  tiles: Tile[][],
  width: number,
  height: number,
): number {
  const scores: number[] = [0, 0, 0, 0];
  let totalScore = 0;

  for (let d = 0; d < 4; d++) {
    const nx = worm.x + DIR_DX[d] * 2;
    const ny = worm.y + DIR_DY[d] * 2;
    if (!isInside(nx, ny, width, height)) {
      scores[d] = 0;
    } else if (tiles[nx][ny] === Tile.Wall) {
      scores[d] = 3;
    } else {
      scores[d] = 1;
    }
    totalScore += scores[d];
  }

  if (totalScore === 0) return worm.dir;

  let roll = rng.next() * totalScore;
  for (let d = 0; d < 4; d++) {
    roll -= scores[d];
    if (roll <= 0) return d;
  }
  return worm.dir;
}

/**
 * Carves a rectangular patch of floor tiles centered on (cx, cy).
 * Width determines how many tiles wide the tunnel cross-section is.
 */
function carveAt(
  tiles: Tile[][],
  cx: number,
  cy: number,
  w: number,
  mapW: number,
  mapH: number,
): void {
  const half = (w / 2) | 0;
  for (let dx = -half; dx <= half; dx++) {
    for (let dy = -half; dy <= half; dy++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 1 && x < mapW - 1 && y >= 1 && y < mapH - 1) {
        tiles[x][y] = Tile.Floor;
      }
    }
  }
}

/**
 * Excavates a circular chamber by carving all tiles within `radius`
 * Manhattan distance of (cx, cy). Uses Euclidean distance for a rounder
 * shape: tiles where dx² + dy² ≤ r² become floor.
 */
function carveCircle(
  tiles: Tile[][],
  cx: number,
  cy: number,
  radius: number,
  mapW: number,
  mapH: number,
): void {
  const r2 = radius * radius;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x >= 1 && x < mapW - 1 && y >= 1 && y < mapH - 1) {
        tiles[x][y] = Tile.Floor;
      }
    }
  }
}
