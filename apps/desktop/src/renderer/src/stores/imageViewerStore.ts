import { create } from 'zustand';

interface ImageViewerState {
  /** The image file on screen, or null when the viewer is closed. */
  path: string | null;
}

export const useImageViewerStore = create<ImageViewerState>(() => ({ path: null }));

/** Shows an image file at full size over the whole window. */
export function openImageViewer(path: string): void {
  useImageViewerStore.setState({ path });
}

export function closeImageViewer(): void {
  useImageViewerStore.setState({ path: null });
}
