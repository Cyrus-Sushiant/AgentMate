import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  DESKTOP_PET_CLICK_AREA_MAX,
  DESKTOP_PET_CLICK_AREA_MIN,
  DESKTOP_PET_SCALE_MAX,
  DESKTOP_PET_SCALE_MIN,
  DESKTOP_PET_SPEED_MAX,
  DESKTOP_PET_SPEED_MIN,
  clampDesktopPetClickArea,
  clampDesktopPetSpeed,
  isAnimatedPetFile,
  normalizeDesktopPetActionSpeeds,
  type AppSettings,
  type DesktopPetActionSpeeds,
} from '@agentmat/core';
import { Paw, Plus, Trash2 } from '@/components/icons';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { confirmDialog } from '@/stores/confirmStore';
import { PET_CHARACTERS } from './characters';

export function CompanionSettings({
  settings,
}: {
  settings: AppSettings;
}): React.JSX.Element {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => window.agentmat.settings.update(patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  const customImages = useQuery({
    queryKey: queryKeys.petCustomImages,
    queryFn: () => window.agentmat.pet.customDataUrls(),
  });

  const pending = save.isPending;
  const canMove = settings.desktopPetCanMove !== false;
  const canClimb = settings.desktopPetCanClimb !== false;
  const canParachute = settings.desktopPetCanParachute === true;
  const [scale, setScale] = useState(settings.desktopPetScale);
  const scaleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clickArea, setClickArea] = useState(() =>
    clampDesktopPetClickArea(settings.desktopPetClickArea),
  );
  const clickAreaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [speeds, setSpeeds] = useState(() => normalizeDesktopPetActionSpeeds(settings.desktopPetActionSpeeds));
  const speedTimers = useRef<Partial<Record<keyof DesktopPetActionSpeeds, ReturnType<typeof setTimeout>>>>({});
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    setScale(settings.desktopPetScale);
  }, [settings.desktopPetScale]);

  useEffect(() => {
    setClickArea(clampDesktopPetClickArea(settings.desktopPetClickArea));
  }, [settings.desktopPetClickArea]);

  useEffect(() => {
    setSpeeds(normalizeDesktopPetActionSpeeds(settings.desktopPetActionSpeeds));
  }, [settings.desktopPetActionSpeeds]);

  useEffect(() => {
    return () => {
      if (scaleTimer.current) clearTimeout(scaleTimer.current);
      if (clickAreaTimer.current) clearTimeout(clickAreaTimer.current);
      for (const timer of Object.values(speedTimers.current)) {
        if (timer) clearTimeout(timer);
      }
    };
  }, []);

  function commitScale(next: number): void {
    setScale(next);
    if (scaleTimer.current) clearTimeout(scaleTimer.current);
    scaleTimer.current = setTimeout(() => {
      save.mutate({ desktopPetScale: next });
    }, 160);
  }

  function commitClickArea(next: number): void {
    const value = clampDesktopPetClickArea(next);
    setClickArea(value);
    if (clickAreaTimer.current) clearTimeout(clickAreaTimer.current);
    clickAreaTimer.current = setTimeout(() => {
      save.mutate({ desktopPetClickArea: value });
    }, 160);
  }

  function commitSpeed(key: keyof DesktopPetActionSpeeds, next: number): void {
    const value = clampDesktopPetSpeed(next);
    setSpeeds((prev) => {
      const patch = { ...prev, [key]: value };
      const timers = speedTimers.current;
      if (timers[key]) clearTimeout(timers[key]);
      timers[key] = setTimeout(() => {
        save.mutate({ desktopPetActionSpeeds: patch });
      }, 160);
      return patch;
    });
  }

  async function handleAddPet(): Promise<void> {
    setImporting(true);
    try {
      const pet = await window.agentmat.pet.importCustom();
      if (!pet) return;
      toast.success(`${pet.name} is on the list.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.petCustomImages });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add that pet.');
    } finally {
      setImporting(false);
    }
  }

  async function handleRemovePet(id: string, name: string): Promise<void> {
    const confirmed = await confirmDialog({
      title: `Remove ${name}?`,
      description: 'This deletes the copy AgentMate saved. Your original file is left alone.',
      confirmLabel: 'Remove',
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      await window.agentmat.pet.removeCustom(id);
      toast.success(`${name} was removed.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      void queryClient.invalidateQueries({ queryKey: queryKeys.petCustomImages });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove that pet.');
    }
  }

  const customs = settings.desktopPetCustoms ?? [];

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Paw className="h-4 w-4" />
            </div>
            <div className="min-w-0 space-y-1">
              <CardTitle>My AI Pet</CardTitle>
              <CardDescription>
                One character on your screen. Click it for a token report. Drag it to place it.
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={settings.desktopPetEnabled}
            onCheckedChange={(enabled) => save.mutate({ desktopPetEnabled: enabled })}
            disabled={pending}
            aria-label="Show my AI pet"
          />
        </CardHeader>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Character</CardTitle>
          <CardDescription>
            Pick one, or add your own PNG, GIF, or WebP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {customs.map((custom) => {
              const active = settings.desktopPetCharacterId === custom.id;
              const src = customImages.data?.[custom.id];
              return (
                <div
                  key={custom.id}
                  className={cn(
                    'relative rounded-lg border p-3 text-left transition-all duration-150',
                    active
                      ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/40'
                      : 'border-border bg-background/40 hover:border-foreground/20 hover:bg-accent/40',
                  )}
                >
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => save.mutate({ desktopPetCharacterId: custom.id })}
                    className="w-full cursor-pointer text-left"
                    aria-pressed={active}
                  >
                    <div className="flex h-20 items-end justify-center">
                      {src ? (
                        <img
                          src={src}
                          alt=""
                          className="desktop-pet-sprite max-h-[4.5rem] w-auto max-w-full object-contain object-bottom"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Loading…</span>
                      )}
                    </div>
                    <p className="mt-2 truncate pr-5 text-sm font-medium">{custom.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isAnimatedPetFile(custom.fileName) ? 'Your animated pet' : 'Your pet'}
                    </p>
                  </button>
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    aria-label={`Remove ${custom.name}`}
                    onClick={() => void handleRemovePet(custom.id, custom.name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

            {PET_CHARACTERS.map((pet) => {
              const active = settings.desktopPetCharacterId === pet.id;
              return (
                <button
                  key={pet.id}
                  type="button"
                  disabled={pending}
                  onClick={() => save.mutate({ desktopPetCharacterId: pet.id })}
                  className={cn(
                    'cursor-pointer rounded-lg border p-3 text-left transition-all duration-150',
                    active
                      ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/40'
                      : 'border-border bg-background/40 hover:border-foreground/20 hover:bg-accent/40',
                  )}
                  aria-pressed={active}
                >
                  <div className="flex h-20 items-end justify-center">
                    <img
                      src={pet.src}
                      alt=""
                      className={cn(
                        'desktop-pet-sprite max-h-[4.5rem] w-auto max-w-full object-contain object-bottom',
                        !pet.animated && 'is-idle',
                      )}
                    />
                  </div>
                  <p className="mt-2 text-sm font-medium">{pet.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{pet.blurb}</p>
                </button>
              );
            })}

            <button
              type="button"
              disabled={pending || importing}
              onClick={() => void handleAddPet()}
              className="flex min-h-[8.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/20 p-3 text-center text-muted-foreground transition-all duration-150 hover:border-foreground/20 hover:bg-accent/40 hover:text-foreground"
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm font-medium text-foreground">Add your pet</span>
              <span className="text-xs">PNG, GIF, or WebP</span>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Motion</CardTitle>
          <CardDescription>
            Leave it parked, or let it wander. Climbing and how it comes back down are optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="pet-move">Wander the screen</Label>
              <p className="text-xs text-muted-foreground">
                Off keeps it still. On, it walks, then often just stands there for a while.
              </p>
            </div>
            <Switch
              id="pet-move"
              checked={canMove}
              onCheckedChange={(enabled) => save.mutate({ desktopPetCanMove: enabled })}
              disabled={pending}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="pet-climb">Can climb to the top</Label>
              <p className="text-xs text-muted-foreground">
                A rope drops, it climbs, walks the top edge, then comes back down.
              </p>
            </div>
            <Switch
              id="pet-climb"
              checked={canClimb}
              onCheckedChange={(enabled) => save.mutate({ desktopPetCanClimb: enabled })}
              disabled={pending}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="pet-chute">Come down with a parachute</Label>
              <p className="text-xs text-muted-foreground">
                After the top edge, it opens a chute and floats down instead of rappelling.
              </p>
            </div>
            <Switch
              id="pet-chute"
              checked={canParachute}
              onCheckedChange={(enabled) => save.mutate({ desktopPetCanParachute: enabled })}
              disabled={pending || !canClimb}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Action speed</CardTitle>
          <CardDescription>
            100% is the usual pace. Lower is slower, higher is faster.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SpeedRow
            id="pet-speed-walk"
            label="Walking"
            hint="Across the floor and along the top edge."
            value={speeds.walk}
            disabled={pending || !canMove}
            onChange={(next) => commitSpeed('walk', next)}
          />
          <SpeedRow
            id="pet-speed-climb"
            label="Climbing"
            hint="Up the rope to the top of the screen."
            value={speeds.climb}
            disabled={pending || !canClimb}
            onChange={(next) => commitSpeed('climb', next)}
          />
          <SpeedRow
            id="pet-speed-descend"
            label="Rappelling"
            hint="Coming down the rope."
            value={speeds.descend}
            disabled={pending || !canClimb || canParachute}
            onChange={(next) => commitSpeed('descend', next)}
          />
          <SpeedRow
            id="pet-speed-chute"
            label="Parachute"
            hint="How quickly it floats down under the chute."
            value={speeds.parachute}
            disabled={pending || !canClimb || !canParachute}
            onChange={(next) => commitSpeed('parachute', next)}
          />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
          <CardDescription>
            The pet can speak up when a watched GitHub Actions run finishes, or when the internet changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="pet-pipeline-fail">Tell me when a pipeline fails</Label>
              <p className="text-xs text-muted-foreground">
                A short message appears next to the pet. Failures also land in Notifications.
              </p>
            </div>
            <Switch
              id="pet-pipeline-fail"
              checked={settings.desktopPetPipelineOnFail === true}
              onCheckedChange={(enabled) => save.mutate({ desktopPetPipelineOnFail: enabled })}
              disabled={pending || !settings.desktopPetEnabled}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="pet-pipeline-pass">Tell me when a pipeline passes</Label>
              <p className="text-xs text-muted-foreground">
                Same idea, for green runs on workflows you connected.
              </p>
            </div>
            <Switch
              id="pet-pipeline-pass"
              checked={settings.desktopPetPipelineOnPass === true}
              onCheckedChange={(enabled) => save.mutate({ desktopPetPipelineOnPass: enabled })}
              disabled={pending || !settings.desktopPetEnabled}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="pet-network-quality">Tell me when internet quality changes</Label>
              <p className="text-xs text-muted-foreground">
                A short message next to the pet if the connection drops, comes back, or clearly gets better or worse.
              </p>
            </div>
            <Switch
              id="pet-network-quality"
              checked={settings.desktopPetNetworkQuality === true}
              onCheckedChange={(enabled) => save.mutate({ desktopPetNetworkQuality: enabled })}
              disabled={pending || !settings.desktopPetEnabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Size</CardTitle>
          <CardDescription>How large it appears on the desktop, and how much of the picture counts as the character.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <RangeControl
            id="pet-scale"
            min={DESKTOP_PET_SCALE_MIN}
            max={DESKTOP_PET_SCALE_MAX}
            step={5}
            value={scale}
            disabled={pending}
            label="Display size"
            hint="How large the pet looks on screen."
            valueLabel={`${scale}%`}
            lowLabel="Small"
            highLabel="Large"
            onChange={commitScale}
          />
          <RangeControl
            id="pet-click-area"
            min={DESKTOP_PET_CLICK_AREA_MIN}
            max={DESKTOP_PET_CLICK_AREA_MAX}
            step={5}
            value={clickArea}
            disabled={pending}
            label="Click area"
            hint="Turn this down if the file has empty space around the character. Clicks and the token card follow the smaller area."
            valueLabel={`${clickArea}%`}
            lowLabel="Tight"
            highLabel="Wide"
            onChange={commitClickArea}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SpeedRow({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  disabled: boolean;
  onChange: (next: number) => void;
}): React.JSX.Element {
  return (
    <RangeControl
      id={id}
      min={DESKTOP_PET_SPEED_MIN}
      max={DESKTOP_PET_SPEED_MAX}
      step={5}
      value={value}
      disabled={disabled}
      label={label}
      hint={hint}
      valueLabel={`${value}%`}
      lowLabel="Slow"
      highLabel="Fast"
      onChange={onChange}
    />
  );
}

function RangeControl({
  id,
  min,
  max,
  step,
  value,
  disabled,
  label,
  hint,
  valueLabel,
  lowLabel,
  highLabel,
  ariaLabel,
  onChange,
}: {
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled: boolean;
  label?: string;
  hint?: string;
  valueLabel: string;
  lowLabel: string;
  highLabel: string;
  ariaLabel?: string;
  onChange: (next: number) => void;
}): React.JSX.Element {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor={id}>{label}</Label>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          <span className="inline-flex h-6 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md bg-muted px-1.5 font-mono text-xs tabular-nums text-foreground">
            {valueLabel}
          </span>
        </div>
      ) : null}
      <div className="flex items-center gap-2.5">
        <span className="w-9 shrink-0 text-[11px] leading-none text-muted-foreground">{lowLabel}</span>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={ariaLabel ?? label}
          style={{ ['--range-pct' as string]: `${pct}%` }}
          className="settings-range min-w-0 flex-1"
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span className="w-9 shrink-0 text-right text-[11px] leading-none text-muted-foreground">
          {highLabel}
        </span>
        {label ? null : (
          <span className="inline-flex h-6 min-w-[2.75rem] shrink-0 items-center justify-center rounded-md bg-muted px-1.5 font-mono text-xs tabular-nums text-foreground">
            {valueLabel}
          </span>
        )}
      </div>
    </div>
  );
}
