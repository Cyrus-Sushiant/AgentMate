import { describe, expect, it, vi } from 'vitest';
import { Backend, FakeSession, FakeSessionBuilder } from '../../../../test/renderer/mocks/ironRdp';
import { mountRemoteDesktop, wrapBackend } from './ironRdp';

describe('wrapBackend', () => {
  it('keeps every other member of the backend as it is', () => {
    const wrapped = wrapBackend(Backend as never, () => undefined) as unknown as typeof Backend;
    expect(wrapped.InputTransaction).toBe(Backend.InputTransaction);
    expect(wrapped.DeviceEvent).toBe(Backend.DeviceEvent);
    expect(wrapped.DesktopSize).toBe(Backend.DesktopSize);
    expect(wrapped.SessionBuilder).not.toBe(Backend.SessionBuilder);
  });

  it('hands over the session once connect resolves, and still returns it', async () => {
    const onSession = vi.fn();
    const wrapped = wrapBackend(Backend as never, onSession) as unknown as typeof Backend;
    const builder = new wrapped.SessionBuilder();
    expect(builder).toBeInstanceOf(FakeSessionBuilder);
    // Chained builder calls still reach the real builder.
    expect(builder.renderCanvas()).toBe(builder);
    expect(onSession).not.toHaveBeenCalled();

    const session = await builder.connect();
    expect(session).toBeInstanceOf(FakeSession);
    expect(onSession).toHaveBeenCalledWith(session);
    expect(builder.calls).toEqual(['renderCanvas', 'connect']);
  });

  it('passes a failed connect through without calling back', async () => {
    const onSession = vi.fn();
    class Failing extends FakeSessionBuilder {
      override async connect(): Promise<FakeSession> {
        throw new Error('nope');
      }
    }
    const wrapped = wrapBackend(
      { ...Backend, SessionBuilder: Failing } as never,
      onSession,
    ) as unknown as {
      SessionBuilder: new () => FakeSessionBuilder;
    };
    await expect(new wrapped.SessionBuilder().connect()).rejects.toThrow('nope');
    expect(onSession).not.toHaveBeenCalled();
  });
});

describe('mountRemoteDesktop', () => {
  it('gives the element a wrapped backend and exposes its session and canvas', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const onSession = vi.fn();

    const mounting = mountRemoteDesktop(host, { onSession });
    // The engine loads before the element is created.
    await vi.waitFor(() => expect(host.firstElementChild).not.toBeNull());
    const element = host.firstElementChild as HTMLElement & {
      module: typeof Backend;
    };
    const root = element.attachShadow({ mode: 'open' });
    const canvas = document.createElement('canvas');
    root.appendChild(canvas);
    element.dispatchEvent(
      new CustomEvent('ready', { detail: { irgUserInteraction: { kind: 'ui' } } }),
    );
    const mounted = await mounting;

    expect(mounted.element).toBe(element);
    expect(mounted.canvas()).toBe(canvas);
    expect(mounted.backend).toBe(element.module);

    const session = await new element.module.SessionBuilder().connect();
    expect(onSession).toHaveBeenCalledWith(session);
    host.remove();
  });

  it('reports no canvas before the element has drawn one', async () => {
    const host = document.createElement('div');
    const mounting = mountRemoteDesktop(host);
    await vi.waitFor(() => expect(host.firstElementChild).not.toBeNull());
    host.firstElementChild?.dispatchEvent(
      new CustomEvent('ready', { detail: { irgUserInteraction: {} } }),
    );
    const mounted = await mounting;
    expect(mounted.canvas()).toBeNull();
  });
});
