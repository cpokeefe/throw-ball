/**
 * CPU Strategy Selector
 *
 * Set CPU_STRATEGY to a number 0–5 to choose which AI brain the CPU uses:
 *
 *   0 = Original CPU (baseline — the logic before any changes)
 *       BFS pathfinding + ray-cast scoring. Known to get stuck when
 *       P1 blocks the planned scoring line. No anti-stuck mechanism.
 *
 *   1 = Heat Map Evaluator
 *       Scores every neighbor cell with a multi-layered fitness function
 *       (goal proximity, scoring lines, threat distance) and greedily walks
 *       uphill. Like gradient descent on a landscape of "how good is this tile?"
 *
 *   2 = Role-Based State Machine
 *       CPU switches between distinct behavioral roles (CHASE, INTERCEPT,
 *       ATTACK, SHOOT, PRESSURE, RETREAT). Each role has hardcoded movement
 *       rules. Personality-driven AI — like programming an NPC with moods.
 *
 *   3 = Potential Fields (Physics Engine)
 *       Every game object emits an attractive or repulsive force. The ball
 *       pulls, walls push, P1 repels when CPU has ball. CPU moves along the
 *       net force vector. Anti-stuck via Brownian motion noise.
 *
 *   4 = Monte Carlo Lookahead
 *       For each possible action, simulates several random game futures and
 *       scores the outcomes. Picks the action with the best expected result.
 *       A tiny version of the algorithm behind AlphaGo.
 *
 *   5 = Opportunistic Flanker
 *       Identifies open "flanking lanes" — corridors that reach the goal from
 *       angles P1 isn't covering. Commits to a lane for several ticks, using
 *       fly to sprint down long hallways. Finds the path of least resistance.
 */

import { GameState } from "../types";
import { applyCpuDecision as strategy0 } from "./strategy0_original";
import { applyCpuDecision as strategy1 } from "./strategy1_heatmap";
import { applyCpuDecision as strategy2 } from "./strategy2_statemachine";
import { applyCpuDecision as strategy3 } from "./strategy3_potential";
import { applyCpuDecision as strategy4 } from "./strategy4_montecarlo";
import { applyCpuDecision as strategy5 } from "./strategy5_flanker";

export const CPU_STRATEGY: 0 | 1 | 2 | 3 | 4 | 5 = 0;

const strategies: Record<0 | 1 | 2 | 3 | 4 | 5, (state: GameState) => GameState> = {
  0: strategy0,
  1: strategy1,
  2: strategy2,
  3: strategy3,
  4: strategy4,
  5: strategy5,
};

export function applyCpuDecision(state: GameState): GameState {
  return strategies[CPU_STRATEGY](state);
}
