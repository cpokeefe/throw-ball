import Phaser from "phaser";
import { toTextColor, PLAYER_1_COLOR, player2Color } from "../config/colors";
import { FONT_DISPLAY } from "../config/display";
import { WIN_SCENE } from "../config/display";
import { GameMode } from "../core/types";
import { bindColonCommands } from "../input/colonCommands";

type WinSceneData = {
  winner?: number;
  mode?: GameMode;
};

export class WinScene extends Phaser.Scene {
  private winner = 1;
  private mode: GameMode = "ONE_V_ONE";

  constructor() {
    super("win");
  }

  init(data: WinSceneData): void {
    this.winner = data.winner === 2 ? 2 : 1;
    this.mode = data.mode ?? "ONE_V_ONE";
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));

    const isCpu = this.mode === "ONE_V_CPU";
    const winnerLabel = this.winner === 1 ? "Player 1" : isCpu ? "CPU" : "Player 2";
    const winnerColor = this.winner === 1 ? PLAYER_1_COLOR : player2Color(isCpu);

    this.add
      .text(width * 0.5, height * 0.5, `${winnerLabel} wins!`, {
        fontFamily: FONT_DISPLAY,
        fontSize: `${WIN_SCENE.messageFontPx}px`,
        color: toTextColor(winnerColor),
      })
      .setOrigin(0.5);

    const returnToTitle = (): void => {
      this.scene.start("titleMenu");
    };

    bindColonCommands(this, undefined, {
      exitToTitle: returnToTitle,
    });

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
