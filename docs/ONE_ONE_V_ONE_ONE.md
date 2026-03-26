# ONE_ONE_V_ONE_ONE — Implementation Guide

> **Four humans: (P1 + P3) vs. (P2 + P4)**
> Pure local multiplayer — no CPU. The single hardest mode to implement because of keyboard constraints: four players on one keyboard.

---

## Prerequisites

This guide assumes the foundational 4-player infrastructure is in place (see ONE_ONE_V_CPU_CPU guide):
- `PlayerId = 1 | 2 | 3 | 4`, `.team`, `.controlledBy`
- Multi-player collision, team-based scoring, 4-player rendering

This document focuses on what's **unique** to this mode.

---

## 1. Team Composition

| Player | Team | Control | Color | Spawn Side |
|--------|------|---------|-------|------------|
| P1 | 1 (left) | human | `PLAYER_1_COLOR` (green) | Goal1, offset up |
| P3 | 1 (left) | human | `PLAYER_3_COLOR` (cyan) | Goal1, offset down |
| P2 | 2 (right) | human | `PLAYER_2_COLOR` (magenta) | Goal2, offset up |
| P4 | 2 (right) | human | `PLAYER_4_COLOR` (orange) | Goal2, offset down |

All four players are human-controlled. No CPU ticks run at all.

---

## 2. Input — The Hardest Problem

### The keyboard limitation

A standard keyboard has **6-key rollover** (sometimes 2-key on cheap membranes). With two players (12 keys total: WASD+Q+E and IJKL+U+O), conflicts are rare. With four players needing ~24 keys, ghosting and rollover limits become real blockers.

### Key assignment strategy

The keyboard has three zones with minimal electrical ghosting between them:

| Player | Move | Fly | Action | Zone |
|--------|------|-----|--------|------|
| P1 | WASD | Q | E | Left |
| P3 | TFGH | R | Y | Center-left |
| P2 | IJKL | U | O | Right |
| P4 | Arrows | RShift | RCtrl/Enter | Far-right |

**Rationale:**
- P1 (WASD) and P3 (TFGH) are on the left half — they're teammates so simultaneous presses are common. TFGH is offset far enough from WASD to avoid ghosting on most keyboards.
- P2 (IJKL) and P4 (Arrows) are on the right half. Arrow keys are on a separate matrix in most keyboards, reducing ghosting with IJKL.
- Fly and Action keys are adjacent to the move cluster for each player.

### Alternative: Gamepad support

If keyboard ghosting is a dealbreaker, add gamepad input via the [Phaser Gamepad API](https://newdocs.phaser.io/docs/3.60.0/Phaser.Input.Gamepad):

```typescript
const pads = this.input.gamepad?.gamepads;
if (pads && pads[0]) {
  // pad 0 → P3, pad 1 → P4 (P1/P2 stay on keyboard)
}
```

This is the most ergonomic solution for 4-player local play but adds significant scope.

### Keyboard adapter changes

The current `KeyboardAdapter` has `pollP1()` and `pollP2()`. Add `pollP3()` and `pollP4()`:

```typescript
constructor(scene: Phaser.Scene) {
  this.keys = scene.input.keyboard!.addKeys({
    // P1: existing WASD/Q/E
    // P2: existing IJKL/U/O
    // P3: new
    t: Phaser.Input.Keyboard.KeyCodes.T,
    f: Phaser.Input.Keyboard.KeyCodes.F,
    g: Phaser.Input.Keyboard.KeyCodes.G,
    h: Phaser.Input.Keyboard.KeyCodes.H,
    r: Phaser.Input.Keyboard.KeyCodes.R,
    y: Phaser.Input.Keyboard.KeyCodes.Y,
    // P4: new
    numUp: Phaser.Input.Keyboard.KeyCodes.UP,     // already registered as 'up'
    numDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
    numLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
    numRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    rshift: Phaser.Input.Keyboard.KeyCodes.SHIFT,  // needs disambiguation
    rctrl: Phaser.Input.Keyboard.KeyCodes.CTRL,
  }) as KeyMap;
}
```

**Problem:** Phaser's `addKeys` doesn't distinguish left-shift from right-shift. The `KeyboardEvent.code` property does (`"ShiftLeft"` vs `"ShiftRight"`). You'll need a raw event listener:

```typescript
scene.input.keyboard!.on("keydown", (event: KeyboardEvent) => {
  if (event.code === "ShiftRight") this.p4FlyPressed = true;
  if (event.code === "ControlRight" || event.code === "Enter") this.p4ActionPressed = true;
});
```

### Arrow key conflict with P2

Currently, P2 can use either IJKL *or* Arrow keys. In 4-player mode, Arrows must be exclusive to P4. Remove the `arrows` fallback from `pollP2()` when mode is `ONE_ONE_V_ONE_ONE`:

```typescript
private pollP2(commands: Command[]): void {
  const ijkl = justPressedDirection(this.keys.i, this.keys.l, this.keys.k, this.keys.j);
  // Only allow arrows for P2 in non-4-player modes
  const arrows = this.is4Player ? null : justPressedDirection(...);
  const dir = ijkl ?? arrows;
  // ...
}
```

---

## 3. No CPU Logic

In `GameScene.update()`, the CPU accumulator and `applyCpuDecision` calls are skipped entirely. Guard with:

```typescript
const cpuPlayers = activePlayers(this.state).filter(pid => this.state.players[pid].controlledBy === "cpu");
for (const cpuId of cpuPlayers) {
  // tick CPU — empty for this mode
}
```

Or more explicitly:

```typescript
if (cpuPlayers.length === 0) {
  // skip CPU accumulator entirely
}
```

---

## 4. Rendering

### Player colors

All four players are distinct humans, so all four get unique colors:

```
P1: 0x00ff00 (green)   — Team 1
P3: 0x00ccff (cyan)    — Team 1
P2: 0xff00ff (magenta) — Team 2
P4: 0xff8800 (orange)  — Team 2
```

These are already defined in `colors.ts`. The renderer's `playerColor` function just returns by player ID.

### Goal colors

Team-based as in other 4-player modes. Team 1's primary = `PLAYER_1_COLOR`, Team 2's primary = `PLAYER_2_COLOR`.

---

## 5. HUD

### Player labels

With 4 humans, each player needs visible identification. Two options:

**Option A — Team labels with player names:**
```
Left:  "P1, P3"    Right:  "P2, P4"
```

**Option B — Individual labels with colors:**
Show "P1" in green, "P3" in cyan on the left; "P2" in magenta, "P4" in orange on the right.

### Status boxes — critical for 4 humans

Unlike CPU modes where CPU status is informational, here all 4 players need real-time feedback. The two-row layout is essential:

```
Left (Team 1):                          Right (Team 2):
[P1 Fly] [P1 Ball] [P1 Steps]          [P2 Fly] [P2 Ball] [P2 Steps]
[P3 Fly] [P3 Ball] [P3 Steps]          [P4 Fly] [P4 Ball] [P4 Steps]
```

Color-code each row's border to the player's color so players can quickly scan for their status.

### Score display

Same team-based layout as other 4-player modes.

---

## 6. Pause Screen — Full Controls Reference

The pause overlay must show all four control sets:

```
P1: WASD move, Q fly, E action
P3: TFGH move, R fly, Y action
P2: IJKL move, U fly, O/. action
P4: Arrows move, RShift fly, RCtrl action
```

This is the most text-heavy pause screen. Consider reducing font size or splitting into two columns.

---

## 7. Debug HUD

`refreshDebugHud` must show all 4 player positions and states. The current 3-line format gets crowded:

```
Seed 42 | Tick 1205
P1 (3,7) fly:no | P3 (5,9) fly:yes | P2 (72,8) fly:no | P4 (74,5) fly:no | Ball: P1 flying: no
P1 WASD/Q/E | P3 TFGH/R/Y | P2 IJKL/U/O | P4 Arrows/RShift/RCtrl
```

May need to shrink `DEBUG_HUD_FONT_SIZE_PX` or truncate.

---

## 8. Win Scene

Display "Team 1 wins!" or "Team 2 wins!" with the team's primary color. Could optionally list the players: "P1 & P3 win!".

---

## 9. Countdown & Goal Announcements

Same team-based approach as other 4-player modes. "Team 1 Goal!" or "Team 2 Goal!" with team color.

---

## 10. Edge Cases Unique to 4-Player All-Human

### Simultaneous key presses

Two teammates might press action on the same frame while both adjacent to the ball. `pollCommands` returns commands in order (P1 → P2 → P3 → P4). The first command that grabs the ball wins; the second sees the ball is gone. This is fine — first-come-first-served.

### Keyboard ghosting

On membrane keyboards, pressing W+T+I simultaneously may not register all three. Inform users in the Guide scene or settings:

```
4-Player mode works best with a mechanical keyboard or gamepads.
```

### Player collision clusters

Four players can form a 2×2 block where nobody can move. The movement logic handles this naturally — each player checks all others for collision and stays put if blocked. Players must maneuver out one at a time.

### The ball and 4 adjacent players

The ball can be surrounded by all four players. `applyAction` checks for adjacent ball first, then adjacent opponent with ball, then throws if holding ball. Priority order is clear and deterministic.

### Step limit with teammates

When a player runs out of steps while holding the ball, they must throw. If their teammate catches it, the teammate gets a fresh `STEPS_PER_POSSESSION`. This creates a natural passing incentive — players conserve steps by passing to their teammate.

---

## 11. Guide Scene

The Guide scene should document 4-player controls. Add a section or page:

```
4-PLAYER CONTROLS
═══════════════════
Team 1 (Left):
  P1: W/A/S/D to move, Q to fly, E to act
  P3: T/F/G/H to move, R to fly, Y to act

Team 2 (Right):
  P2: I/J/K/L to move, U to fly, O to act
  P4: ↑/←/↓/→ to move, RShift to fly, RCtrl to act
```

---

## 12. Settings Scene

Consider adding a "remap controls" option or at minimum a key binding display for all 4 players. For MVP, hardcoded bindings with the Guide reference is sufficient.

---

## 13. Config & Menu

### `gameModes.ts`

Remove `"ONE_ONE_V_ONE_ONE"` from `COMING_SOON_MODES`.

### Title menu V colors

Already handled: `vSpecForMode` returns `{ left: { colors: [P1, P3] }, right: { colors: [P2, P4] } }`. Both V's flash between their team's two player colors.

---

## 14. Testing Strategy

4-player modes are hard to test alone. Approaches:

1. **Automated test harness:** Feed synthetic commands for all 4 players and verify state transitions.
2. **Hybrid CPU fill-in:** Add a debug toggle that makes P3 and/or P4 CPU-controlled for solo testing, then switch back to human for release.
3. **Replay system:** Record a 4-player session and replay it to verify rendering.

---

## Summary: File Change Map (beyond shared 4-player infrastructure)

| File | Change |
|------|--------|
| `keyboard.ts` | Add P3 (TFGH/R/Y) and P4 (Arrows/RShift/RCtrl) polling, remove Arrow fallback from P2, raw event listener for RShift/RCtrl |
| `GameScene.ts` | Skip CPU ticks, poll all 4 players, 4-player HUD, 4-player pause controls text |
| `phaserRenderer.ts` | All 4 unique human colors |
| `WinScene.ts` | Team-based winner display |
| `gameModes.ts` | Remove from coming soon |
| `init.ts` | 4-player spawn with all-human control assignments |
| `GuideScene.ts` | 4-player control reference |
| `display.ts` | Adjust `HUD_HEIGHT` for two status rows, possibly debug HUD font |

---

## Implementation Order Recommendation (Across All 3 Modes)

1. **Shared 4-player foundation** — `types.ts`, `update.ts`, `init.ts`, `phaserRenderer.ts` (do once, all modes benefit)
2. **ONE_ONE_V_CPU_CPU** — easiest, no new human input, reuses existing keybindings
3. **ONE_CPU_V_ONE_CPU** — adds input remapping complexity, but only 2 human input slots
4. **ONE_ONE_V_ONE_ONE** — hardest, requires new keybindings and ghosting considerations
