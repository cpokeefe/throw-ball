import { STEPS_PER_POSSESSION } from "../config/rules";
import { findCenterFloor, spawnInFrontOfGoal } from "./geometry";
import { generateMap } from "./map/generator";
import { GameMode, GameState, Tile } from "./types";

export function createInitialState(seed: number, mode: GameMode = "ONE_V_ONE"): GameState {
  const map = generateMap(seed);
  const p1Spawn = spawnInFrontOfGoal(
    map.tiles, map.width, map.height, Tile.Goal1,
    { x: 3, y: Math.floor(map.height / 2) }, 1
  );
  const p2Spawn = spawnInFrontOfGoal(
    map.tiles, map.width, map.height, Tile.Goal2,
    { x: map.width - 4, y: Math.floor(map.height / 2) }, -1
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
        stepsLeft: STEPS_PER_POSSESSION,
        flyArmed: false,
        isFlying: false,
        flyDirection: null,
      },
      2: {
        id: 2,
        position: p2Spawn,
        direction: "W",
        hasBall: false,
        stepsLeft: STEPS_PER_POSSESSION,
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
    score: { p1: 0, p2: 0 },
  };
}
