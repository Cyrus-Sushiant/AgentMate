import type { SystemImage } from '@agentmat/core';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { CreateAvdDialog } from './CreateAvdDialog';

/**
 * The create dialog has to catch what avdmanager would reject before it spawns anything, and it
 * has to be honest when there is nothing to create a device from.
 */

const IMAGES: SystemImage[] = [
  {
    id: 'system-images;android-34;google_apis;x86_64',
    api: 34,
    tag: 'google_apis',
    abi: 'x86_64',
    playStore: false,
    version: '12',
    description: '',
  },
];

const TOOLS = { adb: true, emulator: true, avdmanager: true, sdkmanager: true };

function setup(
  overrides: Record<string, unknown> = {},
  existingNames: string[] = [],
  tools = TOOLS,
) {
  const onCreated = vi.fn();
  const view = renderWithProviders(
    <CreateAvdDialog
      open
      onOpenChange={vi.fn()}
      existingNames={existingNames}
      onCreated={onCreated}
      tools={tools}
    />,
    {
      bridge: {
        'android.listSystemImages': IMAGES,
        'android.listDeviceProfiles': ['pixel_7', 'pixel_tablet'],
        'android.createAvd': { ok: true },
        ...overrides,
      },
    },
  );
  return { ...view, onCreated };
}

describe('CreateAvdDialog', () => {
  it('cannot be submitted with no name', async () => {
    setup();

    await screen.findByLabelText('Name');
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('shows the id a name with spaces will really be saved under', async () => {
    const { user } = setup();

    await user.type(await screen.findByLabelText('Name'), 'Pixel 7 test');

    // avdmanager rejects spaces and Studio does not, so the rename is shown rather than sprung.
    expect(screen.getByText('Pixel_7_test')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
  });

  it('refuses a duplicate without asking the main process', async () => {
    const { user, bridge } = setup({}, ['Pixel_7_test']);

    await user.type(await screen.findByLabelText('Name'), 'Pixel 7 test');

    expect(screen.getByText(/already a virtual device called Pixel_7_test/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(() => bridge.$fn('android.createAvd')).toThrow();
  });

  it('creates with the id, the chosen image and the chosen profile', async () => {
    const { user, bridge } = setup();

    await user.type(await screen.findByLabelText('Name'), 'My Pixel');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(bridge.$fn('android.createAvd')).toHaveBeenCalledWith({
        name: 'My_Pixel',
        systemImageId: 'system-images;android-34;google_apis;x86_64',
        device: 'pixel_7',
      }),
    );
  });

  it('says how to install an image instead of offering an empty dropdown', async () => {
    setup({ 'android.listSystemImages': [] });

    expect(await screen.findByText('No system images are installed.')).toBeInTheDocument();
    expect(screen.getByText(/sdkmanager "system-images/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });
});

describe('when the SDK has no command-line tools', () => {
  const noAvdmanager = { adb: true, emulator: true, avdmanager: false, sdkmanager: false };

  it('explains what to install instead of leaving a dead Create button', async () => {
    setup({}, [], noAvdmanager);

    // Creating an AVD needs avdmanager, and an SDK installed by Android Studio does not ship it
    // by default. Saying so is the whole point: a disabled button teaches nobody anything.
    // The tool it needs, and where that tool comes from.
    expect(await screen.findByText('avdmanager')).toBeInTheDocument();
    expect(screen.getByText(/SDK Tools tab/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /how to install/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();
  });

  it('does not ask for a name it cannot use', async () => {
    setup({}, [], noAvdmanager);

    await screen.findByRole('button', { name: /how to install/i });
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
  });
});
