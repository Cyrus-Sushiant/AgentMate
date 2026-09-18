import { existsSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';

/**
 * A better-sqlite3 stand-in built on Node's own sqlite. The vitest "main" project aliases
 * `better-sqlite3` here.
 *
 * Why: `pnpm dev` and `pnpm package` rebuild better-sqlite3 against Electron's ABI, after which
 * plain Node (which is what vitest runs) can no longer load it. Tests would then fail with a
 * module version error depending on what you last ran. The real module still gets exercised by
 * the end-to-end suite, which runs inside Electron.
 *
 * Only the surface the app actually uses is covered: prepare/run/get/all, exec, pragma,
 * transaction, close, and the readonly and fileMustExist options.
 */

type Row = Record<string, unknown>;
type Params = unknown[];

function toValue(value: unknown): SQLInputValue {
  // node:sqlite takes null, number, bigint, string and Uint8Array. better-sqlite3 also accepts
  // undefined for a missing value and booleans, which the app relies on.
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value as SQLInputValue;
}

function isNamedBag(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !ArrayBuffer.isView(value) &&
    !(value instanceof Date)
  );
}

class Statement {
  constructor(
    private readonly statement: StatementSync,
    /** The @name, :name and $name placeholders in this statement's SQL. */
    private readonly named: string[],
  ) {}

  /**
   * better-sqlite3 lets a caller hand the whole row object to a statement that names only some of
   * its columns, and the app does exactly that. node:sqlite refuses an unknown named parameter,
   * so the object is narrowed to the placeholders the statement actually has.
   */
  private bind(params: Params): SQLInputValue[] {
    if (params.length === 1 && isNamedBag(params[0])) {
      const bag = params[0];
      const filtered: Record<string, SQLInputValue> = {};
      for (const key of this.named) {
        if (key in bag) filtered[key] = toValue(bag[key]);
      }
      return [filtered as unknown as SQLInputValue];
    }
    return params.map(toValue);
  }

  run(...params: Params): { changes: number; lastInsertRowid: number | bigint } {
    const result = this.statement.run(...this.bind(params));
    return { changes: Number(result.changes), lastInsertRowid: result.lastInsertRowid };
  }

  get(...params: Params): Row | undefined {
    return this.statement.get(...this.bind(params)) as Row | undefined;
  }

  all(...params: Params): Row[] {
    return this.statement.all(...this.bind(params)) as Row[];
  }

  iterate(...params: Params): IterableIterator<Row> {
    return this.all(...params)[Symbol.iterator]();
  }

  pluck(): this {
    return this;
  }
}

export default class Database {
  private readonly db: DatabaseSync;
  open = true;

  constructor(
    readonly name: string,
    options: { readonly?: boolean; fileMustExist?: boolean } = {},
  ) {
    if (options.fileMustExist && name !== ':memory:' && !existsSync(name)) {
      throw new Error(`unable to open database file: ${name}`);
    }
    this.db = new DatabaseSync(name, { readOnly: options.readonly === true });
  }

  prepare(sql: string): Statement {
    // Placeholder names, minus the prefix: node:sqlite matches bare keys.
    const named = [...sql.matchAll(/[@:$]([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]);
    return new Statement(this.db.prepare(sql), [...new Set(named)]);
  }

  exec(sql: string): this {
    this.db.exec(sql);
    return this;
  }

  pragma(statement: string): Row[] {
    return this.db.prepare(`PRAGMA ${statement}`).all() as Row[];
  }

  /** better-sqlite3 returns a callable that wraps the work in one transaction. */
  transaction<Args extends unknown[], Result>(
    work: (...args: Args) => Result,
  ): (...args: Args) => Result {
    return (...args: Args): Result => {
      this.db.exec('BEGIN');
      try {
        const result = work(...args);
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        this.db.exec('ROLLBACK');
        throw error;
      }
    };
  }

  function(): this {
    return this;
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.db.close();
  }
}

/** False on a Node without node:sqlite, so a test can skip instead of failing. */
export const hasNodeSqlite = true;
