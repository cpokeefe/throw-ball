/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STRATEGY 3 — POTENTIAL FIELDS (PHYSICS ENGINE)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CONCEPT:
 *   Borrowed from robotics path planning. Every object in the game
 *   generates an invisible "force field." The CPU is a charged particle
 *   floating in the superposition of all these fields. It moves in
 *   whichever cardinal direction has the strongest net attractive pull.
 *
 * THE FIELDS:
 *
 *   Ball Field (attractive):
 *     When CPU doesn't have the ball, the ball (or its predicted landing
 *     spot) emits an attractive force. Strength = K_BALL / distance.
 *     The closer the ball, the stronger the pull. This naturally creates
 *     pursuit behavior without any pathfinding.
 *
 *   Goal Field (attractive, only when holding ball):
 *     The opponent's goal emits a long-range attractive field. The CPU
 *     is gently pulled across the map toward scoring territory.
 *     Strength = K_GOAL / distance.
 *
 *   P1 Field (context-dependent):
 *     When CPU has ball: P1 is REPULSIVE — CPU tries to keep distance
 *     to avoid getting punched. Strength = -K_P1_REPEL / distance².
 *     When P1 has ball: P1 is ATTRACTIVE — CPU closes in to steal.
 *     Strength = K_P1_ATTRACT / distance.
 *     Otherwise: neutral.
 *
 *   Wall Field (repulsive, short-range):
 *     Every non-floor tile within 2 cells emits a repulsive force.
 *     Strength = -K_WALL / distance². This prevents the CPU from
 *     hugging walls and getting stuck in corners. Short range means
 *     it only matters near walls — like a bumper on a pinball machine.
 *
 *   Center Field (attractive, weak):
 *     A mild pull toward the map center. Prevents the CPU from drifting
 *     to the edges where it has fewer movement options.
 *     Strength = K_CENTER / distance.
 *
 *   Visit Penalty Field (repulsive):
 *     Every cell the CPU has visited recently emits a repulsive force.
 *     The more times visited, the stronger the repulsion. This field
 *     DECAYS over time — old visits matter less. This is the primary
 *     anti-stuck mechanism, inspired by "pheromone" trails in ant
 *     colony optimization (but inverted — ants are attracted to
 *     pheromones, we're repelled by our own footprints).
 *
 * ANTI-STUCK: BROWNIAN MOTION
 *   On top of the deterministic forces, a random "thermal noise" vector
 *   is added. The noise amplitude increases when the CPU hasn't moved
 *   in several ticks. This is literally Brownian motion — random
 *   jiggling that increases with temperature. Temperature rises when
 *   stuck, cools when making progress. At high enough temperature,
 *   the random kicks overpower even unfavorable gradients, allowing
 *   escape from local traps.
 *
 * WHY IT'S DIFFERENT:
 *   No graph search, no discrete states, no explicit goals. The CPU's
 *   behavior EMERGES from the interaction of simple force fields. It's
 *   the same principle that makes electrons orbit nuclei and planets
 *   orbit stars. The visit penalty creates an implicit "exploration
 *   pressure" that prevents repetitive paths without any explicit
 *   planning. Movement looks smooth and organic — the CPU appears to
 *   "flow" through the map like water finding the path of least
 *   resistance.
 */

import { applyAction, applyMove } from "../update";
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
  opponentGoalX,
  opponentGoalY,
  anyLegalDir,
  randomUnit,
  isInside,
} from "./cpuUtils";
import { Tile } from "../types";

const K_BALL = 400;
const K_GOAL = 250;
const K_P1_REPEL = 100;
const K_P1_ATTRACT = 300;
const K_WALL = 60;
const K_CENTER = 30;
const K_VISIT = 50;
const VISIT_DECAY = 0.85;
const VISIT_RADIUS = 80;
const BROWNIAN_BASE = 20;
const BROWNIAN_STUCK_MULT = 15;

// Module-level persistent state: visit counts and stuck tracking
let visitMap: Map<string, number> = new Map();
let stuckTicks = 0;
let prevPos: { x: number; y: number } = { x: -1, y: -1 };

function vKey(x: number, y: number): string { return `${x},${y}`; }

export function applyCpuDecision(state: GameState): GameState {
  const cpu = state.players[2];
  const p1 = state.players[1];

  if (cpu.isFlying) return state;

  // Immediate reactions
  if (!cpu.hasBall && !state.ball.inFlight && isAdjacent(cpu.position, state.ball.position)) {
    return applyAction(state, 2);
  }
  if (isAdjacent(cpu.position, p1.position) && p1.hasBall) {
    return applyAction(state, 2);
  }

  if (cpu.hasBall) return withBall(state);
  return withoutBall(state);
}

function withBall(state: GameState): GameState {
  const cpu = state.players[2];

  const throwDir = scoringThrowDir(state);
  if (throwDir !== null) {
    if (cpu.direction === throwDir) return applyAction(state, 2);
    return applyMove(state, 2, throwDir);
  }

  if (cpu.stepsLeft === 0) {
    const release = bestReleaseDir(state);
    if (release !== null && cpu.direction !== release) return applyMove(state, 2, release);
    return applyAction(state, 2);
  }

  return moveByForce(state, true);
}

function withoutBall(state: GameState): GameState {
  return moveByForce(state, false);
}

/**
 * Core: compute the net force on each neighboring cell, pick the
 * direction with the strongest attractive pull.
 */
function moveByForce(state: GameState, hasBall: boolean): GameState {
  const cpu = state.players[2];

  // Update stuck tracking
  if (sameCoord(cpu.position, prevPos)) {
    stuckTicks++;
  } else {
    stuckTicks = 0;
  }
  prevPos = { ...cpu.position };

  // Record visit (with decay of old visits)
  const k = vKey(cpu.position.x, cpu.position.y);
  visitMap.set(k, (visitMap.get(k) ?? 0) + 1);
  decayVisits();

  let bestDir: Direction | null = null;
  let bestForce = -Infinity;
  let rng = state.rngState;

  for (const dir of CPU_DIRS) {
    const d = DIR_TO_DELTA[dir];
    const nx = cpu.position.x + d.x;
    const ny = cpu.position.y + d.y;

    if (!isWalkable(state, nx, ny) || isPlayerAt(state, nx, ny)) continue;
    if (!hasBall && !state.ball.inFlight && sameCoord(state.ball.position, { x: nx, y: ny })) continue;

    let force = 0;

    // Ball attraction (when chasing)
    if (!hasBall) {
      const ballTarget = predictBallLanding(state);
      const dist = Math.max(1, manhattan({ x: nx, y: ny }, ballTarget));
      force += K_BALL / dist;
    }

    // Goal attraction (when has ball)
    if (hasBall) {
      const gx = opponentGoalX(state);
      const gy = opponentGoalY(state);
      const dist = Math.max(1, Math.abs(nx - gx) + Math.abs(ny - gy));
      force += K_GOAL / dist;
    }

    // P1 field
    const p1 = state.players[1];
    const p1Dist = Math.max(1, manhattan({ x: nx, y: ny }, p1.position));
    if (hasBall) {
      force -= K_P1_REPEL / (p1Dist * p1Dist);
    } else if (p1.hasBall) {
      force += K_P1_ATTRACT / p1Dist;
    }

    // Wall repulsion (scan nearby tiles)
    let wallPush = 0;
    for (let wx = nx - 2; wx <= nx + 2; wx++) {
      for (let wy = ny - 2; wy <= ny + 2; wy++) {
        if (wx === nx && wy === ny) continue;
        if (!isInside(wx, wy, state.map.width, state.map.height)) {
          wallPush += K_WALL / 1;
          continue;
        }
        if (state.map.tiles[wx][wy] !== Tile.Floor) {
          const wd = Math.max(1, Math.abs(wx - nx) + Math.abs(wy - ny));
          wallPush += K_WALL / (wd * wd);
        }
      }
    }
    force -= wallPush;

    // Center attraction
    const cx = state.map.width / 2;
    const cy = state.map.height / 2;
    const centerDist = Math.max(1, Math.abs(nx - cx) + Math.abs(ny - cy));
    force += K_CENTER / centerDist;

    // Visit penalty
    const visits = visitMap.get(vKey(nx, ny)) ?? 0;
    force -= K_VISIT * visits;

    // Brownian motion: random noise that increases when stuck
    const amplitude = BROWNIAN_BASE + stuckTicks * BROWNIAN_STUCK_MULT;
    const [r, nextRng] = randomUnit(rng + nx * 127 + ny * 311);
    rng = nextRng;
    force += (r - 0.5) * amplitude;

    if (force > bestForce) {
      bestForce = force;
      bestDir = dir;
    }
  }

  if (bestDir !== null) return applyMove(state, 2, bestDir);

  const fallback = anyLegalDir(state);
  return fallback !== null ? applyMove(state, 2, fallback) : state;
}

/** Decay all visit counts by VISIT_DECAY, pruning near-zero entries. */
function decayVisits(): void {
  if (visitMap.size > VISIT_RADIUS) {
    const entries = [...visitMap.entries()];
    entries.sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < entries.length - VISIT_RADIUS; i++) {
      visitMap.delete(entries[i][0]);
    }
  }
  for (const [key, val] of visitMap) {
    const decayed = val * VISIT_DECAY;
    if (decayed < 0.1) visitMap.delete(key);
    else visitMap.set(key, decayed);
  }
}
