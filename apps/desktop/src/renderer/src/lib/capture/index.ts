import { ElectronCaptureProvider } from './ElectronCaptureProvider';
import type { ICaptureProvider } from './types';

export type {
  CaptureCapabilities,
  CaptureOptions,
  CaptureSurface,
  ICaptureProvider,
} from './types';
export { ElectronCaptureProvider } from './ElectronCaptureProvider';

let provider: ICaptureProvider | null = null;

/**
 * Resolves the capture provider for this platform.
 *
 * Only the Electron provider exists today, so this is a trivial selection — but
 * it is the single place a native provider gets registered, which is what keeps
 * the rest of the codebase free of platform checks. A future version picks
 * DXGI / ScreenCaptureKit / PipeWire here and falls back to Electron.
 */
export function getCaptureProvider(): ICaptureProvider {
  provider ??= new ElectronCaptureProvider();
  return provider;
}
