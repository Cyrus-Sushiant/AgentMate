import { describe, expect, it, vi } from 'vitest';
import { planFor } from './plan';
import type { DeployServerRegistries } from './serverCredentials';
import type { DeployRegistries } from './service';

const STACK = '0f8fad5b-d9cb-469f-a165-70867728950e';

function setup(listed: () => Promise<Array<{ registry: string }>>) {
  const registries = { plan: vi.fn(async () => ({ sendSignIns: true, entries: [] })) };
  const servers = { list: vi.fn(listed) };
  const stacks = { registriesOf: vi.fn(async () => ['ghcr.io']) };
  return {
    run: (request: Parameters<typeof planFor>[0]) =>
      planFor(
        request,
        registries as unknown as DeployRegistries,
        servers as unknown as DeployServerRegistries,
        stacks,
      ),
    registries,
    stacks,
  };
}

describe('planFor', () => {
  it('works from a preview’s images, with what the server stores', async () => {
    const { run, registries, stacks } = setup(async () => [{ registry: 'docker.io' }]);

    await run({
      serverId: 'srv',
      stackId: null,
      revision: null,
      images: ['ghcr.io/a/b:1', 'nginx', 'ghcr.io/a/c'],
    });

    expect(stacks.registriesOf).not.toHaveBeenCalled();
    expect(registries.plan).toHaveBeenCalledWith(
      'srv',
      null,
      ['ghcr.io', 'docker.io'],
      ['docker.io'],
    );
  });

  it("reads a revision's compose file, and a Viewer's refused list just counts as none", async () => {
    const { run, registries, stacks } = setup(async () => {
      throw new Error('unauthorized');
    });

    await run({ serverId: 'srv', stackId: STACK, revision: 3, images: null });

    expect(stacks.registriesOf).toHaveBeenCalledWith('srv', STACK, 3);
    expect(registries.plan).toHaveBeenCalledWith('srv', STACK, ['ghcr.io'], []);
  });
});
