import { hostOf, type VaultEntrySummary, type VaultFieldRef } from '@agentmat/core';
import { vaultErrorMessage } from '@shared/vaultErrors';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus,
  Pencil,
  Star,
  Tag,
  Trash2,
  TriangleAlert,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { relativeDate } from '@/lib/vault/relativeDate';
import { EntryAvatar } from './EntryAvatar';
import { ENTRY_TYPE_META } from './entryTypes';
import { SecretText } from './SecretText';
import type { useVaultActions } from './useVaultActions';

/** How long a revealed value stays on screen before it masks itself again. */
export const REVEAL_MS = 20_000;
const MASK = '••••••••••••';
const DAY = 86_400_000;

function refKey(ref: VaultFieldRef): string {
  return typeof ref === 'string' ? ref : `field:${ref.customFieldId}`;
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <SimpleTooltip label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Button>
    </SimpleTooltip>
  );
}

function FieldRow({
  label,
  children,
  actions,
  hint,
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
  hint?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="group flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 min-h-[1.5rem] break-words text-sm leading-6">{children}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-0.5 pt-2">{actions}</div>}
    </div>
  );
}

export function VaultDetailPane({
  entry,
  actions,
  onEdit,
  onTagClick,
  onBack,
}: {
  entry: VaultEntrySummary;
  actions: ReturnType<typeof useVaultActions>;
  onEdit: () => void;
  onTagClick: (tag: string) => void;
  onBack: () => void;
}): React.JSX.Element {
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  function hide(key: string): void {
    clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    setRevealed(({ [key]: _gone, ...rest }) => rest);
  }

  async function toggleReveal(ref: VaultFieldRef): Promise<void> {
    const key = refKey(ref);
    if (key in revealed) {
      hide(key);
      return;
    }
    try {
      const value = await window.agentmat.vault.reveal(entry.id, ref);
      setRevealed((current) => ({ ...current, [key]: value }));
      clearTimeout(timers.current.get(key));
      timers.current.set(
        key,
        setTimeout(() => hide(key), REVEAL_MS),
      );
    } catch (error) {
      toast.error('Could not show that value', { description: vaultErrorMessage(error) });
    }
  }

  function secretRow(ref: VaultFieldRef, label: string, hint?: ReactNode): React.JSX.Element {
    const key = refKey(ref);
    const shown = revealed[key];
    const name = label.toLowerCase();
    return (
      <FieldRow
        key={key}
        label={label}
        hint={hint}
        actions={
          <>
            <IconAction
              label={shown === undefined ? `Show ${name}` : `Hide ${name}`}
              onClick={() => void toggleReveal(ref)}
            >
              {shown === undefined ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </IconAction>
            <IconAction
              label={`Copy ${name}`}
              onClick={() => void actions.copy(entry.id, ref, label)}
            >
              <Copy className="h-3.5 w-3.5" />
            </IconAction>
          </>
        }
      >
        {shown === undefined ? (
          <span className="font-mono tracking-widest text-muted-foreground">{MASK}</span>
        ) : (
          <SecretText value={shown} />
        )}
      </FieldRow>
    );
  }

  function plainRow(value: string, label: string, ref: VaultFieldRef): React.JSX.Element {
    return (
      <FieldRow
        key={refKey(ref)}
        label={label}
        actions={
          <IconAction
            label={`Copy ${label.toLowerCase()}`}
            onClick={() => void actions.copy(entry.id, ref, label)}
          >
            <Copy className="h-3.5 w-3.5" />
          </IconAction>
        }
      >
        <span className="select-text">{value}</span>
      </FieldRow>
    );
  }

  const rows: React.JSX.Element[] = [];
  if (entry.type === 'login') {
    if (entry.username) rows.push(plainRow(entry.username, 'Username', 'username'));
    if (entry.hasPassword) {
      const age =
        entry.passwordUpdatedAt !== null ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            Changed {relativeDate(entry.passwordUpdatedAt)}
          </span>
        ) : undefined;
      rows.push(secretRow('password', 'Password', age));
    }
    if (entry.hasTotp) rows.push(secretRow('totpSecret', 'Authenticator key'));
  }
  if (entry.type === 'apiKey') {
    if (entry.service) {
      rows.push(
        <FieldRow key="service" label="Service">
          {entry.service}
        </FieldRow>,
      );
    }
    if (entry.keyId) rows.push(plainRow(entry.keyId, 'Key ID', 'keyId'));
    if (entry.hasSecret) rows.push(secretRow('secret', 'Secret'));
    if (entry.expiresAt !== null) {
      const expired = entry.expiresAt < Date.now();
      const soon = !expired && entry.expiresAt - Date.now() < 14 * DAY;
      rows.push(
        <FieldRow key="expires" label="Expires">
          <span
            className={cn((expired || soon) && 'inline-flex items-center gap-1.5 text-warning')}
          >
            {(expired || soon) && <TriangleAlert className="h-3 w-3" />}
            {new Date(entry.expiresAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
            <span className="text-muted-foreground">
              {' '}
              ({expired ? 'expired ' : ''}
              {relativeDate(entry.expiresAt)})
            </span>
          </span>
        </FieldRow>,
      );
    }
  }
  if (entry.type === 'login' || entry.type === 'apiKey') {
    for (const [index, url] of entry.urls.entries()) {
      const host = hostOf(url) || url;
      rows.push(
        <FieldRow
          key={`url-${index}`}
          label={entry.urls.length > 1 ? `Website ${index + 1}` : 'Website'}
          actions={
            <IconAction
              label={`Open ${host}`}
              onClick={() => void window.agentmat.shell.openExternal(url)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </IconAction>
          }
        >
          <span className="text-muted-foreground">{url}</span>
        </FieldRow>,
      );
    }
  }
  if (entry.type === 'custom') {
    for (const field of entry.fields) {
      const ref = { customFieldId: field.id };
      if (field.concealed) {
        if (field.hasValue) rows.push(secretRow(ref, field.label));
      } else {
        rows.push(plainRow(field.value ?? '', field.label, ref));
      }
    }
  }

  const notesShown = revealed.notes;
  const typeMeta = ENTRY_TYPE_META[entry.type];

  return (
    <section aria-label={entry.title} className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start gap-4 border-b border-border/70 px-6 py-5">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 h-8 w-8 @3xl/vault:hidden"
          aria-label="Back to the list"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <EntryAvatar entry={entry} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-7">{entry.title}</h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <typeMeta.icon className="h-3 w-3" />
            <span>{typeMeta.label}</span>
            {entry.host && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{entry.host}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconAction
            label={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => void actions.setFavorite(entry.id, !entry.favorite)}
          >
            <Star className={cn('h-3.5 w-3.5', entry.favorite && 'text-warning')} />
          </IconAction>
          <IconAction label="Duplicate" onClick={() => void actions.duplicate(entry.id)}>
            <FilePlus className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction label="Delete" onClick={() => void actions.remove(entry)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconAction>
          <Button variant="outline" size="sm" className="ml-1.5" onClick={onEdit}>
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {rows.length > 0 && (
          <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card/40">
            {rows}
          </div>
        )}

        {entry.hasNotes && (
          <div className="rounded-xl border border-border/70 bg-card/40">
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="text-xs text-muted-foreground">
                {entry.type === 'note' ? 'Note' : 'Notes'}
              </p>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs"
                  aria-label={notesShown === undefined ? 'Show notes' : 'Hide notes'}
                  onClick={() => void toggleReveal('notes')}
                >
                  {notesShown === undefined ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                  {notesShown === undefined ? 'Show' : 'Hide'}
                </Button>
                <IconAction
                  label="Copy notes"
                  onClick={() => void actions.copy(entry.id, 'notes', 'Notes')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </IconAction>
              </div>
            </div>
            <div className="border-t border-border/60 px-4 py-3 text-sm">
              {notesShown === undefined ? (
                <p className="text-muted-foreground">Hidden. Notes often hold recovery codes.</p>
              ) : (
                <p className="whitespace-pre-wrap break-words">{notesShown}</p>
              )}
            </div>
          </div>
        )}

        {entry.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag className="mr-1 h-3 w-3 text-muted-foreground" />
            {entry.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs hover:border-primary/40 hover:bg-primary/10"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Created {relativeDate(entry.createdAt)} · Updated {relativeDate(entry.updatedAt)}
          {entry.lastUsedAt !== null && ` · Last used ${relativeDate(entry.lastUsedAt)}`}
        </p>
      </div>
    </section>
  );
}
