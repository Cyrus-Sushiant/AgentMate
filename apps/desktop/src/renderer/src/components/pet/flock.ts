import type { PetId } from './characters';

export type Facing = 'left' | 'right';
export type PetAction =
  | 'idle'
  | 'walk'
  | 'turn'
  | 'rope-drop'
  | 'climb'
  | 'walk-top'
  | 'throw'
  | 'rappel'
  | 'parachute'
  | 'hop';

export interface RopeState {
  x: number;
  fromY: number;
  toY: number;
}

export interface Actor {
  id: PetId;
  x: number;
  y: number;
  vx: number;
  facing: Facing;
  action: PetAction;
  rope: RopeState | null;
  nextAt: number;
  hopUntil: number;
  walkStartedAt: number;
  walkUntil: number;
  cruise: number;
  box: number;
  climbFrom: number;
  climbTo: number;
  climbStartedAt: number;
  climbMs: number;
  ropeFrom: number;
  ropeTo: number;
  ropeStartedAt: number;
  ropeMs: number;
  anchorX: number;
  /** Earliest time another climb can start after a descent. */
  climbCoolUntil: number;
}

export interface Stage {
  width: number;
  height: number;
}

export interface ActionSpeeds {
  walk: number;
  climb: number;
  descend: number;
  parachute: number;
}

export interface MotionConfig {
  canMove: boolean;
  canClimb: boolean;
  canParachute: boolean;
  box: number;
  /** Drawn sprite height. Sprites sit at the bottom of `box`, so this is often smaller. */
  spriteH: number;
  /** 0-1 from the top of the drawn sprite; where the hands meet the rope. */
  ropeGripY: number;
  /** Multipliers, 0.4 to 2. 1 is the default pace. */
  speeds: ActionSpeeds;
}

const DEFAULT_SPEEDS: ActionSpeeds = { walk: 1, climb: 1, descend: 1, parachute: 1 };

const WALK_SPEED = 68;
const TOP_Y = 10;
const GAP = 8;
const TURN_MS = 560;
const HOP_MS = 560;
const EASE = 4.2;

const AERIAL: PetAction[] = ['rope-drop', 'climb', 'walk-top', 'throw', 'rappel', 'parachute'];

function speedMul(config: MotionConfig, key: keyof ActionSpeeds): number {
  return clamp(config.speeds?.[key] ?? DEFAULT_SPEEDS[key], 0.4, 2);
}

function scaleMs(base: number, floor: number, mul: number): number {
  return Math.max(floor, base / mul);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function bottomY(stage: Stage, box: number): number {
  return stage.height - box - GAP;
}

function maxX(stage: Stage, box: number): number {
  return Math.max(0, stage.width - box);
}

function pickWalkMs(): number {
  return rand(2200, 5200);
}

function pickIdleMs(): number {
  if (Math.random() < 0.22) return rand(7000, 14000);
  return rand(1800, 5000);
}

function pickLandMs(): number {
  return rand(8000, 18000);
}

function restOnFloor(actor: Actor, now: number): void {
  const rest = pickLandMs();
  actor.action = 'idle';
  actor.rope = null;
  actor.climbCoolUntil = now + rest;
  actor.nextAt = now + rest * 0.5;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function approach(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-EASE * dt));
}

function emptyActor(id: PetId, box: number): Actor {
  return {
    id,
    x: 0,
    y: 0,
    vx: 0,
    facing: 'right',
    action: 'idle',
    rope: null,
    nextAt: 0,
    hopUntil: 0,
    walkStartedAt: 0,
    walkUntil: 0,
    cruise: WALK_SPEED,
    box,
    climbFrom: 0,
    climbTo: 0,
    climbStartedAt: 0,
    climbMs: 1,
    ropeFrom: 0,
    ropeTo: 0,
    ropeStartedAt: 0,
    ropeMs: 1,
    anchorX: 0,
    climbCoolUntil: 0,
  };
}

export function spawnCompanion(stage: Stage, id: PetId, box: number, canMove: boolean): Actor {
  const actor = emptyActor(id, box);
  actor.x = clamp(stage.width / 2 - box / 2, 0, maxX(stage, box));
  actor.y = bottomY(stage, box);
  actor.action = canMove ? 'idle' : 'idle';
  actor.nextAt = performance.now() + (canMove ? rand(800, 2200) : 60_000);
  return actor;
}

export function clampActor(actor: Actor, stage: Stage): void {
  actor.x = clamp(actor.x, 0, maxX(stage, actor.box));
  actor.y = clamp(actor.y, TOP_Y, bottomY(stage, actor.box));
}

function startTurn(actor: Actor, next: Facing, now: number): void {
  actor.action = 'turn';
  actor.vx = 0;
  actor.nextAt = now + TURN_MS;
  actor.facing = next;
}

function startWalk(actor: Actor, now: number, top: boolean): void {
  actor.action = top ? 'walk-top' : 'walk';
  actor.walkStartedAt = now;
  actor.walkUntil = now + pickWalkMs();
  actor.nextAt = actor.walkUntil;
  actor.cruise = WALK_SPEED * rand(0.78, 1.08);
}

function handY(actor: Actor, config: MotionConfig): number {
  const spriteH = Math.max(8, config.spriteH || actor.box);
  const top = actor.y + actor.box - spriteH;
  return top + spriteH * clamp(config.ropeGripY, 0.2, 0.85);
}

function startRopeDrop(actor: Actor, now: number, config: MotionConfig): void {
  const x = actor.x + actor.box / 2;
  const target = handY(actor, config);
  actor.action = 'rope-drop';
  actor.vx = 0;
  actor.rope = { x, fromY: 0, toY: 0 };
  actor.ropeFrom = 0;
  actor.ropeTo = target;
  actor.ropeStartedAt = now;
  actor.ropeMs = scaleMs(Math.max(380, target * 1.15), 220, speedMul(config, 'climb'));
  actor.nextAt = now + actor.ropeMs + 80;
}

function startThrow(actor: Actor, stage: Stage, now: number, config: MotionConfig): void {
  const x = actor.x + actor.box / 2;
  const to = stage.height - GAP;
  actor.action = 'throw';
  actor.vx = 0;
  actor.rope = { x, fromY: 0, toY: 0 };
  actor.ropeFrom = 0;
  actor.ropeTo = to;
  actor.ropeStartedAt = now;
  actor.ropeMs = scaleMs(Math.max(420, to * 1.05), 280, speedMul(config, 'descend'));
  actor.nextAt = now + actor.ropeMs + 80;
}

function startClimb(actor: Actor, now: number, config: MotionConfig): void {
  actor.action = 'climb';
  actor.climbFrom = actor.y;
  actor.climbTo = TOP_Y;
  actor.climbStartedAt = now;
  actor.climbMs = scaleMs(Math.max(1100, (actor.y - TOP_Y) * 3.8), 480, speedMul(config, 'climb'));
}

function startRappel(actor: Actor, stage: Stage, now: number, config: MotionConfig): void {
  actor.action = 'rappel';
  actor.climbFrom = actor.y;
  actor.climbTo = bottomY(stage, actor.box);
  actor.climbStartedAt = now;
  actor.climbMs = scaleMs(
    Math.max(2200, (actor.climbTo - actor.y) * 5.4),
    900,
    speedMul(config, 'descend'),
  );
}

function startParachute(actor: Actor, stage: Stage, now: number, config: MotionConfig): void {
  actor.action = 'parachute';
  actor.rope = null;
  actor.vx = 0;
  actor.anchorX = actor.x;
  actor.climbFrom = actor.y;
  actor.climbTo = bottomY(stage, actor.box);
  actor.climbStartedAt = now;
  actor.climbMs = scaleMs(
    Math.max(3800, (actor.climbTo - actor.y) * 8.2),
    1600,
    speedMul(config, 'parachute'),
  );
}

function startDescend(actor: Actor, stage: Stage, now: number, config: MotionConfig): void {
  if (config.canParachute) startParachute(actor, stage, now, config);
  else startThrow(actor, stage, now, config);
}

function walkEnvelope(actor: Actor, now: number): number {
  const elapsed = (now - actor.walkStartedAt) / 1000;
  const remain = (actor.walkUntil - now) / 1000;
  const fadeIn = elapsed < 0.28 ? smoothstep(elapsed / 0.28) : 1;
  const fadeOut = remain < 0.34 ? smoothstep(remain / 0.34) : 1;
  return fadeIn * fadeOut;
}

export function applyBox(actor: Actor, stage: Stage, box: number): void {
  const cx = actor.x + actor.box / 2;
  actor.box = box;
  actor.x = cx - box / 2;
  clampActor(actor, stage);
}

export function stepCompanion(
  actor: Actor,
  stage: Stage,
  dt: number,
  now: number,
  paused: boolean,
  config: MotionConfig,
): void {
  applyBox(actor, stage, config.box);
  const floor = bottomY(stage, actor.box);
  const limitX = maxX(stage, actor.box);

  if (paused) {
    actor.vx = approach(actor.vx, 0, dt);
    actor.x += actor.vx * dt;
    if (actor.action !== 'idle' && actor.action !== 'hop' && actor.action !== 'turn') {
      actor.action = 'idle';
      actor.rope = null;
    }
    clampActor(actor, stage);
    return;
  }

  if (!config.canMove) {
    actor.vx = approach(actor.vx, 0, dt);
    actor.x += actor.vx * dt;
    if (AERIAL.includes(actor.action)) {
      actor.action = 'idle';
      actor.rope = null;
      actor.y = actor.y < stage.height / 2 ? TOP_Y : floor;
    } else if (actor.action === 'walk' || actor.action === 'walk-top' || actor.action === 'turn') {
      actor.action = 'idle';
    }
    actor.nextAt = now + 60_000;
    clampActor(actor, stage);
    return;
  }

  if (actor.nextAt > now + 45_000) {
    actor.nextAt = now + rand(500, 2200);
  }

  if (!config.canClimb && !AERIAL.includes(actor.action) && actor.y <= TOP_Y + 12) {
    startDescend(actor, stage, now, config);
  }

  switch (actor.action) {
    case 'walk':
    case 'walk-top': {
      const dir = actor.facing === 'right' ? 1 : -1;
      const target = dir * actor.cruise * walkEnvelope(actor, now) * speedMul(config, 'walk');
      actor.vx = approach(actor.vx, target, dt);
      actor.x += actor.vx * dt;
      actor.y = actor.action === 'walk-top' ? TOP_Y : floor;

      const nearLeft = actor.x <= 12;
      const nearRight = actor.x >= limitX - 12;
      if (nearLeft && dir < 0) {
        actor.x = 0;
        startTurn(actor, 'right', now);
        break;
      }
      if (nearRight && dir > 0) {
        actor.x = limitX;
        startTurn(actor, 'left', now);
        break;
      }

      if (now >= actor.walkUntil) {
        actor.vx = approach(actor.vx, 0, dt);
        if (Math.abs(actor.vx) < 8) {
          actor.vx = 0;
          if (actor.action === 'walk-top' && config.canClimb) {
            if (Math.random() < 0.55) startWalk(actor, now, true);
            else startDescend(actor, stage, now, config);
          } else if (
            config.canClimb &&
            actor.action === 'walk' &&
            now >= actor.climbCoolUntil &&
            Math.random() < 0.12
          ) {
            startRopeDrop(actor, now, config);
          } else {
            actor.action = 'idle';
            actor.nextAt = now + pickIdleMs();
          }
        }
      }
      break;
    }
    case 'idle': {
      actor.vx = approach(actor.vx, 0, dt);
      actor.x += actor.vx * dt;
      if (actor.y > stage.height / 2) actor.y = lerp(actor.y, floor, Math.min(1, dt * 10));
      else if (actor.y < stage.height / 2 && config.canClimb)
        actor.y = lerp(actor.y, TOP_Y, Math.min(1, dt * 10));
      else actor.y = lerp(actor.y, floor, Math.min(1, dt * 10));

      if (now >= actor.nextAt) {
        const roll = Math.random();
        if (roll < 0.42) {
          actor.nextAt = now + pickIdleMs();
        } else if (roll < 0.58) {
          startTurn(actor, actor.facing === 'right' ? 'left' : 'right', now);
        } else if (
          config.canClimb &&
          actor.y > floor - 20 &&
          now >= actor.climbCoolUntil &&
          roll < 0.68
        ) {
          startRopeDrop(actor, now, config);
        } else {
          startWalk(actor, now, config.canClimb && actor.y <= TOP_Y + 8);
        }
      }
      break;
    }
    case 'turn': {
      actor.vx = approach(actor.vx, 0, dt);
      if (now >= actor.nextAt) {
        if (Math.random() < 0.35) {
          actor.action = 'idle';
          actor.nextAt = now + pickIdleMs() * 0.55;
        } else {
          startWalk(actor, now, config.canClimb && actor.y <= TOP_Y + 8);
        }
      }
      break;
    }
    case 'hop': {
      actor.vx = approach(actor.vx, 0, dt);
      if (now >= actor.hopUntil) {
        actor.action = 'idle';
        actor.nextAt = now + pickIdleMs();
      }
      break;
    }
    case 'rope-drop': {
      if (!actor.rope) {
        startRopeDrop(actor, now, config);
        break;
      }
      const t = clamp((now - actor.ropeStartedAt) / actor.ropeMs, 0, 1);
      actor.rope.toY = lerp(actor.ropeFrom, actor.ropeTo, t);
      if (t >= 1) startClimb(actor, now, config);
      break;
    }
    case 'climb': {
      if (!actor.rope) {
        startWalk(actor, now, false);
        break;
      }
      const t = clamp((now - actor.climbStartedAt) / actor.climbMs, 0, 1);
      actor.y = lerp(actor.climbFrom, actor.climbTo, t);
      actor.x = actor.rope.x - actor.box / 2;
      actor.rope.toY = handY(actor, config);
      if (t >= 1) {
        actor.y = TOP_Y;
        actor.rope = null;
        actor.action = 'idle';
        actor.nextAt = now + rand(2800, 8000);
      }
      break;
    }
    case 'throw': {
      if (!actor.rope) {
        startThrow(actor, stage, now, config);
        break;
      }
      const t = clamp((now - actor.ropeStartedAt) / actor.ropeMs, 0, 1);
      actor.rope.fromY = 0;
      actor.rope.toY = lerp(actor.ropeFrom, actor.ropeTo, t);
      if (t >= 1) startRappel(actor, stage, now, config);
      break;
    }
    case 'rappel': {
      if (!actor.rope) {
        actor.y = floor;
        restOnFloor(actor, now);
        break;
      }
      const t = clamp((now - actor.climbStartedAt) / actor.climbMs, 0, 1);
      actor.y = lerp(actor.climbFrom, actor.climbTo, t);
      actor.x = actor.rope.x - actor.box / 2;
      actor.rope.fromY = 0;
      actor.rope.toY = actor.ropeTo;
      if (t >= 1) {
        actor.y = floor;
        restOnFloor(actor, now);
      }
      break;
    }
    case 'parachute': {
      const openMs = 480;
      const drop = 22;
      const elapsed = now - actor.climbStartedAt;
      const from = actor.climbFrom + drop;
      if (elapsed < openMs) {
        actor.vx = 0;
        actor.y = lerp(actor.climbFrom, from, clamp(elapsed / openMs, 0, 1));
        break;
      }
      const t = clamp((elapsed - openMs) / actor.climbMs, 0, 1);
      actor.y = lerp(from, actor.climbTo, t);
      const sway = Math.sin((elapsed - openMs) / 520) * 28;
      actor.x = clamp(actor.anchorX + sway, 0, limitX);
      actor.vx = 0;
      if (t >= 1) {
        actor.y = floor;
        actor.x = clamp(actor.x, 0, limitX);
        restOnFloor(actor, now);
      }
      break;
    }
    default:
      break;
  }

  clampActor(actor, stage);
}

export function hopActor(actor: Actor, now: number): void {
  if (AERIAL.includes(actor.action)) return;
  actor.action = 'hop';
  actor.vx = 0;
  actor.hopUntil = now + HOP_MS;
}
