import Phaser from "phaser";
import { toTextColor, SCORE_TEXT_COLOR } from "../config/colors";
import { FONT_DISPLAY, WIN_SCENE } from "../config/display";
import { getGameModeEntry } from "../config/gameModes";
import { GameMode } from "../core/types";
import { bindColonCommands } from "../input/colonCommands";

type ComingSoonData = {
  mode?: GameMode;
};

export class ComingSoonScene extends Phaser.Scene {
  private mode: GameMode = "ONE_ONE_V_CPU_CPU";

  constructor() {
    super("comingSoon");
  }

  init(data: ComingSoonData): void {
    if (data.mode != null) {
      this.mode = data.mode;
    }
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));

    const label = getGameModeEntry(this.mode).menuLabel;

    this.add
      .text(width * 0.5, height * 0.5, `${label} coming soon!`, {
        fontFamily: FONT_DISPLAY,
        fontSize: `${WIN_SCENE.messageFontPx}px`,
        color: toTextColor(SCORE_TEXT_COLOR),
      })
      .setOrigin(0.5);

    const returnToTitle = (): void => {
      this.scene.start("titleMenu");
    };

    bindColonCommands(this, undefined, {
      exitToTitle: returnToTitle,
    });

    const returnTimer = this.time.delayedCall(WIN_SCENE.returnDelayMs, returnToTitle);

    const onKeyDown = (): void => {
      returnToTitle();
    };

    this.input.keyboard?.on("keydown", onKeyDown);
    this.input.once("pointerdown", returnToTitle);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (returnTimer.getProgress() < 1) {
        returnTimer.remove(false);
      }
      this.input.keyboard?.off("keydown", onKeyDown);
      this.input.off("pointerdown", returnToTitle);
    });
  }
}
