import Phaser from "phaser";
import { STATUS_BOX_BORDER_WIDTH, STATUS_BOX_TEXT_MARGIN } from "../config/display";

export type StatusHudCell = {
  container: Phaser.GameObjects.Container;
  box: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
};

export function createStatusHudCell(
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

export function drawStatusCell(
  cell: StatusHudCell,
  x: number,
  statBoxY: number,
  borderColor: number
): void {
  const pad = STATUS_BOX_TEXT_MARGIN;
  const w = cell.text.width + 2 * pad;
  const h = cell.text.height + 2 * pad;
  cell.container.setPosition(x, statBoxY);
  cell.text.setPosition(w / 2, pad);
  cell.box.lineStyle(STATUS_BOX_BORDER_WIDTH, borderColor);
  cell.box.strokeRect(0, 0, w, h);
}
