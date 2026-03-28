import Phaser from "phaser";
import { PhaserRenderer } from "../adapters/render/phaserRenderer";
import * as HudColors from "../config/colors";
import { toTextColor, player2Color } from "../config/colors";
import {
  BAR_CORNER_RADIUS,
  BAR_DOT_RADIUS,
  BAR_HEIGHT,
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
  COMMANDS_TEXT_FONT_PX,
} from "../config/display";
import { isPlayer2Active } from "../config/gameModes";
import { DEFAULT_SETTINGS, SIM_TICK_MS } from "../config/rules";
import { buildActionGroups } from "../core/replayLog";
import type { ReplayLog } from "../core/replayLog";
import { GameState } from "../core/types";
import { getSiteControls } from "../siteBridge";
import { StatusHudCell, createStatusHudCell, drawStatusCell } from "./hud";

const ANIM_FRAME_MS = 25;
const AUTO_PLAY_PAUSE_MS = 100;
const HOLD_REPEAT_DELAY_MS = 80;

export class ReplayScene extends Phaser.Scene {
  private actionGroups: GameState[][] = [];
  private actionIndex = 0;
  private tileRenderer!: PhaserRenderer;

  private playing = true;
  private playPauseMs = 0;

  private animating = false;
  private animFrames: GameState[] = [];
  private animFrameIdx = 0;
  private animFrameMs = ANIM_FRAME_MS;
  private animAccumMs = 0;
  private animOnComplete: (() => void) | null = null;

  private holdingA = false;
  private holdingD = false;
  private holdActive = false;
  private holdRepeatMs = 0;

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
  private bottomBarContainer!: Phaser.GameObjects.Container;
  private bottomPauseResumeSegment!: Phaser.GameObjects.Text;
  private bottomScrubSegment!: Phaser.GameObjects.Text;
  private bottomCommandsSegment!: Phaser.GameObjects.Text;

  private p2Active = true;
  private isPractice = false;
  private isCpu = false;
  private targetScore = DEFAULT_SETTINGS.targetScore;

  constructor() {
    super("replay");
  }

  create(): void {
    const log = this.registry.get("replayLog") as ReplayLog | undefined;
    if (!log || log.states.length === 0) {
      this.scene.start("titleMenu");
      return;
    }

    this.actionGroups = buildActionGroups(log);
    this.targetScore = log.targetScore;
    this.actionIndex = 0;
    this.playing = true;
    this.playPauseMs = 0;
    this.animating = false;
    this.holdingA = false;
    this.holdingD = false;
    this.holdActive = false;
    this.holdRepeatMs = 0;

    const initialState = this.actionGroups[0][0];
    this.p2Active = isPlayer2Active(initialState.mode);
    this.isPractice = initialState.mode === "PRACTICE";
    this.isCpu = initialState.mode === "ONE_V_CPU";

    this.tileRenderer = new PhaserRenderer(
      this,
      initialState.map.height,
      HORIZONTAL_OFFSET,
      TOP_OFFSET,
      this.isCpu
    );

    this.createHud();

    const bottomCmdStyle = {
      fontFamily: FONT_DISPLAY,
      fontSize: `${COMMANDS_TEXT_FONT_PX}px`,
      color: toTextColor(HudColors.PLAYER_BASE_TEXT_COLOR),
    } as const;

    this.bottomPauseResumeSegment = this.add
      .text(0, 0, "", bottomCmdStyle)
      .setOrigin(0, 1);
    this.bottomScrubSegment = this.add
      .text(0, 0, "", {
        ...bottomCmdStyle,
        color: toTextColor(HudColors.NO_STEPS_COLOR),
      })
      .setOrigin(0, 1);
    this.bottomCommandsSegment = this.add
      .text(0, 0, "", bottomCmdStyle)
      .setOrigin(0, 1);

    this.bottomBarContainer = this.add
      .container(this.scale.width / 2, GAME_HEIGHT - 6, [
        this.bottomPauseResumeSegment,
        this.bottomScrubSegment,
        this.bottomCommandsSegment,
      ])
      .setDepth(21)
      .setScrollFactor(0);

    const onRegistryMusicMuted = (_parent: unknown, key: string | number): void => {
      if (key === "musicMuted") {
        this.updateBottomText();
      }
    };
    this.registry.events.on("setdata", onRegistryMusicMuted);
    this.registry.events.on("changedata", onRegistryMusicMuted);

    this.bindKeys(onRegistryMusicMuted);

    const refreshReplayBottomBar = (): void => {
      this.updateBottomText();
    };
    this.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, refreshReplayBottomBar);
    this.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, refreshReplayBottomBar);
    this.scale.on(Phaser.Scale.Events.RESIZE, refreshReplayBottomBar);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, refreshReplayBottomBar);
      this.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, refreshReplayBottomBar);
      this.scale.off(Phaser.Scale.Events.RESIZE, refreshReplayBottomBar);
    });

    this.renderDisplayState();
  }

  update(_time: number, delta: number): void {
    if (this.animating) {
      this.tickAnimation(delta);
      return;
    }

    if (this.playing) {
      this.playPauseMs += delta;
      if (this.playPauseMs >= AUTO_PLAY_PAUSE_MS) {
        this.playPauseMs -= AUTO_PLAY_PAUSE_MS;
        this.playNextAction();
      }
      return;
    }

    if (this.holdActive && (this.holdingD || this.holdingA)) {
      this.holdRepeatMs += delta;
      if (this.holdRepeatMs >= HOLD_REPEAT_DELAY_MS) {
        this.holdRepeatMs = 0;
        if (this.holdingD) this.stepForward();
        else this.stepBackward();
      }
    }
  }

  // ── Animation engine ─────────────────────────────────────────

  private startAnimation(
    frames: GameState[],
    frameMs: number,
    onComplete: () => void
  ): void {
    if (frames.length === 0) {
      onComplete();
      return;
    }
    this.animFrames = frames;
    this.animFrameIdx = 0;
    this.animFrameMs = frameMs;
    this.animAccumMs = 0;
    this.animOnComplete = onComplete;
    this.animating = true;
    this.renderState(frames[0]);
  }

  private tickAnimation(delta: number): void {
    this.animAccumMs += delta;
    while (this.animAccumMs >= this.animFrameMs && this.animating) {
      this.animAccumMs -= this.animFrameMs;
      this.animFrameIdx++;
      if (this.animFrameIdx >= this.animFrames.length) {
        this.animating = false;
        if (this.holdingD || this.holdingA) {
          this.holdActive = true;
          this.holdRepeatMs = 0;
        }
        const cb = this.animOnComplete;
        this.animOnComplete = null;
        cb?.();
        break;
      }
      this.renderState(this.animFrames[this.animFrameIdx]);
    }
  }

  // ── Playback controls ────────────────────────────────────────

  private getDisplayState(): GameState {
    const group = this.actionGroups[this.actionIndex];
    return group[group.length - 1];
  }

  private renderDisplayState(): void {
    this.renderState(this.getDisplayState());
  }

  private renderState(state: GameState): void {
    this.tileRenderer.draw(state);
    this.refreshHud(state);
    this.updateBottomText();
  }

  private animRateForGroup(group: GameState[]): number {
    return group.length > 1 ? SIM_TICK_MS.fly : ANIM_FRAME_MS;
  }

  private playNextAction(): void {
    if (this.actionIndex >= this.actionGroups.length - 1) {
      this.playing = false;
      this.updateBottomText();
      return;
    }
    const nextGroup = this.actionGroups[this.actionIndex + 1];
    this.startAnimation(nextGroup, this.animRateForGroup(nextGroup), () => {
      this.actionIndex++;
      this.playPauseMs = 0;
      this.updateBottomText();
    });
  }

  private stepForward(): void {
    if (this.actionIndex >= this.actionGroups.length - 1) return;
    const nextGroup = this.actionGroups[this.actionIndex + 1];
    this.startAnimation(nextGroup, this.animRateForGroup(nextGroup), () => {
      this.actionIndex++;
      this.updateBottomText();
    });
  }

  private stepBackward(): void {
    if (this.actionIndex <= 0) return;
    const currentGroup = this.actionGroups[this.actionIndex];
    const reversed = [...currentGroup].reverse();
    this.startAnimation(reversed, this.animRateForGroup(currentGroup), () => {
      this.actionIndex--;
      this.renderDisplayState();
    });
  }

  private togglePlayPause(): void {
    if (this.animating) {
      this.animating = false;
      this.animOnComplete = null;
    }

    if (this.playing) {
      this.playing = false;
    } else {
      if (this.actionIndex >= this.actionGroups.length - 1) {
        this.actionIndex = 0;
        this.renderDisplayState();
      }
      this.playing = true;
      this.playPauseMs = 0;
    }
    this.holdingA = false;
    this.holdingD = false;
    this.holdActive = false;
    this.holdRepeatMs = 0;
    this.updateBottomText();
  }

  // ── Key bindings ─────────────────────────────────────────────

  private bindKeys(onRegistryMusicMuted: (_parent: unknown, key: string | number) => void): void {
    const keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    const keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);

    keyA.on("down", () => {
      if (this.playing || this.animating) return;
      this.holdingA = true;
      this.holdingD = false;
      this.holdActive = false;
      this.holdRepeatMs = 0;
      this.stepBackward();
    });
    keyA.on("up", () => {
      this.holdingA = false;
      this.holdActive = false;
      this.holdRepeatMs = 0;
    });

    keyD.on("down", () => {
      if (this.playing || this.animating) return;
      this.holdingD = true;
      this.holdingA = false;
      this.holdActive = false;
      this.holdRepeatMs = 0;
      this.stepForward();
    });
    keyD.on("up", () => {
      this.holdingD = false;
      this.holdActive = false;
      this.holdRepeatMs = 0;
    });

    const onKeyDown = (event: KeyboardEvent): void => {
      const k = event.key.toLowerCase();
      switch (k) {
        case " ":
          event.preventDefault();
          this.togglePlayPause();
          break;
        case "e":
          this.scene.start("titleMenu");
          break;
        case "q":
          getSiteControls()?.quitToWebsite();
          break;
        case "m":
          getSiteControls()?.toggleMute();
          break;
        case "f":
          getSiteControls()?.toggleFullscreen();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("keydown", onKeyDown, true);
      this.registry.events.off("setdata", onRegistryMusicMuted);
      this.registry.events.off("changedata", onRegistryMusicMuted);
    });
  }

  // ── Bottom text ──────────────────────────────────────────────

  private updateBottomText(): void {
    const width = this.scale.width;
    const fs = this.scale.isFullscreen ? "Exit Full Screen (F)" : "Full Screen (F)";
    const fsColon = this.scale.isFullscreen ? "Exit Full Screen (:F)" : "Full Screen (:F)";
    const musicMuted =
      (this.registry.get("musicMuted") as boolean | undefined) ?? false;
    const muteWord = musicMuted ? "Unmute" : "Mute";
    const gap = "   ";

    if (this.playing) {
      this.bottomScrubSegment.setText("");
      this.bottomPauseResumeSegment.setText("Pause (:SPACE)");
      this.bottomPauseResumeSegment.setColor(
        toTextColor(HudColors.PLAYER_BASE_TEXT_COLOR)
      );
      this.bottomCommandsSegment.setText(
        `   ${muteWord} (:M)   ${fsColon}   Exit (:E)   Quit (:Q)`
      );
    } else {
      const atStart = this.actionIndex <= 0;
      const atEnd = this.actionIndex >= this.actionGroups.length - 1;
      const prevPart = atStart ? "No Previous Actions" : "Previous Action (A)";
      const nextPart = atEnd ? "No Further Actions" : "Next Action (D)";
      this.bottomPauseResumeSegment.setText("Resume (SPACE)");
      this.bottomPauseResumeSegment.setColor(toTextColor(0xff0000));
      this.bottomScrubSegment.setText(`   ${prevPart}${gap}${nextPart}`);
      this.bottomCommandsSegment.setText(
        `   ${muteWord} (M)   ${fs}   Exit (E)   Quit (Q)`
      );
    }

    const w1 = this.bottomPauseResumeSegment.width;
    const w2 = this.bottomScrubSegment.width;
    const w3 = this.bottomCommandsSegment.width;
    const totalW = w1 + w2 + w3;
    const lineY = 0;
    this.bottomPauseResumeSegment.setPosition(-totalW / 2, lineY);
    this.bottomScrubSegment.setPosition(-totalW / 2 + w1, lineY);
    this.bottomCommandsSegment.setPosition(-totalW / 2 + w1 + w2, lineY);
    this.bottomBarContainer.setPosition(width / 2, GAME_HEIGHT - 6);
  }

  // ── HUD ──────────────────────────────────────────────────────

  private createHud(): void {
    const state = this.actionGroups[0][0];
    const width = this.scale.width;
    const centerX = width / 2;
    const barY =
      TOP_MARGIN + PLAYER_LABEL_FONT_PX + MIDDLE_MARGIN / 2 - BAR_HEIGHT / 2;
    const firstToY = barY / 2;
    const scoreRowY = barY + BAR_HEIGHT / 2;
    const boxY = TOP_MARGIN + PLAYER_LABEL_FONT_PX + MIDDLE_MARGIN;
    this.hudStatBoxY = boxY;
    this.hudGraphics = this.add.graphics().setDepth(20).setScrollFactor(0);
    this.hudDynamicGraphics = this.add
      .graphics()
      .setDepth(20.5)
      .setScrollFactor(0);

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
      const leftBarWidth = Math.max(
        0,
        targetLeftX - SCORE_BAR_GAP - leftBarX
      );
      const rightBarX = targetRightX + SCORE_BAR_GAP;
      const rightBarWidth = Math.max(
        0,
        p2ScoreLeftX - SCORE_BAR_GAP - rightBarX
      );

      this.hudLeftBarX = leftBarX;
      this.hudRightBarX = rightBarX;
      this.hudBarY = barY;
      this.hudP1BarWidth = leftBarWidth;
      this.hudP2BarWidth = rightBarWidth;
      this.hudBarHeight = BAR_HEIGHT;

      this.hudGraphics.fillStyle(HudColors.BAR_BACKGROUND_COLOR, 1);
      this.hudGraphics.fillRoundedRect(
        leftBarX,
        barY,
        leftBarWidth,
        BAR_HEIGHT,
        BAR_CORNER_RADIUS
      );
      this.hudGraphics.fillStyle(HudColors.PLAYER_1_COLOR, 1);
      this.hudGraphics.fillCircle(
        leftBarX + BAR_CORNER_RADIUS,
        barY + BAR_HEIGHT / 2,
        BAR_DOT_RADIUS
      );
      if (this.p2Active) {
        this.hudGraphics.fillStyle(HudColors.BAR_BACKGROUND_COLOR, 1);
        this.hudGraphics.fillRoundedRect(
          rightBarX,
          barY,
          rightBarWidth,
          BAR_HEIGHT,
          BAR_CORNER_RADIUS
        );
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

    const p1StepsLabel = `Steps Left: ${state.players[1].stepsLeft}`;
    const p2StepsLabel = `Steps Left: ${state.players[2].stepsLeft}`;

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

  private refreshHud(state: GameState): void {
    const p1FlyArmed = state.players[1].flyArmed;
    const p1HasBall = state.players[1].hasBall;
    const p1NoStepsLeft = state.players[1].stepsLeft <= 0;
    const hudWidth = this.scale.width;

    this.hudDynamicGraphics.clear();

    if (!this.isPractice) {
      const p1ScoreProgress = Math.min(1, state.score.p1 / this.targetScore);
      const progressInset = BAR_CORNER_RADIUS - BAR_DOT_RADIUS;
      const progressY = this.hudBarY + progressInset;
      const progressHeight = this.hudBarHeight - progressInset * 2;
      const p1ProgressMaxWidth = this.hudP1BarWidth - progressInset * 2;
      const progressCornerRadius = Math.max(0, BAR_CORNER_RADIUS - progressInset);

      if (p1ScoreProgress > 0) {
        const w = p1ProgressMaxWidth * p1ScoreProgress;
        this.hudDynamicGraphics.fillStyle(HudColors.PLAYER_1_COLOR, 1);
        this.hudDynamicGraphics.fillRoundedRect(
          this.hudLeftBarX + progressInset, progressY, w, progressHeight, progressCornerRadius
        );
      }
      if (this.p2Active) {
        const p2ScoreProgress = Math.min(1, state.score.p2 / this.targetScore);
        const p2ProgressMaxWidth = this.hudP2BarWidth - progressInset * 2;
        if (p2ScoreProgress > 0) {
          const w = p2ProgressMaxWidth * p2ScoreProgress;
          this.hudDynamicGraphics.fillStyle(player2Color(this.isCpu), 1);
          this.hudDynamicGraphics.fillRoundedRect(
            this.hudRightBarX + progressInset + p2ProgressMaxWidth - w,
            progressY, w, progressHeight, progressCornerRadius
          );
        }
      }

      this.hudP1Score.setText(String(state.score.p1));
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
      this.hudP2Score.setText(String(state.score.p2));
      const p2ScoreRightX = hudWidth - PLAYER_SCORE_X + this.hudP2Score.width;
      this.hudP2PlayerTitle.setX((p2ScoreRightX + hudWidth) / 2);

      const p2FlyArmed = state.players[2].flyArmed;
      const p2HasBall = state.players[2].hasBall;
      const p2NoStepsLeft = state.players[2].stepsLeft <= 0;
      this.hudP2FlyArmed.text.setColor(
        toTextColor(p2FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
      );
      this.hudP2HasBall.text.setColor(
        toTextColor(p2HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
      );
      this.hudP2Steps.text.setText(`Steps Left: ${state.players[2].stepsLeft}`);
      this.hudP2Steps.text.setColor(
        toTextColor(p2NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
      );

      const pad = STATUS_BOX_TEXT_MARGIN;
      const gap = STATUS_BOX_GAP;
      const p2W =
        this.hudP2FlyArmed.text.width + 2 * pad + gap +
        this.hudP2HasBall.text.width + 2 * pad + gap +
        this.hudP2Steps.text.width + 2 * pad;
      const p2ScoreRightX2 = hudWidth - PLAYER_SCORE_X + this.hudP2Score.width;
      let p2x = (p2ScoreRightX2 + hudWidth - p2W) / 2;
      drawStatusCell(this.hudP2FlyArmed, p2x, this.hudStatBoxY,
        p2FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR);
      p2x += this.hudP2FlyArmed.text.width + 2 * pad + gap;
      drawStatusCell(this.hudP2HasBall, p2x, this.hudStatBoxY,
        p2HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR);
      p2x += this.hudP2HasBall.text.width + 2 * pad + gap;
      drawStatusCell(this.hudP2Steps, p2x, this.hudStatBoxY,
        p2NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR);
    }

    this.hudP1FlyArmed.text.setColor(
      toTextColor(p1FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP1HasBall.text.setColor(
      toTextColor(p1HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );
    this.hudP1Steps.text.setText(`Steps Left: ${state.players[1].stepsLeft}`);
    this.hudP1Steps.text.setColor(
      toTextColor(p1NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_TEXT_COLOR)
    );

    const pad = STATUS_BOX_TEXT_MARGIN;
    const gap = STATUS_BOX_GAP;
    const p1W =
      this.hudP1FlyArmed.text.width + 2 * pad + gap +
      this.hudP1HasBall.text.width + 2 * pad + gap +
      this.hudP1Steps.text.width + 2 * pad;
    let p1x = (p1ScoreLeftX - p1W) / 2;
    drawStatusCell(this.hudP1FlyArmed, p1x, this.hudStatBoxY,
      p1FlyArmed ? HudColors.FLY_TEXT_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR);
    p1x += this.hudP1FlyArmed.text.width + 2 * pad + gap;
    drawStatusCell(this.hudP1HasBall, p1x, this.hudStatBoxY,
      p1HasBall ? HudColors.BALL_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR);
    p1x += this.hudP1HasBall.text.width + 2 * pad + gap;
    drawStatusCell(this.hudP1Steps, p1x, this.hudStatBoxY,
      p1NoStepsLeft ? HudColors.NO_STEPS_COLOR : HudColors.PLAYER_BASE_BORDER_COLOR);
  }
}
