import { GameMode } from "../core/types";

export interface GameModeEntry {
  mode: GameMode;
  menuLabel: string;
  hudLabel: string;
  key: string;
}

export const GAME_MODES: readonly GameModeEntry[] = [
  { mode: "PRACTICE",          menuLabel: "Practice",             hudLabel: "PRACTICE",          key: "1" },
  { mode: "ONE_V_CPU",         menuLabel: "One v CPU",            hudLabel: "ONEvCPU",           key: "2" },
  { mode: "ONE_V_ONE",         menuLabel: "One v One",            hudLabel: "ONEvONE",           key: "3" },
  { mode: "ONE_ONE_V_CPU_CPU", menuLabel: "One, One v CPU, CPU",  hudLabel: "ONE,ONEvCPU,CPU",   key: "4" },
  { mode: "ONE_CPU_V_ONE_CPU", menuLabel: "One, CPU v One, CPU",  hudLabel: "ONE,CPUvONE,CPU",   key: "5" },
  { mode: "ONE_ONE_V_ONE_ONE", menuLabel: "One, One v One, One",  hudLabel: "ONE,ONEvONE,ONE",   key: "6" },
];

const COMING_SOON_MODES: ReadonlySet<GameMode> = new Set<GameMode>([
  "ONE_ONE_V_CPU_CPU",
  "ONE_CPU_V_ONE_CPU",
  "ONE_ONE_V_ONE_ONE",
]);

export const DEFAULT_GAME_MODE: GameMode = "ONE_V_ONE";

export function getGameModeEntry(mode: GameMode): GameModeEntry {
  return GAME_MODES.find(e => e.mode === mode) ?? GAME_MODES[0];
}

export function isComingSoon(mode: GameMode): boolean {
  return COMING_SOON_MODES.has(mode);
}

export function isPlayer2Active(mode: GameMode): boolean {
  return mode !== "PRACTICE";
}
