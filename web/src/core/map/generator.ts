import { createRng } from "../random";
import { Coordinate, GameMap, Tile } from "../types";

type Room = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 30;

export function generateMap(seed: number, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT): GameMap {
  const rng = createRng(seed);
  const tiles: Tile[][] = Array.from({ length: width }, () => Array.from({ length: height }, () => Tile.Wall));
  const rooms: Room[] = [];
  const roomTarget = rng.int(8, 15);

  for (let i = 0; i < roomTarget; i += 1) {
    const room = randomRoom(rng, width, height);
    if (!overlapsExisting(room, rooms)) {
      rooms.push(room);
      carveRoom(room, tiles);
    }
  }

  if (rooms.length === 0) {
    const fallback = { x: 10, y: 10, w: 8, h: 6 };
    rooms.push(fallback);
    carveRoom(fallback, tiles);
  }

  const centers = rooms.map(centerOf);
  for (let i = 0; i < centers.length - 1; i += 1) {
    carveCorridor(tiles, centers[i], centers[i + 1]);
  }

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
  const w = rng.int(5, 12);
  const h = rng.int(4, 9);
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

function carveCorridor(tiles: Tile[][], from: Coordinate, to: Coordinate): void {
  let x = from.x;
  let y = from.y;

  while (x !== to.x) {
    tiles[x][y] = Tile.Floor;
    x += to.x > x ? 1 : -1;
  }
  while (y !== to.y) {
    tiles[x][y] = Tile.Floor;
    y += to.y > y ? 1 : -1;
  }
  tiles[x][y] = Tile.Floor;
}

function isInside(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x < width && y >= 0 && y < height;
}
