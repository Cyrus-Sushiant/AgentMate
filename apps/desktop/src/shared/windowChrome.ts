/**
 * Geometry shared by the main process (which places macOS's own traffic lights) and the
 * renderer (which leaves room for them in its title bars). Every window with a custom title
 * bar uses the same 44px bar (`h-11`).
 */
export const TITLE_BAR_HEIGHT = 44;

/** Left inset of the traffic lights, matching the title bar's `pl-4`. */
export const MAC_TRAFFIC_LIGHTS_INSET = 16;

/**
 * The traffic-light buttons' frames: 14x16 each on a 20px pitch, so three of them span 54px.
 * The colored circles inside are 12px; macOS draws and spaces them itself.
 */
export const MAC_TRAFFIC_LIGHT_FRAME_HEIGHT = 16;
export const MAC_TRAFFIC_LIGHTS_WIDTH = 54;

/** Room the title bar keeps clear after its left padding, with a little air past the buttons. */
export const MAC_TRAFFIC_LIGHTS_SPACER = MAC_TRAFFIC_LIGHTS_WIDTH + 6;

/** Where Electron should put the traffic lights so they sit centered in the title bar. */
export const MAC_TRAFFIC_LIGHT_POSITION = {
  x: MAC_TRAFFIC_LIGHTS_INSET,
  y: Math.round((TITLE_BAR_HEIGHT - MAC_TRAFFIC_LIGHT_FRAME_HEIGHT) / 2),
};
