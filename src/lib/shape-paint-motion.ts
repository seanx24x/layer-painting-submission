import { contactPressure } from "./brush-contact";
export type PaintStroke = {
  layer: 0 | 1 | 2;
  start: number;
  end: number;
  longitude: number;
  top: number;
  bottom: number;
  width: number;
  horizontal?: boolean;
};
export const SPHERE_RADIUS = 1.05;
export const PAINT_DURATION = 80;
export const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (n: number) => { const t = clamp01(n); return t * t * (3 - 2 * t); };
const longitudes = [-.32, -.24, -.16, -.08, 0, .08, .16, .24, .32];
export const paintStrokes: PaintStroke[] = [
  ...longitudes.map((longitude, i) => ({
    layer: 0 as const, start: i === 0 ? 37 : 40 + (i-1)*1.7,
    end: i === 0 ? 39.6 : 41.35 + (i-1)*1.7,
    longitude, top: .48 + .10 * Math.cos(longitude / .36 * Math.PI / 2) + Math.sin(i*2.1)*.012,
    bottom: -.48 - .08 * Math.cos(longitude / .36 * Math.PI / 2) + Math.sin(i*1.7)*.012, width: .056,
  })),
  ...longitudes.map((longitude, i) => ({
    layer: 1 as const, start: 60 + i*.98, end: 60.77 + i*.98,
    longitude, top: .48 + .10 * Math.cos(longitude / .36 * Math.PI / 2) + Math.sin(i*2.1)*.012,
    bottom: -.48 - .08 * Math.cos(longitude / .36 * Math.PI / 2) + Math.sin(i*1.7)*.012, width: .056,
  })),
  ...[.45, .35, .25].map((latitude, i) => ({
    layer: 2 as const, start: 72 + i*1.65, end: 73.2 + i*1.65,
    longitude: latitude, top: -.38 + i*.015,
    bottom: .09 - i*.05, width: .056, horizontal: true,
  })),
];

export function strokeProgress(stroke: PaintStroke, time: number) {
  return smooth((time - stroke.start) / (stroke.end - stroke.start));
}

export function sphereWetStroke(time: number) {
  return paintStrokes.find(stroke => time >= stroke.start && time <= stroke.end)
    ?? paintStrokes.findLast(stroke => time > stroke.end && time <= stroke.end + .7);
}

/** Angles and the texture address of the exact same point on SphereGeometry. */
export function strokePoint(stroke: PaintStroke, amount: number) {
  const t = clamp01(amount);
  const longitude = stroke.horizontal
    ? stroke.top + (stroke.bottom - stroke.top) * t
    : stroke.longitude + .018 * Math.sin(t * Math.PI);
  const latitude = stroke.horizontal
    ? stroke.longitude + .018 * Math.sin(t * Math.PI)
    : stroke.top + (stroke.bottom - stroke.top) * t;
  const c = Math.cos(latitude);
  return {
    longitude, latitude,
    x: Math.sin(longitude) * c * SPHERE_RADIUS,
    y: Math.sin(latitude) * SPHERE_RADIUS,
    z: Math.cos(longitude) * c * SPHERE_RADIUS,
    u: .25 + longitude / (Math.PI * 2),
    v: .5 + latitude / Math.PI,
    pressure: contactPressure(t),
  };
}

type Point3 = { x: number; y: number; z: number };
const mixPoint = (a: Point3, b: Point3, t: number): Point3 => ({ x: a.x + (b.x-a.x)*t, y: a.y + (b.y-a.y)*t, z: a.z + (b.z-a.z)*t });
const unit = (p: Point3): Point3 => { const d = Math.hypot(p.x,p.y,p.z) || 1; return {x:p.x/d,y:p.y/d,z:p.z/d}; };
const direction = (stroke: PaintStroke, t: number) => {
  const a=strokePoint(stroke,Math.max(0,t-.002)),b=strokePoint(stroke,Math.min(1,t+.002));
  return unit({x:b.x-a.x,y:b.y-a.y,z:b.z-a.z});
};

/** Pure, seekable choreography. Transfers lift before travelling over the sphere. */
export function sphereBrushPose(time: number) {
  const layer = time < 57 ? 0 : time < 70 ? 1 : 2;
  const strokes = paintStrokes.filter(stroke=>stroke.layer===layer);
  const first=strokes[0],last=strokes[strokes.length-1];
  const visible=time>=first.start-1.1&&time<=last.end+1.1;
  const index=strokes.findIndex(stroke=>time<=stroke.end);
  const stroke=index<0?last:strokes[index];
  const progress=strokeProgress(stroke,time);
  let surface: Point3=strokePoint(stroke,progress);
  let tangent=direction(stroke,progress);
  let lift=0;
  const contact=time>stroke.start&&time<stroke.end;
  if(time<first.start){
    const t=smooth((time-(first.start-1.1))/1.1);
    const destination=strokePoint(first,0);
    surface=mixPoint({x:destination.x+.30,y:destination.y+.35,z:destination.z},destination,t);
    lift=2.4*(1-t);
  }else if(time>last.end){
    const t=smooth((time-last.end)/1.1);
    surface=strokePoint(last,1);
    lift=2.4*t;
  }else if(time<stroke.start&&index>0){
    const prior=strokes[index-1];
    const t=clamp01((time-prior.end)/(stroke.start-prior.end));
    const travel=smooth((t-.18)/.64);
    surface=mixPoint(strokePoint(prior,1),strokePoint(stroke,0),travel);
    tangent=unit(mixPoint(direction(prior,1),direction(stroke,0),travel));
    lift=.24*smooth(t/.22)*(1-smooth((t-.78)/.22));
  }
  const normal=unit(surface);
  const radius=SPHERE_RADIUS+.006+lift;
  return {point:{x:normal.x*radius,y:normal.y*radius,z:normal.z*radius},normal,tangent,pressure:contact?strokePoint(stroke,progress).pressure:0,contact,visible,layer:stroke.layer};
}
