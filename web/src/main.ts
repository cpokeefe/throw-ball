import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./config/display";
import { GAME_BACKGROUND_COLOR } from "./config/colors";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { GameModeSelectScene } from "./scenes/GameModeSelectScene";
import { TitleMenuScene } from "./scenes/TitleMenuScene";
import { WinScene } from "./scenes/WinScene";

import { IS_TEST_MODE } from "./config/env";
import { setSiteControls } from "./siteBridge";

const BASS_TRACK_FILENAME = "Ronald Jenkees - Try The Bass.wav";
let bassTrack: HTMLAudioElement | null = null;
let musicMuted = IS_TEST_MODE;
let game: Phaser.Game | null = null;

const startLoopingBassTrack = (): void => {
  if (IS_TEST_MODE) {
    return;
  }

  const trackUrl = `${import.meta.env.BASE_URL}${encodeURIComponent(BASS_TRACK_FILENAME)}`;
  const track = new Audio(trackUrl);
  bassTrack = track;
  track.loop = true;
  track.preload = "auto";
  track.crossOrigin = "anonymous";
  track.muted = musicMuted;

  const attemptPlayback = (): void => {
    if (!track.paused) {
      return;
    }

    void track.play().then(() => {
      removeInteractionListeners();
    }).catch(() => {
      // Autoplay rejected; interaction fallback below retries playback.
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
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "app",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    fullscreenTarget: "app",
  },
  backgroundColor: GAME_BACKGROUND_COLOR,
  scene: [BootScene, TitleMenuScene, GameModeSelectScene, GameScene, WinScene],
};

const titleScreen = document.getElementById("title-screen");
const startGameButton = document.getElementById("start-game");
const gameControls = document.getElementById("game-controls");
const hudToggle = document.getElementById("hud-toggle");
const musicToggle = document.getElementById("music-toggle");
const fullscreenToggle = document.getElementById("fullscreen-toggle");
let hudVisible = false;

document.documentElement.style.setProperty("--game-width", `${GAME_WIDTH}px`);
document.documentElement.style.setProperty("--game-height", `${GAME_HEIGHT}px`);
document.documentElement.style.setProperty("--game-bg", GAME_BACKGROUND_COLOR);

const syncHudVisibility = (): void => {
  if (game !== null) {
    game.registry.set("hudVisible", hudVisible);
  }

  if (hudToggle instanceof HTMLButtonElement) {
    hudToggle.textContent = hudVisible ? "Hide Controls" : "Controls";
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

const syncFullscreenState = (): void => {
  if (fullscreenToggle instanceof HTMLButtonElement) {
    const isFullscreen = game?.scale.isFullscreen ?? false;
    fullscreenToggle.textContent = isFullscreen ? "Exit Fullscreen" : "Fullscreen";
    fullscreenToggle.setAttribute("aria-pressed", String(isFullscreen));
  }
};

const toggleFullscreen = (): void => {
  if (game === null) {
    return;
  }
  if (game.scale.isFullscreen) {
    game.scale.stopFullscreen();
    return;
  }
  game.scale.startFullscreen();
};

const toggleMute = (): void => {
  musicMuted = !musicMuted;
  syncMusicMuted();
};

const quitToWebsite = (): void => {
  if (game === null) {
    return;
  }
  const g = game;

  const destroyAndRestoreUi = (): void => {
    if (game !== g) {
      return;
    }
    game.destroy(true);
    game = null;
    if (bassTrack !== null) {
      bassTrack.pause();
      bassTrack = null;
    }
    if (titleScreen !== null) {
      titleScreen.classList.remove("hidden");
    }
    if (IS_TEST_MODE && gameControls !== null) {
      gameControls.classList.remove("hidden");
    }
    syncFullscreenState();
    syncMusicMuted();
  };

  if (g.scale.isFullscreen) {
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const onLeaveFullscreen = (): void => {
      g.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, onLeaveFullscreen);
      window.clearTimeout(fallbackTimer);
      destroyAndRestoreUi();
    };
    fallbackTimer = window.setTimeout(() => {
      g.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, onLeaveFullscreen);
      destroyAndRestoreUi();
    }, 750);
    g.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, onLeaveFullscreen);
    g.scale.stopFullscreen();
  } else {
    destroyAndRestoreUi();
  }
};

setSiteControls({
  toggleFullscreen,
  toggleMute,
  quitToWebsite,
});

const startGame = (): void => {
  if (game !== null) {
    return;
  }

  game = new Phaser.Game(config);
  game.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, syncFullscreenState);
  game.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, syncFullscreenState);
  startLoopingBassTrack();
  syncHudVisibility();
  syncMusicMuted();
  syncFullscreenState();

  if (titleScreen !== null) {
    titleScreen.classList.add("hidden");
  }
  if (gameControls !== null) {
    gameControls.classList.add("hidden");
  }

  if (!IS_TEST_MODE) {
    game.scale.startFullscreen();
  }
};

if (IS_TEST_MODE) {
  const header = document.querySelector(".header");
  if (header instanceof HTMLElement) {
    header.style.display = "none";
  }
}

syncHudVisibility();
syncMusicMuted();
syncFullscreenState();

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
    toggleMute();
  });
}

if (fullscreenToggle instanceof HTMLButtonElement) {
  fullscreenToggle.addEventListener("click", () => {
    toggleFullscreen();
  });
}

if (IS_TEST_MODE) {
  startGame();
}
