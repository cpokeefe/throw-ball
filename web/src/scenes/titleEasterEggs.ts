import Phaser from "phaser";
import { BALL_COLOR, PLAYER_2_COLOR, PLAYER_HIGHLIGHT_ALPHA } from "../config/colors";
import { TILE_SIZE } from "../config/display";
import { SIM_TICK_MS } from "../config/rules";

type Point = { x: number; y: number };

type FillVFn = (
  gfx: Phaser.GameObjects.Graphics,
  color: number,
  top1: Point,
  bot: Point,
  top2: Point,
) => void;

export interface EasterEggLayout {
  leftVGfx: Phaser.GameObjects.Graphics;
  rightVGfx: Phaser.GameObjects.Graphics;
  fillV: FillVFn;
  a: Point;
  b: Point;
  c: Point;
  d: Point;
  e: Point;
  f: Point;
  staticLeftColor: number;
  staticRightColor: number;
  height: number;
  startX: number;
  wLeft: number;
  vWidth: number;
  wTop: number;
  wBottom: number;
  fontPx: number;
  titleY: number;
  charW: number;
}

type EggAnim = (onDone: () => void) => void;

const DIR_DOWN = 0;
const DIR_UP = Math.PI;
const DIR_LEFT = Math.PI / 2;
const DIR_RIGHT = -Math.PI / 2;
const STEP_PAUSE_MS = 700;

function chainSteps(
  steps: ((next: () => void) => void)[],
  done: () => void,
): void {
  let i = 0;
  const run = (): void => {
    if (i >= steps.length) { done(); return; }
    steps[i++](run);
  };
  run();
}

export function setupEasterEggs(
  scene: Phaser.Scene,
  layout: EasterEggLayout,
): { trigger: () => void } {
  const {
    leftVGfx, rightVGfx, fillV, a, b, c, d, e, f,
    staticLeftColor, staticRightColor,
    height, startX, wLeft, vWidth, wTop, wBottom,
    fontPx, titleY, charW,
  } = layout;

  const flyPxPerMs = TILE_SIZE / SIM_TICK_MS.fly;
  const sp = fontPx * 0.11;

  const vCenterPt = { x: (a.x + c.x) / 2, y: (a.y + b.y) / 2 };
  const rightVCenterPt = { x: (d.x + f.x) / 2, y: (d.y + e.y) / 2 };

  /** Rotate all parallelogram corners (not just control points) around vCenterPt. */
  const drawVFacing = (angle: number, color = staticLeftColor): void => {
    leftVGfx.clear();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rot = (px: number, py: number) => ({
      x: (px - vCenterPt.x) * cos - (py - vCenterPt.y) * sin + vCenterPt.x,
      y: (px - vCenterPt.x) * sin + (py - vCenterPt.y) * cos + vCenterPt.y,
    });
    const drawSeg = (p1: Point, p2: Point): void => {
      const r1 = rot(p1.x, p1.y);
      const r2 = rot(p1.x + sp, p1.y);
      const r3 = rot(p2.x + sp, p2.y);
      const r4 = rot(p2.x, p2.y);
      leftVGfx.fillStyle(color, 1);
      leftVGfx.fillPoints(
        [
          new Phaser.Geom.Point(r1.x, r1.y),
          new Phaser.Geom.Point(r2.x, r2.y),
          new Phaser.Geom.Point(r3.x, r3.y),
          new Phaser.Geom.Point(r4.x, r4.y),
        ],
        true,
        true,
      );
    };
    drawSeg(a, b);
    drawSeg(c, b);
  };

  const drawRightVFacing = (angle: number, color = staticRightColor): void => {
    rightVGfx.clear();
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rot = (px: number, py: number) => ({
      x: (px - rightVCenterPt.x) * cos - (py - rightVCenterPt.y) * sin + rightVCenterPt.x,
      y: (px - rightVCenterPt.x) * sin + (py - rightVCenterPt.y) * cos + rightVCenterPt.y,
    });
    const drawSeg = (p1: Point, p2: Point): void => {
      const r1 = rot(p1.x, p1.y);
      const r2 = rot(p1.x + sp, p1.y);
      const r3 = rot(p2.x + sp, p2.y);
      const r4 = rot(p2.x, p2.y);
      rightVGfx.fillStyle(color, 1);
      rightVGfx.fillPoints(
        [
          new Phaser.Geom.Point(r1.x, r1.y),
          new Phaser.Geom.Point(r2.x, r2.y),
          new Phaser.Geom.Point(r3.x, r3.y),
          new Phaser.Geom.Point(r4.x, r4.y),
        ],
        true,
        true,
      );
    };
    drawSeg(d, e);
    drawSeg(f, e);
  };

  const highlightGfx = scene.add.graphics();
  const vHalfW = vWidth / 2 + sp;
  const vHalfH = (wBottom - wTop) / 2 + sp;
  const showHighlight = (): void => {
    highlightGfx.clear();
    highlightGfx.fillStyle(BALL_COLOR, PLAYER_HIGHLIGHT_ALPHA);
    highlightGfx.fillRect(
      vCenterPt.x - vHalfW + leftVGfx.x,
      vCenterPt.y - vHalfH + leftVGfx.y,
      vHalfW * 2,
      vHalfH * 2,
    );
  };
  const hideHighlight = (): void => {
    highlightGfx.clear();
  };

  const blinkToggleFly = (onDone: () => void): void => {
    let count = 0;
    scene.time.addEvent({
      delay: 150,
      repeat: 3,
      callback: () => {
        leftVGfx.visible = !leftVGfx.visible;
        count++;
        if (count === 4) {
          leftVGfx.visible = true;
          onDone();
        }
      },
    });
  };

  const ballRadius = fontPx * 0.15;
  const screenW = scene.scale.width;

  const resetV = (): void => {
    leftVGfx.x = 0;
    leftVGfx.y = 0;
    leftVGfx.setScale(1);
    leftVGfx.visible = true;
    fillV(leftVGfx, staticLeftColor, a, b, c);
  };

  const createExtraV = (color: number): {
    gfx: Phaser.GameObjects.Graphics;
    draw: (angle: number, col?: number) => void;
  } => {
    const gfx = scene.add.graphics();
    const draw = (angle: number, col = color): void => {
      gfx.clear();
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rot = (px: number, py: number) => ({
        x: (px - vCenterPt.x) * cos - (py - vCenterPt.y) * sin + vCenterPt.x,
        y: (px - vCenterPt.x) * sin + (py - vCenterPt.y) * cos + vCenterPt.y,
      });
      const drawSeg = (p1: Point, p2: Point): void => {
        gfx.fillStyle(col, 1);
        const r1 = rot(p1.x, p1.y);
        const r2 = rot(p1.x + sp, p1.y);
        const r3 = rot(p2.x + sp, p2.y);
        const r4 = rot(p2.x, p2.y);
        gfx.fillPoints([
          new Phaser.Geom.Point(r1.x, r1.y),
          new Phaser.Geom.Point(r2.x, r2.y),
          new Phaser.Geom.Point(r3.x, r3.y),
          new Phaser.Geom.Point(r4.x, r4.y),
        ], true, true);
      };
      drawSeg(a, b);
      drawSeg(c, b);
    };
    return { gfx, draw };
  };

  const easterEggs: EggAnim[] = [];

  // ── Animation 0: toggle fly → fly down → fly back from top ──────
  easterEggs.push((onDone) => {
    const dist = height + 100;
    const dur = dist / flyPxPerMs;
    blinkToggleFly(() => {
      scene.tweens.add({
        targets: leftVGfx,
        y: dist,
        duration: dur,
        ease: "Linear",
        onComplete: () => {
          leftVGfx.y = -dist;
          scene.tweens.add({
            targets: leftVGfx,
            y: 0,
            duration: dur,
            ease: "Linear",
            onComplete: onDone,
          });
        },
      });
    });
  });

  // ── Animation 1: game sequence ──────────────────────────────────
  easterEggs.push((onDone) => {
    const ballRadius = fontPx * 0.15;
    const ball = scene.add.circle(0, 0, ballRadius, 0xffff00).setVisible(false);
    const vCx = wLeft + vWidth / 2;
    const vCy = (wTop + wBottom) / 2;
    const hX = startX + charW * 1.5;
    const hBotY = titleY + fontPx * 0.3;

    chainSteps([
      // Toggle fly (blink) — visible on screen
      (next) => { blinkToggleFly(next); },

      // V flies off screen downward
      (next) => {
        const dist = height + 100;
        scene.tweens.add({
          targets: leftVGfx,
          y: dist,
          duration: dist / flyPxPerMs,
          ease: "Linear",
          onComplete: next,
        });
      },

      // Ball flies in from bottom → bottom of "h"
      (next) => {
        ball.setPosition(hX, height + 50).setVisible(true);
        scene.tweens.add({
          targets: ball,
          y: hBotY,
          duration: (height + 50 - hBotY) / flyPxPerMs,
          ease: "Linear",
          onComplete: next,
        });
      },

      // V flies from bottom → stops one step below the ball (face up)
      (next) => {
        drawVFacing(DIR_UP);
        leftVGfx.x = hX - vCx;
        leftVGfx.y = height + 50 - vCy;
        const endY = hBotY + charW - vCy;
        scene.tweens.add({
          targets: leftVGfx,
          y: endY,
          duration: (height + 50 - hBotY - charW) / flyPxPerMs,
          ease: "Linear",
          onComplete: next,
        });
      },

      // Pause — V has stopped in front of the ball
      (next) => {
        scene.time.delayedCall(STEP_PAUSE_MS, next);
      },

      // V grabs ball — ball hides, highlight box appears around V
      (next) => {
        ball.setVisible(false);
        drawVFacing(DIR_UP);
        showHighlight();
        scene.time.delayedCall(STEP_PAUSE_MS, next);
      },

      // V advances one step left (instant snap, highlight follows)
      (next) => {
        drawVFacing(DIR_LEFT);
        leftVGfx.x -= charW;
        showHighlight();
        scene.time.delayedCall(STEP_PAUSE_MS, next);
      },

      // V throws ball — ball reappears at V center, flies off; highlight removed
      (next) => {
        hideHighlight();
        drawVFacing(DIR_LEFT);
        const throwX = vCx + leftVGfx.x;
        const throwY = vCy + leftVGfx.y;
        ball.setPosition(throwX, throwY).setVisible(true);
        const dist = throwX + 50;
        scene.tweens.add({
          targets: ball,
          x: -50,
          duration: dist / flyPxPerMs,
          ease: "Linear",
          onComplete: () => { ball.setVisible(false); next(); },
        });
      },

      // Toggle fly (blink) → fly off screen left
      (next) => {
        blinkToggleFly(() => {
          const screenRight = wLeft + vWidth + leftVGfx.x;
          const dist = screenRight + 50;
          scene.tweens.add({
            targets: leftVGfx,
            x: leftVGfx.x - dist,
            duration: dist / flyPxPerMs,
            ease: "Linear",
            onComplete: next,
          });
        });
      },

      // V enters from top → 2 steps right & 1 step above home (face down)
      (next) => {
        drawVFacing(DIR_DOWN);
        leftVGfx.x = 2 * charW;
        leftVGfx.y = -(height + 50);
        leftVGfx.visible = true;
        scene.tweens.add({
          targets: leftVGfx,
          y: -charW,
          duration: (height + 50 - charW) / flyPxPerMs,
          ease: "Linear",
          onComplete: next,
        });
      },

      // Walk left (step 1 of 2) — instant snap
      (next) => {
        scene.time.delayedCall(STEP_PAUSE_MS, () => {
          drawVFacing(DIR_LEFT);
          leftVGfx.x = charW;
          next();
        });
      },

      // Walk left (step 2 of 2) — instant snap
      (next) => {
        scene.time.delayedCall(STEP_PAUSE_MS, () => {
          leftVGfx.x = 0;
          next();
        });
      },

      // Walk down → home — instant snap
      (next) => {
        scene.time.delayedCall(STEP_PAUSE_MS, () => {
          drawVFacing(DIR_DOWN);
          leftVGfx.y = 0;
          next();
        });
      },
    ], () => {
      ball.destroy();
      hideHighlight();
      leftVGfx.x = 0;
      leftVGfx.y = 0;
      leftVGfx.visible = true;
      fillV(leftVGfx, staticLeftColor, a, b, c);
      onDone();
    });
  });

  // ── Animation 2: P1 circles around P2 ────────────────────────
  easterEggs.push((onDone) => {
    const p2OffX = vWidth;

    // P1 starts at home (0,0). 8 moves: down, right, right, up, up, left, left, down
    const circle: { x: number; y: number; dir: number }[] = [
      { x: 0,        y: charW,  dir: DIR_DOWN },
      { x: charW,    y: charW,  dir: DIR_RIGHT },
      { x: 2*charW,  y: charW,  dir: DIR_RIGHT },
      { x: 2*charW,  y: 0,      dir: DIR_UP },
      { x: 2*charW,  y: -charW, dir: DIR_UP },
      { x: charW,    y: -charW, dir: DIR_LEFT },
      { x: 0,        y: -charW, dir: DIR_LEFT },
      { x: 0,        y: 0,      dir: DIR_DOWN },
    ];

    const steps: ((next: () => void) => void)[] = [];

    // 8 circle moves
    for (const pos of circle) {
      steps.push((next) => {
        scene.time.delayedCall(STEP_PAUSE_MS, () => {
          drawVFacing(pos.dir);
          leftVGfx.x = pos.x;
          leftVGfx.y = pos.y;
          next();
        });
      });
    }

    chainSteps(steps, () => {
      leftVGfx.x = 0;
      leftVGfx.y = 0;
      leftVGfx.visible = true;
      fillV(leftVGfx, staticLeftColor, a, b, c);
      onDone();
    });
  });

  // ── Animation 3: orbit — left V circles "Thro" CW, right V circles "Ball" CCW ──
  easterEggs.push((onDone) => {
    const pad = charW * 0.5;
    const orbTop = titleY - fontPx * 0.55;
    const orbBot = titleY + fontPx * 0.55;
    const ballRight = wLeft + vWidth * 2 + 5 * charW;

    const lBR = { x: 0, y: orbBot - vCenterPt.y };
    const lBL = { x: startX - pad - vCenterPt.x, y: orbBot - vCenterPt.y };
    const lTL = { x: startX - pad - vCenterPt.x, y: orbTop - vCenterPt.y };
    const lTR = { x: 0, y: orbTop - vCenterPt.y };

    const rBL = { x: 0, y: orbBot - rightVCenterPt.y };
    const rBR = { x: ballRight + pad - rightVCenterPt.x, y: orbBot - rightVCenterPt.y };
    const rTR = { x: ballRight + pad - rightVCenterPt.x, y: orbTop - rightVCenterPt.y };
    const rTL = { x: 0, y: orbTop - rightVCenterPt.y };

    const ptDist = (x1: number, y1: number, x2: number, y2: number): number =>
      Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    const orbitLeg = (
      gfx: Phaser.GameObjects.Graphics,
      toX: number, toY: number,
      fromX: number, fromY: number,
      next: () => void,
    ): void => {
      scene.tweens.add({
        targets: gfx,
        x: toX,
        y: toY,
        duration: ptDist(fromX, fromY, toX, toY) / flyPxPerMs,
        ease: "Linear",
        onComplete: next,
      });
    };

    let doneCount = 0;
    const checkDone = (): void => {
      if (++doneCount < 2) return;
      leftVGfx.x = 0;
      leftVGfx.y = 0;
      rightVGfx.x = 0;
      rightVGfx.y = 0;
      fillV(leftVGfx, staticLeftColor, a, b, c);
      fillV(rightVGfx, staticRightColor, d, e, f);
      onDone();
    };

    chainSteps([
      (next) => { drawVFacing(DIR_DOWN); orbitLeg(leftVGfx, lBR.x, lBR.y, 0, 0, next); },
      (next) => { drawVFacing(DIR_LEFT); orbitLeg(leftVGfx, lBL.x, lBL.y, lBR.x, lBR.y, next); },
      (next) => { drawVFacing(DIR_UP); orbitLeg(leftVGfx, lTL.x, lTL.y, lBL.x, lBL.y, next); },
      (next) => { drawVFacing(DIR_RIGHT); orbitLeg(leftVGfx, lTR.x, lTR.y, lTL.x, lTL.y, next); },
      (next) => { drawVFacing(DIR_DOWN); orbitLeg(leftVGfx, 0, 0, lTR.x, lTR.y, next); },
    ], checkDone);

    chainSteps([
      (next) => { drawRightVFacing(DIR_DOWN); orbitLeg(rightVGfx, rBL.x, rBL.y, 0, 0, next); },
      (next) => { drawRightVFacing(DIR_RIGHT); orbitLeg(rightVGfx, rBR.x, rBR.y, rBL.x, rBL.y, next); },
      (next) => { drawRightVFacing(DIR_UP); orbitLeg(rightVGfx, rTR.x, rTR.y, rBR.x, rBR.y, next); },
      (next) => { drawRightVFacing(DIR_LEFT); orbitLeg(rightVGfx, rTL.x, rTL.y, rTR.x, rTR.y, next); },
      (next) => { drawRightVFacing(DIR_DOWN); orbitLeg(rightVGfx, 0, 0, rTL.x, rTL.y, next); },
    ], checkDone);
  });

  // ── Animation 3: Spin Cycle ─────────────────────────────────────
  // V rapidly cycles through all 4 directions, faster and faster
  easterEggs.push((onDone) => {
    const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
    let step = 0;
    let delay = 250;
    const spin = (): void => {
      drawVFacing(dirs[step % 4]);
      step++;
      if (step >= 20) {
        scene.time.delayedCall(300, () => { resetV(); onDone(); });
        return;
      }
      delay = Math.max(40, delay * 0.85);
      scene.time.delayedCall(delay, spin);
    };
    spin();
  });

  // ── Animation 4: Mirror Dance ────────────────────────────────────
  // A partner V appears and they perform a symmetric dance
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    p2.gfx.x = 3 * charW;
    p2.draw(0);
    const moves = [
      { p1x: -charW, p1y: 0,      p1d: DIR_LEFT,  p2x: 4 * charW, p2y: 0,      p2d: DIR_RIGHT },
      { p1x: -charW, p1y: -charW, p1d: DIR_UP,    p2x: 4 * charW, p2y: -charW, p2d: DIR_UP },
      { p1x: 0,      p1y: -charW, p1d: DIR_RIGHT, p2x: 3 * charW, p2y: -charW, p2d: DIR_LEFT },
      { p1x: charW,  p1y: -charW, p1d: DIR_RIGHT, p2x: 2 * charW, p2y: -charW, p2d: DIR_LEFT },
      { p1x: charW,  p1y: 0,      p1d: DIR_DOWN,  p2x: 2 * charW, p2y: 0,      p2d: DIR_DOWN },
      { p1x: charW,  p1y: charW,  p1d: DIR_DOWN,  p2x: 2 * charW, p2y: charW,  p2d: DIR_DOWN },
      { p1x: 0,      p1y: charW,  p1d: DIR_LEFT,  p2x: 3 * charW, p2y: charW,  p2d: DIR_RIGHT },
      { p1x: 0,      p1y: 0,      p1d: DIR_UP,    p2x: 3 * charW, p2y: 0,      p2d: DIR_UP },
    ];
    const steps = moves.map((m) => (next: () => void) => {
      scene.time.delayedCall(STEP_PAUSE_MS, () => {
        drawVFacing(m.p1d);
        leftVGfx.x = m.p1x;
        leftVGfx.y = m.p1y;
        p2.draw(m.p2d);
        p2.gfx.x = m.p2x;
        p2.gfx.y = m.p2y;
        next();
      });
    });
    chainSteps(steps, () => { p2.gfx.destroy(); resetV(); onDone(); });
  });

  // ── Animation 5: Ball Juggle ─────────────────────────────────────
  // V tosses a ball upward, catching and rethrowing higher each time
  easterEggs.push((onDone) => {
    const cx = vCenterPt.x;
    const cy = vCenterPt.y;
    const ball = scene.add.circle(cx, cy, ballRadius, BALL_COLOR).setVisible(false);
    const heights = [charW * 2, charW * 3.5, charW * 5];
    let toss = 0;
    drawVFacing(DIR_UP);
    const doToss = (): void => {
      if (toss >= heights.length) {
        ball.setPosition(cx, cy).setVisible(true);
        drawVFacing(DIR_UP);
        scene.tweens.add({
          targets: ball, y: -50, duration: 500, ease: "Quad.easeIn",
          onComplete: () => { ball.destroy(); resetV(); onDone(); },
        });
        return;
      }
      const h = heights[toss];
      ball.setPosition(cx, cy).setVisible(true);
      scene.tweens.add({
        targets: ball, y: cy - h, duration: 300 + toss * 80, ease: "Quad.easeOut",
        onComplete: () => {
          scene.tweens.add({
            targets: ball, y: cy, duration: 300 + toss * 80, ease: "Quad.easeIn",
            onComplete: () => {
              ball.setVisible(false);
              toss++;
              scene.time.delayedCall(150, doToss);
            },
          });
        },
      });
    };
    doToss();
  });

  // ── Animation 6: Leapfrog ────────────────────────────────────────
  // Two Vs hop over each other, advancing across the screen
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    p2.gfx.x = charW;
    p2.draw(DIR_DOWN);
    drawVFacing(DIR_DOWN);
    let p1x = 0;
    let p2x = charW;
    let turn = 0;
    const doHop = (): void => {
      if (turn >= 4) {
        drawVFacing(DIR_LEFT);
        p2.draw(DIR_LEFT);
        scene.tweens.add({
          targets: leftVGfx, x: 0, duration: 600, ease: "Linear",
        });
        scene.tweens.add({
          targets: p2.gfx, x: charW, alpha: 0, duration: 800, ease: "Linear",
          onComplete: () => { p2.gfx.destroy(); resetV(); onDone(); },
        });
        return;
      }
      const isP1 = turn % 2 === 0;
      const jumper = isP1 ? leftVGfx : p2.gfx;
      const drawJumper = isP1 ? drawVFacing : p2.draw;
      const targetX = (isP1 ? p2x : p1x) + charW;
      drawJumper(DIR_UP);
      scene.tweens.add({
        targets: jumper, y: -charW * 1.5, duration: 200, ease: "Quad.easeOut",
        onComplete: () => {
          jumper.x = targetX;
          scene.tweens.add({
            targets: jumper, y: 0, duration: 200, ease: "Quad.easeIn",
            onComplete: () => {
              if (isP1) p1x = targetX; else p2x = targetX;
              drawJumper(DIR_DOWN);
              turn++;
              scene.time.delayedCall(200, doHop);
            },
          });
        },
      });
    };
    doHop();
  });

  // ── Animation 7: Standoff ────────────────────────────────────────
  // Two Vs face off, inching closer, then one charges and the other flees
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    const gap = 6 * charW;
    p2.gfx.x = gap;
    p2.draw(DIR_LEFT);
    drawVFacing(DIR_RIGHT);
    chainSteps([
      (next) => scene.time.delayedCall(600, () => { leftVGfx.x = charW; p2.gfx.x = gap - charW; next(); }),
      (next) => scene.time.delayedCall(600, () => { leftVGfx.x = 2 * charW; p2.gfx.x = gap - 2 * charW; next(); }),
      (next) => scene.time.delayedCall(1000, next),
      (next) => {
        scene.tweens.add({
          targets: leftVGfx, x: gap - 2 * charW, duration: 150, ease: "Quad.easeIn",
        });
        p2.draw(DIR_UP);
        scene.tweens.add({
          targets: p2.gfx, y: -(height + 50), duration: 600, ease: "Quad.easeIn",
          onComplete: next,
        });
      },
    ], () => { p2.gfx.destroy(); resetV(); onDone(); });
  });

  // ── Animation 8: Ball Orbit ──────────────────────────────────────
  // A ball smoothly orbits around the V in a circle
  easterEggs.push((onDone) => {
    const cx = vCenterPt.x;
    const cy = vCenterPt.y;
    const radius = charW * 1.5;
    const ball = scene.add.circle(cx + radius, cy, ballRadius, BALL_COLOR);
    const tracker = { angle: 0 };
    scene.tweens.add({
      targets: tracker,
      angle: Math.PI * 4,
      duration: 3000,
      ease: "Linear",
      onUpdate: () => {
        ball.x = cx + radius * Math.cos(tracker.angle);
        ball.y = cy + radius * Math.sin(tracker.angle);
      },
      onComplete: () => { ball.destroy(); resetV(); onDone(); },
    });
  });

  // ── Animation 9: Pac-Man Chase ───────────────────────────────────
  // V chases and eats a row of pellets
  easterEggs.push((onDone) => {
    const dotRadius = fontPx * 0.06;
    const dots: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 6; i++) {
      dots.push(scene.add.circle(
        vCenterPt.x + (i + 1) * charW, vCenterPt.y, dotRadius, BALL_COLOR,
      ));
    }
    drawVFacing(DIR_RIGHT);
    let eaten = 0;
    const eatNext = (): void => {
      if (eaten >= dots.length) {
        drawVFacing(DIR_LEFT);
        scene.tweens.add({
          targets: leftVGfx, x: 0, duration: 600, ease: "Linear",
          onComplete: () => { dots.forEach((d) => d.destroy()); resetV(); onDone(); },
        });
        return;
      }
      scene.time.delayedCall(200, () => {
        leftVGfx.x = (eaten + 1) * charW;
        dots[eaten].setVisible(false);
        eaten++;
        eatNext();
      });
    };
    eatNext();
  });

  // ── Animation 10: Scale Pulse ────────────────────────────────────
  // V grows huge, shrinks tiny, then bounces back to normal size
  easterEggs.push((onDone) => {
    const proxy = { s: 1 };
    const applyScale = (): void => {
      leftVGfx.setScale(proxy.s);
      leftVGfx.x = vCenterPt.x * (1 - proxy.s);
      leftVGfx.y = vCenterPt.y * (1 - proxy.s);
    };
    chainSteps([
      (next) => scene.tweens.add({ targets: proxy, s: 2.5, duration: 500, ease: "Back.easeOut", onUpdate: applyScale, onComplete: next }),
      (next) => scene.time.delayedCall(200, next),
      (next) => scene.tweens.add({ targets: proxy, s: 0.3, duration: 500, ease: "Back.easeOut", onUpdate: applyScale, onComplete: next }),
      (next) => scene.time.delayedCall(200, next),
      (next) => scene.tweens.add({ targets: proxy, s: 1, duration: 500, ease: "Bounce.easeOut", onUpdate: applyScale, onComplete: next }),
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 11: Playing Catch ──────────────────────────────────
  // Two Vs toss a ball back and forth in gentle arcs
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    const sep = 5 * charW;
    p2.gfx.x = sep;
    drawVFacing(DIR_RIGHT);
    p2.draw(DIR_LEFT);
    const ball = scene.add.circle(vCenterPt.x, vCenterPt.y, ballRadius, BALL_COLOR);
    let p1Has = true;
    const doThrow = (next: () => void): void => {
      const fromX = p1Has ? 0 : sep;
      const toX = p1Has ? sep : 0;
      ball.setPosition(fromX + vCenterPt.x, vCenterPt.y).setVisible(true);
      const midY = vCenterPt.y - charW * 1.5;
      scene.tweens.add({
        targets: ball, x: toX + vCenterPt.x, duration: 500, ease: "Linear",
      });
      scene.tweens.add({
        targets: ball, y: midY, duration: 250, ease: "Quad.easeOut",
        onComplete: () => {
          scene.tweens.add({
            targets: ball, y: vCenterPt.y, duration: 250, ease: "Quad.easeIn",
            onComplete: () => { p1Has = !p1Has; ball.setVisible(false); next(); },
          });
        },
      });
    };
    chainSteps([
      (next) => scene.time.delayedCall(400, next),
      (next) => doThrow(next),
      (next) => scene.time.delayedCall(300, next),
      (next) => doThrow(next),
      (next) => scene.time.delayedCall(300, next),
      (next) => doThrow(next),
      (next) => scene.time.delayedCall(300, next),
      (next) => doThrow(next),
    ], () => { ball.destroy(); p2.gfx.destroy(); resetV(); onDone(); });
  });

  // ── Animation 12: Dizzy Walk ─────────────────────────────────────
  // V spins in place until dizzy, then stumbles in a zigzag
  easterEggs.push((onDone) => {
    const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
    let step = 0;
    const spinEvent = scene.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => { drawVFacing(dirs[step % 4]); step++; },
    });
    scene.time.delayedCall(1500, () => {
      spinEvent.destroy();
      const zigzag = [
        { x: charW,  y: charW,   d: DIR_RIGHT },
        { x: 0,      y: 2 * charW, d: DIR_LEFT },
        { x: charW,  y: 3 * charW, d: DIR_RIGHT },
        { x: 0,      y: 2 * charW, d: DIR_LEFT },
        { x: 0,      y: charW,   d: DIR_UP },
        { x: 0,      y: 0,       d: DIR_UP },
      ];
      const zigSteps = zigzag.map((z) => (next: () => void) => {
        scene.time.delayedCall(300, () => {
          drawVFacing(z.d);
          leftVGfx.x = z.x;
          leftVGfx.y = z.y;
          next();
        });
      });
      chainSteps(zigSteps, () => { resetV(); onDone(); });
    });
  });

  // ── Animation 13: Rocket Launch ──────────────────────────────────
  // V shakes with charging energy, blasts off upward, re-enters with a bounce
  easterEggs.push((onDone) => {
    let shakeCount = 0;
    const shakeEvent = scene.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => { leftVGfx.x = (shakeCount % 2 === 0 ? 2 : -2); shakeCount++; },
    });
    scene.time.delayedCall(1000, () => {
      shakeEvent.destroy();
      leftVGfx.x = 0;
      drawVFacing(DIR_UP);
      blinkToggleFly(() => {
        scene.tweens.add({
          targets: leftVGfx, y: -(height + 100), duration: 600, ease: "Quad.easeIn",
          onComplete: () => {
            drawVFacing(DIR_DOWN);
            leftVGfx.y = -(height + 100);
            scene.tweens.add({
              targets: leftVGfx, y: 0, duration: 1800, ease: "Bounce.easeOut",
              onComplete: () => { resetV(); onDone(); },
            });
          },
        });
      });
    });
  });

  // ── Animation 14: Peek-a-boo ─────────────────────────────────────
  // V hides off-screen, peeks from different edges, then slides home
  easterEggs.push((onDone) => {
    const offRight = screenW + 50;
    const offLeft = -(wLeft + vWidth + 50);
    chainSteps([
      (next) => {
        drawVFacing(DIR_RIGHT);
        scene.tweens.add({
          targets: leftVGfx, x: offRight, duration: 400, ease: "Quad.easeIn", onComplete: next,
        });
      },
      (next) => scene.time.delayedCall(400, next),
      (next) => {
        drawVFacing(DIR_RIGHT);
        leftVGfx.x = offLeft;
        scene.tweens.add({
          targets: leftVGfx, x: offLeft + charW, duration: 300, ease: "Quad.easeOut",
          onComplete: () => scene.time.delayedCall(500, next),
        });
      },
      (next) => {
        scene.tweens.add({
          targets: leftVGfx, x: offLeft, duration: 200, ease: "Quad.easeIn", onComplete: next,
        });
      },
      (next) => {
        drawVFacing(DIR_LEFT);
        leftVGfx.x = offRight;
        scene.tweens.add({
          targets: leftVGfx, x: offRight - charW, duration: 300, ease: "Quad.easeOut",
          onComplete: () => scene.time.delayedCall(500, next),
        });
      },
      (next) => {
        drawVFacing(DIR_LEFT);
        scene.tweens.add({
          targets: leftVGfx, x: 0, duration: 600, ease: "Quad.easeOut", onComplete: next,
        });
      },
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 15: Conga Line ─────────────────────────────────────
  // Three Vs march together in formation across and back
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    const p3 = createExtraV(0x00ccff);
    p2.gfx.x = -charW * 1.5;
    p3.gfx.x = -charW * 3;
    p2.draw(DIR_RIGHT);
    p3.draw(DIR_RIGHT);
    drawVFacing(DIR_RIGHT);
    const marchDist = 5 * charW;
    const dur = 1800;
    scene.tweens.add({ targets: leftVGfx, x: marchDist, duration: dur, ease: "Linear" });
    scene.tweens.add({ targets: p2.gfx, x: marchDist - charW * 1.5, duration: dur, ease: "Linear" });
    scene.tweens.add({
      targets: p3.gfx, x: marchDist - charW * 3, duration: dur, ease: "Linear",
      onComplete: () => {
        drawVFacing(DIR_LEFT);
        p2.draw(DIR_LEFT);
        p3.draw(DIR_LEFT);
        scene.tweens.add({ targets: leftVGfx, x: 0, duration: dur, ease: "Linear" });
        scene.tweens.add({ targets: p2.gfx, x: -charW * 1.5, duration: dur, ease: "Linear" });
        scene.tweens.add({
          targets: p3.gfx, x: -charW * 3, duration: dur, ease: "Linear",
          onComplete: () => { p2.gfx.destroy(); p3.gfx.destroy(); resetV(); onDone(); },
        });
      },
    });
  });

  // ── Animation 16: Ball Dribble ───────────────────────────────────
  // V walks right while dribbling a ball (bouncing it with each step)
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(
      vCenterPt.x + charW * 0.5, vCenterPt.y + charW, ballRadius, BALL_COLOR,
    );
    drawVFacing(DIR_RIGHT);
    let step = 0;
    const totalSteps = 5;
    const dribbleStep = (): void => {
      if (step >= totalSteps) {
        ball.destroy();
        drawVFacing(DIR_LEFT);
        scene.tweens.add({
          targets: leftVGfx, x: 0, duration: 500, ease: "Linear",
          onComplete: () => { resetV(); onDone(); },
        });
        return;
      }
      leftVGfx.x = (step + 1) * charW;
      const ballBaseX = vCenterPt.x + charW * 0.5 + (step + 1) * charW;
      ball.x = ballBaseX;
      scene.tweens.add({
        targets: ball, y: vCenterPt.y - charW, duration: 150, ease: "Quad.easeOut",
        onComplete: () => {
          scene.tweens.add({
            targets: ball, y: vCenterPt.y + charW, duration: 150, ease: "Quad.easeIn",
            onComplete: () => { step++; scene.time.delayedCall(100, dribbleStep); },
          });
        },
      });
    };
    dribbleStep();
  });

  // ── Animation 17: Goal Kick ──────────────────────────────────────
  // V walks up to a ball, kicks it off-screen, then celebrates with a spin
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(
      vCenterPt.x + 2 * charW, vCenterPt.y, ballRadius, BALL_COLOR,
    );
    drawVFacing(DIR_RIGHT);
    chainSteps([
      (next) => scene.tweens.add({
        targets: leftVGfx, x: charW, duration: 400, ease: "Linear", onComplete: next,
      }),
      (next) => scene.time.delayedCall(200, next),
      (next) => scene.tweens.add({
        targets: ball, x: screenW + 50, duration: 500, ease: "Quad.easeIn",
        onComplete: () => { ball.destroy(); next(); },
      }),
      (next) => {
        const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT, DIR_DOWN];
        let i = 0;
        const spinStep = (): void => {
          if (i >= dirs.length) { next(); return; }
          drawVFacing(dirs[i]); i++;
          scene.time.delayedCall(120, spinStep);
        };
        spinStep();
      },
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 18: Boxing Match ───────────────────────────────────
  // Two Vs square up, P1 lands a punch sending P2 flying
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    p2.gfx.x = 4 * charW;
    drawVFacing(DIR_RIGHT);
    p2.draw(DIR_LEFT);
    chainSteps([
      (next) => scene.time.delayedCall(400, () => { leftVGfx.x = charW; p2.gfx.x = 3 * charW; next(); }),
      (next) => scene.time.delayedCall(400, () => { leftVGfx.x = 2 * charW; next(); }),
      (next) => scene.time.delayedCall(600, next),
      (next) => {
        leftVGfx.x = 2.5 * charW;
        scene.tweens.add({
          targets: p2.gfx, x: screenW + 50, duration: 400, ease: "Quad.easeIn",
          onComplete: next,
        });
      },
      (next) => {
        const dirs = [DIR_UP, DIR_LEFT, DIR_DOWN, DIR_RIGHT, DIR_DOWN];
        let i = 0;
        const spin = (): void => {
          if (i >= dirs.length) { next(); return; }
          drawVFacing(dirs[i]); i++;
          scene.time.delayedCall(150, spin);
        };
        spin();
      },
    ], () => { p2.gfx.destroy(); resetV(); onDone(); });
  });

  // ── Animation 19: Bounce Drop ────────────────────────────────────
  // V drops from above and bounces into its home position
  easterEggs.push((onDone) => {
    drawVFacing(DIR_DOWN);
    leftVGfx.y = -(height + 50);
    scene.tweens.add({
      targets: leftVGfx, y: 0, duration: 1500, ease: "Bounce.easeOut",
      onComplete: () => { resetV(); onDone(); },
    });
  });

  // ── Animation 20: Spiral Path ────────────────────────────────────
  // V traces an expanding square spiral outward, then snaps home
  easterEggs.push((onDone) => {
    const directions = [
      { dx: 1, dy: 0, dir: DIR_RIGHT },
      { dx: 0, dy: 1, dir: DIR_DOWN },
      { dx: -1, dy: 0, dir: DIR_LEFT },
      { dx: 0, dy: -1, dir: DIR_UP },
    ];
    const moves: { dx: number; dy: number; dir: number }[] = [];
    let len = 1;
    let dirIdx = 0;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        const d = directions[dirIdx % 4];
        for (let k = 0; k < len; k++) moves.push(d);
        dirIdx++;
        if (j === 1) len++;
      }
    }
    let cx = 0, cy = 0;
    const steps = moves.map((m) => (next: () => void) => {
      scene.time.delayedCall(150, () => {
        cx += m.dx * charW;
        cy += m.dy * charW;
        leftVGfx.x = cx;
        leftVGfx.y = cy;
        drawVFacing(m.dir);
        next();
      });
    });
    chainSteps(steps, () => {
      scene.tweens.add({
        targets: leftVGfx, x: 0, y: 0, duration: 500, ease: "Quad.easeOut",
        onComplete: () => { resetV(); onDone(); },
      });
    });
  });

  // ── Animation 21: High Five ──────────────────────────────────────
  // Two Vs approach from opposite sides, high-five, and a ball pops up
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    p2.gfx.x = 6 * charW;
    drawVFacing(DIR_RIGHT);
    p2.draw(DIR_LEFT);
    const meetX = 3 * charW;
    const ball = scene.add.circle(
      vCenterPt.x + meetX, vCenterPt.y, ballRadius, BALL_COLOR,
    ).setVisible(false);
    chainSteps([
      (next) => {
        scene.tweens.add({ targets: leftVGfx, x: meetX - charW * 0.5, duration: 600, ease: "Linear" });
        scene.tweens.add({
          targets: p2.gfx, x: meetX + charW * 0.5, duration: 600, ease: "Linear", onComplete: next,
        });
      },
      (next) => {
        ball.setVisible(true);
        scene.tweens.add({
          targets: ball, y: vCenterPt.y - charW * 3, duration: 400, ease: "Quad.easeOut",
          onComplete: () => {
            scene.tweens.add({
              targets: ball, y: vCenterPt.y, duration: 400, ease: "Quad.easeIn", onComplete: next,
            });
          },
        });
        scene.tweens.add({
          targets: leftVGfx, y: -charW, duration: 300, ease: "Quad.easeOut",
          onComplete: () => { scene.tweens.add({ targets: leftVGfx, y: 0, duration: 300, ease: "Quad.easeIn" }); },
        });
        scene.tweens.add({
          targets: p2.gfx, y: -charW, duration: 300, ease: "Quad.easeOut",
          onComplete: () => { scene.tweens.add({ targets: p2.gfx, y: 0, duration: 300, ease: "Quad.easeIn" }); },
        });
      },
      (next) => scene.time.delayedCall(300, next),
      (next) => {
        drawVFacing(DIR_LEFT);
        p2.draw(DIR_RIGHT);
        scene.tweens.add({ targets: leftVGfx, x: 0, duration: 500, ease: "Linear" });
        scene.tweens.add({
          targets: p2.gfx, x: 6 * charW, duration: 500, ease: "Linear", onComplete: next,
        });
      },
    ], () => { ball.destroy(); p2.gfx.destroy(); resetV(); onDone(); });
  });

  // ── Animation 22: Ghost Trail ────────────────────────────────────
  // V streaks across screen leaving fading afterimages behind
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    const ghosts: Phaser.GameObjects.Graphics[] = [];
    const totalSteps = 8;
    let step = 0;
    const doStep = (): void => {
      if (step >= totalSteps) {
        drawVFacing(DIR_LEFT);
        scene.tweens.add({
          targets: leftVGfx, x: 0, duration: 500, ease: "Linear",
          onComplete: () => {
            ghosts.forEach((g) => g.destroy());
            resetV();
            onDone();
          },
        });
        return;
      }
      const ghost = createExtraV(staticLeftColor);
      ghost.draw(DIR_RIGHT);
      ghost.gfx.x = leftVGfx.x;
      ghost.gfx.setAlpha(0.5);
      ghosts.push(ghost.gfx);
      scene.tweens.add({ targets: ghost.gfx, alpha: 0, duration: 1500 });
      leftVGfx.x = (step + 1) * charW * 0.8;
      step++;
      scene.time.delayedCall(180, doStep);
    };
    doStep();
  });

  // ── Animation 23: Teleport ──────────────────────────────────────
  // V blinks and warps to random positions around the screen
  easterEggs.push((onDone) => {
    const spots = [
      { x: 3 * charW, y: -2 * charW },
      { x: -2 * charW, y: charW },
      { x: 5 * charW, y: 2 * charW },
      { x: -charW, y: -3 * charW },
      { x: 4 * charW, y: -charW },
    ];
    let si = 0;
    const warp = (): void => {
      if (si >= spots.length) {
        leftVGfx.visible = false;
        scene.time.delayedCall(200, () => {
          leftVGfx.x = 0;
          leftVGfx.y = 0;
          leftVGfx.visible = true;
          resetV();
          onDone();
        });
        return;
      }
      leftVGfx.visible = false;
      scene.time.delayedCall(200, () => {
        leftVGfx.x = spots[si].x;
        leftVGfx.y = spots[si].y;
        const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
        drawVFacing(dirs[si % 4]);
        leftVGfx.visible = true;
        si++;
        scene.time.delayedCall(400, warp);
      });
    };
    warp();
  });

  // ── Animation 24: Matador ─────────────────────────────────────────
  // A ball charges from the right; V sidesteps at the last moment
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(screenW + 50, vCenterPt.y, ballRadius, BALL_COLOR);
    drawVFacing(DIR_LEFT);
    chainSteps([
      (next) => scene.time.delayedCall(300, next),
      (next) => {
        scene.tweens.add({
          targets: ball, x: vCenterPt.x, duration: 800, ease: "Quad.easeIn",
          onComplete: next,
        });
      },
      (next) => {
        drawVFacing(DIR_DOWN);
        leftVGfx.y = charW * 1.5;
        scene.tweens.add({
          targets: ball, x: -50, duration: 300, ease: "Linear",
          onComplete: next,
        });
      },
      (next) => scene.time.delayedCall(600, next),
      (next) => {
        drawVFacing(DIR_UP);
        scene.tweens.add({
          targets: leftVGfx, y: 0, duration: 400, ease: "Quad.easeOut",
          onComplete: next,
        });
      },
    ], () => { ball.destroy(); resetV(); onDone(); });
  });

  // ── Animation 25: Bowling ─────────────────────────────────────────
  // V rolls a ball into a triangle of pins that scatter on impact
  easterEggs.push((onDone) => {
    const pinR = fontPx * 0.07;
    const px = 5 * charW + vCenterPt.x;
    const py = vCenterPt.y;
    const gap = pinR * 3;
    const pins = [
      scene.add.circle(px, py - gap, pinR, 0xffffff),
      scene.add.circle(px, py, pinR, 0xffffff),
      scene.add.circle(px, py + gap, pinR, 0xffffff),
      scene.add.circle(px + gap, py - gap * 0.5, pinR, 0xffffff),
      scene.add.circle(px + gap, py + gap * 0.5, pinR, 0xffffff),
      scene.add.circle(px + gap * 2, py, pinR, 0xffffff),
    ];
    const ball = scene.add.circle(vCenterPt.x + charW, vCenterPt.y, ballRadius, BALL_COLOR);
    drawVFacing(DIR_RIGHT);
    chainSteps([
      (next) => scene.time.delayedCall(400, next),
      (next) => {
        scene.tweens.add({
          targets: ball, x: px, duration: 600, ease: "Linear",
          onComplete: next,
        });
      },
      (next) => {
        ball.setVisible(false);
        const scatterDirs = [
          { x: -30, y: -60 }, { x: 20, y: 70 }, { x: 50, y: -40 },
          { x: -40, y: 50 }, { x: 60, y: 20 }, { x: 30, y: -50 },
        ];
        pins.forEach((pin, i) => {
          scene.tweens.add({
            targets: pin,
            x: pin.x + scatterDirs[i].x,
            y: pin.y + scatterDirs[i].y,
            alpha: 0,
            duration: 500,
            ease: "Quad.easeOut",
          });
        });
        scene.time.delayedCall(600, next);
      },
      (next) => {
        const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT, DIR_DOWN];
        let i = 0;
        const spin = (): void => {
          if (i >= dirs.length) { next(); return; }
          drawVFacing(dirs[i]); i++;
          scene.time.delayedCall(120, spin);
        };
        spin();
      },
    ], () => { pins.forEach((p) => p.destroy()); ball.destroy(); resetV(); onDone(); });
  });

  // ── Animation 26: Wave Ride ───────────────────────────────────────
  // V surfs across the screen in a smooth sine-wave pattern
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    const dist = 7 * charW;
    const amplitude = charW * 1.2;
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: 1, duration: 3000, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = tracker.t * dist;
        leftVGfx.y = Math.sin(tracker.t * Math.PI * 4) * amplitude;
      },
      onComplete: () => {
        drawVFacing(DIR_LEFT);
        const tracker2 = { t: 0 };
        scene.tweens.add({
          targets: tracker2, t: 1, duration: 3000, ease: "Linear",
          onUpdate: () => {
            leftVGfx.x = dist * (1 - tracker2.t);
            leftVGfx.y = Math.sin(tracker2.t * Math.PI * 4) * amplitude;
          },
          onComplete: () => { resetV(); onDone(); },
        });
      },
    });
  });

  // ── Animation 27: Trampoline ──────────────────────────────────────
  // V bounces on an invisible trampoline, going higher each time
  easterEggs.push((onDone) => {
    drawVFacing(DIR_UP);
    const bounceHeights = [charW, charW * 2, charW * 3.5, charW * 6];
    let bi = 0;
    const doBounce = (): void => {
      if (bi >= bounceHeights.length) {
        scene.tweens.add({
          targets: leftVGfx, y: -(height + 100), duration: 400, ease: "Quad.easeIn",
          onComplete: () => {
            drawVFacing(DIR_DOWN);
            leftVGfx.y = -(height + 100);
            scene.tweens.add({
              targets: leftVGfx, y: 0, duration: 1200, ease: "Cubic.easeOut",
              onComplete: () => { resetV(); onDone(); },
            });
          },
        });
        return;
      }
      const h = bounceHeights[bi];
      scene.tweens.add({
        targets: leftVGfx, y: -h, duration: 250, ease: "Quad.easeOut",
        onComplete: () => {
          scene.tweens.add({
            targets: leftVGfx, y: 0, duration: 250, ease: "Quad.easeIn",
            onComplete: () => { bi++; scene.time.delayedCall(80, doBounce); },
          });
        },
      });
    };
    doBounce();
  });

  // ── Animation 28: Tag ─────────────────────────────────────────────
  // V chases P2, tags it, roles reverse — P2 chases V home
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    p2.gfx.x = 3 * charW;
    p2.draw(DIR_RIGHT);
    drawVFacing(DIR_RIGHT);
    chainSteps([
      (next) => {
        scene.tweens.add({ targets: p2.gfx, x: 5 * charW, duration: 500, ease: "Linear" });
        scene.tweens.add({
          targets: leftVGfx, x: 3 * charW, duration: 500, ease: "Linear", onComplete: next,
        });
      },
      (next) => {
        scene.tweens.add({ targets: p2.gfx, x: 6 * charW, duration: 300, ease: "Linear" });
        scene.tweens.add({
          targets: leftVGfx, x: 5 * charW, duration: 300, ease: "Linear", onComplete: next,
        });
      },
      (next) => {
        scene.tweens.add({
          targets: leftVGfx, x: 6 * charW, duration: 200, ease: "Quad.easeIn", onComplete: next,
        });
      },
      (next) => scene.time.delayedCall(300, next),
      (next) => {
        drawVFacing(DIR_LEFT);
        p2.draw(DIR_LEFT);
        scene.tweens.add({
          targets: leftVGfx, x: 2 * charW, duration: 600, ease: "Linear",
        });
        scene.tweens.add({
          targets: p2.gfx, x: 4 * charW, duration: 600, ease: "Linear", onComplete: next,
        });
      },
      (next) => {
        scene.tweens.add({ targets: leftVGfx, x: 0, duration: 400, ease: "Linear" });
        scene.tweens.add({
          targets: p2.gfx, x: 2 * charW, duration: 400, ease: "Linear", onComplete: next,
        });
      },
      (next) => {
        scene.tweens.add({
          targets: p2.gfx, x: charW, alpha: 0, duration: 500, ease: "Linear", onComplete: next,
        });
      },
    ], () => { p2.gfx.destroy(); resetV(); onDone(); });
  });

  // ── Animation 29: Synchronized Spin ───────────────────────────────
  // Both title Vs spin their directions in perfect sync
  easterEggs.push((onDone) => {
    const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
    let step = 0;
    let delay = 300;
    const spin = (): void => {
      const dir = dirs[step % 4];
      drawVFacing(dir);
      drawRightVFacing(dir);
      step++;
      if (step >= 16) {
        scene.time.delayedCall(200, () => {
          resetV();
          fillV(rightVGfx, staticRightColor, d, e, f);
          onDone();
        });
        return;
      }
      delay = Math.max(50, delay * 0.88);
      scene.time.delayedCall(delay, spin);
    };
    spin();
  });

  // ── Animation 30: Tug of War ──────────────────────────────────────
  // Both title Vs pull a ball back and forth between them
  easterEggs.push((onDone) => {
    const midX = (vCenterPt.x + rightVCenterPt.x) / 2;
    const ball = scene.add.circle(midX, vCenterPt.y, ballRadius, BALL_COLOR);
    const pullRange = vWidth * 0.3;
    chainSteps([
      (next) => {
        drawVFacing(DIR_RIGHT);
        drawRightVFacing(DIR_LEFT);
        scene.time.delayedCall(400, next);
      },
      (next) => {
        scene.tweens.add({
          targets: ball, x: midX - pullRange, duration: 400, ease: "Quad.easeOut",
          onComplete: next,
        });
      },
      (next) => {
        scene.tweens.add({
          targets: ball, x: midX + pullRange, duration: 400, ease: "Quad.easeOut",
          onComplete: next,
        });
      },
      (next) => {
        scene.tweens.add({
          targets: ball, x: midX - pullRange * 1.5, duration: 350, ease: "Quad.easeOut",
          onComplete: next,
        });
      },
      (next) => {
        scene.tweens.add({
          targets: ball, x: midX + pullRange * 2, duration: 350, ease: "Quad.easeIn",
          onComplete: next,
        });
      },
      (next) => {
        drawRightVFacing(DIR_RIGHT);
        showHighlight();
        scene.tweens.add({
          targets: ball, x: vCenterPt.x, duration: 300, ease: "Quad.easeIn",
          onComplete: () => { ball.setVisible(false); next(); },
        });
      },
      (next) => scene.time.delayedCall(500, next),
    ], () => {
      ball.destroy();
      hideHighlight();
      resetV();
      fillV(rightVGfx, staticRightColor, d, e, f);
      onDone();
    });
  });

  // ── Animation 31: Pendulum ────────────────────────────────────────
  // V swings side to side like a pendulum, arc decaying until it settles
  easterEggs.push((onDone) => {
    const swings = 8;
    let amplitude = charW * 3;
    let si = 0;
    const doSwing = (): void => {
      if (si >= swings) {
        resetV();
        onDone();
        return;
      }
      const targetX = (si % 2 === 0 ? amplitude : -amplitude);
      drawVFacing(targetX > 0 ? DIR_RIGHT : DIR_LEFT);
      scene.tweens.add({
        targets: leftVGfx, x: targetX, duration: 300, ease: "Sine.easeInOut",
        onComplete: () => {
          amplitude *= 0.7;
          si++;
          doSwing();
        },
      });
    };
    doSwing();
  });

  // ── Animation 32: Earthquake ──────────────────────────────────────
  // Both title Vs shake violently, fall off bottom, bounce back into place
  easterEggs.push((onDone) => {
    let shakeCount = 0;
    const shakeEvent = scene.time.addEvent({
      delay: 40,
      loop: true,
      callback: () => {
        const dx = (shakeCount % 2 === 0 ? 3 : -3);
        leftVGfx.x = dx;
        rightVGfx.x = -dx;
        shakeCount++;
      },
    });
    scene.time.delayedCall(1200, () => {
      shakeEvent.destroy();
      leftVGfx.x = 0;
      rightVGfx.x = 0;
      drawVFacing(DIR_DOWN);
      drawRightVFacing(DIR_DOWN);
      const fallDist = height + 100;
      scene.tweens.add({
        targets: leftVGfx, y: fallDist, duration: 500, ease: "Quad.easeIn",
      });
      scene.tweens.add({
        targets: rightVGfx, y: fallDist, duration: 500, ease: "Quad.easeIn",
        onComplete: () => {
          leftVGfx.y = -fallDist;
          rightVGfx.y = -fallDist;
          drawVFacing(DIR_DOWN);
          drawRightVFacing(DIR_DOWN);
          scene.tweens.add({
            targets: leftVGfx, y: 0, duration: 1500, ease: "Bounce.easeOut",
          });
          scene.tweens.add({
            targets: rightVGfx, y: 0, duration: 1500, ease: "Bounce.easeOut",
            onComplete: () => {
              resetV();
              rightVGfx.x = 0;
              rightVGfx.y = 0;
              fillV(rightVGfx, staticRightColor, d, e, f);
              onDone();
            },
          });
        },
      });
    });
  });

  // ── Animation 33: Figure-8 ──────────────────────────────────────
  easterEggs.push((onDone) => {
    const tracker = { t: 0 };
    const rx = charW * 2.5, ry = charW * 1.5;
    scene.tweens.add({
      targets: tracker, t: Math.PI * 2, duration: 3500, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = rx * Math.sin(tracker.t);
        leftVGfx.y = ry * Math.sin(tracker.t * 2);
      },
      onComplete: () => { resetV(); onDone(); },
    });
  });

  // ── Animation 34: Tornado ────────────────────────────────────────
  easterEggs.push((onDone) => {
    const tracker = { t: 0 };
    const maxR = charW * 2;
    const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
    scene.tweens.add({
      targets: tracker, t: 1, duration: 2500, ease: "Linear",
      onUpdate: () => {
        const angle = tracker.t * Math.PI * 8;
        leftVGfx.x = Math.cos(angle) * maxR * (1 - tracker.t * 0.5);
        leftVGfx.y = -tracker.t * (height + 100);
        drawVFacing(dirs[Math.floor(tracker.t * 32) % 4]);
      },
      onComplete: () => {
        leftVGfx.y = -(height + 100);
        scene.tweens.add({
          targets: leftVGfx, y: 0, x: 0, duration: 800, ease: "Bounce.easeOut",
          onComplete: () => { resetV(); onDone(); },
        });
      },
    });
  });

  // ── Animation 35: Slingshot ──────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_LEFT);
    chainSteps([
      (next) => scene.tweens.add({ targets: leftVGfx, x: -3 * charW, duration: 600, ease: "Quad.easeOut", onComplete: next }),
      (next) => scene.time.delayedCall(300, next),
      (next) => {
        drawVFacing(DIR_RIGHT);
        scene.tweens.add({
          targets: leftVGfx, x: screenW + 50, duration: 300, ease: "Quad.easeIn",
          onComplete: () => {
            leftVGfx.x = -(wLeft + vWidth + 50);
            scene.tweens.add({ targets: leftVGfx, x: 0, duration: 600, ease: "Quad.easeOut", onComplete: next });
          },
        });
      },
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 36: Boomerang ──────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    blinkToggleFly(() => {
      const tracker = { t: 0 };
      const dist = 6 * charW;
      scene.tweens.add({
        targets: tracker, t: Math.PI * 2, duration: 2500, ease: "Linear",
        onUpdate: () => {
          leftVGfx.x = dist * (1 - Math.cos(tracker.t)) / 2;
          leftVGfx.y = -dist * Math.sin(tracker.t) / 2;
        },
        onComplete: () => { resetV(); onDone(); },
      });
    });
  });

  // ── Animation 37: Pong ───────────────────────────────────────────
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(vCenterPt.x + vWidth, vCenterPt.y, ballRadius, BALL_COLOR);
    let bvx = 2.5, bvy = 1.5, bounces = 0;
    const lWall = vCenterPt.x - charW, rWall = rightVCenterPt.x + charW;
    const tickEv = scene.time.addEvent({
      delay: 16, loop: true,
      callback: () => {
        ball.x += bvx; ball.y += bvy;
        if (ball.y < vCenterPt.y - charW * 2 || ball.y > vCenterPt.y + charW * 2) bvy = -bvy;
        if (ball.x <= lWall) { bvx = Math.abs(bvx); bounces++; leftVGfx.y = ball.y - vCenterPt.y; }
        if (ball.x >= rWall) { bvx = -Math.abs(bvx); bounces++; rightVGfx.y = ball.y - rightVCenterPt.y; }
        if (bounces >= 8) {
          tickEv.destroy(); ball.destroy();
          leftVGfx.y = 0; rightVGfx.y = 0;
          resetV(); fillV(rightVGfx, staticRightColor, d, e, f); onDone();
        }
      },
    });
  });

  // ── Animation 38: Snake ──────────────────────────────────────────
  easterEggs.push((onDone) => {
    const path = [
      { x: charW, y: 0 }, { x: 2 * charW, y: 0 }, { x: 2 * charW, y: charW },
      { x: 2 * charW, y: 2 * charW }, { x: charW, y: 2 * charW }, { x: 0, y: 2 * charW },
      { x: 0, y: charW }, { x: 0, y: 0 },
    ];
    const dirs = [DIR_RIGHT, DIR_RIGHT, DIR_DOWN, DIR_DOWN, DIR_LEFT, DIR_LEFT, DIR_UP, DIR_UP];
    const tail: Phaser.GameObjects.Arc[] = [];
    let pi = 0;
    const step = (): void => {
      if (pi >= path.length) {
        tail.forEach((t) => scene.tweens.add({ targets: t, alpha: 0, duration: 400 }));
        scene.time.delayedCall(500, () => { tail.forEach((t) => t.destroy()); resetV(); onDone(); });
        return;
      }
      tail.push(scene.add.circle(vCenterPt.x + leftVGfx.x, vCenterPt.y + leftVGfx.y, fontPx * 0.08, staticLeftColor).setAlpha(0.5));
      leftVGfx.x = path[pi].x; leftVGfx.y = path[pi].y;
      drawVFacing(dirs[pi]); pi++;
      scene.time.delayedCall(250, step);
    };
    step();
  });

  // ── Animation 39: Frogger ────────────────────────────────────────
  easterEggs.push((onDone) => {
    const hazards: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 3; i++) {
      const hz = scene.add.circle(-30 - i * charW * 3, vCenterPt.y + charW * (i - 1), fontPx * 0.1, 0xff3333);
      hazards.push(hz);
      scene.tweens.add({ targets: hz, x: screenW + 30, duration: 2000 + i * 500, ease: "Linear", repeat: -1 });
    }
    drawVFacing(DIR_UP);
    chainSteps([
      (next) => scene.time.delayedCall(500, () => { leftVGfx.y = charW; next(); }),
      (next) => scene.time.delayedCall(600, () => { leftVGfx.y = 0; next(); }),
      (next) => scene.time.delayedCall(400, () => { leftVGfx.y = -charW; next(); }),
      (next) => scene.time.delayedCall(500, () => { leftVGfx.y = -2 * charW; next(); }),
      (next) => scene.time.delayedCall(600, () => { leftVGfx.y = 0; drawVFacing(DIR_DOWN); next(); }),
    ], () => { hazards.forEach((h) => { scene.tweens.killTweensOf(h); h.destroy(); }); resetV(); onDone(); });
  });

  // ── Animation 40: Chess Knight ───────────────────────────────────
  easterEggs.push((onDone) => {
    const moves = [
      { x: charW, y: -2 * charW }, { x: 3 * charW, y: -charW },
      { x: 2 * charW, y: charW }, { x: 0, y: 0 },
    ];
    let ki = 0;
    const doMove = (): void => {
      if (ki >= moves.length) { resetV(); onDone(); return; }
      drawVFacing(DIR_UP);
      scene.tweens.add({
        targets: leftVGfx, y: leftVGfx.y - charW, duration: 150, ease: "Quad.easeOut",
        onComplete: () => {
          leftVGfx.x = moves[ki].x;
          scene.tweens.add({
            targets: leftVGfx, y: moves[ki].y, duration: 150, ease: "Quad.easeIn",
            onComplete: () => { drawVFacing(DIR_DOWN); ki++; scene.time.delayedCall(300, doMove); },
          });
        },
      });
    };
    doMove();
  });

  // ── Animation 41: Moonwalk ───────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    scene.tweens.add({
      targets: leftVGfx, x: -4 * charW, duration: 2500, ease: "Linear",
      onComplete: () => {
        drawVFacing(DIR_LEFT);
        scene.tweens.add({
          targets: leftVGfx, x: 0, duration: 800, ease: "Linear",
          onComplete: () => { resetV(); onDone(); },
        });
      },
    });
  });

  // ── Animation 42: Curious ────────────────────────────────────────
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(vCenterPt.x + 3 * charW, vCenterPt.y, ballRadius, BALL_COLOR);
    chainSteps([
      (next) => { drawVFacing(DIR_RIGHT); scene.time.delayedCall(400, next); },
      (next) => { leftVGfx.x = charW; scene.time.delayedCall(STEP_PAUSE_MS, next); },
      (next) => { leftVGfx.x = 2 * charW; scene.time.delayedCall(STEP_PAUSE_MS, next); },
      (next) => { drawVFacing(DIR_DOWN); leftVGfx.y = charW; leftVGfx.x = 3 * charW; scene.time.delayedCall(STEP_PAUSE_MS, next); },
      (next) => { drawVFacing(DIR_UP); leftVGfx.y = -charW; scene.time.delayedCall(STEP_PAUSE_MS, next); },
      (next) => { drawVFacing(DIR_LEFT); leftVGfx.x = 4 * charW; leftVGfx.y = 0; scene.time.delayedCall(STEP_PAUSE_MS, next); },
    ], () => { ball.destroy(); resetV(); onDone(); });
  });

  // ── Animation 43: Falling Leaf ───────────────────────────────────
  easterEggs.push((onDone) => {
    leftVGfx.y = -(height * 0.3);
    const tracker = { t: 0 };
    const dirs = [DIR_LEFT, DIR_RIGHT];
    scene.tweens.add({
      targets: tracker, t: 1, duration: 3000, ease: "Linear",
      onUpdate: () => {
        leftVGfx.y = -(height * 0.3) * (1 - tracker.t);
        leftVGfx.x = Math.sin(tracker.t * Math.PI * 5) * charW * 1.5;
        drawVFacing(dirs[Math.floor(tracker.t * 10) % 2]);
      },
      onComplete: () => { resetV(); onDone(); },
    });
  });

  // ── Animation 44: Lightning Strike ───────────────────────────────
  easterEggs.push((onDone) => {
    leftVGfx.visible = false;
    const flash = scene.add.graphics();
    flash.fillStyle(0xffffff, 0.8);
    flash.fillRect(0, 0, screenW, height);
    scene.time.delayedCall(100, () => {
      flash.destroy();
      leftVGfx.visible = true;
      drawVFacing(DIR_DOWN);
      leftVGfx.y = -(height + 50);
      scene.tweens.add({
        targets: leftVGfx, y: 0, duration: 200, ease: "Quad.easeIn",
        onComplete: () => {
          scene.tweens.add({
            targets: leftVGfx, y: -charW * 0.5, duration: 100, ease: "Quad.easeOut",
            onComplete: () => scene.tweens.add({
              targets: leftVGfx, y: 0, duration: 100, ease: "Quad.easeIn",
              onComplete: () => { resetV(); onDone(); },
            }),
          });
        },
      });
    });
  });

  // ── Animation 45: Breakdance ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
    let step = 0;
    const radius = charW;
    const ev = scene.time.addEvent({
      delay: 80, loop: true,
      callback: () => {
        drawVFacing(dirs[step % 4]);
        const ang = (step / 16) * Math.PI * 2;
        leftVGfx.x = Math.cos(ang) * radius;
        leftVGfx.y = Math.sin(ang) * radius;
        step++;
        if (step >= 32) { ev.destroy(); resetV(); onDone(); }
      },
    });
  });

  // ── Animation 46: Waltz ──────────────────────────────────────────
  easterEggs.push((onDone) => {
    const cx = (vCenterPt.x + rightVCenterPt.x) / 2;
    const radius = vWidth * 0.6;
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: Math.PI * 2, duration: 3500, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = cx + Math.cos(tracker.t) * radius - vCenterPt.x;
        leftVGfx.y = Math.sin(tracker.t) * radius * 0.4;
        rightVGfx.x = cx + Math.cos(tracker.t + Math.PI) * radius - rightVCenterPt.x;
        rightVGfx.y = Math.sin(tracker.t + Math.PI) * radius * 0.4;
      },
      onComplete: () => {
        resetV(); rightVGfx.x = 0; rightVGfx.y = 0;
        fillV(rightVGfx, staticRightColor, d, e, f); onDone();
      },
    });
  });

  // ── Animation 47: Mexican Wave ───────────────────────────────────
  easterEggs.push((onDone) => {
    const extras = [createExtraV(PLAYER_2_COLOR), createExtraV(0x00ccff), createExtraV(0xff8800)];
    extras[0].gfx.x = 2 * charW; extras[0].draw(DIR_DOWN);
    extras[1].gfx.x = 4 * charW; extras[1].draw(DIR_DOWN);
    extras[2].gfx.x = 6 * charW; extras[2].draw(DIR_DOWN);
    const all = [leftVGfx, extras[0].gfx, extras[1].gfx, extras[2].gfx];
    let wi = 0;
    const doWave = (): void => {
      if (wi >= all.length * 2) { extras.forEach((x) => x.gfx.destroy()); resetV(); onDone(); return; }
      const gfx = all[wi % all.length];
      scene.tweens.add({
        targets: gfx, y: -charW, duration: 150, ease: "Quad.easeOut",
        onComplete: () => scene.tweens.add({ targets: gfx, y: 0, duration: 150, ease: "Quad.easeIn" }),
      });
      wi++;
      scene.time.delayedCall(200, doWave);
    };
    doWave();
  });

  // ── Animation 48: Color Cycle ────────────────────────────────────
  easterEggs.push((onDone) => {
    const colors = [0xff0000, 0xff8800, 0xffff00, 0x00ff00, 0x00ccff, 0x0000ff, 0xff00ff, staticLeftColor];
    let ci = 0;
    const ev = scene.time.addEvent({
      delay: 300, loop: true,
      callback: () => {
        drawVFacing(DIR_DOWN, colors[ci]); ci++;
        if (ci >= colors.length) { ev.destroy(); resetV(); onDone(); }
      },
    });
  });

  // ── Animation 49: Heartbeat ──────────────────────────────────────
  easterEggs.push((onDone) => {
    const proxy = { s: 1 };
    const apply = (): void => {
      leftVGfx.setScale(proxy.s);
      leftVGfx.x = vCenterPt.x * (1 - proxy.s);
      leftVGfx.y = vCenterPt.y * (1 - proxy.s);
    };
    let beats = 0;
    const doBeat = (): void => {
      if (beats >= 4) { resetV(); onDone(); return; }
      scene.tweens.add({
        targets: proxy, s: 1.4, duration: 100, ease: "Quad.easeOut", onUpdate: apply,
        onComplete: () => scene.tweens.add({
          targets: proxy, s: 1, duration: 100, ease: "Quad.easeIn", onUpdate: apply,
          onComplete: () => scene.tweens.add({
            targets: proxy, s: 1.25, duration: 80, ease: "Quad.easeOut", onUpdate: apply,
            onComplete: () => scene.tweens.add({
              targets: proxy, s: 1, duration: 200, ease: "Quad.easeIn", onUpdate: apply,
              onComplete: () => { beats++; scene.time.delayedCall(400, doBeat); },
            }),
          }),
        }),
      });
    };
    doBeat();
  });

  // ── Animation 50: Fireworks ──────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_UP);
    scene.tweens.add({
      targets: leftVGfx, y: -(height * 0.4), duration: 600, ease: "Quad.easeOut",
      onComplete: () => {
        leftVGfx.visible = false;
        const cx = vCenterPt.x, cy = vCenterPt.y + leftVGfx.y;
        const sparks: Phaser.GameObjects.Arc[] = [];
        const cols = [0xff0000, 0xffff00, 0x00ff00, 0x00ccff, 0xff00ff, 0xff8800, 0xffffff, staticLeftColor];
        for (let i = 0; i < 12; i++) {
          const ang = (i / 12) * Math.PI * 2;
          const p = scene.add.circle(cx, cy, fontPx * 0.05, cols[i % cols.length]);
          sparks.push(p);
          scene.tweens.add({
            targets: p, x: cx + Math.cos(ang) * charW * 3, y: cy + Math.sin(ang) * charW * 3, alpha: 0,
            duration: 800, ease: "Quad.easeOut",
          });
        }
        scene.time.delayedCall(900, () => { sparks.forEach((s) => s.destroy()); resetV(); onDone(); });
      },
    });
  });

  // ── Animation 51: Both Vs Swap ───────────────────────────────────
  easterEggs.push((onDone) => {
    const dx = rightVCenterPt.x - vCenterPt.x;
    drawVFacing(DIR_RIGHT); drawRightVFacing(DIR_LEFT);
    scene.tweens.add({ targets: leftVGfx, x: dx, y: -charW, duration: 800, ease: "Sine.easeInOut" });
    scene.tweens.add({
      targets: rightVGfx, x: -dx, y: charW, duration: 800, ease: "Sine.easeInOut",
      onComplete: () => {
        scene.time.delayedCall(400, () => {
          drawVFacing(DIR_LEFT); drawRightVFacing(DIR_RIGHT);
          scene.tweens.add({ targets: leftVGfx, x: 0, y: 0, duration: 800, ease: "Sine.easeInOut" });
          scene.tweens.add({
            targets: rightVGfx, x: 0, y: 0, duration: 800, ease: "Sine.easeInOut",
            onComplete: () => { resetV(); fillV(rightVGfx, staticRightColor, d, e, f); onDone(); },
          });
        });
      },
    });
  });

  // ── Animation 52: Yo-Yo ──────────────────────────────────────────
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(vCenterPt.x, vCenterPt.y + charW, ballRadius, BALL_COLOR);
    const drops = [charW * 2, charW * 3, charW * 4, charW * 2];
    let di = 0;
    const doDrop = (): void => {
      if (di >= drops.length) { ball.destroy(); resetV(); onDone(); return; }
      scene.tweens.add({
        targets: ball, y: vCenterPt.y + drops[di], duration: 300, ease: "Quad.easeIn",
        onComplete: () => scene.tweens.add({
          targets: ball, y: vCenterPt.y + charW, duration: 300, ease: "Quad.easeOut",
          onComplete: () => { di++; scene.time.delayedCall(100, doDrop); },
        }),
      });
    };
    doDrop();
  });

  // ── Animation 53: Seesaw ─────────────────────────────────────────
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    p2.gfx.x = 4 * charW; p2.draw(DIR_DOWN); drawVFacing(DIR_DOWN);
    let tilt = 0;
    const doTilt = (): void => {
      if (tilt >= 6) { p2.gfx.destroy(); resetV(); onDone(); return; }
      const p1Up = tilt % 2 === 0;
      scene.tweens.add({ targets: leftVGfx, y: p1Up ? -charW : charW, duration: 400, ease: "Sine.easeInOut" });
      scene.tweens.add({
        targets: p2.gfx, y: p1Up ? charW : -charW, duration: 400, ease: "Sine.easeInOut",
        onComplete: () => { tilt++; scene.time.delayedCall(200, doTilt); },
      });
    };
    doTilt();
  });

  // ── Animation 54: Jump Rope ──────────────────────────────────────
  easterEggs.push((onDone) => {
    const h1 = createExtraV(PLAYER_2_COLOR);
    const h2 = createExtraV(0x00ccff);
    h1.gfx.x = -2 * charW; h1.draw(DIR_RIGHT);
    h2.gfx.x = 2 * charW; h2.draw(DIR_LEFT);
    drawVFacing(DIR_DOWN);
    let jumps = 0;
    const doJump = (): void => {
      if (jumps >= 6) { h1.gfx.destroy(); h2.gfx.destroy(); resetV(); onDone(); return; }
      scene.tweens.add({
        targets: leftVGfx, y: -charW, duration: 200, ease: "Quad.easeOut",
        onComplete: () => scene.tweens.add({
          targets: leftVGfx, y: 0, duration: 200, ease: "Quad.easeIn",
          onComplete: () => { jumps++; scene.time.delayedCall(150, doJump); },
        }),
      });
    };
    doJump();
  });

  // ── Animation 55: Karate Chop ────────────────────────────────────
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(vCenterPt.x + 2 * charW, vCenterPt.y, ballRadius, BALL_COLOR);
    drawVFacing(DIR_RIGHT);
    chainSteps([
      (next) => scene.tweens.add({ targets: leftVGfx, x: charW, duration: 300, ease: "Linear", onComplete: next }),
      (next) => scene.time.delayedCall(400, next),
      (next) => {
        leftVGfx.x = 1.5 * charW; ball.setVisible(false);
        const h1 = scene.add.circle(ball.x, ball.y, ballRadius * 0.7, BALL_COLOR);
        const h2 = scene.add.circle(ball.x, ball.y, ballRadius * 0.7, BALL_COLOR);
        scene.tweens.add({ targets: h1, x: ball.x - charW * 2, y: ball.y - charW, alpha: 0, duration: 600, ease: "Quad.easeOut" });
        scene.tweens.add({
          targets: h2, x: ball.x + charW * 2, y: ball.y + charW, alpha: 0, duration: 600, ease: "Quad.easeOut",
          onComplete: () => { h1.destroy(); h2.destroy(); next(); },
        });
      },
    ], () => { ball.destroy(); resetV(); onDone(); });
  });

  // ── Animation 56: Parachute ──────────────────────────────────────
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(vCenterPt.x, vCenterPt.y - charW * 2.5, ballRadius * 1.5, BALL_COLOR);
    drawVFacing(DIR_DOWN);
    leftVGfx.y = -(height * 0.5);
    ball.y = vCenterPt.y - charW * 2.5 + leftVGfx.y;
    scene.tweens.add({ targets: leftVGfx, y: 0, duration: 3000, ease: "Cubic.easeOut" });
    scene.tweens.add({
      targets: ball, y: vCenterPt.y - charW * 2.5, duration: 3000, ease: "Cubic.easeOut",
      onComplete: () => scene.tweens.add({
        targets: ball, alpha: 0, duration: 400,
        onComplete: () => { ball.destroy(); resetV(); onDone(); },
      }),
    });
  });

  // ── Animation 57: Shy Peek ───────────────────────────────────────
  easterEggs.push((onDone) => {
    const offL = -(wLeft + vWidth + 50);
    leftVGfx.x = offL; drawVFacing(DIR_RIGHT);
    chainSteps([
      (next) => scene.tweens.add({ targets: leftVGfx, x: offL + charW * 0.5, duration: 800, ease: "Quad.easeOut", onComplete: next }),
      (next) => scene.time.delayedCall(500, next),
      (next) => scene.tweens.add({ targets: leftVGfx, x: offL, duration: 200, ease: "Quad.easeIn", onComplete: next }),
      (next) => scene.time.delayedCall(600, next),
      (next) => scene.tweens.add({ targets: leftVGfx, x: offL + charW, duration: 600, ease: "Quad.easeOut", onComplete: next }),
      (next) => scene.time.delayedCall(300, next),
      (next) => scene.tweens.add({ targets: leftVGfx, x: 0, duration: 400, ease: "Back.easeOut", onComplete: next }),
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 58: Angry Stomp ────────────────────────────────────
  easterEggs.push((onDone) => {
    let stomps = 0;
    const doStomp = (): void => {
      if (stomps >= 8) { resetV(); onDone(); return; }
      drawVFacing(stomps % 2 === 0 ? DIR_DOWN : DIR_UP);
      scene.tweens.add({
        targets: leftVGfx, y: fontPx * 0.08, duration: 60, ease: "Quad.easeIn",
        onComplete: () => scene.tweens.add({
          targets: leftVGfx, y: 0, duration: 60, ease: "Quad.easeOut",
          onComplete: () => { stomps++; scene.time.delayedCall(80, doStomp); },
        }),
      });
    };
    doStomp();
  });

  // ── Animation 59: Sleepy Nod ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const proxy = { angle: 0 };
    const applyRot = (): void => { drawVFacing((proxy.angle * Math.PI) / 180); };
    chainSteps([
      (next) => scene.tweens.add({ targets: proxy, angle: 15, duration: 800, ease: "Sine.easeInOut", onUpdate: applyRot, onComplete: next }),
      (next) => scene.tweens.add({ targets: proxy, angle: 0, duration: 300, ease: "Back.easeOut", onUpdate: applyRot, onComplete: next }),
      (next) => scene.time.delayedCall(500, next),
      (next) => scene.tweens.add({ targets: proxy, angle: 20, duration: 1000, ease: "Sine.easeInOut", onUpdate: applyRot, onComplete: next }),
      (next) => scene.tweens.add({ targets: proxy, angle: 0, duration: 200, ease: "Back.easeOut", onUpdate: applyRot, onComplete: next }),
      (next) => scene.tweens.add({ targets: proxy, angle: 45, duration: 1200, ease: "Sine.easeIn", onUpdate: applyRot, onComplete: next }),
      (next) => scene.tweens.add({
        targets: leftVGfx, y: height + 50, duration: 600, ease: "Quad.easeIn",
        onComplete: () => {
          proxy.angle = 0; leftVGfx.y = -(height + 50);
          scene.tweens.add({ targets: leftVGfx, y: 0, duration: 400, ease: "Quad.easeOut", onComplete: next });
        },
      }),
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 60: Confetti Burst ─────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_UP);
    scene.tweens.add({
      targets: leftVGfx, y: -charW, duration: 200, ease: "Quad.easeOut",
      onComplete: () => {
        const confetti: Phaser.GameObjects.Arc[] = [];
        const cols = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ccff, 0xff8800, 0xffffff];
        for (let i = 0; i < 16; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = charW * (2 + Math.random() * 3);
          const p = scene.add.circle(vCenterPt.x, vCenterPt.y - charW, fontPx * 0.04, cols[i % cols.length]);
          confetti.push(p);
          scene.tweens.add({
            targets: p, x: vCenterPt.x + Math.cos(ang) * dist, y: vCenterPt.y - charW + Math.sin(ang) * dist,
            alpha: 0, duration: 800 + Math.random() * 400, ease: "Quad.easeOut",
          });
        }
        scene.tweens.add({
          targets: leftVGfx, y: 0, duration: 300, ease: "Quad.easeIn",
          onComplete: () => scene.time.delayedCall(600, () => { confetti.forEach((c) => c.destroy()); resetV(); onDone(); }),
        });
      },
    });
  });

  // ── Animation 61: Typewriter ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const typed: Phaser.GameObjects.Arc[] = [];
    let ti = 0;
    drawVFacing(DIR_RIGHT);
    const typeStep = (): void => {
      if (ti >= 7) {
        scene.time.delayedCall(300, () => { typed.forEach((t) => t.destroy()); resetV(); onDone(); });
        return;
      }
      typed.push(scene.add.circle(vCenterPt.x + ti * charW * 0.6, vCenterPt.y + charW, fontPx * 0.05, BALL_COLOR));
      leftVGfx.x = (ti + 1) * charW * 0.6; ti++;
      scene.time.delayedCall(200, typeStep);
    };
    typeStep();
  });

  // ── Animation 62: Domino Chain ───────────────────────────────────
  easterEggs.push((onDone) => {
    const doms = [createExtraV(PLAYER_2_COLOR), createExtraV(0x00ccff), createExtraV(0xff8800)];
    doms[0].gfx.x = 2 * charW; doms[0].draw(DIR_DOWN);
    doms[1].gfx.x = 4 * charW; doms[1].draw(DIR_DOWN);
    doms[2].gfx.x = 6 * charW; doms[2].draw(DIR_DOWN);
    drawVFacing(DIR_RIGHT);
    chainSteps([
      (next) => scene.tweens.add({ targets: leftVGfx, x: charW, duration: 300, ease: "Quad.easeIn", onComplete: () => { drawVFacing(DIR_RIGHT); next(); } }),
      (next) => scene.time.delayedCall(150, () => { doms[0].draw(DIR_RIGHT); next(); }),
      (next) => scene.time.delayedCall(150, () => { doms[1].draw(DIR_RIGHT); next(); }),
      (next) => scene.time.delayedCall(150, () => { doms[2].draw(DIR_RIGHT); next(); }),
      (next) => scene.time.delayedCall(500, next),
      (next) => {
        drawVFacing(DIR_DOWN); leftVGfx.x = 0;
        doms.forEach((dm) => dm.draw(DIR_DOWN));
        scene.time.delayedCall(400, next);
      },
    ], () => { doms.forEach((dm) => dm.gfx.destroy()); resetV(); onDone(); });
  });

  // ── Animation 63: Elevator ───────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_UP);
    chainSteps([
      (next) => scene.tweens.add({ targets: leftVGfx, y: -(height * 0.3), duration: 1000, ease: "Sine.easeInOut", onComplete: next }),
      (next) => scene.time.delayedCall(500, next),
      (next) => { drawVFacing(DIR_RIGHT); leftVGfx.x = 2 * charW; scene.time.delayedCall(STEP_PAUSE_MS, next); },
      (next) => { drawVFacing(DIR_LEFT); leftVGfx.x = 0; scene.time.delayedCall(STEP_PAUSE_MS, next); },
      (next) => { drawVFacing(DIR_DOWN); scene.tweens.add({ targets: leftVGfx, y: 0, duration: 1000, ease: "Sine.easeInOut", onComplete: next }); },
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 64: Fishing ────────────────────────────────────────
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(vCenterPt.x + charW, vCenterPt.y + charW, ballRadius, BALL_COLOR).setVisible(false);
    drawVFacing(DIR_DOWN);
    chainSteps([
      (next) => { ball.setVisible(true); scene.tweens.add({ targets: ball, y: vCenterPt.y + 4 * charW, duration: 500, ease: "Quad.easeOut", onComplete: next }); },
      (next) => scene.time.delayedCall(1200, next),
      (next) => scene.tweens.add({
        targets: ball, y: vCenterPt.y + 2 * charW, duration: 100, ease: "Quad.easeOut",
        onComplete: () => scene.tweens.add({ targets: ball, y: vCenterPt.y + 4 * charW, duration: 100, ease: "Quad.easeIn", onComplete: next }),
      }),
      (next) => { drawVFacing(DIR_UP); scene.tweens.add({ targets: ball, y: vCenterPt.y + charW, duration: 600, ease: "Quad.easeOut", onComplete: next }); },
      (next) => { showHighlight(); ball.setVisible(false); scene.time.delayedCall(500, next); },
    ], () => { ball.destroy(); hideHighlight(); resetV(); onDone(); });
  });

  // ── Animation 65: Disco ──────────────────────────────────────────
  easterEggs.push((onDone) => {
    const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
    const dcols = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff];
    const lights: Phaser.GameObjects.Arc[] = [];
    for (let i = 0; i < 8; i++) {
      lights.push(scene.add.circle(
        vCenterPt.x + (Math.random() - 0.5) * charW * 6,
        vCenterPt.y + (Math.random() - 0.5) * charW * 4,
        fontPx * 0.06, dcols[i % dcols.length],
      ).setAlpha(0));
    }
    let beat = 0;
    const doBeat = (): void => {
      if (beat >= 12) { lights.forEach((l) => l.destroy()); resetV(); onDone(); return; }
      drawVFacing(dirs[beat % 4], dcols[beat % dcols.length]);
      lights.forEach((l) => l.setAlpha(Math.random() > 0.5 ? 0.7 : 0));
      beat++; scene.time.delayedCall(250, doBeat);
    };
    doBeat();
  });

  // ── Animation 66: Orbit Swap ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const tracker = { t: 0 };
    const radius = vWidth * 0.4;
    scene.tweens.add({
      targets: tracker, t: Math.PI * 2, duration: 2000, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = rightVCenterPt.x - vCenterPt.x + Math.cos(tracker.t) * radius;
        leftVGfx.y = Math.sin(tracker.t) * radius * 0.5;
      },
      onComplete: () => {
        leftVGfx.x = 0; leftVGfx.y = 0;
        const t2 = { t: 0 };
        scene.tweens.add({
          targets: t2, t: Math.PI * 2, duration: 2000, ease: "Linear",
          onUpdate: () => {
            rightVGfx.x = vCenterPt.x - rightVCenterPt.x + Math.cos(t2.t) * radius;
            rightVGfx.y = Math.sin(t2.t) * radius * 0.5;
          },
          onComplete: () => {
            resetV(); rightVGfx.x = 0; rightVGfx.y = 0;
            fillV(rightVGfx, staticRightColor, d, e, f); onDone();
          },
        });
      },
    });
  });

  // ── Animation 67: Ping Pong Rally ────────────────────────────────
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    const sep = 6 * charW;
    p2.gfx.x = sep; p2.draw(DIR_LEFT); drawVFacing(DIR_RIGHT);
    const ball = scene.add.circle(vCenterPt.x, vCenterPt.y, ballRadius, BALL_COLOR);
    let hits = 0, speed = 600;
    const rally = (): void => {
      if (hits >= 8) {
        scene.tweens.add({
          targets: ball, x: screenW + 50, duration: 300, ease: "Linear",
          onComplete: () => { ball.destroy(); p2.gfx.destroy(); resetV(); onDone(); },
        });
        return;
      }
      const toRight = hits % 2 === 0;
      ball.x = toRight ? vCenterPt.x : vCenterPt.x + sep;
      scene.tweens.add({
        targets: ball, x: toRight ? vCenterPt.x + sep : vCenterPt.x, duration: speed, ease: "Linear",
        onComplete: () => { hits++; speed = Math.max(150, speed - 60); rally(); },
      });
    };
    rally();
  });

  // ── Animation 68: Hurdle Race ────────────────────────────────────
  easterEggs.push((onDone) => {
    const hurdles: Phaser.GameObjects.Graphics[] = [];
    for (let i = 0; i < 3; i++) {
      const h = scene.add.graphics();
      h.fillStyle(0xffffff, 0.6);
      h.fillRect(vCenterPt.x + (i + 1) * 2 * charW, vCenterPt.y + charW * 0.3, charW * 0.3, charW * 0.5);
      hurdles.push(h);
    }
    drawVFacing(DIR_RIGHT);
    let hi = 0;
    const doHurdle = (): void => {
      if (hi >= 3) {
        hurdles.forEach((h) => h.destroy());
        drawVFacing(DIR_LEFT);
        scene.tweens.add({ targets: leftVGfx, x: 0, duration: 500, ease: "Linear", onComplete: () => { resetV(); onDone(); } });
        return;
      }
      const tx = (hi + 1) * 2 * charW;
      scene.tweens.add({
        targets: leftVGfx, x: tx - charW * 0.5, duration: 300, ease: "Linear",
        onComplete: () => scene.tweens.add({
          targets: leftVGfx, y: -charW, duration: 150, ease: "Quad.easeOut",
          onComplete: () => { leftVGfx.x = tx + charW * 0.5; scene.tweens.add({
            targets: leftVGfx, y: 0, duration: 150, ease: "Quad.easeIn",
            onComplete: () => { hi++; scene.time.delayedCall(100, doHurdle); },
          }); },
        }),
      });
    };
    doHurdle();
  });

  // ── Animation 69: Clone Army ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const clones = [createExtraV(staticLeftColor), createExtraV(staticLeftColor), createExtraV(staticLeftColor)];
    clones[0].gfx.x = charW; clones[0].draw(DIR_DOWN);
    clones[1].gfx.x = -charW; clones[1].draw(DIR_DOWN);
    clones[2].gfx.y = charW; clones[2].draw(DIR_DOWN);
    const dur = 1200;
    chainSteps([
      (next) => {
        drawVFacing(DIR_RIGHT); clones.forEach((c) => c.draw(DIR_RIGHT));
        scene.tweens.add({ targets: leftVGfx, x: 4 * charW, duration: dur, ease: "Linear" });
        scene.tweens.add({ targets: clones[0].gfx, x: 5 * charW, duration: dur, ease: "Linear" });
        scene.tweens.add({ targets: clones[1].gfx, x: 3 * charW, duration: dur, ease: "Linear" });
        scene.tweens.add({ targets: clones[2].gfx, x: 4 * charW, duration: dur, ease: "Linear", onComplete: next });
      },
      (next) => scene.time.delayedCall(300, next),
      (next) => {
        scene.tweens.add({ targets: leftVGfx, x: 0, duration: 600, ease: "Quad.easeIn" });
        scene.tweens.add({ targets: clones[0].gfx, x: 0, alpha: 0, duration: 600, ease: "Quad.easeIn" });
        scene.tweens.add({ targets: clones[1].gfx, x: 0, alpha: 0, duration: 600, ease: "Quad.easeIn" });
        scene.tweens.add({ targets: clones[2].gfx, x: 0, y: 0, alpha: 0, duration: 600, ease: "Quad.easeIn", onComplete: next });
      },
    ], () => { clones.forEach((c) => c.gfx.destroy()); resetV(); onDone(); });
  });

  // ── Animation 70: Tightrope ──────────────────────────────────────
  easterEggs.push((onDone) => {
    const rope = scene.add.graphics();
    rope.lineStyle(1, 0xffffff, 0.4);
    rope.lineBetween(vCenterPt.x - charW, vCenterPt.y + charW, vCenterPt.x + 7 * charW, vCenterPt.y + charW);
    drawVFacing(DIR_RIGHT);
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: 1, duration: 3000, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = tracker.t * 6 * charW;
        leftVGfx.y = Math.sin(tracker.t * Math.PI * 8) * fontPx * 0.12;
      },
      onComplete: () => { rope.destroy(); resetV(); onDone(); },
    });
  });

  // ── Animation 71: Cannon Launch ──────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_UP);
    leftVGfx.y = height + 50; leftVGfx.x = -2 * charW;
    scene.tweens.add({
      targets: leftVGfx, x: 4 * charW, y: -(height * 0.3), duration: 800, ease: "Quad.easeOut",
      onComplete: () => {
        drawVFacing(DIR_DOWN);
        scene.tweens.add({ targets: leftVGfx, x: 0, y: 0, duration: 800, ease: "Bounce.easeOut", onComplete: () => { resetV(); onDone(); } });
      },
    });
  });

  // ── Animation 72: Mirror Vertical ────────────────────────────────
  easterEggs.push((onDone) => {
    const mirror = createExtraV(staticLeftColor);
    mirror.gfx.y = charW * 2; mirror.gfx.setAlpha(0.4); mirror.draw(DIR_UP);
    drawVFacing(DIR_DOWN);
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: 1, duration: 3000, ease: "Linear",
      onUpdate: () => {
        const x = Math.sin(tracker.t * Math.PI * 3) * charW * 2;
        leftVGfx.x = x; mirror.gfx.x = x;
      },
      onComplete: () => { mirror.gfx.destroy(); resetV(); onDone(); },
    });
  });

  // ── Animation 73: Ball Magnet ────────────────────────────────────
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(vCenterPt.x + 3 * charW, vCenterPt.y - 2 * charW, ballRadius, BALL_COLOR);
    const path = [
      { x: 0, y: 0 }, { x: charW, y: 0 }, { x: 2 * charW, y: 0 },
      { x: 2 * charW, y: charW }, { x: charW, y: charW }, { x: 0, y: 0 },
    ];
    let pi = 0;
    const step = (): void => {
      if (pi >= path.length) { ball.destroy(); resetV(); onDone(); return; }
      leftVGfx.x = path[pi].x; leftVGfx.y = path[pi].y;
      drawVFacing(pi < 3 ? DIR_RIGHT : DIR_LEFT);
      scene.tweens.add({
        targets: ball, x: vCenterPt.x + path[pi].x + charW * 0.5, y: vCenterPt.y + path[pi].y - charW,
        duration: 400, ease: "Quad.easeOut",
      });
      pi++; scene.time.delayedCall(350, step);
    };
    step();
  });

  // ── Animation 74: Sumo Push ──────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT); drawRightVFacing(DIR_LEFT);
    const midOff = (rightVCenterPt.x - vCenterPt.x) * 0.3;
    chainSteps([
      (next) => scene.time.delayedCall(500, next),
      (next) => {
        scene.tweens.add({ targets: leftVGfx, x: midOff, duration: 300, ease: "Quad.easeIn" });
        scene.tweens.add({ targets: rightVGfx, x: -midOff, duration: 300, ease: "Quad.easeIn", onComplete: next });
      },
      (next) => scene.time.delayedCall(600, next),
      (next) => {
        scene.tweens.add({ targets: leftVGfx, x: midOff + charW, duration: 200, ease: "Quad.easeIn" });
        scene.tweens.add({
          targets: rightVGfx, x: screenW + 50, duration: 500, ease: "Quad.easeIn",
          onComplete: () => {
            rightVGfx.x = -(wLeft + vWidth + 50);
            scene.tweens.add({ targets: rightVGfx, x: 0, duration: 600, ease: "Quad.easeOut", onComplete: next });
          },
        });
      },
    ], () => {
      resetV(); rightVGfx.x = 0; rightVGfx.y = 0;
      fillV(rightVGfx, staticRightColor, d, e, f); onDone();
    });
  });

  // ── Animation 75: Orbit Formation ────────────────────────────────
  easterEggs.push((onDone) => {
    const orbs = [createExtraV(PLAYER_2_COLOR), createExtraV(0x00ccff), createExtraV(0xff8800)];
    const ball = scene.add.circle(vCenterPt.x + 3 * charW, vCenterPt.y, ballRadius * 1.3, BALL_COLOR);
    const cx = 3 * charW, radius = charW * 2;
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: Math.PI * 2, duration: 3000, ease: "Linear",
      onUpdate: () => {
        for (let i = 0; i < 3; i++) {
          const ang = tracker.t + (i * Math.PI * 2) / 3;
          orbs[i].gfx.x = cx + Math.cos(ang) * radius;
          orbs[i].gfx.y = Math.sin(ang) * radius;
        }
      },
      onComplete: () => { orbs.forEach((o) => o.gfx.destroy()); ball.destroy(); resetV(); onDone(); },
    });
  });

  // ── Animation 76: Shrink Chase ───────────────────────────────────
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    p2.gfx.x = -2 * charW; p2.draw(DIR_RIGHT); drawVFacing(DIR_RIGHT);
    const scales = [0.8, 0.6, 0.4, 0.2];
    let si = 0;
    const step = (): void => {
      if (si >= scales.length) {
        scene.time.delayedCall(300, () => { p2.gfx.destroy(); resetV(); onDone(); });
        return;
      }
      const s = scales[si];
      leftVGfx.setScale(s);
      leftVGfx.x = (si + 1) * charW + vCenterPt.x * (1 - s);
      leftVGfx.y = vCenterPt.y * (1 - s);
      p2.gfx.x = si * charW - charW; si++;
      scene.time.delayedCall(350, step);
    };
    step();
  });

  // ── Animation 77: Reverse Gravity ────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_UP);
    scene.tweens.add({
      targets: leftVGfx, y: -(height + 50), duration: 800, ease: "Quad.easeIn",
      onComplete: () => {
        drawVFacing(DIR_DOWN); leftVGfx.y = height + 50;
        scene.tweens.add({ targets: leftVGfx, y: 0, duration: 800, ease: "Bounce.easeOut", onComplete: () => { resetV(); onDone(); } });
      },
    });
  });

  // ── Animation 78: Conveyor Belt ──────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_LEFT);
    const sd = 3 * charW;
    chainSteps([
      (next) => scene.tweens.add({ targets: leftVGfx, x: sd, duration: 1000, ease: "Linear", onComplete: next }),
      (next) => { drawVFacing(DIR_LEFT); scene.tweens.add({ targets: leftVGfx, x: sd - charW, duration: 400, ease: "Linear", onComplete: next }); },
      (next) => scene.tweens.add({ targets: leftVGfx, x: sd + charW, duration: 800, ease: "Linear", onComplete: next }),
      (next) => {
        drawVFacing(DIR_RIGHT);
        scene.tweens.add({
          targets: leftVGfx, x: screenW + 50, duration: 600, ease: "Quad.easeIn",
          onComplete: () => {
            leftVGfx.x = -(wLeft + vWidth + 50);
            scene.tweens.add({ targets: leftVGfx, x: 0, duration: 500, ease: "Quad.easeOut", onComplete: next });
          },
        });
      },
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 79: Worm Crawl ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const proxy = { sx: 1, sy: 1 };
    const apply = (): void => {
      leftVGfx.setScale(proxy.sx, proxy.sy);
      leftVGfx.y = vCenterPt.y * (1 - proxy.sy);
    };
    let worms = 0;
    const doWorm = (): void => {
      if (worms >= 5) { resetV(); onDone(); return; }
      scene.tweens.add({
        targets: proxy, sx: 0.7, sy: 1.4, duration: 200, onUpdate: apply,
        onComplete: () => {
          leftVGfx.x += charW * 0.5;
          scene.tweens.add({
            targets: proxy, sx: 1.3, sy: 0.7, duration: 200, onUpdate: apply,
            onComplete: () => {
              leftVGfx.x += charW * 0.5;
              scene.tweens.add({
                targets: proxy, sx: 1, sy: 1, duration: 100, onUpdate: apply,
                onComplete: () => { worms++; doWorm(); },
              });
            },
          });
        },
      });
    };
    doWorm();
  });

  // ── Animation 80: Rain Dance ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const drops: Phaser.GameObjects.Arc[] = [];
    const dirs = [DIR_DOWN, DIR_LEFT, DIR_UP, DIR_RIGHT];
    const rainEv = scene.time.addEvent({
      delay: 80, loop: true,
      callback: () => {
        const drop = scene.add.circle(
          vCenterPt.x + (Math.random() - 0.5) * charW * 8,
          vCenterPt.y - height * 0.3, fontPx * 0.03, 0x4488ff,
        );
        drops.push(drop);
        scene.tweens.add({ targets: drop, y: drop.y + height * 0.4, alpha: 0, duration: 600, ease: "Linear", onComplete: () => drop.destroy() });
      },
    });
    let step = 0;
    const danceEv = scene.time.addEvent({
      delay: 200, loop: true,
      callback: () => { drawVFacing(dirs[step % 4]); step++; },
    });
    scene.time.delayedCall(3000, () => {
      rainEv.destroy(); danceEv.destroy();
      drops.forEach((dd) => { if (dd.active) dd.destroy(); });
      resetV(); onDone();
    });
  });

  // ── Animation 81: Simon Pattern ──────────────────────────────────
  easterEggs.push((onDone) => {
    const pat = [DIR_UP, DIR_RIGHT, DIR_DOWN, DIR_LEFT, DIR_UP, DIR_DOWN];
    const cols = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff0000, 0x0000ff];
    let pi = 0;
    const showStep = (): void => {
      if (pi >= pat.length) {
        scene.time.delayedCall(500, () => {
          pi = 0;
          const replay = (): void => {
            if (pi >= pat.length) { resetV(); onDone(); return; }
            drawVFacing(pat[pi], cols[pi]); pi++;
            scene.time.delayedCall(300, replay);
          };
          replay();
        });
        return;
      }
      drawVFacing(pat[pi], cols[pi]); pi++;
      scene.time.delayedCall(500, () => {
        fillV(leftVGfx, staticLeftColor, a, b, c);
        scene.time.delayedCall(200, showStep);
      });
    };
    showStep();
  });

  // ── Animation 82: Glitch ─────────────────────────────────────────
  easterEggs.push((onDone) => {
    const dirs = [DIR_DOWN, DIR_RIGHT, DIR_UP, DIR_LEFT];
    let gc = 0;
    const ev = scene.time.addEvent({
      delay: 50, loop: true,
      callback: () => {
        leftVGfx.x = (Math.random() - 0.5) * charW * 0.8;
        leftVGfx.y = (Math.random() - 0.5) * charW * 0.8;
        drawVFacing(dirs[Math.floor(Math.random() * 4)]);
        leftVGfx.visible = Math.random() > 0.2;
        gc++;
        if (gc >= 40) { ev.destroy(); resetV(); onDone(); }
      },
    });
  });

  // ── Animation 83: Spotlight Search ───────────────────────────────
  easterEggs.push((onDone) => {
    const spot = scene.add.circle(vCenterPt.x + 4 * charW, vCenterPt.y, charW * 1.5, 0xffff88, 0.15);
    drawVFacing(DIR_LEFT);
    chainSteps([
      (next) => scene.tweens.add({ targets: spot, x: vCenterPt.x - 2 * charW, duration: 1200, ease: "Sine.easeInOut", onComplete: next }),
      (next) => { leftVGfx.x = 2 * charW; drawVFacing(DIR_RIGHT); scene.time.delayedCall(200, next); },
      (next) => scene.tweens.add({ targets: spot, x: vCenterPt.x + 3 * charW, duration: 1200, ease: "Sine.easeInOut", onComplete: next }),
      (next) => { leftVGfx.x = -charW; drawVFacing(DIR_LEFT); scene.time.delayedCall(200, next); },
      (next) => scene.tweens.add({ targets: spot, x: vCenterPt.x - charW, duration: 800, ease: "Sine.easeInOut", onComplete: next }),
      (next) => scene.time.delayedCall(500, next),
    ], () => { spot.destroy(); resetV(); onDone(); });
  });

  // ── Animation 84: DNA Helix ──────────────────────────────────────
  easterEggs.push((onDone) => {
    const tracker = { t: 0 };
    const amp = charW;
    scene.tweens.add({
      targets: tracker, t: Math.PI * 4, duration: 3000, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = Math.sin(tracker.t) * amp;
        leftVGfx.y = -tracker.t * charW * 0.4;
        rightVGfx.x = Math.sin(tracker.t + Math.PI) * amp;
        rightVGfx.y = -tracker.t * charW * 0.4;
      },
      onComplete: () => {
        scene.tweens.add({ targets: leftVGfx, x: 0, y: 0, duration: 400, ease: "Quad.easeOut" });
        scene.tweens.add({
          targets: rightVGfx, x: 0, y: 0, duration: 400, ease: "Quad.easeOut",
          onComplete: () => { resetV(); fillV(rightVGfx, staticRightColor, d, e, f); onDone(); },
        });
      },
    });
  });

  // ── Animation 85: Newton's Cradle ────────────────────────────────
  easterEggs.push((onDone) => {
    const balls: Phaser.GameObjects.Arc[] = [];
    const sx = vCenterPt.x + charW;
    for (let i = 0; i < 5; i++) balls.push(scene.add.circle(sx + i * ballRadius * 2.2, vCenterPt.y, ballRadius, BALL_COLOR));
    let swings = 0;
    const doSwing = (): void => {
      if (swings >= 6) { balls.forEach((bb) => bb.destroy()); resetV(); onDone(); return; }
      const fromL = swings % 2 === 0;
      const mover = fromL ? balls[0] : balls[4];
      const restX = mover.x;
      const sd = ballRadius * 3;
      scene.tweens.add({
        targets: mover, x: restX + (fromL ? -sd : sd), duration: 200, ease: "Quad.easeOut",
        onComplete: () => scene.tweens.add({
          targets: mover, x: restX, duration: 200, ease: "Quad.easeIn",
          onComplete: () => {
            const other = fromL ? balls[4] : balls[0];
            const otherX = other.x;
            scene.tweens.add({
              targets: other, x: otherX + (fromL ? sd : -sd), duration: 200, ease: "Quad.easeOut",
              onComplete: () => scene.tweens.add({
                targets: other, x: otherX, duration: 200, ease: "Quad.easeIn",
                onComplete: () => { swings++; doSwing(); },
              }),
            });
          },
        }),
      });
    };
    doSwing();
  });

  // ── Animation 86: Invisible Wall ─────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    chainSteps([
      (next) => scene.tweens.add({ targets: leftVGfx, x: 3 * charW, duration: 500, ease: "Linear", onComplete: next }),
      (next) => {
        scene.tweens.add({
          targets: leftVGfx, x: 2 * charW, duration: 100, ease: "Quad.easeOut",
          onComplete: () => {
            let s = 0;
            const ev = scene.time.addEvent({
              delay: 60, loop: true,
              callback: () => { leftVGfx.x = 2 * charW + (s % 2 === 0 ? 2 : -2); s++; if (s >= 6) { ev.destroy(); leftVGfx.x = 2 * charW; next(); } },
            });
          },
        });
      },
      (next) => scene.time.delayedCall(400, next),
      (next) => { drawVFacing(DIR_LEFT); scene.tweens.add({ targets: leftVGfx, x: 0, duration: 500, ease: "Linear", onComplete: next }); },
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 87: Kite Flying ────────────────────────────────────
  easterEggs.push((onDone) => {
    const ball = scene.add.circle(vCenterPt.x, vCenterPt.y - charW * 3, ballRadius, BALL_COLOR);
    const line = scene.add.graphics();
    drawVFacing(DIR_RIGHT);
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: 1, duration: 3000, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = tracker.t * 5 * charW;
        ball.x = vCenterPt.x + tracker.t * 5 * charW + Math.sin(tracker.t * Math.PI * 6) * charW;
        ball.y = vCenterPt.y - charW * 3 + Math.cos(tracker.t * Math.PI * 4) * charW * 0.5;
        line.clear(); line.lineStyle(1, 0xffffff, 0.3);
        line.lineBetween(vCenterPt.x + leftVGfx.x, vCenterPt.y, ball.x, ball.y);
      },
      onComplete: () => { ball.destroy(); line.destroy(); resetV(); onDone(); },
    });
  });

  // ── Animation 88: Asteroid Dodge ─────────────────────────────────
  easterEggs.push((onDone) => {
    let dodges = 0;
    const dirs = [
      { bx: screenW + 30, dy: charW }, { bx: -30, dy: -charW },
      { bx: screenW + 30, dy: charW }, { bx: -30, dy: -charW },
    ];
    const doDodge = (): void => {
      if (dodges >= 4) { resetV(); onDone(); return; }
      const dir = dirs[dodges];
      const fromR = dir.bx > screenW / 2;
      const ast = scene.add.circle(dir.bx, vCenterPt.y, fontPx * 0.1, 0xff3333);
      drawVFacing(fromR ? DIR_LEFT : DIR_RIGHT);
      scene.tweens.add({
        targets: ast, x: fromR ? -30 : screenW + 30, duration: 800, ease: "Linear",
        onComplete: () => ast.destroy(),
      });
      scene.time.delayedCall(400, () => { leftVGfx.y = dir.dy; drawVFacing(DIR_DOWN); });
      scene.time.delayedCall(900, () => { leftVGfx.y = 0; dodges++; doDodge(); });
    };
    doDodge();
  });

  // ── Animation 89: Stack and Topple ───────────────────────────────
  easterEggs.push((onDone) => {
    const stack = [createExtraV(PLAYER_2_COLOR), createExtraV(0x00ccff)];
    stack[0].gfx.y = -charW * 1.5; stack[0].draw(DIR_DOWN);
    stack[1].gfx.y = -charW * 3; stack[1].draw(DIR_DOWN);
    chainSteps([
      (next) => scene.time.delayedCall(800, next),
      (next) => {
        let w = 0;
        const ev = scene.time.addEvent({
          delay: 100, loop: true,
          callback: () => {
            const dx = (w % 2 === 0 ? 1 : -1) * (w * 0.5);
            stack[1].gfx.x = dx; stack[0].gfx.x = dx * 0.5; w++;
            if (w >= 8) { ev.destroy(); next(); }
          },
        });
      },
      (next) => {
        scene.tweens.add({ targets: stack[1].gfx, x: 3 * charW, y: charW, alpha: 0, duration: 400, ease: "Quad.easeIn" });
        scene.tweens.add({ targets: stack[0].gfx, x: 2 * charW, y: 0, alpha: 0, duration: 400, ease: "Quad.easeIn", onComplete: next });
      },
    ], () => { stack.forEach((s) => s.gfx.destroy()); resetV(); onDone(); });
  });

  // ── Animation 90: Black Hole ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const cx = (vCenterPt.x + rightVCenterPt.x) / 2;
    const ball = scene.add.circle(cx, vCenterPt.y - charW * 2, ballRadius, BALL_COLOR);
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: 1, duration: 2000, ease: "Quad.easeIn",
      onUpdate: () => {
        const r = (1 - tracker.t) * vWidth;
        const ang = tracker.t * Math.PI * 6;
        leftVGfx.x = cx - vCenterPt.x + Math.cos(ang) * r;
        leftVGfx.y = Math.sin(ang) * r * 0.5;
        rightVGfx.x = cx - rightVCenterPt.x + Math.cos(ang + Math.PI) * r;
        rightVGfx.y = Math.sin(ang + Math.PI) * r * 0.5;
        ball.x = cx + Math.cos(ang + Math.PI / 2) * r * 0.5;
        ball.y = vCenterPt.y + Math.sin(ang + Math.PI / 2) * r * 0.3;
        const s = 1 - tracker.t * 0.8;
        leftVGfx.setScale(s); rightVGfx.setScale(s); ball.setScale(s);
      },
      onComplete: () => {
        leftVGfx.visible = false; rightVGfx.visible = false; ball.setVisible(false);
        scene.time.delayedCall(500, () => {
          ball.destroy(); resetV();
          rightVGfx.x = 0; rightVGfx.y = 0; rightVGfx.setScale(1); rightVGfx.visible = true;
          fillV(rightVGfx, staticRightColor, d, e, f); onDone();
        });
      },
    });
  });

  // ── Animation 91: Paper Airplane ─────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: 1, duration: 2500, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = tracker.t * 8 * charW;
        leftVGfx.y = Math.sin(tracker.t * Math.PI * 3) * charW * 2 - tracker.t * charW * 2;
      },
      onComplete: () => {
        leftVGfx.x = -(wLeft + vWidth + 50); drawVFacing(DIR_RIGHT);
        scene.tweens.add({ targets: leftVGfx, x: 0, y: 0, duration: 600, ease: "Quad.easeOut", onComplete: () => { resetV(); onDone(); } });
      },
    });
  });

  // ── Animation 92: Rubber Band ────────────────────────────────────
  easterEggs.push((onDone) => {
    const proxy = { sx: 1 };
    const apply = (): void => { leftVGfx.setScale(proxy.sx, 1); leftVGfx.x = vCenterPt.x * (1 - proxy.sx); };
    chainSteps([
      (next) => scene.tweens.add({ targets: proxy, sx: 2, duration: 600, ease: "Quad.easeOut", onUpdate: apply, onComplete: next }),
      (next) => scene.tweens.add({ targets: proxy, sx: 0.5, duration: 200, ease: "Quad.easeIn", onUpdate: apply, onComplete: next }),
      (next) => scene.tweens.add({ targets: proxy, sx: 1.5, duration: 200, ease: "Quad.easeOut", onUpdate: apply, onComplete: next }),
      (next) => scene.tweens.add({ targets: proxy, sx: 0.8, duration: 150, ease: "Quad.easeIn", onUpdate: apply, onComplete: next }),
      (next) => scene.tweens.add({ targets: proxy, sx: 1, duration: 150, ease: "Quad.easeOut", onUpdate: apply, onComplete: next }),
    ], () => { resetV(); onDone(); });
  });

  // ── Animation 93: Musical Chairs ─────────────────────────────────
  easterEggs.push((onDone) => {
    const p2 = createExtraV(PLAYER_2_COLOR);
    const p3 = createExtraV(0x00ccff);
    p2.gfx.x = 2 * charW; p2.draw(DIR_DOWN);
    p3.gfx.x = 4 * charW; p3.draw(DIR_DOWN);
    const c1 = scene.add.circle(vCenterPt.x + charW, vCenterPt.y + charW, fontPx * 0.08, 0xffffff);
    const c2 = scene.add.circle(vCenterPt.x + 3 * charW, vCenterPt.y + charW, fontPx * 0.08, 0xffffff);
    const cx = 2 * charW, radius = 2.5 * charW;
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: Math.PI * 2, duration: 2500, ease: "Linear",
      onUpdate: () => {
        leftVGfx.x = cx + Math.cos(tracker.t) * radius;
        p2.gfx.x = cx + Math.cos(tracker.t + Math.PI * 2 / 3) * radius;
        p3.gfx.x = cx + Math.cos(tracker.t + Math.PI * 4 / 3) * radius;
      },
      onComplete: () => {
        scene.tweens.add({ targets: p3.gfx, alpha: 0, y: charW, duration: 400 });
        leftVGfx.x = charW; p2.gfx.x = 3 * charW;
        scene.time.delayedCall(600, () => { c1.destroy(); c2.destroy(); p2.gfx.destroy(); p3.gfx.destroy(); resetV(); onDone(); });
      },
    });
  });

  // ── Animation 94: Bungee Jump ────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_DOWN);
    scene.tweens.add({
      targets: leftVGfx, y: height * 0.5, duration: 400, ease: "Quad.easeIn",
      onComplete: () => {
        let bh = height * 0.5, bounces = 0;
        const doBounce = (): void => {
          if (bounces >= 5) { resetV(); onDone(); return; }
          scene.tweens.add({
            targets: leftVGfx, y: -bh * 0.3, duration: 300, ease: "Quad.easeOut",
            onComplete: () => {
              bh *= 0.5;
              scene.tweens.add({
                targets: leftVGfx, y: bh, duration: 300, ease: "Quad.easeIn",
                onComplete: () => { bounces++; doBounce(); },
              });
            },
          });
        };
        doBounce();
      },
    });
  });

  // ── Animation 95: Speed Lines ────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    const lines: Phaser.GameObjects.Graphics[] = [];
    blinkToggleFly(() => {
      const lineEv = scene.time.addEvent({
        delay: 40, loop: true,
        callback: () => {
          const ln = scene.add.graphics();
          ln.lineStyle(1, staticLeftColor, 0.4);
          const y = vCenterPt.y + (Math.random() - 0.5) * charW;
          ln.lineBetween(vCenterPt.x + leftVGfx.x - charW, y, vCenterPt.x + leftVGfx.x - charW * 3, y);
          lines.push(ln);
          scene.tweens.add({ targets: ln, alpha: 0, duration: 300, onComplete: () => ln.destroy() });
        },
      });
      scene.tweens.add({
        targets: leftVGfx, x: screenW + 50, duration: 800, ease: "Quad.easeIn",
        onComplete: () => {
          lineEv.destroy(); leftVGfx.x = -(wLeft + vWidth + 50);
          scene.tweens.add({
            targets: leftVGfx, x: 0, duration: 400, ease: "Quad.easeOut",
            onComplete: () => { lines.forEach((l) => { if (l.active) l.destroy(); }); resetV(); onDone(); },
          });
        },
      });
    });
  });

  // ── Animation 96: Ricochet ───────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    blinkToggleFly(() => {
      const pts = [
        { x: screenW * 0.7 - vCenterPt.x, y: 0 },
        { x: screenW * 0.7 - vCenterPt.x, y: -(vCenterPt.y - 20) },
        { x: -(vCenterPt.x - 20), y: -(vCenterPt.y - 20) },
        { x: -(vCenterPt.x - 20), y: height - vCenterPt.y - 20 },
        { x: 0, y: 0 },
      ];
      let bi = 0;
      const doBounce = (): void => {
        if (bi >= pts.length) { resetV(); onDone(); return; }
        scene.tweens.add({
          targets: leftVGfx, x: pts[bi].x, y: pts[bi].y, duration: 350, ease: "Linear",
          onComplete: () => { bi++; doBounce(); },
        });
      };
      doBounce();
    });
  });

  // ── Animation 97: Crane Grab ─────────────────────────────────────
  easterEggs.push((onDone) => {
    const cl1 = createExtraV(0xaaaaaa);
    const cl2 = createExtraV(0xaaaaaa);
    cl1.gfx.x = 2 * charW - charW * 0.4; cl1.draw(DIR_RIGHT);
    cl2.gfx.x = 2 * charW + charW * 0.4; cl2.draw(DIR_LEFT);
    cl1.gfx.y = -(height * 0.4); cl2.gfx.y = -(height * 0.4);
    const ball = scene.add.circle(vCenterPt.x + 2 * charW, vCenterPt.y, ballRadius, BALL_COLOR);
    chainSteps([
      (next) => {
        scene.tweens.add({ targets: cl1.gfx, y: -charW * 0.5, duration: 800, ease: "Linear" });
        scene.tweens.add({ targets: cl2.gfx, y: -charW * 0.5, duration: 800, ease: "Linear", onComplete: next });
      },
      (next) => {
        scene.tweens.add({ targets: cl1.gfx, x: 2 * charW - charW * 0.15, duration: 200 });
        scene.tweens.add({ targets: cl2.gfx, x: 2 * charW + charW * 0.15, duration: 200, onComplete: next });
      },
      (next) => {
        scene.tweens.add({ targets: cl1.gfx, y: -(height * 0.4), duration: 800, ease: "Linear" });
        scene.tweens.add({ targets: cl2.gfx, y: -(height * 0.4), duration: 800, ease: "Linear" });
        scene.tweens.add({ targets: ball, y: ball.y - height * 0.4 + charW * 0.5, duration: 800, ease: "Linear", onComplete: next });
      },
    ], () => { cl1.gfx.destroy(); cl2.gfx.destroy(); ball.destroy(); resetV(); onDone(); });
  });

  // ── Animation 98: Both Vs Clash ──────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT); drawRightVFacing(DIR_LEFT);
    const midOff = (rightVCenterPt.x - vCenterPt.x) * 0.3;
    chainSteps([
      (next) => scene.time.delayedCall(500, next),
      (next) => {
        scene.tweens.add({ targets: leftVGfx, x: midOff, duration: 300, ease: "Quad.easeIn" });
        scene.tweens.add({ targets: rightVGfx, x: -midOff, duration: 300, ease: "Quad.easeIn", onComplete: next });
      },
      (next) => {
        scene.tweens.add({ targets: leftVGfx, x: -charW, duration: 200, ease: "Quad.easeOut" });
        scene.tweens.add({ targets: rightVGfx, x: charW, duration: 200, ease: "Quad.easeOut", onComplete: next });
      },
      (next) => {
        let s = 0;
        const ev = scene.time.addEvent({
          delay: 50, loop: true,
          callback: () => {
            leftVGfx.x = -charW + (s % 2 === 0 ? 2 : -2);
            rightVGfx.x = charW + (s % 2 === 0 ? -2 : 2);
            s++; if (s >= 8) { ev.destroy(); next(); }
          },
        });
      },
      (next) => {
        scene.tweens.add({ targets: leftVGfx, x: 0, duration: 300, ease: "Quad.easeOut" });
        scene.tweens.add({ targets: rightVGfx, x: 0, duration: 300, ease: "Quad.easeOut", onComplete: next });
      },
    ], () => { resetV(); rightVGfx.x = 0; rightVGfx.y = 0; fillV(rightVGfx, staticRightColor, d, e, f); onDone(); });
  });

  // ── Animation 99: Victory Lap ────────────────────────────────────
  easterEggs.push((onDone) => {
    drawVFacing(DIR_RIGHT);
    blinkToggleFly(() => {
      const m = 30;
      const top = -(vCenterPt.y - m), right = screenW - vCenterPt.x - m;
      const bottom = height - vCenterPt.y - m, left = -(vCenterPt.x - m);
      chainSteps([
        (next) => { drawVFacing(DIR_RIGHT); scene.tweens.add({ targets: leftVGfx, x: right, duration: 600, ease: "Linear", onComplete: next }); },
        (next) => { drawVFacing(DIR_DOWN); scene.tweens.add({ targets: leftVGfx, y: bottom, duration: 400, ease: "Linear", onComplete: next }); },
        (next) => { drawVFacing(DIR_LEFT); scene.tweens.add({ targets: leftVGfx, x: left, duration: 600, ease: "Linear", onComplete: next }); },
        (next) => { drawVFacing(DIR_UP); scene.tweens.add({ targets: leftVGfx, y: top, duration: 400, ease: "Linear", onComplete: next }); },
        (next) => { drawVFacing(DIR_RIGHT); scene.tweens.add({ targets: leftVGfx, x: 0, duration: 400, ease: "Linear", onComplete: next }); },
        (next) => { drawVFacing(DIR_DOWN); scene.tweens.add({ targets: leftVGfx, y: 0, duration: 300, ease: "Linear", onComplete: next }); },
      ], () => { resetV(); onDone(); });
    });
  });

  // ── Animation 100: Grand Finale ──────────────────────────────────
  easterEggs.push((onDone) => {
    const extras = [createExtraV(PLAYER_2_COLOR), createExtraV(0x00ccff), createExtraV(0xff8800), createExtraV(0xff0000)];
    const ball = scene.add.circle(vCenterPt.x + 3 * charW, vCenterPt.y, ballRadius, BALL_COLOR);
    extras[0].gfx.x = 2 * charW; extras[1].gfx.x = 4 * charW;
    extras[2].gfx.x = 6 * charW; extras[3].gfx.x = -2 * charW;
    extras.forEach((ex) => ex.draw(DIR_DOWN));
    const tracker = { t: 0 };
    scene.tweens.add({
      targets: tracker, t: 1, duration: 2000, ease: "Quad.easeIn",
      onUpdate: () => {
        const ang = tracker.t * Math.PI * 4;
        const r = (1 - tracker.t) * charW * 4;
        leftVGfx.x = 3 * charW + Math.cos(ang) * r;
        leftVGfx.y = Math.sin(ang) * r;
        for (let i = 0; i < extras.length; i++) {
          const a2 = ang + (i + 1) * Math.PI * 2 / 5;
          extras[i].gfx.x = 3 * charW + Math.cos(a2) * r;
          extras[i].gfx.y = Math.sin(a2) * r;
        }
      },
      onComplete: () => {
        extras.forEach((ex) => ex.gfx.setVisible(false));
        leftVGfx.visible = false; ball.setVisible(false);
        const particles: Phaser.GameObjects.Arc[] = [];
        const cols = [staticLeftColor, PLAYER_2_COLOR, 0x00ccff, 0xff8800, 0xff0000, BALL_COLOR];
        for (let i = 0; i < 20; i++) {
          const ang = (i / 20) * Math.PI * 2;
          const dist = charW * (2 + Math.random() * 3);
          const p = scene.add.circle(vCenterPt.x + 3 * charW, vCenterPt.y, fontPx * 0.05, cols[i % cols.length]);
          particles.push(p);
          scene.tweens.add({
            targets: p, x: p.x + Math.cos(ang) * dist, y: p.y + Math.sin(ang) * dist, alpha: 0,
            duration: 1000, ease: "Quad.easeOut",
          });
        }
        scene.time.delayedCall(1100, () => {
          particles.forEach((p) => p.destroy());
          extras.forEach((ex) => ex.gfx.destroy());
          ball.destroy(); resetV(); onDone();
        });
      },
    });
  });

  let active = false;
  let idx = 0;
  const trigger = (): void => {
    if (active) return;
    active = true;
    easterEggs[idx](() => {
      active = false;
      idx = (idx + 1) % easterEggs.length;
    });
  };

  return { trigger };
}
