import { GameState } from "./types";

export interface ReplayLog {
  states: GameState[];
  isAutoAdvance: boolean[];
  targetScore: number;
}

export function createReplayLog(
  initialState: GameState,
  targetScore: number
): ReplayLog {
  return { states: [initialState], isAutoAdvance: [false], targetScore };
}

export function pushState(
  log: ReplayLog,
  state: GameState,
  isAuto: boolean
): void {
  if (state !== log.states[log.states.length - 1]) {
    log.states.push(state);
    log.isAutoAdvance.push(isAuto);
  }
}

/**
 * Groups a flat state list into action groups. Each group starts with
 * a non-auto-advance state followed by any consecutive auto-advance
 * states (ball flight / fly movement).
 */
export function buildActionGroups(log: ReplayLog): GameState[][] {
  const groups: GameState[][] = [];
  let current: GameState[] = [];

  for (let i = 0; i < log.states.length; i++) {
    if (log.isAutoAdvance[i] && current.length > 0) {
      current.push(log.states[i]);
    } else {
      if (current.length > 0) {
        groups.push(current);
      }
      current = [log.states[i]];
    }
  }
  if (current.length > 0) {
    groups.push(current);
  }

  return groups;
}
