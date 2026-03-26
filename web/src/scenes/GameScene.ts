import Phaser from "phaser";
import { KeyboardAdapter } from "../adapters/input/keyboard";
import { PhaserRenderer } from "../adapters/render/phaserRenderer";
import * as HudColors from "../config/colors";
import { toTextColor, player2Color } from "../config/colors";
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
  STATUS_BOX_FONT_PX,
  STATUS_BOX_GAP,
  STATUS_BOX_TEXT_MARGIN,
  TOP_MARGIN,
} from "../config/display";
import { DEFAULT_GAME_MODE, isPlayer2Active } from "../config/gameModes";
import { cpuTickForLevel, GAME_RULES, SIM_TICK_MS } from "../config/rules";
import { createInitialState } from "../core/init";
import { IS_TEST_MODE } from "../config/env";
import { ReplayLog, createReplayLog, pushState } from "../core/replayLog";
import { GameMode, GameState } from "../core/types";
import { update } from "../core/update";
import { applyCpuDecision } from "../core/cpu";
import { bindColonCommands } from "../input/colonCommands";
import { StatusHudCell, createStatusHudCell, drawStatusCell } from "./hud";

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
  private p2Active = true;
  private isPractice = false;
  private isCpu = false;
  private flyAccumulatorMs = 0;
  private ballAccumulatorMs = 0;
  private cpuAccumulatorMs = 0;
  private cpuTickMs = 250;
  private targetScore: number = GAME_RULES.scoreToWin;
  private replayLog!: ReplayLog;
  private isGameOver = false;
  private gamePhase: "countdown" | "playing" | "paused" = "playing";
  private overlayGraphics!: Phaser.GameObjects.Graphics;
  private countdownText!: Phaser.GameObjects.Text;
  private pauseContainer!: Phaser.GameObjects.Container;
  private bottomControlsText!: Phaser.GameObjects.Text;
  private goalScoredSound: HTMLAudioElement | null = null;
  private countdownTickSound: HTMLAudioElement | null = null;
  private countdownGoSound: HTMLAudioElement | null = null;

  constructor() {
    super("game");
  }

  create(data?: { loadState?: boolean }): void {
    this.isGameOver = false;
    const gameControls = document.getElementById("game-controls");
    if (IS_TEST_MODE && gameControls !== null) {
      gameControls.classList.remove("hidden");
    }
    const storedHudVisible = this.registry.get("hudVisible");
    if (typeof storedHudVisible === "boolean") {
      this.hudVisible = storedHudVisible;
    }

    const saved = data?.loadState
      ? (this.registry.get("savedGameState") as GameState | undefined)
      : undefined;
    this.targetScore =
      (this.registry.get("targetScore") as number | undefined) ?? GAME_RULES.scoreToWin;
    this.cpuTickMs = cpuTickForLevel(
      this.registry.get("cpuLevel") as string | undefined
    );

    if (saved) {
      this.state = saved;
      const existingLog = this.registry.get("replayLog") as ReplayLog | undefined;
      this.replayLog = existingLog && existingLog.states.length > 0
        ? existingLog
        : createReplayLog(this.state, this.targetScore);
    } else {
      const useRandomSeed =
        (this.registry.get("useRandomSeed") as boolean | undefined) ?? false;
      const customSeed =
        this.registry.get("customSeed") as number | undefined;
      const seed = useRandomSeed
        ? Math.floor(Math.random() * 2_147_483_647)
        : (customSeed ?? 42);
      const mode = (this.registry.get("gameMode") as GameMode | undefined) ?? DEFAULT_GAME_MODE;
      this.state = createInitialState(seed, mode);
      this.replayLog = createReplayLog(this.state, this.targetScore);
    }
    this.p2Active = isPlayer2Active(this.state.mode);
    this.isPractice = this.state.mode === "PRACTICE";
    this.isCpu = this.state.mode === "ONE_V_CPU";
    this.cpuAccumulatorMs = 0;
    this.keyboard = new KeyboardAdapter(this);
    bindColonCommands(
      this,
      this.keyboard,
      {
        exitToTitle: () => {
          this.scene.start("titleMenu");
        },
        togglePause: () => {
          this.togglePause();
        },
      },
      () => this.gamePhase === "paused"
    );
    this.tileRenderer = new PhaserRenderer(this, this.state.map.height, HORIZONTAL_OFFSET, TOP_OFFSET, this.isCpu);
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
      if (!this.isGameOver) {
        this.registry.set("savedGameState", this.state);
      }
      this.registry.set("replayLog", this.replayLog);
      const gameControlsOnShutdown = document.getElementById("game-controls");
      if (gameControlsOnShutdown !== null) {
        gameControlsOnShutdown.classList.add("hidden");
      }
    });

    this.overlayGraphics = this.add
      .graphics()
      .setDepth(100)
      .setScrollFactor(0)
      .setVisible(false);
    this.overlayGraphics.fillStyle(0x000000, 0.65);
    this.overlayGraphics.fillRect(0, 0, this.scale.width, this.scale.height);

    this.countdownText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, "", {
        fontFamily: FONT_DISPLAY,
        fontSize: "120px",
        color: "#ffffff",
      })
      .setOrigin(0.5)
      .setDepth(101)
      .setScrollFactor(0)
      .setVisible(false);

    this.pauseContainer = this.add
      .container(0, 0)
      .setDepth(101)
      .setScrollFactor(0)
      .setVisible(false);
    const pauseOptionsText = this.add
      .text(
        this.scale.width / 2,
        this.scale.height / 2 - 30,
        "resume (SPACE)   mute (M)   fullscreen (F)   exit (E)   quit (Q)",
        { fontFamily: FONT_DISPLAY, fontSize: "16px", color: "#ffffff" }
      )
      .setOrigin(0.5);
    let controlsLabel: string;
    if (this.isCpu) {
      controlsLabel = "P1: WASD move, Q fly, E action";
    } else if (this.p2Active) {
      controlsLabel =
        "P1: WASD move, Q fly, E action\nP2: IJKL/Arrows move, U fly, O/. action";
    } else {
      controlsLabel = "P1: WASD move, Q fly, E action";
    }
    const pauseControlsText = this.add
      .text(this.scale.width / 2, this.scale.height / 2 + 20, controlsLabel, {
        fontFamily: FONT_DISPLAY,
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5, 0);
    this.pauseContainer.add([pauseOptionsText, pauseControlsText]);

    this.bottomControlsText = this.add
      .text(
        this.scale.width / 2,
        GAME_HEIGHT - 6,
        "pause (:SPACE)   mute (:M)   fullscreen (:F)   exit (:E)   quit (:Q)",
        {
          fontFamily: FONT_DISPLAY,
          fontSize: "10px",
          color: toTextColor(HudColors.PLAYER_BASE_TEXT_COLOR),
        }
      )
      .setOrigin(0.5, 1)
      .setDepth(21)
      .setScrollFactor(0);

    if (!IS_TEST_MODE) {
      const base = import.meta.env.BASE_URL;
      this.goalScoredSound = new Audio(`${base}goal_scored.wav`);
      this.countdownTickSound = new Audio(`${base}countdown_tick.wav`);
      this.countdownGoSound = new Audio(`${base}countdown_go.wav`);
    }

    this.tileRenderer.draw(this.state);
    this.refreshAllHud();

    if (!this.isPractice && !IS_TEST_MODE && !saved) {
      this.startCountdown();
    } else {
      this.gamePhase = "playing";
    }
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver || this.gamePhase !== "playing") {
      return;
    }

    const prevGoalTick = this.state.lastGoalTick;

    let next = this.state;

    this.ballAccumulatorMs += delta;
    while (this.ballAccumulatorMs >= SIM_TICK_MS.ball) {
      next = update(next, { type: "ADVANCE_BALL" });
      pushState(this.replayLog, next, true);
      this.ballAccumulatorMs -= SIM_TICK_MS.ball;
    }

    this.flyAccumulatorMs += delta;
    while (this.flyAccumulatorMs >= SIM_TICK_MS.fly) {
      next = update(next, null);
      pushState(this.replayLog, next, true);
      this.flyAccumulatorMs -= SIM_TICK_MS.fly;
    }

    if (this.isCpu) {
      this.cpuAccumulatorMs += delta;
      while (this.cpuAccumulatorMs >= this.cpuTickMs) {
        next = applyCpuDecision(next);
        pushState(this.replayLog, next, false);
        this.cpuAccumulatorMs -= this.cpuTickMs;
      }
    }

    const commands = this.keyboard.pollCommands(delta);
    for (const command of commands) {
      if (command.type !== "ADVANCE_BALL" && command.playerId === 2 && (!this.p2Active || this.isCpu)) {
        continue;
      }
      next = update(next, command);
      pushState(this.replayLog, next, false);
    }

    const hasArmedFlyPlayer = next.players[1].flyArmed || next.players[2].flyArmed;
    const goalScored = next.lastGoalTick > prevGoalTick;

    if (goalScored) {
      this.playSound(this.goalScoredSound);
    }

    const winningPlayer = this.getWinningPlayer(next);
    if (winningPlayer !== null) {
      this.isGameOver = true;
      this.registry.set("savedGameState", null);
      this.registry.set("replayLog", this.replayLog);
      this.scene.start("win", {
        winner: winningPlayer,
        targetScore: this.targetScore,
        mode: this.state.mode,
      });
      return;
    }

    if (goalScored && !this.isPractice) {
      const scorer: 1 | 2 = next.score.p1 > this.state.score.p1 ? 1 : 2;
      this.state = next;
      this.tileRenderer.draw(this.state);
      this.refreshAllHud();
      this.startCountdown(scorer);
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
    const boxY = TOP_MARGIN + PLAYER_LABEL_FONT_PX + MIDDLE_MARGIN;
    this.hudStatBoxY = boxY;
    this.hudGraphics = this.add.graphics().setDepth(20).setScrollFactor(0);
    this.hudDynamicGraphics = this.add.graphics().setDepth(20.5).setScrollFactor(0);

    const p2HudColor = player2Color(this.isCpu);

    if (!this.isPractice) {
      const targetScoreLabel = `${this.targetScore}!`;
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

      this.hudLeftBarX = leftBarX;
      this.hudRightBarX = rightBarX;
      this.hudBarY = barY;
      this.hudP1BarWidth = leftBarWidth;
      this.hudP2BarWidth = rightBarWidth;
      this.hudBarHeight = BAR_HEIGHT;

      this.hudGraphics.fillStyle(HudColors.BAR_BACKGROUND_COLOR, 1);
      this.hudGraphics.fillRoundedRect(leftBarX, barY, leftBarWidth, BAR_HEIGHT, BAR_CORNER_RADIUS);
      this.hudGraphics.fillStyle(HudColors.PLAYER_1_COLOR, 1);
      this.hudGraphics.fillCircle(
        leftBarX + BAR_CORNER_RADIUS,
        barY + BAR_HEIGHT / 2,
        BAR_DOT_RADIUS
      );
      if (this.p2Active) {
        this.hudGraphics.fillStyle(HudColors.BAR_BACKGROUND_COLOR, 1);
        this.hudGraphics.fillRoundedRect(rightBarX, barY, rightBarWidth, BAR_HEIGHT, BAR_CORNER_RADIUS);
        this.hudGraphics.fillStyle(p2HudColor, 1);
        this.hudGraphics.fillCircle(
          rightBarX + rightBarWidth - BAR_CORNER_RADIUS,
          barY + BAR_HEIGHT / 2,
          BAR_DOT_RADIUS
        );
      }

      this.add
        .text(centerX, firstToY, "First to", {
          fontFamily: FONT_DISPLAY,
          fontSize: `${FIRST_TO_FONT_PX}px`,
          color: toTextColor(HudColors.SCORE_TEXT_COLOR),
        })
        .setOrigin(0.5, 0.42);
    }

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
      .text(0, TOP_MARGIN, this.isCpu ? "CPU" : "Player 2", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${PLAYER_LABEL_FONT_PX}px`,
        color: toTextColor(p2HudColor),
      })
      .setOrigin(0.5, 0)
      .setDepth(21)
      .setScrollFactor(0)
      .setVisible(this.p2Active);

    const p1ScoreRightX = PLAYER_SCORE_X;
    const p2ScoreLeftX = width - PLAYER_SCORE_X;
    this.hudP1Score = this.add
      .text(p1ScoreRightX, scoreRowY, "0", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${SCORE_FONT_PX}px`,
        color: toTextColor(HudColors.SCORE_TEXT_COLOR),
      })
      .setOrigin(1, 0.5)
      .setVisible(!this.isPractice);
    this.hudP2Score = this.add
      .text(p2ScoreLeftX, scoreRowY, "0", {
        fontFamily: FONT_DISPLAY,
        fontSize: `${SCORE_FONT_PX}px`,
        color: toTextColor(HudColors.SCORE_TEXT_COLOR),
      })
      .setOrigin(0, 0.5)
      .setVisible(this.p2Active && !this.isPractice);

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
    if (!this.p2Active) {
      this.hudP2FlyArmed.container.setVisible(false);
      this.hudP2HasBall.container.setVisible(false);
      this.hudP2Steps.container.setVisible(false);
    }
  }

  private refreshHud(): void {
    const p1FlyArmed = this.state.players[1].flyArmed;
    const p1HasBall = this.state.players[1].hasBall;
    const p1NoStepsLeft = this.state.players[1].stepsLeft <= 0;
    const hudWidth = this.scale.width;

    this.hudDynamicGraphics.clear();

    if (!this.isPractice) {
      const p1ScoreProgress = Math.min(1, this.state.score.p1 / this.targetScore);
      const progressInset = BAR_CORNER_RADIUS - BAR_DOT_RADIUS;
      const progressY = this.hudBarY + progressInset;
      const progressHeight = this.hudBarHeight - progressInset * 2;
      const p1ProgressMaxWidth = this.hudP1BarWidth - progressInset * 2;
      const progressCornerRadius = Math.max(0, BAR_CORNER_RADIUS - progressInset);

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
      if (this.p2Active) {
        const p2ScoreProgress = Math.min(1, this.state.score.p2 / this.targetScore);
        const p2ProgressMaxWidth = this.hudP2BarWidth - progressInset * 2;
        if (p2ScoreProgress > 0) {
          const w = p2ProgressMaxWidth * p2ScoreProgress;
          this.hudDynamicGraphics.fillStyle(player2Color(this.isCpu), 1);
          this.hudDynamicGraphics.fillRoundedRect(
            this.hudRightBarX + progressInset + p2ProgressMaxWidth - w,
            progressY,
            w,
            progressHeight,
            progressCornerRadius
          );
        }
      }

      this.hudP1Score.setText(String(this.state.score.p1));
    }

    let p1ScoreLeftX: number;
    if (this.isPractice) {
      p1ScoreLeftX = hudWidth;
      this.hudP1PlayerTitle.setX(hudWidth / 2);
    } else {
      p1ScoreLeftX = PLAYER_SCORE_X - this.hudP1Score.width;
      this.hudP1PlayerTitle.setX(p1ScoreLeftX / 2);
    }

    if (this.p2Active) {
      this.hudP2Score.setText(String(this.state.score.p2));
      const p2ScoreRightX = hudWidth - PLAYER_SCORE_X + this.hudP2Score.width;
      this.hudP2PlayerTitle.setX((p2ScoreRightX + hudWidth) / 2);

      const p2FlyArmed = this.state.players[2].flyArmed;
      const p2HasBall = this.state.players[2].hasBall;
      const p2NoStepsLeft = this.state.players[2].stepsLeft <= 0;
      this.hudP2FlyArmed.text.setColor(
        toTextColor(p2FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
      );
      this.hudP2HasBall.text.setColor(
        toTextColor(p2HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
      );
      this.hudP2Steps.text.setText(`Steps Left: ${this.state.players[2].stepsLeft}`);
      this.hudP2Steps.text.setColor(
        toTextColor(p2NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
      );

      const pad = STATUS_BOX_TEXT_MARGIN;
      const gap = STATUS_BOX_GAP;
      const p2W =
        this.hudP2FlyArmed.text.width +
        2 * pad +
        gap +
        this.hudP2HasBall.text.width +
        2 * pad +
        gap +
        this.hudP2Steps.text.width +
        2 * pad;
      const p2ScoreRightX2 = hudWidth - PLAYER_SCORE_X + this.hudP2Score.width;
      let p2x = (p2ScoreRightX2 + hudWidth - p2W) / 2;
      drawStatusCell(
        this.hudP2FlyArmed, p2x, this.hudStatBoxY,
        p2FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
      );
      p2x += this.hudP2FlyArmed.text.width + 2 * pad + gap;
      drawStatusCell(
        this.hudP2HasBall, p2x, this.hudStatBoxY,
        p2HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
      );
      p2x += this.hudP2HasBall.text.width + 2 * pad + gap;
      drawStatusCell(
        this.hudP2Steps, p2x, this.hudStatBoxY,
        p2NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
      );
    }

    this.hudP1FlyArmed.text.setColor(
      toTextColor(p1FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP1HasBall.text.setColor(
      toTextColor(p1HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP1Steps.text.setText(`Steps Left: ${this.state.players[1].stepsLeft}`);
    this.hudP1Steps.text.setColor(
      toTextColor(p1NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
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
    drawStatusCell(
      this.hudP1FlyArmed, p1x, this.hudStatBoxY,
      p1FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );
    p1x += this.hudP1FlyArmed.text.width + 2 * pad + gap;
    drawStatusCell(
      this.hudP1HasBall, p1x, this.hudStatBoxY,
      p1HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );
    p1x += this.hudP1HasBall.text.width + 2 * pad + gap;
    drawStatusCell(
      this.hudP1Steps, p1x, this.hudStatBoxY,
      p1NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR
    );
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
    if (this.isPractice) {
      return null;
    }
    if (state.score.p1 >= this.targetScore) {
      return 1;
    }
    if (state.score.p2 >= this.targetScore) {
      return 2;
    }
    return null;
  }

  private startCountdown(scorer?: 1 | 2): void {
    this.gamePhase = "countdown";
    this.overlayGraphics.setVisible(true);

    const steps: Array<{ text: string; sound: HTMLAudioElement | null }> = [
      { text: "3", sound: this.countdownTickSound },
      { text: "2", sound: this.countdownTickSound },
      { text: "1", sound: this.countdownTickSound },
      { text: "GO!", sound: this.countdownGoSound },
    ];

    let stepIndex = 0;
    const showStep = (): void => {
      if (stepIndex < steps.length) {
        this.countdownText.setText(steps[stepIndex].text).setVisible(true);
        this.playSound(steps[stepIndex].sound);
        stepIndex++;
      } else {
        this.countdownText.setVisible(false);
        this.overlayGraphics.setVisible(false);
        this.gamePhase = "playing";
        this.flyAccumulatorMs = 0;
        this.ballAccumulatorMs = 0;
        this.cpuAccumulatorMs = 0;
      }
    };

    if (scorer !== undefined) {
      const label = scorer === 2 && this.isCpu ? "CPU" : `Player ${scorer}`;
      this.countdownText.setText(`${label} Goal!`).setVisible(true);
      this.time.delayedCall(2000, () => {
        showStep();
        this.time.addEvent({
          delay: 1000,
          callback: showStep,
          callbackScope: this,
          repeat: steps.length - 1,
        });
      });
    } else {
      showStep();
      this.time.addEvent({
        delay: 1000,
        callback: showStep,
        callbackScope: this,
        repeat: steps.length - 1,
      });
    }
  }

  private togglePause(): void {
    if (this.gamePhase === "countdown") {
      return;
    }
    if (this.gamePhase === "paused") {
      this.gamePhase = "playing";
      this.overlayGraphics.setVisible(false);
      this.pauseContainer.setVisible(false);
      return;
    }
    this.gamePhase = "paused";
    this.overlayGraphics.setVisible(true);
    this.pauseContainer.setVisible(true);
  }

  private playSound(audio: HTMLAudioElement | null): void {
    if (audio === null) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }

  private refreshDebugHud(): void {
    if (!this.hudVisible) {
      return;
    }
    const p1 = this.state.players[1].position;
    const holder = this.state.players[1].hasBall ? "P1" : this.state.players[2].hasBall ? "P2" : "none";
    const p1Flying = this.state.players[1].isFlying ? " yes" : " no";
    const ballFlying = this.state.ball.inFlight ? "yes" : "no";

    if (this.isCpu) {
      const p2 = this.state.players[2].position;
      const p2Flying = this.state.players[2].isFlying ? " yes" : " no";
      this.debugHudText.setText(
        `Seed ${this.state.seed} | Tick ${this.state.tick}\n` +
          `P1 location: (${p1.x}, ${p1.y}) flying: ${p1Flying} | CPU location: (${p2.x}, ${p2.y}) flying:${p2Flying} | Ball: ${holder} flying: ${ballFlying}\n` +
          `P1 WASD move, Q fly, E action | CPU tick: ${this.cpuTickMs}ms`
      );
    } else if (this.p2Active) {
      const p2 = this.state.players[2].position;
      const p2Flying = this.state.players[2].isFlying ? " yes" : " no";
      this.debugHudText.setText(
        `Seed ${this.state.seed} | Tick ${this.state.tick}\n` +
          `P1 location: (${p1.x}, ${p1.y}) flying: ${p1Flying} | P2 location: (${p2.x}, ${p2.y}) flying:${p2Flying} | Ball: ${holder} flying: ${ballFlying}\n` +
          `P1 WASD move, Q fly, E action | P2 IJKL/Arrows move, U fly, O or . action`
      );
    } else {
      this.debugHudText.setText(
        `Seed ${this.state.seed} | Tick ${this.state.tick}\n` +
          `P1 location: (${p1.x}, ${p1.y}) flying: ${p1Flying} | Ball: ${holder} flying: ${ballFlying}\n` +
          `P1 WASD move, Q fly, E action`
      );
    }
  }
}
