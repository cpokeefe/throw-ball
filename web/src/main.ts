import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";

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

const startLoopingBassTrack = (): void => {
  let sourceIndex = 0;
  const track = new Audio(BASS_TRACK_SOURCES[sourceIndex]);
  bassTrack = track;
  track.loop = true;
  track.preload = "auto";
  track.crossOrigin = "anonymous";

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
  scene: [BootScene, GameScene],
};

startLoopingBassTrack();

const game = new Phaser.Game(config);
const hudToggle = document.getElementById("hud-toggle");
const musicToggle = document.getElementById("music-toggle");
let hudVisible = false;
let musicMuted = false;

const syncHudVisibility = (): void => {
  game.registry.set("hudVisible", hudVisible);
  if (hudToggle instanceof HTMLButtonElement) {
    hudToggle.textContent = hudVisible ? "Hide HUD" : "Show HUD";
    hudToggle.setAttribute("aria-pressed", String(!hudVisible));
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

syncHudVisibility();
syncMusicMuted();

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
