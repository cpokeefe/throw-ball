import Phaser from "phaser";
import { toTextColor, SCORE_TEXT_COLOR } from "../config/colors";
import { FONT_DISPLAY, TITLE_MENU_SCENE } from "../config/display";
import { bindColonCommands } from "../input/colonCommands";

export class SeedScene extends Phaser.Scene {
  private digits: string = "";
  private seedDisplayText!: Phaser.GameObjects.Text;
  private startPromptText!: Phaser.GameObjects.Text;

  constructor() {
    super("seed");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));
    this.digits = "";

    const fontPx = TITLE_MENU_SCENE.menuFontPx;
    const textColor = toTextColor(SCORE_TEXT_COLOR);
    const textStyle = {
      fontFamily: FONT_DISPLAY,
      fontSize: `${fontPx}px`,
      color: textColor,
    } as const;

    this.add
      .text(width / 2, height * 0.35, "Enter a numerical seed", textStyle)
      .setOrigin(0.5);

    this.seedDisplayText = this.add
      .text(width / 2, height * 0.5, "", textStyle)
      .setOrigin(0.5);

    this.startPromptText = this.add
      .text(width / 2, height * 0.62, "Start Game (S)", textStyle)
      .setOrigin(0.5)
      .setVisible(false);

    this.add
      .text(fontPx * 0.5, height - fontPx * 0.5, "Back (B)", textStyle)
      .setOrigin(0, 1);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toUpperCase() === "B" && this.digits.length === 0) {
        this.scene.start("titleMenu");
        return;
      }
      if (event.key >= "0" && event.key <= "9") {
        this.digits += event.key;
        this.seedDisplayText.setText(this.digits);
        this.startPromptText.setVisible(true);
        return;
      }
      if (event.key === "Backspace") {
        this.digits = this.digits.slice(0, -1);
        this.seedDisplayText.setText(this.digits);
        this.startPromptText.setVisible(this.digits.length > 0);
        return;
      }
      if (event.key.toUpperCase() === "S" && this.digits.length > 0) {
        const seed = parseInt(this.digits, 10);
        if (!Number.isNaN(seed)) {
          this.registry.set("customSeed", seed);
          this.registry.set("savedGameState", null);
          this.scene.start("game");
        }
      }
    };

    this.input.keyboard?.on("keydown", onKeyDown);

    bindColonCommands(this, undefined, {
      exitToTitle: () => {
        this.scene.start("titleMenu");
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", onKeyDown);
    });
  }
}
