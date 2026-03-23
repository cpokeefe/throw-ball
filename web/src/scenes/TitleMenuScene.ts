import Phaser from "phaser";
import {
  toTextColor,
  SCORE_TEXT_COLOR,
  PLAYER_1_COLOR,
  player2Color,
} from "../config/colors";
import { FONT_DISPLAY, TITLE_MENU_SCENE } from "../config/display";
import { getGameModeEntry, DEFAULT_GAME_MODE } from "../config/gameModes";
import { GameMode } from "../core/types";
import { bindColonCommands } from "../input/colonCommands";
import { getSiteControls } from "../siteBridge";

export class TitleMenuScene extends Phaser.Scene {
  constructor() {
    super("titleMenu");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));

    const titleY = height * 0.32;
    const fontPx = TITLE_MENU_SCENE.titleFontPx;
    const titleStyle = {
      fontFamily: FONT_DISPLAY,
      fontSize: `${fontPx}px`,
      color: toTextColor(SCORE_TEXT_COLOR),
    } as const;

    const leftText = this.add.text(0, titleY, "Thro", titleStyle).setOrigin(0, 0.5);
    const rightText = this.add.text(0, titleY, " Ball", titleStyle).setOrigin(0, 0.5);

    // Two touching V's (4 segments) read as a "w" between "Thro" and " Ball".
    // Width matches reference: roughly one monospace "O" wide; stroke is bold like the cap letters.
    const measure_v = this.add.text(-1000, -1000, "v", titleStyle);
    const vWidth = measure_v.width * 0.71;
    measure_v.destroy();

    const wWidth = vWidth * 2;
    const wDepth = fontPx * 0.29;
    const wAlignY = titleY + fontPx * 0.085;
    const wTop = wAlignY - wDepth;
    const wBottom = wAlignY + wDepth;
    const wStroke = fontPx * 0.11;
    const currentMode = (this.registry.get("gameMode") as GameMode | undefined) ?? DEFAULT_GAME_MODE;
    /** Stroke thickness for each V segment (parallelogram width). */
    const segmentParallel = wStroke;

    const totalW = leftText.width + wWidth + rightText.width;
    const startX = width * 0.5 - totalW * 0.5;
    leftText.setX(startX);
    const wLeft = startX + leftText.width;
    rightText.setX(wLeft + wWidth);

    const a = { x: wLeft, y: wTop };
    const b = { x: wLeft + vWidth * 0.5, y: wBottom };
    const c = { x: wLeft + vWidth, y: wTop };
    const d = { x: wLeft + vWidth, y: wTop };
    const e = { x: wLeft + vWidth * 1.5, y: wBottom };
    const f = { x: wLeft + wWidth, y: wTop };

    const g = this.add.graphics();
    const fillSegmentAsParallelogram = (
      color: number,
      p1: { x: number; y: number },
      p2: { x: number; y: number },
    ): void => {
      // Keep top and bottom edges horizontal (parallel to y = 0).
      g.fillStyle(color, 1);
      g.fillPoints(
        [
          new Phaser.Geom.Point(p1.x, p1.y),
          new Phaser.Geom.Point(p1.x + segmentParallel, p1.y),
          new Phaser.Geom.Point(p2.x + segmentParallel, p2.y),
          new Phaser.Geom.Point(p2.x, p2.y),
        ],
        true,
        true
      );
    };
    const isPractice = currentMode === "PRACTICE";
    const p2Color = isPractice ? SCORE_TEXT_COLOR : player2Color(currentMode === "ONE_V_CPU");
    // Draw right V first, then left V, so the left V appears on top where they overlap.
    fillSegmentAsParallelogram(p2Color, d, e);
    fillSegmentAsParallelogram(p2Color, f, e);
    fillSegmentAsParallelogram(PLAYER_1_COLOR, a, b);
    fillSegmentAsParallelogram(PLAYER_1_COLOR, c, b);

    this.add
      .text(
        width / 2,
        height * 0.6,
        "New Game (N)\nLoad Game (L)\nSwitch Game Mode (X)\nMute (M)\nFull Screen (F)\nQuit (Q)",
        {
          fontFamily: FONT_DISPLAY,
          fontSize: `${TITLE_MENU_SCENE.menuFontPx}px`,
          color: toTextColor(SCORE_TEXT_COLOR),
          align: "center",
          lineSpacing: TITLE_MENU_SCENE.menuLineSpacing,
        }
      )
      .setOrigin(0.5);

    const modeLabel = getGameModeEntry(currentMode).hudLabel;
    this.add
      .text(width / 2, height * 0.87, `Current Game Mode: ${modeLabel}`, {
        fontFamily: FONT_DISPLAY,
        fontSize: `${TITLE_MENU_SCENE.menuFontPx}px`,
        color: toTextColor(SCORE_TEXT_COLOR),
      })
      .setOrigin(0.5);

    const startGame = (): void => {
      this.registry.set("savedGameState", null);
      this.scene.start("game");
    };
    const loadGame = (): void => {
      const saved = this.registry.get("savedGameState");
      if (saved != null) {
        this.scene.start("game", { loadState: true });
      }
    };
    const switchGameMode = (): void => {
      this.scene.start("gameModeSelect");
    };
    const site = getSiteControls();
    const toggleMute = (): void => { site?.toggleMute(); };
    const quitGame = (): void => { site?.quitToWebsite(); };
    const toggleFullscreen = (): void => { site?.toggleFullscreen(); };

    this.input.keyboard?.on("keydown-N", startGame);
    this.input.keyboard?.on("keydown-L", loadGame);
    this.input.keyboard?.on("keydown-X", switchGameMode);
    this.input.keyboard?.on("keydown-M", toggleMute);
    this.input.keyboard?.on("keydown-Q", quitGame);
    this.input.keyboard?.on("keydown-F", toggleFullscreen);

    bindColonCommands(this, undefined, {
      exitToTitle: () => {},
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-N", startGame);
      this.input.keyboard?.off("keydown-L", loadGame);
      this.input.keyboard?.off("keydown-X", switchGameMode);
      this.input.keyboard?.off("keydown-M", toggleMute);
      this.input.keyboard?.off("keydown-Q", quitGame);
      this.input.keyboard?.off("keydown-F", toggleFullscreen);
    });
  }
}
