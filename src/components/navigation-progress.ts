export const NAVIGATION_START = "hpop:navigation-start";
export const NAVIGATION_COMPLETE = "hpop:navigation-complete";

export function startNavigation() {
  window.dispatchEvent(new Event(NAVIGATION_START));
}

export function completeNavigation() {
  window.dispatchEvent(new Event(NAVIGATION_COMPLETE));
}
