import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  type AccountDraft,
  AccountFields,
  type AccountMode,
  accountProblem,
  EMPTY_ACCOUNT,
  toAccount,
} from './AccountFields';

/**
 * The account this computer signs in to a core with. The rules mirror the core's own, so an
 * install never sends something the server would refuse for an obvious reason, and each refusal
 * says which rule it is.
 */

const PASSWORD = 'correct horse battery staple';
const GOOD: AccountDraft = { userName: 'maria', password: PASSWORD, confirm: PASSWORD };
const USER_NAME_RULE = 'Choose a user name of letters, digits, dots, dashes, underscores or @.';

describe('accountProblem', () => {
  it('accepts a sound new owner', () => {
    expect(accountProblem(GOOD, 'create')).toBeNull();
    expect(accountProblem({ ...GOOD, userName: 'maria.lopez@ops_team-1' }, 'create')).toBeNull();
  });

  it.each([
    ['an empty user name', { ...GOOD, userName: '' }, USER_NAME_RULE],
    ['a user name with a space', { ...GOOD, userName: 'maria lopez' }, USER_NAME_RULE],
    [
      'a user name longer than 64 characters',
      { ...GOOD, userName: 'a'.repeat(65) },
      USER_NAME_RULE,
    ],
    [
      'a password under 12 characters',
      { ...GOOD, password: 'eleven-char', confirm: 'eleven-char' },
      'The password needs at least 12 characters.',
    ],
    [
      'a password with a line break',
      { ...GOOD, password: `${PASSWORD}\n`, confirm: `${PASSWORD}\n` },
      'The password cannot contain a line break.',
    ],
    ['passwords that differ', { ...GOOD, confirm: `${PASSWORD}s` }, 'The two passwords differ.'],
    [
      'a password that holds the user name',
      { userName: 'maria', password: 'MARIA owns this box', confirm: 'MARIA owns this box' },
      'The password cannot contain the user name.',
    ],
  ])('refuses %s', (_case, draft, message) => {
    expect(accountProblem(draft, 'create')).toBe(message);
  });

  it('leaves the new-owner rules out when signing in as an account the core has', () => {
    const existing = { userName: 'maria', password: 'maria owns this box', confirm: '' };

    expect(accountProblem(existing, 'existing')).toBeNull();
    expect(accountProblem({ ...existing, password: 'short' }, 'existing')).toBe(
      'The password needs at least 12 characters.',
    );
  });

  it('sends the user name and password, never the confirmation', () => {
    expect(toAccount(GOOD)).toEqual({ userName: 'maria', password: PASSWORD });
  });
});

function Harness({ mode, optional }: { mode: AccountMode; optional?: boolean }): React.JSX.Element {
  const [draft, setDraft] = useState(EMPTY_ACCOUNT);
  return (
    <AccountFields
      mode={mode}
      optional={optional}
      draft={draft}
      onChange={setDraft}
      idPrefix="test"
    />
  );
}

describe('AccountFields', () => {
  it('asks a new owner for the password twice and marks each rule once it is met', async () => {
    const user = userEvent.setup();
    render(<Harness mode="create" />);
    const rules = screen.getByRole('list', { name: 'Password rules' });
    expect(within(rules).getByText(/12 characters or more/).textContent).toContain('not yet');

    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.type(screen.getByLabelText('Confirm the password'), PASSWORD);

    expect(within(rules).getByText(/12 characters or more/).textContent).toContain('done');
    expect(within(rules).getByText(/Both match/).textContent).toContain('done');
  });

  it('drops spaces around the user name', async () => {
    const user = userEvent.setup();
    render(<Harness mode="create" />);

    await user.type(screen.getByLabelText('User name'), ' maria ');

    expect((screen.getByLabelText('User name') as HTMLInputElement).value).toBe('maria');
  });

  it('asks an existing account for no confirmation and says it can wait', () => {
    render(<Harness mode="existing" optional />);

    expect(screen.getByText('Your account on this core')).toBeTruthy();
    expect(screen.getByText(/leave it empty and do it later/)).toBeTruthy();
    expect(screen.queryByLabelText('Confirm the password')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Password rules' })).toBeNull();
  });

  it('says nothing about later where the account is what the step is for', () => {
    render(<Harness mode="existing" />);

    expect(screen.getByText('Your account on this core')).toBeTruthy();
    expect(screen.queryByText(/do it later/)).toBeNull();
  });
});
