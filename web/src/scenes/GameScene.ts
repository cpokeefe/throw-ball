import Phaser from "phaser";
import { KeyboardAdapter } from "../adapters/input/keyboard";
import { PhaserRenderer } from "../adapters/render/phaserRenderer";
import { createInitialState } from "../core/init";
import { GameState } from "../core/types";
import { update } from "../core/update";

export class GameScene extends Phaser.Scene {
  private static readonly FLY_STEP_MS = 10;
  private static readonly BALL_STEP_MS = 3;
  private state!: GameState;
  private keyboard!: KeyboardAdapter;
  private tileRenderer!: PhaserRenderer;
  private hudText!: Phaser.GameObjects.Text;
  private flyAccumulatorMs = 0;
  private ballAccumulatorMs = 0;

  constructor() {
    super("game");
  }

  create(): void {
    const seed = Date.now() % 2_147_483_647;
    this.state = createInitialState(seed, "ONE_V_ONE");
    this.keyboard = new KeyboardAdapter(this);
    this.tileRenderer = new PhaserRenderer(this, this.state.map.height);

    this.hudText = this.add
      .text(8, 8, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setDepth(10)
      .setScrollFactor(0);

    this.tileRenderer.draw(this.state);
    this.refreshHud();
  }

  update(_time: number, delta: number): void {
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

    if (next !== this.state) {
      this.state = next;
      this.tileRenderer.draw(this.state);
      this.refreshHud();
    }
  }

  private refreshHud(): void {
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
      `Seed ${this.state.seed} | Tick ${this.state.tick} | Score ${this.state.score.p1}-${this.state.score.p2}\n` +
        `Ball: ${holder} flying:${ballFlying} | P1 steps: ${p1Steps} fly:${p1Fly} flying:${p1Flying} | P2 steps: ${p2Steps} fly:${p2Fly} flying:${p2Flying}\n` +
        `P1 WASD move, Q fly, E action: (${p1.x}, ${p1.y}) | P2 IJKL/Arrows move, U fly, O or . action: (${p2.x}, ${p2.y})`
    );
  }
}
