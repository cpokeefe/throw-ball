import Phaser from "phaser";
import {
  toTextColor,
  SCORE_TEXT_COLOR,
  PLAYER_1_COLOR,
  PLAYER_2_COLOR,
  CPU_COLOR,
  PLAYER_3_COLOR,
  PLAYER_4_COLOR,
} from "../config/colors";
import { FONT_DISPLAY, TITLE_MENU_SCENE } from "../config/display";
import { DEFAULT_SETTINGS } from "../config/rules";
import { isComingSoon, DEFAULT_GAME_MODE } from "../config/gameModes";
import { GameMode } from "../core/types";
import { bindColonCommands } from "../input/colonCommands";
import { getSiteControls } from "../siteBridge";
import { setupEasterEggs } from "./titleEasterEggs";

type VFlashSpec = {
  left: { colors: [number, number] } | { static: number };
  right: { colors: [number, number] } | { static: number };
};

const FLASH_MS = 500;

function vSpecForMode(mode: GameMode): VFlashSpec {
  switch (mode) {
    case "ONE_ONE_V_CPU_CPU":
      return {
        left: { colors: [PLAYER_1_COLOR, PLAYER_2_COLOR] },
        right: { static: CPU_COLOR },
      };
    case "ONE_CPU_V_ONE_CPU":
      return {
        left: { colors: [PLAYER_1_COLOR, CPU_COLOR] },
        right: { colors: [PLAYER_2_COLOR, CPU_COLOR] },
      };
    case "ONE_ONE_V_ONE_ONE":
      return {
        left: { colors: [PLAYER_1_COLOR, PLAYER_3_COLOR] },
        right: { colors: [PLAYER_2_COLOR, PLAYER_4_COLOR] },
      };
    case "PRACTICE":
      return {
        left: { static: PLAYER_1_COLOR },
        right: { static: SCORE_TEXT_COLOR },
      };
    case "ONE_V_CPU":
      return {
        left: { static: PLAYER_1_COLOR },
        right: { static: CPU_COLOR },
      };
    case "ONE_V_ONE":
    default:
      return {
        left: { static: PLAYER_1_COLOR },
        right: { static: PLAYER_2_COLOR },
      };
  }
}

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

    const fillV = (
      gfx: Phaser.GameObjects.Graphics,
      color: number,
      top1: { x: number; y: number },
      bot: { x: number; y: number },
      top2: { x: number; y: number },
    ): void => {
      gfx.clear();
      const seg = (p1: { x: number; y: number }, p2: { x: number; y: number }): void => {
        gfx.fillStyle(color, 1);
        gfx.fillPoints(
          [
            new Phaser.Geom.Point(p1.x, p1.y),
            new Phaser.Geom.Point(p1.x + segmentParallel, p1.y),
            new Phaser.Geom.Point(p2.x + segmentParallel, p2.y),
            new Phaser.Geom.Point(p2.x, p2.y),
          ],
          true,
          true,
        );
      };
      seg(top1, bot);
      seg(top2, bot);
    };

    const spec = vSpecForMode(currentMode);

    const rightVGfx = this.add.graphics();
    const leftVGfx = this.add.graphics();

    const staticLeftColor = "static" in spec.left ? spec.left.static : spec.left.colors[0];
    const staticRightColor = "static" in spec.right ? spec.right.static : spec.right.colors[0];

    fillV(rightVGfx, staticRightColor, d, e, f);
    fillV(leftVGfx, staticLeftColor, a, b, c);

    if ("colors" in spec.left) {
      const [c0, c1] = spec.left.colors;
      let idx = 0;
      this.time.delayedCall(FLASH_MS / 2, () => {
        fillV(leftVGfx, c1, a, b, c);
        idx = 1;
        this.time.addEvent({
          delay: FLASH_MS,
          loop: true,
          callback: () => {
            idx = 1 - idx;
            fillV(leftVGfx, idx === 0 ? c0 : c1, a, b, c);
          },
        });
      });
    }

    if ("colors" in spec.right) {
      const [c0, c1] = spec.right.colors;
      let idx = 0;
      this.time.addEvent({
        delay: FLASH_MS,
        loop: true,
        callback: () => {
          idx = 1 - idx;
          fillV(rightVGfx, idx === 0 ? c0 : c1, d, e, f);
        },
      });
    }

    const { trigger: easterEgg } = setupEasterEggs(this, {
      leftVGfx, rightVGfx, fillV, a, b, c, d, e, f,
      staticLeftColor, staticRightColor,
      height, startX, wLeft, vWidth, wTop, wBottom,
      fontPx, titleY, charW: leftText.width / 4,
    });

    const hasReplay = this.registry.get("replayLog") != null;
    const menuLines = [
      "New Game (N)",
      "Load Game (L)",
      "Replay Game (R)",
      "Switch Game Mode (X)",
      "Settings (S)",
      "Guide (G)",
    ];
    this.add
      .text(
        width / 2,
        height * 0.58,
        menuLines.join("\n"),
        {
          fontFamily: FONT_DISPLAY,
          fontSize: `${TITLE_MENU_SCENE.menuFontPx}px`,
          color: toTextColor(SCORE_TEXT_COLOR),
          align: "center",
          lineSpacing: TITLE_MENU_SCENE.menuLineSpacing,
        }
      )
      .setOrigin(0.5);

    const footerText = this.add
      .text(
        width / 2,
        height * 0.96,
        "",
        {
          fontFamily: FONT_DISPLAY,
          fontSize: `${TITLE_MENU_SCENE.menuFontPx}px`,
          color: toTextColor(SCORE_TEXT_COLOR),
        }
      )
      .setOrigin(0.5, 1);
    const syncFooterBar = (): void => {
      const fs = this.scale.isFullscreen ? "Exit Full Screen (F)" : "Full Screen (F)";
      const musicMuted =
        (this.registry.get("musicMuted") as boolean | undefined) ?? false;
      const muteLabel = musicMuted ? "Unmute (M)" : "Mute (M)";
      footerText.setText(`${muteLabel}  ${fs}  Quit (Q)`);
    };
    syncFooterBar();
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, syncFooterBar);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, syncFooterBar);
    const onRegistryMusicMuted = (_parent: unknown, key: string | number): void => {
      if (key === "musicMuted") {
        syncFooterBar();
      }
    };
    this.registry.events.on("setdata", onRegistryMusicMuted);
    this.registry.events.on("changedata", onRegistryMusicMuted);

    const startGame = (): void => {
      if (isComingSoon(currentMode)) {
        this.scene.start("comingSoon", { mode: currentMode });
        return;
      }
      const useRandomSeed =
        (this.registry.get("useRandomSeed") as boolean | undefined) ??
        DEFAULT_SETTINGS.useRandomSeed;
      if (useRandomSeed) {
        this.registry.set("savedGameState", null);
        this.scene.start("game");
      } else {
        this.scene.start("seed");
      }
    };
    const loadGame = (): void => {
      if (isComingSoon(currentMode)) {
        this.scene.start("comingSoon", { mode: currentMode });
        return;
      }
      const saved = this.registry.get("savedGameState");
      if (saved != null) {
        this.scene.start("game", { loadState: true });
      }
    };
    const switchGameMode = (): void => {
      this.scene.start("gameModeSelect");
    };
    const openSettings = (): void => {
      this.scene.start("settings");
    };
    const openGuide = (): void => {
      this.scene.start("guide");
    };
    const site = getSiteControls();
    const toggleMute = (): void => { site?.toggleMute(); };
    const quitGame = (): void => { site?.quitToWebsite(); };
    const toggleFullscreen = (): void => { site?.toggleFullscreen(); };
    const watchReplay = (): void => {
      if (hasReplay) {
        this.scene.start("replay");
      }
    };

    this.input.keyboard?.on("keydown-N", startGame);
    this.input.keyboard?.on("keydown-L", loadGame);
    this.input.keyboard?.on("keydown-R", watchReplay);
    this.input.keyboard?.on("keydown-X", switchGameMode);
    this.input.keyboard?.on("keydown-S", openSettings);
    this.input.keyboard?.on("keydown-G", openGuide);
    this.input.keyboard?.on("keydown-M", toggleMute);
    this.input.keyboard?.on("keydown-Q", quitGame);
    this.input.keyboard?.on("keydown-F", toggleFullscreen);
    this.input.keyboard?.on("keydown-E", easterEgg);

    bindColonCommands(this, undefined, {
      exitToTitle: () => {},
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off("setdata", onRegistryMusicMuted);
      this.registry.events.off("changedata", onRegistryMusicMuted);
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, syncFooterBar);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, syncFooterBar);
      this.input.keyboard?.off("keydown-N", startGame);
      this.input.keyboard?.off("keydown-L", loadGame);
      this.input.keyboard?.off("keydown-R", watchReplay);
      this.input.keyboard?.off("keydown-X", switchGameMode);
      this.input.keyboard?.off("keydown-S", openSettings);
      this.input.keyboard?.off("keydown-G", openGuide);
      this.input.keyboard?.off("keydown-M", toggleMute);
      this.input.keyboard?.off("keydown-Q", quitGame);
      this.input.keyboard?.off("keydown-F", toggleFullscreen);
      this.input.keyboard?.off("keydown-E", easterEgg);
    });
  }
}
