/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STRATEGY 5 — OPPORTUNISTIC FLANKER
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CONCEPT:
 *   Most CPU strategies take the shortest path. This one deliberately
 *   avoids the shortest path. Instead, it identifies "flanking lanes" —
 *   corridors and open routes that approach the goal from angles that
 *   P1 ISN'T covering. It's the AI equivalent of a basketball player
 *   who drives around the defender rather than through them.
 *
 * HOW IT WORKS:
 *
 *   LANE DETECTION:
 *     The map is scanned for "lanes" — horizontal or vertical runs of
 *     floor tiles that are at least LANE_MIN_LENGTH cells long. Each
 *     lane is scored based on:
 *       - Does it connect (roughly) to the opponent's goal side?
 *       - How far is P1 from the lane? (farther = better flank)
 *       - How close is the CPU to the lane entry point?
 *     The lane with the highest composite score is the "active flank."
 *
 *   COMMITMENT:
 *     Once the CPU picks a flanking lane, it COMMITS to it for
 *     COMMIT_TICKS decision ticks. During commitment, it uses BFS to
 *     navigate to the lane entry, then follows the lane to its end.
 *     This prevents the flip-flopping that plagues reactive AIs —
 *     the CPU picks a plan and sticks with it.
 *
 *   FLY SPRINTS:
 *     Lanes are the PERFECT place to use fly. If the CPU is inside
 *     a lane and the lane direction is clear for 3+ tiles, it arms
 *     fly and sprints down the corridor. This makes the flanker feel
 *     aggressive and fast — it "sprints" through side corridors.
 *
 *   THROW BEHAVIOR:
 *     When the CPU reaches the end of a flanking lane and has the ball:
 *     - If it has line-of-sight to the goal: throw immediately.
 *     - If not: pick a new lane (re-plan) or throw toward the goal
 *       side as a last resort.
 *
 *   WITHOUT BALL:
 *     Uses a "cutoff" strategy instead of direct chase. Computes the
 *     midpoint between the ball and the opponent's goal, then navigates
 *     there. The idea is to intercept the ball AFTER P1 throws it,
 *     rather than chasing P1 around. If the ball is loose and nearby,
 *     switches to direct BFS chase.
 *
 * ANTI-STUCK MECHANISM:
 *   Three-tier anti-stuck:
 *     Tier 1: If committed lane becomes unreachable (BFS returns null),
 *       immediately re-plan with a new lane.
 *     Tier 2: If position hasn't changed in STUCK_THRESHOLD ticks,
 *       drop commitment and pick a random legal direction.
 *     Tier 3: If no lanes are found at all, fall back to simple BFS
 *       toward the ball/goal.
 *
 * WHY IT'S DIFFERENT:
 *   Most AIs think in terms of "what's the best position?" This one
 *   thinks in terms of "what's the best ROUTE?" It's not about where
 *   you end up, but how you get there. The commitment system means
 *   the CPU's behavior is legible — you can see it decide to go
 *   around, sprint down a side corridor, and emerge near the goal.
 *   It creates dramatic moments where the CPU takes an unexpected
 *   path and suddenly appears on your flank.
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
  anyLegalDir,
} from "./cpuUtils";
import { Tile } from "../types";

const LANE_MIN_LENGTH = 4;
const COMMIT_TICKS = 10;
const STUCK_THRESHOLD = 5;
const FLY_MIN_RUN = 3;

interface Lane {
  entry: { x: number; y: number };
  exit: { x: number; y: number };
  direction: Direction;
  length: number;
  score: number;
}

// Persistent state
let activeLane: Lane | null = null;
let commitRemaining = 0;
let stuckCount = 0;
let prevPos = { x: -1, y: -1 };
let phase: "TO_ENTRY" | "IN_LANE" = "TO_ENTRY";

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

  // Stuck detection
  if (sameCoord(cpu.position, prevPos)) {
    stuckCount++;
  } else {
    stuckCount = 0;
  }
  prevPos = { ...cpu.position };

  if (stuckCount >= STUCK_THRESHOLD) {
    activeLane = null;
    commitRemaining = 0;
    stuckCount = 0;
    const dir = anyLegalDir(state);
    if (dir !== null) return applyMove(state, 2, dir);
  }

  if (cpu.hasBall) return withBall(state);
  return withoutBall(state);
}

// ── WITH BALL: flanking lane system ──────────────────────────

function withBall(state: GameState): GameState {
  const cpu = state.players[2];

  // Can score from here? Do it!
  const throwDir = scoringThrowDir(state);
  if (throwDir !== null) {
    activeLane = null;
    commitRemaining = 0;
    if (cpu.direction === throwDir) return applyAction(state, 2);
    return applyMove(state, 2, throwDir);
  }

  // Out of steps — throw
  if (cpu.stepsLeft === 0) {
    activeLane = null;
    commitRemaining = 0;
    const release = bestReleaseDir(state);
    if (release !== null && cpu.direction !== release) return applyMove(state, 2, release);
    return applyAction(state, 2);
  }

  // Pick or continue a flanking lane
  if (commitRemaining <= 0 || activeLane === null) {
    activeLane = pickBestLane(state);
    commitRemaining = COMMIT_TICKS;
    phase = "TO_ENTRY";
  }
  commitRemaining--;

  if (activeLane === null) {
    return fallbackAdvance(state);
  }

  return followLane(state);
}

function followLane(state: GameState): GameState {
  const cpu = state.players[2];
  if (activeLane === null) return fallbackAdvance(state);

  if (phase === "TO_ENTRY") {
    if (sameCoord(cpu.position, activeLane.entry) || manhattan(cpu.position, activeLane.entry) <= 1) {
      phase = "IN_LANE";
    } else {
      const step = bfsFirstStep(state, cpu.position, activeLane.entry, false);
      if (step !== null) return applyMove(state, 2, step);
      // Can't reach entry — re-plan
      activeLane = null;
      commitRemaining = 0;
      return fallbackAdvance(state);
    }
  }

  if (phase === "IN_LANE") {
    // Check if we've reached the exit
    if (sameCoord(cpu.position, activeLane.exit)) {
      activeLane = null;
      commitRemaining = 0;
      // Try to score from new position
      const td = scoringThrowDir(state);
      if (td !== null) {
        if (cpu.direction === td) return applyAction(state, 2);
        return applyMove(state, 2, td);
      }
      return fallbackAdvance(state);
    }

    // Try fly sprint if not holding ball... but we DO have ball, so just walk
    const step = bfsFirstStep(state, cpu.position, activeLane.exit, false);
    if (step !== null) return applyMove(state, 2, step);
    activeLane = null;
    commitRemaining = 0;
    return fallbackAdvance(state);
  }

  return fallbackAdvance(state);
}

function fallbackAdvance(state: GameState): GameState {
  const cpu = state.players[2];
  const gx = opponentGoalX(state);
  const gy = opponentGoalY(state);
  const goalTarget = { x: Math.round(gx), y: Math.round(gy) };
  const step = bfsFirstStep(state, cpu.position, goalTarget, false);
  if (step !== null) return applyMove(state, 2, step);

  const release = bestReleaseDir(state);
  if (release !== null && cpu.direction !== release) return applyMove(state, 2, release);
  return applyAction(state, 2);
}

// ── WITHOUT BALL: cutoff interception ────────────────────────

function withoutBall(state: GameState): GameState {
  const cpu = state.players[2];
  const p1 = state.players[1];
  const ballTarget = predictBallLanding(state);
  const distToBall = manhattan(cpu.position, ballTarget);

  // Close to ball — direct chase
  if (distToBall <= 6) {
    // Try fly for medium distance
    if (!cpu.flyArmed && distToBall >= FLY_MIN_RUN) {
      return toggleFly(state, 2);
    }
    if (cpu.flyArmed) {
      const flyDir = bestFlyToward(state, ballTarget);
      if (flyDir !== null) return applyMove(state, 2, flyDir);
      return toggleFly(state, 2);
    }

    const step = bfsFirstStep(state, cpu.position, ballTarget, true);
    if (step !== null) return applyMove(state, 2, step);
  }

  // Far from ball — go to cutoff point (midpoint between ball and opponent goal)
  const gx = opponentGoalX(state);
  const gy = opponentGoalY(state);
  const cutoffX = Math.round((ballTarget.x + gx) / 2);
  const cutoffY = Math.round((ballTarget.y + gy) / 2);
  const cutoff = { x: cutoffX, y: cutoffY };

  // Use fly for long distances
  const distToCutoff = manhattan(cpu.position, cutoff);
  if (!cpu.flyArmed && distToCutoff >= 8) {
    return toggleFly(state, 2);
  }
  if (cpu.flyArmed) {
    const flyDir = bestFlyToward(state, cutoff);
    if (flyDir !== null) return applyMove(state, 2, flyDir);
    return toggleFly(state, 2);
  }

  const step = bfsFirstStep(state, cpu.position, cutoff, false);
  if (step !== null) return applyMove(state, 2, step);

  // Can't reach cutoff — just go to ball
  const ballStep = bfsFirstStep(state, cpu.position, ballTarget, true);
  if (ballStep !== null) return applyMove(state, 2, ballStep);

  const fallback = anyLegalDir(state);
  return fallback !== null ? applyMove(state, 2, fallback) : state;
}

// ── Lane detection and scoring ───────────────────────────────

/**
 * Scan the map for horizontal and vertical runs of floor tiles.
 * Score each one based on how good a flanking route it provides.
 */
function pickBestLane(state: GameState): Lane | null {
  const cpu = state.players[2];
  const p1 = state.players[1];
  const gx = opponentGoalX(state);
  const { width, height, tiles } = state.map;

  const lanes: Lane[] = [];

  // Horizontal lanes (E/W runs)
  for (let y = 0; y < height; y++) {
    let runStart = -1;
    for (let x = 0; x <= width; x++) {
      const isFloor = x < width && tiles[x][y] === Tile.Floor;
      if (isFloor && runStart === -1) {
        runStart = x;
      } else if (!isFloor && runStart !== -1) {
        const len = x - runStart;
        if (len >= LANE_MIN_LENGTH) {
          const goingRight = gx > cpu.position.x;
          const entry = goingRight ? { x: runStart, y } : { x: x - 1, y };
          const exit = goingRight ? { x: x - 1, y } : { x: runStart, y };
          const dir: Direction = goingRight ? "E" : "W";
          lanes.push({ entry, exit, direction: dir, length: len, score: 0 });
        }
        runStart = -1;
      }
    }
  }

  // Vertical lanes (N/S runs)
  for (let x = 0; x < width; x++) {
    let runStart = -1;
    for (let y = 0; y <= height; y++) {
      const isFloor = y < height && tiles[x][y] === Tile.Floor;
      if (isFloor && runStart === -1) {
        runStart = y;
      } else if (!isFloor && runStart !== -1) {
        const len = y - runStart;
        if (len >= LANE_MIN_LENGTH) {
          lanes.push({
            entry: { x, y: runStart },
            exit: { x, y: y - 1 },
            direction: "N",
            length: len,
            score: 0,
          });
        }
        runStart = -1;
      }
    }
  }

  if (lanes.length === 0) return null;

  // Score each lane
  for (const lane of lanes) {
    // Reward: exit is closer to opponent goal x than entry
    const exitGoalDist = Math.abs(lane.exit.x - gx);
    const entryGoalDist = Math.abs(lane.entry.x - gx);
    lane.score += (entryGoalDist - exitGoalDist) * 10;

    // Reward: P1 is far from the lane midpoint (good flank!)
    const midX = (lane.entry.x + lane.exit.x) / 2;
    const midY = (lane.entry.y + lane.exit.y) / 2;
    const p1Dist = manhattan(p1.position, { x: Math.round(midX), y: Math.round(midY) });
    lane.score += p1Dist * 5;

    // Reward: CPU is close to the entry (can reach it quickly)
    const cpuDist = manhattan(cpu.position, lane.entry);
    lane.score -= cpuDist * 3;

    // Reward longer lanes (more distance from P1)
    lane.score += lane.length * 2;
  }

  lanes.sort((a, b) => b.score - a.score);
  return lanes[0];
}

// ── Fly helper ───────────────────────────────────────────────

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
    if (run < FLY_MIN_RUN) continue;
    const landDist = manhattan({ x, y }, target);
    if (landDist < bestDist) { bestDist = landDist; bestDir = dir; }
  }
  return bestDir;
}
