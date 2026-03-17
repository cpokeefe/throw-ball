export const TILE_SIZE = 17;

// in tiles
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 30;
export const MAP_OFFSET = 2;
export const HUD_OFFSET = 4.5;

export const MAP_OFFSET_X = MAP_OFFSET * TILE_SIZE;
export const MAP_OFFSET_Y = (MAP_OFFSET + HUD_OFFSET) * TILE_SIZE;
export const GAME_WIDTH = MAP_WIDTH * TILE_SIZE + MAP_OFFSET_X * 2;
export const GAME_HEIGHT = MAP_OFFSET_Y + MAP_HEIGHT * TILE_SIZE + MAP_OFFSET * TILE_SIZE;
export const GAME_BACKGROUND_COLOR = "#000000";

// Shared HUD layout values for GameScene.
export const DEBUG_HUD_TEXT_MARGIN = 8;
export const TOP_HUD_BAR_Y = 38;
export const TOP_HUD_BAR_WIDTH = 250;
export const TOP_HUD_BAR_HEIGHT = 28;
export const TOP_HUD_BAR_CENTER_GAP = 24;
export const TOP_HUD_BAR_CORNER_RADIUS = 14;
export const TOP_HUD_BAR_DOT_RADIUS = 11;

export const TOP_HUD_STAT_BOX_Y = 66;
export const TOP_HUD_STAT_BOX_WIDTH = 124;
export const TOP_HUD_STAT_BOX_HEIGHT = 24;
export const TOP_HUD_STAT_BOX_GAP = 6;
export const TOP_HUD_STAT_BOX_SIDE_PADDING = 38;
