import Phaser from "phaser";
import { toTextColor, SCORE_TEXT_COLOR } from "../config/colors";
import { FONT_DISPLAY } from "../config/display";
import { TITLE_MENU_SCENE } from "../config/display";

export class TitleMenuScene extends Phaser.Scene {
  constructor() {
    super("titleMenu");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));

    this.add
      .text(width * 0.5, height * 0.25, "Throw Ball", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${TITLE_MENU_SCENE.titleFontPx}px`,
        color: toTextColor(SCORE_TEXT_COLOR),
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.55, "New Game (N)\nLoad Game (L)\nReplay Game (R)\nSwitch Game Mode (X)\nQuit (Q)", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${TITLE_MENU_SCENE.menuFontPx}px`,
        color: toTextColor(SCORE_TEXT_COLOR),
        align: "center",
        lineSpacing: TITLE_MENU_SCENE.menuLineSpacing,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.87, "Current Game Mode: ONEvONE", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${TITLE_MENU_SCENE.menuFontPx}px`,
        color: toTextColor(SCORE_TEXT_COLOR),
      })
      .setOrigin(0.5);

    const startGame = (): void => {
      this.scene.start("game");
    };
    this.input.keyboard?.on("keydown-N", startGame);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-N", startGame);
    });
  }
}
