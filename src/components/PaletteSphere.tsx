"use client";

import { useId } from "react";
import type { Guide } from "@/lib/guides";
import "./palette-sphere.css";

type PaletteColour = { hex: string; hue: number; light: number; chroma: number; importance: number };

function colour(hex: string, role: string): PaletteColour {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const high = Math.max(r, g, b);
  const low = Math.min(r, g, b);
  const chroma = high - low;
  const sector = chroma === 0 ? 0 : high === r ? (g - b) / chroma : high === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
  const importance = /focal|lens|base texture|base rim|joints|casing/i.test(role) ? .25
    : /main |first highlight|finest light|armour base|raised edges|fine highlight|tint/i.test(role) ? 1 : .65;
  return { hex, hue: (sector * 60 + 360) % 360, light: (high + low) / 2, chroma, importance };
}

function colourFamily(paint: PaletteColour) {
  if (paint.chroma < .13) return paint.light > .7 ? "light" : paint.light < .22 ? "dark" : "neutral";
  // Neighbouring pigments share a broad field rather than becoming separate bands.
  return `hue-${Math.floor(((paint.hue + 30) % 360) / 60)}`;
}

function paletteFields(paints: Guide["paints"]) {
  const families: { family: string; colours: PaletteColour[] }[] = [];
  for (const paint of paints) {
    const sample = colour(paint.hex, paint.role);
    const family = colourFamily(sample);
    const match = families.find((field) => {
      if (!family.startsWith("hue-") || !field.family.startsWith("hue-")) return field.family === family;
      const distance = Math.abs(field.colours[0].hue - sample.hue);
      return Math.min(distance, 360 - distance) < 28;
    });
    if (match) match.colours.push(sample);
    else families.push({ family: family.startsWith("hue-") ? `hue-${families.length}` : family, colours: [sample] });
  }
  // Only an explicitly tinted metallic foundation promotes its tint over the metal.
  const tintPaint = paints.find((paint) => /\btint\b/i.test(paint.role));
  if (families[0]?.family === "neutral" && tintPaint) {
    const tint = families.findIndex((field) => field.colours.some((paint) => paint.hex === tintPaint.hex));
    if (tint > 0) families.unshift(...families.splice(tint, 1));
  }
  return families.map((field) => ({ ...field, colours: field.colours.toSorted((a, b) => b.light - a.light) }));
}

/** A lightweight colour study. The gradient is a composition, not a paint mixture. */
export function PaletteSphere({
  guide,
  className = "",
  caption = true,
}: {
  guide: Pick<Guide, "paints" | "faction" | "title">;
  className?: string;
  caption?: boolean;
}) {
  const id = useId().replaceAll(":", "");
  const gradientId = `palette-${id}`;
  const clipId = `palette-clip-${id}`;
  const lightId = `light-${id}`;
  const shadeId = `shade-${id}`;
  const shadowId = `shadow-${id}`;
  const titleId = `palette-title-${id}`;
  const descriptionId = `palette-description-${id}`;
  const fields = paletteFields(guide.paints);
  const primary = fields[0];
  const accents = fields.slice(1);
  const meshId = `mesh-${id}`;
  const grainId = `grain-${id}`;
  const bloomId = `bloom-${id}`;
  const flowId = `flow-${id}`;
  const lightScheme = primary.family === "light";
  const darkScheme = primary.family === "dark";
  const positions = [
    [206, 149, -32, 1.2, .76],
    [116, 179, -40, 1.32, .62],
    [204, 79, 24, 1.12, .74],
    [88, 135, -28, .9, 1.18],
    [195, 194, 32, 1.1, .7],
    [156, 74, -18, 1.4, .65],
  ];

  return (
    <div className={`palette-sphere ${className}`}>
      <svg
        className="palette-sphere__canvas"
        viewBox="0 0 320 270"
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
      >
        <title id={titleId}>{`${guide.faction} colour palette`}</title>
        <desc id={descriptionId}>{`A digital mesh-gradient sphere made from all ${guide.paints.length} paints: ${guide.paints.map((paint) => paint.name).join(", ")}. A palette illustration, not a physical paint mixture or a painted miniature.`}</desc>
        <defs>
          <clipPath id={clipId}><circle cx="160" cy="125" r="89" /></clipPath>
          <linearGradient id={gradientId} x1="0%" y1="15%" x2="100%" y2="80%">
            {primary.colours.map((paint, index) => (
              <stop key={index} offset={`${index / Math.max(primary.colours.length - 1, 1) * 100}%`} stopColor={paint.hex} />
            ))}
          </linearGradient>
          <radialGradient id={bloomId} gradientUnits="userSpaceOnUse" cx="164" cy="168" r="124" gradientTransform="rotate(-40 164 168) translate(164 168) scale(1.35 .56) translate(-164 -168)">
            <stop stopColor={primary.colours[0].hex} stopOpacity=".95" />
            <stop offset="38%" stopColor={primary.colours[0].hex} stopOpacity=".65" />
            <stop offset="100%" stopColor={primary.colours[0].hex} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={flowId} gradientUnits="userSpaceOnUse" cx="196" cy="83" r="112" gradientTransform="rotate(-38 196 83) translate(196 83) scale(1.22 .74) translate(-196 -83)">
            <stop stopColor={primary.colours.at(-1)!.hex} stopOpacity=".9" />
            <stop offset="42%" stopColor={primary.colours.at(-1)!.hex} stopOpacity=".55" />
            <stop offset="100%" stopColor={primary.colours.at(-1)!.hex} stopOpacity="0" />
          </radialGradient>
          {accents.map((field, index) => {
            const [x, y, angle, sx, sy] = field.family === "dark" ? [191, 203, -28, 1.32, .7]
              : field.family === "light" ? [119, 92, -32, 1.35, .68]
                : field.family === "neutral" ? [109, 170, -36, 1.2, .62] : positions[index % positions.length];
            const strength = Math.max(...field.colours.map((paint) => paint.importance));
            const opacity = strength * (field.family === "dark" ? (lightScheme ? .15 : .48)
              : field.family === "neutral" ? (darkScheme ? .68 : .32)
                : field.family === "light" ? (darkScheme ? .32 : .46)
                  : lightScheme || darkScheme ? .38 : .72);
            return <radialGradient key={field.family} id={`${gradientId}-${index}`} gradientUnits="userSpaceOnUse" cx={x} cy={y} r="114" gradientTransform={`rotate(${angle} ${x} ${y}) translate(${x} ${y}) scale(${sx} ${sy}) translate(${-x} ${-y})`}>
              {field.colours.map((paint, colourIndex) => (
                <stop key={colourIndex} offset={`${colourIndex / Math.max(field.colours.length - 1, 1) * 56}%`} stopColor={paint.hex} stopOpacity={opacity * (1 - colourIndex / Math.max(field.colours.length, 1) * .3)} />
              ))}
              <stop offset="72%" stopColor={field.colours.at(-1)!.hex} stopOpacity={opacity * .18} />
              <stop offset="100%" stopColor={field.colours.at(-1)!.hex} stopOpacity="0" />
            </radialGradient>;
          })}
          {/* A fixed displacement field bends the colour transitions without any animation loop. */}
          <filter id={meshId} x="20" y="-15" width="280" height="280" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency=".008 .011" numOctaves="2" seed="12" result="flow" />
            <feDisplacementMap in="SourceGraphic" in2="flow" scale="68" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id={grainId} x="71" y="36" width="178" height="178" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="3" seed="17" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <radialGradient id={lightId} cx="30%" cy="19%" r="83%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity=".24" />
            <stop offset="37%" stopColor="#ffffff" stopOpacity=".07" />
            <stop offset="76%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={shadeId} cx="37%" cy="27%" r="82%">
            <stop offset="36%" stopColor="#111826" stopOpacity="0" />
            <stop offset="74%" stopColor="#111826" stopOpacity=".03" />
            <stop offset="94%" stopColor="#111826" stopOpacity={lightScheme ? .12 : .23} />
            <stop offset="100%" stopColor="#111826" stopOpacity={lightScheme ? .2 : .36} />
          </radialGradient>
          <radialGradient id={shadowId}>
            <stop offset="0%" stopColor="#233144" stopOpacity=".19" />
            <stop offset="44%" stopColor="#233144" stopOpacity=".08" />
            <stop offset="100%" stopColor="#233144" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          className="palette-sphere__shadow"
          cx="164"
          cy="229"
          rx="87"
          ry="14"
          fill={`url(#${shadowId})`}
        />
        <g className="palette-sphere__object">
          <g clipPath={`url(#${clipId})`}>
            <g filter={`url(#${meshId})`}>
              <rect x="20" y="-15" width="280" height="280" fill={`url(#${gradientId})`} />
              <rect x="20" y="-15" width="280" height="280" fill={`url(#${bloomId})`} />
              <rect x="20" y="-15" width="280" height="280" fill={`url(#${flowId})`} />
              {accents.map((field, index) => <rect key={field.family} x="20" y="-15" width="280" height="280" fill={`url(#${gradientId}-${index})`} />)}
            </g>
            <rect className="palette-sphere__grain" x="71" y="36" width="178" height="178" filter={`url(#${grainId})`} />
          </g>
          <circle cx="160" cy="125" r="89" fill={`url(#${lightId})`} />
          <circle cx="160" cy="125" r="89" fill={`url(#${shadeId})`} />
          <circle cx="160" cy="125" r="88.75" fill="none" stroke="#ffffff" strokeOpacity=".2" strokeWidth=".5" />
        </g>
      </svg>
      {caption && (
        <div className="palette-sphere__caption" aria-hidden="true">
          <span>Digital palette</span>
          <span>{guide.paints.length} colours</span>
        </div>
      )}
    </div>
  );
}
