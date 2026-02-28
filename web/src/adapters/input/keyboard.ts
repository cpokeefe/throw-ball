import Phaser from "phaser";
import { Command, Direction } from "../../core/types";

const MOVE_REPEAT_MS = 120;

type KeyMap = {
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  i: Phaser.Input.Keyboard.Key;
  j: Phaser.Input.Keyboard.Key;
  k: Phaser.Input.Keyboard.Key;
  l: Phaser.Input.Keyboard.Key;
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  e: Phaser.Input.Keyboard.Key;
  o: Phaser.Input.Keyboard.Key;
  period: Phaser.Input.Keyboard.Key;
  q: Phaser.Input.Keyboard.Key;
  u: Phaser.Input.Keyboard.Key;
};

export class KeyboardAdapter {
  private keys: KeyMap;
  private p1Hold: HoldState = { direction: null, elapsedMs: 0 };
  private p2Hold: HoldState = { direction: null, elapsedMs: 0 };

  constructor(scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      i: Phaser.Input.Keyboard.KeyCodes.I,
      j: Phaser.Input.Keyboard.KeyCodes.J,
      k: Phaser.Input.Keyboard.KeyCodes.K,
      l: Phaser.Input.Keyboard.KeyCodes.L,
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      e: Phaser.Input.Keyboard.KeyCodes.E,
      o: Phaser.Input.Keyboard.KeyCodes.O,
      period: Phaser.Input.Keyboard.KeyCodes.PERIOD,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      u: Phaser.Input.Keyboard.KeyCodes.U,
    }) as KeyMap;
  }

  pollCommands(deltaMs: number): Command[] {
    const commands: Command[] = [];

    this.pollP1(commands, deltaMs);
    this.pollP2(commands, deltaMs);

    return commands;
  }

  private pollP1(commands: Command[], deltaMs: number): void {
    const dir = pressedDirection(this.keys.w, this.keys.d, this.keys.s, this.keys.a);
    emitRepeatedMove(commands, 1, dir, this.p1Hold, deltaMs);
    if (Phaser.Input.Keyboard.JustDown(this.keys.e)) {
      commands.push({ type: "ACTION", playerId: 1 });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.q)) {
      commands.push({ type: "TOGGLE_FLY", playerId: 1 });
    }
  }

  private pollP2(commands: Command[], deltaMs: number): void {
    const ijkl = pressedDirection(this.keys.i, this.keys.l, this.keys.k, this.keys.j);
    const arrows = pressedDirection(this.keys.up, this.keys.right, this.keys.down, this.keys.left);
    const dir = ijkl ?? arrows;
    emitRepeatedMove(commands, 2, dir, this.p2Hold, deltaMs);
    if (Phaser.Input.Keyboard.JustDown(this.keys.o) || Phaser.Input.Keyboard.JustDown(this.keys.period)) {
      commands.push({ type: "ACTION", playerId: 2 });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.u)) {
      commands.push({ type: "TOGGLE_FLY", playerId: 2 });
    }
  }
}

type HoldState = {
  direction: Direction | null;
  elapsedMs: number;
};

function pressedDirection(
  north: Phaser.Input.Keyboard.Key,
  east: Phaser.Input.Keyboard.Key,
  south: Phaser.Input.Keyboard.Key,
  west: Phaser.Input.Keyboard.Key
): Direction | null {
  if (north.isDown) {
    return "N";
  }
  if (east.isDown) {
    return "E";
  }
  if (south.isDown) {
    return "S";
  }
  if (west.isDown) {
    return "W";
  }
  return null;
}

function emitRepeatedMove(
  commands: Command[],
  playerId: 1 | 2,
  currentDirection: Direction | null,
  hold: HoldState,
  deltaMs: number
): void {
  if (currentDirection === null) {
    hold.direction = null;
    hold.elapsedMs = 0;
    return;
  }

  if (hold.direction !== currentDirection) {
    hold.direction = currentDirection;
    hold.elapsedMs = 0;
    commands.push({ type: "MOVE", playerId, direction: currentDirection });
    return;
  }

  hold.elapsedMs += deltaMs;
  if (hold.elapsedMs >= MOVE_REPEAT_MS) {
    hold.elapsedMs -= MOVE_REPEAT_MS;
    commands.push({ type: "MOVE", playerId, direction: currentDirection });
  }
}
