import { describe, expect, it } from 'vitest';
import { parseWorkflowDispatch } from './workflowDispatch';

/**
 * This reader decides whether a workflow gets a "Run" button and which fields the dialog asks
 * for, so a wrong answer is visible to the user straight away: a missing button on a workflow
 * that can be started by hand, or a dispatch that GitHub rejects for a missing input.
 */

describe('parseWorkflowDispatch triggers', () => {
  it('is not dispatchable when the file has no "on" block at all', () => {
    expect(
      parseWorkflowDispatch('name: CI\njobs:\n  build:\n    runs-on: ubuntu-latest\n'),
    ).toEqual({ dispatchable: false, inputs: [] });
  });

  it('is not dispatchable for a push-only workflow', () => {
    const source = ['name: CI', 'on: push', 'jobs:', '  build:', '    runs-on: ubuntu-latest'].join(
      '\n',
    );
    expect(parseWorkflowDispatch(source)).toEqual({ dispatchable: false, inputs: [] });
  });

  it('accepts an inline scalar trigger', () => {
    expect(parseWorkflowDispatch('on: workflow_dispatch\n')).toEqual({
      dispatchable: true,
      inputs: [],
    });
  });

  it('accepts a quoted inline scalar trigger', () => {
    expect(parseWorkflowDispatch("on: 'workflow_dispatch'\n")).toEqual({
      dispatchable: true,
      inputs: [],
    });
  });

  it('accepts a flow list of triggers', () => {
    expect(parseWorkflowDispatch('on: [push, workflow_dispatch]\n')).toEqual({
      dispatchable: true,
      inputs: [],
    });
    expect(parseWorkflowDispatch('on: [push, pull_request]\n')).toEqual({
      dispatchable: false,
      inputs: [],
    });
  });

  it('accepts a block list of triggers', () => {
    const source = ['on:', '  - push', '  - workflow_dispatch', 'jobs:', '  build: {}'].join('\n');
    expect(parseWorkflowDispatch(source)).toEqual({ dispatchable: true, inputs: [] });
  });

  it('accepts a mapping trigger with no body', () => {
    const source = ['on:', '  push:', '    branches: [main]', '  workflow_dispatch:'].join('\n');
    expect(parseWorkflowDispatch(source)).toEqual({ dispatchable: true, inputs: [] });
  });

  it('reads a quoted "on" key', () => {
    const source = ['"on":', '  workflow_dispatch:'].join('\n');
    expect(parseWorkflowDispatch(source)).toEqual({ dispatchable: true, inputs: [] });
  });

  it('reads the key as "true", which is what YAML 1.1 turns a bare "on" into', () => {
    // Files round-tripped through a YAML library come back this way, and losing the Run
    // button over that would look like a bug in the app rather than in the file.
    const source = ['true:', '  workflow_dispatch:'].join('\n');
    expect(parseWorkflowDispatch(source)).toEqual({ dispatchable: true, inputs: [] });
  });

  it('is not dispatchable when the mapping has other triggers only', () => {
    const source = ['on:', '  push:', '    branches:', '      - main', '  schedule:'].join('\n');
    expect(parseWorkflowDispatch(source)).toEqual({ dispatchable: false, inputs: [] });
  });

  it('handles CRLF line endings', () => {
    expect(parseWorkflowDispatch('on:\r\n  workflow_dispatch:\r\n')).toEqual({
      dispatchable: true,
      inputs: [],
    });
  });

  it('ignores whole-line and trailing comments', () => {
    const source = [
      '# top of the file',
      'on: # only manual for now',
      '  workflow_dispatch: # no inputs',
    ].join('\n');
    expect(parseWorkflowDispatch(source)).toEqual({ dispatchable: true, inputs: [] });
  });
});

describe('parseWorkflowDispatch inputs', () => {
  const source = [
    'name: Deploy',
    'on:',
    '  workflow_dispatch:',
    '    inputs:',
    '      environment:',
    '        description: Target environment',
    '        required: true',
    '        type: choice',
    '        default: staging',
    '        options:',
    '          - dev',
    '          - staging',
    '          - prod',
    '      version:',
    '        description: |',
    '          Version to deploy.',
    '          Leave blank for the latest build.',
    '        required: false',
    '        type: string',
    '      dry_run:',
    '        description: Skip the real deploy',
    '        type: boolean',
    '        default: false',
    'jobs:',
    '  deploy:',
    '    runs-on: ubuntu-latest',
  ].join('\n');

  it('reads every declared input with its metadata', () => {
    const spec = parseWorkflowDispatch(source);

    expect(spec.dispatchable).toBe(true);
    expect(spec.inputs.map((input) => input.name)).toEqual(['environment', 'version', 'dry_run']);
    expect(spec.inputs[0]).toEqual({
      name: 'environment',
      description: 'Target environment',
      required: true,
      type: 'choice',
      default: 'staging',
      options: ['dev', 'staging', 'prod'],
    });
  });

  it('folds a block scalar description onto one line', () => {
    // The dialog shows the description in a single label, so the newlines have to go.
    expect(parseWorkflowDispatch(source).inputs[1].description).toBe(
      'Version to deploy. Leave blank for the latest build.',
    );
  });

  it('defaults required to false and keeps a boolean default as text', () => {
    const dryRun = parseWorkflowDispatch(source).inputs[2];
    expect(dryRun.required).toBe(false);
    expect(dryRun.type).toBe('boolean');
    expect(dryRun.default).toBe('false');
    expect(dryRun.options).toEqual([]);
  });

  it('reads a flow list of options', () => {
    const flow = [
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      env:',
      '        type: choice',
      '        options: [dev, "staging", prod]',
    ].join('\n');

    expect(parseWorkflowDispatch(flow).inputs[0].options).toEqual(['dev', 'staging', 'prod']);
  });

  it('falls back to the string type for anything GitHub does not define', () => {
    const odd = [
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      weird:',
      '        type: yaml',
    ].join('\n');

    expect(parseWorkflowDispatch(odd).inputs[0].type).toBe('string');
  });

  it.each([
    ['number', 'number'],
    ['environment', 'environment'],
    ['BOOLEAN', 'boolean'],
  ])('accepts the %s type', (declared, expected) => {
    const yaml = [
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      value:',
      `        type: ${declared}`,
    ].join('\n');

    expect(parseWorkflowDispatch(yaml).inputs[0].type).toBe(expected);
  });

  it('keeps a colon inside a value out of the key split', () => {
    const yaml = [
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      note:',
      '        description: Deploy: production only',
    ].join('\n');

    expect(parseWorkflowDispatch(yaml).inputs[0].description).toBe('Deploy: production only');
  });

  it('keeps a "#" that is part of a value rather than a comment', () => {
    const yaml = [
      'on:',
      '  workflow_dispatch:',
      '    inputs:',
      '      tag:',
      '        default: build#42',
      '      title:',
      '        default: "release # 7"',
    ].join('\n');

    const inputs = parseWorkflowDispatch(yaml).inputs;
    expect(inputs[0].default).toBe('build#42');
    expect(inputs[1].default).toBe('release # 7');
  });

  it('returns no inputs when the trigger declares none', () => {
    const yaml = ['on:', '  workflow_dispatch:', '    branches: [main]'].join('\n');
    expect(parseWorkflowDispatch(yaml)).toEqual({ dispatchable: true, inputs: [] });
  });

  it('does not pick up inputs belonging to another trigger', () => {
    // workflow_call has its own inputs block; asking the user for those would be wrong.
    const yaml = [
      'on:',
      '  workflow_call:',
      '    inputs:',
      '      caller_only:',
      '        type: string',
      '  workflow_dispatch:',
      '    inputs:',
      '      manual_only:',
      '        type: string',
    ].join('\n');

    expect(parseWorkflowDispatch(yaml).inputs.map((input) => input.name)).toEqual(['manual_only']);
  });

  it('ignores an empty source', () => {
    expect(parseWorkflowDispatch('')).toEqual({ dispatchable: false, inputs: [] });
  });
});
