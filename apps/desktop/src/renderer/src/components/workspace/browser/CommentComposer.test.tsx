// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../../test/renderer/renderWithProviders';
import { CommentComposer } from './CommentComposer';

function setup(overrides: Partial<React.ComponentProps<typeof CommentComposer>> = {}) {
  const props = {
    label: 'Button button "Buy now"',
    selector: 'section.plans > button.buy',
    thumbDataUrl: null,
    sendLabel: 'Send to Claude Code CLI',
    onAdd: vi.fn(),
    onSend: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const view = renderWithProviders(<CommentComposer {...props} />);
  return { ...view, props };
}

describe('CommentComposer', () => {
  it('names the element and focuses the comment box', () => {
    setup();
    expect(screen.getByText('Button button "Buy now"')).toBeInTheDocument();
    expect(screen.getByText('section.plans > button.buy')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveFocus();
  });

  it('shows a placeholder until the screenshot is ready, then the screenshot', () => {
    const { unmount } = setup();
    expect(screen.getByTestId('comment-thumb-loading')).toBeInTheDocument();
    unmount();
    setup({ thumbDataUrl: 'data:image/png;base64,abc' });
    expect(screen.getByRole('img', { name: 'Screenshot of the element' })).toHaveAttribute(
      'src',
      'data:image/png;base64,abc',
    );
  });

  it('can only be added once something is written', async () => {
    const { user, props } = setup();
    const add = screen.getByRole('button', { name: /Add comment/ });
    expect(add).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Comment' }), '   ');
    expect(add).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Comment' }), 'Make it green');
    await user.click(add);
    expect(props.onAdd).toHaveBeenCalledWith({ comment: 'Make it green', intent: 'change' });
  });

  it('asks a question instead when Ask is picked', async () => {
    const { user, props } = setup();
    await user.click(screen.getByRole('radio', { name: 'Ask' }));
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveAttribute(
      'placeholder',
      'What do you want to know about it?',
    );
    await user.type(screen.getByRole('textbox', { name: 'Comment' }), 'Why grey?');
    await user.click(screen.getByRole('button', { name: /Add comment/ }));
    expect(props.onAdd).toHaveBeenCalledWith({ comment: 'Why grey?', intent: 'question' });
  });

  it('adds with Ctrl+Enter and sends right away with Ctrl+Shift+Enter', async () => {
    const { user, props } = setup();
    const box = screen.getByRole('textbox', { name: 'Comment' });
    await user.type(box, 'Bigger');
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true });
    expect(props.onAdd).toHaveBeenCalledWith({ comment: 'Bigger', intent: 'change' });
    fireEvent.keyDown(box, { key: 'Enter', ctrlKey: true, shiftKey: true });
    expect(props.onSend).toHaveBeenCalledWith({ comment: 'Bigger', intent: 'change' });
  });

  it('keeps a plain Enter for a new line', async () => {
    const { user, props } = setup();
    const box = screen.getByRole('textbox', { name: 'Comment' });
    await user.type(box, 'One{Enter}Two');
    expect(box).toHaveValue('One\nTwo');
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('sends from its button too', async () => {
    const { user, props } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Comment' }), 'Fix spacing');
    await user.click(screen.getByRole('radio', { name: 'Fix' }));
    await user.click(screen.getByRole('button', { name: /Send to Claude Code CLI/ }));
    expect(props.onSend).toHaveBeenCalledWith({ comment: 'Fix spacing', intent: 'fix' });
  });

  it('closes on Esc and on Cancel', async () => {
    const { user, props } = setup();
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Comment' }), { key: 'Escape' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onCancel).toHaveBeenCalledTimes(2);
  });

  it('starts from an existing comment when editing', () => {
    setup({ initial: { comment: 'Old text', intent: 'fix' } });
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveValue('Old text');
    expect(screen.getByRole('radio', { name: 'Fix' })).toBeChecked();
  });
});
