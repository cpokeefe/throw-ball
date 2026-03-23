import Phaser from "phaser";
import type { KeyboardAdapter } from "../adapters/input/keyboard";
import { getSiteControls } from "../siteBridge";

export type ColonCommandHandlers = {
  /** Return to the in-game title menu scene. */
  exitToTitle: () => void;
};

/**
 * Vim-style `:` then a letter: :f fullscreen, :m mute, :e title menu, :q leave game (HTML page).
 * Uses capture phase so P1 `e` / `q` are suppressed before Phaser polls the same frame.
 * Cleans up on scene shutdown.
 */
export function bindColonCommands(
  scene: Phaser.Scene,
  keyboard: KeyboardAdapter | undefined,
  handlers: ColonCommandHandlers
): void {
  let awaitingSecondKey = false;

  const onKeyDownCapture = (event: KeyboardEvent): void => {
    if (scene.sys.settings.status !== Phaser.Scenes.RUNNING) {
      return;
    }

    if (event.key === ":") {
      awaitingSecondKey = true;
      event.preventDefault();
      return;
    }

    if (!awaitingSecondKey) {
      return;
    }

    awaitingSecondKey = false;
    event.preventDefault();

    const k = event.key.toLowerCase();
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
      default:
        break;
    }
  };

  window.addEventListener("keydown", onKeyDownCapture, true);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener("keydown", onKeyDownCapture, true);
  });
}
