/**
 * Tunable game rules and simulation timing: possession step budget, win score, and per-system tick intervals (ball vs. fly).
 */

export const STEPS_PER_POSSESSION = 5;

export const GAME_RULES = {
  scoreToWin: 3,
} as const;

/** Milliseconds between simulation steps (ball vs. movement/fly). */
export const SIM_TICK_MS = {
  ball: 3,
  fly: 6,
} as const;

/** Milliseconds between CPU decisions. Lower = harder. */
export const CPU_TICK_MS = 250;
