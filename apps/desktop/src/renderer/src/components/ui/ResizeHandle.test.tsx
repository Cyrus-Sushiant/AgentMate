import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResizeHandle } from './ResizeHandle';

function setup(props: Partial<React.ComponentProps<typeof ResizeHandle>> = {}) {
  const onSizeChange = vi.fn();
  render(
    <ResizeHandle
      orientation="vertical"
      label="Resize sidebar"
      size={200}
      min={100}
      max={400}
      defaultSize={250}
      onSizeChange={onSizeChange}
      {...props}
    />,
  );
  return { onSizeChange, handle: screen.getByRole('separator', { name: 'Resize sidebar' }) };
}

describe('ResizeHandle', () => {
  it('describes itself to assistive tech', () => {
    const { handle } = setup();
    expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    expect(handle).toHaveAttribute('aria-valuenow', '200');
    expect(handle).toHaveAttribute('aria-valuemin', '100');
    expect(handle).toHaveAttribute('aria-valuemax', '400');
  });

  it('resizes by dragging, within the limits', () => {
    const { handle, onSizeChange } = setup();
    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 530, pointerId: 1 });
    expect(onSizeChange).toHaveBeenLastCalledWith(230);
    fireEvent.pointerMove(handle, { clientX: 900, pointerId: 1 });
    expect(onSizeChange).toHaveBeenLastCalledWith(400);
    fireEvent.pointerUp(handle, { pointerId: 1 });

    onSizeChange.mockClear();
    fireEvent.pointerMove(handle, { clientX: 100, pointerId: 1 });
    expect(onSizeChange).not.toHaveBeenCalled();
  });

  it('grows the other way when the sized pane is after the handle', () => {
    const { handle, onSizeChange } = setup({ orientation: 'horizontal', invert: true });
    fireEvent.pointerDown(handle, { button: 0, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 280, pointerId: 1 });
    expect(onSizeChange).toHaveBeenLastCalledWith(220);
  });

  it('steps with the arrow keys and resets on double click', () => {
    const { handle, onSizeChange } = setup();
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(onSizeChange).toHaveBeenLastCalledWith(216);
    fireEvent.keyDown(handle, { key: 'ArrowLeft' });
    expect(onSizeChange).toHaveBeenLastCalledWith(184);
    fireEvent.doubleClick(handle);
    expect(onSizeChange).toHaveBeenLastCalledWith(250);
  });

  it('draws a resting line unless it is quiet', () => {
    const { handle } = setup();
    expect(handle.querySelector('[data-resize-line]')).toHaveClass('bg-border');
  });

  it('hides its line at rest when quiet, and still shows it while dragging', () => {
    const { handle } = setup({ quiet: true });
    const line = handle.querySelector('[data-resize-line]');
    expect(line).toHaveClass('bg-transparent');
    expect(line).not.toHaveClass('bg-border');

    fireEvent.pointerDown(handle, { button: 0, clientX: 500, pointerId: 1 });
    expect(line).toHaveClass('bg-primary');
    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(line).toHaveClass('bg-transparent');
  });
});
