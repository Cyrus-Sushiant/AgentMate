import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import type { AddPromptHistoryInput, PromptHistoryEntry, PromptHistorySource } from '../shared/apiTypes';

// Unlike node-pty, better-sqlite3 is not N-API based, so its native binding is
// tied to the exact Electron ABI it runs under — see the `rebuild:native`
// script in package.json (run before `dev`/`package`) which rebuilds it for
// Electron via @electron/rebuild.
let db: Database.Database | null = null;

interface PromptHistoryRow {
  id: string;
  raw_input: string;
  prompt_type: string;
  target_ai: string;
  content: string;
  source: PromptHistorySource;
  tags: string;
  created_at: string;
}

function rowToEntry(row: PromptHistoryRow): PromptHistoryEntry {
  return {
    id: row.id,
    rawInput: row.raw_input,
    promptType: row.prompt_type,
    targetAI: row.target_ai,
    content: row.content,
    source: row.source,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    createdAt: row.created_at,
  };
}

function getDb(): Database.Database {
  if (db) return db;
  const dir = join(app.getPath('userData'), 'data');
  mkdirSync(dir, { recursive: true });
  db = new Database(join(dir, 'prompt-history.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_history (
      id TEXT PRIMARY KEY,
      raw_input TEXT NOT NULL,
      prompt_type TEXT NOT NULL,
      target_ai TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prompt_history_created_at ON prompt_history(created_at DESC);
  `);
  const columns = db.prepare('PRAGMA table_info(prompt_history)').all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === 'tags')) {
    db.exec(`ALTER TABLE prompt_history ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  }
  return db;
}

export const promptHistoryDb = {
  add(input: AddPromptHistoryInput): PromptHistoryEntry {
    const entry: PromptHistoryEntry = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      tags: [],
      ...input,
    };
    getDb()
      .prepare(
        `INSERT INTO prompt_history (id, raw_input, prompt_type, target_ai, content, source, created_at)
         VALUES (@id, @rawInput, @promptType, @targetAI, @content, @source, @createdAt)`,
      )
      .run(entry);
    return entry;
  },

  list(limit = 200): PromptHistoryEntry[] {
    const rows = getDb()
      .prepare('SELECT * FROM prompt_history ORDER BY created_at DESC LIMIT ?')
      .all(limit) as PromptHistoryRow[];
    return rows.map(rowToEntry);
  },

  search(query: string, limit = 200): PromptHistoryEntry[] {
    const like = `%${query}%`;
    const rows = getDb()
      .prepare(
        `SELECT * FROM prompt_history
         WHERE raw_input LIKE @like OR content LIKE @like OR prompt_type LIKE @like OR target_ai LIKE @like
         ORDER BY created_at DESC LIMIT @limit`,
      )
      .all({ like, limit }) as PromptHistoryRow[];
    return rows.map(rowToEntry);
  },

  remove(id: string): void {
    getDb().prepare('DELETE FROM prompt_history WHERE id = ?').run(id);
  },

  setTags(id: string, tags: string[]): void {
    getDb()
      .prepare('UPDATE prompt_history SET tags = @tags WHERE id = @id')
      .run({ id, tags: JSON.stringify(tags) });
  },
};
