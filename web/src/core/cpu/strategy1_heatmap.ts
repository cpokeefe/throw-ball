/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STRATEGY 1 — HEAT MAP EVALUATOR
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CONCEPT:
 *   Imagine laying a thermal camera over the game map. Every tile has a
 *   "temperature" — a composite desirability score built from several
 *   layered factors. The CPU is a heat-seeking missile: it always moves
 *   toward the hottest adjacent cell.
 *
 * HOW IT WORKS:
 *   Each decision tick, the CPU evaluates all 4 cardinal neighbors and
 *   its current cell (standing still). Each cell gets a score that is
 *   the SUM of multiple "heat layers":
 *
 *   WHEN CPU HAS THE BALL:
 *     Layer 1 — Goal Magnetism:
 *       Tiles closer to the opponent's goal X-coordinate are hotter.
 *       Score = GOAL_WEIGHT * (1 - dist_to_goal_x / map_width)
 *       This pulls the CPU across the map toward the scoring end.
 *
 *     Layer 2 — Scoring Line Bonus:
 *       If a tile has direct line-of-sight to the goal in any direction,
 *       it gets a massive bonus. This makes the CPU "see" shooting
 *       opportunities and gravitate toward them.
 *       Score = SCORING_LINE_BONUS if any throw direction scores.
 *
 *     Layer 3 — P1 Avoidance:
 *       Tiles closer to P1 are colder. The CPU tries to keep distance
 *       from the human to avoid getting punched/stolen.
 *       Score = AVOID_P1_WEIGHT * (dist_to_p1 / map_diagonal)
 *
 *   WHEN CPU DOESN'T HAVE THE BALL:
 *     Layer 1 — Ball Attraction:
 *       Tiles closer to the ball (or predicted landing spot) are hotter.
 *       Score = BALL_WEIGHT * (1 - dist_to_ball / map_diagonal)
 *
 *     Layer 2 — P1 Pressure:
 *       When P1 has the ball, tiles closer to P1 are hotter (to punch).
 *       Score = PRESSURE_WEIGHT * (1 - dist_to_p1 / map_diagonal)
 *
 *   ANTI-STUCK MECHANISM:
 *     Tracks the CPU's last several positions. If the same tile appears
 *     3+ times in the recent window, a random "jitter" bonus is added
 *     to break oscillation patterns. This acts like simulated annealing —
 *     high temperature when stuck, cooling when making progress.
 *
 * WHY IT'S DIFFERENT:
 *   No pathfinding at all. No BFS, no A*. The CPU is purely reactive —
 *   it can only see its immediate neighbors and picks the best one.
 *   This means it can get trapped in local maxima (e.g., a dead-end
 *   corridor that's technically "closer" to the goal) but the jitter
 *   mechanism helps it escape. The result is movement that looks organic
 *   and exploratory rather than robotically optimal.
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
  opponentGoalX,
  opponentGoalY,
  scoringThrowDir,
  bestReleaseDir,
  predictBallLanding,
  throwScores,
  opponentGoalTileForPlayer,
  randomUnit,
  anyLegalDir,
} from "./cpuUtils";

const GOAL_WEIGHT = 200;
const SCORING_LINE_BONUS = 600;
const AVOID_P1_WEIGHT = 120;
const BALL_WEIGHT = 300;
const PRESSURE_WEIGHT = 150;
const JITTER_STRENGTH = 250;
const HISTORY_SIZE = 8;
const STUCK_THRESHOLD = 3;

// Module-level position history for anti-stuck detection
let positionHistory: { x: number; y: number }[] = [];

export function applyCpuDecision(state: GameState): GameState {
  const cpu = state.players[2];
  const p1 = state.players[1];

  if (cpu.isFlying) return state;

  // Immediate reactions: grab loose ball, punch ball carrier
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

  // If we can score from here, face and throw
  const throwDir = scoringThrowDir(state);
  if (throwDir !== null) {
    if (cpu.direction === throwDir) return applyAction(state, 2);
    return applyMove(state, 2, throwDir);
  }

  // Out of steps — face the best open direction and throw
  if (cpu.stepsLeft === 0) {
    const release = bestReleaseDir(state);
    if (release !== null && cpu.direction !== release) return applyMove(state, 2, release);
    return applyAction(state, 2);
  }

  // Evaluate neighbors using the heat map
  const dir = pickHottestNeighbor(state, true);
  if (dir !== null) return applyMove(state, 2, dir);

  // Absolute fallback
  const release = bestReleaseDir(state);
  if (release !== null && cpu.direction !== release) return applyMove(state, 2, release);
  return applyAction(state, 2);
}

function withoutBall(state: GameState): GameState {
  const dir = pickHottestNeighbor(state, false);
  if (dir !== null) return applyMove(state, 2, dir);

  const fallback = anyLegalDir(state);
  if (fallback !== null) return applyMove(state, 2, fallback);
  return state;
}

/**
 * Core heat map logic: score each of the 4 adjacent cells and pick the hottest.
 * Also scores "staying put" — if the current cell is hotter than all neighbors,
 * we still move (using the best neighbor) to avoid permanent camping.
 */
function pickHottestNeighbor(state: GameState, hasBall: boolean): Direction | null {
  const cpu = state.players[2];

  // Track position for anti-stuck
  positionHistory.push({ ...cpu.position });
  if (positionHistory.length > HISTORY_SIZE) positionHistory.shift();

  // Count how many times current position appears in recent history
  const stuckCount = positionHistory.filter(p => p.x === cpu.position.x && p.y === cpu.position.y).length;
  const isStuck = stuckCount >= STUCK_THRESHOLD;

  let bestDir: Direction | null = null;
  let bestScore = -Infinity;

  // Seeded jitter derived from game tick (deterministic but varied)
  let rng = state.rngState;

  for (const dir of CPU_DIRS) {
    const d = DIR_TO_DELTA[dir];
    const nx = cpu.position.x + d.x;
    const ny = cpu.position.y + d.y;

    if (!isWalkable(state, nx, ny) || isPlayerAt(state, nx, ny)) continue;
    // Can't step on a grounded ball
    if (!state.ball.inFlight && sameCoord(state.ball.position, { x: nx, y: ny })) continue;

    let score = computeHeat(state, nx, ny, hasBall);

    // Anti-stuck jitter: add pseudo-random noise when oscillating
    if (isStuck) {
      const [r, nextRng] = randomUnit(rng + nx * 997 + ny * 31);
      rng = nextRng;
      score += r * JITTER_STRENGTH;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }

  return bestDir;
}

function computeHeat(state: GameState, x: number, y: number, hasBall: boolean): number {
  const p1 = state.players[1];
  const mapW = state.map.width;
  const mapDiag = mapW + state.map.height;
  const gx = opponentGoalX(state);
  const gy = opponentGoalY(state);

  let heat = 0;

  if (hasBall) {
    // Layer 1: Goal magnetism — closer to opponent goal X = hotter
    const distToGoal = Math.abs(x - gx) + Math.abs(y - gy);
    heat += GOAL_WEIGHT * (1 - distToGoal / mapDiag);

    // Layer 2: Scoring line bonus — can we throw to score from here?
    const oppGoal = opponentGoalTileForPlayer(state, 2);
    for (const dir of CPU_DIRS) {
      if (throwScores(state, { x, y }, dir, oppGoal, true)) {
        heat += SCORING_LINE_BONUS;
        break;
      }
    }

    // Layer 3: P1 avoidance — stay away from the human
    const distToP1 = manhattan({ x, y }, p1.position);
    heat += AVOID_P1_WEIGHT * (distToP1 / mapDiag);
  } else {
    // Layer 1: Ball attraction — get to the ball (or where it'll land)
    const ballTarget = predictBallLanding(state);
    const distToBall = manhattan({ x, y }, ballTarget);
    heat += BALL_WEIGHT * (1 - distToBall / mapDiag);

    // Layer 2: P1 pressure — when P1 has ball, get close to punch
    if (p1.hasBall) {
      const distToP1 = manhattan({ x, y }, p1.position);
      heat += PRESSURE_WEIGHT * (1 - distToP1 / mapDiag);
    }
  }

  return heat;
}
