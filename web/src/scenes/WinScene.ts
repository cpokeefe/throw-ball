import Phaser from "phaser";

type WinSceneData = {
  winner?: number;
};

export class WinScene extends Phaser.Scene {
  private winner = 1;

  constructor() {
    super("win");
  }

  init(data: WinSceneData): void {
    this.winner = data.winner === 2 ? 2 : 1;
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#000000");

    this.add
      .text(width * 0.5, height * 0.5, `Player ${this.winner} wins!`, {
        fontFamily: "monaco",
        fontSize: "58px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const returnToTitle = (): void => {
      this.scene.start("titleMenu");
    };

    const returnTimer = this.time.delayedCall(2500, returnToTitle);
    this.input.keyboard?.once("keydown", returnToTitle);
    this.input.once("pointerdown", returnToTitle);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (returnTimer.getProgress() < 1) {
        returnTimer.remove(false);
      }
      this.input.keyboard?.off("keydown", returnToTitle);
      this.input.off("pointerdown", returnToTitle);
    });
  }
}
