// Registers the <iron-remote-desktop> custom element as a side effect.
import '@devolutions/iron-remote-desktop';
import type { IronError, UserInteraction } from '@devolutions/iron-remote-desktop';
import {
  Backend,
  displayControl,
  enableCredssp,
  type FileInfo,
  init,
  RdpFileTransferProvider,
} from '@devolutions/iron-remote-desktop-rdp';

/**
 * Thin glue around Devolutions' IronRDP web packages. This module is heavy (the WebAssembly
 * engine ships inline), so only the Remote Desktop session window loads it, lazily.
 */

export type { FileInfo, UserInteraction };
export { displayControl, enableCredssp, RdpFileTransferProvider };

export type RdpScale = 'fit' | 'real';

let engineReady: Promise<void> | null = null;

/** Compiles the WebAssembly engine once per window; every session object needs it first. */
function loadEngine(): Promise<void> {
  engineReady ??= init('warn').catch((error: unknown) => {
    engineReady = null;
    throw error;
  });
  return engineReady;
}

const nextTask = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * The element fires `ready` before its clipboard support finishes setting up: that step first
 * awaits a clipboard permission query, and a connection started before it completes is built
 * without the clipboard channel, so nothing ever syncs. Queued permission queries resolve in
 * order, so asking the same question after the element has and then yielding once lands after
 * its setup is done.
 */
async function clipboardSetupSettled(): Promise<void> {
  await nextTask();
  try {
    await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
  } catch {
    await navigator.clipboard.read().catch(() => undefined);
  }
  await nextTask();
}

/** Creates the element and resolves once it hands over its control surface. */
export async function mountRemoteDesktop(host: HTMLElement): Promise<{
  element: HTMLElement;
  ui: UserInteraction;
}> {
  await loadEngine();
  const mounted = await new Promise<{ element: HTMLElement; ui: UserInteraction }>((resolve) => {
    const element = document.createElement('iron-remote-desktop') as HTMLElement & {
      module: unknown;
    };
    element.module = Backend;
    element.setAttribute('scale', 'fit');
    element.setAttribute('flexcenter', 'true');
    element.setAttribute('verbose', 'false');
    element.style.display = 'block';
    element.style.width = '100%';
    element.style.height = '100%';
    element.addEventListener(
      'ready',
      (event) => {
        const detail = (event as CustomEvent<{ irgUserInteraction: UserInteraction }>).detail;
        resolve({ element, ui: detail.irgUserInteraction });
      },
      { once: true },
    );
    host.appendChild(element);
  });
  await clipboardSetupSettled();
  return mounted;
}

/** Mirrors `IronErrorKind`, which the package declares as a type only. */
const ErrorKind = {
  WrongPassword: 1,
  LogonFailure: 2,
  AccessDenied: 3,
  RDCleanPath: 4,
  ProxyConnect: 5,
  NegotiationFailure: 6,
} as const;

function isIronError(error: unknown): error is IronError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as IronError).kind === 'function' &&
    typeof (error as IronError).backtrace === 'function'
  );
}

/**
 * A sentence for a failed connect. `proxyMessage` is what the local proxy reported, which is
 * more specific than anything the engine can see when the failure was on the network side.
 */
export function describeConnectError(error: unknown, proxyMessage: string | null): string {
  if (!isIronError(error)) {
    return proxyMessage ?? (error instanceof Error ? error.message : String(error));
  }
  switch (error.kind() as number) {
    case ErrorKind.WrongPassword:
    case ErrorKind.LogonFailure:
      return 'Sign-in failed. Check the username, password, and domain.';
    case ErrorKind.AccessDenied:
      return 'The server refused this account. It may not be allowed to sign in over Remote Desktop.';
    case ErrorKind.NegotiationFailure:
      return "AgentMate and the server couldn't agree on security settings. Try switching Network Level Authentication for this server.";
    case ErrorKind.RDCleanPath:
    case ErrorKind.ProxyConnect:
      return proxyMessage ?? 'Could not reach the server.';
    default:
      return proxyMessage ?? error.backtrace().split('\n')[0] ?? 'The connection failed.';
  }
}

/**
 * A desktop size servers accept: 200 to 8192 pixels each way, with the width a multiple of 4.
 * The display-control channel needs an even width, and xrdp pads odd-aligned widths to 4, which
 * skews every row of the picture if the client asked for anything else.
 */
export function clampDesktopSize(width: number, height: number): { width: number; height: number } {
  const clamp = (value: number): number => Math.min(8192, Math.max(200, Math.floor(value)));
  return { width: clamp(width) & ~3, height: clamp(height) };
}

/**
 * Lets a new clipboard copy replace one the server never pasted. The provider refuses a second
 * upload until the first is fully read, which with a clipboard means "until the user pastes",
 * so a copy that was never pasted would block every later one. The field name is pinned by the
 * exact package version in package.json.
 */
export function forgetUnpastedUpload(provider: RdpFileTransferProvider): void {
  const internal = provider as unknown as { uploadState?: unknown; retainedFiles?: unknown };
  internal.uploadState = undefined;
  internal.retainedFiles = undefined;
}
