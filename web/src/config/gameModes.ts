import { GameMode } from "../core/types";

export interface GameModeEntry {
  mode: GameMode;
  menuLabel: string;
  hudLabel: string;
  key: string;
}

export const GAME_MODES: readonly GameModeEntry[] = [
  { mode: "ONE_V_ONE", menuLabel: "One v One", hudLabel: "ONEvONE", key: "1" },
  { mode: "ONE_V_CPU", menuLabel: "One v CPU", hudLabel: "ONEvCPU", key: "2" },
  { mode: "PRACTICE",  menuLabel: "Practice",  hudLabel: "PRACTICE", key: "3" },
];

export const DEFAULT_GAME_MODE: GameMode = "PRACTICE";

export function getGameModeEntry(mode: GameMode): GameModeEntry {
  return GAME_MODES.find(e => e.mode === mode) ?? GAME_MODES[0];
}

export function isPlayer2Active(mode: GameMode): boolean {
  return mode !== "PRACTICE";
}
