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

/**
 * `back` is the canopy and risers (tuck behind the sprite). `front` is the
 * chest strap and clips so the harness actually sits on the character.
 */
export function PetChute({
  box,
  spriteW,
  spriteH,
  fit,
  layer,
}: {
  box: number;
  spriteW: number;
  spriteH: number;
  fit: ChuteFit;
  layer: 'back' | 'front';
}): React.JSX.Element {
  const clipId = useId().replace(/:/g, '');
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
    className: `pet-chute is-${layer}`,
    width: svgW,
    height: svgH,
    viewBox: `0 0 ${svgW} ${svgH}`,
    style: { left: svgLeft, top: svgTop },
    'aria-hidden': true as const,
  };

  if (layer === 'front') {
    const strap = `M ${ox(leftX)} ${oy(attachY)} Q ${ox(cx)} ${oy(attachY + 5)} ${ox(rightX)} ${oy(attachY)}`;
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
  const stripeColors = ['#e24b3d', '#f3d15a', '#3d8fd1', '#e24b3d', '#f3d15a'];
  const anchors = [
    { x: canopyLeft + canopyW * 0.12, y: canopyBottom, to: leftX },
    { x: canopyLeft + canopyW * 0.3, y: canopyBottom, to: leftX },
    { x: canopyLeft + canopyW * 0.7, y: canopyBottom, to: rightX },
    { x: canopyLeft + canopyW * 0.88, y: canopyBottom, to: rightX },
  ];

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
          {stripeColors.slice(0, stripeCount).map((color, i) => (
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
