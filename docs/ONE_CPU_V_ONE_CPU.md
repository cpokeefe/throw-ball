# ONE_CPU_V_ONE_CPU — Implementation Guide

> **Two mixed teams: (P1 human + P2 CPU) vs. (P3 human + P4 CPU)**
> Each human is paired with a CPU teammate. The unique challenge: two humans on *different* teams using the same keyboard.

---

## Prerequisites

This guide assumes the foundational 4-player infrastructure from the ONE_ONE_V_CPU_CPU guide is already in place:
- `PlayerId = 1 | 2 | 3 | 4` with `.team` and `.controlledBy` fields
- `activePlayers()` helper, multi-player collision checks
- Team-based scoring (`score.team1` / `score.team2`)
- Renderer draws 4 players, CPU strategies accept `cpuId` parameter

This document focuses on what's **unique** to this mode.

---

## 1. Team Composition

| Player | Team | Control | Color | Spawn Side |
|--------|------|---------|-------|------------|
| P1 | 1 (left) | human | `PLAYER_1_COLOR` (green) | Goal1, offset up |
| P2 | 1 (left) | cpu | `CPU_COLOR` (silver) | Goal1, offset down |
| P3 | 2 (right) | human | `PLAYER_2_COLOR` (magenta) | Goal2, offset up |
| P4 | 2 (right) | cpu | `CPU_COLOR` (silver) | Goal2, offset down |

This is the only mode where **both** CPU players are on **different** teams and both human players are on **different** teams, meaning the CPU AI for P2 should try to score on Goal2, and the CPU AI for P4 should try to score on Goal1.

---

## 2. Input Routing — The Core Complexity

In ONE_V_ONE, P1 uses WASD/Q/E and P2 uses IJKL/U/O. Here, P1 and P3 are **opponents**, but they share the same physical keyboard.

### Option A: Keep the same bindings, remap player IDs

The keyboard adapter already emits commands for `playerId: 1` (WASD) and `playerId: 2` (IJKL). Remap at the `GameScene` level:

```typescript
// In the command processing loop:
for (const command of commands) {
  let pid = command.playerId;
  if (this.mode === "ONE_CPU_V_ONE_CPU" && pid === 2) {
    pid = 3; // IJKL controls P3 (team 2 human), not P2 (team 1 CPU)
  }
  if (command.type !== "ADVANCE_BALL") {
    command = { ...command, playerId: pid };
  }
  // skip if this player is CPU-controlled
  if (state.players[pid].controlledBy === "cpu") continue;
  next = update(next, command);
}
```

This is the simplest approach and preserves the existing keyboard adapter unchanged.

### Option B: Add a control mapping layer

Create a `ControlMap` that maps physical input slots to player IDs per mode:

```typescript
const CONTROL_MAP: Record<GameMode, { slot1: PlayerId; slot2: PlayerId }> = {
  "ONE_V_ONE":         { slot1: 1, slot2: 2 },
  "ONE_V_CPU":         { slot1: 1, slot2: 2 },  // slot2 ignored
  "ONE_ONE_V_CPU_CPU": { slot1: 1, slot2: 3 },
  "ONE_CPU_V_ONE_CPU": { slot1: 1, slot2: 3 },
  "ONE_ONE_V_ONE_ONE": { slot1: 1, slot2: 2 },  // needs expansion, see that doc
  "PRACTICE":          { slot1: 1, slot2: 2 },
};
```

Option B is more maintainable — recommend this approach since it centralizes the mapping for all modes.

---

## 3. CPU AI — Asymmetric Teams

### Two CPUs on opposing teams

Unlike ONE_ONE_V_CPU_CPU (where both CPUs cooperate), here P2's CPU and P4's CPU are **enemies**. Each CPU's opponent set is different:

```
P2 (team 1 CPU): opponents are P3, P4. Teammate is P1.
P4 (team 2 CPU): opponents are P1, P2. Teammate is P3.
```

### CPU strategy parameterization

Each strategy already needs a `cpuId` parameter (from the ONE_ONE_V_CPU_CPU work). The critical additions:

1. **Opponent lookup**: Replace `state.players[1]` with a function:
   ```typescript
   function nearestOpponent(state: GameState, myId: PlayerId): PlayerState {
     const myTeam = state.players[myId].team;
     let nearest: PlayerState | null = null;
     let bestDist = Infinity;
     for (const pid of activePlayers(state)) {
       if (state.players[pid].team === myTeam) continue;
       const d = manhattan(state.players[myId].position, state.players[pid].position);
       if (d < bestDist) { bestDist = d; nearest = state.players[pid]; }
     }
     return nearest!;
   }
   ```

2. **Teammate awareness**: The CPU should avoid occupying the same tiles as its human teammate, and prefer passing lanes that the human can follow up on. Minimal version: just avoid teammate collision (already handled by `isOccupiedByPlayer`). Advanced version: if teammate has ball and is near opponent goal, CPU moves to create space.

3. **BFS pathfinding obstacle list**: `cpuBfsFirstStep` currently only avoids P1. Change to avoid all players except self:
   ```typescript
   // Inside BFS loop:
   if (pid !== cpuId && sameCoord(state.players[pid].position, { x: nx, y: ny })) continue;
   ```

### CPU tick timing

Both CPUs can share the same `cpuTickMs` and accumulator, or use separate accumulators to desync their decisions:

```typescript
// Separate accumulators create more natural-looking play
private cpu1AccumulatorMs = 0;  // for P2
private cpu2AccumulatorMs = 0;  // for P4
```

Offsetting their initial accumulators (e.g., one starts at `cpuTickMs / 2`) prevents simultaneous moves, which looks more organic.

---

## 4. The "Friendly Fire" Question

### Can a CPU score on its own goal?

The current scoring logic in `advanceAutoBall` uses `thrownBy` to determine *which* goal is the "opponent goal." If P2 (team 1) throws the ball and it enters Goal1 (team 1's own goal), `isOpponentGoalTile(state, P2, ...)` returns false, so it doesn't score. This is correct — own goals are prevented by the existing design.

### Can a player punch their teammate?

Currently `applyAction` punches/steals from whichever adjacent player has the ball. With teammates, add a team check:

```typescript
// Only steal from opponents
if (isAdjacent(player.position, other.position) && other.hasBall && other.team !== player.team) {
  return punch(state, playerId, otherId);
}
```

Decide whether teammates can *pass* to each other. Simplest: don't allow explicit passing — the ball is thrown in the facing direction regardless of who's there. If it hits a teammate, the teammate can pick it up. This creates emergent passing.

---

## 5. HUD Layout

### Player labels

With mixed teams, the HUD needs to show team composition clearly:

```
Left side:  "P1 (You)"     "P2 (CPU)"
Right side: "P3 (Them)"    "P4 (CPU)"
```

Or more concisely:

```
Left side:  "P1, CPU"    Right side:  "P3, CPU"
```

### Status boxes — 4-player layout

Same two-row approach as ONE_ONE_V_CPU_CPU:

```
Left (Team 1):                          Right (Team 2):
[P1 Fly] [P1 Ball] [P1 Steps]          [P3 Fly] [P3 Ball] [P3 Steps]
[P2 Fly] [P2 Ball] [P2 Steps]          [P4 Fly] [P4 Ball] [P4 Steps]
```

Color each row to match the player's color. CPU rows could use a dimmer alpha to visually subordinate them.

### Score display

Same team-based scoring as ONE_ONE_V_CPU_CPU. The center shows "First to N!" with team scores on either side.

---

## 6. Rendering

### Player colors for this mode

```
P1: PLAYER_1_COLOR (0x00ff00 green)     — team 1, human
P2: CPU_COLOR      (0xc0c0c0 silver)    — team 1, cpu
P3: PLAYER_2_COLOR (0xff00ff magenta)   — team 2, human
P4: CPU_COLOR      (0xc0c0c0 silver)    — team 2, cpu
```

Problem: P2 and P4 are both `CPU_COLOR`. Players can't tell which CPU is on which team. Solutions:

**Option A:** Tint CPU players with their team's hue — e.g., P2 gets a greenish-silver, P4 gets a pinkish-silver. Implement by blending:
```typescript
function cpuTeamColor(teamColor: number): number {
  // 50% blend of CPU_COLOR and team primary
  return blendColors(CPU_COLOR, teamColor, 0.5);
}
```

**Option B:** Keep `CPU_COLOR` but add a small team-colored dot or underline beneath the chevron.

**Option C (simplest):** Use `PLAYER_3_COLOR` (cyan) for P2 and `PLAYER_4_COLOR` (orange) for P4, ignoring that they're CPUs. The title menu V colors already flash `[P1, CPU]` and `[P2, CPU]`, confirming they're mixed.

### Goal colors

Goals should show team colors, not individual player colors. `getGoalColor` in the renderer currently maps by `goalsSwapped` + player ID. Change to map by team:

```typescript
private getGoalColor(state: GameState, goalTile: Tile.Goal1 | Tile.Goal2): number {
  const team1Color = PLAYER_1_COLOR;  // team 1's primary color
  const team2Color = PLAYER_2_COLOR;  // team 2's primary color
  if (!state.goalsSwapped) {
    return goalTile === Tile.Goal1 ? team1Color : team2Color;
  }
  return goalTile === Tile.Goal1 ? team2Color : team1Color;
}
```

---

## 7. Countdown & Goal Announcements

When a goal is scored, show "Team 1 Goal!" or "Team 2 Goal!" with the team's color. The `scorer` is determined from `ball.thrownBy` → look up team:

```typescript
const scorerTeam = next.players[next.ball.thrownBy!].team;
const label = scorerTeam === 1 ? "Team 1" : "Team 2";
```

---

## 8. Win Scene

Display "Team 1 wins!" or "Team 2 wins!" with appropriate team color. Could also show the composition: "P1 & CPU win!" or "P3 & CPU win!".

---

## 9. Pause Screen Controls Label

```
P1: WASD move, Q fly, E action  (Team 1)
P3: IJKL/Arrows move, U fly, O/. action  (Team 2)
P2, P4: CPU (auto)
```

---

## 10. Edge Cases

### Both CPUs chasing the same ball

Since they're on opposing teams, this is fine — they're competing for it. No deduplication needed.

### Human and their CPU teammate both adjacent to the ball

Whoever presses action first (human) or whose CPU tick fires first gets it. This is emergent and intentional.

### CPU throws ball at own teammate

The ball is thrown in the facing direction. If a teammate is in the path, the ball stops (blocked by player). The teammate can then pick it up. This creates accidental passing — a feature, not a bug.

### Goal swap after scoring

`goalsSwapped` flips after each goal. All four players must respawn on their team's *new* side. The `scoreAndResetRound` function must spawn all 4 players using team-appropriate goal tiles.

---

## 11. Config & Menu

### `gameModes.ts`

Remove `"ONE_CPU_V_ONE_CPU"` from `COMING_SOON_MODES`.

### Title menu V colors

Already handled: `vSpecForMode` returns `{ left: { colors: [P1, CPU] }, right: { colors: [P2, CPU] } }`, both V's flash.

---

## Summary: File Change Map (beyond shared 4-player infrastructure)

| File | Change |
|------|--------|
| `GameScene.ts` | Input remapping (IJKL → P3), dual CPU accumulators on different teams, controls label |
| `cpu/*.ts` | Opponent lookup by team, avoid teammates vs. opponents distinction |
| `update.ts` | Team-check for punch/steal (no friendly fire) |
| `phaserRenderer.ts` | CPU color differentiation per team, team-based goal colors |
| `WinScene.ts` | Team-based winner with mixed composition label |
| `gameModes.ts` | Remove from coming soon |
| `init.ts` | 4-player spawn with correct team/control assignments |
