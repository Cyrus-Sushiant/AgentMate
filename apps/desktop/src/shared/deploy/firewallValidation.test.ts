import { describe, expect, it } from 'vitest';
import { checkComment, type RuleDraft, ruleFromDraft } from './firewallValidation';

/** The rule form's checks: what a person types becomes the exact rule the core takes. */

const draft = (fields: Partial<RuleDraft> = {}): RuleDraft => ({
  action: 'allow',
  protocol: 'tcp',
  ports: '',
  source: '',
  comment: '',
  ...fields,
});

describe('ruleFromDraft', () => {
  it('turns a port, a range, a source and a comment into a rule', () => {
    expect(ruleFromDraft(draft({ ports: '8080' }))).toEqual({
      ok: true,
      value: { action: 'allow', protocol: 'tcp', port: 8080 },
    });
    expect(
      ruleFromDraft(draft({ ports: ' 6000-6007 ', source: '10.0.0.0/8', comment: ' x11 ' })),
    ).toEqual({
      ok: true,
      value: {
        action: 'allow',
        protocol: 'tcp',
        port: 6000,
        portTo: 6007,
        source: '10.0.0.0/8',
        comment: 'x11',
      },
    });
  });

  it('keeps a single host as a bare address, in its short form', () => {
    expect(
      ruleFromDraft(draft({ action: 'deny', protocol: 'any', source: '203.0.113.7' })),
    ).toEqual({ ok: true, value: { action: 'deny', protocol: 'any', source: '203.0.113.7' } });
    const v6 = ruleFromDraft(draft({ ports: '22', source: '2001:0db8:0:0:0:0:0:1' }));
    expect(v6.ok && v6.value.source).toBe('2001:db8::1');
    const host = ruleFromDraft(draft({ ports: '22', source: '198.51.100.4/32' }));
    expect(host.ok && host.value.source).toBe('198.51.100.4');
  });

  it.each([
    [draft(), /Give a port or a source/],
    [draft({ protocol: 'any', ports: '80' }), /Pick TCP or UDP/],
    [draft({ ports: '0' }), /Ports go from 1 to 65535/],
    [draft({ ports: '90-80' }), /can't be higher/],
    [draft({ ports: '80', source: '10.0.0.1/8' }), /The network is 10\.0\.0\.0\/8/],
    [draft({ ports: '80', source: 'office' }), /./],
    [draft({ ports: '80', comment: 'say "hi"' }), /Leave quotes/],
  ])('refuses %j', (input, reason) => {
    const result = ruleFromDraft(input);
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.reason).toMatch(reason);
  });
});

describe('checkComment', () => {
  it('takes no comment, a short one, and refuses a long one or a line break', () => {
    expect(checkComment('  ')).toEqual({ ok: true, value: undefined });
    expect(checkComment('web')).toEqual({ ok: true, value: 'web' });
    expect(checkComment('x'.repeat(65)).ok).toBe(false);
    expect(checkComment('a\nb').ok).toBe(false);
    expect(checkComment('back\\slash').ok).toBe(false);
  });
});
