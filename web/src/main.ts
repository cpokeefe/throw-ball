import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { TitleMenuScene } from "./scenes/TitleMenuScene";

const TILE_SIZE = 16;
const MAP_WIDTH = 80;
const MAP_HEIGHT = 30;
const BASS_TRACK_FILENAME = "Ronald Jenkees - Try The Bass.wav";
const BASS_TRACK_ABSOLUTE_PATH =
  `/Users/chiefokeefe/Developer/throw-ball/${BASS_TRACK_FILENAME}`;
const BASS_TRACK_SOURCES = [
  `${import.meta.env.BASE_URL}${encodeURIComponent(BASS_TRACK_FILENAME)}`,
  encodeURI(`/@fs${BASS_TRACK_ABSOLUTE_PATH}`),
];
let bassTrack: HTMLAudioElement | null = null;
let musicMuted = false;
let game: Phaser.Game | null = null;

const startLoopingBassTrack = (): void => {
  let sourceIndex = 0;
  const track = new Audio(BASS_TRACK_SOURCES[sourceIndex]);
  bassTrack = track;
  track.loop = true;
  track.preload = "auto";
  track.crossOrigin = "anonymous";
  track.muted = musicMuted;

  track.addEventListener("error", () => {
    if (sourceIndex >= BASS_TRACK_SOURCES.length - 1) {
      return;
    }

    sourceIndex += 1;
    track.src = BASS_TRACK_SOURCES[sourceIndex];
    track.load();
    attemptPlayback();
  });

  const attemptPlayback = (): void => {
    if (track.paused === false) {
      return;
    }

    void track.play().then(() => {
      removeInteractionListeners();
    }).catch(() => {
      // Ignore autoplay rejections; interaction fallback below retries playback.
    });
  };

  attemptPlayback();

  const interactionEvents: Array<keyof WindowEventMap> = [
    "pointerdown",
    "keydown",
    "touchstart",
  ];

  const handleInteraction = (): void => {
    attemptPlayback();
  };

  const removeInteractionListeners = (): void => {
    for (const eventName of interactionEvents) {
      window.removeEventListener(eventName, handleInteraction);
    }
  };

  for (const eventName of interactionEvents) {
    window.addEventListener(eventName, handleInteraction);
  }

  track.addEventListener("canplay", attemptPlayback);
};

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: MAP_WIDTH * TILE_SIZE,
  height: MAP_HEIGHT * TILE_SIZE,
  parent: "app",
  backgroundColor: "#0d0f12",
  scene: [BootScene, TitleMenuScene, GameScene],
};

const titleScreen = document.getElementById("title-screen");
const startGameButton = document.getElementById("start-game");
const gameControls = document.getElementById("game-controls");
const hudToggle = document.getElementById("hud-toggle");
const musicToggle = document.getElementById("music-toggle");
let hudVisible = false;

const syncHudVisibility = (): void => {
  if (game !== null) {
    game.registry.set("hudVisible", hudVisible);
  }

  if (hudToggle instanceof HTMLButtonElement) {
    hudToggle.textContent = hudVisible ? "Hide HUD" : "Show HUD";
    hudToggle.setAttribute("aria-pressed", String(hudVisible));
  }
};

const syncMusicMuted = (): void => {
  if (bassTrack !== null) {
    bassTrack.muted = musicMuted;
  }

  if (musicToggle instanceof HTMLButtonElement) {
    musicToggle.textContent = musicMuted ? "Unmute" : "Mute";
    musicToggle.setAttribute("aria-pressed", String(musicMuted));
  }
};

const startGame = (): void => {
  if (game !== null) {
    return;
  }

  game = new Phaser.Game(config);
  startLoopingBassTrack();
  syncHudVisibility();
  syncMusicMuted();

  if (titleScreen !== null) {
    titleScreen.classList.add("hidden");
  }
  if (gameControls !== null) {
    gameControls.classList.remove("hidden");
  }
};

syncHudVisibility();
syncMusicMuted();

if (startGameButton instanceof HTMLButtonElement) {
  startGameButton.addEventListener("click", startGame);
}

if (hudToggle instanceof HTMLButtonElement) {
  hudToggle.addEventListener("click", () => {
    hudVisible = !hudVisible;
    syncHudVisibility();
  });
}

if (musicToggle instanceof HTMLButtonElement) {
  musicToggle.addEventListener("click", () => {
    musicMuted = !musicMuted;
    syncMusicMuted();
  });
}
