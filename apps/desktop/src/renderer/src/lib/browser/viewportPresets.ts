/**
 * Device sizes the browser tab can show a page at. Anything but `responsive` renders the page at
 * the device's CSS size and scales it down when the pane is smaller.
 */

export type ViewportPresetId = 'responsive' | 'mobile' | 'tablet' | 'desktop';

export interface ViewportPreset {
  id: ViewportPresetId;
  label: string;
  width: number;
  height: number;
}

export const VIEWPORT_PRESETS: readonly ViewportPreset[] = [
  { id: 'responsive', label: 'Responsive', width: 0, height: 0 },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
  { id: 'tablet', label: 'Tablet', width: 820, height: 1180 },
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900 },
];

const MIN_SCALE = 0.25;

export function viewportPreset(id: ViewportPresetId | undefined): ViewportPreset {
  return (
    VIEWPORT_PRESETS.find((preset) => preset.id === id) ?? (VIEWPORT_PRESETS[0] as ViewportPreset)
  );
}

/**
 * The CSS size the page gets and how much to scale it by so it fits in a pane of the given size.
 */
export function fitViewport(
  id: ViewportPresetId,
  pane: { width: number; height: number },
): { width: number; height: number; scale: number } {
  const preset = viewportPreset(id);
  if (preset.id === 'responsive') return { width: pane.width, height: pane.height, scale: 1 };
  const scale = Math.min(1, pane.width / preset.width, pane.height / preset.height);
  return { width: preset.width, height: preset.height, scale: Math.max(MIN_SCALE, scale) };
}
