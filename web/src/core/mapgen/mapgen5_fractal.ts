/**
 * ══════════════════════════════════════════════════════════════
 * STRATEGY 5 — FRACTAL RECURSIVE SUBDIVISION
 * ══════════════════════════════════════════════════════════════
 *
 * Creates a HIERARCHICAL ROOM STRUCTURE by recursively dividing the map
 * into smaller and smaller rooms. Imagine taking a large open hall and
 * repeatedly building partition walls — each with doorways — until you
 * have a complex of rooms ranging from grand halls to tiny closets.
 *
 * This is related to Binary Space Partitioning (BSP), a technique
 * used in classic games like DOOM (1993), but with several twists:
 *
 *   • VARIABLE DEPTH: Recursion stops randomly, not at a fixed depth.
 *     Some regions are subdivided 5 times (creating tiny rooms), while
 *     others stop after 1 split (leaving large halls). This creates
 *     organic variety within a structured framework.
 *
 *   • MULTI-DOOR WALLS: Every partition wall gets 1-3 doorways, each
 *     2-3 tiles wide. No room is ever a dead end — there's always at
 *     least 2 ways in/out (one on each side of the partition wall has
 *     a door, and the parent room's doors connect to neighbors).
 *
 *   • WEIGHTED SPLIT DIRECTION: Rooms are preferentially split along
 *     their longer axis, producing more natural proportions instead of
 *     the increasingly narrow slivers that naive BSP creates.
 *
 * ── THE ALGORITHM ──
 *
 * 1. FLOOR BASE
 *    Fill the interior with Floor (the "big room").
 *
 * 2. RECURSIVE SUBDIVISION
 *    subdivide(x1, y1, x2, y2, depth):
 *      a) BASE CASE: Stop if the room is too small (< 8 tiles in either
 *         dimension) or depth exceeds MAX_DEPTH, or a random "early stop"
 *         check fires (probability increases with depth).
 *      b) CHOOSE SPLIT AXIS: If the room is wider (x2-x1) than tall (y2-y1),
 *         split vertically (place a column of walls); otherwise split
 *         horizontally (place a row of walls). Ties broken randomly.
 *      c) CHOOSE SPLIT POSITION: Random point between 30%-70% of the
 *         dimension, biased toward center for more balanced rooms.
 *      d) BUILD THE WALL: Place a line of Wall tiles along the split.
 *      e) CUT DOORWAYS: Punch 1-3 gaps (each 2-3 tiles wide) at random
 *         positions along the wall. At least one door in each half of
 *         the wall ensures both sub-rooms are accessible.
 *      f) RECURSE on both sub-rooms with depth + 1.
 *
 * 3. POST-PROCESSING
 *    Connectivity check (should always pass due to the doorway guarantee,
 *    but included as a safety net), perimeter, and goals.
 *
 * ── GAMEPLAY CHARACTER ──
 * Rooms of dramatically varying sizes — from 6×6 closets to 30×15 halls —
 * connected by doorways. The hierarchical structure creates natural
 * "zones" of the map. Large rooms allow free movement and long throws;
 * small rooms create tight 1v1 encounters. Doorways act as chokepoints
 * that can be controlled or ambushed.
 */

import { createRng, Random } from "../random";
import { Coordinate, GameMap, Tile } from "../types";
import {
  MAP_WIDTH,
  MAP_HEIGHT,
  createEmptyGrid,
  enforcePerimeter,
  placeGoals,
  ensureConnectivity,
  collectFloorClusters,
} from "./mapgenUtils";

const MIN_ROOM_DIM = 8;
const MAX_DEPTH = 6;

/**
 * The chance to stop recursion early increases with depth.
 * At depth 0, never stop early. At depth 3, ~30% chance. At depth 5, ~60%.
 */
const EARLY_STOP_BASE = 0.08;

export function generateFractalRooms(
  seed: number,
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
): GameMap {
  const rng = createRng(seed);
  const tiles = createEmptyGrid(width, height, Tile.Floor);
  const roomCenters: Coordinate[] = [];

  // Start recursion on the full interior (excluding the 1-tile border)
  subdivide(rng, tiles, 1, 1, width - 2, height - 2, 0, roomCenters);

  ensureConnectivity(tiles, width, height);
  enforcePerimeter(tiles, width, height);
  placeGoals(tiles, width, height);

  const rooms = roomCenters.length > 0
    ? roomCenters
    : collectFloorClusters(tiles, width, height);

  return { width, height, tiles, rooms };
}

/**
 * Recursively subdivides the rectangle (x1, y1)-(x2, y2) by placing
 * a partition wall with doorways, then recurring on both halves.
 *
 * x1, y1 = top-left corner (inclusive)
 * x2, y2 = bottom-right corner (inclusive)
 */
function subdivide(
  rng: Random,
  tiles: Tile[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  depth: number,
  roomCenters: Coordinate[],
): void {
  const roomW = x2 - x1 + 1;
  const roomH = y2 - y1 + 1;

  // Base case: room too small to split further
  if (roomW < MIN_ROOM_DIM || roomH < MIN_ROOM_DIM) {
    roomCenters.push({
      x: ((x1 + x2) / 2) | 0,
      y: ((y1 + y2) / 2) | 0,
    });
    return;
  }

  // Base case: maximum depth reached
  if (depth >= MAX_DEPTH) {
    roomCenters.push({
      x: ((x1 + x2) / 2) | 0,
      y: ((y1 + y2) / 2) | 0,
    });
    return;
  }

  // Early stop: probability increases with depth, creating variable room sizes
  if (depth > 0 && rng.next() < EARLY_STOP_BASE * depth) {
    roomCenters.push({
      x: ((x1 + x2) / 2) | 0,
      y: ((y1 + y2) / 2) | 0,
    });
    return;
  }

  // Choose split direction: prefer splitting along the longer axis.
  // If dimensions are similar, pick randomly.
  const splitVertical = roomW > roomH + 4
    ? true
    : roomH > roomW + 4
      ? false
      : rng.next() < 0.5;

  if (splitVertical) {
    splitVertically(rng, tiles, x1, y1, x2, y2, depth, roomCenters);
  } else {
    splitHorizontally(rng, tiles, x1, y1, x2, y2, depth, roomCenters);
  }
}

/**
 * Splits a room with a vertical wall (column of Wall tiles at a random x).
 * The split position is constrained to 30%-70% of the room width.
 */
function splitVertically(
  rng: Random,
  tiles: Tile[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  depth: number,
  roomCenters: Coordinate[],
): void {
  const margin = Math.max(3, ((x2 - x1) * 0.3) | 0);
  const splitX = rng.int(x1 + margin, x2 - margin + 1);

  // Build the wall
  for (let y = y1; y <= y2; y++) {
    tiles[splitX][y] = Tile.Wall;
  }

  // Cut doorways — at least 1, up to 3
  const wallLen = y2 - y1 + 1;
  const numDoors = Math.min(rng.int(1, 4), Math.floor(wallLen / 4));

  cutDoors(rng, tiles, splitX, splitX, y1, y2, numDoors, "vertical");

  // Recurse on both halves
  if (splitX - 1 >= x1) {
    subdivide(rng, tiles, x1, y1, splitX - 1, y2, depth + 1, roomCenters);
  }
  if (splitX + 1 <= x2) {
    subdivide(rng, tiles, splitX + 1, y1, x2, y2, depth + 1, roomCenters);
  }
}

/**
 * Splits a room with a horizontal wall (row of Wall tiles at a random y).
 * The split position is constrained to 30%-70% of the room height.
 */
function splitHorizontally(
  rng: Random,
  tiles: Tile[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  depth: number,
  roomCenters: Coordinate[],
): void {
  const margin = Math.max(3, ((y2 - y1) * 0.3) | 0);
  const splitY = rng.int(y1 + margin, y2 - margin + 1);

  // Build the wall
  for (let x = x1; x <= x2; x++) {
    tiles[x][splitY] = Tile.Wall;
  }

  // Cut doorways
  const wallLen = x2 - x1 + 1;
  const numDoors = Math.min(rng.int(1, 4), Math.floor(wallLen / 4));

  cutDoors(rng, tiles, x1, x2, splitY, splitY, numDoors, "horizontal");

  // Recurse on both halves
  if (splitY - 1 >= y1) {
    subdivide(rng, tiles, x1, y1, x2, splitY - 1, depth + 1, roomCenters);
  }
  if (splitY + 1 <= y2) {
    subdivide(rng, tiles, x1, splitY + 1, x2, y2, depth + 1, roomCenters);
  }
}

/**
 * Punches doorways through a wall segment.
 *
 * For vertical walls: the wall is a column at (fixedX, y1..y2).
 *   Doors are horizontal gaps (ranges of y where the wall is removed).
 *
 * For horizontal walls: the wall is a row at (x1..x2, fixedY).
 *   Doors are vertical gaps (ranges of x where the wall is removed).
 *
 * Door positions are spread across the wall to avoid clustering.
 * Each door is 2-3 tiles wide.
 */
function cutDoors(
  rng: Random,
  tiles: Tile[][],
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  numDoors: number,
  wallOrientation: "vertical" | "horizontal",
): void {
  if (wallOrientation === "vertical") {
    const wallLen = y2 - y1 + 1;
    const segmentLen = Math.floor(wallLen / numDoors);

    for (let d = 0; d < numDoors; d++) {
      const segStart = y1 + d * segmentLen;
      const segEnd = Math.min(y2, segStart + segmentLen - 1);
      const doorWidth = Math.min(rng.int(2, 4), segEnd - segStart + 1);
      const doorStart = rng.int(segStart, segEnd - doorWidth + 2);

      for (let y = doorStart; y < doorStart + doorWidth; y++) {
        if (y >= y1 && y <= y2) {
          tiles[x1][y] = Tile.Floor;
        }
      }
    }
  } else {
    const wallLen = x2 - x1 + 1;
    const segmentLen = Math.floor(wallLen / numDoors);

    for (let d = 0; d < numDoors; d++) {
      const segStart = x1 + d * segmentLen;
      const segEnd = Math.min(x2, segStart + segmentLen - 1);
      const doorWidth = Math.min(rng.int(2, 4), segEnd - segStart + 1);
      const doorStart = rng.int(segStart, segEnd - doorWidth + 2);

      for (let x = doorStart; x < doorStart + doorWidth; x++) {
        if (x >= x1 && x <= x2) {
          tiles[x][y1] = Tile.Floor;
        }
      }
    }
  }
}
