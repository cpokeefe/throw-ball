import Phaser from "phaser";
import { Command, Direction } from "../../core/types";

type KeyMap = {
  w: Phaser.Input.Keyboard.Key;
  a: Phaser.Input.Keyboard.Key;
  s: Phaser.Input.Keyboard.Key;
  d: Phaser.Input.Keyboard.Key;
  i: Phaser.Input.Keyboard.Key;
  j: Phaser.Input.Keyboard.Key;
  k: Phaser.Input.Keyboard.Key;
  l: Phaser.Input.Keyboard.Key;
  e: Phaser.Input.Keyboard.Key;
  o: Phaser.Input.Keyboard.Key;
  q: Phaser.Input.Keyboard.Key;
  u: Phaser.Input.Keyboard.Key;
};

export class KeyboardAdapter {
  private keys: KeyMap;
  private p1ActionSuppressed = false;
  private p1ToggleFlySuppressed = false;

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
      e: Phaser.Input.Keyboard.KeyCodes.E,
      o: Phaser.Input.Keyboard.KeyCodes.O,
      q: Phaser.Input.Keyboard.KeyCodes.Q,
      u: Phaser.Input.Keyboard.KeyCodes.U,
    }) as KeyMap;
  }

  /** Call when `e` was used as the second key of a `:e` command so gameplay does not also treat it as P1 action. */
  suppressP1Action(): void {
    this.p1ActionSuppressed = true;
  }

  /** Call when `q` was used as the second key of a `:q` command so gameplay does not also treat it as P1 toggle fly. */
  suppressP1ToggleFly(): void {
    this.p1ToggleFlySuppressed = true;
  }

  pollCommands(_deltaMs: number): Command[] {
    const commands: Command[] = [];

    this.pollP1(commands);
    this.pollP2(commands);

    return commands;
  }

  private pollP1(commands: Command[]): void {
    const dir = justPressedDirection(this.keys.w, this.keys.d, this.keys.s, this.keys.a);
    if (dir !== null) {
      commands.push({ type: "MOVE", playerId: 1, direction: dir });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.e)) {
      if (this.p1ActionSuppressed) {
        this.p1ActionSuppressed = false;
      } else {
        commands.push({ type: "ACTION", playerId: 1 });
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.q)) {
      if (this.p1ToggleFlySuppressed) {
        this.p1ToggleFlySuppressed = false;
      } else {
        commands.push({ type: "TOGGLE_FLY", playerId: 1 });
      }
    }
  }

  private pollP2(commands: Command[]): void {
    const dir = justPressedDirection(this.keys.i, this.keys.l, this.keys.k, this.keys.j);
    if (dir !== null) {
      commands.push({ type: "MOVE", playerId: 2, direction: dir });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.o)) {
      commands.push({ type: "ACTION", playerId: 2 });
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.u)) {
      commands.push({ type: "TOGGLE_FLY", playerId: 2 });
    }
  }
}

function justPressedDirection(
  north: Phaser.Input.Keyboard.Key,
  east: Phaser.Input.Keyboard.Key,
  south: Phaser.Input.Keyboard.Key,
  west: Phaser.Input.Keyboard.Key
): Direction | null {
  if (Phaser.Input.Keyboard.JustDown(north)) {
    return "N";
  }
  if (Phaser.Input.Keyboard.JustDown(east)) {
    return "E";
  }
  if (Phaser.Input.Keyboard.JustDown(south)) {
    return "S";
  }
  if (Phaser.Input.Keyboard.JustDown(west)) {
    return "W";
  }
  return null;
}
