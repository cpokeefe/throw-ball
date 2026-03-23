import { Coordinate, Direction, Tile } from "./types";

export const DIR_TO_DELTA: Record<Direction, Coordinate> = {
  N: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: -1 },
  W: { x: -1, y: 0 },
};

export function sameCoord(a: Coordinate, b: Coordinate): boolean {
  return a.x === b.x && a.y === b.y;
}

export function isAdjacent(a: Coordinate, b: Coordinate): boolean {
  return Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;
}

export function manhattan(a: Coordinate, b: Coordinate): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function isInside(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

export function findCenterFloor(tiles: Tile[][], width: number, height: number): Coordinate {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  if (isInside(cx, cy, width, height) && tiles[cx][cy] === Tile.Floor) {
    return { x: cx, y: cy };
  }
  for (let r = 1; r < Math.max(width, height); r += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      for (let y = cy - r; y <= cy + r; y += 1) {
        if (!isInside(x, y, width, height)) {
          continue;
        }
        if (tiles[x][y] === Tile.Floor) {
          return { x, y };
        }
      }
    }
  }
  return { x: cx, y: cy };
}

export function spawnInFrontOfGoal(
  tiles: Tile[][],
  width: number,
  height: number,
  goalType: Tile.Goal1 | Tile.Goal2,
  fallback: Coordinate,
  preferredXDirection: 1 | -1
): Coordinate {
  const goalTiles: Coordinate[] = [];
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      if (tiles[x][y] === goalType) {
        goalTiles.push({ x, y });
      }
    }
  }
  if (goalTiles.length === 0) {
    return fallback;
  }

  goalTiles.sort((a, b) => a.y - b.y);
  const center = goalTiles[Math.floor(goalTiles.length / 2)];
  const preferredX = center.x + preferredXDirection * 2;
  const candidates: Coordinate[] = [
    { x: preferredX, y: center.y },
    { x: preferredX, y: center.y - 1 },
    { x: preferredX, y: center.y + 1 },
    { x: preferredX, y: center.y - 2 },
    { x: preferredX, y: center.y + 2 },
  ];

  for (const candidate of candidates) {
    if (!isInside(candidate.x, candidate.y, width, height)) {
      continue;
    }
    if (tiles[candidate.x][candidate.y] === Tile.Floor) {
      return candidate;
    }
  }
  return fallback;
}
