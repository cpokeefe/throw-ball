/**
 * ═══════════════════════════════════════════════════════════════════════
 *  STRATEGY 4 — MONTE CARLO LOOKAHEAD
 * ═══════════════════════════════════════════════════════════════════════
 *
 * CONCEPT:
 *   Instead of using heuristics to decide what's "good," this strategy
 *   literally plays out the future. For each possible action the CPU
 *   could take RIGHT NOW, it simulates several random game continuations
 *   ("rollouts") and scores the results. The action whose rollouts
 *   produce the best average outcome wins.
 *
 *   This is a simplified version of Monte Carlo Tree Search (MCTS) —
 *   the algorithm that powered AlphaGo's victory over the world Go
 *   champion. We skip the "tree" part and just do flat rollouts.
 *
 * HOW IT WORKS:
 *
 *   Step 1 — ENUMERATE ACTIONS:
 *     List all legal actions the CPU can take right now:
 *     - Move N, E, S, W (if the destination is walkable)
 *     - ACTION (throw if has ball, punch if adjacent to P1, grab if
 *       adjacent to ball)
 *     - TOGGLE_FLY (if not flying and doesn't have ball)
 *
 *   Step 2 — ROLLOUT:
 *     For each candidate action:
 *       Apply it to get a new state.
 *       Then simulate ROLLOUT_DEPTH steps where BOTH players act
 *       randomly (uniform random legal actions). Repeat NUM_ROLLOUTS
 *       times to average out the randomness.
 *
 *   Step 3 — EVALUATE:
 *     Score each terminal state of a rollout:
 *       +1000 if CPU scored a goal during the rollout
 *       -1000 if P1 scored a goal during the rollout
 *       +200  if CPU has the ball
 *       -150  if P1 has the ball
 *       +100  * (proximity to opponent goal) if CPU has ball
 *       +80   * (proximity to ball) if nobody has it
 *       -50   * (proximity of ball to own goal) defensive penalty
 *
 *   Step 4 — PICK BEST:
 *     The action with the highest average score across all its rollouts
 *     is chosen.
 *
 * PERFORMANCE CONSIDERATIONS:
 *   With NUM_ROLLOUTS=5 and ROLLOUT_DEPTH=8, we simulate ~40 game
 *   steps per candidate action, and there are at most ~6 candidate
 *   actions, so ~240 game step simulations per CPU decision. At the
 *   CPU tick rate (100-500ms), this is very fast since each "step"
 *   is just a few coordinate comparisons.
 *
 *   The rollouts use a lightweight state copy (spread operators) and
 *   don't allocate any complex structures. The RNG is seeded from
 *   the game state for determinism.
 *
 * ANTI-STUCK:
 *   This strategy is naturally resistant to getting stuck because:
 *   1. Random rollouts explore diverse futures, including ones where
 *      the CPU escapes its current position.
 *   2. The "CPU has ball" bonus incentivizes grabbing, while the
 *      "proximity to goal" bonus incentivizes advancing.
 *   3. If ALL actions lead to bad outcomes, the evaluation naturally
 *      picks the "least bad" one, which is still progress.
 *   As extra insurance, if the CPU's position hasn't changed in
 *   STUCK_THRESHOLD ticks, a random legal action is taken instead.
 *
 * WHY IT'S DIFFERENT:
 *   No hand-tuned heuristics for "where to move." No concept of roles,
 *   fields, or heat maps. The CPU discovers good play by TRYING things
 *   out (in simulation) rather than reasoning about them. This means it
 *   can find creative plays that no hand-coded strategy would — like
 *   throwing the ball at a wall so it bounces into a useful position,
 *   or moving "backward" now to set up a better angle later. The
 *   downside is that it's probabilistic — the same situation might
 *   produce different decisions on different ticks.
 */

import { applyAction, applyMove, toggleFly } from "../update";
import { update } from "../update";
import { GameState, Direction, Command } from "../types";
import {
  CPU_DIRS,
  DIR_TO_DELTA,
  isAdjacent,
  isWalkable,
  isPlayerAt,
  manhattan,
  sameCoord,
  scoringThrowDir,
  opponentGoalX,
  opponentGoalY,
  ownGoalTileForPlayer,
  randomUnit,
  anyLegalDir,
} from "./cpuUtils";

const NUM_ROLLOUTS = 5;
const ROLLOUT_DEPTH = 8;
const STUCK_THRESHOLD = 8;

const SCORE_GOAL_CPU = 1000;
const SCORE_GOAL_P1 = -1000;
const SCORE_HAS_BALL = 200;
const SCORE_P1_HAS_BALL = -150;
const SCORE_GOAL_PROX = 100;
const SCORE_BALL_PROX = 80;
const SCORE_DEFEND = -50;

let stuckCount = 0;
let lastPos = { x: -1, y: -1 };

type CandidateAction =
  | { type: "move"; dir: Direction }
  | { type: "action" }
  | { type: "fly" };

export function applyCpuDecision(state: GameState): GameState {
  const cpu = state.players[2];
  const p1 = state.players[1];

  if (cpu.isFlying) return state;

  // Immediate reactions (no need to simulate these — always good)
  if (!cpu.hasBall && !state.ball.inFlight && isAdjacent(cpu.position, state.ball.position)) {
    return applyAction(state, 2);
  }
  if (isAdjacent(cpu.position, p1.position) && p1.hasBall) {
    return applyAction(state, 2);
  }

  // If can score, just do it
  if (cpu.hasBall) {
    const throwDir = scoringThrowDir(state);
    if (throwDir !== null) {
      if (cpu.direction === throwDir) return applyAction(state, 2);
      return applyMove(state, 2, throwDir);
    }
  }

  // Anti-stuck: force random action
  if (sameCoord(cpu.position, lastPos)) {
    stuckCount++;
  } else {
    stuckCount = 0;
  }
  lastPos = { ...cpu.position };

  if (stuckCount >= STUCK_THRESHOLD) {
    stuckCount = 0;
    return forceRandomAction(state);
  }

  // Main Monte Carlo logic
  const candidates = enumerateActions(state);
  if (candidates.length === 0) return state;

  let bestAction = candidates[0];
  let bestScore = -Infinity;
  let rng = state.rngState;

  for (const action of candidates) {
    const nextState = applyCandidateAction(state, action);
    if (nextState === null) continue;

    let totalScore = 0;
    for (let r = 0; r < NUM_ROLLOUTS; r++) {
      const [score, nextRng] = rollout(nextState, rng);
      rng = nextRng;
      totalScore += score;
    }

    const avgScore = totalScore / NUM_ROLLOUTS;
    if (avgScore > bestScore) {
      bestScore = avgScore;
      bestAction = action;
    }
  }

  const result = applyCandidateAction(state, bestAction);
  return result ?? state;
}

function enumerateActions(state: GameState): CandidateAction[] {
  const cpu = state.players[2];
  const actions: CandidateAction[] = [];

  for (const dir of CPU_DIRS) {
    const d = DIR_TO_DELTA[dir];
    const nx = cpu.position.x + d.x;
    const ny = cpu.position.y + d.y;
    if (isWalkable(state, nx, ny) && !isPlayerAt(state, nx, ny)) {
      if (!state.ball.inFlight || !sameCoord(state.ball.position, { x: nx, y: ny })) {
        actions.push({ type: "move", dir });
      }
    }
  }

  actions.push({ type: "action" });

  if (!cpu.isFlying && !cpu.hasBall && !cpu.flyArmed) {
    actions.push({ type: "fly" });
  }

  return actions;
}

function applyCandidateAction(state: GameState, action: CandidateAction): GameState | null {
  switch (action.type) {
    case "move": return applyMove(state, 2, action.dir);
    case "action": return applyAction(state, 2);
    case "fly": return toggleFly(state, 2);
  }
}

/**
 * Simulate a random game from `state` for ROLLOUT_DEPTH steps.
 * Both players take random legal actions each step.
 * Returns [score, nextRngState].
 */
function rollout(state: GameState, rngState: number): [number, number] {
  let s = state;
  let rng = rngState;
  const initialScore = { ...s.score };

  for (let step = 0; step < ROLLOUT_DEPTH; step++) {
    // Advance ball
    s = update(s, { type: "ADVANCE_BALL" });

    // Check if a goal was scored during ball advance
    if (s.score.p1 > initialScore.p1 || s.score.p2 > initialScore.p2) break;

    // Random CPU action
    const [cpuAction, rng1] = randomAction(s, 2, rng);
    rng = rng1;
    if (cpuAction !== null) {
      s = update(s, cpuAction);
    }

    // Random P1 action
    const [p1Action, rng2] = randomAction(s, 1, rng);
    rng = rng2;
    if (p1Action !== null) {
      s = update(s, p1Action);
    }
  }

  return [evaluate(s, initialScore, state), rng];
}

/** Pick a random legal command for the given player. */
function randomAction(state: GameState, playerId: 1 | 2, rng: number): [Command | null, number] {
  const player = state.players[playerId];
  if (player.isFlying) return [null, rng];

  const options: Command[] = [];

  for (const dir of CPU_DIRS) {
    const d = DIR_TO_DELTA[dir];
    const nx = player.position.x + d.x;
    const ny = player.position.y + d.y;
    if (isWalkable(state, nx, ny) && !isPlayerAt(state, nx, ny)) {
      options.push({ type: "MOVE", playerId, direction: dir });
    }
  }

  options.push({ type: "ACTION", playerId });

  if (options.length === 0) return [null, rng];

  const [r, nextRng] = randomUnit(rng);
  const idx = Math.floor(r * options.length);
  return [options[idx], nextRng];
}

/** Score a terminal rollout state relative to the starting state. */
function evaluate(
  endState: GameState,
  startScore: { p1: number; p2: number },
  startState: GameState,
): number {
  let score = 0;

  // Goal scored?
  if (endState.score.p2 > startScore.p2) score += SCORE_GOAL_CPU;
  if (endState.score.p1 > startScore.p1) score += SCORE_GOAL_P1;

  // Ball possession
  if (endState.players[2].hasBall) score += SCORE_HAS_BALL;
  if (endState.players[1].hasBall) score += SCORE_P1_HAS_BALL;

  // CPU proximity to opponent goal (when has ball)
  if (endState.players[2].hasBall) {
    const gx = opponentGoalX(endState);
    const gy = opponentGoalY(endState);
    const maxDist = endState.map.width + endState.map.height;
    const dist = Math.abs(endState.players[2].position.x - gx) +
                 Math.abs(endState.players[2].position.y - gy);
    score += SCORE_GOAL_PROX * (1 - dist / maxDist);
  }

  // CPU proximity to ball (when nobody has it)
  if (!endState.players[1].hasBall && !endState.players[2].hasBall) {
    const maxDist = endState.map.width + endState.map.height;
    const dist = manhattan(endState.players[2].position, endState.ball.position);
    score += SCORE_BALL_PROX * (1 - dist / maxDist);
  }

  // Defensive: penalize ball being near own goal
  const ownGoal = ownGoalTileForPlayer(endState, 2);
  let ownGoalX = 0, ownGoalCount = 0;
  for (let x = 0; x < endState.map.width; x++) {
    for (let y = 0; y < endState.map.height; y++) {
      if (endState.map.tiles[x][y] === ownGoal) { ownGoalX += x; ownGoalCount++; }
    }
  }
  if (ownGoalCount > 0) {
    ownGoalX /= ownGoalCount;
    const ballDist = Math.abs(endState.ball.position.x - ownGoalX);
    const maxDist = endState.map.width;
    score += SCORE_DEFEND * (1 - ballDist / maxDist);
  }

  return score;
}

function forceRandomAction(state: GameState): GameState {
  const dir = anyLegalDir(state);
  if (dir !== null) return applyMove(state, 2, dir);
  return applyAction(state, 2);
}
