// @vitest-environment jsdom
import type { AppSettings } from '@agentmat/core';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';

/**
 * The pet's own settings card. These tests stay on the 3D switch: it is the one control that
 * changes how the rope and the parachute are drawn, and an upload of a 3D pet is the reason
 * someone reaches for it.
 */

const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
  }),
);
vi.mock('sonner', () => ({ toast, Toaster: () => null }));

const { CompanionSettings } = await import('./CompanionSettings');

/** Only the fields the card reads, since it takes settings as one object. */
function petSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    desktopPetEnabled: true,
    desktopPetCharacterId: 'tide',
    desktopPetCustoms: [],
    desktopPetName: '',
    desktopPetCanMove: true,
    desktopPetCanClimb: true,
    desktopPetCanParachute: true,
    desktopPetGear3d: false,
    desktopPetScale: 100,
    desktopPetClickArea: 100,
    desktopPetActionSpeeds: { walk: 100, climb: 100, descend: 100, parachute: 100 },
    ...overrides,
  } as AppSettings;
}

const GEAR_3D = /3D rope and parachute/i;

/** The card's own queries, so they resolve to something instead of undefined. */
const petQueries = { 'pet.customDataUrls': {}, 'pet.getSnooze': { until: null } };

describe('CompanionSettings, 3D gear', () => {
  it('turns the 3D rope and parachute on', async () => {
    const { bridge, user } = renderWithProviders(<CompanionSettings settings={petSettings()} />, {
      bridge: petQueries,
    });

    const toggle = await screen.findByRole('switch', { name: GEAR_3D });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle);

    await waitFor(() =>
      expect(bridge.$fn('settings.update')).toHaveBeenCalledWith({ desktopPetGear3d: true }),
    );
  });

  it('turns it back off, so the flat pixel gear is one click away', async () => {
    const { bridge, user } = renderWithProviders(
      <CompanionSettings settings={petSettings({ desktopPetGear3d: true })} />,
      { bridge: petQueries },
    );

    const toggle = await screen.findByRole('switch', { name: GEAR_3D });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    await user.click(toggle);

    await waitFor(() =>
      expect(bridge.$fn('settings.update')).toHaveBeenCalledWith({ desktopPetGear3d: false }),
    );
  });

  it('greys it out when the pet never climbs, since neither the rope nor the chute appears', async () => {
    renderWithProviders(
      <CompanionSettings settings={petSettings({ desktopPetCanClimb: false })} />,
      { bridge: petQueries },
    );

    expect(await screen.findByRole('switch', { name: GEAR_3D })).toBeDisabled();
  });

  it('says the switch is for an uploaded 3D pet', async () => {
    renderWithProviders(<CompanionSettings settings={petSettings()} />, { bridge: petQueries });

    expect(await screen.findByText(/uploaded as a 3D render/i)).toBeInTheDocument();
  });
});
