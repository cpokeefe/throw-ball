import Phaser from "phaser";
import {
  type AdSlot,
  PLACEHOLDER_ADS,
  AD_ROTATION_MS,
  AD_FADE_MS,
  AD_MIN_MARGIN_PX,
} from "./adConfig";

type Side = "top" | "bottom" | "left" | "right";

interface Margin {
  side: Side;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Renders rotating ad banners in the black letterbox / pillarbox margins
 * that surround the Phaser canvas when the game is in fullscreen.
 *
 * Ads are pure DOM elements positioned absolutely inside the `#app`
 * fullscreen container, so they never touch the Phaser render loop.
 */
export class AdManager {
  private readonly game: Phaser.Game;
  private readonly wrapper: HTMLDivElement;
  private readonly regions = new Map<Side, HTMLDivElement>();
  private index = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private active = false;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.wrapper = this.initWrapper();
    this.listen();
  }

  destroy(): void {
    this.stopRotation();
    this.game.scale.off(Phaser.Scale.Events.ENTER_FULLSCREEN, this.onEnter);
    this.game.scale.off(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.onLeave);
    this.game.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    this.clearRegions();
    this.wrapper.remove();
  }

  /* ----- DOM bootstrap ------------------------------------------------ */

  private initWrapper(): HTMLDivElement {
    const div = document.createElement("div");
    div.id = "ad-margins";
    div.style.setProperty("--ad-fade-ms", `${AD_FADE_MS}ms`);
    document.getElementById("app")?.appendChild(div);
    return div;
  }

  /* ----- Event wiring ------------------------------------------------- */

  private listen(): void {
    this.game.scale.on(Phaser.Scale.Events.ENTER_FULLSCREEN, this.onEnter);
    this.game.scale.on(Phaser.Scale.Events.LEAVE_FULLSCREEN, this.onLeave);
    this.game.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
  }

  private onEnter = (): void => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        this.active = true;
        this.wrapper.classList.add("visible");
        this.refresh();
        this.startRotation();
      })
    );
  };

  private onLeave = (): void => {
    this.active = false;
    this.wrapper.classList.remove("visible");
    this.stopRotation();
    this.clearRegions();
  };

  private onResize = (): void => {
    if (this.active) this.refresh();
  };

  /* ----- Margin geometry ---------------------------------------------- */

  private computeMargins(): Margin[] {
    const cRect = this.game.canvas.getBoundingClientRect();
    const aRect = this.wrapper.parentElement?.getBoundingClientRect();
    if (!aRect) return [];

    const t = cRect.top - aRect.top;
    const b = aRect.bottom - cRect.bottom;
    const l = cRect.left - aRect.left;
    const r = aRect.right - cRect.right;

    const out: Margin[] = [];
    if (t >= AD_MIN_MARGIN_PX)
      out.push({ side: "top", x: 0, y: 0, w: aRect.width, h: t });
    if (b >= AD_MIN_MARGIN_PX)
      out.push({
        side: "bottom",
        x: 0,
        y: aRect.height - b,
        w: aRect.width,
        h: b,
      });
    if (l >= AD_MIN_MARGIN_PX)
      out.push({ side: "left", x: 0, y: t, w: l, h: aRect.height - t - b });
    if (r >= AD_MIN_MARGIN_PX)
      out.push({
        side: "right",
        x: aRect.width - r,
        y: t,
        w: r,
        h: aRect.height - t - b,
      });

    return out;
  }

  /* ----- Layout & render ---------------------------------------------- */

  private refresh(): void {
    const ms = this.computeMargins();
    const live = new Set(ms.map((m) => m.side));

    for (const [side, el] of this.regions) {
      if (!live.has(side)) {
        el.remove();
        this.regions.delete(side);
      }
    }

    for (const m of ms) {
      let el = this.regions.get(m.side);
      if (!el) {
        el = document.createElement("div");
        el.className = `ad-region ad-${m.side}`;
        this.wrapper.appendChild(el);
        this.regions.set(m.side, el);
      }
      Object.assign(el.style, {
        left: `${m.x}px`,
        top: `${m.y}px`,
        width: `${m.w}px`,
        height: `${m.h}px`,
      });
    }

    this.renderCurrent();
  }

  private clearRegions(): void {
    for (const el of this.regions.values()) el.remove();
    this.regions.clear();
  }

  private renderCurrent(): void {
    const ad = PLACEHOLDER_ADS[this.index];
    for (const [side, el] of this.regions) {
      const hz = side === "top" || side === "bottom";
      el.innerHTML = AdManager.cardHtml(ad, hz, el.offsetWidth, el.offsetHeight);
    }
  }

  /* ----- Rotation ----------------------------------------------------- */

  private startRotation(): void {
    this.stopRotation();
    this.timer = window.setInterval(() => this.advance(), AD_ROTATION_MS);
  }

  private stopRotation(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private advance(): void {
    for (const el of this.regions.values()) el.style.opacity = "0";

    window.setTimeout(() => {
      this.index = (this.index + 1) % PLACEHOLDER_ADS.length;
      this.renderCurrent();
      for (const el of this.regions.values()) el.style.opacity = "1";
    }, AD_FADE_MS);
  }

  /* ----- Card HTML template ------------------------------------------- */

  private static cardHtml(
    ad: AdSlot,
    horizontal: boolean,
    regionW: number,
    regionH: number,
  ): string {
    const ref = horizontal ? regionH : regionW;
    const iconPx = Math.round(Math.min(Math.max(14, ref * 0.35), 34));
    const titlePx = Math.round(Math.min(Math.max(10, ref * 0.18), 15));
    const tagPx = Math.max(9, titlePx - 2);

    const dir = horizontal ? "row" : "column";
    const pad = horizontal ? "6px 20px" : "16px 8px";
    const textAlign = horizontal ? "left" : "center";
    const alignItems = horizontal ? "flex-start" : "center";

    return `<div class="ad-card" style="
      flex-direction:${dir};padding:${pad};
      background:${ad.bgColor};
      border-color:${ad.accentColor}44;
      box-shadow:0 0 20px ${ad.accentColor}18;
      ${ad.url ? "cursor:pointer;" : ""}
    " ${ad.url ? `onclick="window.open('${ad.url}','_blank')"` : ""}>
      <span class="ad-icon" style="font-size:${iconPx}px">${ad.icon}</span>
      <span class="ad-text" style="align-items:${alignItems};text-align:${textAlign}">
        <span class="ad-title" style="font-size:${titlePx}px;color:${ad.fgColor}">${ad.title}</span>
        <span class="ad-tagline" style="font-size:${tagPx}px;color:${ad.accentColor}">${ad.tagline}</span>
      </span>
    </div>`;
  }
}
