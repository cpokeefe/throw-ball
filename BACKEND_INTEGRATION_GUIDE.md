# Throw Ball — Backend Integration Guide

This document is a comprehensive, step-by-step guide for adding a backend to the Throw Ball web game. It covers everything from extracting shared game logic into a standalone package, to designing network protocols, building an authoritative server, adapting the client, handling matchmaking, and deploying the whole thing.

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [High-Level Backend Architecture](#2-high-level-backend-architecture)
3. [Extracting Shared Game Logic](#3-extracting-shared-game-logic)
4. [Network Protocol Design](#4-network-protocol-design)
5. [Server Implementation](#5-server-implementation)
6. [Client-Side Changes](#6-client-side-changes)
7. [State Synchronization Strategy](#7-state-synchronization-strategy)
8. [Matchmaking and Lobbies](#8-matchmaking-and-lobbies)
9. [Handling Game Modes on the Server](#9-handling-game-modes-on-the-server)
10. [Server-Side CPU AI](#10-server-side-cpu-ai)
11. [Map Generation](#11-map-generation)
12. [Replay System Adaptation](#12-replay-system-adaptation)
13. [Security and Anti-Cheat](#13-security-and-anti-cheat)
14. [Persistence and Databases](#14-persistence-and-databases)
15. [Deployment and Infrastructure](#15-deployment-and-infrastructure)
16. [Migration Roadmap](#16-migration-roadmap)

---

## 1. Current Architecture Overview

### Project Structure

The game lives entirely in `web/src/` and runs as a client-only Phaser 3 application built with Vite and TypeScript. There is no backend — all game logic, rendering, input, and AI run in the browser.

```
web/src/
├── main.ts                          # Phaser bootstrap, HTML shell wiring
├── siteBridge.ts                    # Global site controls (fullscreen, mute, quit)
├── config/
│   ├── colors.ts                    # Hex palette, player/CPU colors
│   ├── display.ts                   # Tile size, map dimensions, HUD layout
│   ├── gameModes.ts                 # Game mode definitions and helpers
│   ├── rules.ts                     # Steps per possession, score to win, tick rates
│   ├── renderer.ts                  # Visual ratio constants for PhaserRenderer
│   └── env.ts                       # IS_TEST_MODE flag
├── core/
│   ├── types.ts                     # All type definitions (GameState, Command, etc.)
│   ├── init.ts                      # createInitialState(seed, mode)
│   ├── update.ts                    # Pure update(state, command) function
│   ├── geometry.ts                  # Coordinate math, spawning helpers
│   ├── random.ts                    # Seeded RNG for map generation
│   ├── replayLog.ts                 # ReplayLog type and helpers
│   ├── map/generator.ts             # Default procedural map generator
│   ├── mapgen/                      # 6 map generation strategies (0–5)
│   └── cpu/                         # CPU AI strategies (0–5)
├── adapters/
│   ├── input/keyboard.ts            # KeyboardAdapter → Command[]
│   └── render/phaserRenderer.ts     # PhaserRenderer.draw(state)
├── input/
│   └── colonCommands.ts             # Vim-style colon commands (:f, :m, :e, :q, :space)
└── scenes/
    ├── BootScene.ts                 # Entry point router
    ├── TitleMenuScene.ts            # Main menu
    ├── GameModeSelectScene.ts        # Mode picker
    ├── GameScene.ts                 # Main game loop (THE critical file)
    ├── WinScene.ts                  # Winner screen
    ├── ReplayScene.ts               # Replay playback
    ├── SettingsScene.ts             # Score target, CPU level, seed options
    ├── SeedScene.ts                 # Manual seed entry
    ├── GuideScene.ts                # Help text
    ├── ComingSoonScene.ts           # Placeholder for unimplemented modes
    └── titleEasterEggs.ts           # Title screen animations
```

### The Type System

The game's entire state is captured in a single `GameState` interface:

```typescript
interface GameState {
  tick: number;                           // Monotonic counter, incremented on every state change
  seed: number;                           // Map generation seed
  rngState: number;                       // Deterministic RNG state (for punch outcomes)
  mode: GameMode;                         // "PRACTICE" | "ONE_V_ONE" | "ONE_V_CPU" | ...
  goalsSwapped: boolean;                  // Goals swap sides after each score
  map: GameMap;                           // { width, height, tiles: Tile[][], rooms }
  players: Record<1 | 2, PlayerState>;    // Both player states
  ball: BallState;                        // Ball position and flight state
  score: { p1: number; p2: number };      // Current scores
  lastGoalTick: number;                   // Tick when the last goal was scored
}
```

Player commands are a tagged union:

```typescript
type Command =
  | { type: "MOVE"; playerId: 1 | 2; direction: "N" | "E" | "S" | "W" }
  | { type: "ACTION"; playerId: 1 | 2 }
  | { type: "TOGGLE_FLY"; playerId: 1 | 2 }
  | { type: "ADVANCE_BALL" };
```

### The Update Function

The core game logic is a **pure function**: `update(state, command) → GameState`. It handles movement, throwing, grabbing, punching (50/50 RNG via `rngState`), fly mode, ball flight, and goal scoring/round reset. It never touches the DOM, Phaser, or any I/O.

### The Game Loop (GameScene.update)

`GameScene.update` runs every Phaser frame and does the following in order:

1. **Ball advancement** — accumulates real time; fires `ADVANCE_BALL` commands every 3ms (`SIM_TICK_MS.ball`)
2. **Fly advancement** — fires `null` updates (auto-fly glide) every 6ms (`SIM_TICK_MS.fly`)
3. **CPU decisions** — if `ONE_V_CPU` mode, fires `applyCpuDecision` every `cpuTickMs` (100–500ms based on difficulty)
4. **Player input** — polls `KeyboardAdapter` for pressed keys, converts to `Command[]`, applies each via `update()`
5. **Win check** — transitions to `WinScene` if a player hits the target score
6. **Goal detection** — triggers countdown overlay between rounds

### Key Properties That Matter for Backend Integration

- **Pure game logic**: `update()` is already a pure function with no side effects. This is the single most important property — the same function can run identically on a server.
- **Deterministic RNG**: Punch outcomes use a seeded LCG (`rngState`), so given the same sequence of commands and the same initial state, the game will always produce the same result.
- **Serializable state**: `GameState` is a plain object with no class instances, closures, or circular references. It can be `JSON.stringify`'d directly.
- **Command-driven**: All mutations go through discrete `Command` objects, which are trivially serializable and networkable.
- **Tick-based simulation**: The game already uses accumulator-based sub-stepping for ball and fly physics, which maps cleanly to a server tick model.

---

## 2. High-Level Backend Architecture

### Recommended Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | **Node.js** (or Bun/Deno) | Reuse the exact TypeScript game logic without transpilation to another language |
| Transport | **WebSockets** (via `ws` or Socket.IO) | Low-latency bidirectional communication required for real-time gameplay |
| HTTP API | **Express** or **Fastify** | Lobby management, matchmaking, account endpoints |
| Database | **PostgreSQL** (or SQLite for small scale) | Player accounts, match history, replay storage |
| Cache | **Redis** (optional) | Matchmaking queue, session tokens, rate limiting |

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                       CLIENTS                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │
│  │  Browser A   │  │  Browser B   │  │  Browser C   │    │
│  │  (Phaser +   │  │  (Phaser +   │  │  (Spectator) │    │
│  │  WebSocket)  │  │  WebSocket)  │  │              │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │ WebSocket       │ WebSocket       │ WebSocket
          ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│                     GAME SERVER                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              WebSocket Gateway                      │  │
│  │  • Authenticate connections                        │  │
│  │  • Route messages to correct GameRoom              │  │
│  └────────────────┬───────────────────────────────────┘  │
│                   │                                      │
│  ┌────────────────▼───────────────────────────────────┐  │
│  │              Game Room Manager                      │  │
│  │                                                     │  │
│  │  ┌──────────────┐  ┌──────────────┐                │  │
│  │  │  GameRoom A   │  │  GameRoom B   │  ...          │  │
│  │  │              │  │              │                │  │
│  │  │  GameState   │  │  GameState   │                │  │
│  │  │  update()    │  │  update()    │                │  │
│  │  │  Tick loop   │  │  Tick loop   │                │  │
│  │  └──────────────┘  └──────────────┘                │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │              HTTP API (REST)                        │  │
│  │  • POST /api/matchmake                             │  │
│  │  • GET  /api/replays/:id                           │  │
│  │  • POST /api/auth/login                            │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Shared Game Logic (core/)                  │  │
│  │  • types.ts, update.ts, init.ts                    │  │
│  │  • geometry.ts, mapgen/, cpu/                      │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────┐
│                     DATABASE                             │
│  • Player accounts & profiles                            │
│  • Match history & results                               │
│  • Replay data (serialized command logs)                  │
│  • Leaderboards                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Extracting Shared Game Logic

The game logic must be shared between server and client. This means pulling the pure logic out of the `web/` Phaser project into a standalone package.

### Step 3.1 — Create a Shared Package

Restructure the repo to have a shared package:

```
throw-ball/
├── packages/
│   ├── game-core/                   # Shared pure game logic
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types.ts             # GameState, Command, etc.
│   │       ├── update.ts            # Pure update function
│   │       ├── init.ts              # createInitialState
│   │       ├── geometry.ts          # Coordinate math
│   │       ├── random.ts            # Seeded RNG
│   │       ├── rules.ts             # Game rules constants
│   │       ├── gameModes.ts         # Mode definitions
│   │       ├── replayLog.ts         # Replay data structures
│   │       ├── map/                 # Map generators
│   │       │   └── generator.ts
│   │       ├── mapgen/              # All 6 map strategies
│   │       │   ├── index.ts
│   │       │   ├── mapgen1_caves.ts
│   │       │   └── ...
│   │       └── cpu/                 # CPU AI strategies
│   │           ├── index.ts
│   │           └── ...
│   ├── server/                      # New backend
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── ...
│   └── web/                         # Existing Phaser client (moved from web/)
│       ├── package.json
│       └── src/
│           └── ...
├── package.json                     # Root workspace config
└── tsconfig.base.json
```

### Step 3.2 — Set Up a Monorepo Workspace

Use npm workspaces (already using npm based on `package-lock.json`):

```json
// Root package.json
{
  "name": "throw-ball",
  "private": true,
  "workspaces": [
    "packages/game-core",
    "packages/server",
    "packages/web"
  ]
}
```

### Step 3.3 — Files to Move into `game-core`

These files contain **zero** Phaser or DOM dependencies and can move directly:

| Current Path | New Path in `game-core/src/` | Notes |
|---|---|---|
| `web/src/core/types.ts` | `types.ts` | Move as-is |
| `web/src/core/update.ts` | `update.ts` | **Remove the legacy `applyCpuDecision` and all CPU helper functions below line 284** — only keep the pure `update()` and its direct helpers (`applyMove`, `applyAction`, `throwBall`, `scoreAndResetRound`, `toggleFly`, `advanceAutoFly`, `advanceAutoBall`, etc.) |
| `web/src/core/init.ts` | `init.ts` | Move as-is |
| `web/src/core/geometry.ts` | `geometry.ts` | Move as-is |
| `web/src/core/random.ts` | `random.ts` | Move as-is |
| `web/src/core/replayLog.ts` | `replayLog.ts` | Move as-is |
| `web/src/core/map/generator.ts` | `map/generator.ts` | Move as-is |
| `web/src/core/mapgen/*.ts` | `mapgen/*.ts` | Move all 6 strategies + utils |
| `web/src/core/cpu/*.ts` | `cpu/*.ts` | Move all strategies + utils + index |
| `web/src/config/rules.ts` | `rules.ts` | Move as-is |
| `web/src/config/gameModes.ts` | `gameModes.ts` | Move as-is (no Phaser deps) |

### Step 3.4 — Update Imports

After moving, both `packages/web` and `packages/server` import from `@throw-ball/game-core`:

```typescript
// Before (in web/src/scenes/GameScene.ts):
import { update } from "../core/update";
import { GameState, Command } from "../core/types";

// After:
import { update, GameState, Command } from "@throw-ball/game-core";
```

### Step 3.5 — game-core package.json

```json
{
  "name": "@throw-ball/game-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Create an `index.ts` barrel export:

```typescript
export * from "./types";
export { update, applyMove, applyAction, toggleFly } from "./update";
export { createInitialState } from "./init";
export { generateMap, MAPGEN_STRATEGY } from "./mapgen";
export { applyCpuDecision, CPU_STRATEGY } from "./cpu";
export { STEPS_PER_POSSESSION, GAME_RULES, SIM_TICK_MS, CPU_TICK_MS, cpuTickForLevel } from "./rules";
export { isPlayer2Active, isComingSoon, GAME_MODES, DEFAULT_GAME_MODE } from "./gameModes";
export * from "./geometry";
export * from "./replayLog";
```

### Step 3.6 — Clean Up the Legacy CPU Code in update.ts

`update.ts` currently contains a full copy of CPU AI logic (lines 284–554) that `GameScene` does not use — it imports from `core/cpu/index.ts` instead. When extracting to `game-core`, **delete lines 284–554 from update.ts** entirely. This eliminates the duplicate and ensures a single source of truth for CPU behavior.

---

## 4. Network Protocol Design

### Transport: WebSockets

The game requires sub-100ms round trips for acceptable responsiveness. WebSockets provide persistent, low-overhead bidirectional channels.

### Message Format

Use JSON messages with a `type` discriminator. Each message is small (under 500 bytes), so JSON overhead is negligible.

### Client → Server Messages

```typescript
// Player wants to join the matchmaking queue
type C2S_QueueJoin = {
  type: "QUEUE_JOIN";
  mode: GameMode;        // Which game mode to queue for
  settings?: {
    targetScore?: number;
    mapStrategy?: number;
  };
};

// Player cancels queue
type C2S_QueueLeave = {
  type: "QUEUE_LEAVE";
};

// Player sends a game command during a match
type C2S_Command = {
  type: "COMMAND";
  roomId: string;
  command: PlayerCommand; // Only MOVE, ACTION, TOGGLE_FLY — never ADVANCE_BALL
  clientTick: number;     // Client's local tick for lag compensation
  seq: number;            // Monotonic sequence number for ordering
};

// Player acknowledges the full state snapshot
type C2S_StateAck = {
  type: "STATE_ACK";
  roomId: string;
  tick: number;           // The tick number the client has confirmed receiving
};

// Restrict what the client can send — no ADVANCE_BALL (server-only)
type PlayerCommand =
  | { type: "MOVE"; direction: Direction }
  | { type: "ACTION" }
  | { type: "TOGGLE_FLY" };
```

**Important:** The client sends commands *without* `playerId`. The server knows which player each WebSocket connection belongs to and injects the correct `playerId` before applying the command. This prevents a player from sending commands for their opponent.

### Server → Client Messages

```typescript
// Match found, game is starting
type S2C_GameStart = {
  type: "GAME_START";
  roomId: string;
  playerId: 1 | 2;           // Which player you are
  initialState: GameState;    // Full initial state including the map
  targetScore: number;
  opponentName?: string;
};

// Authoritative state update (sent every server tick)
type S2C_StateUpdate = {
  type: "STATE_UPDATE";
  tick: number;
  // Delta or full state — see §7 for strategy discussion
  state: GameState;
  lastProcessedSeq: Record<1 | 2, number>; // Last seq# processed per player
};

// A goal was scored
type S2C_GoalScored = {
  type: "GOAL_SCORED";
  scorer: 1 | 2;
  score: { p1: number; p2: number };
};

// Game over
type S2C_GameOver = {
  type: "GAME_OVER";
  winner: 1 | 2;
  finalScore: { p1: number; p2: number };
  replayId?: string;          // If replay was saved
};

// Opponent disconnected
type S2C_OpponentDisconnected = {
  type: "OPPONENT_DISCONNECTED";
  gracePeriodMs: number;      // How long before forfeit
};

// Opponent reconnected
type S2C_OpponentReconnected = {
  type: "OPPONENT_RECONNECTED";
};

// Server error
type S2C_Error = {
  type: "ERROR";
  code: string;
  message: string;
};

// Matchmaking status
type S2C_QueueStatus = {
  type: "QUEUE_STATUS";
  position: number;
  estimatedWaitMs: number;
};
```

### Message Encoding Considerations

JSON is fine to start with. If bandwidth becomes a concern, consider:

- **MessagePack**: Drop-in binary JSON replacement, ~30% smaller
- **FlatBuffers/Protocol Buffers**: More complex but near-zero allocation parsing
- **Custom binary encoding**: Only if profiling shows JSON is the bottleneck (unlikely for this game's message sizes)

---

## 5. Server Implementation

### Step 5.1 — Project Setup

```bash
mkdir -p packages/server/src
cd packages/server
npm init -y
npm install ws express
npm install -D typescript @types/ws @types/express @types/node
```

`packages/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022"
  },
  "include": ["src"],
  "references": [
    { "path": "../game-core" }
  ]
}
```

### Step 5.2 — GameRoom Class

This is the heart of the server. Each active match is a `GameRoom` that owns a `GameState` and a server-side tick loop.

```typescript
import {
  GameState,
  Command,
  GameMode,
  createInitialState,
  update,
  applyCpuDecision,
  SIM_TICK_MS,
  cpuTickForLevel,
} from "@throw-ball/game-core";
import { WebSocket } from "ws";

const SERVER_TICK_RATE_MS = 16; // ~60 ticks/sec

interface ConnectedPlayer {
  ws: WebSocket;
  playerId: 1 | 2;
  lastSeq: number;
  pendingCommands: Array<{ command: Command; seq: number }>;
  connected: boolean;
  disconnectedAt?: number;
}

class GameRoom {
  readonly id: string;
  private state: GameState;
  private players: Map<string, ConnectedPlayer> = new Map();
  private tickInterval: NodeJS.Timeout | null = null;
  private ballAccumulatorMs = 0;
  private flyAccumulatorMs = 0;
  private cpuAccumulatorMs = 0;
  private targetScore: number;
  private cpuTickMs: number;
  private isCpu: boolean;
  private replayCommands: Array<{ tick: number; command: Command }> = [];

  constructor(
    id: string,
    seed: number,
    mode: GameMode,
    targetScore: number,
    cpuLevel?: string
  ) {
    this.id = id;
    this.state = createInitialState(seed, mode);
    this.targetScore = targetScore;
    this.isCpu = mode === "ONE_V_CPU";
    this.cpuTickMs = cpuTickForLevel(cpuLevel);
  }

  addPlayer(sessionId: string, ws: WebSocket, playerId: 1 | 2): void {
    this.players.set(sessionId, {
      ws,
      playerId,
      lastSeq: -1,
      pendingCommands: [],
      connected: true,
    });
  }

  start(): void {
    // Send GAME_START to both players
    for (const [, player] of this.players) {
      this.send(player.ws, {
        type: "GAME_START",
        roomId: this.id,
        playerId: player.playerId,
        initialState: this.state,
        targetScore: this.targetScore,
      });
    }

    // Start the authoritative tick loop
    let lastTime = Date.now();
    this.tickInterval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTime;
      lastTime = now;
      this.tick(delta);
    }, SERVER_TICK_RATE_MS);
  }

  handleCommand(sessionId: string, command: PlayerCommand, seq: number): void {
    const player = this.players.get(sessionId);
    if (!player || !player.connected) return;

    // Server injects the correct playerId — never trust the client
    const fullCommand: Command = {
      ...command,
      playerId: player.playerId,
    } as Command;

    player.pendingCommands.push({ command: fullCommand, seq });
  }

  private tick(deltaMs: number): void {
    let next = this.state;

    // 1. Ball advancement (same timing as client)
    this.ballAccumulatorMs += deltaMs;
    while (this.ballAccumulatorMs >= SIM_TICK_MS.ball) {
      next = update(next, { type: "ADVANCE_BALL" });
      this.ballAccumulatorMs -= SIM_TICK_MS.ball;
    }

    // 2. Fly advancement
    this.flyAccumulatorMs += deltaMs;
    while (this.flyAccumulatorMs >= SIM_TICK_MS.fly) {
      next = update(next, null);
      this.flyAccumulatorMs -= SIM_TICK_MS.fly;
    }

    // 3. CPU decisions (ONE_V_CPU mode)
    if (this.isCpu) {
      this.cpuAccumulatorMs += deltaMs;
      while (this.cpuAccumulatorMs >= this.cpuTickMs) {
        next = applyCpuDecision(next);
        this.cpuAccumulatorMs -= this.cpuTickMs;
      }
    }

    // 4. Process queued player commands
    const processedSeqs: Record<1 | 2, number> = { 1: -1, 2: -1 };
    for (const [, player] of this.players) {
      for (const { command, seq } of player.pendingCommands) {
        // Validate the command before applying
        if (this.isValidCommand(command, player.playerId)) {
          next = update(next, command);
          this.replayCommands.push({ tick: next.tick, command });
        }
        processedSeqs[player.playerId] = seq;
      }
      player.pendingCommands = [];
      player.lastSeq = processedSeqs[player.playerId];
    }

    // 5. Check for goal / win
    if (next !== this.state) {
      const goalScored = next.lastGoalTick > this.state.lastGoalTick;
      this.state = next;

      if (goalScored) {
        this.broadcast({
          type: "GOAL_SCORED",
          scorer: next.score.p1 > this.state.score.p1 ? 1 : 2,
          score: next.score,
        });
      }

      const winner = this.getWinner();
      if (winner !== null) {
        this.broadcast({
          type: "GAME_OVER",
          winner,
          finalScore: this.state.score,
        });
        this.stop();
        return;
      }

      // 6. Broadcast authoritative state
      this.broadcast({
        type: "STATE_UPDATE",
        tick: this.state.tick,
        state: this.state,
        lastProcessedSeq: processedSeqs,
      });
    }
  }

  private isValidCommand(command: Command, expectedPlayerId: 1 | 2): boolean {
    if (command.type === "ADVANCE_BALL") return false; // Only the server sends these
    if ("playerId" in command && command.playerId !== expectedPlayerId) return false;
    return true;
  }

  private getWinner(): 1 | 2 | null {
    if (this.state.score.p1 >= this.targetScore) return 1;
    if (this.state.score.p2 >= this.targetScore) return 2;
    return null;
  }

  private broadcast(message: object): void {
    const data = JSON.stringify(message);
    for (const [, player] of this.players) {
      if (player.connected) {
        player.ws.send(data);
      }
    }
  }

  private send(ws: WebSocket, message: object): void {
    ws.send(JSON.stringify(message));
  }

  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
```

### Step 5.3 — WebSocket Server Entry Point

```typescript
import { WebSocketServer, WebSocket } from "ws";
import express from "express";
import { createServer } from "http";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map<string, GameRoom>();

wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (raw: Buffer) => {
    const msg = JSON.parse(raw.toString());

    switch (msg.type) {
      case "QUEUE_JOIN":
        handleQueueJoin(ws, msg);
        break;
      case "COMMAND":
        handleCommand(ws, msg);
        break;
      case "STATE_ACK":
        handleStateAck(ws, msg);
        break;
    }
  });

  ws.on("close", () => {
    handleDisconnect(ws);
  });
});

server.listen(3001, () => {
  console.log("Game server running on :3001");
});
```

### Step 5.4 — Server Tick Timing Deep Dive

The current client uses these tick rates in `rules.ts`:

| System | Interval | Purpose |
|--------|----------|---------|
| `SIM_TICK_MS.ball` | 3ms | Ball flight advancement |
| `SIM_TICK_MS.fly` | 6ms | Player fly glide advancement |
| `CPU_TICK_MS` | 100–500ms | CPU AI decision frequency |

The server tick loop at 60Hz (16ms) means:
- ~5 ball advances per server tick
- ~2-3 fly advances per server tick
- CPU decisions fire at their own accumulator cadence

This exactly mirrors how `GameScene.update` works — it uses the same accumulator pattern with real delta time. The server replicates this 1:1.

---

## 6. Client-Side Changes

### Step 6.1 — Add a NetworkAdapter

Create a new adapter alongside `KeyboardAdapter`:

```typescript
// web/src/adapters/network/websocketAdapter.ts

type ServerMessage = S2C_GameStart | S2C_StateUpdate | S2C_GoalScored
                   | S2C_GameOver | S2C_OpponentDisconnected | S2C_Error;

type MessageHandler = (msg: ServerMessage) => void;

class WebSocketAdapter {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private seq = 0;
  private roomId: string | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string);
        this.dispatch(msg);
      };
      this.ws.onclose = () => {
        // Handle reconnection logic
      };
    });
  }

  sendCommand(command: PlayerCommand): void {
    if (!this.ws || !this.roomId) return;
    this.ws.send(JSON.stringify({
      type: "COMMAND",
      roomId: this.roomId,
      command,
      seq: this.seq++,
    }));
  }

  joinQueue(mode: GameMode): void {
    this.ws?.send(JSON.stringify({
      type: "QUEUE_JOIN",
      mode,
    }));
  }

  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  private dispatch(msg: ServerMessage): void {
    const handlers = this.handlers.get(msg.type) ?? [];
    for (const h of handlers) h(msg);
  }
}
```

### Step 6.2 — Modify GameScene for Online Mode

`GameScene` needs a new code path for online play. The key differences from local play:

| Aspect | Local (current) | Online (new) |
|--------|----------------|--------------|
| State authority | Client owns `GameState` | Server owns `GameState` |
| Ball/fly ticks | Client runs accumulators | Server runs accumulators; client predicts |
| Input | `KeyboardAdapter` → `update()` directly | `KeyboardAdapter` → send to server; client-side predict |
| CPU | Client runs `applyCpuDecision` | Server runs CPU; client just renders |
| Win check | Client checks score | Server sends `GAME_OVER` |

The recommended approach is to add an `isOnline` flag that switches behavior:

```typescript
// In GameScene.create():
if (this.isOnline) {
  this.network.on("STATE_UPDATE", (msg) => {
    this.state = msg.state;
    this.reconcilePredictions(msg.lastProcessedSeq);
    this.tileRenderer.draw(this.state);
    this.refreshAllHud();
  });

  this.network.on("GOAL_SCORED", (msg) => {
    this.playSound(this.goalScoredSound);
    this.startCountdown(msg.scorer);
  });

  this.network.on("GAME_OVER", (msg) => {
    this.isGameOver = true;
    this.scene.start("win", {
      winner: msg.winner,
      targetScore: this.targetScore,
      mode: this.state.mode,
    });
  });
}

// In GameScene.update():
if (this.isOnline) {
  // Only send commands to server — don't apply locally
  // (unless doing client-side prediction, see §7)
  const commands = this.keyboard.pollCommands(delta);
  for (const command of commands) {
    if (command.type !== "ADVANCE_BALL") {
      this.network.sendCommand(command);
    }
  }
  return;
}
// ... existing local logic unchanged ...
```

### Step 6.3 — New Online Menu Flow

Add new scenes or menu options for online play:

```
TitleMenuScene
  ├── [1] Local Play (existing flow)
  │     ├── Practice
  │     ├── One v One (same keyboard)
  │     └── One v CPU
  └── [2] Online Play (new)
        ├── Quick Match (matchmaking queue)
        ├── Create Room (get room code)
        └── Join Room (enter code)
```

This means modifying `TitleMenuScene` to add online menu entries and creating new scenes:

- **`OnlineLobbyScene`** — shows matchmaking status, room codes, etc.
- **`OnlineGameScene`** — or reuse `GameScene` with `isOnline = true`

### Step 6.4 — Files That Need Changes

| File | Change |
|------|--------|
| `scenes/TitleMenuScene.ts` | Add "Online Play" menu option |
| `scenes/GameScene.ts` | Add `isOnline` path, integrate `WebSocketAdapter`, add prediction/reconciliation |
| `scenes/WinScene.ts` | Handle online game over (rematch offer, return to lobby) |
| `main.ts` | Register new scenes, possibly add server URL config |
| `config/env.ts` | Add `SERVER_URL` from `import.meta.env` |

### Step 6.5 — Vite Environment Variables

```bash
# web/.env.development
VITE_SERVER_URL=ws://localhost:3001

# web/.env.production
VITE_SERVER_URL=wss://your-server.com
```

Access in code:

```typescript
const SERVER_URL = import.meta.env.VITE_SERVER_URL as string;
```

---

## 7. State Synchronization Strategy

This is the most complex architectural decision. There are three approaches, in order of increasing complexity and quality:

### Option A: Server-Authoritative, No Client Prediction (Simplest)

**How it works:**
- Client sends commands to server.
- Server applies commands, runs tick loop, broadcasts full `GameState` every tick.
- Client receives state, renders it. That's it.

**Pros:** Dead simple. No desync bugs. Server is the single source of truth.

**Cons:** Input feels laggy — every action has a full round-trip delay before the player sees the result. At 50ms RTT, this is noticeable. At 100ms+, it feels awful.

**When to use:** Prototyping, or if your players are all on low-latency connections (same region).

### Option B: Server-Authoritative with Client-Side Prediction (Recommended)

**How it works:**
1. Client sends command to server *and* immediately applies it locally (prediction).
2. Server processes the command and broadcasts authoritative state.
3. Client receives authoritative state and **reconciles**: rewinds to the server's tick, replays any commands the server hasn't confirmed yet.

**Implementation sketch:**

```typescript
class PredictionBuffer {
  private predictions: Array<{
    seq: number;
    command: Command;
    predictedState: GameState;
  }> = [];

  addPrediction(seq: number, command: Command, predictedState: GameState): void {
    this.predictions.push({ seq, command, predictedState });
  }

  reconcile(
    serverState: GameState,
    lastProcessedSeq: number
  ): GameState {
    // Drop all predictions the server has confirmed
    this.predictions = this.predictions.filter(p => p.seq > lastProcessedSeq);

    // Re-apply unconfirmed predictions on top of server state
    let state = serverState;
    for (const p of this.predictions) {
      state = update(state, p.command);
    }
    return state;
  }
}
```

In `GameScene.update` (online mode):

```typescript
const commands = this.keyboard.pollCommands(delta);
for (const command of commands) {
  // 1. Send to server
  this.network.sendCommand(command);

  // 2. Apply locally (predict)
  const predicted = update(this.state, command);
  this.predictionBuffer.addPrediction(this.network.currentSeq, command, predicted);
  this.state = predicted;
}

// When server state arrives:
this.network.on("STATE_UPDATE", (msg) => {
  this.state = this.predictionBuffer.reconcile(
    msg.state,
    msg.lastProcessedSeq[this.myPlayerId]
  );
  this.tileRenderer.draw(this.state);
  this.refreshAllHud();
});
```

**Pros:** Feels responsive — local player sees their actions instantly. Corrections are usually invisible because `update()` is deterministic.

**Cons:** Requires careful handling of the `rngState` for punch outcomes (see below). More code complexity.

**Critical detail — punch RNG divergence:** The `punch()` function in `update.ts` advances `rngState` to determine the 50/50 steal-or-force-throw outcome. If the client predicts a punch, its local `rngState` will advance. When the server processes the same punch, *its* `rngState` will also advance — but if any other commands were interleaved (opponent's commands, ball ticks), the RNG sequences may diverge. This is fine because reconciliation replays unconfirmed commands on top of the server's authoritative state (which has the correct `rngState`). The visual "snap" when a predicted punch outcome is corrected is acceptable and rare.

### Option C: Lockstep Simulation (Overkill for This Game)

**How it works:** Both clients and server run the simulation in lockstep. Each tick waits until all players' inputs for that tick are received before advancing. Used in RTS games (StarCraft, Age of Empires).

**Pros:** Perfect determinism, minimal bandwidth (only send commands, never state).

**Cons:** Game speed is gated by the slowest connection. Unacceptable for real-time action games. Significant implementation complexity.

**Verdict:** Don't use this. Option B is the right choice.

### Bandwidth Optimization: Delta State Updates

Sending the full `GameState` every tick is wasteful — the `map` field (a 80x30 `Tile[][]`) never changes mid-game and is ~10KB of JSON.

**Strategy:**
1. Send the **full state** once in `GAME_START`.
2. On each `STATE_UPDATE`, send only the fields that changed since the last update:

```typescript
type StateDelta = {
  tick: number;
  players?: Partial<Record<1 | 2, Partial<PlayerState>>>;
  ball?: Partial<BallState>;
  score?: { p1: number; p2: number };
  goalsSwapped?: boolean;
  lastGoalTick?: number;
  rngState?: number;
};
```

Or more simply: send full state but **strip the `map` field** from updates (the client already has it from `GAME_START`).

```typescript
// Server sends:
const { map, ...stateWithoutMap } = this.state;
broadcast({ type: "STATE_UPDATE", state: stateWithoutMap, ... });

// Client merges:
this.state = { ...msg.state, map: this.cachedMap };
```

---

## 8. Matchmaking and Lobbies

### Simple Room-Code Matchmaking (Start Here)

The simplest approach: one player creates a room (gets a 4–6 character code), shares it with a friend, friend joins with the code.

```typescript
// Server-side
const activeRooms = new Map<string, GameRoom>();

function createRoom(ws: WebSocket, mode: GameMode, settings: GameSettings): string {
  const code = generateRoomCode(); // e.g. "XKCD42"
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const room = new GameRoom(code, seed, mode, settings.targetScore);
  room.addPlayer(getSessionId(ws), ws, 1);
  activeRooms.set(code, room);
  return code;
}

function joinRoom(ws: WebSocket, code: string): void {
  const room = activeRooms.get(code);
  if (!room) { send(ws, { type: "ERROR", code: "ROOM_NOT_FOUND" }); return; }
  room.addPlayer(getSessionId(ws), ws, 2);
  room.start();
}
```

### Queue-Based Matchmaking (Later)

For random opponents:

1. Player joins a queue (keyed by `GameMode`).
2. Server pairs the first two players in each queue.
3. Creates a `GameRoom`, assigns player IDs (P1 gets the lower-latency connection, or random), starts the game.

```typescript
const queues = new Map<GameMode, WebSocket[]>();

function handleQueueJoin(ws: WebSocket, mode: GameMode): void {
  const queue = queues.get(mode) ?? [];
  queue.push(ws);
  queues.set(mode, queue);

  if (queue.length >= 2) {
    const [p1, p2] = queue.splice(0, 2);
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const room = new GameRoom(generateId(), seed, mode, GAME_RULES.scoreToWin);
    room.addPlayer(getSessionId(p1), p1, 1);
    room.addPlayer(getSessionId(p2), p2, 2);
    room.start();
  }
}
```

### Reconnection

When a player disconnects:
1. Server pauses the game (or keeps it running with a grace period).
2. Sets a timer (e.g. 30 seconds).
3. If the player reconnects within the grace period, they rejoin the room and receive a full state sync.
4. If the timer expires, the disconnected player forfeits.

The reconnection flow requires session tokens (e.g., JWTs or random UUIDs stored in `localStorage`) so the server can associate a new WebSocket connection with the original player.

---

## 9. Handling Game Modes on the Server

Your current game modes and how they map to backend play:

| Mode | Current | Online Behavior |
|------|---------|----------------|
| `PRACTICE` | Solo, no P2, no scoring | **No backend needed** — keep as client-only |
| `ONE_V_ONE` | Two players, same keyboard | **Online 1v1** — each player on their own device |
| `ONE_V_CPU` | Player vs CPU AI | **Could be client-only** (no cheating concern for single-player), or server-authoritative for leaderboards |
| `ONE_ONE_V_CPU_CPU` | Coming soon | Two human players + two CPU allies — server runs both CPUs |
| `ONE_CPU_V_ONE_CPU` | Coming soon | Two humans each with a CPU partner — server runs CPUs |
| `ONE_ONE_V_ONE_ONE` | Coming soon | Four humans, 2v2 — server manages 4 WebSocket connections per room |

For modes with CPU players, the server runs `applyCpuDecision` and clients just render. This prevents CPU manipulation/cheating.

For `ONE_V_ONE` online, the server simply assigns each connection to P1 or P2 and relays commands.

---

## 10. Server-Side CPU AI

The CPU AI is already cleanly separated in `core/cpu/`. On the server:

```typescript
// In GameRoom.tick():
if (this.isCpu) {
  this.cpuAccumulatorMs += deltaMs;
  while (this.cpuAccumulatorMs >= this.cpuTickMs) {
    next = applyCpuDecision(next);
    this.cpuAccumulatorMs -= this.cpuTickMs;
  }
}
```

This is identical to the client-side code in `GameScene.update`. The `applyCpuDecision` function from `core/cpu/index.ts` is a pure function that takes a `GameState` and returns a new `GameState` — it works anywhere.

### CPU Strategy Selection

`CPU_STRATEGY` in `core/cpu/index.ts` is currently a compile-time constant (`0`–`5`). For the server, make it configurable per-room:

```typescript
// Modify applyCpuDecision to accept a strategy parameter
export function applyCpuDecision(state: GameState, strategy: number = CPU_STRATEGY): GameState {
  const strategyFn = strategies[strategy] ?? strategies[0];
  return strategyFn(state);
}
```

---

## 11. Map Generation

### Seeds Are Already Deterministic

`generateMap(seed)` produces identical output for the same seed. This means:

- The server generates the map from a seed and includes it in `GAME_START`.
- Alternatively, the server sends only the seed, and the client generates the map locally (saves bandwidth — the 80x30 tile grid is the largest part of `GameState`).

If you send only the seed:

```typescript
// Server sends:
{ type: "GAME_START", seed: 42, mode: "ONE_V_ONE", ... }

// Client generates locally:
const map = generateMap(msg.seed);
```

This only works if the map generation code is byte-for-byte identical on client and server — which it is, since both import from `@throw-ball/game-core`.

### Map Strategy Per Room

Currently `MAPGEN_STRATEGY` is a compile-time constant. To let players choose map types in lobbies:

```typescript
// In GameRoom constructor:
const map = generateMap(seed, undefined, undefined, mapStrategy);
```

You'd need to modify `generateMap` to accept a strategy parameter instead of reading from the module-level constant.

---

## 12. Replay System Adaptation

### Current Replay System

The current `ReplayLog` stores every `GameState` snapshot (the full state object, not just deltas):

```typescript
interface ReplayLog {
  states: GameState[];           // Every state in order
  isAutoAdvance: boolean[];      // Whether each state was auto (ball/fly) or player-initiated
  targetScore: number;
}
```

This works for local play but would be impractical to store server-side for every match — a single game might produce thousands of full `GameState` snapshots.

### Server-Side Replay: Store Commands, Not States

Instead of storing states, store the initial state + the sequence of commands with timestamps:

```typescript
interface ServerReplayLog {
  initialState: GameState;       // The starting state (includes map)
  targetScore: number;
  commands: Array<{
    tick: number;                // Server tick when the command was applied
    command: Command;            // The command itself
    timestamp: number;           // Wall-clock time (for playback pacing)
  }>;
}
```

To replay: start from `initialState`, apply commands in order (with ball/fly ticks between them), and you reconstruct every intermediate state.

### Storage

- Store replays in PostgreSQL as JSONB, or as compressed JSON files in object storage (S3/R2).
- A typical game of ~1000 commands ≈ 50KB JSON ≈ 5KB gzipped.
- Assign each replay a unique ID; return it in `GAME_OVER` so players can share/watch replays.

### Client-Side Replay Viewer

The existing `ReplayScene` can be adapted to work with server replays:

1. Fetch the `ServerReplayLog` from `GET /api/replays/:id`.
2. Reconstruct the `ReplayLog` (state array) by replaying all commands from the initial state.
3. Feed the reconstructed `ReplayLog` into the existing `ReplayScene`.

```typescript
function reconstructReplayLog(serverLog: ServerReplayLog): ReplayLog {
  const log = createReplayLog(serverLog.initialState, serverLog.targetScore);
  let state = serverLog.initialState;

  for (const entry of serverLog.commands) {
    // Fill in auto-advance ticks between commands
    while (state.tick < entry.tick) {
      state = update(state, { type: "ADVANCE_BALL" });
      pushState(log, state, true);
      state = update(state, null);
      pushState(log, state, true);
    }
    state = update(state, entry.command);
    pushState(log, state, false);
  }

  return log;
}
```

---

## 13. Security and Anti-Cheat

### Rule 1: Never Trust the Client

The server must validate every command:

```typescript
function isValidCommand(command: Command, playerId: 1 | 2, state: GameState): boolean {
  // Only allow the three player command types
  if (command.type === "ADVANCE_BALL") return false;

  // The playerId must match the connection's assigned player
  if ("playerId" in command && command.playerId !== playerId) return false;

  // The command must be a valid type
  if (!["MOVE", "ACTION", "TOGGLE_FLY"].includes(command.type)) return false;

  // Direction must be valid (if MOVE)
  if (command.type === "MOVE") {
    if (!["N", "E", "S", "W"].includes(command.direction)) return false;
  }

  return true;
}
```

### Rule 2: Server Owns Game State

The client never sends `GameState` to the server. The server computes state exclusively from its own `update()` calls. Client-side prediction is local-only and always corrected by the server.

### Rule 3: Rate Limit Commands

A malicious client could flood the server with commands. Rate limit to something reasonable:

```typescript
const MAX_COMMANDS_PER_TICK = 3; // One MOVE + one ACTION + one TOGGLE_FLY max per tick
const MAX_COMMANDS_PER_SECOND = 30;
```

### Rule 4: Session Authentication

Use short-lived tokens (JWT or random UUIDs) to authenticate WebSocket connections. Don't let unauthenticated connections join rooms.

### Rule 5: Don't Expose Opponent's Hidden Information

Currently `GameState` has no hidden information — both players see the entire map and each other's positions. If you ever add fog-of-war or hidden mechanics, the server must filter what it sends to each player.

---

## 14. Persistence and Databases

### Schema Design

```sql
-- Players
CREATE TABLE players (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    VARCHAR(32) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  games_won   INT DEFAULT 0,
  games_lost  INT DEFAULT 0
);

-- Matches
CREATE TABLE matches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code     VARCHAR(8),
  mode          VARCHAR(32) NOT NULL,        -- "ONE_V_ONE", "ONE_V_CPU", etc.
  seed          INT NOT NULL,
  map_strategy  SMALLINT DEFAULT 0,
  target_score  SMALLINT DEFAULT 3,
  player1_id    UUID REFERENCES players(id),
  player2_id    UUID REFERENCES players(id), -- NULL for CPU
  winner_id     UUID REFERENCES players(id),
  final_score   JSONB NOT NULL,              -- {"p1": 3, "p2": 1}
  started_at    TIMESTAMPTZ DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  duration_ms   INT
);

-- Replays
CREATE TABLE replays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id      UUID REFERENCES matches(id) ON DELETE CASCADE,
  initial_state JSONB NOT NULL,
  commands      JSONB NOT NULL,              -- Array of {tick, command, timestamp}
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Leaderboard (materialized view or separate table)
CREATE TABLE leaderboard (
  player_id   UUID PRIMARY KEY REFERENCES players(id),
  elo         INT DEFAULT 1200,
  wins        INT DEFAULT 0,
  losses      INT DEFAULT 0,
  win_streak  INT DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

### When to Write to the Database

- **Match start**: Insert into `matches` with `started_at`, both player IDs, mode, seed.
- **Match end**: Update `matches` with `winner_id`, `final_score`, `ended_at`, `duration_ms`. Insert replay. Update `leaderboard`.
- **Disconnect/forfeit**: Same as match end, with the disconnected player as the loser.

---

## 15. Deployment and Infrastructure

### Development

```bash
# Terminal 1: Game server
cd packages/server
npm run dev    # tsx watch src/index.ts

# Terminal 2: Vite dev server (proxies WS to game server)
cd packages/web
npm run dev
```

Add a Vite proxy for WebSocket connections in development:

```typescript
// packages/web/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
```

### Production

**Option A: Single Server (Simple)**

Run the game server behind an nginx/Caddy reverse proxy. Serve the static Phaser client from the same domain.

```
                    ┌─────────────────┐
                    │   Reverse Proxy  │
                    │   (nginx/Caddy)  │
                    └───────┬─────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        /ws (upgrade)    /* (static)   /api (REST)
              │             │             │
       ┌──────▼──────┐     │      ┌──────▼──────┐
       │  Game Server │     │      │  Game Server │
       │  (Node.js)   │     │      │  (same proc) │
       └──────────────┘     │      └──────────────┘
                            │
                     ┌──────▼──────┐
                     │ Static Files │
                     │ (Vite dist/) │
                     └──────────────┘
```

**Option B: Separate Scaling (Production)**

- **Static client**: Deploy to CDN (Cloudflare Pages, Vercel, Netlify — you're already using GitHub Pages).
- **Game server**: Deploy to a VPS (Fly.io, Railway, Render, or a bare EC2/Droplet).
- **Database**: Managed PostgreSQL (Supabase, Neon, RDS).

### Scaling Considerations

- Each `GameRoom` uses minimal memory (~50KB for state + connection overhead).
- A single Node.js process can handle **hundreds of concurrent rooms** (thousands of WebSocket connections).
- If you need more, shard by room ID across multiple server instances, with a shared Redis layer for matchmaking queues.
- WebSocket connections are sticky — once a player connects to a server, they stay on that server for the duration of the match. No need for session affinity at the load balancer level if rooms are assigned to specific servers.

### CI/CD Updates

Update `.github/workflows/deploy-pages.yml` to also build/deploy the server, or create a separate workflow:

```yaml
# .github/workflows/deploy-server.yml
name: Deploy Game Server
on:
  push:
    branches: [main]
    paths: ["packages/server/**", "packages/game-core/**"]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run build --workspace=packages/game-core
      - run: npm run build --workspace=packages/server
      - run: # Deploy to your hosting provider
```

---

## 16. Migration Roadmap

Here's the order of operations, designed so that the game remains fully functional at every step.

### Phase 1: Monorepo Restructure (No Backend Yet)

**Goal:** Extract shared game logic without changing any behavior.

1. Create `packages/game-core/` with the files listed in §3.3.
2. Set up npm workspaces.
3. Update all imports in `packages/web/` to use `@throw-ball/game-core`.
4. Delete the legacy `applyCpuDecision` from `update.ts` (the duplicate code at lines 284–554).
5. Verify the game works identically by running it locally.
6. Update CI to build `game-core` before `web`.

**Estimated effort:** 1–2 days.

### Phase 2: Basic Server + Room Codes

**Goal:** Two players can play online via room codes, server-authoritative, no prediction.

1. Create `packages/server/` with WebSocket server.
2. Implement `GameRoom` with the authoritative tick loop.
3. Implement create-room / join-room flow.
4. Add `WebSocketAdapter` to the client.
5. Add an `OnlineGameScene` (or `isOnline` flag on `GameScene`).
6. Add a minimal "Online Play" menu to `TitleMenuScene`.
7. Test with two browser windows.

**Estimated effort:** 3–5 days.

### Phase 3: Client-Side Prediction

**Goal:** Make online play feel responsive.

1. Implement `PredictionBuffer`.
2. Add prediction + reconciliation logic to the online `GameScene` path.
3. Handle edge cases: punch RNG correction, fly state correction.
4. Test with simulated latency (Chrome DevTools Network throttling).

**Estimated effort:** 2–3 days.

### Phase 4: Matchmaking Queue

**Goal:** Players can find random opponents.

1. Add queue-based matchmaking on the server.
2. Add queue UI to the client (waiting screen with cancel option).
3. Handle queue edge cases (player disconnects while queuing, queue timeout).

**Estimated effort:** 1–2 days.

### Phase 5: Persistence

**Goal:** Store match results and replays.

1. Set up PostgreSQL and schema from §14.
2. Save match results on game over.
3. Save replays (command log format).
4. Add `GET /api/replays/:id` endpoint.
5. Adapt `ReplayScene` to fetch and reconstruct server replays.
6. Add a "Recent Matches" or "Watch Replay" screen.

**Estimated effort:** 2–3 days.

### Phase 6: Accounts and Leaderboards

**Goal:** Players have persistent identities and rankings.

1. Add authentication (start simple: username + password, or OAuth with GitHub/Google).
2. Track Elo or win/loss records.
3. Add a leaderboard scene to the client.
4. Display opponent names in the HUD.

**Estimated effort:** 3–5 days.

### Phase 7: Reconnection and Polish

**Goal:** Handle real-world network conditions gracefully.

1. Implement reconnection with session tokens.
2. Add grace period for disconnections.
3. Add connection quality indicator to the HUD.
4. Handle server restarts gracefully (in-progress games are lost, but players can re-queue).
5. Add spectator mode (read-only WebSocket connections that receive state updates).

**Estimated effort:** 2–4 days.

### Phase 8: Advanced Modes

**Goal:** Bring online support to the "coming soon" modes.

1. Implement `ONE_ONE_V_CPU_CPU` — server runs two CPU AIs, two human players connect.
2. Implement `ONE_CPU_V_ONE_CPU` — each human has a CPU partner.
3. Implement `ONE_ONE_V_ONE_ONE` — four human players per room.
4. These all require the server to manage 2–4 WebSocket connections per room and potentially run multiple CPU instances.

**Estimated effort:** 3–5 days per mode.

---

## Appendix A: Key Constants Reference

These values from `config/rules.ts` must be identical on client and server:

| Constant | Value | Purpose |
|----------|-------|---------|
| `STEPS_PER_POSSESSION` | `5` | Max steps a player can take while holding the ball |
| `GAME_RULES.scoreToWin` | `3` | Default target score (overridable) |
| `SIM_TICK_MS.ball` | `3` | Milliseconds between ball flight steps |
| `SIM_TICK_MS.fly` | `6` | Milliseconds between player fly glide steps |
| `CPU_TICK_MS` | `250` | Default CPU decision interval |
| CPU easy/medium/hard | `500`/`250`/`100` | Per-difficulty CPU tick rates |

## Appendix B: GameState Serialization Size

Approximate JSON sizes for network messages:

| Data | Approximate Size |
|------|-----------------|
| Full `GameState` (including 80x30 map) | ~12–15 KB |
| Full `GameState` (excluding map) | ~500 bytes |
| Single `Command` | ~50–80 bytes |
| `STATE_UPDATE` message (no map) | ~700 bytes |
| `GAME_START` message (with map) | ~13–16 KB |

At 60 state updates/second with ~700 bytes each, bandwidth is ~42 KB/s per player — well within any connection's capacity.

## Appendix C: The `update()` Contract

The `update` function is the backbone of the entire system. Here is its contract, which both client and server must respect:

```typescript
function update(state: GameState, command: Command | null): GameState
```

- **Pure**: No side effects. Same inputs always produce the same output.
- **Immutable**: Returns a new `GameState` object (or the same reference if nothing changed). Never mutates the input.
- **Tick increment**: Every successful mutation increments `state.tick` by 1.
- **RNG threading**: Punch outcomes advance `rngState`. The sequence of `rngState` values is deterministic given the same command sequence.
- **`null` command**: Advances auto-fly only (players glide one tile in their fly direction).
- **`ADVANCE_BALL`**: Advances ball flight one tile, checks for goals.
- **Player commands (`MOVE`, `ACTION`, `TOGGLE_FLY`)**: Apply the corresponding game mechanic.

This function is the single source of truth for game rules. If you change a rule, you change it here, and both client and server automatically get the update (since they share the `game-core` package).
