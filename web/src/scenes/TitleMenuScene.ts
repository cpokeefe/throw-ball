import Phaser from "phaser";

export class TitleMenuScene extends Phaser.Scene {
  constructor() {
    super("titleMenu");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#000000");

    this.add
      .text(width * 0.5, height * 0.25, "Throw Ball", {
        fontFamily: "monaco",
        fontSize: "50px",
        // fontStyle: "bold",
        align: "center",
        // color: "#ffffff",
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.55, "New Game (N)\nLoad Game (L)\nReplay Game (R)\nSwitch Game Mode (X)\nQuit (Q)", {
          fontFamily: "monaco",
          fontSize: "20px",
          // fontStyle: "bold",
          align: "center",
          lineSpacing: 12,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height * 0.87, "Current Game Mode: ONEvONE", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#ffffff",
      })
      .setOrigin(0.5);

    const startGame = (): void => {
      this.scene.start("game");
    };
    this.input.keyboard?.on("keydown-N", startGame);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown-N", startGame);
    });
  }
}
