import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import App from './App';
import { fakeClient } from './src/remote/__fixtures__/fakeClient';
import type { useRemoteClient } from './src/remote/useRemoteClient';

type RemoteClient = ReturnType<typeof useRemoteClient>;

/** The client state the mocked hook hands back; each test sets it first. */
let mockClient: RemoteClient = fakeClient();

jest.mock('./src/remote/useRemoteClient', () => ({
  useRemoteClient: () => mockClient,
}));

/**
 * The real SafeAreaProvider renders nothing until native insets arrive, which
 * never happens under the test renderer, so the package's own mock stands in.
 */
jest.mock('react-native-safe-area-context', () => {
  const mock = jest.requireActual('react-native-safe-area-context/jest/mock') as {
    default: unknown;
  };
  return mock.default;
});

describe('App', () => {
  beforeEach(() => {
    mockClient = fakeClient();
    jest.mocked(SplashScreen.hideAsync).mockClear();
  });

  it('shows the connect screen while idle', async () => {
    await render(<App />);
    expect(screen.getByText('Pair a new computer')).toBeTruthy();
    // No session chrome: the ⋯ toggle only exists on the remote screen.
    expect(screen.queryByText('⋯')).toBeNull();
  });

  it('swaps to the remote screen once connected', async () => {
    mockClient = fakeClient({
      status: 'connected',
      remoteDeviceName: 'STUDIO-PC',
      remoteScreen: { width: 1920, height: 1080 },
      phase: 'connected',
    });
    await render(<App />);
    expect(screen.getByText('⋯')).toBeTruthy();
    expect(screen.queryByText('Pair a new computer')).toBeNull();
  });

  it('swaps to the remote screen as soon as dialing starts', async () => {
    // Connecting belongs on the session screen so the user sees progress
    // instead of a connect form that appears to have done nothing.
    mockClient = fakeClient({ status: 'connecting' });
    await render(<App />);
    expect(screen.getByText('Connecting…')).toBeTruthy();
  });

  it('goes back to the connect screen with the failure explained', async () => {
    mockClient = fakeClient({ status: 'error', error: 'That pairing code is not valid.' });
    await render(<App />);
    expect(screen.getByText('Pair a new computer')).toBeTruthy();
    expect(screen.getByText('That pairing code is not valid.')).toBeTruthy();
  });

  it('hides the splash screen once the tree is up', async () => {
    // An unhidden splash screen covers the app forever on a real device.
    await render(<App />);
    expect(jest.mocked(SplashScreen.hideAsync)).toHaveBeenCalled();
  });

  it('hides the splash screen again when the root lays out', async () => {
    // Belt and braces: on a cold start the effect can run before the first
    // frame is on screen, which is when hiding silently does nothing.
    await render(<App />);
    jest.mocked(SplashScreen.hideAsync).mockClear();

    const root = screen.root;
    if (!root) throw new Error('the app rendered nothing');
    await fireEvent(root, 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
    });
    expect(jest.mocked(SplashScreen.hideAsync)).toHaveBeenCalled();
  });
});
