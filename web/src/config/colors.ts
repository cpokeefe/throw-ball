// Shared color palette for player visuals and HUD.
// Keep Phaser-facing values as numeric hex.

export const GAME_BACKGROUND_COLOR = "#000000";

export const PLAYER_1_COLOR = 0x00ff00;
export const PLAYER_2_COLOR = 0xff00ff;
export const CPU_COLOR = 0xc0c0c0;
export const PLAYER_3_COLOR = 0x00ccff;
export const PLAYER_4_COLOR = 0xff8800;

export function player2Color(isCpu: boolean): number {
  return isCpu ? CPU_COLOR : PLAYER_2_COLOR;
}

export const FLOOR_COLOR = 0x000000;
export const FLOOR_DOT_COLOR = 0x80c080;
export const WALL_BACKGROUND_COLOR = 0x404040;
export const WALL_GLYPH_COLOR = 0x3c648c;

export const BALL_COLOR = 0xffff00;
export const NO_STEPS_COLOR = 0xff3333;
export const PLAYER_HIGHLIGHT_ALPHA = 0.35;
export const FLY_TEXT_COLOR = 0x3399ff;
export const PLAYER_BASE_TEXT_COLOR = 0x9a9a9a;
export const PLAYER_BASE_BORDER_COLOR = 0x666666;
export const SCORE_TEXT_COLOR = 0xffffff;
export const BAR_BACKGROUND_COLOR = 0xe8e8e8;

export function toTextColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
