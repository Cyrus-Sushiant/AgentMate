import { describe, expect, it } from 'vitest';
import {
  BOWORA_MCP_REPOSITORY_ID,
  bundledMcpDirectory,
  bundledMcpRepository,
} from './bundledDirectory.js';
import { McpRepositoryIndexSchema } from './types.js';

/**
 * This catalog ships with the app and is the default marketplace listing, so it never
 * gets a chance to fail a network fetch: a malformed entry just renders wrong, or
 * installs a server that cannot start. Entries with no machine-readable install
 * instructions are listed on purpose (discovery only), which is why `command` is
 * checked for shape rather than for presence.
 */

describe('bundledMcpDirectory', () => {
  const servers = bundledMcpDirectory.servers;

  it('is a real listing, not an empty stub', () => {
    expect(bundledMcpDirectory.name.trim()).not.toBe('');
    expect(servers.length).toBeGreaterThan(0);
  });

  it('still parses against its own schema', () => {
    expect(() => McpRepositoryIndexSchema.parse(bundledMcpDirectory)).not.toThrow();
  });

  it('has unique ids, since the id is the install key', () => {
    const ids = servers.map((server) => server.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates).toEqual([]);
  });

  it('uses slug-shaped ids, which end up in config file keys', () => {
    for (const server of servers) {
      expect(server.id, server.id).toMatch(/^[a-z0-9]+([._-][a-z0-9]+)*$/);
    }
  });

  it('gives every server the text the card shows', () => {
    for (const server of servers) {
      expect(server.name.trim(), server.id).not.toBe('');
      expect(server.description.trim(), server.id).not.toBe('');
      expect(server.category.trim(), server.id).not.toBe('');
      expect(server.author.trim(), server.id).not.toBe('');
      expect(server.version.trim(), server.id).not.toBe('');
    }
  });

  it('keeps tags non-empty and free of duplicates', () => {
    for (const server of servers) {
      for (const tag of server.tags) {
        expect(tag.trim(), server.id).not.toBe('');
      }
      expect(new Set(server.tags).size, server.id).toBe(server.tags.length);
    }
  });

  it('uses http(s) for every link it offers', () => {
    for (const server of servers) {
      for (const url of [server.websiteUrl, server.repositoryUrl]) {
        if (!url) continue;
        expect(url, `${server.id}: ${url}`).toMatch(/^https?:\/\/\S+$/);
      }
    }
  });

  it('never carries a negative popularity, which sorts the listing', () => {
    for (const server of servers) {
      expect(server.popularity, server.id).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(server.popularity), server.id).toBe(true);
    }
  });

  it('names env vars in the usual SCREAMING_SNAKE shape, with no duplicates', () => {
    for (const server of servers) {
      for (const name of server.requiredEnv) {
        expect(name, server.id).toMatch(/^[A-Z][A-Z0-9_]*$/);
      }
      expect(new Set(server.requiredEnv).size, server.id).toBe(server.requiredEnv.length);
    }
  });

  it('never leaves a blank command or a blank argument on a stdio server', () => {
    for (const server of servers) {
      const { command, args } = server.config;
      if (command !== undefined) {
        expect(command.trim(), server.id).not.toBe('');
        // The command is spawned directly, so it must be an executable name and not a
        // whole shell line that would need splitting first.
        expect(command, server.id).not.toMatch(/\s/);
      }
      for (const arg of args) {
        expect(typeof arg, server.id).toBe('string');
        expect(arg, server.id).not.toBe('');
      }
    }
  });

  it('never gives a stdio server args without a command to run them with', () => {
    for (const server of servers) {
      if (server.config.args.length === 0) continue;
      expect(server.config.command, server.id).toBeTruthy();
    }
  });

  it('gives every sse/http server a URL, and never one to a stdio server', () => {
    for (const server of servers) {
      if (server.config.transport === 'stdio') {
        expect(server.config.url, server.id).toBeUndefined();
        continue;
      }
      expect(server.config.url, server.id).toMatch(/^https?:\/\/\S+$/);
    }
  });

  it('never both spawns a command and points at a URL', () => {
    for (const server of servers) {
      const both = Boolean(server.config.command) && Boolean(server.config.url);
      expect(both, server.id).toBe(false);
    }
  });
});

describe('bundledMcpRepository', () => {
  it('describes the bundled listing, so it can be told apart from a user-added one', () => {
    expect(bundledMcpRepository.id).toBe(BOWORA_MCP_REPOSITORY_ID);
    expect(bundledMcpRepository.sourceType).toBe('bundled');
    expect(bundledMcpRepository.name).toBe(bundledMcpDirectory.name);
  });

  it('carries parseable timestamps', () => {
    expect(Number.isNaN(Date.parse(bundledMcpRepository.addedAt))).toBe(false);
    expect(bundledMcpRepository.lastRefreshedAt).not.toBeNull();
    expect(Number.isNaN(Date.parse(bundledMcpRepository.lastRefreshedAt ?? ''))).toBe(false);
  });
});
