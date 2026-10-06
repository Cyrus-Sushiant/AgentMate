import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  findScrollContainer,
  scrollBehavior,
  scrollContainerToTop,
  scrollToInContainer,
} from './scrollContainer';

/** jsdom has no layout, so positions are stubbed on the elements the tests care about. */

function box(parent: Element | null, overflowY: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.overflowY = overflowY;
  parent?.appendChild(el);
  return el;
}

function place(el: Element, top: number): void {
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
}

/** outer (hidden) > frame (hidden) > scroller (auto) > page > target */
function tree(scrollerOverflow = 'auto') {
  const outer = box(document.body, 'hidden');
  const frame = box(outer, 'hidden');
  const scroller = box(frame, scrollerOverflow);
  const page = box(scroller, 'visible');
  const target = box(page, 'visible');
  const spies = [outer, frame, scroller].map((el) => {
    const scrollTo = vi.fn();
    el.scrollTo = scrollTo as unknown as typeof el.scrollTo;
    return scrollTo;
  });
  return { outer, frame, scroller, page, target, spies };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('findScrollContainer', () => {
  it('picks the nearest ancestor that scrolls with auto', () => {
    const { scroller, target } = tree('auto');
    expect(findScrollContainer(target)).toBe(scroller);
  });

  it('accepts overflow-y scroll too', () => {
    const { scroller, target } = tree('scroll');
    expect(findScrollContainer(target)).toBe(scroller);
  });

  it('prefers an inner scroller over an outer one', () => {
    const { scroller, target } = tree('auto');
    const inner = box(null, 'auto');
    scroller.appendChild(inner);
    inner.appendChild(target);
    expect(findScrollContainer(target)).toBe(inner);
  });

  it('skips overflow hidden wrappers and returns null when nothing scrolls', () => {
    const { target } = tree('hidden');
    expect(findScrollContainer(target)).toBeNull();
    expect(findScrollContainer(null)).toBeNull();
  });
});

describe('scrollToInContainer', () => {
  it('scrolls only the nearest scroller, by the target offset inside it', () => {
    const { scroller, target, spies } = tree();
    scroller.scrollTop = 100;
    place(scroller, 50);
    place(target, 350);
    expect(scrollToInContainer(target)).toBe(true);
    expect(spies[2]).toHaveBeenCalledWith({ top: 400, behavior: 'auto' });
    expect(spies[0]).not.toHaveBeenCalled();
    expect(spies[1]).not.toHaveBeenCalled();
  });

  it('subtracts the scroll margin and the extra offset, and never goes above zero', () => {
    const { scroller, target, spies } = tree();
    scroller.scrollTop = 0;
    place(scroller, 0);
    place(target, 200);
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
      const style = real(el, pseudo);
      return el === target
        ? ({ ...style, scrollMarginTop: '20px', overflowY: 'visible' } as CSSStyleDeclaration)
        : style;
    });
    scrollToInContainer(target, { offset: 10 });
    expect(spies[2]).toHaveBeenLastCalledWith({ top: 170, behavior: 'auto' });
    place(target, 5);
    scrollToInContainer(target);
    expect(spies[2]).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });
  });

  it('glides when asked to', () => {
    const { target, spies } = tree();
    place(target, 10);
    scrollToInContainer(target, { smooth: true });
    expect(spies[2]).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
  });

  it('sets scrollTop when the element has no scrollTo', () => {
    const { scroller, target } = tree();
    scroller.scrollTo = undefined as unknown as typeof scroller.scrollTo;
    scroller.scrollTop = 30;
    place(scroller, 0);
    place(target, 70);
    scrollToInContainer(target);
    expect(scroller.scrollTop).toBe(100);
  });

  it('does nothing and reports false without a scroller', () => {
    const { target, spies } = tree('hidden');
    expect(scrollToInContainer(target)).toBe(false);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('scrollContainerToTop', () => {
  it('resets only the nearest scroller', () => {
    const { page, spies } = tree();
    expect(scrollContainerToTop(page)).toBe(true);
    expect(spies[2]).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
    expect(spies[0]).not.toHaveBeenCalled();
    expect(spies[1]).not.toHaveBeenCalled();
  });

  it('returns false when nothing scrolls', () => {
    const { page } = tree('hidden');
    expect(scrollContainerToTop(page)).toBe(false);
  });
});

describe('scrollBehavior', () => {
  it('is auto unless smooth is wanted', () => {
    expect(scrollBehavior(false)).toBe('auto');
  });

  it('falls back to auto when the user prefers reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
    }));
    expect(scrollBehavior(true)).toBe('auto');
  });

  it('is smooth otherwise', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    expect(scrollBehavior(true)).toBe('smooth');
  });
});
