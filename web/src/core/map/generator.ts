import { MAP_HEIGHT, MAP_WIDTH } from "../../config/display";
import { createRng } from "../random";
import { isInside } from "../geometry";
import { Coordinate, GameMap, Tile } from "../types";

const GRID_SIZE = 4;
const ROOMS_MAX_NUMBER = 15;
const AVERAGE_ROOM_WIDTH = 4;
const AVERAGE_ROOM_HEIGHT = 4;
const GRID_BUFFER = 3 * GRID_SIZE;
const PERIMETER_BUFFER = 1 * GRID_SIZE;
const INFO_SPACE = 2;

type HallwayDirection = "NORTH" | "EAST" | "SOUTH" | "WEST";

const DIRECTION_STEP: Record<HallwayDirection, { dx: number; dy: number }> = {
  NORTH: { dx: 0, dy: 1 },
  EAST: { dx: 1, dy: 0 },
  SOUTH: { dx: 0, dy: -1 },
  WEST: { dx: -1, dy: 0 },
};

export function generateMap(seed: number, width = MAP_WIDTH, height = MAP_HEIGHT): GameMap {
  const rng = createRng(seed);
  const tiles: Tile[][] = Array.from({ length: width }, () => Array.from({ length: height }, () => Tile.Wall));
  const rooms: Coordinate[] = [];

  assignUniformRooms(rng, width, height, rooms);
  generateRooms(rng, tiles, rooms, width, height);

  for (let i = 0; i < rooms.length - 1; i += 1) {
    generateHallway(rng, tiles, rooms[i], rooms[i + 1], false, width, height);
  }

  for (let i = 0; i < rooms.length; i += 1) {
    const room = rooms[i];
    if (room.x < 15 || room.x > width - 15) {
      const otherRoom = rng.int(0, rooms.length);
      generateHallway(rng, tiles, room, rooms[otherRoom], true, width, height);
    }
  }

  generatePerimeter(tiles, width, height);
  placeGoalsInExtremeRooms(tiles, rooms, width, height);

  return {
    width,
    height,
    tiles,
    rooms,
  };
}

function assignUniformRooms(
  rng: ReturnType<typeof createRng>,
  width: number,
  height: number,
  rooms: Coordinate[]
): void {
  const numberOfRooms = Math.floor(gaussianBounded(rng, 0.8, 0.2, 0.7, 1) * ROOMS_MAX_NUMBER);

  for (let i = 0; i < numberOfRooms; i += 1) {
    let assigned = false;
    let runTimeBound = 10000;
    while (!assigned && runTimeBound > 0) {
      const x = rng.int(PERIMETER_BUFFER, width - PERIMETER_BUFFER);
      const y = rng.int(PERIMETER_BUFFER, height - PERIMETER_BUFFER);
      if (!adjacentRoom(rooms, x, y, GRID_BUFFER)) {
        rooms.push({ x, y });
        assigned = true;
      }
      runTimeBound -= 1;
    }
  }
}

function adjacentRoom(rooms: Coordinate[], xGrid: number, yGrid: number, gridBuffer: number): boolean {
  for (const room of rooms) {
    if (room.x >= xGrid - gridBuffer && room.x <= xGrid + gridBuffer) {
      if (room.y >= yGrid - gridBuffer && room.y <= yGrid + gridBuffer) {
        return true;
      }
    }
  }
  return false;
}

function generateRooms(
  rng: ReturnType<typeof createRng>,
  tiles: Tile[][],
  rooms: Coordinate[],
  width: number,
  height: number
): void {
  for (const room of rooms) {
    const roomWidth = Math.floor(gaussianBounded(rng, AVERAGE_ROOM_WIDTH, 1, 2, 8));
    const roomHeight = Math.floor(gaussianBounded(rng, AVERAGE_ROOM_HEIGHT, 1, 2, 8));
    for (let x = room.x - roomWidth; x < room.x + roomWidth; x += 1) {
      for (let y = room.y - roomHeight; y < room.y + roomHeight; y += 1) {
        if (isInside(x, y, width, height)) {
          tiles[x][y] = Tile.Floor;
        }
      }
    }
  }
}

function generateHallway(
  rng: ReturnType<typeof createRng>,
  tiles: Tile[][],
  room: Coordinate,
  otherRoom: Coordinate,
  secondExit: boolean,
  width: number,
  height: number
): void {
  let xHead = room.x;
  let yHead = room.y;
  let direction: HallwayDirection;
  let distance: number;

  if (secondExit) {
    if (yHead > Math.floor(height / 2) + INFO_SPACE) {
      direction = "SOUTH";
    } else {
      direction = "NORTH";
    }
    distance = rng.int(5, 7);
    generateDirectionalFloor(tiles, xHead, yHead, distance, direction);
    xHead += distance * DIRECTION_STEP[direction].dx;
    yHead += distance * DIRECTION_STEP[direction].dy;

    if (xHead < Math.floor(width / 2)) {
      direction = "EAST";
    } else {
      direction = "WEST";
    }
    generateDirectionalFloor(tiles, xHead, yHead, distance, direction);
    xHead += distance * DIRECTION_STEP[direction].dx;
    yHead += distance * DIRECTION_STEP[direction].dy;
  }

  while (!(xHead === otherRoom.x && yHead === otherRoom.y)) {
    if (xHead === otherRoom.x) {
      if (yHead < otherRoom.y) {
        direction = "NORTH";
      } else {
        direction = "SOUTH";
      }
    } else if (yHead === otherRoom.y) {
      if (xHead < otherRoom.x) {
        direction = "EAST";
      } else {
        direction = "WEST";
      }
    } else if (xHead < otherRoom.x) {
      if (yHead < otherRoom.y) {
        direction = getRandomDirection(rng, "NORTH", "EAST");
      } else {
        direction = getRandomDirection(rng, "SOUTH", "EAST");
      }
    } else if (yHead < otherRoom.y) {
      direction = getRandomDirection(rng, "NORTH", "WEST");
    } else {
      direction = getRandomDirection(rng, "SOUTH", "WEST");
    }

    if (direction === "NORTH" || direction === "SOUTH") {
      distance = Math.floor(gaussianBounded(rng, 10, 3, 0, Math.abs(otherRoom.y - yHead) + 1));
    } else {
      distance = Math.floor(gaussianBounded(rng, 10, 3, 0, Math.abs(otherRoom.x - xHead) + 1));
    }

    generateDirectionalFloor(tiles, xHead, yHead, distance, direction);
    xHead += distance * DIRECTION_STEP[direction].dx;
    yHead += distance * DIRECTION_STEP[direction].dy;
  }
}

function generateDirectionalFloor(
  tiles: Tile[][],
  xPos: number,
  yPos: number,
  distance: number,
  direction: HallwayDirection
): void {
  const { dx, dy } = DIRECTION_STEP[direction];
  for (let i = 0; i < distance; i += 1) {
    tiles[xPos + i * dx][yPos + i * dy] = Tile.Floor;
  }
}

function getRandomDirection(
  rng: ReturnType<typeof createRng>,
  heads: HallwayDirection,
  tails: HallwayDirection
): HallwayDirection {
  return bernoulli(rng) ? heads : tails;
}

function generatePerimeter(tiles: Tile[][], width: number, height: number): void {
  for (let x = 0; x < width; x += 1) {
    tiles[x][0] = Tile.Wall;
    tiles[x][height - 1] = Tile.Wall;
  }
  for (let y = 0; y < height; y += 1) {
    tiles[0][y] = Tile.Wall;
    tiles[width - 1][y] = Tile.Wall;
  }
}

function placeGoalsInExtremeRooms(tiles: Tile[][], rooms: Coordinate[], width: number, height: number): void {
  if (rooms.length === 0) {
    return;
  }

  let leftMost = rooms[0];
  let rightMost = rooms[0];
  for (const room of rooms) {
    if (room.x < leftMost.x) {
      leftMost = room;
    }
    if (room.x > rightMost.x) {
      rightMost = room;
    }
  }

  placeGoalOnRoomEdge(tiles, leftMost, "left", Tile.Goal1, width, height);
  placeGoalOnRoomEdge(tiles, rightMost, "right", Tile.Goal2, width, height);
}

function placeGoalOnRoomEdge(
  tiles: Tile[][],
  room: Coordinate,
  edge: "left" | "right",
  goalTile: Tile.Goal1 | Tile.Goal2,
  width: number,
  height: number
): void {
  const goalX = edge === "left" ? 0 : width - 1;
  const interiorX = edge === "left" ? 1 : width - 2;
  for (let y = room.y - 1; y <= room.y + 1; y += 1) {
    if (!isInside(goalX, y, width, height)) {
      continue;
    }
    tiles[goalX][y] = goalTile;
    if (isInside(interiorX, y, width, height)) {
      tiles[interiorX][y] = Tile.Floor;
    }
    const fromX = Math.min(interiorX, room.x);
    const toX = Math.max(interiorX, room.x);
    for (let x = fromX; x <= toX; x += 1) {
      if (isInside(x, y, width, height)) {
        tiles[x][y] = Tile.Floor;
      }
    }
  }
}

function bernoulli(rng: ReturnType<typeof createRng>): boolean {
  return rng.next() < 0.5;
}

function gaussian(rng: ReturnType<typeof createRng>): number {
  let x = 0;
  let y = 0;
  let r = 0;
  do {
    x = -1 + 2 * rng.next();
    y = -1 + 2 * rng.next();
    r = x * x + y * y;
  } while (r >= 1 || r === 0);
  return x * Math.sqrt((-2 * Math.log(r)) / r);
}

function gaussianBounded(
  rng: ReturnType<typeof createRng>,
  mu: number,
  sigma: number,
  lowerBound: number,
  upperBound: number
): number {
  let value = Number.NEGATIVE_INFINITY;
  while (value < lowerBound || value > upperBound) {
    value = mu + sigma * gaussian(rng);
  }
  return value;
}
