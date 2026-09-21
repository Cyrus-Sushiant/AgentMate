/**
 * avdmanager is stricter about AVD names than Android Studio is. Studio stores a friendly
 * `avd.ini.displayname` and a separate sanitized id; anything created from here has to pick an id
 * avdmanager will accept, or `create avd` fails with an unhelpful usage dump.
 */

/** What `avdmanager create avd -n` accepts: letters, digits, dot, dash and underscore. */
const VALID_AVD_NAME = /^[A-Za-z0-9._-]+$/;

export function isValidAvdName(name: string): boolean {
  return VALID_AVD_NAME.test(name);
}

/**
 * Turns what someone typed into an id avdmanager will take. Runs of anything invalid collapse to a
 * single underscore so "Pixel 7 (API 34)" reads as Pixel_7_API_34 rather than Pixel_7__API_34_.
 */
export function avdIdFromDisplayName(display: string): string {
  return display
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
