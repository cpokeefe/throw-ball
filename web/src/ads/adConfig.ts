/**
 * Ad slot definition and rotation settings.
 *
 * To replace placeholders with real products, edit the PLACEHOLDER_ADS
 * array below. Each slot drives the banner that appears in the fullscreen
 * margins. Set `url` on any slot to make the card clickable.
 */

export interface AdSlot {
  id: string;
  title: string;
  tagline: string;
  bgColor: string;
  fgColor: string;
  accentColor: string;
  icon: string;
  /** When set, the ad card becomes a clickable link (opens in new tab). */
  url?: string;
}

/** Milliseconds between ad rotations. */
export const AD_ROTATION_MS = 8_000;

/** Milliseconds for the fade-out / fade-in transition. */
export const AD_FADE_MS = 500;

/** Minimum margin size (px) required to show an ad in a region. */
export const AD_MIN_MARGIN_PX = 50;

export const PLACEHOLDER_ADS: readonly AdSlot[] = [
  {
    id: "premium",
    title: "Throw Ball Premium",
    tagline: "New maps, modes & more",
    bgColor: "#1a1a2e",
    fgColor: "#e0e0e0",
    accentColor: "#e94560",
    icon: "⭐",
  },
  {
    id: "merch",
    title: "Official Merch",
    tagline: "Wear the game",
    bgColor: "#162032",
    fgColor: "#e0e0e0",
    accentColor: "#4fc3f7",
    icon: "👕",
  },
  {
    id: "guide",
    title: "Strategy Guide",
    tagline: "Master every mode",
    bgColor: "#1a2e1a",
    fgColor: "#e0e0e0",
    accentColor: "#66bb6a",
    icon: "📖",
  },
  {
    id: "community",
    title: "Join the Community",
    tagline: "Chat & compete",
    bgColor: "#0d1117",
    fgColor: "#e0e0e0",
    accentColor: "#58a6ff",
    icon: "💬",
  },
  {
    id: "updates",
    title: "Get Updates",
    tagline: "News & patch notes",
    bgColor: "#1c1917",
    fgColor: "#e0e0e0",
    accentColor: "#f59e0b",
    icon: "📬",
  },
];
