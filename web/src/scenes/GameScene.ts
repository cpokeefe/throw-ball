import Phaser from "phaser";
import { KeyboardAdapter } from "../adapters/input/keyboard";
import { PhaserRenderer } from "../adapters/render/phaserRenderer";
import * as HudColors from "../config/colors";
import { toTextColor } from "../config/colors";
import {
  BAR_CORNER_RADIUS,
  BAR_DOT_RADIUS,
  BAR_HEIGHT,
  DEBUG_HUD_FONT_SIZE_PX,
  DEBUG_HUD_TEXT_MARGIN,
  FIRST_TO_FONT_PX,
  FONT_DISPLAY,
  GAME_HEIGHT,
  HORIZONTAL_OFFSET,
  TOP_OFFSET,
  MIDDLE_MARGIN,
  PLAYER_LABEL_FONT_PX,
  PLAYER_SCORE_X,
  SCORE_BAR_GAP,
  SCORE_FONT_PX,
  STATUS_BOX_BORDER_WIDTH,
  STATUS_BOX_FONT_PX,
  STATUS_BOX_GAP,
  STATUS_BOX_TEXT_MARGIN,
  TOP_MARGIN,
} from "../config/display";
import { GAME_RULES, SIM_TICK_MS } from "../config/rules";
import { createInitialState } from "../core/init";
import { IS_TEST_MODE } from "../config/env";
import { GameState } from "../core/types";
import { update } from "../core/update";

type StatusHudCell = {
  container: Phaser.GameObjects.Container;
  box: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
};

function createStatusHudCell(
  scene: Phaser.Scene,
  boxY: number,
  initialText: string,
  style: Phaser.Types.GameObjects.Text.TextStyle
): StatusHudCell {
  const container = scene.add.container(0, boxY).setDepth(21).setScrollFactor(0);
  const box = scene.add.graphics();
  const text = scene.add.text(0, 0, initialText, style).setOrigin(0.5, 0);
  container.add([box, text]);
  return { container, box, text };
}

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private keyboard!: KeyboardAdapter;
  private tileRenderer!: PhaserRenderer;
  private hudGraphics!: Phaser.GameObjects.Graphics;
  private hudDynamicGraphics!: Phaser.GameObjects.Graphics;
  private hudP1Score!: Phaser.GameObjects.Text;
  private hudP2Score!: Phaser.GameObjects.Text;
  private hudP1PlayerTitle!: Phaser.GameObjects.Text;
  private hudP2PlayerTitle!: Phaser.GameObjects.Text;
  private hudP1FlyArmed!: StatusHudCell;
  private hudP2FlyArmed!: StatusHudCell;
  private hudP1HasBall!: StatusHudCell;
  private hudP2HasBall!: StatusHudCell;
  private hudP1Steps!: StatusHudCell;
  private hudP2Steps!: StatusHudCell;
  private hudLeftBarX = 0;
  private hudRightBarX = 0;
  private hudBarY = 0;
  private hudP1BarWidth = 0;
  private hudP2BarWidth = 0;
  private hudBarHeight = 0;
  private hudStatBoxY = 0;
  private debugHudText!: Phaser.GameObjects.Text;
  private hudVisible = true;
  private flyAccumulatorMs = 0;
  private ballAccumulatorMs = 0;
  private isGameOver = false;

  constructor() {
    super("game");
  }

  create(): void {
    this.isGameOver = false;
    const gameControls = document.getElementById("game-controls");
    if (gameControls !== null) {
      gameControls.classList.remove("hidden");
    }
    const storedHudVisible = this.registry.get("hudVisible");
    if (typeof storedHudVisible === "boolean") {
      this.hudVisible = storedHudVisible;
    }

    // const seed = IS_TEST_MODE ? 42 : Math.floor(Math.random() * 2_147_483_647);
    const seed = Math.floor(Math.random() * 2_147_483_647);
    this.state = createInitialState(seed, "ONE_V_ONE");
    this.keyboard = new KeyboardAdapter(this);
    this.tileRenderer = new PhaserRenderer(this, this.state.map.height, HORIZONTAL_OFFSET, TOP_OFFSET);
    this.createHud();

    this.debugHudText = this.add
      .text(
        DEBUG_HUD_TEXT_MARGIN,
        GAME_HEIGHT - DEBUG_HUD_TEXT_MARGIN,
        "",
        {
          fontFamily: FONT_DISPLAY,
          fontSize: `${DEBUG_HUD_FONT_SIZE_PX}px`,
          color: toTextColor(HudColors.SCORE_TEXT_COLOR),
        }
      )
      .setOrigin(0, 1)
      .setDepth(10)
      .setScrollFactor(0);
    this.debugHudText.setVisible(this.hudVisible);

    this.registry.events.on("changedata-hudVisible", this.onHudVisibilityChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off("changedata-hudVisible", this.onHudVisibilityChanged, this);
      const gameControlsOnShutdown = document.getElementById("game-controls");
      if (gameControlsOnShutdown !== null) {
        gameControlsOnShutdown.classList.add("hidden");
      }
    });

    this.tileRenderer.draw(this.state);
    this.refreshAllHud();
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) {
      return;
    }

    let next = this.state;

    this.ballAccumulatorMs += delta;
    while (this.ballAccumulatorMs >= SIM_TICK_MS.ball) {
      next = update(next, { type: "ADVANCE_BALL" });
      this.ballAccumulatorMs -= SIM_TICK_MS.ball;
    }

    this.flyAccumulatorMs += delta;
    while (this.flyAccumulatorMs >= SIM_TICK_MS.fly) {
      next = update(next, null);
      this.flyAccumulatorMs -= SIM_TICK_MS.fly;
    }

    const commands = this.keyboard.pollCommands(delta);
    for (const command of commands) {
      next = update(next, command);
    }

    const hasArmedFlyPlayer = next.players[1].flyArmed || next.players[2].flyArmed;

    const winningPlayer = this.getWinningPlayer(next);
    if (winningPlayer !== null) {
      this.isGameOver = true;
      this.scene.start("win", {
        winner: winningPlayer,
        targetScore: GAME_RULES.scoreToWin,
      });
      return;
    }

    if (next !== this.state) {
      this.state = next;
      this.tileRenderer.draw(this.state, _time);
      this.refreshAllHud();
    } else if (hasArmedFlyPlayer) {
      this.tileRenderer.draw(this.state, _time);
    }
  }

  private refreshAllHud(): void {
    this.refreshHud();
    this.refreshDebugHud();
  }

  private createHud(): void {
    const width = this.scale.width;
    const centerX = width / 2;
    const barY = TOP_MARGIN + PLAYER_LABEL_FONT_PX + MIDDLE_MARGIN / 2 - BAR_HEIGHT / 2;
    const firstToY = barY / 2;
    const scoreRowY = barY + BAR_HEIGHT / 2;
    const targetScoreLabel = `${GAME_RULES.scoreToWin}!`;
    const targetScoreText = this.add
      .text(centerX, scoreRowY, targetScoreLabel, {
        fontFamily: FONT_DISPLAY,
        fontSize: `${SCORE_FONT_PX}px`,
        color: toTextColor(HudColors.SCORE_TEXT_COLOR),
      })
      .setOrigin(0.5, 0.5)
      .setDepth(21)
      .setScrollFactor(0);
    const targetHalfW = targetScoreText.width / 2;
    const targetLeftX = centerX - targetHalfW;
    const targetRightX = centerX + targetHalfW;
    const p1ScoreRightX = PLAYER_SCORE_X;
    const p2ScoreLeftX = width - PLAYER_SCORE_X;
    const leftBarX = p1ScoreRightX + SCORE_BAR_GAP;
    const leftBarWidth = Math.max(0, targetLeftX - SCORE_BAR_GAP - leftBarX);
    const rightBarX = targetRightX + SCORE_BAR_GAP;
    const rightBarWidth = Math.max(0, p2ScoreLeftX - SCORE_BAR_GAP - rightBarX);
    const boxY = TOP_MARGIN + PLAYER_LABEL_FONT_PX + MIDDLE_MARGIN;

    this.hudLeftBarX = leftBarX;
    this.hudRightBarX = rightBarX;
    this.hudBarY = barY;
    this.hudP1BarWidth = leftBarWidth;
    this.hudP2BarWidth = rightBarWidth;
    this.hudBarHeight = BAR_HEIGHT;
    this.hudStatBoxY = boxY;

    this.hudGraphics = this.add.graphics().setDepth(20).setScrollFactor(0);
    this.hudGraphics.fillStyle(HudColors.BAR_BACKGROUND_COLOR, 1);
    this.hudGraphics.fillRoundedRect(leftBarX, barY, leftBarWidth, BAR_HEIGHT, BAR_CORNER_RADIUS);
    this.hudGraphics.fillRoundedRect(rightBarX, barY, rightBarWidth, BAR_HEIGHT, BAR_CORNER_RADIUS);
    this.hudGraphics.fillStyle(HudColors.PLAYER_1_COLOR, 1);
    this.hudGraphics.fillCircle(
      leftBarX + BAR_CORNER_RADIUS,
      barY + BAR_HEIGHT / 2,
      BAR_DOT_RADIUS
    );
    this.hudGraphics.fillStyle(HudColors.PLAYER_2_COLOR, 1);
    this.hudGraphics.fillCircle(
      rightBarX + rightBarWidth - BAR_CORNER_RADIUS,
      barY + BAR_HEIGHT / 2,
      BAR_DOT_RADIUS
    );
    this.hudDynamicGraphics = this.add.graphics().setDepth(20.5).setScrollFactor(0);

    this.hudP1PlayerTitle = this.add
      .text(0, TOP_MARGIN, "Player 1", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${PLAYER_LABEL_FONT_PX}px`,
        color: toTextColor(HudColors.PLAYER_1_COLOR),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0);
    this.hudP2PlayerTitle = this.add
      .text(0, TOP_MARGIN, "Player 2", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${PLAYER_LABEL_FONT_PX}px`,
        color: toTextColor(HudColors.PLAYER_2_COLOR),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0);
    this.add
      .text(centerX, firstToY, "First to", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${FIRST_TO_FONT_PX}px`,
        color: toTextColor(HudColors.SCORE_TEXT_COLOR),
      })
      .setOrigin(0.5, 0.42);

    this.hudP1Score = this.add
      .text(p1ScoreRightX, scoreRowY, "0", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${SCORE_FONT_PX}px`,
        color: toTextColor(HudColors.SCORE_TEXT_COLOR),
      })
      .setOrigin(1, 0.5);
    this.hudP2Score = this.add
      .text(p2ScoreLeftX, scoreRowY, "0", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${SCORE_FONT_PX}px`,
        color: toTextColor(HudColors.SCORE_TEXT_COLOR),
      })
      .setOrigin(0, 0.5);

    const statusStyle = {
      fontFamily: FONT_DISPLAY,
      fontSize: `${STATUS_BOX_FONT_PX}px`,
      color: toTextColor(HudColors.PLAYER_BASE_TEXT_COLOR),
    };

    const p1StepsLabel = `Steps Left: ${this.state.players[1].stepsLeft}`;
    const p2StepsLabel = `Steps Left: ${this.state.players[2].stepsLeft}`;

    this.hudP1FlyArmed = createStatusHudCell(this, boxY, "Fly Armed", statusStyle);
    this.hudP1HasBall = createStatusHudCell(this, boxY, "Has Ball", statusStyle);
    this.hudP1Steps = createStatusHudCell(this, boxY, p1StepsLabel, statusStyle);
    this.hudP2FlyArmed = createStatusHudCell(this, boxY, "Fly Armed", statusStyle);
    this.hudP2HasBall = createStatusHudCell(this, boxY, "Has Ball", statusStyle);
    this.hudP2Steps = createStatusHudCell(this, boxY, p2StepsLabel, statusStyle);
  }

  private refreshHud(): void {
    const p1ScoreProgress = Math.min(1, this.state.score.p1 / GAME_RULES.scoreToWin);
    const p2ScoreProgress = Math.min(1, this.state.score.p2 / GAME_RULES.scoreToWin);
    const p1FlyArmed = this.state.players[1].flyArmed;
    const p2FlyArmed = this.state.players[2].flyArmed;
    const p1HasBall = this.state.players[1].hasBall;
    const p2HasBall = this.state.players[2].hasBall;
    const p1NoStepsLeft = this.state.players[1].stepsLeft <= 0;
    const p2NoStepsLeft = this.state.players[2].stepsLeft <= 0;
    const progressInset = BAR_CORNER_RADIUS - BAR_DOT_RADIUS;
    const progressY = this.hudBarY + progressInset;
    const progressHeight = this.hudBarHeight - progressInset * 2;
    const p1ProgressMaxWidth = this.hudP1BarWidth - progressInset * 2;
    const p2ProgressMaxWidth = this.hudP2BarWidth - progressInset * 2;
    const progressCornerRadius = Math.max(0, BAR_CORNER_RADIUS - progressInset);

    this.hudDynamicGraphics.clear();
    if (p1ScoreProgress > 0) {
      const w = p1ProgressMaxWidth * p1ScoreProgress;
      this.hudDynamicGraphics.fillStyle(HudColors.PLAYER_1_COLOR, 1);
      this.hudDynamicGraphics.fillRoundedRect(
        this.hudLeftBarX + progressInset,
        progressY,
        w,
        progressHeight,
        progressCornerRadius
      );
    }
    if (p2ScoreProgress > 0) {
      const w = p2ProgressMaxWidth * p2ScoreProgress;
      this.hudDynamicGraphics.fillStyle(HudColors.PLAYER_2_COLOR, 1);
      this.hudDynamicGraphics.fillRoundedRect(
        this.hudRightBarX + progressInset + p2ProgressMaxWidth - w,
        progressY,
        w,
        progressHeight,
        progressCornerRadius
      );
    }

    this.hudP1Score.setText(String(this.state.score.p1));
    this.hudP2Score.setText(String(this.state.score.p2));

    const p1ScoreLeftX = PLAYER_SCORE_X - this.hudP1Score.width;
    const hudWidth = this.scale.width;
    const p2ScoreRightX = hudWidth - PLAYER_SCORE_X + this.hudP2Score.width;
    this.hudP1PlayerTitle.setX(p1ScoreLeftX / 2);
    this.hudP2PlayerTitle.setX((p2ScoreRightX + hudWidth) / 2);

    this.hudP1FlyArmed.text.setColor(
      toTextColor(p1FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP2FlyArmed.text.setColor(
      toTextColor(p2FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP1HasBall.text.setColor(
      toTextColor(p1HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP2HasBall.text.setColor(
      toTextColor(p2HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP1Steps.text.setText(`Steps Left: ${this.state.players[1].stepsLeft}`);
    this.hudP2Steps.text.setText(`Steps Left: ${this.state.players[2].stepsLeft}`);
    this.hudP1Steps.text.setColor(
      toTextColor(p1NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP2Steps.text.setColor(
      toTextColor(p2NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );

    const pad = STATUS_BOX_TEXT_MARGIN;
    const gap = STATUS_BOX_GAP;

    const p1W =
      this.hudP1FlyArmed.text.width +
      2 * pad +
      gap +
      this.hudP1HasBall.text.width +
      2 * pad +
      gap +
      this.hudP1Steps.text.width +
      2 * pad;
    let p1x = (p1ScoreLeftX - p1W) / 2;
    this.drawStatusCell(
      this.hudP1FlyArmed,
      p1x,
      p1FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );
    p1x += this.hudP1FlyArmed.text.width + 2 * pad + gap;
    this.drawStatusCell(
      this.hudP1HasBall,
      p1x,
      p1HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );
    p1x += this.hudP1HasBall.text.width + 2 * pad + gap;
    this.drawStatusCell(
      this.hudP1Steps,
      p1x,
      p1NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );

    const p2W =
      this.hudP2FlyArmed.text.width +
      2 * pad +
      gap +
      this.hudP2HasBall.text.width +
      2 * pad +
      gap +
      this.hudP2Steps.text.width +
      2 * pad;
    let p2x = (p2ScoreRightX + hudWidth - p2W) / 2;
    this.drawStatusCell(
      this.hudP2FlyArmed,
      p2x,
      p2FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );
    p2x += this.hudP2FlyArmed.text.width + 2 * pad + gap;
    this.drawStatusCell(
      this.hudP2HasBall,
      p2x,
      p2HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );
    p2x += this.hudP2HasBall.text.width + 2 * pad + gap;
    this.drawStatusCell(
      this.hudP2Steps,
      p2x,
      p2NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );
  }

  private drawStatusCell(cell: StatusHudCell, x: number, borderColor: number): void {
    const pad = STATUS_BOX_TEXT_MARGIN;
    const w = cell.text.width + 2 * pad;
    const h = cell.text.height + 2 * pad;
    cell.container.setPosition(x, this.hudStatBoxY);
    cell.text.setPosition(w / 2, pad);
    cell.box.lineStyle(STATUS_BOX_BORDER_WIDTH, borderColor);
    cell.box.strokeRect(0, 0, w, h);
  }

  private onHudVisibilityChanged(_parent: Phaser.Data.DataManager, value: unknown): void {
    if (typeof value !== "boolean") {
      return;
    }
    this.hudVisible = value;
    this.debugHudText.setVisible(value);
    if (value) {
      this.refreshAllHud();
    }
  }

  private getWinningPlayer(state: GameState): 1 | 2 | null {
    if (state.score.p1 >= GAME_RULES.scoreToWin) {
      return 1;
    }
    if (state.score.p2 >= GAME_RULES.scoreToWin) {
      return 2;
    }
    return null;
  }

  private refreshDebugHud(): void {
    if (!this.hudVisible) {
      return;
    }
    const p1 = this.state.players[1].position;
    const p2 = this.state.players[2].position;
    const holder = this.state.players[1].hasBall ? "P1" : this.state.players[2].hasBall ? "P2" : "none";
    const p1Flying = this.state.players[1].isFlying ? " yes" : " no";
    const p2Flying = this.state.players[2].isFlying ? " yes" : " no";
    const ballFlying = this.state.ball.inFlight ? "yes" : "no";
    this.debugHudText.setText(
      `Seed ${this.state.seed} | Tick ${this.state.tick}\n` +
        `P1 location: (${p1.x}, ${p1.y}) flying: ${p1Flying} | P2 location: (${p2.x}, ${p2.y}) flying:${p2Flying} | Ball: ${holder} flying: ${ballFlying}\n` +
        `P1 WASD move, Q fly, E action | P2 IJKL/Arrows move, U fly, O or . action`
    );
  }
}
