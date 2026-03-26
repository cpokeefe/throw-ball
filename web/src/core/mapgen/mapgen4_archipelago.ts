/**
 * ══════════════════════════════════════════════════════════════
 * STRATEGY 4 — ISLAND ARCHIPELAGO
 * ══════════════════════════════════════════════════════════════
 *
 * INVERTS the traditional dungeon-generation paradigm. Instead of carving
 * floor out of solid walls, this strategy starts with a VAST OPEN FLOOR
 * and drops wall "islands" into it as obstacles.
 *
 * The result feels like navigating between scattered obstacles in an open
 * arena — think tropical reef archipelago, asteroid field, or furniture
 * in a warehouse.
 *
 * ── THE ALGORITHM ──
 *
 * 1. OPEN SEA
 *    Fill the entire interior with Floor. The map is one enormous room.
 *
 * 2. ISLAND GENERATION (10-20 islands per seed)
 *    Each island is a wall obstacle with a randomly chosen shape:
 *
 *    • CIRCLE (30% chance)
 *      Filled circle of radius 2-4. Creates round pillars that block
 *      throws from all angles equally.
 *
 *    • RECTANGLE (25% chance)
 *      Solid rectangle 3-6 wide × 2-5 tall. Creates long walls that
 *      funnel movement and create throw lanes.
 *
 *    • L-SHAPE (20% chance)
 *      Two overlapping rectangles forming an "L". Provides cover from
 *      two directions at once — tactical positioning gold.
 *
 *    • CROSS (15% chance)
 *      Plus-sign (+) shape. Blocks movement in all 4 cardinal directions
 *      from a central point, creating 4 diagonal approach paths.
 *
 *    • DIAMOND (10% chance)
 *      Rotated square (45° axis-aligned rhombus). Deflects throws at
 *      diagonal angles, creating unpredictable ricochets.
 *
 *    Islands are placed with minimum spacing between them (3+ tiles)
 *    so players always have room to navigate around obstacles.
 *
 * 3. SCATTER PILLARS
 *    Additionally, 5-12 single-tile or 2×2 "micro-pillars" are placed
 *    in the gaps between islands to break up long sight lines and add
 *    granular cover options.
 *
 * 4. POST-PROCESSING
 *    Connectivity check (unlikely to fail since the base is open, but
 *    a cluster of overlapping islands could theoretically wall off a
 *    corner), perimeter enforcement, and goal placement.
 *
 * ── GAMEPLAY CHARACTER ──
 * Wide open with scattered cover. Long throws are viable from many
 * positions, but islands provide hiding spots. Movement is free-flowing
 * rather than corridor-constrained. Very different from enclosed rooms.
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

interface PlacedIsland {
  cx: number;
  cy: number;
  radius: number;
}

export function generateArchipelago(
  seed: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): GameMap {
  const rng = createRng(seed);
  const tiles = createEmptyGrid(width, height, Tile.Floor);

  const placed: PlacedIsland[] = [];

  // ── Step 1: Place major islands ──
  const numIslands = rng.int(10, 21);
  let attempts = 0;
  const maxAttempts = numIslands * 30;

  while (placed.length < numIslands && attempts < maxAttempts) {
    attempts++;

    const cx = rng.int(6, width - 6);
    const cy = rng.int(4, height - 4);
    const approxRadius = rng.int(2, 5);

    // Enforce minimum spacing between islands
    if (tooCloseToExisting(placed, cx, cy, approxRadius, 3)) continue;

    // Don't block the direct path to goals
    if (cx <= 8 || cx >= width - 9) continue;

    const roll = rng.next();
    if (roll < 0.30) {
      placeCircleIsland(tiles, cx, cy, approxRadius, width, height);
    } else if (roll < 0.55) {
      placeRectIsland(rng, tiles, cx, cy, width, height);
    } else if (roll < 0.75) {
      placeLShapeIsland(rng, tiles, cx, cy, width, height);
    } else if (roll < 0.90) {
      placeCrossIsland(rng, tiles, cx, cy, width, height);
    } else {
      placeDiamondIsland(tiles, cx, cy, approxRadius, width, height);
    }

    placed.push({ cx, cy, radius: approxRadius });
  }

  // ── Step 2: Scatter micro-pillars ──
  const numPillars = rng.int(5, 13);
  for (let i = 0; i < numPillars; i++) {
    const px = rng.int(5, width - 5);
    const py = rng.int(3, height - 3);

    if (tooCloseToExisting(placed, px, py, 1, 4)) continue;

    const pillarSize = rng.int(1, 3);
    for (let dx = 0; dx < pillarSize; dx++) {
      for (let dy = 0; dy < pillarSize; dy++) {
        const x = px + dx;
        const y = py + dy;
        if (x >= 2 && x < width - 2 && y >= 2 && y < height - 2) {
          tiles[x][y] = Tile.Wall;
        }
      }
    }
    placed.push({ cx: px, cy: py, radius: pillarSize });
  }

  // ── Step 3: Finalize ──
  ensureConnectivity(tiles, width, height);
  enforcePerimeter(tiles, width, height);
  placeGoals(tiles, width, height);

  return {
    width,
    height,
    tiles,
    rooms: collectFloorClusters(tiles, width, height, 10),
  };
}

function tooCloseToExisting(
  placed: PlacedIsland[],
  cx: number,
  cy: number,
  radius: number,
  minGap: number,
): boolean {
  for (const island of placed) {
    const dist = Math.abs(cx - island.cx) + Math.abs(cy - island.cy);
    if (dist < radius + island.radius + minGap) return true;
  }
  return false;
}

// ── Island shape stampers ───────────────────────────────────

/**
 * Stamps a filled circle: all tiles where dx² + dy² ≤ r² become Wall.
 */
function placeCircleIsland(
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
      setWallSafe(tiles, cx + dx, cy + dy, mapW, mapH);
    }
  }
}

/**
 * Stamps a solid rectangle with random width (3-6) and height (2-5).
 * The rectangle is centered on (cx, cy).
 */
function placeRectIsland(
  rng: Random,
  tiles: Tile[][],
  cx: number,
  cy: number,
  mapW: number,
  mapH: number,
): void {
  const hw = rng.int(1, 4); // half-width
  const hh = rng.int(1, 3); // half-height
  for (let dx = -hw; dx <= hw; dx++) {
    for (let dy = -hh; dy <= hh; dy++) {
      setWallSafe(tiles, cx + dx, cy + dy, mapW, mapH);
    }
  }
}

/**
 * Stamps an L-shape: two overlapping rectangles joined at a corner.
 * The horizontal arm extends in one direction, the vertical arm extends
 * in a perpendicular direction, meeting at (cx, cy).
 */
function placeLShapeIsland(
  rng: Random,
  tiles: Tile[][],
  cx: number,
  cy: number,
  mapW: number,
  mapH: number,
): void {
  const armLen = rng.int(3, 6);
  const armThick = rng.int(1, 3);
  const horzDir = rng.next() < 0.5 ? 1 : -1;
  const vertDir = rng.next() < 0.5 ? 1 : -1;

  // Horizontal arm
  for (let dx = 0; dx !== armLen * horzDir; dx += horzDir) {
    for (let dy = 0; dy < armThick; dy++) {
      setWallSafe(tiles, cx + dx, cy + dy, mapW, mapH);
    }
  }

  // Vertical arm
  for (let dy = 0; dy !== armLen * vertDir; dy += vertDir) {
    for (let dx = 0; dx < armThick; dx++) {
      setWallSafe(tiles, cx + dx, cy + dy, mapW, mapH);
    }
  }
}

/**
 * Stamps a cross (+) shape: two perpendicular bars intersecting at center.
 */
function placeCrossIsland(
  rng: Random,
  tiles: Tile[][],
  cx: number,
  cy: number,
  mapW: number,
  mapH: number,
): void {
  const armLen = rng.int(2, 5);
  const armThick = rng.int(1, 2);

  // Horizontal bar
  for (let dx = -armLen; dx <= armLen; dx++) {
    for (let dy = 0; dy < armThick; dy++) {
      setWallSafe(tiles, cx + dx, cy + dy, mapW, mapH);
    }
  }

  // Vertical bar
  for (let dy = -armLen; dy <= armLen; dy++) {
    for (let dx = 0; dx < armThick; dx++) {
      setWallSafe(tiles, cx + dx, cy + dy, mapW, mapH);
    }
  }
}

/**
 * Stamps a diamond (rotated square): tiles where |dx| + |dy| ≤ r.
 * This creates a rhombus shape that deflects approaches at 45° angles.
 */
function placeDiamondIsland(
  tiles: Tile[][],
  cx: number,
  cy: number,
  radius: number,
  mapW: number,
  mapH: number,
): void {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      setWallSafe(tiles, cx + dx, cy + dy, mapW, mapH);
    }
  }
}

function setWallSafe(
  tiles: Tile[][],
  x: number,
  y: number,
  mapW: number,
  mapH: number,
): void {
  if (x >= 2 && x < mapW - 2 && y >= 2 && y < mapH - 2) {
    tiles[x][y] = Tile.Wall;
  }
}
