export type SiteControls = {
  toggleFullscreen: () => void;
  toggleMute: () => void;
  quitToWebsite: () => void;
};

let siteControls: SiteControls | null = null;

export function setSiteControls(controls: SiteControls): void {
  siteControls = controls;
}

export function getSiteControls(): SiteControls | null {
  return siteControls;
}
