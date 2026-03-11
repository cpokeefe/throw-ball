import Phaser from "phaser";
import { Direction, GameState, PlayerState, Tile } from "../../core/types";

const TILE_SIZE = 16;

export class PhaserRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private worldHeight: number;
  private playerGlyphs: Record<1 | 2, Phaser.GameObjects.Text>;

  constructor(scene: Phaser.Scene, worldHeight: number) {
    this.graphics = scene.add.graphics();
    this.worldHeight = worldHeight;
    this.playerGlyphs = {
      1: scene.add
        .text(0, 0, ">", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#6aff6a",
        })
        .setOrigin(0.5)
        .setDepth(5),
      2: scene.add
        .text(0, 0, "<", {
          fontFamily: "monospace",
          fontSize: "14px",
          color: "#e07bff",
        })
        .setOrigin(0.5)
        .setDepth(5),
    };
  }

  draw(state: GameState): void {
    this.graphics.clear();

    for (let x = 0; x < state.map.width; x += 1) {
      for (let y = 0; y < state.map.height; y += 1) {
        this.drawTile(x, y, state.map.tiles[x][y]);
      }
    }

    const holder = state.players[1].hasBall ? 1 : state.players[2].hasBall ? 2 : null;
    if (holder === null) {
      this.drawBall(state.ball.position.x, state.ball.position.y);
    }
    this.drawPlayer(state.players[1]);
    this.drawPlayer(state.players[2]);
  }

  private drawTile(x: number, y: number, tile: Tile): void {
    const px = x * TILE_SIZE;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE;

    switch (tile) {
      case Tile.Wall:
        this.graphics.fillStyle(0x1c2431, 1);
        break;
      case Tile.Floor:
        this.graphics.fillStyle(0x2f3645, 1);
        break;
      case Tile.Goal1:
        this.graphics.fillStyle(0x31c44f, 1);
        break;
      case Tile.Goal2:
        this.graphics.fillStyle(0xbb4dff, 1);
        break;
      default:
        this.graphics.fillStyle(0x000000, 1);
        break;
    }

    this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    if (tile === Tile.Goal1 || tile === Tile.Goal2) {
      this.graphics.lineStyle(2, 0xffffff, 0.95);
      this.graphics.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

      this.graphics.lineStyle(2, 0x111111, 0.9);
      this.graphics.beginPath();
      this.graphics.moveTo(px + 3, py + TILE_SIZE - 4);
      this.graphics.lineTo(px + TILE_SIZE - 4, py + 3);
      this.graphics.strokePath();
    }
  }

  private drawPlayer(player: PlayerState): void {
    const px = player.position.x * TILE_SIZE;
    const py = (this.worldHeight - 1 - player.position.y) * TILE_SIZE;
    if (player.hasBall) {
      this.graphics.fillStyle(player.stepsLeft <= 0 ? 0xff0000 : 0xffff00, 0.35);
      this.graphics.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }

    const glyph = this.playerGlyphs[player.id];
    glyph.setText(this.iconForDirection(player.direction));
    glyph.setPosition(px + TILE_SIZE / 2, py + TILE_SIZE / 2);
  }

  private drawBall(x: number, y: number): void {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE + TILE_SIZE / 2;
    this.graphics.fillStyle(0xf6d32d, 1);
    this.graphics.fillCircle(px, py, TILE_SIZE * 0.22);
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
}
