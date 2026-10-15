import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReorderableGroup, type ReorderMotion } from './ReorderableGroup';

interface Item {
  id: string;
  name: string;
}

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Bravo' },
  { id: 'c', name: 'Charlie' },
];

const FOUR: Item[] = [...ITEMS, { id: 'd', name: 'Delta' }];

/** Jsdom has no layout, so each test lays its items out: rows 60px tall, stacked flush. */
function stackedRows(count: number): Box[] {
  return Array.from({ length: count }, (_, index) => ({
    left: 0,
    top: index * 60,
    width: 300,
    height: 60,
  }));
}

/** Cards 280px wide and 180px tall, 300px apart across and 200px down, filled left to right. */
function gridCells(count: number, columns: number): Box[] {
  return Array.from({ length: count }, (_, index) => ({
    left: (index % columns) * 300,
    top: Math.floor(index / columns) * 200,
    width: 280,
    height: 180,
  }));
}

function Row({ item, motion }: { item: Item; motion: ReorderMotion }): React.JSX.Element {
  return (
    <div {...motion.itemProps} data-dragging={String(motion.dragging)}>
      <span data-testid={`grip-${item.id}`} onPointerDown={motion.onGripPointerDown} />
      {item.name}
    </div>
  );
}

function setup(props: { items?: Item[]; enabled?: boolean; boxes?: Box[] } = {}) {
  const items = props.items ?? ITEMS;
  const boxes = props.boxes ?? stackedRows(items.length);
  // Layout follows the DOM: whichever item sits in a place reads that place's box.
  const boxFor = (element: HTMLElement): Box =>
    boxes[Array.from(element.parentElement?.children ?? []).indexOf(element)] ?? {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
    };
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxFor(this).left;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxFor(this).top;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxFor(this).width;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return boxFor(this).height;
  });

  const onMove = vi.fn();
  const view = (list: Item[]) => (
    <ReorderableGroup
      items={list}
      getId={(item) => item.id}
      enabled={props.enabled ?? true}
      onMove={onMove}
      renderItem={(item, motion) => <Row item={item} motion={motion} />}
    />
  );
  const { container, rerender } = render(view(items));
  return { container, onMove, rerender: (list: Item[]) => rerender(view(list)) };
}

function grip(id: string): HTMLElement {
  return screen.getByTestId(`grip-${id}`);
}

function press(id: string, x: number, y: number): void {
  fireEvent.pointerDown(grip(id), { button: 0, clientX: x, clientY: y, pointerId: 1 });
}

function moveTo(id: string, x: number, y: number): void {
  fireEvent.pointerMove(grip(id), { clientX: x, clientY: y, pointerId: 1 });
}

function release(id: string): void {
  fireEvent.pointerUp(grip(id), { pointerId: 1 });
}

function itemFor(container: HTMLElement, id: string): HTMLElement {
  const item = container.querySelector<HTMLElement>(`[data-reorder-id="${id}"]`);
  if (!item) throw new Error(`No item for ${id}`);
  return item;
}

function orderOf(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-reorder-id]'), (item) =>
    String(item.dataset.reorderId),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReorderableGroup', () => {
  it('renders the items in the order it was given', () => {
    const { container } = setup();
    expect(orderOf(container)).toEqual(['a', 'b', 'c']);
  });

  it('moves the dragged item with the pointer and slides the item it passes', () => {
    const { container, onMove } = setup();
    press('a', 0, 0);
    moveTo('a', 0, 70);

    expect(itemFor(container, 'a').style.transform).toBe('translate(0px, 70px)');
    expect(itemFor(container, 'a').dataset.dragging).toBe('true');
    expect(itemFor(container, 'b').style.transform).toBe('translate(0px, -60px)');
    expect(itemFor(container, 'c').style.transform).toBe('');

    release('a');
    expect(onMove).toHaveBeenCalledWith(0, 1);
    expect(orderOf(container)).toEqual(['b', 'a', 'c']);
    // The landed item is handed back to its own transitions, with nothing left inline.
    expect(itemFor(container, 'a').style.transform).toBe('');
    expect(itemFor(container, 'a').style.transition).toBe('');
  });

  it('slides the items down when one is dragged up past them', () => {
    const { container, onMove } = setup();
    press('c', 0, 200);
    moveTo('c', 0, 100);

    expect(itemFor(container, 'a').style.transform).toBe('translate(0px, 60px)');
    expect(itemFor(container, 'b').style.transform).toBe('translate(0px, 60px)');

    release('c');
    expect(onMove).toHaveBeenCalledWith(2, 0);
    expect(orderOf(container)).toEqual(['c', 'a', 'b']);
  });

  it('keeps the dragged item inside the group', () => {
    const { container, onMove } = setup();
    press('a', 0, 0);
    moveTo('a', 0, 900);
    expect(itemFor(container, 'a').style.transform).toBe('translate(0px, 120px)');

    release('a');
    expect(onMove).toHaveBeenCalledWith(0, 2);
    expect(orderOf(container)).toEqual(['b', 'c', 'a']);
  });

  it('does not reorder when the item is dropped where it started', () => {
    const { container, onMove } = setup();
    press('b', 0, 100);
    moveTo('b', 0, 110);
    release('b');

    expect(onMove).not.toHaveBeenCalled();
    expect(orderOf(container)).toEqual(['a', 'b', 'c']);
    expect(itemFor(container, 'b').style.transform).toBe('');
  });

  it('drops nothing when the drag is cancelled', () => {
    const { container, onMove } = setup();
    press('a', 0, 0);
    moveTo('a', 0, 70);
    fireEvent.pointerCancel(grip('a'), { pointerId: 1 });

    expect(onMove).not.toHaveBeenCalled();
    expect(orderOf(container)).toEqual(['a', 'b', 'c']);
    expect(itemFor(container, 'a').style.transform).toBe('');
  });

  it('ignores grips while the order is locked', () => {
    const { container, onMove } = setup({ enabled: false });
    press('a', 0, 0);
    moveTo('a', 0, 70);
    release('a');

    expect(onMove).not.toHaveBeenCalled();
    expect(itemFor(container, 'a').style.transform).toBe('');
  });

  it('holds the dropped order until the caller hands it new items', () => {
    const { container, onMove } = setup();
    press('a', 0, 0);
    moveTo('a', 0, 70);
    release('a');

    // Nothing has reloaded yet, so the list keeps the order it was dropped into.
    expect(onMove).toHaveBeenCalledWith(0, 1);
    expect(orderOf(container)).toEqual(['b', 'a', 'c']);
  });

  it("takes the caller's order again once its items change", () => {
    const { container, rerender } = setup();
    press('a', 0, 0);
    moveTo('a', 0, 70);
    release('a');
    expect(orderOf(container)).toEqual(['b', 'a', 'c']);

    rerender([...ITEMS]);
    expect(orderOf(container)).toEqual(['a', 'b', 'c']);
  });

  it('moves across a grid row and slides the cards it passes', () => {
    const { container, onMove } = setup({ items: FOUR, boxes: gridCells(4, 2) });
    press('a', 0, 0);
    moveTo('a', 300, 0);

    expect(itemFor(container, 'a').style.transform).toBe('translate(300px, 0px)');
    expect(itemFor(container, 'b').style.transform).toBe('translate(-300px, 0px)');
    expect(itemFor(container, 'c').style.transform).toBe('');

    release('a');
    expect(onMove).toHaveBeenCalledWith(0, 1);
    expect(orderOf(container)).toEqual(['b', 'a', 'c', 'd']);
  });

  it('moves down into the next grid row and shifts the cards in both directions', () => {
    const { container, onMove } = setup({ items: FOUR, boxes: gridCells(4, 2) });
    press('a', 0, 0);
    moveTo('a', 0, 200);

    expect(itemFor(container, 'a').style.transform).toBe('translate(0px, 200px)');
    // b steps left into a's old cell, and c steps from the first column of row two into b's.
    expect(itemFor(container, 'b').style.transform).toBe('translate(-300px, 0px)');
    expect(itemFor(container, 'c').style.transform).toBe('translate(300px, -200px)');
    expect(itemFor(container, 'd').style.transform).toBe('');

    release('a');
    expect(onMove).toHaveBeenCalledWith(0, 2);
    expect(orderOf(container)).toEqual(['b', 'c', 'a', 'd']);
  });
});
