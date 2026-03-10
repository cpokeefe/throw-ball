import { createRng } from "../random";
import { Coordinate, GameMap, Tile } from "../types";

type Room = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type CardinalDirection = "north" | "south" | "east" | "west";

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 30;
const MIN_HALLWAYS_PER_ROOM = 2;

export function generateMap(seed: number, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): GameMap {
  const rng = createRng(seed);
  const tiles: Tile[][] = Array.from({ length: width }, () => Array.from({ length: height }, () => Tile.Wall));
  const rooms: Room[] = [];
  const roomTarget = calculateRoomTarget(rng, width, height);
  const maxPlacementAttempts = roomTarget * 24;
  let attempts = 0;

  while (rooms.length < roomTarget && attempts < maxPlacementAttempts) {
    const room = randomRoom(rng, width, height);
    if (!overlapsExisting(room, rooms)) {
      rooms.push(room);
      carveRoom(room, tiles);
    }
    attempts += 1;
  }

  if (rooms.length === 0) {
    const fallbackWidth = Math.max(4, Math.min(10, width - 2));
    const fallbackHeight = Math.max(4, Math.min(8, height - 2));
    const fallback = {
      x: Math.max(1, Math.floor((width - fallbackWidth) / 2)),
      y: Math.max(1, Math.floor((height - fallbackHeight) / 2)),
      w: fallbackWidth,
      h: fallbackHeight,
    };
    rooms.push(fallback);
    carveRoom(fallback, tiles);
  }

  const centers = rooms.map(centerOf);
  connectRoomsWithMinimumHallways(tiles, centers);

  placeGoalsInExtremeRooms(tiles, rooms, width, height);

  return {
    width,
    height,
    tiles,
    rooms: centers,
  };
}

function placeGoalsInExtremeRooms(tiles: Tile[][], rooms: Room[], width: number, height: number): void {
  if (rooms.length === 0) {
    return;
  }

  let leftMost = rooms[0];
  let rightMost = rooms[0];
  for (const room of rooms) {
    if (room.x < leftMost.x) {
      leftMost = room;
    }
    if (room.x + room.w > rightMost.x + rightMost.w) {
      rightMost = room;
    }
  }

  placeGoalOnRoomEdge(tiles, leftMost, "left", Tile.Goal1, width, height);
  placeGoalOnRoomEdge(tiles, rightMost, "right", Tile.Goal2, width, height);
}

function placeGoalOnRoomEdge(
  tiles: Tile[][],
  room: Room,
  edge: "left" | "right",
  goalTile: Tile.Goal1 | Tile.Goal2,
  width: number,
  height: number
): void {
  const goalX = edge === "left" ? room.x : room.x + room.w - 1;
  const behindX = edge === "left" ? goalX - 1 : goalX + 1;
  const interiorX = edge === "left" ? goalX + 1 : goalX - 1;

  const centerY = room.y + Math.floor(room.h / 2);
  const startY = Math.max(room.y, Math.min(centerY - 1, room.y + room.h - 3));
  for (let y = startY; y < startY + 3; y += 1) {
    if (!isInside(goalX, y, width, height)) {
      continue;
    }
    tiles[goalX][y] = goalTile;

    // Ensure the side facing into the room is playable floor.
    if (isInside(interiorX, y, width, height)) {
      tiles[interiorX][y] = Tile.Floor;
    }
    // Ensure the back side is solid so goal acts like a scoring wall.
    if (isInside(behindX, y, width, height)) {
      tiles[behindX][y] = Tile.Wall;
    }
  }
}

function randomRoom(rng: ReturnType<typeof createRng>, width: number, height: number): Room {
  const minW = Math.max(5, Math.floor(width * 0.08));
  const maxW = Math.max(minW + 1, Math.min(12, Math.floor(width * 0.24)));
  const minH = Math.max(4, Math.floor(height * 0.14));
  const maxH = Math.max(minH + 1, Math.min(12, Math.floor(height * 0.3)));

  const w = biasedLargeInt(rng, minW, maxW);
  const h = biasedLargeInt(rng, minH, maxH);
  const x = rng.int(1, Math.max(2, width - w - 1));
  const y = rng.int(1, Math.max(2, height - h - 1));
  return { x, y, w, h };
}

function overlapsExisting(room: Room, existing: Room[]): boolean {
  return existing.some((other) => {
    return (
      room.x - 1 < other.x + other.w + 1 &&
      room.x + room.w + 1 > other.x - 1 &&
      room.y - 1 < other.y + other.h + 1 &&
      room.y + room.h + 1 > other.y - 1
    );
  });
}

function carveRoom(room: Room, tiles: Tile[][]): void {
  for (let x = room.x; x < room.x + room.w; x += 1) {
    for (let y = room.y; y < room.y + room.h; y += 1) {
      tiles[x][y] = Tile.Floor;
    }
  }
}

function centerOf(room: Room): Coordinate {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

function connectRoomsWithMinimumHallways(tiles: Tile[][], centers: Coordinate[]): void {
  if (centers.length < 2) {
    return;
  }

  const hallwayCounts = Array.from({ length: centers.length }, () => 0);
  const usedDirections = Array.from({ length: centers.length }, () => new Set<CardinalDirection>());
  const existingConnections = new Set<string>();

  const connectRooms = (i: number, j: number, allowDuplicate = false): boolean => {
    if (i === j) {
      return false;
    }
    const key = edgeKey(i, j);
    if (!allowDuplicate && existingConnections.has(key)) {
      return false;
    }

    const directionFromI = directionFrom(centers[i], centers[j]);
    const directionFromJ = oppositeDirection(directionFromI);
    const verticalFirst = Math.abs(centers[i].y - centers[j].y) > Math.abs(centers[i].x - centers[j].x);
    carveCorridor(tiles, centers[i], centers[j], verticalFirst);
    hallwayCounts[i] += 1;
    hallwayCounts[j] += 1;
    usedDirections[i].add(directionFromI);
    usedDirections[j].add(directionFromJ);
    existingConnections.add(key);
    return true;
  };

  // Build a baseline connected graph with short hallways (minimum spanning tree by Manhattan distance).
  const disjointSet = new DisjointSet(centers.length);
  const edges: Array<{ i: number; j: number; distance: number }> = [];
  for (let i = 0; i < centers.length; i += 1) {
    for (let j = i + 1; j < centers.length; j += 1) {
      edges.push({
        i,
        j,
        distance: manhattanDistance(centers[i], centers[j]),
      });
    }
  }
  edges.sort((a, b) => a.distance - b.distance);

  for (const edge of edges) {
    if (disjointSet.union(edge.i, edge.j)) {
      connectRooms(edge.i, edge.j);
    }
  }

  // Add short, direction-diverse hallways until every room has enough exits.
  let madeProgress = true;
  while (madeProgress && hallwayCounts.some((count) => count < MIN_HALLWAYS_PER_ROOM)) {
    madeProgress = false;
    for (let i = 0; i < centers.length; i += 1) {
      if (hallwayCounts[i] >= MIN_HALLWAYS_PER_ROOM) {
        continue;
      }

      let bestRoomIndex = -1;
      let bestScore = Number.POSITIVE_INFINITY;

      for (let j = 0; j < centers.length; j += 1) {
        if (j === i) {
          continue;
        }
        const key = edgeKey(i, j);
        const alreadyConnected = existingConnections.has(key);
        if (alreadyConnected && centers.length > 2) {
          continue;
        }

        const distance = manhattanDistance(centers[i], centers[j]);
        const primaryDirection = directionFrom(centers[i], centers[j]);
        const opposite = oppositeDirection(primaryDirection);
        const repeatDirectionPenalty = usedDirections[i].has(primaryDirection) ? 20 : 0;
        const oppositeRepeatPenalty = usedDirections[j].has(opposite) ? 10 : 0;
        const longHallwayPenalty = distance * 0.6;
        const needsHallwayBonus = hallwayCounts[j] < MIN_HALLWAYS_PER_ROOM ? -8 : 0;

        // Heavily favor short hallways and encourage different exit directions per room.
        const score = distance + longHallwayPenalty + repeatDirectionPenalty + oppositeRepeatPenalty + needsHallwayBonus;
        if (score < bestScore) {
          bestScore = score;
          bestRoomIndex = j;
        }
      }

      if (bestRoomIndex === -1) {
        continue;
      }

      if (connectRooms(i, bestRoomIndex, centers.length === 2)) {
        madeProgress = true;
      }
    }
  }
}

function carveCorridor(tiles: Tile[][], from: Coordinate, to: Coordinate, verticalFirst = false): void {
  let x = from.x;
  let y = from.y;

  if (verticalFirst) {
    while (y !== to.y) {
      tiles[x][y] = Tile.Floor;
      y += to.y > y ? 1 : -1;
    }
    while (x !== to.x) {
      tiles[x][y] = Tile.Floor;
      x += to.x > x ? 1 : -1;
    }
  } else {
    while (x !== to.x) {
      tiles[x][y] = Tile.Floor;
      x += to.x > x ? 1 : -1;
    }
    while (y !== to.y) {
      tiles[x][y] = Tile.Floor;
      y += to.y > y ? 1 : -1;
    }
  }
  tiles[x][y] = Tile.Floor;
}

function isInside(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}

function calculateRoomTarget(rng: ReturnType<typeof createRng>, width: number, height: number): number {
  const area = width * height;
  const baseTarget = Math.floor(area / 180);
  const jitter = rng.int(-2, 3);
  return clamp(baseTarget + jitter, 10, 36);
}

function biasedLargeInt(rng: ReturnType<typeof createRng>, min: number, maxExclusive: number): number {
  if (maxExclusive <= min + 1) {
    return min;
  }
  const a = rng.int(min, maxExclusive);
  const b = rng.int(min, maxExclusive);
  return Math.max(a, b);
}

function edgeKey(i: number, j: number): string {
  return i < j ? `${i}-${j}` : `${j}-${i}`;
}

function manhattanDistance(a: Coordinate, b: Coordinate): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function directionFrom(from: Coordinate, to: Coordinate): CardinalDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "east" : "west";
  }
  return dy >= 0 ? "north" : "south";
}

function oppositeDirection(direction: CardinalDirection): CardinalDirection {
  switch (direction) {
    case "north":
      return "south";
    case "south":
      return "north";
    case "east":
      return "west";
    case "west":
      return "east";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

class DisjointSet {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = Array.from({ length: size }, () => 0);
  }

  find(value: number): number {
    if (this.parent[value] !== value) {
      this.parent[value] = this.find(this.parent[value]);
    }
    return this.parent[value];
  }

  union(a: number, b: number): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) {
      return false;
    }
    if (this.rank[rootA] < this.rank[rootB]) {
      this.parent[rootA] = rootB;
    } else if (this.rank[rootA] > this.rank[rootB]) {
      this.parent[rootB] = rootA;
    } else {
      this.parent[rootB] = rootA;
      this.rank[rootA] += 1;
    }
    return true;
  }
}
