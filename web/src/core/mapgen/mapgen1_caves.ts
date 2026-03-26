/**
 * ══════════════════════════════════════════════════════════════
 * STRATEGY 1 — CELLULAR AUTOMATA CAVES
 * ══════════════════════════════════════════════════════════════
 *
 * Generates organic, natural-looking cave systems using the same family
 * of algorithms that power Conway's Game of Life — but with rules tuned
 * specifically for producing playable cave terrain.
 *
 * ── THE ALGORITHM ──
 *
 * 1. NOISE SEEDING
 *    Fill every interior cell with random wall/floor at ~52% wall density.
 *    This produces a salt-and-pepper static pattern — pure chaos.
 *
 * 2. AUTOMATA SMOOTHING (5 iterations of the "4-5" rule)
 *    For each cell, count how many of its 8 neighbors (Moore neighborhood)
 *    are walls. Apply:
 *      • wallNeighbors >= 5  →  cell becomes Wall
 *      • wallNeighbors <= 3  →  cell becomes Floor
 *      • wallNeighbors == 4  →  cell keeps its current state
 *
 *    This is a "majority rule with hysteresis." Walls cluster together
 *    into solid masses while isolated walls erode away, forming smooth
 *    cave boundaries. After 4-5 passes, the random noise organizes into
 *    naturalistic cave chambers connected by organic passages.
 *
 *    WHY IT WORKS: The rule is a discrete approximation of surface tension.
 *    Just like soap bubbles minimize surface area, the automata minimizes
 *    the wall/floor boundary — producing smooth, rounded shapes.
 *
 * 3. CONNECTIVITY ENFORCEMENT
 *    Cellular automata can produce isolated cave "pockets" that aren't
 *    reachable from each other. We flood-fill to find all disconnected
 *    floor regions, then carve L-shaped tunnels from each small region
 *    to the largest one.
 *
 * 4. GOAL PLACEMENT
 *    Goals go on the left and right edges, with short corridors carved
 *    inward to connect them to the cave network.
 *
 * ── GAMEPLAY CHARACTER ──
 * Caves produce winding, organic passages with irregularly-shaped chambers.
 * Throws bounce off curved walls unpredictably. Multiple routes exist
 * between any two points, but corridors are narrow enough to create
 * chokepoints for tactical play.
 */

import { createRng } from "../random";
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

const INITIAL_WALL_PROBABILITY = 0.52;
const SMOOTHING_ITERATIONS = 5;

/**
 * Cells with this many or more wall neighbors (out of 8) become walls.
 * At exactly SURVIVE_LIMIT neighbors, the cell keeps its current state
 * (hysteresis prevents oscillation).
 */
const BIRTH_LIMIT = 5;
const SURVIVE_LIMIT = 4;

export function generateCaves(
  seed: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): GameMap {
  const rng = createRng(seed);
  const tiles = createEmptyGrid(width, height, Tile.Wall);

  // ── Step 1: Random noise fill ──
  // Only fill the interior (leave the 1-tile border as Wall).
  for (let x = 1; x < width - 1; x++) {
    for (let y = 1; y < height - 1; y++) {
      tiles[x][y] = rng.next() < INITIAL_WALL_PROBABILITY
        ? Tile.Wall
        : Tile.Floor;
    }
  }

  // ── Step 2: Cellular automata smoothing ──
  // Each pass reads from `tiles` and writes to `next`, then swaps.
  // Allocate a scratch grid once and reuse it each iteration.
  const scratch = createEmptyGrid(width, height, Tile.Wall);

  for (let iter = 0; iter < SMOOTHING_ITERATIONS; iter++) {
    for (let x = 1; x < width - 1; x++) {
      for (let y = 1; y < height - 1; y++) {
        const wallNeighbors = countWallNeighbors(tiles, x, y, width, height);
        if (wallNeighbors >= BIRTH_LIMIT) {
          scratch[x][y] = Tile.Wall;
        } else if (wallNeighbors <= SURVIVE_LIMIT - 1) {
          scratch[x][y] = Tile.Floor;
        } else {
          scratch[x][y] = tiles[x][y];
        }
      }
    }

    for (let x = 1; x < width - 1; x++) {
      for (let y = 1; y < height - 1; y++) {
        tiles[x][y] = scratch[x][y];
      }
    }
  }

  // ── Step 3: Guarantee all floor regions are connected ──
  ensureConnectivity(tiles, width, height);

  // ── Step 4: Finalize borders and goals ──
  enforcePerimeter(tiles, width, height);
  placeGoals(tiles, width, height);

  return {
    width,
    height,
    tiles,
    rooms: collectFloorClusters(tiles, width, height),
  };
}

/**
 * Counts how many of the 8 surrounding cells (Moore neighborhood) are walls.
 * Out-of-bounds cells count as walls — this keeps the cave edges solid and
 * prevents the automata from "leaking" through the border.
 */
function countWallNeighbors(
  tiles: Tile[][],
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  let count = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        count++;
      } else if (tiles[nx][ny] !== Tile.Floor) {
        count++;
      }
    }
  }
  return count;
}
