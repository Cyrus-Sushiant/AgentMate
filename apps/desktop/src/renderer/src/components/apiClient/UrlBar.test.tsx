import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../test/renderer/renderWithProviders';
import { UrlBar } from './UrlBar';

function setup(overrides: Partial<React.ComponentProps<typeof UrlBar>> = {}) {
  const props = {
    method: 'GET',
    url: '',
    sending: false,
    onMethodChange: vi.fn(),
    onUrlChange: vi.fn(),
    onSend: vi.fn(),
    onCancel: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  return { ...renderWithProviders(<UrlBar {...props} />), props };
}

describe('UrlBar', () => {
  it('reports what is typed in the URL field', async () => {
    const { user, props } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Request URL' }), 'h');
    expect(props.onUrlChange).toHaveBeenCalledWith('h');
  });

  it('sends on Enter and on the Send button, but not with an empty URL', async () => {
    const empty = setup();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
    empty.unmount();

    const { user, props } = setup({ url: 'https://a.test' });
    await user.type(screen.getByRole('textbox', { name: 'Request URL' }), '{enter}');
    await user.click(screen.getByRole('button', { name: /send/i }));
    expect(props.onSend).toHaveBeenCalledTimes(2);
  });

  it('turns Send into Cancel while a request is running', async () => {
    const { user, props } = setup({ url: 'https://a.test', sending: true });
    expect(screen.queryByRole('button', { name: /^send/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(props.onCancel).toHaveBeenCalled();
  });

  it('picks a method from the menu', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('button', { name: 'Method GET' }));
    await user.click(await screen.findByRole('menuitem', { name: 'DELETE' }));
    expect(props.onMethodChange).toHaveBeenCalledWith('DELETE');
  });

  it('saves from the Save button', async () => {
    const { user, props } = setup({ url: 'https://a.test' });
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(props.onSave).toHaveBeenCalled();
  });
});
