import { describe, expect, it } from 'vitest';
import { coreErrorCode, encodeCoreError } from '../../shared/coreErrors';
import { ADMIN_ROLES, callCore, explainRefusal, OPERATOR_ROLES } from './coreCalls';

/**
 * The core refuses a missing role and a missing step-up with the same words; the app asks for
 * a password only when the signed-in role could get past with one.
 */

const UNAUTHORIZED = new Error(
  "Failed to invoke 'RevealContainerEnv' because user is unauthorized",
);

describe('explainRefusal', () => {
  it('asks for a step-up from a role that can use one', () => {
    expect(coreErrorCode(explainRefusal(['admin'], UNAUTHORIZED, ADMIN_ROLES))).toBe(
      'stepUpRequired',
    );
    expect(coreErrorCode(explainRefusal(['operator'], UNAUTHORIZED, OPERATOR_ROLES))).toBe(
      'stepUpRequired',
    );
    // Not knowing the roles yet, it is worth a try.
    expect(coreErrorCode(explainRefusal(null, UNAUTHORIZED, ADMIN_ROLES))).toBe('stepUpRequired');
  });

  it('says the role cannot, when a step-up would not help or none is involved', () => {
    const operator = explainRefusal(['operator'], UNAUTHORIZED, ADMIN_ROLES);
    expect(coreErrorCode(operator)).toBe('forbidden');
    expect(operator.message).toContain('(operator)');
    const nobody = explainRefusal([], UNAUTHORIZED);
    expect(coreErrorCode(nobody)).toBe('forbidden');
    expect(nobody.message).not.toContain('(');
  });

  it('keeps what the core said in its own words, and codes the connection already set', () => {
    expect(
      explainRefusal(
        ['owner'],
        new Error("An unexpected error occurred invoking 'X' on the server. HubException: Nope."),
      ).message,
    ).toBe('Nope.');
    expect(explainRefusal(['owner'], 'plain').message).toBe('plain');
    const coded = new Error(encodeCoreError('sessionExpired', 'Sign in again.'));
    expect(explainRefusal(['owner'], coded)).toBe(coded);
  });
});

describe('callCore', () => {
  it('answers with the call’s result, or the refusal explained', async () => {
    const links = {
      call: async <T>(_serverId: string, work: (hub: never) => Promise<T>) => work({} as never),
    };
    expect(await callCore({ links, roles: () => ['owner'] }, 'srv-1', async () => 42)).toBe(42);
    const refused = await callCore({ links, roles: () => ['viewer'] }, 'srv-1', async () => {
      throw UNAUTHORIZED;
    }).catch((error: unknown) => error);
    expect(coreErrorCode(refused)).toBe('forbidden');
  });
});
