import Phaser from "phaser";
import { toTextColor, SCORE_TEXT_COLOR } from "../config/colors";
import { FONT_DISPLAY, TITLE_MENU_SCENE } from "../config/display";
import { type CpuLevel, DEFAULT_SETTINGS } from "../config/rules";
import { bindColonCommands } from "../input/colonCommands";

export class SettingsScene extends Phaser.Scene {
  private targetScore = DEFAULT_SETTINGS.targetScore;
  private cpuLevel: CpuLevel = DEFAULT_SETTINGS.cpuLevel;
  private useRandomSeed = DEFAULT_SETTINGS.useRandomSeed;
  private digitBuffer: number[] = [];

  private scoreValueText!: Phaser.GameObjects.Text;
  private cpuValueText!: Phaser.GameObjects.Text;
  private cpuOptionsText!: Phaser.GameObjects.Text;
  private seedValueText!: Phaser.GameObjects.Text;
  private seedOptionsText!: Phaser.GameObjects.Text;

  constructor() {
    super("settings");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));

    this.targetScore =
      (this.registry.get("targetScore") as number | undefined) ??
      DEFAULT_SETTINGS.targetScore;
    this.cpuLevel =
      (this.registry.get("cpuLevel") as CpuLevel | undefined) ??
      DEFAULT_SETTINGS.cpuLevel;
    this.useRandomSeed =
      (this.registry.get("useRandomSeed") as boolean | undefined) ??
      DEFAULT_SETTINGS.useRandomSeed;
    this.digitBuffer = [];

    const fontPx = TITLE_MENU_SCENE.menuFontPx;
    const lineHeight = fontPx + TITLE_MENU_SCENE.menuLineSpacing;
    const normalStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_DISPLAY,
      fontSize: `${fontPx}px`,
      color: toTextColor(SCORE_TEXT_COLOR),
    };
    const boldStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      ...normalStyle,
      fontStyle: "bold",
    };

    this.add
      .text(width / 2, height * 0.3, "Settings", normalStyle)
      .setOrigin(0.5);

    const rowStartY = height * 0.48;
    const leftX = width * 0.3;
    const rightX = width * 0.7;

    const scoreLabel = this.add.text(
      leftX,
      rowStartY,
      "Target Score: ",
      normalStyle
    );
    this.scoreValueText = this.add.text(
      scoreLabel.x + scoreLabel.width,
      rowStartY,
      String(this.targetScore),
      boldStyle
    );
    this.add
      .text(rightX, rowStartY, "1 - 99", normalStyle)
      .setOrigin(1, 0);

    const row2Y = rowStartY + lineHeight;
    const cpuLabel = this.add.text(leftX, row2Y, "CPU Level: ", normalStyle);
    this.cpuValueText = this.add.text(
      cpuLabel.x + cpuLabel.width,
      row2Y,
      this.cpuLevelLabel(),
      boldStyle
    );
    this.cpuOptionsText = this.add
      .text(rightX, row2Y, this.cpuOptionsLabel(), normalStyle)
      .setOrigin(1, 0);

    const row3Y = rowStartY + lineHeight * 2;
    const seedLabel = this.add.text(
      leftX,
      row3Y,
      "Random Seed: ",
      normalStyle
    );
    this.seedValueText = this.add.text(
      seedLabel.x + seedLabel.width,
      row3Y,
      this.useRandomSeed ? "Yes" : "No",
      boldStyle
    );
    this.seedOptionsText = this.add
      .text(rightX, row3Y, this.seedOptionsLabel(), normalStyle)
      .setOrigin(1, 0);

    this.add
      .text(width * 0.12, height * 0.92, "Back (B)", normalStyle);

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key >= "0" && event.key <= "9") {
        this.handleDigit(parseInt(event.key, 10));
        return;
      }
      switch (event.key.toUpperCase()) {
        case "E":
          this.setCpuLevel("easy");
          break;
        case "M":
          this.setCpuLevel("medium");
          break;
        case "H":
          this.setCpuLevel("hard");
          break;
        case "Y":
          this.setRandomSeed(true);
          break;
        case "N":
          this.setRandomSeed(false);
          break;
        case "B":
          this.scene.start("titleMenu");
          break;
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

  private handleDigit(digit: number): void {
    this.digitBuffer.push(digit);
    if (this.digitBuffer.length > 2) {
      this.digitBuffer.shift();
    }
    const value =
      this.digitBuffer.length === 1
        ? this.digitBuffer[0]
        : this.digitBuffer[0] * 10 + this.digitBuffer[1];
    if (value >= 1 && value <= 99) {
      this.targetScore = value;
      this.registry.set("targetScore", this.targetScore);
      this.scoreValueText.setText(String(this.targetScore));
    }
  }

  private setCpuLevel(level: CpuLevel): void {
    this.cpuLevel = level;
    this.registry.set("cpuLevel", this.cpuLevel);
    this.cpuValueText.setText(this.cpuLevelLabel());
    this.cpuOptionsText.setText(this.cpuOptionsLabel());
  }

  private setRandomSeed(value: boolean): void {
    this.useRandomSeed = value;
    this.registry.set("useRandomSeed", this.useRandomSeed);
    this.seedValueText.setText(this.useRandomSeed ? "Yes" : "No");
    this.seedOptionsText.setText(this.seedOptionsLabel());
  }

  private cpuLevelLabel(): string {
    switch (this.cpuLevel) {
      case "easy":
        return "Easy";
      case "medium":
        return "Medium";
      case "hard":
        return "Hard";
    }
  }

  private cpuOptionsLabel(): string {
    switch (this.cpuLevel) {
      case "easy":
        return "Medium (M), Hard (H)";
      case "medium":
        return "Easy (E), Hard (H)";
      case "hard":
        return "Easy (E), Medium (M)";
    }
  }

  private seedOptionsLabel(): string {
    return this.useRandomSeed ? "No (N)" : "Yes (Y)";
  }
}
