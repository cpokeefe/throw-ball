import Phaser from "phaser";
import { GameState, Tile } from "../../core/types";

const TILE_SIZE = 16;

export class PhaserRenderer {
  private graphics: Phaser.GameObjects.Graphics;
  private worldHeight: number;

  constructor(scene: Phaser.Scene, worldHeight: number) {
    this.graphics = scene.add.graphics();
    this.worldHeight = worldHeight;
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
    this.drawPlayer(1, state.players[1].position.x, state.players[1].position.y);
    this.drawPlayer(2, state.players[2].position.x, state.players[2].position.y);
    if (holder !== null) {
      const exhausted = state.players[holder].stepsLeft <= 0;
      this.drawHeldBall(state.players[holder].position.x, state.players[holder].position.y, exhausted);
    }
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

  private drawPlayer(id: 1 | 2, x: number, y: number): void {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE + TILE_SIZE / 2;
    this.graphics.fillStyle(id === 1 ? 0x6aff6a : 0xe07bff, 1);
    this.graphics.fillCircle(px, py, TILE_SIZE * 0.38);
  }

  private drawBall(x: number, y: number): void {
    const px = x * TILE_SIZE + TILE_SIZE / 2;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE + TILE_SIZE / 2;
    this.graphics.fillStyle(0xf6d32d, 1);
    this.graphics.fillCircle(px, py, TILE_SIZE * 0.22);
  }

  private drawHeldBall(x: number, y: number, exhausted: boolean): void {
    const px = x * TILE_SIZE + TILE_SIZE * 0.72;
    const py = (this.worldHeight - 1 - y) * TILE_SIZE + TILE_SIZE * 0.28;
    this.graphics.fillStyle(exhausted ? 0xff3b30 : 0xf6d32d, 1);
    this.graphics.fillCircle(px, py, TILE_SIZE * 0.14);
  }
}
