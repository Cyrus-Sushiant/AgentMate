/**
 * Stub for the Iron Remote Desktop web component packages. The real ones load WebAssembly and
 * register a custom element that talks to a live RDP proxy, so tests get the surface only.
 */

interface Disposable {
  dispose: () => void;
}

const nothing = (): Disposable => ({ dispose: () => undefined });

export const rdpBackend = { kind: 'rdp-test-backend' };
export default rdpBackend;

export function init(): void {
  return undefined;
}

export function preConnectionBlob(): string {
  return '';
}

/** The element the renderer mounts. Records what it was asked to do. */
export class IronRemoteDesktopStub extends HTMLElement {
  calls: { name: string; args: unknown[] }[] = [];

  connect(...args: unknown[]): { onConnected: typeof nothing } {
    this.calls.push({ name: 'connect', args });
    return { onConnected: nothing };
  }
  shutdown(): void {
    this.calls.push({ name: 'shutdown', args: [] });
  }
  setKeyboardUnicodeMode(): void {
    return undefined;
  }
  setCursorStyleOverride(): void {
    return undefined;
  }
  onSessionEvent = nothing;
  onActiveSessionChange = nothing;
}

if (typeof customElements !== 'undefined' && !customElements.get('iron-remote-desktop-test')) {
  customElements.define('iron-remote-desktop-test', IronRemoteDesktopStub);
}

export const loggingLevel = { info: 'info', debug: 'debug' };
