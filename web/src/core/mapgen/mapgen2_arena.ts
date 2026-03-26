/**
 * ══════════════════════════════════════════════════════════════
 * STRATEGY 2 — SYMMETRIC SPORTS ARENA
 * ══════════════════════════════════════════════════════════════
 *
 * Builds a purpose-designed competitive arena with LEFT-RIGHT MIRROR
 * SYMMETRY, guaranteeing both players face identical terrain.
 *
 * Unlike natural/procedural approaches, this strategy thinks like an
 * arena architect: it places specific structural elements — pillars,
 * barriers, lanes, and alcoves — in a deliberate layout, then
 * randomizes their exact sizes and positions with each seed.
 *
 * ── THE ALGORITHM ──
 *
 * 1. OPEN FLOOR BASE
 *    Start with the entire interior as floor — a wide open rectangle.
 *
 * 2. CENTRAL DIVIDER
 *    Place a vertical wall barrier down the center column (x = width/2).
 *    Punch 2-4 gaps into it at random y-positions. This forces players
 *    to navigate through chokepoints to reach the other side, creating
 *    tense "lane control" dynamics.
 *
 * 3. PILLAR FORMATIONS
 *    Place pairs of 2×2 or 3×3 wall blocks in mirror-symmetric positions.
 *    These serve as cover: you can hide behind a pillar to block a throw,
 *    or use it to set up a bank shot. Each seed places 4-8 pillar pairs.
 *
 * 4. DEFENSIVE STRUCTURES
 *    Near each goal, place L-shaped or U-shaped wall structures that
 *    create a "defensive pocket." The goalie can shelter behind these
 *    walls, but attackers can approach from multiple angles through the
 *    openings.
 *
 * 5. LANE WALLS
 *    Place short horizontal wall segments that divide the arena into
 *    "lanes" — horizontal corridors that create long throw lines. These
 *    walls are short enough to walk around but long enough to force
 *    strategic routing decisions.
 *
 * ── GAMEPLAY CHARACTER ──
 * Clean sight lines, fair positioning, and tactical cover. Feels like
 * a designed sport facility — think air hockey meets paintball arena.
 * The symmetry means the outcome is purely about skill, never spawn luck.
 */

import { createRng, Random } from "../random";
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

export function generateArena(
  seed: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): GameMap {
  const rng = createRng(seed);
  const tiles = createEmptyGrid(width, height, Tile.Floor);

  const midX = (width / 2) | 0;
  const midY = (height / 2) | 0;

  // ── Step 1: Central divider ──
  // A vertical wall through the center with random gaps.
  placeCentralDivider(rng, tiles, midX, width, height);

  // ── Step 2: Pillar formations ──
  // Mirror-symmetric pillars placed in each half of the arena.
  placePillars(rng, tiles, midX, midY, width, height);

  // ── Step 3: Defensive structures near goals ──
  placeDefensiveStructures(rng, tiles, width, height);

  // ── Step 4: Lane walls ──
  // Short horizontal barriers that create throwing corridors.
  placeLaneWalls(rng, tiles, midX, midY, width, height);

  // ── Step 5: Finalize ──
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

/**
 * Places a vertical wall column at the arena's center with 2-4 gaps.
 * The gaps are distributed across the height so there's always a way
 * through near the top, middle, and bottom of the arena.
 */
function placeCentralDivider(
  rng: Random,
  tiles: Tile[][],
  midX: number,
  width: number,
  height: number,
): void {
  for (let y = 2; y < height - 2; y++) {
    tiles[midX][y] = Tile.Wall;
    if (midX + 1 < width) tiles[midX + 1][y] = Tile.Wall;
  }

  const numGaps = rng.int(2, 5);
  const gapSpacing = Math.floor((height - 4) / (numGaps + 1));

  for (let g = 0; g < numGaps; g++) {
    const gapY = 2 + gapSpacing * (g + 1) + rng.int(-1, 2);
    const gapWidth = rng.int(2, 4);
    for (let dy = 0; dy < gapWidth; dy++) {
      const y = gapY + dy;
      if (y >= 2 && y < height - 2) {
        tiles[midX][y] = Tile.Floor;
        if (midX + 1 < width) tiles[midX + 1][y] = Tile.Floor;
      }
    }
  }
}

/**
 * Places 4-8 pairs of pillars (2×2 or 3×3 wall blocks), each pair
 * mirrored across the vertical center line.
 *
 * Pillars are placed in the "middle zone" (not too close to goals or
 * center divider) to create cover for mid-field play.
 */
function placePillars(
  rng: Random,
  tiles: Tile[][],
  midX: number,
  midY: number,
  width: number,
  height: number,
): void {
  const numPairs = rng.int(4, 9);

  for (let i = 0; i < numPairs; i++) {
    const pillarSize = rng.int(2, 4);

    // Pick a position in the left half (avoid edges and center)
    const px = rng.int(8, midX - 4);
    const py = rng.int(3, height - 3 - pillarSize);

    stampWallBlock(tiles, px, py, pillarSize, pillarSize, width, height);

    // Mirror: the corresponding position in the right half
    const mirrorX = width - 1 - px - pillarSize + 1;
    stampWallBlock(tiles, mirrorX, py, pillarSize, pillarSize, width, height);
  }
}

/**
 * Near each goal (left and right edges), place L-shaped wall structures
 * to create defensive pockets. These give the defending player cover
 * while leaving enough openings for the attacker to find an angle.
 *
 * The structure is a horizontal arm + vertical arm forming an "L".
 */
function placeDefensiveStructures(
  rng: Random,
  tiles: Tile[][],
  width: number,
  height: number,
): void {
  const midY = (height / 2) | 0;
  const armLength = rng.int(3, 6);
  const armOffset = rng.int(2, 5);

  for (const side of ["left", "right"] as const) {
    const baseX = side === "left" ? 4 : width - 5;
    const inward = side === "left" ? 1 : -1;

    // Upper L-arm
    const upperY = midY - armOffset;
    for (let dx = 0; dx < armLength; dx++) {
      const x = baseX + dx * inward;
      if (x >= 1 && x < width - 1 && upperY >= 1 && upperY < height - 1) {
        tiles[x][upperY] = Tile.Wall;
      }
    }
    const vertX = baseX + (armLength - 1) * inward;
    for (let dy = 0; dy < 3; dy++) {
      const y = upperY + dy;
      if (vertX >= 1 && vertX < width - 1 && y >= 1 && y < height - 1) {
        tiles[vertX][y] = Tile.Wall;
      }
    }

    // Lower L-arm (mirrored vertically)
    const lowerY = midY + armOffset;
    for (let dx = 0; dx < armLength; dx++) {
      const x = baseX + dx * inward;
      if (x >= 1 && x < width - 1 && lowerY >= 1 && lowerY < height - 1) {
        tiles[x][lowerY] = Tile.Wall;
      }
    }
    for (let dy = -2; dy <= 0; dy++) {
      const y = lowerY + dy;
      if (vertX >= 1 && vertX < width - 1 && y >= 1 && y < height - 1) {
        tiles[vertX][y] = Tile.Wall;
      }
    }
  }
}

/**
 * Places short horizontal wall segments to create "lanes" — horizontal
 * corridors that give long, clean throw lines. Segments are 3-6 tiles
 * long, placed symmetrically, and spaced to leave walkable gaps.
 */
function placeLaneWalls(
  rng: Random,
  tiles: Tile[][],
  midX: number,
  midY: number,
  width: number,
  height: number,
): void {
  const numLanes = rng.int(2, 5);

  for (let i = 0; i < numLanes; i++) {
    const segLen = rng.int(3, 7);
    const laneY = rng.int(3, height - 4);

    // Place in left half
    const lx = rng.int(10, midX - segLen - 2);
    for (let dx = 0; dx < segLen; dx++) {
      const x = lx + dx;
      if (x >= 1 && x < width - 1 && laneY >= 1 && laneY < height - 1) {
        tiles[x][laneY] = Tile.Wall;
      }
    }

    // Mirror in right half
    const rx = width - 1 - lx - segLen + 1;
    for (let dx = 0; dx < segLen; dx++) {
      const x = rx + dx;
      if (x >= 1 && x < width - 1 && laneY >= 1 && laneY < height - 1) {
        tiles[x][laneY] = Tile.Wall;
      }
    }
  }
}

function stampWallBlock(
  tiles: Tile[][],
  startX: number,
  startY: number,
  w: number,
  h: number,
  mapW: number,
  mapH: number,
): void {
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      const x = startX + dx;
      const y = startY + dy;
      if (x >= 1 && x < mapW - 1 && y >= 1 && y < mapH - 1) {
        tiles[x][y] = Tile.Wall;
      }
    }
  }
}
