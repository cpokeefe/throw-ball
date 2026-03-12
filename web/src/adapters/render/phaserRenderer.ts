import Phaser from "phaser";
import { Direction, GameState, PlayerState, Tile } from "../../core/types";

const TILE_SIZE = 16;
const PLAYER_ICON_FONT_SIZE = "18px";
const GOAL_GLYPH = "▒";
const GOAL_FONT_SIZE = "16px";

export class PhaserRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private worldHeight: number;
  private playerGlyphs: Record<1 | 2, Phaser.GameObjects.Text>;
  private goalGlyphs: Phaser.GameObjects.Text[];
  private static readonly FLY_ARMED_BLINK_MS = 120;

  constructor(scene: Phaser.Scene, worldHeight: number) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.worldHeight = worldHeight;
    this.goalGlyphs = [];
    this.playerGlyphs = {
      1: scene.add
        .text(0, 0, ">", {
          fontFamily: "monospace",
          fontSize: PLAYER_ICON_FONT_SIZE,
          color: "#6aff6a",
        })
        .setOrigin(0.5)
        .setDepth(5),
      2: scene.add
        .text(0, 0, "<", {
          fontFamily: "monospace",
          fontSize: PLAYER_ICON_FONT_SIZE,
          color: "#e07bff",
        })
        .setOrigin(0.5)
        .setDepth(5),
    };
  }

  draw(state: GameState, elapsedMs = 0): void {
    this.graphics.clear();
    let goalGlyphIndex = 0;
    const p1 = state.players[1].position;
    const p2 = state.players[2].position;
    const blinkOn = Math.floor(elapsedMs / PhaserRenderer.FLY_ARMED_BLINK_MS) % 2 === 0;

    for (let x = 0; x < state.map.width; x += 1) {
      for (let y = 0; y < state.map.height; y += 1) {
        const hasPlayer = (p1.x === x && p1.y === y) || (p2.x === x && p2.y === y);
        goalGlyphIndex = this.drawTile(state, x, y, state.map.tiles[x][y], hasPlayer, goalGlyphIndex);
      }
    }
    this.hideUnusedGoalGlyphs(goalGlyphIndex);

    const holder = state.players[1].hasBall ? 1 : state.players[2].hasBall ? 2 : null;
    if (holder === null) {
      this.drawBall(state.ball.position.x, state.ball.position.y);
    }
    this.drawPlayer(state.players[1], blinkOn);
    this.drawPlayer(state.players[2], blinkOn);
  }

  private drawTile(state: GameState, x: number, y: number, tile: Tile, hasPlayer: boolean, goalGlyphIndex: number): number {
    const px = x * TILE_SIZE;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE;

    switch (tile) {
      case Tile.Wall:
        if (this.isOutsideWallAdjacentToFloor(state, x, y)) {
          this.drawWallTile(px, py);
        } else {
          this.graphics.fillStyle(0x000000, 1);
          this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case Tile.Floor:
        this.drawFloorTile(px, py, hasPlayer);
        break;
      case Tile.Goal1:
        this.drawGoalTile(px, py, "#bb4dff", goalGlyphIndex);
        return goalGlyphIndex + 1;
      case Tile.Goal2:
        this.drawGoalTile(px, py, "#31c44f", goalGlyphIndex);
        return goalGlyphIndex + 1;
      default:
        this.graphics.fillStyle(0x000000, 1);
        this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        break;
    }
    return goalGlyphIndex;
  }

  private drawFloorTile(px: number, py: number, hasPlayer: boolean): void {
    // Tileset.FLOOR: foreground (128,192,128) on black.
    this.graphics.fillStyle(0x000000, 1);
    this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    if (!hasPlayer) {
      this.graphics.fillStyle(0x80c080, 1);
      this.graphics.fillCircle(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE * 0.11);
    }
  }

  private drawWallTile(px: number, py: number): void {
    // Tileset.WALL: foreground (60,100,140) on dark gray.
    this.graphics.fillStyle(0x404040, 1);
    this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    this.graphics.fillStyle(0x3c648c, 1);
    // Draw an "H" glyph for floor-adjacent border walls.
    this.graphics.fillRect(px + 3, py + 2, 2, TILE_SIZE - 4);
    this.graphics.fillRect(px + TILE_SIZE - 5, py + 2, 2, TILE_SIZE - 4);
    this.graphics.fillRect(px + 3, py + Math.floor(TILE_SIZE / 2) - 1, TILE_SIZE - 6, 2);
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
      this.graphics.fillStyle(player.stepsLeft <= 0 ? 0xff0000 : 0xffff00, 0.35);
      this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }

    const glyph = this.playerGlyphs[player.id];
    glyph.setText(this.iconForDirection(player.direction));
    glyph.setPosition(px + TILE_SIZE / 2, py + TILE_SIZE / 2 + this.iconYOffset(player.direction));
    glyph.setVisible(!player.flyArmed || blinkOn);
  }

  private drawBall(x: number, y: number): void {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE + TILE_SIZE / 2;
    this.graphics.fillStyle(0xf6d32d, 1);
    this.graphics.fillCircle(px, py, TILE_SIZE * 0.22);
  }

  private drawGoalTile(px: number, py: number, color: string, index: number): void {
    this.graphics.fillStyle(0x000000, 1);
    this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    const glyph = this.getGoalGlyph(index);
    glyph.setText(GOAL_GLYPH);
    glyph.setColor(color);
    glyph.setBackgroundColor("#000000");
    glyph.setPosition(px, py - 1);
    glyph.setVisible(true);
  }

  private getGoalGlyph(index: number): Phaser.GameObjects.Text {
    if (!this.goalGlyphs[index]) {
      this.goalGlyphs[index] = this.scene.add
        .text(0, 0, GOAL_GLYPH, {
          fontFamily: "monospace",
          fontSize: GOAL_FONT_SIZE,
          color: "#ffffff",
          backgroundColor: "#000000",
        })
        .setOrigin(0)
        .setDepth(2)
        .setVisible(false);
    }
    return this.goalGlyphs[index];
  }

  private hideUnusedGoalGlyphs(used: number): void {
    for (let i = used; i < this.goalGlyphs.length; i += 1) {
      this.goalGlyphs[i].setVisible(false);
    }
  }

  private iconForDirection(direction: Direction): string {
    if (direction === "N") {
      return "ʌ";
    }
    if (direction === "E") {
      return ">";
    }
    if (direction === "S") {
      return "v";
    }
    return "<";
  }

  private iconYOffset(direction: Direction): number {
    if (direction === "N" || direction === "S") {
      return 0;
    }
    if (direction === "E" || direction === "W") {
      return 10;
    }
    return 0;
  }
}
