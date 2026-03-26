export const TILE_SIZE = 18;

export const MAP_WIDTH = 80; // in tiles
export const MAP_HEIGHT = 30; // in tiles

// Font family (HUD, menus, debug overlay)
export const FONT_DISPLAY = "'VeraMono', monospace";

// HUD Y layout
export const TOP_MARGIN = 16;
export const PLAYER_LABEL_FONT_PX = 34;
export const MIDDLE_MARGIN = 16;
export const BOTTOM_MARGIN = 16;

export const FIRST_TO_FONT_PX = 20;
export const SCORE_FONT_PX = 30;
export const BAR_HEIGHT = 36;
export const BAR_CORNER_RADIUS = BAR_HEIGHT / 2;
export const BAR_DOT_GAP = 4;
export const BAR_DOT_RADIUS = BAR_CORNER_RADIUS - BAR_DOT_GAP;

// HUD X layout
export const PLAYER_SCORE_X = 405;
export const SCORE_BAR_GAP = 18;
export const STATUS_BOX_GAP = 8;

// HUD X and Y layout
export const STATUS_BOX_TEXT_MARGIN = 4;
export const STATUS_BOX_FONT_PX = 17;
export const STATUS_BOX_BORDER_WIDTH = 2;

// Debug HUD
export const DEBUG_HUD_FONT_SIZE_PX = 10;
export const DEBUG_HUD_TEXT_MARGIN = 8;

// Bottom controls HUD (fullscreen only)
export const BOTTOM_HUD_FONT_PX = 10;
export const BOTTOM_HUD_PADDING = 8;

/** Pixel height of the HUD band (labels, score row, status row). */
export const HUD_HEIGHT =
  TOP_MARGIN + 
  PLAYER_LABEL_FONT_PX + 
  MIDDLE_MARGIN + 
  STATUS_BOX_TEXT_MARGIN +
  STATUS_BOX_FONT_PX + 
  STATUS_BOX_TEXT_MARGIN +
  BOTTOM_MARGIN;
export const HUD_OFFSET = 0 * TILE_SIZE;
export const TOP_OFFSET = HUD_HEIGHT + HUD_OFFSET;
export const BOTTOM_OFFSET = BOTTOM_HUD_FONT_PX + BOTTOM_HUD_PADDING * 2;
export const GAME_HEIGHT = TOP_OFFSET + MAP_HEIGHT * TILE_SIZE + BOTTOM_OFFSET;

export const HORIZONTAL_OFFSET = 0;
export const GAME_WIDTH = MAP_WIDTH * TILE_SIZE + HORIZONTAL_OFFSET * 2;

/** TitleMenuScene text layout. */
export const TITLE_MENU_SCENE = {
  titleFontPx: 50,
  menuFontPx: 20,
  menuLineSpacing: 12,
} as const;

/** WinScene text layout and timing. */
export const WIN_SCENE = {
  messageFontPx: 58,
  returnDelayMs: 2500,
} as const;
