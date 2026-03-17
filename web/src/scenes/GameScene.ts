import Phaser from "phaser";
import { KeyboardAdapter } from "../adapters/input/keyboard";
import { PhaserRenderer } from "../adapters/render/phaserRenderer";
import {
  HUD_MUTED_BORDER_COLOR,
  HUD_TEXT_WHITE_COLOR,
  PLAYER_1_COLOR,
  PLAYER_2_COLOR,
  PLAYER_ACTIVE_STEPS_COLOR,
  PLAYER_BALL_COLOR,
  PLAYER_FLY_COLOR,
  PLAYER_NO_STEPS_COLOR,
} from "../config/colors";
import {
  DEBUG_HUD_TEXT_MARGIN,
  GAME_HEIGHT,
  MAP_OFFSET_X,
  MAP_OFFSET_Y,
  TILE_SIZE,
  TOP_HUD_BAR_CENTER_GAP,
  TOP_HUD_BAR_CORNER_RADIUS,
  TOP_HUD_BAR_DOT_RADIUS,
  TOP_HUD_BAR_HEIGHT,
  TOP_HUD_BAR_WIDTH,
  TOP_HUD_BAR_Y,
  TOP_HUD_STAT_BOX_GAP,
  TOP_HUD_STAT_BOX_HEIGHT,
  TOP_HUD_STAT_BOX_SIDE_PADDING,
  TOP_HUD_STAT_BOX_WIDTH,
  TOP_HUD_STAT_BOX_Y,
} from "../config/display";
import { createInitialState } from "../core/init";
import { GameState } from "../core/types";
import { update } from "../core/update";

const toTextColor = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
const estimateMonospaceTextWidth = (text: string, fontSizePx: number): number => Math.ceil(text.length * fontSizePx * 0.62);

export class GameScene extends Phaser.Scene {
  private static readonly FLY_STEP_MS = 6;
  private static readonly BALL_STEP_MS = 3;
  private static readonly SCORE_TO_WIN = 2;
  private state!: GameState;
  private keyboard!: KeyboardAdapter;
  private tileRenderer!: PhaserRenderer;
  private topHudGraphics!: Phaser.GameObjects.Graphics;
  private topHudDynamicGraphics!: Phaser.GameObjects.Graphics;
  private topHudP1Score!: Phaser.GameObjects.Text;
  private topHudP2Score!: Phaser.GameObjects.Text;
  private topHudP1FlyArmed!: Phaser.GameObjects.Text;
  private topHudP2FlyArmed!: Phaser.GameObjects.Text;
  private topHudP1HasBall!: Phaser.GameObjects.Text;
  private topHudP2HasBall!: Phaser.GameObjects.Text;
  private topHudP1Steps!: Phaser.GameObjects.Text;
  private topHudP2Steps!: Phaser.GameObjects.Text;
  private topHudLeftBarX = 0;
  private topHudRightBarX = 0;
  private topHudBarY = 0;
  private topHudBarWidth = 0;
  private topHudBarHeight = 0;
  private topHudP1FlyArmedBoxX = 0;
  private topHudP1HasBallBoxX = 0;
  private topHudP1StepsBoxX = 0;
  private topHudP2FlyArmedBoxX = 0;
  private topHudP2HasBallBoxX = 0;
  private topHudP2StepsBoxX = 0;
  private topHudStatBoxY = 0;
  private topHudStatBoxHeight = 0;
  private topHudFlyArmedBoxWidth = 0;
  private topHudHasBallBoxWidth = 0;
  private topHudStepsBoxWidth = 0;
  private hudText!: Phaser.GameObjects.Text;
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

    const seed = Date.now() % 2_147_483_647;
    this.state = createInitialState(seed, "ONE_V_ONE");
    this.keyboard = new KeyboardAdapter(this);
    this.tileRenderer = new PhaserRenderer(this, this.state.map.height, MAP_OFFSET_X, MAP_OFFSET_Y);
    this.createTopHud();

    this.hudText = this.add
      .text(DEBUG_HUD_TEXT_MARGIN, GAME_HEIGHT - DEBUG_HUD_TEXT_MARGIN, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: `#${HUD_TEXT_WHITE_COLOR.toString(16).padStart(6, "0")}`,
      })
      .setOrigin(0, 1)
      .setDepth(10)
      .setScrollFactor(0);
    this.hudText.setVisible(this.hudVisible);

    this.registry.events.on("changedata-hudVisible", this.onHudVisibilityChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off("changedata-hudVisible", this.onHudVisibilityChanged, this);
      const gameControlsOnShutdown = document.getElementById("game-controls");
      if (gameControlsOnShutdown !== null) {
        gameControlsOnShutdown.classList.add("hidden");
      }
    });

    this.tileRenderer.draw(this.state);
    this.refreshHud();
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) {
      return;
    }

    let next = this.state;

    this.ballAccumulatorMs += delta;
    while (this.ballAccumulatorMs >= GameScene.BALL_STEP_MS) {
      next = update(next, { type: "ADVANCE_BALL" });
      this.ballAccumulatorMs -= GameScene.BALL_STEP_MS;
    }

    this.flyAccumulatorMs += delta;
    while (this.flyAccumulatorMs >= GameScene.FLY_STEP_MS) {
      next = update(next, null);
      this.flyAccumulatorMs -= GameScene.FLY_STEP_MS;
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
        targetScore: GameScene.SCORE_TO_WIN,
      });
      return;
    }

    if (next !== this.state) {
      this.state = next;
      this.tileRenderer.draw(this.state, _time);
      this.refreshHud();
    } else if (hasArmedFlyPlayer) {
      this.tileRenderer.draw(this.state, _time);
    }
  }

  private refreshHud(): void {
    this.refreshTopHud();
    if (!this.hudVisible) {
      return;
    }
    const p1 = this.state.players[1].position;
    const p2 = this.state.players[2].position;
    const holder = this.state.players[1].hasBall ? "P1" : this.state.players[2].hasBall ? "P2" : "none";
    const p1Steps = this.state.players[1].stepsLeft;
    const p2Steps = this.state.players[2].stepsLeft;
    const p1Fly = this.state.players[1].flyArmed ? "armed" : "off";
    const p2Fly = this.state.players[2].flyArmed ? "armed" : "off";
    const p1Flying = this.state.players[1].isFlying ? " yes" : " no";
    const p2Flying = this.state.players[2].isFlying ? " yes" : " no";
    const ballFlying = this.state.ball.inFlight ? "yes" : "no";
    this.hudText.setText(
      `Seed ${this.state.seed} | Tick ${this.state.tick}\n` +
        `P1 location: (${p1.x}, ${p1.y}) flying: ${p1Flying} | P2 location: (${p2.x}, ${p2.y}) flying:${p2Flying} | Ball: ${holder} flying: ${ballFlying}\n` +
        `P1 WASD move, Q fly, E action | P2 IJKL/Arrows move, U fly, O or . action`
    );
  }

  private createTopHud(): void {
    const statusFontSizePx = 15;
    const statusTextInsetY = 4;
    const statusHorizontalPadding = 4;
    const scoreSideGap = 10;
    const width = this.scale.width;
    const centerX = width / 2;
    const barY = TOP_HUD_BAR_Y;
    const barWidth = TOP_HUD_BAR_WIDTH;
    const barHeight = TOP_HUD_BAR_HEIGHT;
    const scoreRowY = barY + barHeight / 2;
    const leftBarX = centerX - barWidth - TOP_HUD_BAR_CENTER_GAP;
    const rightBarX = centerX + TOP_HUD_BAR_CENTER_GAP;
    const boxY = TOP_HUD_STAT_BOX_Y;
    const flyArmedBoxW = estimateMonospaceTextWidth("Fly Armed", statusFontSizePx) + statusHorizontalPadding * 2;
    const hasBallBoxW = estimateMonospaceTextWidth("Has Ball", statusFontSizePx) + statusHorizontalPadding * 2;
    const stepsBoxW = estimateMonospaceTextWidth("Steps Left: 99", statusFontSizePx) + statusHorizontalPadding * 2;
    const statBoxH = TOP_HUD_STAT_BOX_HEIGHT;
    const statGap = TOP_HUD_STAT_BOX_GAP;
    const p1FlyArmedBoxX = TOP_HUD_STAT_BOX_SIDE_PADDING;
    const p1HasBallBoxX = p1FlyArmedBoxX + flyArmedBoxW + statGap;
    const p1StepsBoxX = p1HasBallBoxX + hasBallBoxW + statGap;
    const p2StepsBoxX = width - TOP_HUD_STAT_BOX_SIDE_PADDING - stepsBoxW;
    const p2HasBallBoxX = p2StepsBoxX - hasBallBoxW - statGap;
    const p2FlyArmedBoxX = p2HasBallBoxX - flyArmedBoxW - statGap;

    this.topHudLeftBarX = leftBarX;
    this.topHudRightBarX = rightBarX;
    this.topHudBarY = barY;
    this.topHudBarWidth = barWidth;
    this.topHudBarHeight = barHeight;
    this.topHudP1FlyArmedBoxX = p1FlyArmedBoxX;
    this.topHudP1HasBallBoxX = p1HasBallBoxX;
    this.topHudP1StepsBoxX = p1StepsBoxX;
    this.topHudP2FlyArmedBoxX = p2FlyArmedBoxX;
    this.topHudP2HasBallBoxX = p2HasBallBoxX;
    this.topHudP2StepsBoxX = p2StepsBoxX;
    this.topHudStatBoxY = boxY;
    this.topHudStatBoxHeight = statBoxH;
    this.topHudFlyArmedBoxWidth = flyArmedBoxW;
    this.topHudHasBallBoxWidth = hasBallBoxW;
    this.topHudStepsBoxWidth = stepsBoxW;

    this.topHudGraphics = this.add.graphics().setDepth(20).setScrollFactor(0);
    this.topHudGraphics.fillStyle(0xe8e8e8, 1);
    this.topHudGraphics.fillRoundedRect(leftBarX, barY, barWidth, barHeight, TOP_HUD_BAR_CORNER_RADIUS);
    this.topHudGraphics.fillRoundedRect(rightBarX, barY, barWidth, barHeight, TOP_HUD_BAR_CORNER_RADIUS);
    this.topHudGraphics.fillStyle(PLAYER_1_COLOR, 1);
    this.topHudGraphics.fillCircle(leftBarX + TOP_HUD_BAR_CORNER_RADIUS, barY + barHeight / 2, TOP_HUD_BAR_DOT_RADIUS);
    this.topHudGraphics.fillStyle(PLAYER_2_COLOR, 1);
    this.topHudGraphics.fillCircle(
      rightBarX + barWidth - TOP_HUD_BAR_CORNER_RADIUS,
      barY + barHeight / 2,
      TOP_HUD_BAR_DOT_RADIUS
    );
    this.topHudGraphics.lineStyle(1, HUD_MUTED_BORDER_COLOR, 1);
    this.topHudGraphics.strokeRect(p1FlyArmedBoxX, boxY, flyArmedBoxW, statBoxH);
    this.topHudGraphics.strokeRect(p1HasBallBoxX, boxY, hasBallBoxW, statBoxH);
    this.topHudGraphics.strokeRect(p1StepsBoxX, boxY, stepsBoxW, statBoxH);
    this.topHudGraphics.strokeRect(p2FlyArmedBoxX, boxY, flyArmedBoxW, statBoxH);
    this.topHudGraphics.strokeRect(p2HasBallBoxX, boxY, hasBallBoxW, statBoxH);
    this.topHudGraphics.strokeRect(p2StepsBoxX, boxY, stepsBoxW, statBoxH);
    this.topHudDynamicGraphics = this.add.graphics().setDepth(20.5).setScrollFactor(0);

    this.add
      .text(200, 16, "Player 1", { fontFamily: "monospace", fontSize: "34px", color: toTextColor(PLAYER_1_COLOR) })
      .setOrigin(0.5, 0);
    this.add
      .text(width - 200, 16, "Player 2", {
        fontFamily: "monospace",
        fontSize: "34px",
        color: toTextColor(PLAYER_2_COLOR),
      })
      .setOrigin(0.5, 0);
    this.add
      .text(centerX, 8, "First to", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: `#${HUD_TEXT_WHITE_COLOR.toString(16).padStart(6, "0")}`,
      })
      .setOrigin(0.5, 0)
      // .setDepth(21)
      // .setScrollFactor(0);
    this.add
      .text(centerX, 24, `${GameScene.SCORE_TO_WIN}!`, {
        fontFamily: "monospace",
        fontSize: "30px",
        color: `#${HUD_TEXT_WHITE_COLOR.toString(16).padStart(6, "0")}`,
      })
      .setPosition(centerX, scoreRowY)
      .setOrigin(0.5, 0.5)
      // .setDepth(21)
      // .setScrollFactor(0);

    this.topHudP1Score = this.add
      .text(leftBarX - scoreSideGap, scoreRowY, "0", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: `#${HUD_TEXT_WHITE_COLOR.toString(16).padStart(6, "0")}`,
      })
      .setOrigin(1, 0.5)
      .setDepth(21)
      .setScrollFactor(0);
    this.topHudP2Score = this.add
      .text(rightBarX + barWidth + scoreSideGap, scoreRowY, "0", {
        fontFamily: "monospace",
        fontSize: "30px",
        color: `#${HUD_TEXT_WHITE_COLOR.toString(16).padStart(6, "0")}`,
      })
      .setOrigin(0, 0.5)
      .setDepth(21)
      .setScrollFactor(0);

    this.topHudP1FlyArmed = this.add
      .text(p1FlyArmedBoxX + flyArmedBoxW / 2, boxY + statusTextInsetY, "Fly Armed", {
        fontFamily: "monospace",
        fontSize: `${statusFontSizePx}px`,
        color: toTextColor(PLAYER_ACTIVE_STEPS_COLOR),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0);
    this.topHudP1HasBall = this.add
      .text(p1HasBallBoxX + hasBallBoxW / 2, boxY + statusTextInsetY, "Has Ball", {
        fontFamily: "monospace",
        fontSize: `${statusFontSizePx}px`,
        color: toTextColor(PLAYER_ACTIVE_STEPS_COLOR),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0);
    this.topHudP1Steps = this.add
      .text(p1StepsBoxX + stepsBoxW / 2, boxY + statusTextInsetY, "Steps Left: 0", {
        fontFamily: "monospace",
        fontSize: `${statusFontSizePx}px`,
        color: toTextColor(PLAYER_ACTIVE_STEPS_COLOR),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0);
    this.topHudP2FlyArmed = this.add
      .text(p2FlyArmedBoxX + flyArmedBoxW / 2, boxY + statusTextInsetY, "Fly Armed", {
        fontFamily: "monospace",
        fontSize: `${statusFontSizePx}px`,
        color: toTextColor(PLAYER_ACTIVE_STEPS_COLOR),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0);
    this.topHudP2HasBall = this.add
      .text(p2HasBallBoxX + hasBallBoxW / 2, boxY + statusTextInsetY, "Has Ball", {
        fontFamily: "monospace",
        fontSize: `${statusFontSizePx}px`,
        color: toTextColor(PLAYER_ACTIVE_STEPS_COLOR),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0);
    this.topHudP2Steps = this.add
      .text(p2StepsBoxX + stepsBoxW / 2, boxY + statusTextInsetY, "Steps Left: 0", {
        fontFamily: "monospace",
        fontSize: `${statusFontSizePx}px`,
        color: toTextColor(PLAYER_ACTIVE_STEPS_COLOR),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0);
  }

  private refreshTopHud(): void {
    const p1ScoreProgress = Math.min(1, this.state.score.p1 / GameScene.SCORE_TO_WIN);
    const p2ScoreProgress = Math.min(1, this.state.score.p2 / GameScene.SCORE_TO_WIN);
    const p1FlyArmed = this.state.players[1].flyArmed;
    const p2FlyArmed = this.state.players[2].flyArmed;
    const p1HasBall = this.state.players[1].hasBall;
    const p2HasBall = this.state.players[2].hasBall;
    const p1NoStepsLeft = this.state.players[1].stepsLeft <= 0;
    const p2NoStepsLeft = this.state.players[2].stepsLeft <= 0;
    const progressInset = TOP_HUD_BAR_CORNER_RADIUS - TOP_HUD_BAR_DOT_RADIUS;
    const progressY = this.topHudBarY + progressInset;
    const progressHeight = this.topHudBarHeight - progressInset * 2;
    const progressMaxWidth = this.topHudBarWidth - progressInset * 2;
    const progressCornerRadius = Math.max(0, TOP_HUD_BAR_CORNER_RADIUS - progressInset);

    this.topHudDynamicGraphics.clear();
    if (p1ScoreProgress > 0) {
      const width = progressMaxWidth * p1ScoreProgress;
      this.topHudDynamicGraphics.fillStyle(PLAYER_1_COLOR, 1);
      this.topHudDynamicGraphics.fillRoundedRect(
        this.topHudLeftBarX + progressInset,
        progressY,
        width,
        progressHeight,
        progressCornerRadius
      );
    }
    if (p2ScoreProgress > 0) {
      const width = progressMaxWidth * p2ScoreProgress;
      this.topHudDynamicGraphics.fillStyle(PLAYER_2_COLOR, 1);
      this.topHudDynamicGraphics.fillRoundedRect(
        this.topHudRightBarX + progressInset + progressMaxWidth - width,
        progressY,
        width,
        progressHeight,
        progressCornerRadius
      );
    }

    this.drawStatusBox(
      this.topHudP1FlyArmedBoxX,
      this.topHudFlyArmedBoxWidth,
      p1FlyArmed ? PLAYER_FLY_COLOR : HUD_MUTED_BORDER_COLOR
    );
    this.drawStatusBox(
      this.topHudP1HasBallBoxX,
      this.topHudHasBallBoxWidth,
      p1HasBall ? PLAYER_BALL_COLOR : HUD_MUTED_BORDER_COLOR
    );
    this.drawStatusBox(
      this.topHudP2HasBallBoxX,
      this.topHudHasBallBoxWidth,
      p2HasBall ? PLAYER_BALL_COLOR : HUD_MUTED_BORDER_COLOR
    );
    this.drawStatusBox(
      this.topHudP2FlyArmedBoxX,
      this.topHudFlyArmedBoxWidth,
      p2FlyArmed ? PLAYER_FLY_COLOR : HUD_MUTED_BORDER_COLOR
    );
    this.drawStatusBox(
      this.topHudP1StepsBoxX,
      this.topHudStepsBoxWidth,
      p1NoStepsLeft ? PLAYER_NO_STEPS_COLOR : HUD_MUTED_BORDER_COLOR
    );
    this.drawStatusBox(
      this.topHudP2StepsBoxX,
      this.topHudStepsBoxWidth,
      p2NoStepsLeft ? PLAYER_NO_STEPS_COLOR : HUD_MUTED_BORDER_COLOR
    );

    this.topHudP1Score.setText(String(this.state.score.p1));
    this.topHudP2Score.setText(String(this.state.score.p2));
    this.topHudP1FlyArmed.setColor(toTextColor(p1FlyArmed ? PLAYER_FLY_COLOR : PLAYER_ACTIVE_STEPS_COLOR));
    this.topHudP2FlyArmed.setColor(toTextColor(p2FlyArmed ? PLAYER_FLY_COLOR : PLAYER_ACTIVE_STEPS_COLOR));
    this.topHudP1HasBall.setColor(toTextColor(p1HasBall ? PLAYER_BALL_COLOR : PLAYER_ACTIVE_STEPS_COLOR));
    this.topHudP2HasBall.setColor(toTextColor(p2HasBall ? PLAYER_BALL_COLOR : PLAYER_ACTIVE_STEPS_COLOR));
    this.topHudP1Steps.setText(`Steps Left: ${this.state.players[1].stepsLeft}`);
    this.topHudP2Steps.setText(`Steps Left: ${this.state.players[2].stepsLeft}`);
    this.topHudP1Steps.setColor(toTextColor(p1NoStepsLeft ? PLAYER_NO_STEPS_COLOR : PLAYER_ACTIVE_STEPS_COLOR));
    this.topHudP2Steps.setColor(toTextColor(p2NoStepsLeft ? PLAYER_NO_STEPS_COLOR : PLAYER_ACTIVE_STEPS_COLOR));
  }

  private drawStatusBox(x: number, width: number, borderColor: number): void {
    this.topHudDynamicGraphics.fillStyle(0x000000, 0.35);
    this.topHudDynamicGraphics.fillRect(x, this.topHudStatBoxY, width, this.topHudStatBoxHeight);
    this.topHudDynamicGraphics.lineStyle(2, borderColor, 1);
    this.topHudDynamicGraphics.strokeRect(x, this.topHudStatBoxY, width, this.topHudStatBoxHeight);
  }

  private onHudVisibilityChanged(_parent: Phaser.Data.DataManager, value: unknown): void {
    if (typeof value !== "boolean") {
      return;
    }
    this.hudVisible = value;
    this.hudText.setVisible(value);
    if (value) {
      this.refreshHud();
    }
  }

  private getWinningPlayer(state: GameState): 1 | 2 | null {
    if (state.score.p1 >= GameScene.SCORE_TO_WIN) {
      return 1;
    }
    if (state.score.p2 >= GameScene.SCORE_TO_WIN) {
      return 2;
    }
    return null;
  }
}
