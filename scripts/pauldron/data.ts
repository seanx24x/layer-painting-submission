/** Prototype-only contracts. No production session state or lesson imports. */
export type Vec3 = [number, number, number];
export type Technique = 'base' | 'recess' | 'edge';
export type LabState = {
  mode: 'inspect' | 'paint'; faction: string; technique: Technique;
  time: number; playing: boolean; amount: number; reference: boolean;
  finish: 'primer' | 'finished'; regions: boolean; selectedRegion: number | null;
  shading: 'smooth' | 'facet'; reducedMotion: boolean;
};
export type ContactPoint = { face: number; bary: Vec3; position: Vec3; normal: Vec3 };
export type Stroke = { id: string; region: number; points: ContactPoint[]; start: number; end: number; width: number; opacity: number };
export type StrokeLibrary = Record<Technique, Stroke[]>;
/** Continuous material boundary, authored in the immutable model's display basis. */
export type PaintBoundary = {
  kind: 'authored-profile-v1'; sourceSha256: string;
  centerX: number; yOrigin: number; yScale: number;
  radiusSquaredCoefficients: [number, number, number, number, number];
  topY: number; bottomCoefficients: [number, number, number]; frontDepthMinimum: number;
};
export function plateSignedDistance(x: number, y: number, boundary: PaintBoundary) {
  const [c0,c1,c2,c3,c4] = boundary.radiusSquaredCoefficients;
  const u = (y - boundary.yOrigin) / boundary.yScale;
  const radiusSquared = c0 + u * (c1 + u * (c2 + u * (c3 + u * c4)));
  const derivative = (c1 + u * (2*c2 + u * (3*c3 + u * 4*c4))) / boundary.yScale;
  const dx = x - boundary.centerX;
  const bottom = boundary.bottomCoefficients[0]+dx*dx*(boundary.bottomCoefficients[1]+dx*dx*boundary.bottomCoefficients[2]);
  return Math.min((radiusSquared-dx*dx)/Math.max(Math.hypot(2*dx,derivative),.001), y-bottom,boundary.topY-y);
}
export type AssetManifest = {
  sourceSha256: string; triangles: number; sourceBytes: number; center: Vec3;
  displayBasis: { right: Vec3; up: Vec3; front: Vec3 };
  [key: string]: unknown;
};
export const REGION_NAMES = ['Outer plate', 'Raised rim', 'Lower band', 'Rivets', 'Skull', 'Inner cup', 'Rear surfaces'];
export const REGION_COLORS = ['#537cca', '#deaa62', '#9b7bc2', '#dc7c77', '#75a997', '#85959f', '#bdc1cc'];
export const VERIFIED_AT = '2026-10-08';
const sourceContext = { verifiedAt: VERIFIED_AT, evidence: 'Layer adaptation of a sourced colour study', company: null, rank: null, shoulderSide: null, armourPattern: null };
export const FACTIONS = {
  ultramarines: { ...sourceContext, id:'ultramarines', name: 'Ultramarines', plate: '#27467e', trim: '#ad8146', skull: '#c7b899', shade: '#101b32', highlight: '#7b9fbf', trimHighlight: '#e3c698', metalness: .65,
    sourceUrl: 'https://www.warhammer-community.com/en-gb/articles/YOJ3IdqO/saturday-pre-orders-get-started-with-warhammer-40000-and-join-the-white-dwarf-bunker/', reference: 'Blue-and-gold studio palette, adapted to this sculpt.' },
  'blood-angels': { ...sourceContext, id:'blood-angels', name: 'Blood Angels', plate: '#a62d2c', trim: '#a62d2c', skull: '#c7b899', shade: '#421c25', highlight: '#e98158', trimHighlight: '#f0966d', metalness: 0,
    sourceUrl: 'https://assets.warhammer-community.com/40k_bafaction-combatpatrol-6lchdza0dd.jpg', reference: 'Ordinary red-armoured Assault Intercessor colour study; red plate and red trim.' },
  'black-templars': { ...sourceContext, id:'black-templars', name: 'Black Templars', plate: '#d5d3c7', trim: '#272a30', skull: '#c7b899', shade: '#66635b', highlight: '#f0eee4', trimHighlight: '#82909e', metalness: 0,
    sourceUrl: 'https://assets.warhammer-community.com/40k_btfaction-combatpatrol-sgbgws4hng.jpg', reference: 'Crusader Initiate colour study; pale shoulder field with black surround.' },
} satisfies Record<string, typeof sourceContext & { id:string; name: string; plate: string; trim: string; skull: string; shade: string; highlight: string; trimHighlight: string; metalness: number; sourceUrl: string; reference: string }>;
export const DURATION = 20;
export const MAX_SEGMENTS = 128;
export const clamp = (x: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(x) ? x : min));
const mix3 = (a: Vec3, b: Vec3, t: number): Vec3 => a.map((v, i) => v + (b[i] - v) * t) as Vec3;
const unit = (v: Vec3): Vec3 => { const len = Math.hypot(...v) || 1; return v.map(n => n / len) as Vec3; };
export function getPaintFactors(technique: Technique, amount: number, reference = false) {
  const a = reference ? .4 : clamp(amount);
  if (technique === 'base') return { width: 1, opacity: .72 + a * .7 };
  return technique === 'edge'
    ? { width: .4 + a * 1.5, opacity: .84 + a * .2 }
    : { width: .82 + a * .45, opacity: .28 + a * 1.8 };
}
/** Brush and coverage share equal-duration, surface-bound path segments. */
export function getBrushFrame(strokes: Stroke[], time: number, amount = .4, reference = false, technique: Technique = 'base') {
  const t = clamp(time, 0, DURATION);
  const index = strokes.findIndex(s => t >= s.start && t <= s.end);
  const strokeIndex = index >= 0 ? index : strokes.findIndex(s => t >= s.start - .7 && t <= s.end + .6);
  if (strokeIndex < 0) return null;
  const stroke = strokes[strokeIndex];
  const progress = clamp((t - stroke.start) / (stroke.end - stroke.start));
  const path = progress * (stroke.points.length - 1);
  const segment = Math.min(stroke.points.length - 2, Math.floor(path));
  const a = stroke.points[segment], b = stroke.points[segment + 1];
  const factors = getPaintFactors(technique, amount, reference);
  const approach = t < stroke.start ? clamp((stroke.start - t) / .7) : t > stroke.end ? clamp((t - stroke.end) / .6) : 0;
  return {
    position: mix3(a.position, b.position, path - segment), normal: unit(mix3(a.normal, b.normal, path - segment)),
    tangent: unit(b.position.map((v, i) => v - a.position[i]) as Vec3),
    contact: index >= 0, visible: true, width: stroke.width * factors.width,
    opacity: stroke.opacity * factors.opacity, region: stroke.region, strokeIndex, progress, approach,
  };
}
