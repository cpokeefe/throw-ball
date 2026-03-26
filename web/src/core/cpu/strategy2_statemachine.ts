/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STRATEGY 2 — ROLE-BASED STATE MACHINE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CONCEPT:
 *   The CPU has a "personality" that shifts between 6 distinct behavioral
 *   roles, like a soccer player switching between positions. Each role
 *   has its own movement rules, priorities, and personality.
 *
 * THE 6 ROLES:
 *
 *   CHASE — "The Sprinter"
 *     Active when: Ball is loose (no one has it, not in flight).
 *     Behavior: BFS straight to the ball. Uses fly for long distances.
 *     Priority: Get to the ball ASAP, nothing else matters.
 *
 *   INTERCEPT — "The Goalkeeper"
 *     Active when: Ball is in flight.
 *     Behavior: Predicts where the ball will land and races there.
 *     If the ball was thrown by P1, tries to stand in its path to block.
 *     Priority: Cut off the ball's trajectory.
 *
 *   ATTACK — "The Striker"
 *     Active when: CPU has ball and can't score from current position.
 *     Behavior: Finds the nearest cell with a scoring line-of-sight and
 *     navigates there. Prefers cells in the opponent's half. If no
 *     scoring cell found within a reasonable distance, advances toward
 *     the opponent's goal anyway to create angles.
 *     Priority: Get to a shooting position.
 *
 *   SHOOT — "The Finisher"
 *     Active when: CPU has ball and HAS line-of-sight to score.
 *     Behavior: Face the scoring direction and throw immediately.
 *     No hesitation, no overthinking.
 *     Priority: SCORE!
 *
 *   PRESSURE — "The Defender"
 *     Active when: P1 has the ball.
 *     Behavior: BFS toward P1 to get adjacent, then punch. Uses fly
 *     to close distance quickly. Aggressive — always pushing forward.
 *     Priority: Steal the ball or force a bad throw.
 *
 *   RETREAT — "The Sweeper"
 *     Active when: Fallback state. CPU doesn't have ball, ball isn't
 *     clearly chaseable, and P1 doesn't have it either.
 *     Behavior: Position between the ball and own goal. Acts as a
 *     defensive screen. If ball comes close, transitions to CHASE.
 *     Priority: Don't leave the goal exposed.
 *
 * ANTI-STUCK MECHANISM:
 *   Each role has a "patience" counter. If the CPU stays in the same role
 *   AND the same position for too many consecutive ticks, it force-
 *   transitions to a different role. RETREAT becomes CHASE, ATTACK becomes
 *   SHOOT (throw wherever), PRESSURE becomes RETREAT, etc. This breaks
 *   deadlocks by fundamentally changing what the CPU is trying to do.
 *
 * WHY IT'S DIFFERENT:
 *   Most game AI uses a single behavior function with lots of conditionals.
 *   This strategy explicitly separates concerns — each role is simple and
 *   focused. The complexity comes from the transitions, not the individual
 *   behaviors. It also means the CPU's behavior is more readable and
 *   predictable from a player's perspective — you can "see" when it
 *   switches from defense to offense.
 */

import { applyAction, applyMove, toggleFly } from "../update";
import { GameState, Direction } from "../types";
import {
  CPU_DIRS,
  DIR_TO_DELTA,
  isAdjacent,
  isWalkable,
  isPlayerAt,
  manhattan,
  sameCoord,
  scoringThrowDir,
  bestReleaseDir,
  predictBallLanding,
  bfsFirstStep,
  opponentGoalX,
  opponentGoalY,
  ownGoalTileForPlayer,
  throwScores,
  opponentGoalTileForPlayer,
  anyLegalDir,
} from "./cpuUtils";

type Role = "CHASE" | "INTERCEPT" | "ATTACK" | "SHOOT" | "PRESSURE" | "RETREAT";

const FLY_THRESHOLD = 7;
const PATIENCE_LIMIT = 6;

let currentRole: Role = "CHASE";
let stuckCounter = 0;
let lastPos: { x: number; y: number } = { x: -1, y: -1 };

function determineRole(state: GameState): Role {
  const cpu = state.players[2];
  const p1 = state.players[1];

  if (cpu.hasBall) {
    const throwDir = scoringThrowDir(state);
    return throwDir !== null ? "SHOOT" : "ATTACK";
  }
  if (state.ball.inFlight) return "INTERCEPT";
  if (p1.hasBall) return "PRESSURE";

  // Ball is loose on the ground
  const distToBall = manhattan(cpu.position, state.ball.position);
  if (distToBall <= 12) return "CHASE";

  return "RETREAT";
}

function updateStuckCounter(state: GameState, role: Role): void {
  const cpu = state.players[2];
  if (role === currentRole && sameCoord(cpu.position, lastPos)) {
    stuckCounter++;
  } else {
    stuckCounter = 0;
  }
  currentRole = role;
  lastPos = { ...cpu.position };
}

function forceUnstick(role: Role): Role {
  const overrides: Record<Role, Role> = {
    CHASE: "RETREAT",
    INTERCEPT: "CHASE",
    ATTACK: "SHOOT",
    SHOOT: "ATTACK",
    PRESSURE: "RETREAT",
    RETREAT: "CHASE",
  };
  return overrides[role];
}

export function applyCpuDecision(state: GameState): GameState {
  const cpu = state.players[2];
  const p1 = state.players[1];

  if (cpu.isFlying) return state;

  // Immediate reactions regardless of role
  if (!cpu.hasBall && !state.ball.inFlight && isAdjacent(cpu.position, state.ball.position)) {
    return applyAction(state, 2);
  }
  if (isAdjacent(cpu.position, p1.position) && p1.hasBall) {
    return applyAction(state, 2);
  }

  let role = determineRole(state);
  updateStuckCounter(state, role);

  if (stuckCounter >= PATIENCE_LIMIT) {
    role = forceUnstick(role);
    stuckCounter = 0;
  }

  switch (role) {
    case "CHASE": return doChase(state);
    case "INTERCEPT": return doIntercept(state);
    case "ATTACK": return doAttack(state);
    case "SHOOT": return doShoot(state);
    case "PRESSURE": return doPressure(state);
    case "RETREAT": return doRetreat(state);
  }
}

// ── CHASE: sprint to the loose ball ──────────────────────────

function doChase(state: GameState): GameState {
  const cpu = state.players[2];
  const target = state.ball.position;
  const dist = manhattan(cpu.position, target);

  // Use fly for long distances
  if (!cpu.flyArmed && dist >= FLY_THRESHOLD) {
    return toggleFly(state, 2);
  }
  if (cpu.flyArmed) {
    const flyDir = bestFlyToward(state, target);
    if (flyDir !== null) return applyMove(state, 2, flyDir);
    return toggleFly(state, 2);
  }

  const step = bfsFirstStep(state, cpu.position, target, true);
  if (step !== null) return applyMove(state, 2, step);

  const fallback = anyLegalDir(state);
  return fallback !== null ? applyMove(state, 2, fallback) : state;
}

// ── INTERCEPT: race to where the ball will land ──────────────

function doIntercept(state: GameState): GameState {
  const cpu = state.players[2];
  const landing = predictBallLanding(state);

  // If ball was thrown by P1, try to stand in its path
  if (state.ball.thrownBy === 1 && state.ball.direction !== null) {
    const pathBlock = findBlockingPosition(state);
    if (pathBlock !== null) {
      const step = bfsFirstStep(state, cpu.position, pathBlock, false);
      if (step !== null) return applyMove(state, 2, step);
    }
  }

  const step = bfsFirstStep(state, cpu.position, landing, true);
  if (step !== null) return applyMove(state, 2, step);

  const fallback = anyLegalDir(state);
  return fallback !== null ? applyMove(state, 2, fallback) : state;
}

/** Find a tile along the ball's flight path that CPU can reach. */
function findBlockingPosition(state: GameState): { x: number; y: number } | null {
  if (!state.ball.direction) return null;
  const delta = DIR_TO_DELTA[state.ball.direction];
  let x = state.ball.position.x;
  let y = state.ball.position.y;
  const cpu = state.players[2];
  let closest: { x: number; y: number } | null = null;
  let closestDist = Infinity;

  for (let i = 0; i < 40; i++) {
    x += delta.x;
    y += delta.y;
    if (!isWalkable(state, x, y)) break;
    const dist = manhattan(cpu.position, { x, y });
    if (dist < closestDist) {
      closestDist = dist;
      closest = { x, y };
    }
  }
  return closest;
}

// ── ATTACK: navigate to a scoring position ───────────────────

function doAttack(state: GameState): GameState {
  const cpu = state.players[2];

  if (cpu.stepsLeft === 0) {
    const release = bestReleaseDir(state);
    if (release !== null && cpu.direction !== release) return applyMove(state, 2, release);
    return applyAction(state, 2);
  }

  // Find nearest cell with scoring line-of-sight
  const target = findScoringCell(state);
  if (target !== null) {
    const step = bfsFirstStep(state, cpu.position, target, false);
    if (step !== null) return applyMove(state, 2, step);
  }

  // No scoring cell found — just advance toward opponent's goal
  const gx = opponentGoalX(state);
  const gy = opponentGoalY(state);
  const goalTarget = { x: Math.round(gx), y: Math.round(gy) };
  const step = bfsFirstStep(state, cpu.position, goalTarget, false);
  if (step !== null) return applyMove(state, 2, step);

  // Really stuck — just throw
  const release = bestReleaseDir(state);
  if (release !== null && cpu.direction !== release) return applyMove(state, 2, release);
  return applyAction(state, 2);
}

function findScoringCell(state: GameState): { x: number; y: number } | null {
  const cpu = state.players[2];
  const oppGoal = opponentGoalTileForPlayer(state, 2);
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;

  for (let x = 0; x < state.map.width; x++) {
    for (let y = 0; y < state.map.height; y++) {
      if (state.map.tiles[x][y] !== 1) continue; // Tile.Floor = 1
      for (const dir of CPU_DIRS) {
        if (throwScores(state, { x, y }, dir, oppGoal, true)) {
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

// ── SHOOT: face and throw ────────────────────────────────────

function doShoot(state: GameState): GameState {
  const cpu = state.players[2];
  const throwDir = scoringThrowDir(state);

  if (throwDir !== null) {
    if (cpu.direction === throwDir) return applyAction(state, 2);
    return applyMove(state, 2, throwDir);
  }

  // Lost the scoring angle — fall through to a throw anyway
  const release = bestReleaseDir(state);
  if (release !== null && cpu.direction !== release) return applyMove(state, 2, release);
  return applyAction(state, 2);
}

// ── PRESSURE: hunt down P1 ──────────────────────────────────

function doPressure(state: GameState): GameState {
  const cpu = state.players[2];
  const p1 = state.players[1];
  const dist = manhattan(cpu.position, p1.position);

  if (!cpu.flyArmed && dist >= FLY_THRESHOLD) {
    return toggleFly(state, 2);
  }
  if (cpu.flyArmed) {
    const flyDir = bestFlyToward(state, p1.position);
    if (flyDir !== null) return applyMove(state, 2, flyDir);
    return toggleFly(state, 2);
  }

  const step = bfsFirstStep(state, cpu.position, p1.position, true);
  if (step !== null) return applyMove(state, 2, step);

  const fallback = anyLegalDir(state);
  return fallback !== null ? applyMove(state, 2, fallback) : state;
}

// ── RETREAT: position between ball and own goal ──────────────

function doRetreat(state: GameState): GameState {
  const cpu = state.players[2];
  const ownGoal = ownGoalTileForPlayer(state, 2);
  const ballTarget = predictBallLanding(state);

  // Find own goal center position
  let goalCenterX = 0, goalCenterY = 0, goalCount = 0;
  for (let x = 0; x < state.map.width; x++) {
    for (let y = 0; y < state.map.height; y++) {
      if (state.map.tiles[x][y] === ownGoal) {
        goalCenterX += x; goalCenterY += y; goalCount++;
      }
    }
  }
  if (goalCount > 0) { goalCenterX /= goalCount; goalCenterY /= goalCount; }

  // Target: midpoint between ball and own goal
  const midX = Math.round((ballTarget.x + goalCenterX) / 2);
  const midY = Math.round((ballTarget.y + goalCenterY) / 2);
  const retreatTarget = { x: midX, y: midY };

  const step = bfsFirstStep(state, cpu.position, retreatTarget, false);
  if (step !== null) return applyMove(state, 2, step);

  const fallback = anyLegalDir(state);
  return fallback !== null ? applyMove(state, 2, fallback) : state;
}

// ── Shared fly helper ────────────────────────────────────────

function bestFlyToward(state: GameState, target: { x: number; y: number }): Direction | null {
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
      x = nx; y = ny; run++;
    }
    if (run < 3) continue;
    const landDist = manhattan({ x, y }, target);
    if (landDist < bestDist) { bestDist = landDist; bestDir = dir; }
  }
  return bestDir;
}
