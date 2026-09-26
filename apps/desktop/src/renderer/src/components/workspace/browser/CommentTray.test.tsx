// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserAnnotation } from '@/lib/browser/types';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { CommentTray, type SendTargets } from './CommentTray';

function annotation(
  id: string,
  comment: string,
  url = 'http://localhost:5173/',
): BrowserAnnotation {
  return {
    id,
    tabId: 'b1',
    page: { url, title: 'Home', viewport: { width: 1280, height: 800 }, dpr: 1 },
    element: {
      tagName: 'button',
      selector: 'button.buy',
      path: 'main > button.buy',
      role: 'button',
      name: `Buy ${id}`,
      text: '',
      html: '',
      attributes: {},
      styles: {},
      react: null,
      rectViewport: { x: 0, y: 0, width: 1, height: 1 },
      rectPage: { x: 0, y: 0, width: 1, height: 1 },
      fixed: false,
    },
    comment,
    intent: 'change',
    preset: null,
    screenshotPath: null,
    thumbDataUrl: null,
    createdAt: 1,
  };
}

const targets: SendTargets = {
  defaultLabel: 'Claude Code CLI',
  running: [
    { tabId: 't1', cliId: 'claude-code', label: 'Fix checkout' },
    { tabId: 't2', cliId: 'codex-cli', label: 'Codex CLI' },
  ],
  newTabs: [
    { cliId: 'claude-code', name: 'Claude Code CLI' },
    { cliId: 'codex-cli', name: 'Codex CLI' },
  ],
};

function setup(annotations: BrowserAnnotation[], url = 'http://localhost:5173/') {
  const props = {
    annotations,
    currentUrl: url,
    targets,
    onSend: vi.fn(),
    onCopy: vi.fn(),
    onClear: vi.fn(),
    onEdit: vi.fn(),
    onRemove: vi.fn(),
    onHover: vi.fn(),
    onReveal: vi.fn(),
  };
  return { ...renderWithProviders(<CommentTray {...props} />), props };
}

describe('CommentTray', () => {
  it('shows nothing without comments', () => {
    const { container } = setup([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the comments, numbered as their pins are', () => {
    setup([annotation('a', 'Bigger'), annotation('b', 'Greener')]);
    const list = screen.getByRole('list', { name: 'Comments' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getByText('1')).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText('Bigger')).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('button "Buy b"')).toBeInTheDocument();
    expect(screen.getByText('2 comments')).toBeInTheDocument();
  });

  it('marks comments left on another page, and goes there on click', async () => {
    const { user, props } = setup([
      annotation('a', 'Bigger'),
      annotation('b', 'Elsewhere', 'http://localhost:5173/pricing'),
    ]);
    expect(screen.getByText('on /pricing')).toBeInTheDocument();
    await user.click(screen.getByText('Elsewhere'));
    expect(props.onReveal).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }));
  });

  it('flashes the pin of the row under the pointer', async () => {
    const { user, props } = setup([annotation('a', 'Bigger')]);
    await user.hover(screen.getByText('Bigger'));
    expect(props.onHover).toHaveBeenLastCalledWith('a');
  });

  it('edits a comment in place', async () => {
    const { user, props } = setup([annotation('a', 'Bigger')]);
    await user.click(screen.getByRole('button', { name: 'Edit comment 1' }));
    const box = screen.getByRole('textbox', { name: 'Edit comment 1' });
    await user.clear(box);
    await user.type(box, 'Much bigger{Enter}');
    expect(props.onEdit).toHaveBeenCalledWith('a', 'Much bigger');
  });

  it('deletes a comment', async () => {
    const { user, props } = setup([annotation('a', 'Bigger')]);
    await user.click(screen.getByRole('button', { name: 'Delete comment 1' }));
    expect(props.onRemove).toHaveBeenCalledWith('a');
  });

  it('sends to the usual agent, or to one picked from the menu', async () => {
    const { user, props } = setup([annotation('a', 'Bigger')]);
    await user.click(screen.getByRole('button', { name: 'Send to Claude Code CLI' }));
    expect(props.onSend).toHaveBeenLastCalledWith(undefined);
    await user.click(screen.getByRole('button', { name: 'Choose where to send' }));
    await user.click(await screen.findByRole('menuitem', { name: /Codex CLI.*running/i }));
    expect(props.onSend).toHaveBeenLastCalledWith({ tabId: 't2' });
    await user.click(screen.getByRole('button', { name: 'Choose where to send' }));
    await user.click(await screen.findByRole('menuitem', { name: 'New Codex CLI tab' }));
    expect(props.onSend).toHaveBeenLastCalledWith({ newCliId: 'codex-cli' });
  });

  it('copies and clears', async () => {
    const { user, props } = setup([annotation('a', 'Bigger')]);
    await user.click(screen.getByRole('button', { name: 'Copy comments' }));
    await user.click(screen.getByRole('button', { name: 'Clear comments' }));
    expect(props.onCopy).toHaveBeenCalled();
    expect(props.onClear).toHaveBeenCalled();
  });

  it('folds away to a pill and back', async () => {
    const { user } = setup([annotation('a', 'Bigger')]);
    await user.click(screen.getByRole('button', { name: 'Hide comments' }));
    expect(screen.queryByRole('list', { name: 'Comments' })).toBeNull();
    await user.click(screen.getByRole('button', { name: /1 comment/ }));
    expect(screen.getByRole('list', { name: 'Comments' })).toBeInTheDocument();
  });
});
