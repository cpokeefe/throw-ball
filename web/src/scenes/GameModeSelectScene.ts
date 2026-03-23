import Phaser from "phaser";
import { toTextColor, SCORE_TEXT_COLOR } from "../config/colors";
import { FONT_DISPLAY, TITLE_MENU_SCENE } from "../config/display";
import { GAME_MODES, getGameModeEntry, DEFAULT_GAME_MODE } from "../config/gameModes";
import { GameMode } from "../core/types";
import { bindColonCommands } from "../input/colonCommands";

export class GameModeSelectScene extends Phaser.Scene {
  constructor() {
    super("gameModeSelect");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));

    const currentMode = (this.registry.get("gameMode") as GameMode | undefined) ?? DEFAULT_GAME_MODE;
    const fontPx = TITLE_MENU_SCENE.menuFontPx;
    const textStyle = {
      fontFamily: FONT_DISPLAY,
      fontSize: `${fontPx}px`,
      color: toTextColor(SCORE_TEXT_COLOR),
    } as const;

    this.add
      .text(width / 2, height * 0.32, "Change Game Mode", textStyle)
      .setOrigin(0.5);

    const menuLines = GAME_MODES.map(e => `${e.menuLabel} (${e.key})`).join("\n");
    this.add
      .text(width / 2, height * 0.5, menuLines, {
        ...textStyle,
        align: "center",
        lineSpacing: TITLE_MENU_SCENE.menuLineSpacing,
      })
      .setOrigin(0.5);

    const modeLabel = getGameModeEntry(currentMode).hudLabel;
    this.add
      .text(width / 2, height * 0.87, `Current Game Mode: ${modeLabel}`, textStyle)
      .setOrigin(0.5);

    const onKeyDown = (event: KeyboardEvent): void => {
      const entry = GAME_MODES.find(e => e.key === event.key);
      if (entry) {
        this.registry.set("gameMode", entry.mode);
        this.scene.start("titleMenu");
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
