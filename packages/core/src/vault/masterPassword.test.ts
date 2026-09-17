import { describe, expect, it } from 'vitest';
import { MASTER_PASSWORD_MIN_LENGTH, masterPasswordProblem } from './masterPassword.js';

describe('masterPasswordProblem', () => {
  it('asks for a minimum length first', () => {
    expect(MASTER_PASSWORD_MIN_LENGTH).toBe(10);
    expect(masterPasswordProblem('Ab1!xyz')).toMatch(/at least 10/);
  });

  it('refuses long but guessable passwords', () => {
    expect(masterPasswordProblem('password123')).toMatch(/guess/i);
    expect(masterPasswordProblem('aaaaaaaaaaaaaaa')).toMatch(/guess/i);
  });

  it('accepts a fair or better password', () => {
    expect(masterPasswordProblem('correct horse battery staple')).toBeNull();
    expect(masterPasswordProblem('tR7#pLm2qZ9!')).toBeNull();
  });
});
