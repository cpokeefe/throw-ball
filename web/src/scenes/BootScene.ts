import Phaser from "phaser";
import { IS_TEST_MODE } from "../config/env";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    this.scene.start(IS_TEST_MODE ? "game" : "titleMenu");
  }
}
