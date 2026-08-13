import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clampDesktopPetScale, isAnimatedPetFile, normalizeDesktopPetActionSpeeds, normalizeDesktopPetId, petBoxSize } from '@agentmat/core';
import type { PetPipelineMessage, PetWorkArea } from '@shared/pet';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';
import { chuteFitFor, resolvePet, ropeGripYFor } from './characters';
import { CARD_H, CARD_W, placeTokenCard, PetTokenCard } from './PetTokenCard';
import { PetChute } from './PetChute';
import {
  applyBox,
  clampActor,
  hopActor,
  spawnCompanion,
  stepCompanion,
  type ActionSpeeds,
  type Actor,
  type Stage,
} from './flock';

function speedsFromSettings(value: unknown): ActionSpeeds {
  const pct = normalizeDesktopPetActionSpeeds(value);
  return {
    walk: pct.walk / 100,
    climb: pct.climb / 100,
    descend: pct.descend / 100,
    parachute: pct.parachute / 100,
  };
}

function stageFromArea(area: PetWorkArea): Stage {
  return { width: area.width, height: area.height };
}


function snapshot(actor: Actor): Actor {
  return { ...actor, rope: actor.rope ? { ...actor.rope } : null };
}

const SPEECH_W = 220;
const SPEECH_H = 96;

function speechRectFor(
  actor: Actor,
  area: PetWorkArea,
): { x: number; y: number; w: number; h: number; below: boolean } {
  const below = actor.y < 102;
  const x = Math.min(Math.max(8, actor.x + actor.box / 2 - SPEECH_W / 2), Math.max(8, area.width - SPEECH_W - 8));
  const y = below ? actor.y + actor.box + 8 : Math.max(8, actor.y - SPEECH_H - 10);
  return { x, y, w: SPEECH_W, h: SPEECH_H, below };
}

/**
 * Full-screen transparent overlay for the chosen companion. Clicks pass through
 * empty space. Click the character for a token report.
 */
export default function DesktopPetRoute(): React.JSX.Element {
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => window.agentmat.settings.get(),
  });
  const customImages = useQuery({
    queryKey: queryKeys.petCustomImages,
    queryFn: () => window.agentmat.pet.customDataUrls(),
  });

  const customs = settingsQuery.data?.desktopPetCustoms ?? [];
  const characterId = normalizeDesktopPetId(
    settingsQuery.data?.desktopPetCharacterId,
    customs.map((pet) => pet.id),
  );
  const canMove = settingsQuery.data?.desktopPetCanMove !== false;
  const canClimb = settingsQuery.data?.desktopPetCanClimb !== false;
  const canParachute = settingsQuery.data?.desktopPetCanParachute === true;
  const actionSpeeds = speedsFromSettings(settingsQuery.data?.desktopPetActionSpeeds);
  const scale = clampDesktopPetScale(settingsQuery.data?.desktopPetScale);
  const box = petBoxSize(scale);
  const custom = customs.find((item) => item.id === characterId);
  const pet = resolvePet(
    characterId,
    custom && customImages.data?.[custom.id]
      ? {
          name: custom.name,
          src: customImages.data[custom.id],
          animated: isAnimatedPetFile(custom.fileName),
        }
      : null,
  );
  const spriteH = pet ? Math.round(pet.height * (scale / 100)) : box;
  const ropeGripY = pet ? ropeGripYFor(pet) : 0.5;
  const chuteFit = pet ? chuteFitFor(pet) : null;

  const [actor, setActor] = useState<Actor | null>(null);
  const [drawn, setDrawn] = useState({ w: 0, h: spriteH });
  const [open, setOpen] = useState(false);
  const [speech, setSpeech] = useState<PetPipelineMessage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cardSize, setCardSize] = useState({ w: CARD_W, h: CARD_H });
  const actorRef = useRef<Actor | null>(null);
  const areaRef = useRef<PetWorkArea>({ x: 0, y: 0, width: 0, height: 0 });
  const openRef = useRef(false);
  const speechRef = useRef<PetPipelineMessage | null>(null);
  const speechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const hitRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const spriteRef = useRef<HTMLImageElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ropeRef = useRef<HTMLDivElement>(null);
  const speechElRef = useRef<HTMLDivElement>(null);
  const spriteHRef = useRef(spriteH);
  const configRef = useRef({
    canMove,
    canClimb,
    canParachute,
    box,
    characterId,
    spriteH,
    ropeGripY,
    speeds: actionSpeeds,
  });

  openRef.current = open;
  speechRef.current = speech;
  configRef.current = {
    canMove,
    canClimb,
    canParachute,
    box,
    characterId,
    spriteH: spriteHRef.current,
    ropeGripY,
    speeds: actionSpeeds,
  };

  function applyPose(current: Actor): void {
    const body = bodyRef.current;
    if (body) {
      body.style.left = `${current.x}px`;
      body.style.top = `${current.y}px`;
      body.style.width = `${current.box}px`;
      body.style.height = `${current.box}px`;
    }
    const rope = ropeRef.current;
    if (rope && current.rope) {
      const top = Math.min(current.rope.fromY, current.rope.toY);
      rope.style.left = `${current.rope.x}px`;
      rope.style.top = `${top}px`;
      rope.style.height = `${Math.max(8, Math.abs(current.rope.toY - current.rope.fromY))}px`;
    }
    const bubble = speechElRef.current;
    if (bubble) {
      const rect = speechRectFor(current, areaRef.current);
      bubble.style.left = `${rect.x}px`;
      bubble.style.top = `${rect.y}px`;
      bubble.classList.toggle('is-below', rect.below);
      bubble.classList.toggle('is-above', !rect.below);
    }
  }

  function hitSpeech(clientX: number, clientY: number): boolean {
    if (!speechRef.current || !actorRef.current) return false;
    const rect = speechRectFor(actorRef.current, areaRef.current);
    return (
      clientX >= rect.x &&
      clientX <= rect.x + rect.w &&
      clientY >= rect.y &&
      clientY <= rect.y + rect.h
    );
  }

  function measureSprite(img: HTMLImageElement | null): void {
    if (!img) return;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    const elW = img.clientWidth || box;
    const elH = img.clientHeight || spriteH;
    const fit = natW > 0 && natH > 0 ? Math.min(elW / natW, elH / natH) : 1;
    const nextH = Math.max(8, natH > 0 ? natH * fit : spriteH);
    const nextW = Math.max(8, natW > 0 ? natW * fit : nextH);
    spriteHRef.current = nextH;
    configRef.current = { ...configRef.current, spriteH: nextH, ropeGripY };
    setDrawn((prev) =>
      Math.abs(prev.w - nextW) < 0.5 && Math.abs(prev.h - nextH) < 0.5 ? prev : { w: nextW, h: nextH },
    );
  }

  useLayoutEffect(() => {
    spriteHRef.current = spriteH;
    configRef.current = { ...configRef.current, spriteH, ropeGripY };
    setDrawn({ w: 0, h: spriteH });
    measureSprite(spriteRef.current);
  }, [characterId, spriteH, box, pet?.src, ropeGripY]);

  useLayoutEffect(() => {
    if (actorRef.current) applyPose(actorRef.current);
  });

  useEffect(() => {
    if (open) window.agentmat.pet.setClickThrough(false);
    if (!open) setCardSize({ w: CARD_W, h: CARD_H });
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const node = cardRef.current;
    if (!node) return;
    const target: HTMLDivElement = node;
    function apply(): void {
      const rect = target.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return;
      setCardSize((prev) =>
        prev.w === Math.ceil(rect.width) && prev.h === Math.ceil(rect.height)
          ? prev
          : { w: Math.ceil(rect.width), h: Math.ceil(rect.height) },
      );
    }
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(target);
    return () => observer.disconnect();
  }, [open, characterId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-widget', '');
    return () => document.documentElement.removeAttribute('data-widget');
  }, []);

  useEffect(() => {
    return window.agentmat.pet.onSettingsChanged(() => {
      void settingsQuery.refetch();
      void customImages.refetch();
    });
  }, [settingsQuery, customImages]);

  useEffect(() => {
    return window.agentmat.pet.onPipelineMessage((payload) => {
      setSpeech(payload);
      const current = actorRef.current;
      if (current) {
        hopActor(current, performance.now());
        setActor(snapshot(current));
      }
      if (speechTimer.current) clearTimeout(speechTimer.current);
      speechTimer.current = setTimeout(() => setSpeech(null), 8000);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (speechTimer.current) clearTimeout(speechTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let lastTs = 0;
    let poseKey = '';

    function sync(next: Actor, force = false): void {
      actorRef.current = next;
      applyPose(next);
      const key = `${next.action}:${next.facing}:${next.rope ? 1 : 0}:${next.box}:${next.id}`;
      if (!force && key === poseKey) return;
      poseKey = key;
      setActor(snapshot(next));
    }

    async function boot(): Promise<void> {
      const [area, settings] = await Promise.all([
        window.agentmat.pet.getWorkArea(),
        window.agentmat.settings.get(),
      ]);
      if (cancelled) return;
      areaRef.current = area;
      const characterId = normalizeDesktopPetId(
        settings.desktopPetCharacterId,
        (settings.desktopPetCustoms ?? []).map((pet) => pet.id),
      );
      const canMove = settings.desktopPetCanMove !== false;
      const box = petBoxSize(clampDesktopPetScale(settings.desktopPetScale));
      configRef.current = {
        ...configRef.current,
        canMove,
        canClimb: settings.desktopPetCanClimb !== false,
        canParachute: settings.desktopPetCanParachute === true,
        speeds: speedsFromSettings(settings.desktopPetActionSpeeds),
        box,
        characterId,
      };
      sync(spawnCompanion(stageFromArea(area), characterId, box, canMove), true);
      lastTs = 0;
      frame = requestAnimationFrame(tick);
    }

    function tick(ts: number): void {
      if (cancelled) return;
      frame = requestAnimationFrame(tick);
      const dt = lastTs === 0 ? 0 : Math.min(0.1, (ts - lastTs) / 1000);
      lastTs = ts;
      const current = actorRef.current;
      if (!current || dt === 0) return;
      const cfg = configRef.current;
      if (current.id !== cfg.characterId) current.id = cfg.characterId;
      applyBox(current, stageFromArea(areaRef.current), cfg.box);
      const paused = openRef.current || dragRef.current !== null;
      stepCompanion(current, stageFromArea(areaRef.current), dt, ts, paused, cfg);
      sync(current);
    }

    void boot();
    const unsubscribe = window.agentmat.pet.onDisplayChanged((area) => {
      areaRef.current = area;
      if (actorRef.current) {
        clampActor(actorRef.current, stageFromArea(area));
        sync(actorRef.current);
      }
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      unsubscribe();
      window.agentmat.pet.setClickThrough(true);
    };
  }, []);

  function setHit(next: boolean): void {
    if (hitRef.current === next) return;
    hitRef.current = next;
    window.agentmat.pet.setClickThrough(!next);
  }

  function hitTest(clientX: number, clientY: number): boolean {
    const current = actorRef.current;
    if (!current) return false;
    return (
      clientX >= current.x &&
      clientX <= current.x + current.box &&
      clientY >= current.y &&
      clientY <= current.y + current.box
    );
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return;
    const current = actorRef.current;
    if (hitSpeech(event.clientX, event.clientY)) {
      setSpeech(null);
      if (speechTimer.current) clearTimeout(speechTimer.current);
      return;
    }
    if (!current || !hitTest(event.clientX, event.clientY)) {
      setOpen(false);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      dx: event.clientX - current.x,
      dy: event.clientY - current.y,
      moved: false,
    };
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    const current = actorRef.current;
    if (!drag) {
      setHit(hitTest(event.clientX, event.clientY) || hitSpeech(event.clientX, event.clientY) || openRef.current);
      return;
    }
    if (!current) return;
    const x = event.clientX - drag.dx;
    const y = event.clientY - drag.dy;
    if (Math.abs(x - current.x) > 3 || Math.abs(y - current.y) > 3) drag.moved = true;
    current.x = x;
    current.y = y;
    current.vx = 0;
    clampActor(current, stageFromArea(areaRef.current));
    applyPose(current);
    setActor(snapshot(current));
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current;
    if (!drag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const current = actorRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!current) return;
    if (!drag.moved) {
      setOpen((value) => !value);
      hopActor(current, performance.now());
      return;
    }
    current.rope = null;
    current.action = 'idle';
    current.nextAt = configRef.current.canMove
      ? performance.now() + 2800 + Math.random() * 6000
      : performance.now() + 60_000;
  }

  const placement = actor
    ? placeTokenCard(
        actor.x,
        actor.y,
        actor.box,
        areaRef.current.width,
        areaRef.current.height,
        cardSize.w,
        cardSize.h,
      )
      : null;

  const bubble = actor && speech ? speechRectFor(actor, areaRef.current) : null;
  const bubbleBelow = bubble?.below ?? false;

  const chute =
    actor && chuteFit && actor.action === 'parachute'
      ? {
          box: actor.box,
          spriteW: drawn.w || Math.round((drawn.h || spriteH) * 0.85),
          spriteH: drawn.h || spriteH,
          fit: chuteFit,
        }
      : null;

  return (
    <div
      className="desktop-pet-stage relative h-full w-full overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      {actor?.rope ? (
        <div
          ref={ropeRef}
          className="pet-rope"
          style={{
            left: actor.rope.x,
            top: Math.min(actor.rope.fromY, actor.rope.toY),
            height: Math.max(8, Math.abs(actor.rope.toY - actor.rope.fromY)),
          }}
          aria-hidden
        >
          <span className="pet-rope-cord" />
          <span className="pet-rope-hook is-start" />
          <span className="pet-rope-hook is-end" />
        </div>
      ) : null}

      {actor && pet ? (
        <div
          ref={bodyRef}
          data-pet-hit="sprite"
          className={cn(
            'desktop-pet-body',
            actor.facing === 'left' && 'is-left',
            actor.action === 'turn' && 'is-turning',
            actor.action === 'parachute' && 'is-chute',
            dragging && 'is-dragging',
          )}
          style={{ left: actor.x, top: actor.y, width: actor.box, height: actor.box }}
        >
          <div className={cn('pet-rig', actor.action === 'parachute' && 'is-chute')}>
            {chute ? <PetChute layer="back" {...chute} /> : null}
            <span className="desktop-pet-shadow" aria-hidden />
            <img
              ref={spriteRef}
              src={pet.src}
              alt={pet.name}
              draggable={false}
              style={{
                height: spriteH,
                ['--pet-gait' as string]: `${(0.78 / actionSpeeds.walk).toFixed(2)}s`,
                ['--pet-climb-gait' as string]: `${(0.92 / actionSpeeds.climb).toFixed(2)}s`,
                ['--pet-hang-gait' as string]: `${(1.15 / actionSpeeds.descend).toFixed(2)}s`,
              }}
              onLoad={(event) => measureSprite(event.currentTarget)}
              className={cn(
                'desktop-pet-sprite',
                !pet.animated && (actor.action === 'walk' || actor.action === 'walk-top') && 'is-walk',
                !pet.animated && actor.action === 'idle' && 'is-idle',
                !pet.animated && actor.action === 'hop' && 'is-hop',
                !pet.animated && actor.action === 'climb' && 'is-climb',
                !pet.animated && actor.action === 'rappel' && 'is-hang',
                !pet.animated && (actor.action === 'rope-drop' || actor.action === 'throw') && 'is-wait',
              )}
            />
            {chute ? <PetChute layer="front" {...chute} /> : null}
          </div>
        </div>
      ) : null}

      {bubble && speech ? (
        <div
          ref={speechElRef}
          className={cn('pet-speech', bubbleBelow ? 'is-below' : 'is-above', speech.kind === 'fail' ? 'is-fail' : 'is-pass')}
          style={{ left: bubble.x, top: bubble.y, width: bubble.w }}
        >
          <p className="pet-speech-name">{speech.petName}</p>
          <p className="pet-speech-text">{speech.text}</p>
        </div>
      ) : null}

      {open && actor && placement && pet ? (
        <div
          ref={cardRef}
          className="absolute z-20"
          style={{ left: placement.left, top: placement.top }}
        >
          <PetTokenCard pet={pet} side={placement.side} onClose={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
