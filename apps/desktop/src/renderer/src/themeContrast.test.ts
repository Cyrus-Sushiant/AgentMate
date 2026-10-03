import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The theme tokens in index.css against WCAG AA (4.5:1 for small text). Status words such as
 * "Needs fixing", "Done" or "Online" are small text in the status colours, on the cards and on
 * the page, and primary and destructive buttons carry their foreground on top of them.
 */

const css = readFileSync(resolve(__dirname, 'index.css'), 'utf-8').replace(/\r\n/g, '\n');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in index.css`);
  const body = css.slice(start, css.indexOf('}', start));
  const tokens: Record<string, string> = {};
  for (const match of body.matchAll(/--([a-z-]+):\s*([^;]+);/g)) tokens[match[1]] = match[2].trim();
  return tokens;
}

function rgb(token: string): [number, number, number] {
  const [h, s, l] = token.split(/\s+/).map((part) => Number.parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}

function luminance([r, g, b]: [number, number, number]): number {
  const linear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const THEMES = {
  light: block(':root'),
  dark: { ...block(':root'), ...block('.dark') },
};

describe.each(Object.entries(THEMES))('the %s theme', (_name, tokens) => {
  for (const status of ['primary', 'success', 'warning', 'destructive']) {
    it(`keeps ${status} text readable on the page and on cards`, () => {
      expect(contrast(tokens[status], tokens.background)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens[status], tokens.card)).toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const filled of ['primary', 'destructive']) {
    it(`keeps text on a ${filled} button readable`, () => {
      expect(contrast(tokens[`${filled}-foreground`], tokens[filled])).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('keeps muted text readable on cards', () => {
    expect(contrast(tokens['muted-foreground'], tokens.card)).toBeGreaterThanOrEqual(4.5);
  });
});
