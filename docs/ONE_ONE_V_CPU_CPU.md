# ONE_ONE_V_CPU_CPU — Implementation Guide

> **Two humans (P1 + P3) vs. two CPUs (P2 + P4)**
> Team Left defends Goal1, Team Right defends Goal2. Human players share a keyboard; CPU players each run independent AI ticks.

---

## 1. Expand the Player Model

### `types.ts`

The entire game is built on `Record<1 | 2, PlayerState>` with `id: 1 | 2`. Every downstream system — commands, scoring, rendering, HUD — keys off this two-player assumption.

```typescript
// Current
export interface PlayerState {
  id: 1 | 2;
  // ...
}
export interface GameState {
  players: Record<1 | 2, PlayerState>;
  score: { p1: number; p2: number };
  // ...
}
export interface BallState {
  thrownBy: 1 | 2 | null;
}
type PlayerId = 1 | 2;

// Required
type PlayerId = 1 | 2 | 3 | 4;

export interface PlayerState {
  id: PlayerId;
  team: 1 | 2;          // team 1 = left/Goal1 side, team 2 = right/Goal2 side
  controlledBy: "human" | "cpu";
  // ...rest unchanged
}
export interface GameState {
  players: Record<PlayerId, PlayerState>;
  score: { team1: number; team2: number };  // replaces p1/p2
  // ...
}
export interface BallState {
  thrownBy: PlayerId | null;
}
```

**Ripple effects:** Every `Command` union member uses `playerId: 1 | 2` — widen to `PlayerId`. The `ADVANCE_BALL` command has no `playerId` so it's fine. `MoveCommand`, `ActionCommand`, `ToggleFlyCommand` all need the wider type.

### Migration strategy

To avoid breaking existing modes, guard with runtime checks: when `mode` is `"ONE_V_ONE"` or `"ONE_V_CPU"`, players 3 and 4 can be spawned off-screen at `(-1, -1)` and excluded from all logic via a helper:

```typescript
function activePlayers(state: GameState): PlayerId[] {
  // returns [1, 2] for 2-player modes, [1, 2, 3, 4] for 4-player modes
}
```

---

## 2. Initialization (`init.ts`)

`createInitialState` currently spawns exactly two players. For this mode:

| Player | Team | Control | Spawn |
|--------|------|---------|-------|
| P1 | 1 (left) | human | In front of Goal1, offset up |
| P3 | 1 (left) | human | In front of Goal1, offset down |
| P2 | 2 (right) | cpu | In front of Goal2, offset up |
| P4 | 2 (right) | cpu | In front of Goal2, offset down |

Reuse `spawnInFrontOfGoal` but add a vertical offset parameter so teammates don't overlap. Something like:

```typescript
const p1Spawn = spawnInFrontOfGoal(tiles, w, h, Tile.Goal1, fallback, 1, -2); // offset -2 tiles Y
const p3Spawn = spawnInFrontOfGoal(tiles, w, h, Tile.Goal1, fallback, 1, +2); // offset +2 tiles Y
```

Then validate no two spawns collide (BFS to nearest open floor if they do).

---

## 3. Collision & Movement (`update.ts`)

### Player-player collisions

`applySingleStepMovement` and `beginFlyMovement` only check `other = players[playerId === 1 ? 2 : 1]`. With 4 players, you must check **all other players**:

```typescript
function isOccupiedByPlayer(state: GameState, x: number, y: number, excludeId: PlayerId): boolean {
  for (const pid of activePlayers(state)) {
    if (pid === excludeId) continue;
    if (sameCoord(state.players[pid].position, { x, y })) return true;
  }
  return false;
}
```

Replace all `sameCoord(other.position, ...)` checks with this helper.

### `isPlayerAt`

Currently only checks players 1 and 2. Change to loop over `activePlayers(state)`.

### Ball interactions

`applyAction` hardcodes `otherId = playerId === 1 ? 2 : 1`. With 4 players, the "other" for punching/stealing is whichever **adjacent opponent** (different team) holds the ball:

```typescript
function findAdjacentOpponentWithBall(state: GameState, playerId: PlayerId): PlayerId | null {
  const myTeam = state.players[playerId].team;
  for (const pid of activePlayers(state)) {
    if (state.players[pid].team === myTeam) continue;
    if (state.players[pid].hasBall && isAdjacent(state.players[playerId].position, state.players[pid].position)) {
      return pid;
    }
  }
  return null;
}
```

### Ball pickup

`grabBall` currently clears `hasBall` only on the "other" player. With 4 players, clear `hasBall` on **all** players except the grabber.

### Scoring

`scoreAndResetRound` uses `scorerId: 1 | 2`. Change to score by **team**: `thrownBy` tells you which player threw, look up their `.team`, increment that team's score.

`goalTileForPlayer` and `opponentGoalTileForPlayer` should key off `player.team` instead of `playerId`.

### `advanceAutoFly`

Currently iterates `[1, 2]`. Change to iterate `activePlayers(state)`.

### `advanceAutoBall` — ball-hits-player interception

Currently the ball stops when it hits **any** player. This is fine for 4 players too, but make sure `isPlayerAt` loops all 4.

---

## 4. CPU AI (`core/cpu/`)

The existing CPU always controls player 2. For this mode, you need **two independent CPU brains** — one for P2, one for P4.

### Option A: Call `applyCpuDecision` twice

```typescript
if (isCpuControlled(state, 2)) next = applyCpuDecision(next, 2);
if (isCpuControlled(state, 4)) next = applyCpuDecision(next, 4);
```

This requires parameterizing every CPU strategy to accept a `cpuId: PlayerId` instead of hardcoding `state.players[2]`.

### Key changes inside each strategy file

- Replace `state.players[2]` with `state.players[cpuId]`
- Replace `state.players[1]` (the assumed opponent) with a lookup: nearest opponent or primary threat
- `opponentGoalTileForPlayer(state, cpuId)` already works if you've updated that function to use `.team`
- BFS pathfinding must avoid **all** other players, not just player 1
- `cpuBallTarget` is player-agnostic (it just follows ball trajectory) — no change needed

### Teammate awareness

Both CPUs are on the same team. Without coordination they'll chase the same ball. Mitigate with:

- **Role assignment:** one CPU attacks (chases ball/scores), the other defends (stays near own goal). Assign by comparing distance to ball.
- **Anti-clustering:** add a repulsive term when the teammate is within 3 tiles

---

## 5. Input (`adapters/input/keyboard.ts`)

P1 uses WASD+Q+E. P3 (the second human) needs a **third keyset**. Options:

| Player | Move | Fly | Action |
|--------|------|-----|--------|
| P1 | WASD | Q | E |
| P3 | IJKL or Arrows | U | O / . |

This is the **same binding P2 currently uses** in ONE_V_ONE mode. The keyboard adapter already polls P2 keys — just route those commands to `playerId: 3` when mode is `ONE_ONE_V_CPU_CPU`.

In `GameScene`, change the command filter:

```typescript
// Current: skip P2 commands when isCpu
if (command.playerId === 2 && this.isCpu) continue;

// New: remap P2 keyboard commands to P3 for this mode
if (this.mode === "ONE_ONE_V_CPU_CPU" && command.playerId === 2) {
  command = { ...command, playerId: 3 };
}
```

---

## 6. Rendering (`adapters/render/phaserRenderer.ts`)

### Draw 4 players

`draw()` currently renders P1 and optionally P2. Add P3 and P4:

```typescript
for (const pid of activePlayers(state)) {
  this.drawPlayer(state.players[pid], blinkOn);
}
```

### Player colors

Currently two colors: `PLAYER_1_COLOR` (green) and `p2Color` (magenta or silver). Add:

```typescript
// colors.ts already defines these:
PLAYER_3_COLOR = 0x00ccff;  // cyan
PLAYER_4_COLOR = 0xff8800;  // orange
```

Map in the renderer:

```typescript
private playerColor(pid: PlayerId, controlledBy: string): number {
  if (pid === 1) return PLAYER_1_COLOR;
  if (pid === 3) return PLAYER_3_COLOR;
  // team 2
  return controlledBy === "cpu" ? CPU_COLOR : (pid === 2 ? PLAYER_2_COLOR : PLAYER_4_COLOR);
}
```

For this mode specifically, P2 and P4 are both CPU, so both could be `CPU_COLOR` or you could use `CPU_COLOR` for P2 and `PLAYER_4_COLOR` for P4 to distinguish them.

### Tile occupation

The `hasPlayer` check in `drawTile` loops only P1/P2. Change to loop all active players to suppress floor dots under any player.

---

## 7. HUD (`GameScene.ts`)

### Score

Change from `p1` / `p2` scores to `team1` / `team2`. The HUD labels become "Team 1" and "Team 2" (or custom names). Score bars remain as-is but reference team scores.

### Status boxes

Currently 3 status cells per player (Fly Armed, Has Ball, Steps Left) × 2 players = 6 cells. With 4 players, you have 12 cells — too many for one row.

**Layout option:** Stack two rows per side.

```
 [P1 Fly] [P1 Ball] [P1 Steps]      [P2 Fly] [P2 Ball] [P2 Steps]
 [P3 Fly] [P3 Ball] [P3 Steps]      [P4 Fly] [P4 Ball] [P4 Steps]
```

Each row uses the existing `createStatusHudCell` + `drawStatusCell` pattern. Add a second `boxY` row at `boxY + STATUS_BOX_FONT_PX + STATUS_BOX_TEXT_MARGIN * 2 + gap`.

### Player labels

Replace "Player 1" / "Player 2" with "Team 1" / "Team 2" or show both names: "P1, P3" and "CPU, CPU".

### Debug HUD

Add P3 and P4 positions and flying status to `refreshDebugHud`.

---

## 8. Win Scene (`WinScene.ts`)

`WinScene` receives `winner: 1 | 2`. Change to `winnerTeam: 1 | 2`. Display "Team 1 wins!" or "CPU Team wins!".

`getWinningPlayer` becomes `getWinningTeam`:

```typescript
private getWinningTeam(state: GameState): 1 | 2 | null {
  if (state.score.team1 >= this.targetScore) return 1;
  if (state.score.team2 >= this.targetScore) return 2;
  return null;
}
```

---

## 9. Countdown & Goal Scored

`startCountdown(scorer)` currently says "Player 1 Goal!" or "CPU Goal!". Change to show team: "Team 1 Goal!" with appropriate color.

---

## 10. Replay System (`replayLog.ts`)

The replay log stores full `GameState` snapshots. As long as `GameState` is serializable with 4 players, replays work automatically. Verify that `pushState` and the replay playback scene handle the new `players` shape.

---

## 11. Config & Menu Integration

### `gameModes.ts`

Remove `"ONE_ONE_V_CPU_CPU"` from `COMING_SOON_MODES`.

### `isPlayer2Active`

Rename/refactor to something like `activePlayerCount(mode)` or `isTeamMode(mode)`.

### Title menu V colors

Already handled — `vSpecForMode` returns `{ left: { colors: [P1, P2] }, right: { static: CPU } }` for this mode, which is correct (left V flashes between P1 green and P3's color, right V is static CPU silver).

---

## 12. Pause Screen

Update the controls label in the pause overlay:

```
P1: WASD move, Q fly, E action
P3: IJKL/Arrows move, U fly, O/. action
CPU: P2, P4 (auto)
```

---

## Summary: File Change Map

| File | Change |
|------|--------|
| `types.ts` | `PlayerId` type, team field, 4-player records |
| `init.ts` | Spawn 4 players with team assignments |
| `update.ts` | Multi-player collision, team-based scoring, `activePlayers()` loops |
| `cpu/*.ts` | Parameterize by `cpuId`, teammate awareness |
| `keyboard.ts` | Route P2 keys to P3 when in this mode |
| `phaserRenderer.ts` | Draw 4 players, 4 colors, multi-player tile occupation |
| `GameScene.ts` | Dual CPU ticks, 4-player HUD, command routing, team scoring |
| `WinScene.ts` | Team-based winner display |
| `gameModes.ts` | Remove from coming soon, add helpers |
| `colors.ts` | Already has P3/P4 colors — just wire them up |
| `replayLog.ts` | Verify 4-player state serialization |
| `display.ts` | Possibly adjust `HUD_HEIGHT` for two status rows |
