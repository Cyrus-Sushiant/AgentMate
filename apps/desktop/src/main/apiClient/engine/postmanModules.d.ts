/**
 * Just enough of Postman's runtime and collection SDK for the engine. Neither package ships
 * typings the compiler finds on its own, and the engine only touches a small part of each.
 */

declare module 'postman-collection' {
  export interface SdkPropertyList<T> {
    all(): T[];
    count(): number;
  }

  export interface SdkVariable {
    key: string;
    value: unknown;
    type?: string;
    disabled?: boolean;
  }

  export interface SdkHeader {
    key: string;
    value: string;
  }

  export class VariableScope {
    constructor(definition?: { values?: unknown[] });
    values: SdkPropertyList<SdkVariable>;
  }

  export class Collection {
    constructor(definition?: unknown);
    variables: SdkPropertyList<SdkVariable>;
  }

  export class ProxyConfigList {
    constructor(parent: unknown, list: unknown[]);
  }

  export interface SdkResponse {
    code: number;
    status: string;
    stream?: Buffer | { type: 'Buffer'; data: number[] };
    responseTime?: number;
    headers: SdkPropertyList<SdkHeader> & { get(name: string): string | undefined };
    size(): { body: number; header: number; total: number };
  }

  export interface SdkRequest {
    method: string;
    url: { toString(): string };
    headers: SdkPropertyList<SdkHeader & { disabled?: boolean }>;
    body?: { toString(): string; isEmpty?(): boolean; mode?: string };
  }

  const sdk: {
    VariableScope: typeof VariableScope;
    Collection: typeof Collection;
    ProxyConfigList: typeof ProxyConfigList;
  };
  export default sdk;
}

declare module 'postman-runtime' {
  export interface PostmanRun {
    start(callbacks: Record<string, (...args: never[]) => void>): void;
    abort(): void;
  }

  export class Runner {
    run(
      collection: unknown,
      options: Record<string, unknown>,
      callback: (error: Error | null, run: PostmanRun) => void,
    ): void;
  }

  const runtime: { Runner: typeof Runner; version?: string };
  export default runtime;
}
