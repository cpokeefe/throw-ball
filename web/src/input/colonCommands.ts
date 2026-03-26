import Phaser from "phaser";
import type { KeyboardAdapter } from "../adapters/input/keyboard";
import { getSiteControls } from "../siteBridge";

export type ColonCommandHandlers = {
  /** Return to the in-game title menu scene. */
  exitToTitle: () => void;
  togglePause?: () => void;
};

/**
 * Vim-style `:` then a letter: :f fullscreen, :m mute, :e title menu, :q leave game (HTML page).
 * Uses capture phase so P1 `e` / `q` are suppressed before Phaser polls the same frame.
 * Cleans up on scene shutdown.
 */
export function bindColonCommands(
  scene: Phaser.Scene,
  keyboard: KeyboardAdapter | undefined,
  handlers: ColonCommandHandlers,
  isPaused?: () => boolean
): void {
  let awaitingSecondKey = false;

  const executeCommand = (k: string): void => {
    const site = getSiteControls();
    switch (k) {
      case "f":
        site?.toggleFullscreen();
        break;
      case "m":
        site?.toggleMute();
        break;
      case "e":
        keyboard?.suppressP1Action();
        handlers.exitToTitle();
        break;
      case "q":
        keyboard?.suppressP1ToggleFly();
        site?.quitToWebsite();
        break;
      case " ":
        handlers.togglePause?.();
        break;
      default:
        break;
    }
  };

  const onKeyDownCapture = (event: KeyboardEvent): void => {
    if (scene.sys.settings.status !== Phaser.Scenes.RUNNING) {
      return;
    }

    if (event.key === ":") {
      awaitingSecondKey = true;
      event.preventDefault();
      return;
    }

    if (awaitingSecondKey) {
      awaitingSecondKey = false;
      event.preventDefault();
      executeCommand(event.key.toLowerCase());
      return;
    }

    if (isPaused?.()) {
      const k = event.key.toLowerCase();
      if (k === " " || k === "f" || k === "m" || k === "e" || k === "q") {
        event.preventDefault();
        executeCommand(k);
      }
    }
  };

  window.addEventListener("keydown", onKeyDownCapture, true);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener("keydown", onKeyDownCapture, true);
  });
}
