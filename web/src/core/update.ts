import { STEPS_PER_POSSESSION } from "../config/rules";
import {
  DIR_TO_DELTA,
  findCenterFloor,
  isAdjacent,
  isInside,
  manhattan,
  sameCoord,
  spawnInFrontOfGoal,
} from "./geometry";
import { Command, Coordinate, Direction, GameState, Tile } from "./types";

export function update(state: GameState, command: Command | null): GameState {
  if (command === null) {
    return advanceAutoFly(state);
  }
  if (command.type === "MOVE") {
    return applyMove(state, command.playerId, command.direction);
  }
  if (command.type === "ACTION") {
    return applyAction(state, command.playerId);
  }
  if (command.type === "TOGGLE_FLY") {
    return toggleFly(state, command.playerId);
  }
  if (command.type === "ADVANCE_BALL") {
    return advanceAutoBall(state);
  }
  return state;
}

function applyMove(state: GameState, playerId: 1 | 2, direction: Direction): GameState {
  const player = state.players[playerId];
  if (player.isFlying) {
    return state;
  }
  const moveResult = player.flyArmed
    ? beginFlyMovement(state, playerId, direction)
    : applySingleStepMovement(state, playerId, direction);

  const nextPlayer = {
    ...player,
    direction: moveResult.direction,
    position: moveResult.position,
    stepsLeft: moveResult.stepsLeft,
    flyArmed: false,
    isFlying: moveResult.isFlying,
    flyDirection: moveResult.flyDirection,
  };

  const nextBall = player.hasBall ? { ...state.ball, position: moveResult.position } : state.ball;

  return {
    ...state,
    tick: state.tick + 1,
    ball: nextBall,
    players: {
      ...state.players,
      [playerId]: nextPlayer,
    },
  };
}

function applyAction(state: GameState, playerId: 1 | 2): GameState {
  const otherId: 1 | 2 = playerId === 1 ? 2 : 1;
  const player = state.players[playerId];
  const other = state.players[otherId];
  if (player.isFlying) {
    return state;
  }

  if (player.hasBall) {
    return throwBall(state, playerId) ?? clearFlyAndTick(state, playerId);
  }

  if (isAdjacent(player.position, other.position) && other.hasBall) {
    return clearFlyForPlayer(punch(state, playerId, otherId), playerId);
  }

  if (!state.ball.inFlight && isAdjacent(player.position, state.ball.position)) {
    return clearFlyForPlayer(grabBall(state, playerId), playerId);
  }

  return clearFlyAndTick(state, playerId);
}

function grabBall(state: GameState, playerId: 1 | 2): GameState {
  const otherId: 1 | 2 = playerId === 1 ? 2 : 1;
  const player = state.players[playerId];
  const other = state.players[otherId];
  const grabbed = {
    ...player,
    hasBall: true,
    stepsLeft: STEPS_PER_POSSESSION,
    flyArmed: false,
    isFlying: false,
    flyDirection: null,
  };
  return {
    ...state,
    tick: state.tick + 1,
    ball: { ...state.ball, position: grabbed.position, inFlight: false, direction: null, thrownBy: null },
    players: {
      ...state.players,
      [playerId]: grabbed,
      [otherId]: { ...other, hasBall: false },
    },
  };
}

function punch(state: GameState, playerId: 1 | 2, otherId: 1 | 2): GameState {
  let rngState = state.rngState;
  const [roll, nextRngState] = randomUnit(rngState);
  rngState = nextRngState;

  if (roll < 0.5) {
    const forced = forceOpponentThrow({ ...state, rngState }, otherId);
    if (forced !== null) {
      return forced;
    }
  }

  const player = state.players[playerId];
  const other = state.players[otherId];
  return {
    ...state,
    rngState,
    tick: state.tick + 1,
    ball: { ...state.ball, position: player.position, inFlight: false, direction: null, thrownBy: null },
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        hasBall: true,
        stepsLeft: STEPS_PER_POSSESSION,
        flyArmed: false,
        isFlying: false,
        flyDirection: null,
      },
      [otherId]: {
        ...other,
        hasBall: false,
        stepsLeft: STEPS_PER_POSSESSION,
        isFlying: false,
        flyDirection: null,
      },
    },
  };
}

function forceOpponentThrow(state: GameState, throwerId: 1 | 2): GameState | null {
  let rngState = state.rngState;
  const dirs: Direction[] = ["N", "E", "S", "W"];
  shuffleDirections(dirs, (nextState) => {
    rngState = nextState;
  }, rngState);

  const current = { ...state, rngState };
  for (const direction of dirs) {
    const attempt = throwBall(current, throwerId, direction);
    if (attempt !== null) {
      return attempt;
    }
  }
  return null;
}

function throwBall(state: GameState, playerId: 1 | 2, forcedDirection?: Direction): GameState | null {
  const player = state.players[playerId];
  const direction = forcedDirection ?? player.direction;
  const delta = DIR_TO_DELTA[direction];
  const firstX = player.position.x + delta.x;
  const firstY = player.position.y + delta.y;
  const blockedByPlayer = isPlayerAt(state, firstX, firstY);
  if (!isWalkable(state, firstX, firstY) || blockedByPlayer) {
    return forcedDirection ? null : { ...state, tick: state.tick + 1 };
  }

  return {
    ...state,
    tick: state.tick + 1,
    ball: {
      ...state.ball,
      position: { x: firstX, y: firstY },
      inFlight: true,
      direction,
      thrownBy: playerId,
    },
    players: {
      ...state.players,
      [playerId]: { ...player, hasBall: false, stepsLeft: STEPS_PER_POSSESSION, flyArmed: false, isFlying: false, flyDirection: null },
    },
  };
}

function scoreAndResetRound(state: GameState, scorerId: 1 | 2): GameState {
  const p1 = state.players[1];
  const p2 = state.players[2];
  const goalsSwapped = !state.goalsSwapped;
  const { tiles, width, height } = state.map;
  const p1OwnGoal = goalTileForPlayer(state, 1, goalsSwapped);
  const p2OwnGoal = goalTileForPlayer(state, 2, goalsSwapped);

  const goalFallback = (goal: Tile.Goal1 | Tile.Goal2) =>
    goal === Tile.Goal1
      ? { x: 3, y: Math.floor(height / 2) }
      : { x: width - 4, y: Math.floor(height / 2) };
  const goalDirection = (goal: Tile.Goal1 | Tile.Goal2): 1 | -1 =>
    goal === Tile.Goal1 ? 1 : -1;

  const p1Spawn = spawnInFrontOfGoal(tiles, width, height, p1OwnGoal, goalFallback(p1OwnGoal), goalDirection(p1OwnGoal));
  let p2Spawn: Coordinate;
  if (state.mode === "PRACTICE") {
    p2Spawn = { x: -1, y: -1 };
  } else {
    p2Spawn = spawnInFrontOfGoal(tiles, width, height, p2OwnGoal, goalFallback(p2OwnGoal), goalDirection(p2OwnGoal));
    if (sameCoord(p1Spawn, p2Spawn)) {
      p2Spawn = findFarthestFloor(state, p2Spawn, p1Spawn);
    }
  }
  const ballSpawn = findCenterFloor(tiles, width, height);

  return {
    ...state,
    tick: state.tick + 1,
    goalsSwapped,
    score: {
      p1: state.score.p1 + (scorerId === 1 ? 1 : 0),
      p2: state.score.p2 + (scorerId === 2 ? 1 : 0),
    },
    ball: {
      position: ballSpawn,
      inFlight: false,
      direction: null,
      thrownBy: null,
    },
    players: {
      1: {
        ...p1,
        position: p1Spawn,
        direction: p1OwnGoal === Tile.Goal1 ? "E" : "W",
        hasBall: false,
        stepsLeft: STEPS_PER_POSSESSION,
        flyArmed: false,
        isFlying: false,
        flyDirection: null,
      },
      2: {
        ...p2,
        position: p2Spawn,
        direction: p2OwnGoal === Tile.Goal1 ? "E" : "W",
        hasBall: false,
        stepsLeft: STEPS_PER_POSSESSION,
        flyArmed: false,
        isFlying: false,
        flyDirection: null,
      },
    },
  };
}

function toggleFly(state: GameState, playerId: 1 | 2): GameState {
  const player = state.players[playerId];
  if (player.isFlying || player.hasBall) {
    return state;
  }
  return {
    ...state,
    tick: state.tick + 1,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        flyArmed: !player.flyArmed,
      },
    },
  };
}

// ── CPU AI ──────────────────────────────────────────────────

const CPU_DIRS: readonly Direction[] = ["N", "E", "S", "W"];
const CPU_MIN_FLY_RUN = 3;
const CPU_FLY_DISTANCE_THRESHOLD = 8;

export function applyCpuDecision(state: GameState): GameState {
  const cpu = state.players[2];
  const p1 = state.players[1];

  if (cpu.isFlying) return state;

  if (!cpu.hasBall && !state.ball.inFlight && isAdjacent(cpu.position, state.ball.position)) {
    return applyAction(state, 2);
  }

  if (isAdjacent(cpu.position, p1.position) && p1.hasBall) {
    return applyAction(state, 2);
  }

  return cpu.hasBall ? cpuWithBall(state) : cpuWithoutBall(state);
}

function cpuWithBall(state: GameState): GameState {
  const cpu = state.players[2];

  const throwDir = cpuScoringThrowDir(state);
  if (throwDir !== null) {
    if (cpu.direction === throwDir) return applyAction(state, 2);
    return applyMove(state, 2, throwDir);
  }

  if (cpu.stepsLeft === 0) {
    return cpuFaceAndThrow(state);
  }

  const target = cpuFindScoringTarget(state);
  if (target !== null) {
    const step = cpuBfsFirstStep(state, cpu.position, target, false);
    if (step !== null) return applyMove(state, 2, step);
  }

  return cpuFaceAndThrow(state);
}

function cpuFaceAndThrow(state: GameState): GameState {
  const cpu = state.players[2];
  const releaseDir = cpuBestReleaseDir(state);
  if (releaseDir !== null && cpu.direction !== releaseDir) {
    return applyMove(state, 2, releaseDir);
  }
  return applyAction(state, 2);
}

function cpuBestReleaseDir(state: GameState): Direction | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  const goalIsLeft = oppGoal === Tile.Goal1;
  const preferred: Direction[] = goalIsLeft
    ? ["W", "N", "S", "E"]
    : ["E", "N", "S", "W"];

  for (const dir of preferred) {
    const delta = DIR_TO_DELTA[dir];
    const x = cpu.position.x + delta.x;
    const y = cpu.position.y + delta.y;
    if (isWalkable(state, x, y) && !isPlayerAt(state, x, y)) {
      return dir;
    }
  }
  return null;
}

function cpuWithoutBall(state: GameState): GameState {
  const cpu = state.players[2];
  const target = cpuBallTarget(state);

  if (cpu.flyArmed) {
    const dir = cpuBestFlyDir(state, target);
    if (dir !== null) return applyMove(state, 2, dir);
    return toggleFly(state, 2);
  }

  if (cpuShouldFly(state, target)) {
    return toggleFly(state, 2);
  }

  const step = cpuBfsFirstStep(state, cpu.position, target, true);
  if (step !== null) return applyMove(state, 2, step);

  return cpuMoveAnywhere(state);
}

function cpuBallTarget(state: GameState): Coordinate {
  if (!state.ball.inFlight || state.ball.direction === null) {
    return state.ball.position;
  }
  const delta = DIR_TO_DELTA[state.ball.direction];
  let x = state.ball.position.x;
  let y = state.ball.position.y;
  for (;;) {
    const nx = x + delta.x;
    const ny = y + delta.y;
    if (!isWalkable(state, nx, ny)) return { x, y };
    x = nx;
    y = ny;
  }
}

function cpuMoveAnywhere(state: GameState): GameState {
  const cpu = state.players[2];
  for (const dir of CPU_DIRS) {
    const moved = applyMove(state, 2, dir);
    if (!sameCoord(moved.players[2].position, cpu.position)) {
      return moved;
    }
  }
  return state;
}

// ── CPU helpers ─────────────────────────────────────────────

function cpuScoringThrowDir(state: GameState): Direction | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  const ordered = [cpu.direction, ...CPU_DIRS.filter(d => d !== cpu.direction)];
  for (const dir of ordered) {
    if (cpuThrowScores(state, cpu.position, dir, oppGoal, false)) return dir;
  }
  return null;
}

function cpuThrowScores(
  state: GameState,
  from: Coordinate,
  dir: Direction,
  goalTile: Tile.Goal1 | Tile.Goal2,
  ignoreP1: boolean,
): boolean {
  const delta = DIR_TO_DELTA[dir];
  let x = from.x + delta.x;
  let y = from.y + delta.y;
  if (!isWalkable(state, x, y)) return false;
  if (!ignoreP1 && isPlayerAt(state, x, y)) return false;

  for (;;) {
    x += delta.x;
    y += delta.y;
    if (!isInside(x, y, state.map.width, state.map.height)) return false;
    if (!ignoreP1 && isPlayerAt(state, x, y)) return false;
    const tile = state.map.tiles[x][y];
    if (tile === goalTile) return true;
    if (tile !== Tile.Floor) return false;
  }
}

function cpuFindScoringTarget(state: GameState): Coordinate | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  let best: Coordinate | null = null;
  let bestDist = Infinity;

  for (let x = 0; x < state.map.width; x += 1) {
    for (let y = 0; y < state.map.height; y += 1) {
      if (state.map.tiles[x][y] !== Tile.Floor) continue;
      for (const dir of CPU_DIRS) {
        if (cpuThrowScores(state, { x, y }, dir, oppGoal, true)) {
          const dist = manhattan(cpu.position, { x, y });
          if (dist < bestDist) {
            bestDist = dist;
            best = { x, y };
          }
          break;
        }
      }
    }
  }
  return best;
}

function cpuBfsFirstStep(
  state: GameState,
  from: Coordinate,
  to: Coordinate,
  reachAdjacent: boolean,
): Direction | null {
  if (reachAdjacent ? isAdjacent(from, to) : sameCoord(from, to)) return null;

  const { width, height, tiles } = state.map;
  const p1 = state.players[1].position;
  const ball = state.ball.position;
  const size = width * height;
  const key = (x: number, y: number): number => x * height + y;

  const visited = new Uint8Array(size);
  const origin: (Direction | null)[] = new Array(size).fill(null);
  const start = key(from.x, from.y);
  visited[start] = 1;

  const queue: number[] = [start];
  let head = 0;

  while (head < queue.length) {
    const ci = queue[head++];
    const cx = (ci / height) | 0;
    const cy = ci % height;

    for (const dir of CPU_DIRS) {
      const d = DIR_TO_DELTA[dir];
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (!isInside(nx, ny, width, height)) continue;
      const ni = key(nx, ny);
      if (visited[ni]) continue;
      if (tiles[nx][ny] !== Tile.Floor) continue;
      if (nx === p1.x && ny === p1.y) continue;
      if (reachAdjacent && nx === ball.x && ny === ball.y) continue;

      visited[ni] = 1;
      origin[ni] = origin[ci] ?? dir;

      const reached = reachAdjacent
        ? isAdjacent({ x: nx, y: ny }, to)
        : nx === to.x && ny === to.y;
      if (reached) return origin[ni]!;

      queue.push(ni);
    }
  }
  return null;
}

function cpuShouldFly(state: GameState, target: Coordinate): boolean {
  if (manhattan(state.players[2].position, target) < CPU_FLY_DISTANCE_THRESHOLD) return false;
  return cpuBestFlyDir(state, target) !== null;
}

function cpuBestFlyDir(state: GameState, target: Coordinate): Direction | null {
  const cpu = state.players[2];
  const p1 = state.players[1].position;
  const currentDist = manhattan(cpu.position, target);

  let bestDir: Direction | null = null;
  let bestDist = currentDist;

  for (const dir of CPU_DIRS) {
    const delta = DIR_TO_DELTA[dir];
    let x = cpu.position.x;
    let y = cpu.position.y;
    let run = 0;

    for (;;) {
      const nx = x + delta.x;
      const ny = y + delta.y;
      if (!isWalkable(state, nx, ny)) break;
      if (nx === p1.x && ny === p1.y) break;
      if (sameCoord(state.ball.position, { x: nx, y: ny })) break;
      x = nx;
      y = ny;
      run += 1;
    }

    if (run < CPU_MIN_FLY_RUN) continue;
    const landDist = manhattan({ x, y }, target);
    if (landDist < bestDist) {
      bestDist = landDist;
      bestDir = dir;
    }
  }
  return bestDir;
}

function applySingleStepMovement(
  state: GameState,
  playerId: 1 | 2,
  direction: Direction
): { position: Coordinate; stepsLeft: number; direction: Direction; isFlying: boolean; flyDirection: Direction | null } {
  const player = state.players[playerId];
  const other = state.players[playerId === 1 ? 2 : 1];
  const delta = DIR_TO_DELTA[direction];
  const nextX = player.position.x + delta.x;
  const nextY = player.position.y + delta.y;
  const canMove =
    nextX >= 0 &&
    nextX < state.map.width &&
    nextY >= 0 &&
    nextY < state.map.height &&
    state.map.tiles[nextX][nextY] === Tile.Floor &&
    !sameCoord(other.position, { x: nextX, y: nextY }) &&
    !sameCoord(state.ball.position, { x: nextX, y: nextY });

  const canSpendMovement = !player.hasBall || player.stepsLeft > 0;
  const moved = canMove && canSpendMovement;
  return {
    position: moved ? { x: nextX, y: nextY } : player.position,
    stepsLeft: player.hasBall && moved ? Math.max(0, player.stepsLeft - 1) : player.stepsLeft,
    direction,
    isFlying: false,
    flyDirection: null,
  };
}

function beginFlyMovement(
  state: GameState,
  playerId: 1 | 2,
  direction: Direction
): { position: Coordinate; stepsLeft: number; direction: Direction; isFlying: boolean; flyDirection: Direction | null } {
  const player = state.players[playerId];
  if (player.hasBall) {
    return {
      position: player.position,
      stepsLeft: player.stepsLeft,
      direction: player.direction,
      isFlying: false,
      flyDirection: null,
    };
  }
  const other = state.players[playerId === 1 ? 2 : 1];
  const delta = DIR_TO_DELTA[direction];
  const x = player.position.x + delta.x;
  const y = player.position.y + delta.y;
  const blockedByBall = sameCoord(state.ball.position, { x, y });
  const moved = isWalkable(state, x, y) && !sameCoord(other.position, { x, y }) && !blockedByBall;
  return {
    position: moved ? { x, y } : player.position,
    stepsLeft: player.stepsLeft,
    direction: moved ? direction : player.direction,
    isFlying: moved,
    flyDirection: moved ? direction : null,
  };
}

function advanceAutoFly(state: GameState): GameState {
  let next = state;
  let changed = false;
  const order: (1 | 2)[] = [1, 2];
  for (const playerId of order) {
    const player = next.players[playerId];
    if (!player.isFlying || player.flyDirection === null) {
      continue;
    }
    const other = next.players[playerId === 1 ? 2 : 1];
    const delta = DIR_TO_DELTA[player.flyDirection];
    const x = player.position.x + delta.x;
    const y = player.position.y + delta.y;
    const blockedByBall = sameCoord(next.ball.position, { x, y });
    const canContinue = isWalkable(next, x, y) && !sameCoord(other.position, { x, y }) && !blockedByBall;

    if (canContinue) {
      changed = true;
      const movedPosition = { x, y };
      next = {
        ...next,
        ball: player.hasBall ? { ...next.ball, position: movedPosition } : next.ball,
        players: {
          ...next.players,
          [playerId]: {
            ...player,
            position: movedPosition,
            direction: player.flyDirection,
          },
        },
      };
    } else {
      changed = true;
      next = {
        ...next,
        players: {
          ...next.players,
          [playerId]: {
            ...player,
            isFlying: false,
            flyDirection: null,
          },
        },
      };
    }
  }

  if (!changed) {
    return state;
  }
  return {
    ...next,
    tick: next.tick + 1,
  };
}

function advanceAutoBall(state: GameState): GameState {
  if (!state.ball.inFlight || state.ball.direction === null || state.ball.thrownBy === null) {
    return state;
  }

  const delta = DIR_TO_DELTA[state.ball.direction];
  const nextX = state.ball.position.x + delta.x;
  const nextY = state.ball.position.y + delta.y;
  const blockedByPlayer = isPlayerAt(state, nextX, nextY);

  if (isWalkable(state, nextX, nextY) && !blockedByPlayer) {
    return {
      ...state,
      tick: state.tick + 1,
      ball: {
        ...state.ball,
        position: { x: nextX, y: nextY },
      },
    };
  }

  if (isOpponentGoalTile(state, state.ball.thrownBy, nextX, nextY)) {
    return scoreAndResetRound(state, state.ball.thrownBy);
  }

  return {
    ...state,
    tick: state.tick + 1,
    ball: {
      ...state.ball,
      inFlight: false,
      direction: null,
      thrownBy: null,
    },
  };
}

function isPlayerAt(state: GameState, x: number, y: number): boolean {
  return sameCoord(state.players[1].position, { x, y }) || sameCoord(state.players[2].position, { x, y });
}

function isWalkable(state: GameState, x: number, y: number): boolean {
  return isInside(x, y, state.map.width, state.map.height) && state.map.tiles[x][y] === Tile.Floor;
}

function isOpponentGoalTile(state: GameState, playerId: 1 | 2, x: number, y: number): boolean {
  if (!isInside(x, y, state.map.width, state.map.height)) {
    return false;
  }
  return state.map.tiles[x][y] === opponentGoalTileForPlayer(state, playerId);
}

function goalTileForPlayer(state: GameState, playerId: 1 | 2, swapped = state.goalsSwapped): Tile.Goal1 | Tile.Goal2 {
  if (!swapped) {
    return playerId === 1 ? Tile.Goal1 : Tile.Goal2;
  }
  return playerId === 1 ? Tile.Goal2 : Tile.Goal1;
}

function opponentGoalTileForPlayer(state: GameState, playerId: 1 | 2): Tile.Goal1 | Tile.Goal2 {
  return goalTileForPlayer(state, playerId) === Tile.Goal1 ? Tile.Goal2 : Tile.Goal1;
}

function findFarthestFloor(state: GameState, from: Coordinate, avoid: Coordinate): Coordinate {
  let best = from;
  let bestScore = -1;
  for (let x = 0; x < state.map.width; x += 1) {
    for (let y = 0; y < state.map.height; y += 1) {
      if (!isWalkable(state, x, y)) {
        continue;
      }
      const c = { x, y };
      if (sameCoord(c, avoid)) {
        continue;
      }
      const score = manhattan(c, from) + manhattan(c, avoid);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
  }
  return best;
}

function randomUnit(rngState: number): [number, number] {
  let state = rngState >>> 0;
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return [state / 4294967296, state];
}

function clearFlyAndTick(state: GameState, playerId: 1 | 2): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    tick: state.tick + 1,
    players: {
      ...state.players,
      [playerId]: { ...player, flyArmed: false, isFlying: false, flyDirection: null },
    },
  };
}

function clearFlyForPlayer(state: GameState, playerId: 1 | 2): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, flyArmed: false, isFlying: false, flyDirection: null },
    },
  };
}

function shuffleDirections(
  dirs: Direction[],
  onState: (nextState: number) => void,
  rngState: number
): void {
  let state = rngState;
  for (let i = dirs.length - 1; i > 0; i -= 1) {
    const [r, next] = randomUnit(state);
    state = next;
    const j = Math.floor(r * (i + 1));
    const tmp = dirs[i];
    dirs[i] = dirs[j];
    dirs[j] = tmp;
  }
  onState(state);
}
