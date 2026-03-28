import Phaser from "phaser";
import { toTextColor, SCORE_TEXT_COLOR } from "../config/colors";
import { FONT_DISPLAY, TITLE_MENU_SCENE } from "../config/display";
import { bindColonCommands } from "../input/colonCommands";

const LEFT_COLUMN = [
  "Goal: throw the ball in the opposing player's goal",
  "",
  "Rules",
  "  - players only get 5 steps while",
  "    holding the ball before having to",
  "    throw it (and then pick it up again)",
  "  - players can't fly while holding",
  "    the ball",
  "  - players can't score on their own",
  "    goals",
  "  - players can't throw the ball when",
  "    directly adjacent and facing another",
  "    object (even an opposing player's",
  "    goal: no cherrypicking!)",
  "  - players switch sides after a goal",
  "    is scored",
].join("\n");

const RIGHT_COLUMN = [
  "Controls",
  "  Player 1",
  "    MOVE keys (WASD)",
  "    ACTION key (E)",
  "    FLY key (Q)",
  "  Player 2",
  "    MOVE keys (IJKL)",
  "    ACTION key (O)",
  "    FLY key (U)",
  "",
  "Mechanics",
  "  - press ACTION key when adjacent to",
  "    the ball to pick it up",
  "  - press ACTION key with the ball to",
  "    throw it in the direction the player",
  "    is facing",
  "  - press ACTION key when adjacent to a",
  "    player with the ball to either steal",
  "    it or force it to be thrown in a",
  "    random viable direction",
  "  - press FLY key to arm fly ability:",
  "    upon pressing the next movement key",
  "    the player will glide in one direction",
  "    until coming into contact with another",
  "    object",
].join("\n");

export class GuideScene extends Phaser.Scene {
  constructor() {
    super("guide");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(toTextColor(0x000000));

    const menuFontPx = TITLE_MENU_SCENE.menuFontPx;
    const textColor = toTextColor(SCORE_TEXT_COLOR);
    const leftX = width * 0.12;

    this.add
      .text(width / 2, height * 0.06, "Guide", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${menuFontPx}px`,
        color: textColor,
      })
      .setOrigin(0.5);

    const bodyY = height * 0.14;
    const bodyStyle = {
      fontFamily: FONT_DISPLAY,
      fontSize: "14px",
      color: textColor,
      lineSpacing: 4,
    };

    this.add.text(leftX, bodyY, LEFT_COLUMN, bodyStyle);
    this.add.text(width * 0.52, bodyY, RIGHT_COLUMN, bodyStyle);

    this.add.text(width * 0.12, height * 0.92, "Back (B)", {
      fontFamily: FONT_DISPLAY,
      fontSize: `${menuFontPx}px`,
      color: textColor,
    });

    const goBack = (): void => {
      this.scene.start("titleMenu");
    };

    this.input.keyboard?.on("keydown-B", goBack);

    bindColonCommands(this, undefined, {
      exitToTitle: () => {
        this.scene.start("titleMenu");
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-B", goBack);
    });
  }
}
