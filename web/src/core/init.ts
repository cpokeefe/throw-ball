import { generateMap } from "./map/generator";
import { Coordinate, GameMode, GameState, Tile } from "./types";

export function createInitialState(seed: number, mode: GameMode = "ONE_V_ONE"): GameState {
  const map = generateMap(seed);
  const p1Spawn = spawnInFrontOfGoal(map.tiles, map.width, map.height, Tile.Goal1, { x: 3, y: Math.floor(map.height / 2) }, 1);
  const p2Spawn = spawnInFrontOfGoal(
    map.tiles,
    map.width,
    map.height,
    Tile.Goal2,
    { x: map.width - 4, y: Math.floor(map.height / 2) },
    -1
  );
  const ballSpawn = findCenterFloor(map.tiles, map.width, map.height);

  return {
    tick: 0,
    seed,
    rngState: (seed ^ 0x9e3779b9) >>> 0,
    mode,
    goalsSwapped: false,
    map,
    players: {
      1: {
        id: 1,
        position: p1Spawn,
        direction: "E",
        hasBall: false,
        stepsLeft: 5,
        flyArmed: false,
        isFlying: false,
        flyDirection: null,
      },
      2: {
        id: 2,
        position: p2Spawn,
        direction: "W",
        hasBall: false,
        stepsLeft: 5,
        flyArmed: false,
        isFlying: false,
        flyDirection: null,
      },
    },
    ball: {
      position: ballSpawn,
      inFlight: false,
      direction: null,
      thrownBy: null,
    },
    score: {
      p1: 0,
      p2: 0,
    },
  };
}

function findCenterFloor(tiles: Tile[][], width: number, height: number): Coordinate {
  const center = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  if (isFloorLike(tiles[center.x][center.y])) {
    return center;
  }

  for (let radius = 1; radius < Math.max(width, height); radius += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      for (let y = center.y - radius; y <= center.y + radius; y += 1) {
        if (x < 0 || y < 0 || x >= width || y >= height) {
          continue;
        }
        if (isFloorLike(tiles[x][y])) {
          return { x, y };
        }
      }
    }
  }

  return center;
}

function isFloorLike(tile: Tile): boolean {
  return tile === Tile.Floor;
}

function spawnInFrontOfGoal(
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
    if (candidate.x < 0 || candidate.y < 0 || candidate.x >= width || candidate.y >= height) {
      continue;
    }
    if (tiles[candidate.x][candidate.y] === Tile.Floor) {
      return candidate;
    }
  }

  return fallback;
}
