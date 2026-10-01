import type {
  CloudflareDnsRecord,
  CloudflareRecordInput,
  CloudflareZone,
} from '@shared/cloudflareTypes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { Globe, Pencil, Plus, Server, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cloudflareFailureText, useCloudflareError } from '@/lib/cloudflare/feedback';
import { relativeName, ttlLabel } from '@/lib/cloudflare/labels';
import { queryKeys } from '@/lib/queryKeys';
import { confirmDialog } from '@/stores/confirmStore';
import { Problem } from './fields';
import { PointDomainDialog } from './PointDomainDialog';
import { RecordDialog } from './RecordDialog';

const LONG_CONTENT = 40;

/** The same record with the proxy turned on or off, and nothing else changed. */
function withProxy(record: CloudflareDnsRecord, proxied: boolean): CloudflareRecordInput {
  return {
    type: record.type as 'A' | 'AAAA' | 'CNAME',
    name: record.name,
    content: record.content,
    ttl: proxied ? 1 : record.ttl,
    proxied,
  };
}

function RecordsSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full rounded-md" />
      ))}
    </div>
  );
}

/**
 * A zone's DNS records (T2). The proxy is a switch with its state written next to it, record
 * types the page does not edit are listed as read-only, and a delete asks first.
 */
export function DnsRecordsCard({ zone }: { zone: CloudflareZone }): React.JSX.Element {
  const queryClient = useQueryClient();
  const recordsKey = queryKeys.cloudflareRecords(zone.id);
  const records = useQuery({
    queryKey: recordsKey,
    queryFn: () => window.agentmat.cloudflare.listRecords(zone.id),
  });
  const loadError = useCloudflareError(records.error);
  // undefined: no editor open; null: adding a record; a record: editing it.
  const [editing, setEditing] = useState<CloudflareDnsRecord | null | undefined>(undefined);
  const [pointing, setPointing] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);

  async function setProxy(record: CloudflareDnsRecord, proxied: boolean): Promise<void> {
    setChanging(record.id);
    try {
      await window.agentmat.cloudflare.updateRecord(zone.id, record.id, withProxy(record, proxied));
      toast.success(`${record.name} is ${proxied ? 'proxied' : 'DNS only'} now.`);
      await queryClient.invalidateQueries({ queryKey: recordsKey });
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    } finally {
      setChanging(null);
    }
  }

  async function remove(record: CloudflareDnsRecord): Promise<void> {
    const what = `the ${record.type} record for ${record.name}`;
    const confirmed = await confirmDialog({
      title: `Delete ${what}?`,
      description: `${record.name} stops answering with ${record.content}. Anything that relies on it, a website or mail, stops working once resolvers notice.`,
      confirmLabel: 'Delete record',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await window.agentmat.cloudflare.deleteRecord(zone.id, record.id);
      toast.success(`Deleted ${what}.`);
      await queryClient.invalidateQueries({ queryKey: recordsKey });
    } catch (error) {
      toast.error(cloudflareFailureText(error, queryClient));
    }
  }

  let body: React.ReactNode;
  if (records.isPending) {
    body = <RecordsSkeleton />;
  } else if (records.isError) {
    body = <Problem message={loadError ?? ''} onRetry={() => void records.refetch()} />;
  } else if (records.data.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        No DNS records yet. Add one, or point the domain to one of your servers.
      </p>
    );
  } else {
    body = (
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full text-sm">
          <thead className="bg-secondary/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Content</th>
              <th className="px-3 py-2 font-medium">Proxy</th>
              <th className="px-3 py-2 font-medium">TTL</th>
              <th className="px-3 py-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {records.data.map((record) => {
              const what = `the ${record.type} record for ${record.name}`;
              const content = (
                <span className="block max-w-[18rem] truncate font-mono text-xs">
                  {record.content}
                </span>
              );
              return (
                <tr key={record.id}>
                  <td className="px-3 py-2">
                    <span className="rounded border border-border/70 bg-secondary/40 px-1.5 py-0.5 font-mono text-xs">
                      {record.type}
                    </span>
                  </td>
                  <td className="max-w-[14rem] truncate px-3 py-2 font-mono text-xs">
                    {relativeName(record.name, zone.name)}
                  </td>
                  <td className="px-3 py-2">
                    {record.content.length > LONG_CONTENT ? (
                      <SimpleTooltip label={record.content}>{content}</SimpleTooltip>
                    ) : (
                      content
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {record.proxiable && record.editable && (
                        <Switch
                          checked={record.proxied}
                          disabled={changing === record.id}
                          aria-label={`Proxy ${record.name} through Cloudflare`}
                          onCheckedChange={(checked) => void setProxy(record, checked)}
                        />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {record.proxied ? 'Proxied' : 'DNS only'}
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {ttlLabel(record.ttl)}
                  </td>
                  <td className="px-3 py-2">
                    {record.editable ? (
                      <span className="flex justify-end gap-1">
                        <SimpleTooltip label="Edit record">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label={`Edit ${what}`}
                            onClick={() => setEditing(record)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </SimpleTooltip>
                        <SimpleTooltip label="Delete record">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label={`Delete ${what}`}
                            onClick={() => void remove(record)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </SimpleTooltip>
                      </span>
                    ) : (
                      <span className="block text-right text-xs text-muted-foreground">
                        Edit on Cloudflare
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> DNS records
          </CardTitle>
          <CardDescription>
            {records.data
              ? `${records.data.length} ${records.data.length === 1 ? 'record' : 'records'} in ${zone.name}.`
              : `The records in ${zone.name}.`}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setPointing(true)}>
            <Server className="h-3.5 w-3.5" /> Point domain to a server
          </Button>
          <Button size="sm" onClick={() => setEditing(null)}>
            <Plus className="h-3.5 w-3.5" /> Add record
          </Button>
        </div>
      </CardHeader>
      <CardContent>{body}</CardContent>
      {editing !== undefined && (
        <RecordDialog
          key={editing?.id ?? 'new'}
          zone={zone}
          record={editing ?? undefined}
          open
          onOpenChange={(open) => {
            if (!open) setEditing(undefined);
          }}
        />
      )}
      {pointing && <PointDomainDialog zone={zone} open onOpenChange={setPointing} />}
    </Card>
  );
}
