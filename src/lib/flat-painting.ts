import type { StudyPalette } from "./study-palette";
import type { TechniqueId } from "./technique-study-types";
import { experimentFactors, type WorkshopExperiment } from "./workshop";

export type FlatPoint = { x: number; y: number };
export type FlatStroke = {
  id: string;
  coat: 0 | 1 | 2;
  start: number;
  end: number;
  from: FlatPoint;
  control: FlatPoint;
  to: FlatPoint;
  width: number;
};
export type FlatMark = { stroke: FlatStroke; progress: number; path: string; opacity: number; width: number };
export type FlatBrush = { point: FlatPoint; angle: number; width: number; pressure: number; opacity: number; contact: boolean; coat: 0 | 1 | 2 };
export type FlatFrame = { marks: FlatMark[]; brush: FlatBrush; phase: "light" | "mix" | "load" | "paint"; dry: boolean; amount: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const point = (x: number, y: number): FlatPoint => ({ x, y });
const stroke = (id: string, coat: FlatStroke["coat"], start: number, end: number, from: FlatPoint, to: FlatPoint, width: number, curve = 0): FlatStroke => ({ id, coat, start, end, from, to, width, control: point((from.x + to.x) / 2 + curve, (from.y + to.y) / 2) });

const layerPasses = (coat: 0 | 1): FlatStroke[] => Array.from({ length: 9 }, (_, i) => {
  const x = 252 + i * 32;
  // Run beyond the full ribbon's intersection with the circle, not merely its
  // centre line, so the silhouette clips a continuous coat without scallops.
  const innerDistance = Math.max(0, Math.abs(x - 380) - 21);
  const chord = Math.sqrt(Math.max(0, 140 ** 2 - innerDistance ** 2));
  const start = coat === 0 ? 36.7 + i * 1.85 : 59.2 + i * 1.02;
  return stroke(`layer-${coat}-${i}`, coat, start, start + (coat === 0 ? 1.48 : .78), point(x, 241 - chord - 28), point(x + 2, 241 + chord + 28), 39, 6);
});
const LAYERS: FlatStroke[] = [
  ...layerPasses(0), ...layerPasses(1),
  ...[0, 1, 2].map(i => stroke(`light-${i}`, 2, 72.2 + i * 1.7, 73.5 + i * 1.7, point(280 + i * 28, 158 - i * 10), point(289 + i * 28, 215 - i * 7), 31, -9)),
];
const edgePaths = [
  [point(380, 230), point(500, 166)],
  [point(260, 166), point(380, 230)],
  [point(380, 230), point(380, 365)],
] as const;
const EDGES: FlatStroke[] = [
  ...edgePaths.map(([a, b], i) => stroke(`edge-0-${i}`, 0, 2 + i * 2.6, 4.08 + i * 2.6, a, b, 9)),
  ...edgePaths.map(([a, b], i) => stroke(`edge-1-${i}`, 1, 11.6 + i * 1.68, 12.92 + i * 1.68, a, b, 4.8)),
  stroke("corner-0", 2, 18.2, 19.22, point(374, 227), point(387, 226), 4),
  stroke("corner-1", 2, 20, 21.15, point(490, 171), point(500, 166), 4),
];
const RECESS: FlatStroke[] = [
  stroke("recess-0", 0, 2, 4.2, point(330, 119), point(330, 361), 8),
  stroke("recess-1", 0, 4.85, 7.05, point(430, 119), point(430, 361), 8),
  stroke("recess-2", 0, 7.7, 9.75, point(249, 240), point(511, 240), 8),
  stroke("recess-3", 1, 11.6, 13.9, point(330, 121), point(330, 359), 6),
  stroke("recess-4", 1, 14.65, 16.85, point(250, 240), point(510, 240), 6),
  stroke("recess-5", 2, 18.15, 19.45, point(430, 226), point(430, 255), 5),
  stroke("recess-6", 2, 20, 21.3, point(316, 240), point(344, 240), 5),
];
const DRYBRUSH: FlatStroke[] = [
  ...[0, 1, 2].map(i => stroke(`dry-0-${i}`, 0, 2 + i * 2.6, 3.95 + i * 2.6, point(241, 171 + i * 68), point(519, 159 + i * 68), 56, 0)),
  ...[0, 1, 2].map(i => stroke(`dry-1-${i}`, 1, 11.6 + i * 1.68, 12.85 + i * 1.68, point(244, 178 + i * 66), point(516, 166 + i * 66), 39, 0)),
  ...[0, 1].map(i => stroke(`dry-2-${i}`, 2, 18.2 + i * 1.85, 19.5 + i * 1.85, point(260, 181 + i * 72), point(498, 169 + i * 72), 25, 0)),
];
export const FLAT_STROKES: Record<TechniqueId, readonly FlatStroke[]> = { layers: LAYERS, edges: EDGES, recess: RECESS, drybrush: DRYBRUSH };

export function flatStrokePoint(s: FlatStroke, t: number): FlatPoint {
  const p = clamp(t), q = 1 - p;
  return point(q * q * s.from.x + 2 * q * p * s.control.x + p * p * s.to.x, q * q * s.from.y + 2 * q * p * s.control.y + p * p * s.to.y);
}

/** The contact footprint and the deposited edge use this same pressure envelope. */
export function flatContactWidth(s: FlatStroke, progress: number, width: number): number {
  const t = clamp(progress);
  const taper = .22 + .78 * ease(Math.min(1, t / .065, (1 - t) / .085));
  return width * taper * (1 + Math.sin(t * 26 + s.coat * 2) * .018);
}

/** Tangent of the authored curve, used by both contact geometry and brush posture. */
export function flatStrokeDirection(s: FlatStroke, progress: number): FlatPoint {
  const t = clamp(progress);
  const dx = 2 * ((1 - t) * (s.control.x - s.from.x) + t * (s.to.x - s.control.x));
  const dy = 2 * ((1 - t) * (s.control.y - s.from.y) + t * (s.to.y - s.control.y));
  const length = Math.hypot(dx, dy) || 1;
  return point(dx / length, dy / length);
}

/** Fit the teaching form to the available stage without changing camera during a stroke. */
export function flatSceneViewBox(width: number, height: number, preparation: boolean, detail: boolean): string {
  const aspect = width > 0 && height > 0 ? width / height : 5 / 3;
  const viewHeight = preparation ? 350 : detail ? 408 : 430;
  const viewWidth = Math.max(preparation ? 500 : detail ? 470 : 414, viewHeight * aspect);
  const effectiveHeight = viewWidth / aspect;
  const center = preparation ? point(382, 220) : detail ? point(360, 255) : point(380, 226);
  return [center.x - viewWidth / 2, center.y - effectiveHeight / 2, viewWidth, effectiveHeight].map(n => n.toFixed(2)).join(" ");
}

// Finished marks never change with the playback clock. A bounded cache also makes
// backward seeking and reference/result switching cheap without retaining lessons.
const finishedRibbons = new WeakMap<FlatStroke, Map<number, string>>();

/** A deterministic tapered ribbon. Its leading edge and the brush share the same curve. */
export function flatRibbon(s: FlatStroke, progress: number, width: number): string {
  const end = clamp(progress);
  if (end <= .0001) return "";
  const cached = end === 1 ? finishedRibbons.get(s)?.get(width) : undefined;
  if (cached !== undefined) return cached;
  const left: FlatPoint[] = [], right: FlatPoint[] = [];
  const count = Math.max(3, Math.ceil(end * 48));
  for (let i = 0; i <= count; i++) {
    const t = end * i / count;
    const p = flatStrokePoint(s, t);
    const tangent = flatStrokeDirection(s, t);
    const half = flatContactWidth(s, t, width) / 2;
    left.push(point(p.x - tangent.y * half, p.y + tangent.x * half));
    right.push(point(p.x + tangent.y * half, p.y - tangent.x * half));
  }
  const contour = [...left, ...right.reverse()];
  const coordinate = (p: FlatPoint) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  const mid = (a: FlatPoint, b: FlatPoint) => point((a.x + b.x) / 2, (a.y + b.y) / 2);
  // Quadratic joins round the painted edge instead of exposing polygon corners.
  const path = `M${coordinate(mid(contour[contour.length - 1], contour[0]))} ` + contour.map((p, i) => `Q${coordinate(p)} ${coordinate(mid(p, contour[(i + 1) % contour.length]))}`).join(" ") + " Z";
  if (end === 1) {
    let widths = finishedRibbons.get(s);
    if (!widths) { widths = new Map(); finishedRibbons.set(s, widths); }
    if (widths.size >= 32) widths.delete(widths.keys().next().value!);
    widths.set(width, path);
  }
  return path;
}

/** Wet adjoining passes merge before the next dry coat. Keep a small visible
 * overlap at a controlled load; an overloaded brush leaves a less even deposit.
 * This is an illustrative coverage model, not a fluid or pigment simulation.
 */
export function flatLayerPassOpacity(coat: FlatStroke["coat"], amount: number): number {
  const excess = clamp((amount - .4) / .6);
  return coat === 1 ? .99 - excess * .12 : coat === 0 ? .94 - excess * .14 : .82;
}

function strokeWidth(technique: TechniqueId, s: FlatStroke, experiment?: WorkshopExperiment) {
  const f = experimentFactors(technique, experiment);
  if (technique === "edges") return s.width * (.36 + f.pressure * .64);
  if (technique === "recess") return s.width * (.65 + f.load * .7 + f.excess * 3.6);
  if (technique === "drybrush") return s.width * (.68 + f.pressure * .32);
  return s.width * (.85 + f.load * .3);
}

export function flatPaintFrame(technique: TechniqueId, time: number, experiment?: WorkshopExperiment): FlatFrame {
  const t = Math.max(0, Number.isFinite(time) ? time : 0);
  const strokes = FLAT_STROKES[technique];
  const f = experimentFactors(technique, experiment);
  const marks = strokes.map(s => {
    const progress = ease((t - s.start) / (s.end - s.start));
    const width = strokeWidth(technique, s, experiment);
    const opacity = technique === "layers" ? (s.coat === 2 ? .62 : s.coat === 1 ? Math.min(.96, .42 + f.load * .6) : .25 + f.load * .54) : technique === "drybrush" ? .46 + f.amount * .34 : .88;
    return { stroke: s, progress, width, opacity, path: flatRibbon(s, progress, width) };
  });
  let targetIndex = strokes.findIndex(s => t <= s.end);
  if (targetIndex < 0) targetIndex = strokes.length - 1;
  const target = strokes[targetIndex], previous = strokes[Math.max(0, targetIndex - 1)];
  const progress = ease((t - target.start) / (target.end - target.start));
  let position = flatStrokePoint(target, progress);
  let brushStroke = target;
  const angleFor = (s: FlatStroke, at = 0) => {
    const tangent = flatStrokeDirection(s, at);
    // Local X crosses the painted ribbon; local Y follows the stroke.
    return Math.atan2(tangent.y, tangent.x) * 180 / Math.PI - 90;
  };
  let angle = angleFor(target, progress);
  let opacity = 1, lift = 0;
  const contact = t >= target.start && t <= target.end;
  if (t < target.start) {
    const gap = target.start - previous.end;
    if (targetIndex > 0 && gap < 3.5 && previous.coat === target.coat) {
      const transfer = clamp((t - previous.end) / gap);
      position = point(lerp(previous.to.x, target.from.x, ease(transfer)), lerp(previous.to.y, target.from.y, ease(transfer)));
      lift = Math.sin(transfer * Math.PI) * 34;
      angle = lerp(angleFor(previous, 1), angleFor(target), ease(transfer));
    } else if (targetIndex > 0 && t < previous.end + .65) {
      const release = ease((t - previous.end) / .65);
      position = previous.to;
      brushStroke = previous;
      angle = angleFor(previous, 1);
      lift = release * 44;
      opacity = 1 - release;
    } else {
      const approachDuration = targetIndex > 0 && previous.coat !== target.coat ? .5 : .75;
      const approach = ease((t - target.start + approachDuration) / approachDuration);
      lift = (1 - approach) * 44;
      opacity = approach;
    }
  } else if (t > target.end) {
    lift = ease((t - target.end) / .65) * 44;
    opacity = 1 - ease((t - target.end) / .65);
  }
  // A contact-relative tip spreads with exactly the same input as the painted ribbon.
  const envelope = .22 + .78 * ease(Math.min(1, progress / .065, (1 - progress) / .085));
  const pressure = contact ? envelope * (technique === "edges" || technique === "drybrush" ? .4 + f.amount * .6 : .72) : 0;
  const width = strokeWidth(technique, brushStroke, experiment);
  const liftedWidth = technique === "drybrush" ? 28 + f.amount * 10 : 3 + Math.min(width, 18) * .12;
  // The spreading contact edge is exactly the current ribbon width. Once lifted,
  // bristles recover their point instead of staying flattened in the air.
  const restingContactWidth = flatContactWidth(brushStroke, t < target.start && brushStroke === target ? 0 : 1, width);
  const brushWidth = contact ? flatContactWidth(brushStroke, progress, width) : lerp(restingContactWidth, liftedWidth, ease(lift / 30));
  return {
    marks,
    brush: { point: point(position.x + lift * .28, position.y - lift), angle, width: brushWidth, pressure, opacity, contact, coat: brushStroke.coat },
    phase: technique !== "layers" || t >= 35 ? "paint" : t < 10 ? "light" : t < 25 ? "mix" : "load",
    dry: flatPaintIsDrying(technique, t),
    amount: f.amount,
  };
}

/** Authored illustration pauses, not measurements of physical drying time. */
export function flatPaintIsDrying(technique: TechniqueId, time: number) {
  return technique === "layers" && ((time >= 55 && time < 59.2) || (time >= 70 && time < 72.2));
}

export function flatSurfacePoint(p: FlatPoint, detail: boolean): FlatPoint {
  return detail ? point((p.x - 380) * 1.28 + 360, (p.y - 240) * 1.28 + 267) : p;
}

const defaults: Record<TechniqueId, { base: string; coats: [string, string, string] }> = {
  layers: { base: "#D4D8D8", coats: ["#6389CB", "#6389CB", "#BAD1EF"] },
  edges: { base: "#BFC8CE", coats: ["#DDA58F", "#EAC5B1", "#F6DED0"] },
  recess: { base: "#D5DDD6", coats: ["#758D83", "#5E796D", "#426053"] },
  drybrush: { base: "#939F97", coats: ["#BFB89A", "#D9CFAD", "#E8DEBD"] },
};
export function flatPalette(technique: TechniqueId, palette?: StudyPalette) {
  return palette ? { base: palette.base.hex, coats: palette.coats.map(p => p.hex) as [string, string, string] }
    : { base: defaults[technique].base, coats: [...defaults[technique].coats] as [string, string, string] };
}

function flatChannels(value: string): number[] {
  const raw = value.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map(c => c + c).join("") : raw;
  return /^[0-9a-f]{6}$/i.test(full) ? [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) : [240, 240, 237];
}

/** A wash tints the underlying surface; its catalogue swatch is not opaque paint.
 * Mark opacity still controls transfer, including the wider overloaded deposit.
 * Keep this separate from flatPalette so the swatches and loaded brush stay true.
 */
export function flatDepositedPaint(technique: TechniqueId, base: string, paint: string): string {
  if (technique !== "recess") return paint;
  const undercoat = flatChannels(base), pigment = flatChannels(paint);
  return "#" + undercoat.map((channel, i) => Math.round(channel * pigment[i] / 255).toString(16).padStart(2, "0")).join("");
}

/** Flat face colours only: no illumination, gradients, texture or shader dependency. */
export function flatTint(hex: string, target: string, amount: number): string {
  const a = flatChannels(hex), b = flatChannels(target);
  return "#" + a.map((c, i) => Math.round(lerp(c, b[i], clamp(amount))).toString(16).padStart(2, "0")).join("");
}
