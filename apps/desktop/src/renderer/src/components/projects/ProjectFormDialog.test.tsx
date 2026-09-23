import type { Project } from '@agentmat/core';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { ProjectFormDialog } from './ProjectFormDialog';

function project(): Project {
  return {
    id: 'p1',
    name: 'Apollo',
    folderPath: '/work/apollo',
    description: '',
    tags: [],
    agentType: 'claude-code',
    notes: '',
    runCommands: [
      { id: 'dev', label: 'Dev', command: 'pnpm dev' },
      { id: 'prod', label: 'Prod', command: 'pnpm start' },
    ],
    cliId: null,
    iconDataUrl: null,
    iconBgColor: null,
    iconColor: null,
    websiteUrl: '',
    repoUrl: '',
  } as unknown as Project;
}

function renderDialog(focusRunCommands?: boolean) {
  return renderWithProviders(
    <ProjectFormDialog
      open
      onOpenChange={vi.fn()}
      initial={project()}
      onSubmit={vi.fn()}
      focusRunCommands={focusRunCommands}
    />,
    { bridge: { 'settings.get': {} } },
  );
}

describe('ProjectFormDialog focusRunCommands', () => {
  it('opens on Basics by default', async () => {
    renderDialog();
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('tab', { name: /Basics/, selected: true })).toBeTruthy();
    expect(within(dialog).queryByLabelText('Command 1')).toBeNull();
  });

  it('opens on the Agent tab with the run commands filled in and the first field focused', async () => {
    renderDialog(true);
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByRole('tab', { name: /Agent/, selected: true })).toBeTruthy();
    expect((within(dialog).getByLabelText('Command 1') as HTMLInputElement).value).toBe('pnpm dev');
    expect((within(dialog).getByLabelText('Command 2') as HTMLInputElement).value).toBe(
      'pnpm start',
    );
    await waitFor(() => expect(within(dialog).getByLabelText('Environment 1')).toHaveFocus());
  });
});
