import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

const TILE_SIZE = 16;
const MAP_WIDTH = 80;
const MAP_HEIGHT = 30;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: MAP_WIDTH * TILE_SIZE,
  height: MAP_HEIGHT * TILE_SIZE,
  parent: "app",
  backgroundColor: "#0d0f12",
  scene: [BootScene, GameScene],
};

new Phaser.Game(config);
