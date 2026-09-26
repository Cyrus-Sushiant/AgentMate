import { describe, expect, it } from 'vitest';
import {
  elementLabel,
  formatAnnotationsPrompt,
  formatElementContext,
  sanitizePageUrl,
} from './annotationPrompt';
import type { BrowserAnnotation, PickedElement, PickedPage } from './types';

const page: PickedPage = {
  url: 'http://localhost:5173/pricing',
  title: 'Pricing',
  viewport: { width: 1280, height: 800 },
  dpr: 1,
};

function element(overrides: Partial<PickedElement> = {}): PickedElement {
  return {
    tagName: 'button',
    selector: 'section.plans > button.buy',
    path: 'main > section.plans > button.buy',
    role: 'button',
    name: 'Buy now',
    text: 'Buy now',
    html: '<button class="buy">Buy now</button>',
    attributes: { class: 'buy' },
    styles: { display: 'flex', width: '120px', color: 'rgb(255, 255, 255)' },
    react: { components: ['PricingCard', 'Button'], source: 'src/components/Button.tsx:12:3' },
    rectViewport: { x: 10, y: 20, width: 120, height: 40 },
    rectPage: { x: 10, y: 620, width: 120, height: 40 },
    fixed: false,
    ...overrides,
  };
}

function annotation(overrides: Partial<BrowserAnnotation> = {}): BrowserAnnotation {
  return {
    id: 'a1',
    tabId: 'b1',
    page,
    element: element(),
    comment: 'Make this full width on phones.',
    intent: 'change',
    preset: null,
    screenshotPath: 'C:\\Users\\me\\AppData\\pasted-images\\el-1.png',
    thumbDataUrl: null,
    createdAt: 1,
    ...overrides,
  };
}

describe('elementLabel', () => {
  it('names the innermost component, the tag and the accessible name', () => {
    expect(elementLabel(element())).toBe('Button button "Buy now"');
  });

  it('falls back to the text, then to the tag alone', () => {
    expect(elementLabel(element({ react: null, name: null, text: 'Hello there' }))).toBe(
      'button "Hello there"',
    );
    expect(elementLabel(element({ react: null, name: null, text: '' }))).toBe('button');
  });

  it('shortens a long name', () => {
    const label = elementLabel(element({ react: null, name: 'x'.repeat(200) }));
    expect(label.length).toBeLessThan(80);
    expect(label.endsWith('…"')).toBe(true);
  });
});

describe('sanitizePageUrl', () => {
  it('keeps the path and the query', () => {
    expect(sanitizePageUrl('http://localhost:5173/pricing?plan=pro')).toBe(
      'http://localhost:5173/pricing?plan=pro',
    );
  });

  it('hides values of parameters that look like secrets', () => {
    expect(sanitizePageUrl('https://app.dev/cb?code=abc&access_token=xyz&apiKey=1&page=2')).toBe(
      'https://app.dev/cb?code=redacted&access_token=redacted&apiKey=redacted&page=2',
    );
  });

  it('drops a plain fragment but keeps a hash route', () => {
    expect(sanitizePageUrl('http://localhost:3000/docs#install')).toBe(
      'http://localhost:3000/docs',
    );
    expect(sanitizePageUrl('http://localhost:3000/#/settings/profile')).toBe(
      'http://localhost:3000/#/settings/profile',
    );
  });

  it('leaves text that is not a url as it is', () => {
    expect(sanitizePageUrl('about:blank')).toBe('about:blank');
  });
});

describe('formatAnnotationsPrompt', () => {
  it('describes one comment with everything the agent needs to find the element', () => {
    const text = formatAnnotationsPrompt([annotation()]);
    expect(text).toContain('## Page feedback: /pricing');
    expect(text).toContain('**URL:** http://localhost:5173/pricing');
    expect(text).toContain('**Viewport:** 1280×800');
    expect(text).toContain('### 1. Button button "Buy now"');
    expect(text).toContain('**Intent:** Change');
    expect(text).toContain('**Comment:** Make this full width on phones.');
    expect(text).toContain('**Selector:** `section.plans > button.buy`');
    expect(text).toContain('**Components:** PricingCard > Button');
    expect(text).toContain('**Source:** src/components/Button.tsx:12:3');
    expect(text).toContain('**Styles:** display: flex; width: 120px; color: rgb(255, 255, 255)');
    expect(text).toContain('**Screenshot:** C:\\Users\\me\\AppData\\pasted-images\\el-1.png');
    expect(text).toContain('```html\n<button class="buy">Buy now</button>\n```');
  });

  it('opens with a line telling the agent what it is looking at', () => {
    const text = formatAnnotationsPrompt([annotation()]);
    expect(text.split('\n')[0]).toMatch(/comments? .*page/i);
  });

  it('numbers several comments in order', () => {
    const text = formatAnnotationsPrompt([
      annotation(),
      annotation({ id: 'a2', comment: 'Why is this grey?', intent: 'question' }),
    ]);
    expect(text).toContain('### 1. ');
    expect(text).toContain('### 2. ');
    expect(text).toContain('**Intent:** Question (answer it, don’t change code)');
    expect(text).toContain('left 2 comments');
  });

  it('groups comments by page', () => {
    const other = { ...page, url: 'http://localhost:5173/', title: 'Home' };
    const text = formatAnnotationsPrompt([
      annotation(),
      annotation({ id: 'a2', page: other }),
      annotation({ id: 'a3' }),
    ]);
    expect(text.match(/## Page feedback/g)).toHaveLength(2);
    expect(text.indexOf('## Page feedback: /pricing')).toBeLessThan(
      text.indexOf('## Page feedback: /\n'),
    );
    expect(text.indexOf('### 2. ')).toBeLessThan(text.indexOf('## Page feedback: /\n'));
  });

  it('names the device preset next to the viewport', () => {
    const text = formatAnnotationsPrompt([
      annotation({ preset: 'Mobile', page: { ...page, viewport: { width: 390, height: 844 } } }),
    ]);
    expect(text).toContain('**Viewport:** 390×844 (Mobile)');
  });

  it('leaves out what the picker did not find', () => {
    const text = formatAnnotationsPrompt([
      annotation({
        screenshotPath: null,
        element: element({ react: null, styles: {}, text: '', html: '' }),
      }),
    ]);
    expect(text).not.toContain('**Screenshot:**');
    expect(text).not.toContain('**Components:**');
    expect(text).not.toContain('**Source:**');
    expect(text).not.toContain('**Styles:**');
    expect(text).not.toContain('**Text:**');
    expect(text).not.toContain('```html');
  });

  it('quotes a screenshot path with spaces', () => {
    const text = formatAnnotationsPrompt([
      annotation({ screenshotPath: '/Users/Jo Doe/pasted-images/el 1.png' }),
    ]);
    expect(text).toContain('**Screenshot:** "/Users/Jo Doe/pasted-images/el 1.png"');
  });

  it('makes the html fence longer than any backtick run inside it', () => {
    const text = formatAnnotationsPrompt([
      annotation({ element: element({ html: '<code>```js</code>' }) }),
    ]);
    expect(text).toContain('````html\n<code>```js</code>\n````');
  });

  it('keeps multi-line comments readable', () => {
    const text = formatAnnotationsPrompt([annotation({ comment: 'Line one\nLine two' })]);
    expect(text).toContain('**Comment:** Line one\n  Line two');
  });

  it('shows the sanitized url', () => {
    const text = formatAnnotationsPrompt([
      annotation({ page: { ...page, url: 'http://localhost:5173/pricing?token=abc#top' } }),
    ]);
    expect(text).toContain('**URL:** http://localhost:5173/pricing?token=redacted');
  });
});

describe('formatElementContext', () => {
  it('describes a single element without a comment, for the clipboard', () => {
    const text = formatElementContext({ page, element: element() });
    expect(text).toContain('Element on http://localhost:5173/pricing');
    expect(text).toContain('**Selector:** `section.plans > button.buy`');
    expect(text).not.toContain('**Comment:**');
    expect(text).not.toContain('**Intent:**');
  });
});
