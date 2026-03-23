import Phaser from "phaser";
import { toTextColor, SCORE_TEXT_COLOR } from "../config/colors";
import { FONT_DISPLAY } from "../config/display";
import { WIN_SCENE } from "../config/display";

type WinSceneData = {
  winner?: number;
};

export class WinScene extends Phaser.Scene {
  private winner = 1;

  constructor() {
    super("win");
  }

  init(data: WinSceneData): void {
    this.winner = data.winner === 2 ? 2 : 1;
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));

    this.add
      .text(width * 0.5, height * 0.5, `Player ${this.winner} wins!`, {
        fontFamily: FONT_DISPLAY,
        fontSize: `${WIN_SCENE.messageFontPx}px`,
        color: toTextColor(SCORE_TEXT_COLOR),
      })
      .setOrigin(0.5);

    const returnToTitle = (): void => {
      this.scene.start("titleMenu");
    };

    const returnTimer = this.time.delayedCall(WIN_SCENE.returnDelayMs, returnToTitle);
    this.input.keyboard?.once("keydown", returnToTitle);
    this.input.once("pointerdown", returnToTitle);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (returnTimer.getProgress() < 1) {
        returnTimer.remove(false);
      }
      this.input.keyboard?.off("keydown", returnToTitle);
      this.input.off("pointerdown", returnToTitle);
    });
  }
}
