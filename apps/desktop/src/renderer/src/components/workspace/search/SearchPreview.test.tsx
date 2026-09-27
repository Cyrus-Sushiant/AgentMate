import { fireEvent, screen, waitFor } from '@testing-library/react';
import * as monaco from 'monaco-editor';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceSearchStore } from '@/stores/workspaceSearchStore';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { SearchPreview } from './SearchPreview';

vi.mock('@/components/editor/monacoSetup', () => ({ resolveMonacoThemeKey: () => 'dark' }));

type Recorded = { calls: { method: string; args: unknown[] }[] };

function lastEditor(): Recorded | undefined {
  return (monaco as unknown as { createdEditors: Recorded[] }).createdEditors.at(-1);
}

const TARGET = {
  path: 'E:\\work\\app\\src\\index.ts',
  relative: 'src/index.ts',
  line: 2,
  column: 5,
  length: 6,
};

const IMAGE = { path: 'E:\\work\\app\\assets\\logo.png', relative: 'assets/logo.png' };

describe('SearchPreview', () => {
  it('shows where the result is before the file has loaded', () => {
    renderWithProviders(<SearchPreview target={TARGET} />, {
      bridge: { 'fs.readFile': () => new Promise(() => undefined) },
    });
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    expect(screen.getByText('Ln 2, Ch 5')).toBeInTheDocument();
  });

  it('reads the file and picks out the matched line and text', async () => {
    const { bridge } = renderWithProviders(<SearchPreview target={TARGET} />, {
      bridge: { 'fs.readFile': () => 'first\nlet needle = 1;\n' },
    });
    await waitFor(() => expect(bridge.$fn('fs.readFile')).toHaveBeenCalledWith(TARGET.path));
    await waitFor(() => {
      const decorated = lastEditor()?.calls.find((call) => call.method === 'decorations.set');
      if (!decorated) throw new Error('the match was not highlighted');
      const [decorations] = decorated.args as [{ range: unknown; options: object }[]];
      expect(decorations[0].options).toMatchObject({ isWholeLine: true });
      expect(decorations[1].range).toMatchObject({
        startLineNumber: 2,
        startColumn: 5,
        endColumn: 11,
      });
    });
  });

  it('shows a picture as a picture, with its file size', async () => {
    const { bridge } = renderWithProviders(<SearchPreview target={IMAGE} />, {
      bridge: { 'fs.readImage': () => ({ dataUrl: 'data:image/png;base64,AAA', bytes: 2048 }) },
    });
    const picture = await screen.findByAltText('logo.png');
    expect(picture).toHaveAttribute('src', 'data:image/png;base64,AAA');
    expect(await screen.findByText('2.00 KB')).toBeInTheDocument();
    expect(bridge.$fn('fs.readImage')).toHaveBeenCalledWith(IMAGE.path);
    expect(() => bridge.$fn('fs.readFile')).toThrow();
  });

  it('says why a picture could not be shown', async () => {
    renderWithProviders(<SearchPreview target={IMAGE} />, {
      bridge: {
        'fs.readImage': () => Promise.reject(new Error('This image is too large to show here.')),
      },
    });
    expect(await screen.findByText('This image is too large to show here.')).toBeInTheDocument();
  });

  it('shows the source of an SVG when a text match led there', async () => {
    const { bridge } = renderWithProviders(
      <SearchPreview
        target={{ path: 'E:\\work\\app\\icon.svg', relative: 'icon.svg', line: 1, column: 6 }}
      />,
      { bridge: { 'fs.readFile': () => '<svg fill="red" />' } },
    );
    await waitFor(() => expect(bridge.$fn('fs.readFile')).toHaveBeenCalled());
    expect(() => bridge.$fn('fs.readImage')).toThrow();
  });

  it('leaves pictures out when their preview is turned off, and remembers that', async () => {
    const { bridge } = renderWithProviders(<SearchPreview target={IMAGE} />, {
      bridge: { 'fs.readImage': () => ({ dataUrl: 'data:image/png;base64,AAA', bytes: 2048 }) },
    });
    await screen.findByAltText('logo.png');
    fireEvent.click(screen.getByRole('button', { name: 'Hide picture previews' }));
    expect(screen.queryByAltText('logo.png')).not.toBeInTheDocument();
    expect(screen.getByText(/picture previews are off/i)).toBeInTheDocument();
    expect(useWorkspaceSearchStore.getState().preview.images).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Show picture previews' }));
    expect(await screen.findByAltText('logo.png')).toBeInTheDocument();
    expect(bridge.$fn('fs.readImage')).toHaveBeenCalledTimes(1);
  });

  it('does not read a picture at all while previews of them are off', () => {
    useWorkspaceSearchStore.getState().setPreview({ images: false });
    const { bridge } = renderWithProviders(<SearchPreview target={IMAGE} />);
    expect(screen.getByText(/picture previews are off/i)).toBeInTheDocument();
    expect(() => bridge.$fn('fs.readImage')).toThrow();
  });

  it('says so for a binary file instead of showing its bytes', async () => {
    renderWithProviders(<SearchPreview target={TARGET} />, {
      bridge: { 'fs.readFile': () => 'PK\u0003\u0004\u0000\u0000' },
    });
    expect(await screen.findByText(/binary file/i)).toBeInTheDocument();
  });
});
