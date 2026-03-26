/**
 * Shared utilities for all map generation strategies.
 *
 * Every strategy needs the same post-processing pipeline:
 *   1. Generate the raw floor/wall pattern (interior only, 1-tile border stays Wall)
 *   2. Ensure all floor regions are connected via tunnel carving
 *   3. Enforce the wall perimeter (safety pass)
 *   4. Place Goal1 on the left edge and Goal2 on the right edge
 *   5. Collect "room" landmarks for the GameMap.rooms field
 */

import { MAP_HEIGHT, MAP_WIDTH } from "../../config/display";
import { isInside } from "../geometry";
import { Coordinate, GameMap, Tile } from "../types";

export { MAP_WIDTH, MAP_HEIGHT };

// ── Grid creation ───────────────────────────────────────────

export function createEmptyGrid(width: number, height: number, fill: Tile): Tile[][] {
  return Array.from({ length: width }, () =>
    Array.from({ length: height }, () => fill),
  );
}

// ── Perimeter enforcement ───────────────────────────────────

/**
 * Forces the outermost ring of tiles to be Wall. Run this AFTER connectivity
 * checks but BEFORE goal placement so the goals can punch through the border.
 */
export function enforcePerimeter(tiles: Tile[][], width: number, height: number): void {
  for (let x = 0; x < width; x++) {
    tiles[x][0] = Tile.Wall;
    tiles[x][height - 1] = Tile.Wall;
  }
  for (let y = 0; y < height; y++) {
    tiles[0][y] = Tile.Wall;
    tiles[width - 1][y] = Tile.Wall;
  }
}

// ── Goal placement ──────────────────────────────────────────

/**
 * Places 3-tile-tall Goal1 on the left edge (x = 0) and Goal2 on the right
 * edge (x = width-1). Carves a short floor corridor inward from each goal
 * so players and ball can actually reach the goals.
 *
 * The y-position for each goal is chosen by scanning inward from the edge
 * near the vertical center, looking for the closest existing floor tile.
 */
export function placeGoals(tiles: Tile[][], width: number, height: number): void {
  const leftY = findBestGoalY(tiles, width, height, "left");
  const rightY = findBestGoalY(tiles, width, height, "right");

  stampGoalStrip(tiles, width, height, 0, leftY, Tile.Goal1, +1);
  stampGoalStrip(tiles, width, height, width - 1, rightY, Tile.Goal2, -1);
}

function stampGoalStrip(
  tiles: Tile[][],
  width: number,
  height: number,
  edgeX: number,
  centerY: number,
  goalTile: Tile,
  inwardDir: number,
): void {
  for (let dy = -1; dy <= 1; dy++) {
    const y = centerY + dy;
    if (y < 1 || y >= height - 1) continue;

    tiles[edgeX][y] = goalTile;

    for (let step = 1; step <= 6; step++) {
      const x = edgeX + inwardDir * step;
      if (!isInside(x, y, width, height)) break;
      if (tiles[x][y] === Tile.Floor) break;
      tiles[x][y] = Tile.Floor;
    }
  }
}

/**
 * Scans from the vertical center outward, looking for an existing floor tile
 * within a few columns of the given edge. Returns the best y for goal placement.
 */
function findBestGoalY(
  tiles: Tile[][],
  width: number,
  height: number,
  side: "left" | "right",
): number {
  const midY = Math.floor(height / 2);

  for (let r = 0; r < height; r++) {
    for (const sign of [0, 1, -1]) {
      const y = midY + r * (sign || 1);
      if (sign === 0 && r !== 0) continue;
      if (y < 2 || y >= height - 2) continue;

      const startX = side === "left" ? 1 : width - 2;
      const dx = side === "left" ? 1 : -1;
      for (let step = 0; step < 8; step++) {
        const x = startX + dx * step;
        if (x < 0 || x >= width) break;
        if (tiles[x][y] === Tile.Floor) return y;
      }
    }
  }
  return midY;
}

// ── Connectivity ────────────────────────────────────────────

/**
 * Finds all disconnected floor regions via flood-fill and carves L-shaped
 * tunnels from each smaller region to the largest one. Guarantees every
 * floor tile is reachable from every other floor tile.
 *
 * Uses a flat Int32Array for region IDs instead of Set<string> for speed.
 */
export function ensureConnectivity(tiles: Tile[][], width: number, height: number): void {
  const size = width * height;
  const regionOf = new Int32Array(size).fill(-1);
  const key = (x: number, y: number) => x * height + y;

  const regions: number[][] = [];

  for (let x = 1; x < width - 1; x++) {
    for (let y = 1; y < height - 1; y++) {
      if (tiles[x][y] !== Tile.Floor) continue;
      const k = key(x, y);
      if (regionOf[k] >= 0) continue;

      const id = regions.length;
      const cells: number[] = [];
      const stack: number[] = [k];

      while (stack.length > 0) {
        const ck = stack.pop()!;
        if (regionOf[ck] >= 0) continue;
        const cx = (ck / height) | 0;
        const cy = ck % height;
        if (!isInside(cx, cy, width, height)) continue;
        if (tiles[cx][cy] !== Tile.Floor) continue;

        regionOf[ck] = id;
        cells.push(ck);

        if (cx > 0) stack.push(key(cx - 1, cy));
        if (cx < width - 1) stack.push(key(cx + 1, cy));
        if (cy > 0) stack.push(key(cx, cy - 1));
        if (cy < height - 1) stack.push(key(cx, cy + 1));
      }

      regions.push(cells);
    }
  }

  if (regions.length <= 1) return;

  let largestIdx = 0;
  for (let i = 1; i < regions.length; i++) {
    if (regions[i].length > regions[largestIdx].length) largestIdx = i;
  }

  for (let i = 0; i < regions.length; i++) {
    if (i === largestIdx) continue;

    const small = regions[i];
    const large = regions[largestIdx];

    let sumX = 0;
    let sumY = 0;
    for (const ck of small) {
      sumX += (ck / height) | 0;
      sumY += ck % height;
    }
    const fromX = (sumX / small.length) | 0;
    const fromY = (sumY / small.length) | 0;

    let bestDist = Infinity;
    let toX = (width / 2) | 0;
    let toY = (height / 2) | 0;

    const step = Math.max(1, (large.length / 300) | 0);
    for (let j = 0; j < large.length; j += step) {
      const tx = (large[j] / height) | 0;
      const ty = large[j] % height;
      const dist = Math.abs(tx - fromX) + Math.abs(ty - fromY);
      if (dist < bestDist) {
        bestDist = dist;
        toX = tx;
        toY = ty;
      }
    }

    carveTunnel(tiles, fromX, fromY, toX, toY, width, height);

    for (const ck of small) large.push(ck);
  }
}

/**
 * Carves an L-shaped corridor of floor tiles between two points.
 * Goes horizontal first, then vertical.
 */
export function carveTunnel(
  tiles: Tile[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number,
): void {
  let cx = x1;
  let cy = y1;

  while (cx !== x2) {
    if (isInside(cx, cy, width, height) && tiles[cx][cy] === Tile.Wall) {
      tiles[cx][cy] = Tile.Floor;
    }
    cx += cx < x2 ? 1 : -1;
  }
  while (cy !== y2) {
    if (isInside(cx, cy, width, height) && tiles[cx][cy] === Tile.Wall) {
      tiles[cx][cy] = Tile.Floor;
    }
    cy += cy < y2 ? 1 : -1;
  }
  if (isInside(cx, cy, width, height) && tiles[cx][cy] === Tile.Wall) {
    tiles[cx][cy] = Tile.Floor;
  }
}

// ── Room landmark collection ────────────────────────────────

/**
 * Scans the map on a grid and returns coordinates where there's a high
 * local density of floor tiles. These serve as the GameMap.rooms array,
 * used by the engine for spawn placement.
 */
export function collectFloorClusters(
  tiles: Tile[][],
  width: number,
  height: number,
  gridStep = 8,
): Coordinate[] {
  const rooms: Coordinate[] = [];
  const radius = 3;
  const threshold = Math.floor((2 * radius + 1) ** 2 * 0.6);

  for (let gx = gridStep; gx < width - gridStep; gx += gridStep) {
    for (let gy = gridStep; gy < height - gridStep; gy += gridStep) {
      let floorCount = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const x = gx + dx;
          const y = gy + dy;
          if (isInside(x, y, width, height) && tiles[x][y] === Tile.Floor) {
            floorCount++;
          }
        }
      }
      if (floorCount >= threshold) {
        rooms.push({ x: gx, y: gy });
      }
    }
  }

  if (rooms.length === 0) {
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        if (tiles[x][y] === Tile.Floor) {
          rooms.push({ x, y });
          return rooms;
        }
      }
    }
    rooms.push({ x: width >> 1, y: height >> 1 });
  }

  return rooms;
}
