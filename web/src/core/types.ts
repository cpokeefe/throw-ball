export enum Tile {
  Wall = 0,
  Floor = 1,
  Goal1 = 2,
  Goal2 = 3,
}

export type Direction = "N" | "E" | "S" | "W";

export type GameMode = "PRACTICE" | "ONE_V_ONE" | "ONE_V_CPU";

export interface Coordinate {
  x: number;
  y: number;
}

export interface PlayerState {
  id: 1 | 2;
  position: Coordinate;
  direction: Direction;
  hasBall: boolean;
  stepsLeft: number;
  flyArmed: boolean;
  isFlying: boolean;
  flyDirection: Direction | null;
}

export interface BallState {
  position: Coordinate;
  inFlight: boolean;
  direction: Direction | null;
  thrownBy: 1 | 2 | null;
}

export interface GameMap {
  width: number;
  height: number;
  tiles: Tile[][];
  rooms: Coordinate[];
}

export interface GameState {
  tick: number;
  seed: number;
  rngState: number;
  mode: GameMode;
  map: GameMap;
  players: Record<1 | 2, PlayerState>;
  ball: BallState;
  score: { p1: number; p2: number };
}

export type MoveCommand = {
  type: "MOVE";
  playerId: 1 | 2;
  direction: Direction;
};

export type ActionCommand = {
  type: "ACTION";
  playerId: 1 | 2;
};

export type ToggleFlyCommand = {
  type: "TOGGLE_FLY";
  playerId: 1 | 2;
};

export type AdvanceBallCommand = {
  type: "ADVANCE_BALL";
};

export type Command = MoveCommand | ActionCommand | ToggleFlyCommand | AdvanceBallCommand;
