import type {
  RecordBatchParams,
  RecordCreateParams,
  RecordEditParams,
} from 'cloudflare/resources/dns/records';
import type { AccessRuleCreateParams } from 'cloudflare/resources/firewall/access-rules';
import type { RuleCreateParams, RuleEditParams } from 'cloudflare/resources/rulesets/rules';
import type { RulesetCreateParams } from 'cloudflare/resources/rulesets/rulesets';
import type { SecretEnvelope } from '../../../shared/apiTypes';
import { PROXIABLE_TYPES } from '../../../shared/cloudflare/dns';
import { tokenProblem } from '../../../shared/cloudflare/permissions';
import { accessRuleTarget, type BuiltRule, buildRule } from '../../../shared/cloudflare/rules';
import { encodeCloudflareError } from '../../../shared/cloudflareErrors';
import type {
  CloudflareAccessMode,
  CloudflareAccessRule,
  CloudflareAccessRuleInput,
  CloudflareAccessTarget,
  CloudflareCustomRule,
  CloudflareCustomRuleInput,
  CloudflareDnsRecord,
  CloudflarePermissionId,
  CloudflarePointDomainInput,
  CloudflarePointDomainPlan,
  CloudflarePointDomainResult,
  CloudflarePurgeRequest,
  CloudflareRecordInput,
  CloudflareSecurityLevel,
  CloudflareSettingChange,
  CloudflareSslMode,
  CloudflareStatus,
  CloudflareZone,
  CloudflareZoneSettings,
} from '../../../shared/cloudflareTypes';
import { type CloudflareApi, type CloudflareFetch, createCloudflareApi } from './client';
import { cloudflareFailure, isNotFound, isPermissionDenied, isUnauthorized } from './errors';
import { planChanges, pointedNames, type ServerAddresses } from './pointDomain';
import type { CloudflareState } from './state';
import { checkToken } from './tokenCheck';

/**
 * The Cloudflare page's main-process side. The API token arrives once from the renderer, is
 * checked against Cloudflare, sealed with the Servers vault and saved; after that the renderer
 * only ever sees whether one is set and what it may do. Every call unseals the token for the
 * length of that call and goes through the official SDK. When Cloudflare refuses a call for want
 * of a permission, the error names it (and the saved report marks it missing), so the page can
 * show exactly what to add to the token.
 *
 * Origin CA certificates (T5), the Cloudflare-only origin lock (T6) and DNS-01 tokens for a
 * server (T7) need the server core's certificate and firewall features; they will be methods
 * here that hand the result to the core, next to `pointDomain`.
 */

export interface CloudflareServiceDeps {
  state: CloudflareState;
  /** Seals the token with the Servers vault, and opens it again. */
  seal: (plaintext: string) => Promise<SecretEnvelope>;
  unseal: (envelope: SecretEnvelope) => Promise<string>;
  /** Whether opening this envelope needs the Servers passkey, which is locked right now. */
  isLocked: (envelope: SecretEnvelope) => boolean;
  /** A saved server's public addresses, for "point domain to this server". */
  addresses: (serverId: string) => Promise<ServerAddresses>;
  /** The SDK's fetch; tests pass the fake Cloudflare API. */
  fetch?: CloudflareFetch;
  maxRetries?: number;
  now?: () => number;
}

const CUSTOM_PHASE = 'http_request_firewall_custom';
const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const EDITABLE: ReadonlySet<string> = new Set(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'CAA', 'SRV']);
const SETTING_IDS = {
  developmentMode: 'development_mode',
  securityLevel: 'security_level',
  ssl: 'ssl',
  alwaysUseHttps: 'always_use_https',
} as const;
const NO_TOKEN = 'Connect Cloudflare first: paste an API token on the Cloudflare page.';
const LOCKED =
  'Your saved servers are locked with a passkey, and the Cloudflare token with them. Unlock them first.';
const RULE_GONE = 'That rule is not in this zone any more. Refresh the list.';

/** The fields of a DNS record the page reads, whatever its type. */
interface ApiRecord {
  id: string;
  type: string;
  name: string;
  content?: string;
  ttl: number;
  proxied?: boolean;
  proxiable?: boolean;
  priority?: number;
  comment?: string | null;
  data?: {
    flags?: number;
    tag?: string;
    value?: string;
    priority?: number;
    weight?: number;
    port?: number;
    target?: string;
  };
}

interface ApiRule {
  id?: string;
  action?: string;
  expression?: string;
  description?: string;
  enabled?: boolean;
  last_updated?: string;
  action_parameters?: unknown;
}

interface ApiRuleset {
  id: string;
  rules?: ApiRule[];
}

interface ApiSetting {
  value?: unknown;
  editable?: boolean;
  time_remaining?: number;
}

function toRecord(record: ApiRecord): CloudflareDnsRecord {
  const result: CloudflareDnsRecord = {
    id: record.id,
    type: record.type,
    name: record.name,
    content: record.content ?? '',
    ttl: record.ttl,
    proxied: record.proxied ?? false,
    proxiable: record.proxiable ?? false,
    ...(record.comment ? { comment: record.comment } : {}),
    editable: EDITABLE.has(record.type),
  };
  const data = record.data ?? {};
  if (record.type === 'MX') result.priority = record.priority ?? 0;
  if (record.type === 'CAA') {
    result.caa = {
      flags: data.flags ?? 0,
      tag: (data.tag ?? 'issue') as 'issue' | 'issuewild' | 'iodef',
      value: data.value ?? '',
    };
  }
  if (record.type === 'SRV') {
    result.srv = {
      priority: data.priority ?? record.priority ?? 0,
      weight: data.weight ?? 0,
      port: data.port ?? 0,
      target: data.target ?? '',
    };
  }
  return result;
}

/** The SDK body for a record: proxied records always use the automatic TTL. */
function recordBody(input: CloudflareRecordInput): Record<string, unknown> {
  const proxied = 'proxied' in input && PROXIABLE_TYPES.has(input.type) ? input.proxied : false;
  const common = {
    type: input.type,
    name: input.name,
    ttl: proxied ? 1 : input.ttl,
    ...(input.comment === undefined ? {} : { comment: input.comment }),
  };
  switch (input.type) {
    case 'A':
    case 'AAAA':
    case 'CNAME':
      return { ...common, content: input.content, proxied };
    case 'TXT':
      return { ...common, content: input.content };
    case 'MX':
      return { ...common, content: input.content, priority: input.priority };
    case 'CAA':
      return { ...common, data: { ...input.caa } };
    default:
      return { ...common, data: { ...input.srv } };
  }
}

function toRule(rule: ApiRule): CloudflareCustomRule {
  return {
    id: rule.id ?? '',
    description: rule.description ?? '',
    expression: rule.expression ?? '',
    action: rule.action ?? '',
    enabled: rule.enabled ?? true,
    lastUpdated: rule.last_updated ?? null,
  };
}

function rulesOf(ruleset: ApiRuleset | null): CloudflareCustomRule[] {
  return (ruleset?.rules ?? []).map(toRule);
}

function ruleBody(rule: BuiltRule, description: string): Record<string, unknown> {
  return {
    description,
    expression: rule.expression,
    action: rule.action,
    enabled: true,
    ...(rule.actionParameters ? { action_parameters: rule.actionParameters } : {}),
  };
}

function toAccessRule(rule: {
  id: string;
  mode: string;
  configuration?: { target?: string; value?: string };
  notes?: string;
  created_on?: string;
}): CloudflareAccessRule {
  return {
    id: rule.id,
    mode: rule.mode as CloudflareAccessMode,
    target: (rule.configuration?.target ?? 'ip') as CloudflareAccessTarget,
    value: rule.configuration?.value ?? '',
    notes: rule.notes ?? '',
    createdOn: rule.created_on ?? null,
  };
}

function settingValue<T extends string>(setting: ApiSetting, fallback: T): T {
  return typeof setting.value === 'string' ? (setting.value as T) : fallback;
}

/**
 * Every page of a v4 list, stopping at the last page Cloudflare reports. The SDK's own iterator
 * always asks for one more page than there is, and its types leave `total_pages` out.
 */
async function allPages<T>(
  fetchPage: (page: number) => PromiseLike<{ result: T[]; result_info?: unknown }>,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const answer = await fetchPage(page);
    items.push(...answer.result);
    const totalPages = (answer.result_info as { total_pages?: number } | undefined)?.total_pages;
    if (page >= (totalPages ?? 1) || answer.result.length === 0) break;
  }
  return items;
}

export class CloudflareService {
  private readonly now: () => number;

  constructor(private readonly deps: CloudflareServiceDeps) {
    this.now = deps.now ?? Date.now;
  }

  async status(): Promise<CloudflareStatus> {
    const [token, report] = await Promise.all([this.deps.state.token(), this.deps.state.report()]);
    return {
      configured: token !== null,
      locked: token !== null && this.deps.isLocked(token.envelope),
      report,
    };
  }

  /** Checks a pasted token, then seals and saves it with its report, missing permissions and all. */
  async saveToken(token: string): Promise<CloudflareStatus> {
    const problem = tokenProblem(token);
    if (problem) throw new Error(problem);
    const api = this.api(token);
    let report: Awaited<ReturnType<typeof checkToken>>;
    try {
      report = await checkToken(api, this.now());
    } catch (error) {
      if (isUnauthorized(error) || isPermissionDenied(error)) {
        throw new Error(
          'Cloudflare did not accept this token. Check that you copied all of it, and that it is an API token from My Profile > API Tokens.',
        );
      }
      throw cloudflareFailure(error, token);
    }
    if (report.status !== 'active') {
      throw new Error(
        `This token is ${report.status} on Cloudflare. Turn it back on there, or create a new one.`,
      );
    }
    let envelope: SecretEnvelope;
    try {
      envelope = await this.deps.seal(token);
    } catch {
      throw new Error(encodeCloudflareError('locked', LOCKED));
    }
    await this.deps.state.save({ envelope, tokenId: report.tokenId, savedAt: this.now() }, report);
    return this.status();
  }

  /** Checks the saved token again, as after its permissions were edited on Cloudflare. */
  async checkToken(): Promise<CloudflareStatus> {
    const report = await this.withApi(undefined, (api) => checkToken(api, this.now()));
    await this.deps.state.setReport(report);
    return this.status();
  }

  removeToken(): Promise<void> {
    return this.deps.state.clear();
  }

  listZones(): Promise<CloudflareZone[]> {
    return this.withApi('zone', async (api) => {
      const zones = await allPages((page) => api.zones.list({ page, per_page: 50 }));
      return zones.map((zone) => ({
        id: zone.id,
        name: zone.name,
        status: zone.status ?? 'active',
        paused: zone.paused ?? false,
        plan: zone.plan?.name ?? '',
        nameServers: zone.name_servers ?? [],
      }));
    });
  }

  listRecords(zoneId: string): Promise<CloudflareDnsRecord[]> {
    return this.withApi('dns', async (api) => {
      const records = await allPages((page) =>
        api.dns.records.list({ zone_id: zoneId, page, per_page: PAGE_SIZE }),
      );
      return records.map((record) => toRecord(record as unknown as ApiRecord));
    });
  }

  createRecord(zoneId: string, input: CloudflareRecordInput): Promise<CloudflareDnsRecord> {
    return this.withApi('dns', async (api) => {
      const params = { zone_id: zoneId, ...recordBody(input) } as RecordCreateParams;
      return toRecord((await api.dns.records.create(params)) as unknown as ApiRecord);
    });
  }

  /** A PATCH rather than a PUT, so tags and anything else set on the dashboard survive. */
  updateRecord(
    zoneId: string,
    recordId: string,
    input: CloudflareRecordInput,
  ): Promise<CloudflareDnsRecord> {
    return this.withApi('dns', async (api) => {
      const params = { zone_id: zoneId, ...recordBody(input) } as RecordEditParams;
      return toRecord((await api.dns.records.edit(recordId, params)) as unknown as ApiRecord);
    });
  }

  deleteRecord(zoneId: string, recordId: string): Promise<void> {
    return this.withApi('dns', async (api) => {
      await api.dns.records.delete(recordId, { zone_id: zoneId });
    });
  }

  zoneSettings(zoneId: string): Promise<CloudflareZoneSettings> {
    return this.withApi('zoneSettings', (api) => this.readSettings(api, zoneId));
  }

  changeSetting(zoneId: string, change: CloudflareSettingChange): Promise<CloudflareZoneSettings> {
    return this.withApi('zoneSettings', async (api) => {
      await api.zones.settings.edit(SETTING_IDS[change.setting], {
        zone_id: zoneId,
        value: change.value,
      });
      return this.readSettings(api, zoneId);
    });
  }

  purgeCache(zoneId: string, request: CloudflarePurgeRequest): Promise<void> {
    return this.withApi('cachePurge', async (api) => {
      await api.cache.purge(
        'everything' in request
          ? { zone_id: zoneId, purge_everything: true }
          : { zone_id: zoneId, files: request.urls },
      );
    });
  }

  listCustomRules(zoneId: string): Promise<CloudflareCustomRule[]> {
    return this.withApi('waf', async (api) => rulesOf(await this.customRuleset(api, zoneId)));
  }

  /**
   * Adds a builder rule to the zone's custom rules. A zone without any gets its entry point made
   * with the rule in it; the entry point is never replaced with a PUT, which would drop the rules
   * already there.
   */
  createCustomRule(
    zoneId: string,
    input: CloudflareCustomRuleInput,
  ): Promise<CloudflareCustomRule[]> {
    const built = buildRule(input.spec);
    if (!built.ok) return Promise.reject(new Error(built.problem));
    const body = ruleBody(built.rule, input.description);
    return this.withApi('waf', async (api) => {
      const ruleset = await this.customRuleset(api, zoneId);
      if (!ruleset) {
        const created = await api.rulesets.create({
          zone_id: zoneId,
          kind: 'zone',
          name: 'default',
          phase: CUSTOM_PHASE,
          rules: [body],
        } as unknown as RulesetCreateParams);
        return rulesOf(created as unknown as ApiRuleset);
      }
      const params = {
        zone_id: zoneId,
        ...body,
        ...(built.rule.first ? { position: { index: 1 } } : {}),
      } as unknown as RuleCreateParams;
      return rulesOf(
        (await api.rulesets.rules.create(ruleset.id, params)) as unknown as ApiRuleset,
      );
    });
  }

  /** Sends the rule's whole definition with the new state, so nothing else about it changes. */
  setCustomRuleEnabled(
    zoneId: string,
    ruleId: string,
    enabled: boolean,
  ): Promise<CloudflareCustomRule[]> {
    return this.withApi('waf', async (api) => {
      const { ruleset, rule } = await this.findRule(api, zoneId, ruleId);
      const params = {
        zone_id: zoneId,
        ruleset_id: ruleset.id,
        action: rule.action,
        expression: rule.expression,
        description: rule.description ?? '',
        enabled,
        ...(rule.action_parameters ? { action_parameters: rule.action_parameters } : {}),
      } as unknown as RuleEditParams;
      return rulesOf((await api.rulesets.rules.edit(ruleId, params)) as unknown as ApiRuleset);
    });
  }

  deleteCustomRule(zoneId: string, ruleId: string): Promise<CloudflareCustomRule[]> {
    return this.withApi('waf', async (api) => {
      const { ruleset } = await this.findRule(api, zoneId, ruleId);
      const after = await api.rulesets.rules.delete(ruleId, {
        zone_id: zoneId,
        ruleset_id: ruleset.id,
      });
      return rulesOf(after as unknown as ApiRuleset);
    });
  }

  listAccessRules(zoneId: string): Promise<CloudflareAccessRule[]> {
    return this.withApi('accessRules', async (api) => {
      const rules = await allPages((page) =>
        api.firewall.accessRules.list({ zone_id: zoneId, page, per_page: PAGE_SIZE }),
      );
      return rules.map(toAccessRule);
    });
  }

  createAccessRule(
    zoneId: string,
    input: CloudflareAccessRuleInput,
  ): Promise<CloudflareAccessRule> {
    const target = accessRuleTarget(input.value);
    if (!target.ok) return Promise.reject(new Error(target.problem));
    return this.withApi('accessRules', async (api) => {
      const created = await api.firewall.accessRules.create({
        zone_id: zoneId,
        mode: input.mode,
        configuration: { target: target.target, value: target.value },
        notes: input.notes,
      } as AccessRuleCreateParams);
      return toAccessRule(created);
    });
  }

  deleteAccessRule(zoneId: string, ruleId: string): Promise<void> {
    return this.withApi('accessRules', async (api) => {
      await api.firewall.accessRules.delete(ruleId, { zone_id: zoneId });
    });
  }

  /** What pointing the name at the server would change, without changing anything. */
  planPointDomain(input: CloudflarePointDomainInput): Promise<CloudflarePointDomainPlan> {
    return this.withApi('dns', (api) => this.plan(api, input));
  }

  /** Applies the plan in one batch, which Cloudflare runs as a single transaction (AC2). */
  pointDomain(input: CloudflarePointDomainInput): Promise<CloudflarePointDomainResult> {
    return this.withApi('dns', async (api) => {
      const plan = await this.plan(api, input);
      if (plan.upToDate) return { plan, applied: 0 };
      const deletes = plan.changes.filter((change) => change.action === 'delete');
      const patches = plan.changes.filter((change) => change.action === 'update');
      const posts = plan.changes.filter((change) => change.action === 'create');
      const ttlOf = new Map(
        (await this.recordsAt(api, input.zoneId, plan.names)).map((record) => [
          record.id,
          record.ttl,
        ]),
      );
      await api.dns.records.batch({
        zone_id: input.zoneId,
        deletes: deletes.map((change) => ({ id: change.recordId })),
        patches: patches.map((change) => ({
          id: change.recordId,
          type: change.type,
          name: change.name,
          content: change.content,
          proxied: change.proxied,
          ttl: change.proxied ? 1 : (ttlOf.get(change.recordId ?? '') ?? 1),
        })),
        posts: posts.map((change) => ({
          type: change.type,
          name: change.name,
          content: change.content,
          proxied: change.proxied,
          ttl: 1,
        })),
      } as RecordBatchParams);
      return { plan, applied: deletes.length + patches.length + posts.length };
    });
  }

  private async plan(
    api: CloudflareApi,
    input: CloudflarePointDomainInput,
  ): Promise<CloudflarePointDomainPlan> {
    const zone = await api.zones.get({ zone_id: input.zoneId });
    const names = pointedNames(input.name, zone.name, input.includeWww);
    if (!names) {
      throw new Error(
        'That name cannot be used for a website. Use @ for the domain itself, or a name like app.',
      );
    }
    const addresses = await this.deps.addresses(input.serverId);
    const existing = await this.recordsAt(api, input.zoneId, names);
    const changes = planChanges({ names, addresses, proxied: input.proxied, existing });
    return {
      zoneName: zone.name,
      names,
      addresses,
      changes,
      upToDate: changes.every((change) => change.action === 'keep'),
    };
  }

  private async recordsAt(
    api: CloudflareApi,
    zoneId: string,
    names: string[],
  ): Promise<CloudflareDnsRecord[]> {
    const lists = await Promise.all(
      names.map((name) =>
        allPages((page) =>
          api.dns.records.list({
            zone_id: zoneId,
            name: { exact: name },
            page,
            per_page: PAGE_SIZE,
          }),
        ),
      ),
    );
    return lists.flat().map((record) => toRecord(record as unknown as ApiRecord));
  }

  private async readSettings(api: CloudflareApi, zoneId: string): Promise<CloudflareZoneSettings> {
    const [development, security, ssl, https] = (await Promise.all(
      Object.values(SETTING_IDS).map((id) => api.zones.settings.get(id, { zone_id: zoneId })),
    )) as ApiSetting[];
    return {
      developmentMode: {
        value: settingValue<'on' | 'off'>(development, 'off'),
        secondsRemaining: development.time_remaining ?? 0,
        editable: development.editable ?? true,
      },
      securityLevel: {
        value: settingValue<CloudflareSecurityLevel>(security, 'medium'),
        editable: security.editable ?? true,
      },
      ssl: { value: settingValue<CloudflareSslMode>(ssl, 'off'), editable: ssl.editable ?? true },
      alwaysUseHttps: {
        value: settingValue<'on' | 'off'>(https, 'off'),
        editable: https.editable ?? true,
      },
    };
  }

  /** The zone's custom rules entry point, or null when the zone has no custom rules yet. */
  private async customRuleset(api: CloudflareApi, zoneId: string): Promise<ApiRuleset | null> {
    try {
      return (await api.rulesets.phases.get(CUSTOM_PHASE, {
        zone_id: zoneId,
      })) as unknown as ApiRuleset;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  private async findRule(api: CloudflareApi, zoneId: string, ruleId: string) {
    const ruleset = await this.customRuleset(api, zoneId);
    const rule = ruleset?.rules?.find((candidate) => candidate.id === ruleId);
    if (!ruleset || !rule) throw new Error(RULE_GONE);
    return { ruleset, rule };
  }

  private api(token: string): CloudflareApi {
    return createCloudflareApi(token, { fetch: this.deps.fetch, maxRetries: this.deps.maxRetries });
  }

  /**
   * Runs `work` with the saved token, for the length of the call. `permission` is the one the
   * call needs: a refusal names it in the error and marks it missing in the saved report.
   */
  private async withApi<T>(
    permission: CloudflarePermissionId | undefined,
    work: (api: CloudflareApi) => Promise<T>,
  ): Promise<T> {
    const stored = await this.deps.state.token();
    if (!stored) throw new Error(encodeCloudflareError('no-token', NO_TOKEN));
    if (this.deps.isLocked(stored.envelope))
      throw new Error(encodeCloudflareError('locked', LOCKED));
    let token: string;
    try {
      token = await this.deps.unseal(stored.envelope);
    } catch {
      throw new Error(encodeCloudflareError('locked', LOCKED));
    }
    try {
      return await work(this.api(token));
    } catch (error) {
      if (permission && isPermissionDenied(error)) await this.deps.state.markMissing(permission);
      throw cloudflareFailure(error, token, permission);
    }
  }
}
