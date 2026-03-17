import Phaser from "phaser";
import { GameState, PlayerState, Tile } from "../../core/types";
import {
  FLOOR_COLOR,
  FLOOR_DOT_COLOR,
  PLAYER_1_COLOR,
  PLAYER_2_COLOR,
  PLAYER_BALL_COLOR,
  PLAYER_HIGHLIGHT_ALPHA,
  PLAYER_NO_STEPS_COLOR,
  WALL_BACKGROUND_COLOR,
  WALL_GLYPH_COLOR,
} from "../../config/colors";
import { TILE_SIZE } from "../../config/display";

const FLOOR_DOT_RADIUS_RATIO = 0.1;

const WALL_GLYPH_STROKE_RATIO = 0.12;
const WALL_GLYPH_WIDTH_RATIO = 0.6;
const WALL_GLYPH_HEIGHT_RATIO = 0.75;

const PLAYER_GLYPH_STROKE_RATIO = 0.13;
const PLAYER_CHEVRON_WIDTH_RATIO = 0.47;
const PLAYER_CHEVRON_LENGTH_RATIO = 0.58;

const BALL_RADIUS_RATIO = 0.22;

const GOAL_CHECKER_COLUMNS = 5;
const GOAL_CHECKER_ROWS = 6; // 5 is interesting

// DYNAMIC VISUALIZATION CONSTANTS
const FLY_ARMED_BLINK_MS = 120;

export class PhaserRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private worldHeight: number;

  constructor(scene: Phaser.Scene, worldHeight: number, offsetX = 0, offsetY = 0) {
    this.graphics = scene.add.graphics();
    this.graphics.setPosition(offsetX, offsetY);
    this.worldHeight = worldHeight;
  }

  draw(state: GameState, elapsedMs = 0): void {
    this.graphics.clear();
    const p1 = state.players[1].position;
    const p2 = state.players[2].position;
    const blinkOn = Math.floor(elapsedMs / FLY_ARMED_BLINK_MS) % 2 === 0;

    for (let x = 0; x < state.map.width; x += 1) {
      for (let y = 0; y < state.map.height; y += 1) {
        const hasPlayer = (p1.x === x && p1.y === y) || (p2.x === x && p2.y === y);
        this.drawTile(state, x, y, state.map.tiles[x][y], hasPlayer);
      }
    }

    const holder = state.players[1].hasBall ? 1 : state.players[2].hasBall ? 2 : null;
    if (holder === null) {
      this.drawBall(state.ball.position.x, state.ball.position.y);
    }
    this.drawPlayer(state.players[1], blinkOn);
    this.drawPlayer(state.players[2], blinkOn);
  }

  private drawTile(state: GameState, x: number, y: number, tile: Tile, hasPlayer: boolean): void {
    const px = x * TILE_SIZE;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE;

    switch (tile) {
      case Tile.Wall:
        if (this.isOutsideWallAdjacentToFloor(state, x, y)) {
          this.drawWallTile(px, py);
        } else {
          this.graphics.fillStyle(FLOOR_COLOR, 1);
          this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case Tile.Floor:
        this.drawFloorTile(px, py, hasPlayer);
        break;
      case Tile.Goal1:
        this.drawGoalTile(px, py, this.getGoalColor(state, Tile.Goal1));
        break;
      case Tile.Goal2:
        this.drawGoalTile(px, py, this.getGoalColor(state, Tile.Goal2));
        break;
      default:
        this.graphics.fillStyle(FLOOR_COLOR, 1);
        this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        break;
    }
  }

  private drawFloorTile(px: number, py: number, hasPlayer: boolean): void {
    // Tileset.FLOOR: foreground (128,192,128) on black.
    this.graphics.fillStyle(FLOOR_COLOR, 1);
    this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    if (!hasPlayer) {
      this.graphics.fillStyle(FLOOR_DOT_COLOR, 1);
      this.graphics.fillCircle(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE * FLOOR_DOT_RADIUS_RATIO);
    }
  }

  private drawWallTile(px: number, py: number): void {
    // Tileset.WALL: foreground (60,100,140) on dark gray.
    this.graphics.fillStyle(WALL_BACKGROUND_COLOR, 1);
    this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    this.graphics.fillStyle(WALL_GLYPH_COLOR, 1);
    // Draw an "H" glyph for floor-adjacent border walls.
    const strokeThickness = TILE_SIZE * WALL_GLYPH_STROKE_RATIO;

    const width = TILE_SIZE * WALL_GLYPH_WIDTH_RATIO;
    const height = TILE_SIZE * WALL_GLYPH_HEIGHT_RATIO;
    const insetX = (TILE_SIZE - width) / 2;
    const insetY = (TILE_SIZE - height) / 2;
    const halfThickness = strokeThickness / 2;
    const leftX = px + insetX + halfThickness;
    const rightX = px + TILE_SIZE - insetX - halfThickness;
    const topY = py + insetY;
    const bottomY = py + TILE_SIZE - insetY;
    const midY = py + TILE_SIZE / 2;
    this.fillSegment(leftX, topY, leftX, bottomY, strokeThickness);
    this.fillSegment(rightX, topY, rightX, bottomY, strokeThickness);
    this.fillSegment(leftX, midY, rightX, midY, strokeThickness);
  }

  private isOutsideWallAdjacentToFloor(state: GameState, x: number, y: number): boolean {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= state.map.width || ny >= state.map.height) {
          continue;
        }
        if (state.map.tiles[nx][ny] === Tile.Floor) {
          return true;
        }
      }
    }
    return false;
  }

  private drawPlayer(player: PlayerState, blinkOn: boolean): void {
    const px = player.position.x * TILE_SIZE;
    const py = (this.worldHeight - 1 - player.position.y) * TILE_SIZE;
    if (player.hasBall) {
      this.graphics.fillStyle(player.stepsLeft <= 0 ? PLAYER_NO_STEPS_COLOR : PLAYER_BALL_COLOR, PLAYER_HIGHLIGHT_ALPHA);
      this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
    const glyphColor = player.id === 1 ? PLAYER_1_COLOR : PLAYER_2_COLOR;
    const strokeWidth = TILE_SIZE * PLAYER_GLYPH_STROKE_RATIO;
    this.graphics.fillStyle(glyphColor, 1);

    if (player.flyArmed && !blinkOn) {
      return;
    }

    // space between points of chevron
    const width = TILE_SIZE * PLAYER_CHEVRON_WIDTH_RATIO;
    const length = TILE_SIZE * PLAYER_CHEVRON_LENGTH_RATIO;

    const middle = TILE_SIZE / 2;
    const backSpace = (TILE_SIZE - length) / 2;
    const upperSpace = (TILE_SIZE - width) / 2;

    const xMin = px + upperSpace;
    const xMax = xMin + width;
    const yMin = py + upperSpace;
    const yMax = yMin + width;
    const xNear = px + backSpace;
    const xFar = xNear + length;
    const yNear = py + backSpace;
    const yFar = yNear + length;
    const centerX = px + middle;
    const centerY = py + middle;

    if (player.direction === "N") {
      this.fillChevron(xMin, yFar, centerX, yNear, xMax, yFar, strokeWidth);
    } else if (player.direction === "E") {
      this.fillChevron(xNear, yMin, xFar, centerY, xNear, yMax, strokeWidth);
    } else if (player.direction === "S") {
      this.fillChevron(xMin, yNear, centerX, yFar, xMax, yNear, strokeWidth);
    } else if (player.direction === "W") {
      this.fillChevron(xFar, yMin, xNear, centerY, xFar, yMax, strokeWidth);
    }
  }

  private fillChevron(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, thickness: number): void {
    this.fillSegment(x1, y1, x2, y2, thickness);
    this.fillSegment(x2, y2, x3, y3, thickness);
  }

  private fillSegment(x1: number, y1: number, x2: number, y2: number, thickness: number): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      return;
    }
    const half = thickness / 2;
    const nx = (-dy / length) * half;
    const ny = (dx / length) * half;
    this.graphics.fillPoints(
      [
        new Phaser.Geom.Point(x1 + nx, y1 + ny),
        new Phaser.Geom.Point(x2 + nx, y2 + ny),
        new Phaser.Geom.Point(x2 - nx, y2 - ny),
        new Phaser.Geom.Point(x1 - nx, y1 - ny),
      ],
      true,
      true
    );
  }

  private drawBall(x: number, y: number): void {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE + TILE_SIZE / 2;
    this.graphics.fillStyle(PLAYER_BALL_COLOR, 1);
    this.graphics.fillCircle(px, py, TILE_SIZE * BALL_RADIUS_RATIO);
  }

  private drawGoalTile(px: number, py: number, color: number): void {
    this.graphics.fillStyle(FLOOR_COLOR, 1);
    this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    for (let col = 0; col < GOAL_CHECKER_COLUMNS; col += 1) {
      const x0 = px + Math.floor((col * TILE_SIZE) / GOAL_CHECKER_COLUMNS);
      const x1 = px + Math.floor(((col + 1) * TILE_SIZE) / GOAL_CHECKER_COLUMNS);
      for (let row = 0; row < GOAL_CHECKER_ROWS; row += 1) {
        const y0 = py + Math.floor((row * TILE_SIZE) / GOAL_CHECKER_ROWS);
        const y1 = py + Math.floor(((row + 1) * TILE_SIZE) / GOAL_CHECKER_ROWS);
        const isOuterVerticalLine = col === 0 || col === GOAL_CHECKER_COLUMNS - 1;
        if (!isOuterVerticalLine && (col + row) % 2 === 0) {
          this.graphics.fillStyle(color, 1);
          this.graphics.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
      }
    }
  }

  private getGoalColor(state: GameState, goalTile: Tile.Goal1 | Tile.Goal2): number {
    if (!state.goalsSwapped) {
      return goalTile === Tile.Goal1 ? PLAYER_1_COLOR : PLAYER_2_COLOR;
    }
    return goalTile === Tile.Goal1 ? PLAYER_2_COLOR : PLAYER_1_COLOR;
  }
}
