# Throw Ball Web (Milestone 1)

This folder contains a browser port scaffold for the game.

Milestone 1 includes:
- deterministic seeded map generation
- entity spawning (p1, p2, ball)
- basic player movement from keyboard input
- pure core update loop (`core/update.ts`) decoupled from Phaser rendering

Milestone 2 adds:
- action command (`grab` / `throw` / `punch`)
- possession rules and per-possession movement steps
- scoring by throwing through opponent goal
- round reset while preserving match score
- fly toggle and next-move slide-to-wall behavior
- non-blocking fly progression (players slide one tile per fly tick)
- non-blocking ball progression (`BALL_STEP_MS = 20`)

## Run

```bash
cd web
npm install
npm run dev
```

## Controls

- Player 1: `W A S D`
- Player 2: `I J K L` or arrow keys
- Player 1 action: `E`
- Player 2 action: `O` or `.`
- Player 1 fly toggle: `Q` (consumed on next move)
- Player 2 fly toggle: `U` (consumed on next move)
