// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { formatImageSize, ImageView } from './ImageView';

/**
 * The viewer behind every picture the workspace opens. jsdom decodes nothing, so the tests hand
 * the `<img>` its natural size and fire the load themselves, which is all the component reads.
 */

function renderView(onSize?: (size: { width: number; height: number }) => void) {
  return render(
    <TooltipProvider>
      <ImageView src="data:image/png;base64,AAA" alt="logo.png" onSize={onSize} />
    </TooltipProvider>,
  );
}

/** Stands in for a decoded picture: jsdom leaves naturalWidth and naturalHeight at 0. */
function load(width: number, height: number): HTMLImageElement {
  const image = screen.getByAltText('logo.png') as HTMLImageElement;
  Object.defineProperty(image, 'naturalWidth', { value: width, configurable: true });
  Object.defineProperty(image, 'naturalHeight', { value: height, configurable: true });
  fireEvent.load(image);
  return image;
}

function zoomLabel(): string {
  const button = screen
    .getAllByRole('button')
    .find((element) => element.textContent?.endsWith('%'));
  if (!button) throw new Error('the zoom pill is not on screen');
  return button.textContent ?? '';
}

afterEach(cleanup);

describe('ImageView', () => {
  it('holds the controls back until the picture has loaded', () => {
    renderView();
    expect(screen.queryByLabelText('Zoom in')).not.toBeInTheDocument();

    load(800, 600);
    expect(screen.getByLabelText('Zoom in')).toBeInTheDocument();
    expect(zoomLabel()).toBe('100%');
  });

  it('reports the natural size it decoded', () => {
    const onSize = vi.fn();
    renderView(onSize);
    load(1920, 1080);
    expect(onSize).toHaveBeenCalledWith({ width: 1920, height: 1080 });
  });

  it('walks the zoom through its stops', () => {
    renderView();
    load(800, 600);

    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(zoomLabel()).toBe('150%');
    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(zoomLabel()).toBe('200%');
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    fireEvent.click(screen.getByLabelText('Zoom out'));
    expect(zoomLabel()).toBe('75%');
  });

  it('scales the picture by the zoom it is showing', () => {
    renderView();
    const image = load(800, 600);
    expect(image.style.width).toBe('800px');

    fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(image.style.width).toBe('1200px');
    expect(image.style.height).toBe('900px');
  });

  it('only offers "fit" once a zoom has been pinned', () => {
    renderView();
    load(800, 600);
    expect(screen.getByLabelText('Fit to the pane')).toBeDisabled();

    fireEvent.click(screen.getByLabelText('Zoom in'));
    const fit = screen.getByLabelText('Fit to the pane');
    expect(fit).toBeEnabled();

    fireEvent.click(fit);
    expect(zoomLabel()).toBe('100%');
    expect(screen.getByLabelText('Fit to the pane')).toBeDisabled();
  });

  it('double click pins the actual size, and again lets it fit', () => {
    renderView();
    const image = load(800, 600);

    fireEvent.doubleClick(image);
    expect(screen.getByLabelText('Fit to the pane')).toBeEnabled();
    fireEvent.doubleClick(image);
    expect(screen.getByLabelText('Fit to the pane')).toBeDisabled();
  });

  it('zooms on Ctrl and the wheel, and leaves a plain wheel alone', () => {
    renderView();
    const image = load(800, 600);
    const pane = image.parentElement as HTMLElement;

    fireEvent.wheel(pane, { deltaY: -120, ctrlKey: true });
    expect(zoomLabel()).toBe('150%');
    fireEvent.wheel(pane, { deltaY: 120, ctrlKey: true });
    expect(zoomLabel()).toBe('100%');

    fireEvent.wheel(pane, { deltaY: -120 });
    expect(zoomLabel()).toBe('100%');
  });

  it('keeps the pixels crisp well past actual size', () => {
    renderView();
    const image = load(800, 600);
    expect(image.style.imageRendering).toBe('auto');

    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByLabelText('Zoom in'));
    expect(zoomLabel()).toBe('400%');
    expect(image.style.imageRendering).toBe('pixelated');
  });

  it('says so when the file cannot be painted, and drops the controls', () => {
    renderView();
    load(800, 600);
    fireEvent.error(screen.getByAltText('logo.png'));

    expect(screen.getByText('This image could not be shown')).toBeInTheDocument();
    expect(screen.queryByLabelText('Zoom in')).not.toBeInTheDocument();
  });
});

describe('formatImageSize', () => {
  it('reads as a pair of dimensions, or nothing at all', () => {
    expect(formatImageSize({ width: 1920, height: 1080 })).toBe('1920 × 1080');
    expect(formatImageSize(null)).toBeNull();
  });
});
