import { beforeEach, describe, expect, it } from 'vitest';
import type { BrowserAnnotation, PickedElement } from '@/lib/browser/types';
import { MAX_ANNOTATIONS_PER_TAB, markersFor, useBrowserStore } from './browserStore';

function store() {
  return useBrowserStore.getState();
}

function element(y: number): PickedElement {
  return {
    tagName: 'button',
    selector: `button:nth-of-type(${y})`,
    path: 'main > button',
    role: 'button',
    name: 'Save',
    text: 'Save',
    html: '<button>Save</button>',
    attributes: {},
    styles: {},
    react: null,
    rectViewport: { x: 10, y, width: 50, height: 20 },
    rectPage: { x: 10, y: y + 500, width: 50, height: 20 },
    fixed: false,
  };
}

function draft(
  tabId: string,
  url = 'http://localhost:5173/',
  y = 1,
): Omit<BrowserAnnotation, 'id' | 'createdAt'> {
  return {
    tabId,
    page: { url, title: 'Home', viewport: { width: 1280, height: 800 }, dpr: 1 },
    element: element(y),
    comment: `comment ${y}`,
    intent: 'change',
    preset: null,
    screenshotPath: null,
    thumbDataUrl: null,
  };
}

beforeEach(() => {
  useBrowserStore.setState({ annotations: {}, recentUrls: {} });
});

describe('comments', () => {
  it('adds a comment to its tab and hands back its id', () => {
    const id = store().addAnnotation(draft('b1'));
    expect(id).toBeTruthy();
    expect(store().annotations.b1).toEqual([
      expect.objectContaining({ id, comment: 'comment 1', tabId: 'b1' }),
    ]);
    expect(store().annotations.b2).toBeUndefined();
  });

  it('edits the comment and its intent', () => {
    const id = store().addAnnotation(draft('b1'));
    store().updateAnnotation('b1', id as string, { comment: 'Bigger', intent: 'question' });
    expect(store().annotations.b1?.[0]).toMatchObject({ comment: 'Bigger', intent: 'question' });
  });

  it('fills in the screenshot once it is saved', () => {
    const id = store().addAnnotation(draft('b1'));
    store().updateAnnotation('b1', id as string, {
      screenshotPath: '/tmp/el.png',
      thumbDataUrl: 'data:image/png;base64,x',
    });
    expect(store().annotations.b1?.[0]?.screenshotPath).toBe('/tmp/el.png');
  });

  it('removes one comment, several, or all of a tab', () => {
    const a = store().addAnnotation(draft('b1', undefined, 1)) as string;
    const b = store().addAnnotation(draft('b1', undefined, 2)) as string;
    const c = store().addAnnotation(draft('b1', undefined, 3)) as string;
    store().removeAnnotation('b1', a);
    expect(store().annotations.b1?.map((one) => one.id)).toEqual([b, c]);
    store().removeAnnotations('b1', [b]);
    expect(store().annotations.b1?.map((one) => one.id)).toEqual([c]);
    store().clearTab('b1');
    expect(store().annotations.b1).toBeUndefined();
  });

  it(`stops at ${MAX_ANNOTATIONS_PER_TAB} comments per tab`, () => {
    for (let i = 0; i < MAX_ANNOTATIONS_PER_TAB; i++) {
      expect(store().addAnnotation(draft('b1', undefined, i))).not.toBeNull();
    }
    expect(store().addAnnotation(draft('b1'))).toBeNull();
    expect(store().annotations.b1).toHaveLength(MAX_ANNOTATIONS_PER_TAB);
  });
});

describe('markersFor', () => {
  it('numbers the pins of the page on screen in the order the comments were left', () => {
    store().addAnnotation(draft('b1', 'http://localhost:5173/', 1));
    store().addAnnotation(draft('b1', 'http://localhost:5173/pricing', 2));
    store().addAnnotation(draft('b1', 'http://localhost:5173/', 3));
    const markers = markersFor(store().annotations.b1 ?? [], 'http://localhost:5173/');
    expect(markers.map((marker) => [marker.n, marker.rectPage.y])).toEqual([
      [1, 501],
      [3, 503],
    ]);
  });

  it('matches a page with or without its fragment', () => {
    store().addAnnotation(draft('b1', 'http://localhost:5173/docs#intro'));
    expect(markersFor(store().annotations.b1 ?? [], 'http://localhost:5173/docs')).toHaveLength(1);
  });
});

describe('recent addresses', () => {
  it('keeps the latest first, once each, per project', () => {
    store().rememberUrl('p1', 'http://localhost:5173/');
    store().rememberUrl('p1', 'https://example.com/');
    store().rememberUrl('p1', 'http://localhost:5173/');
    store().rememberUrl('p2', 'https://other.dev/');
    expect(store().recentUrls.p1).toEqual(['http://localhost:5173/', 'https://example.com/']);
    expect(store().recentUrls.p2).toEqual(['https://other.dev/']);
  });

  it('keeps only the last eight and ignores blank pages', () => {
    for (let i = 0; i < 12; i++) store().rememberUrl('p1', `http://localhost:${3000 + i}/`);
    store().rememberUrl('p1', 'about:blank');
    expect(store().recentUrls.p1).toHaveLength(8);
    expect(store().recentUrls.p1?.[0]).toBe('http://localhost:3011/');
  });
});
