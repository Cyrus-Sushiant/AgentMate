import { useId } from 'react';
import type { ChuteFit } from './characters';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function chuteLayout(box: number, spriteW: number, spriteH: number, fit: ChuteFit) {
  const w = Math.max(16, spriteW);
  const h = Math.max(16, spriteH);
  const cx = box / 2;
  const spriteTop = box - h;
  const attachY = spriteTop + h * clamp(fit.y, 0.28, 0.78);
  const half = w * clamp(fit.spread, 0.16, 0.5);
  const leftX = cx - half;
  const rightX = cx + half;
  const canopyW = Math.max(52, w * fit.canopy);
  const canopyH = Math.max(16, Math.min(30, canopyW * 0.3));
  const gap = Math.max(4, h * fit.gap);
  const canopyBottom = spriteTop - gap;
  const canopyTop = canopyBottom - canopyH;
  const canopyLeft = cx - canopyW / 2;
  const canopyRight = cx + canopyW / 2;
  const pad = 8;
  const svgLeft = Math.min(canopyLeft, leftX) - pad;
  const svgTop = canopyTop - 3;
  const svgW = Math.max(canopyRight, rightX) - svgLeft + pad;
  const svgH = attachY - svgTop + 10;
  const ox = (x: number) => x - svgLeft;
  const oy = (y: number) => y - svgTop;
  return {
    attachY,
    leftX,
    rightX,
    canopyW,
    canopyH,
    canopyBottom,
    canopyTop,
    canopyLeft,
    canopyRight,
    cx,
    svgLeft,
    svgTop,
    svgW,
    svgH,
    ox,
    oy,
  };
}

/** Panel colors, in the order they wrap around the canopy. */
const STRIPE_COLORS = ['#e24b3d', '#f3d15a', '#3d8fd1', '#e24b3d', '#f3d15a'];

/**
 * `back` is the canopy and risers (tuck behind the sprite). `front` is the
 * chest strap and clips so the harness actually sits on the character.
 *
 * `depth` swaps the flat pixel canopy for a shaded one, for pets that were
 * uploaded as a 3D render and look odd under a cut-out paper parachute.
 */
export function PetChute({
  box,
  spriteW,
  spriteH,
  fit,
  layer,
  depth = false,
}: {
  box: number;
  spriteW: number;
  spriteH: number;
  fit: ChuteFit;
  layer: 'back' | 'front';
  depth?: boolean;
}): React.JSX.Element {
  const rawId = useId().replace(/:/g, '');
  const clipId = `${rawId}-clip`;
  const {
    attachY,
    leftX,
    rightX,
    canopyW,
    canopyH,
    canopyBottom,
    canopyTop,
    canopyLeft,
    canopyRight,
    cx,
    svgLeft,
    svgTop,
    svgW,
    svgH,
    ox,
    oy,
  } = chuteLayout(box, spriteW, spriteH, fit);

  const frame = {
    className: `pet-chute is-${layer}${depth ? ' is-3d' : ''}`,
    width: svgW,
    height: svgH,
    viewBox: `0 0 ${svgW} ${svgH}`,
    style: { left: svgLeft, top: svgTop },
    'aria-hidden': true as const,
  };

  if (layer === 'front') {
    const strap = `M ${ox(leftX)} ${oy(attachY)} Q ${ox(cx)} ${oy(attachY + 5)} ${ox(rightX)} ${oy(attachY)}`;
    if (depth) {
      const strapId = `${rawId}-strap`;
      const beadId = `${rawId}-bead`;
      return (
        <svg {...frame}>
          <defs>
            <linearGradient id={strapId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#d7a259" />
              <stop offset="0.55" stopColor="#9a6c33" />
              <stop offset="1" stopColor="#4d3317" />
            </linearGradient>
            <radialGradient id={beadId} cx="0.34" cy="0.3" r="0.8">
              <stop offset="0" stopColor="#fff4cf" />
              <stop offset="0.45" stopColor="#e0bb55" />
              <stop offset="1" stopColor="#6b5116" />
            </radialGradient>
          </defs>
          <path className="pet-chute-strap-shadow" d={strap} />
          <path className="pet-chute-strap-lit" d={strap} stroke={`url(#${strapId})`} />
          <circle
            className="pet-chute-clip-lit"
            cx={ox(leftX)}
            cy={oy(attachY)}
            r={3.2}
            fill={`url(#${beadId})`}
          />
          <circle
            className="pet-chute-clip-lit"
            cx={ox(rightX)}
            cy={oy(attachY)}
            r={3.2}
            fill={`url(#${beadId})`}
          />
        </svg>
      );
    }
    return (
      <svg {...frame}>
        <path className="pet-chute-strap-ink" d={strap} />
        <path className="pet-chute-strap" d={strap} />
        <circle className="pet-chute-clip-ink" cx={ox(leftX)} cy={oy(attachY)} r={3.4} />
        <circle className="pet-chute-clip-ink" cx={ox(rightX)} cy={oy(attachY)} r={3.4} />
        <circle className="pet-chute-clip" cx={ox(leftX)} cy={oy(attachY)} r={2.4} />
        <circle className="pet-chute-clip" cx={ox(rightX)} cy={oy(attachY)} r={2.4} />
      </svg>
    );
  }

  const dome = [
    `M ${ox(canopyLeft)} ${oy(canopyBottom)}`,
    `C ${ox(canopyLeft)} ${oy(canopyTop + 2)}, ${ox(cx - canopyW * 0.22)} ${oy(canopyTop)}, ${ox(cx)} ${oy(canopyTop)}`,
    `C ${ox(cx + canopyW * 0.22)} ${oy(canopyTop)}, ${ox(canopyRight)} ${oy(canopyTop + 2)}, ${ox(canopyRight)} ${oy(canopyBottom)}`,
    `Q ${ox(cx)} ${oy(canopyBottom + 4)}, ${ox(canopyLeft)} ${oy(canopyBottom)}`,
  ].join(' ');
  const stripeCount = canopyW > 90 ? 5 : 4;
  const stripeW = canopyW / stripeCount;
  const anchors = [
    { x: canopyLeft + canopyW * 0.12, y: canopyBottom, to: leftX },
    { x: canopyLeft + canopyW * 0.3, y: canopyBottom, to: leftX },
    { x: canopyLeft + canopyW * 0.7, y: canopyBottom, to: rightX },
    { x: canopyLeft + canopyW * 0.88, y: canopyBottom, to: rightX },
  ];

  if (depth) {
    const shadeId = `${rawId}-shade`;
    const underId = `${rawId}-under`;
    const riserId = `${rawId}-riser`;
    // The canopy's lower edge sags in the middle, which is what makes it read
    // as a dome seen from below. Panels have to land on that same curve.
    const hem = (t: number) => {
      const u = 1 - t;
      return {
        x: u * u * canopyLeft + 2 * u * t * cx + t * t * canopyRight,
        y: u * u * canopyBottom + 2 * u * t * (canopyBottom + 4) + t * t * canopyBottom,
      };
    };
    // Leaves the apex sideways before falling away, so a panel bulges like cloth
    // under load instead of folding into a cone.
    const seam = (x: number, y: number) =>
      `${ox(cx + (x - cx) * 0.62)} ${oy(canopyTop + (y - canopyTop) * 0.18)}`;
    // The shaded canopy is exactly the panels laid side by side, so its outline
    // is one panel's seam up each side and the hem in between. Reusing the flat
    // dome here instead would leave a sliver of nothing above the panels.
    const shell = [
      `M ${ox(cx)} ${oy(canopyTop)}`,
      `Q ${seam(canopyLeft, canopyBottom)} ${ox(canopyLeft)} ${oy(canopyBottom)}`,
      `Q ${ox(cx)} ${oy(canopyBottom + 4)} ${ox(canopyRight)} ${oy(canopyBottom)}`,
      `Q ${seam(canopyRight, canopyBottom)} ${ox(cx)} ${oy(canopyTop)}`,
      'Z',
    ].join(' ');
    const panels = Array.from({ length: stripeCount }, (_, i) => {
      const p0 = hem(i / stripeCount);
      const p1 = hem((i + 1) / stripeCount);
      const mid = hem((i + 0.5) / stripeCount);
      const ctrlX = 2 * mid.x - (p0.x + p1.x) / 2;
      const ctrlY = 2 * mid.y - (p0.y + p1.y) / 2;
      return {
        color: STRIPE_COLORS[i % STRIPE_COLORS.length],
        d: [
          `M ${ox(cx)} ${oy(canopyTop)}`,
          `Q ${seam(p0.x, p0.y)} ${ox(p0.x)} ${oy(p0.y)}`,
          `Q ${ox(ctrlX)} ${oy(ctrlY)} ${ox(p1.x)} ${oy(p1.y)}`,
          `Q ${seam(p1.x, p1.y)} ${ox(cx)} ${oy(canopyTop)}`,
          'Z',
        ].join(' '),
      };
    });

    return (
      <svg {...frame}>
        <defs>
          <clipPath id={clipId}>
            <path d={shell} />
          </clipPath>
          <linearGradient id={shadeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#000" stopOpacity="0.5" />
            <stop offset="0.16" stopColor="#000" stopOpacity="0.14" />
            <stop offset="0.34" stopColor="#fff" stopOpacity="0.3" />
            <stop offset="0.56" stopColor="#000" stopOpacity="0.04" />
            <stop offset="0.82" stopColor="#000" stopOpacity="0.28" />
            <stop offset="1" stopColor="#000" stopOpacity="0.52" />
          </linearGradient>
          <linearGradient id={underId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#1a0f08" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id={riserId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3e0b4" />
            <stop offset="1" stopColor="#6b4a22" />
          </linearGradient>
        </defs>
        {anchors.map((line, i) => (
          <line
            key={i}
            className="pet-chute-riser-lit"
            x1={ox(line.x)}
            y1={oy(line.y)}
            x2={ox(line.to)}
            y2={oy(attachY)}
            stroke={`url(#${riserId})`}
          />
        ))}
        <g className="pet-chute-dome">
          <g clipPath={`url(#${clipId})`}>
            {panels.map((panel) => (
              <path key={panel.d} className="pet-chute-panel" d={panel.d} fill={panel.color} />
            ))}
            <rect
              x={ox(canopyLeft)}
              y={oy(canopyTop) - 2}
              width={canopyW}
              height={canopyH + 8}
              fill={`url(#${shadeId})`}
            />
            <rect
              x={ox(canopyLeft)}
              y={oy(canopyBottom - canopyH * 0.5)}
              width={canopyW}
              height={canopyH * 0.5 + 6}
              fill={`url(#${underId})`}
            />
          </g>
          <path d={shell} className="pet-chute-dome-rim" />
        </g>
      </svg>
    );
  }

  return (
    <svg {...frame}>
      <defs>
        <clipPath id={clipId}>
          <path d={dome} />
        </clipPath>
      </defs>
      {anchors.map((line, i) => (
        <g key={i}>
          <line
            className="pet-chute-riser-ink"
            x1={ox(line.x)}
            y1={oy(line.y)}
            x2={ox(line.to)}
            y2={oy(attachY)}
          />
          <line
            className="pet-chute-riser"
            x1={ox(line.x)}
            y1={oy(line.y)}
            x2={ox(line.to)}
            y2={oy(attachY)}
          />
        </g>
      ))}
      <g className="pet-chute-dome">
        <g clipPath={`url(#${clipId})`}>
          {STRIPE_COLORS.slice(0, stripeCount).map((color, i) => (
            <rect
              key={color + i}
              x={ox(canopyLeft + i * stripeW)}
              y={oy(canopyTop)}
              width={stripeW + 0.5}
              height={canopyH + 8}
              fill={color}
            />
          ))}
        </g>
        <path d={dome} className="pet-chute-dome-edge" />
      </g>
    </svg>
  );
}
