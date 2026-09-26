// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { BrowserError } from './BrowserError';
import { BrowserStartPage } from './BrowserStartPage';

const servers = [
  { url: 'http://localhost:5173/', terminalId: 't1', terminalTitle: 'pnpm dev' },
  { url: 'http://localhost:6006/', terminalId: 't2', terminalTitle: 'storybook' },
];

describe('BrowserStartPage', () => {
  it('opens what is typed in its address field, which has focus', async () => {
    const onOpen = vi.fn();
    const { user } = renderWithProviders(
      <BrowserStartPage servers={[]} recent={[]} onOpen={onOpen} />,
    );
    const input = screen.getByRole('textbox', { name: 'Open a page' });
    expect(input).toHaveFocus();
    await user.type(input, 'localhost:3000{Enter}');
    expect(onOpen).toHaveBeenCalledWith('http://localhost:3000/');
  });

  it('offers the dev servers running in the workspace, with the terminal each came from', async () => {
    const onOpen = vi.fn();
    const { user } = renderWithProviders(
      <BrowserStartPage servers={servers} recent={[]} onOpen={onOpen} />,
    );
    expect(screen.getByText('Running in this workspace')).toBeInTheDocument();
    expect(screen.getByText('storybook')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /localhost:5173/ }));
    expect(onOpen).toHaveBeenCalledWith('http://localhost:5173/');
  });

  it('lists recent addresses not already offered as servers', async () => {
    const onOpen = vi.fn();
    const { user } = renderWithProviders(
      <BrowserStartPage
        servers={servers}
        recent={['http://localhost:5173/', 'https://example.com/docs']}
        onOpen={onOpen}
      />,
    );
    expect(screen.getAllByRole('button', { name: /localhost:5173/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /example.com\/docs/ }));
    expect(onOpen).toHaveBeenCalledWith('https://example.com/docs');
  });

  it('explains what to do when nothing is running yet', () => {
    renderWithProviders(<BrowserStartPage servers={[]} recent={[]} onOpen={vi.fn()} />);
    expect(screen.getByText(/Start your dev server in a terminal/)).toBeInTheDocument();
  });
});

describe('BrowserError', () => {
  it('asks whether the dev server is running when a local page refuses to connect', async () => {
    const onRetry = vi.fn();
    const onOpen = vi.fn();
    const { user } = renderWithProviders(
      <BrowserError
        error={{ code: -102, description: 'ERR_CONNECTION_REFUSED', url: 'http://localhost:5173/' }}
        servers={servers}
        onRetry={onRetry}
        onOpen={onOpen}
      />,
    );
    expect(screen.getByText('Nothing is listening on port 5173')).toBeInTheDocument();
    expect(screen.getByText(/Is the dev server running\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /localhost:6006/ }));
    expect(onOpen).toHaveBeenCalledWith('http://localhost:6006/');
  });

  it('describes other failures plainly', () => {
    renderWithProviders(
      <BrowserError
        error={{ code: -105, description: 'ERR_NAME_NOT_RESOLVED', url: 'https://nope.invalid/' }}
        servers={[]}
        onRetry={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(screen.getByText('This page could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('ERR_NAME_NOT_RESOLVED')).toBeInTheDocument();
  });
});
