/**
 * Re-exports the wire protocol from `@agentmat/protocol`, the package shared
 * with the mobile controller app (apps/mobile). Keeping this thin re-export
 * (rather than importing `@agentmat/protocol` directly everywhere) preserves
 * the existing `@shared/remoteProtocol` import path used throughout main and
 * renderer code.
 */
export * from '@agentmat/protocol';
