/**
 * The server core's own rules for Docker names (its DockerNames.cs), for checking what the app
 * sends before it travels: the IPC layer refuses anything else, and the renderer uses the same
 * rules to say so while the user types.
 */

/** Container, volume and network names, and ids or their prefixes. */
export const OBJECT_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
export const IMAGE_ID = /^(?:sha256:)?[a-f0-9]{12,64}$/;
/** [registry[:port]/]path[:tag][@sha256:digest] */
export const IMAGE_REFERENCE =
  /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?(?::[0-9]{1,5})?\/)?[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*(?:\/[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*)*(?::[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?(?:@sha256:[a-f0-9]{64})?$/;
/** A user for docker exec: a name or uid, optionally with a group. */
export const EXEC_USER = /^[a-z_][a-z0-9_.-]*(?::[a-z_0-9][a-z0-9_.-]*)?$|^[0-9]+(?::[0-9]+)?$/;

export function isImageReference(value: string): boolean {
  return value.length > 0 && value.length <= 255 && IMAGE_REFERENCE.test(value);
}
