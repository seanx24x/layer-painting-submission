export const HALF = .8;
export const BEVEL = .1;
export const CORE = HALF - BEVEL;
const EDGE = CORE + BEVEL / Math.sqrt(2);
const CORNER = CORE + BEVEL / Math.sqrt(3);
type Coordinates = readonly [number, number, number];
export type CubeStroke = {
  layer: 0 | 1 | 2;
  start: number;
  end: number;
  from: Coordinates;
  to: Coordinates;
  normal: Coordinates;
  handle: Coordinates;
};
const paths = [
  { from: [-CORE, EDGE, EDGE], to: [CORE, EDGE, EDGE], normal: [0, 1, 1], handle: [.24, 1, .12] },
  { from: [EDGE, CORE, EDGE], to: [EDGE, -CORE, EDGE], normal: [1, 0, 1], handle: [.40, .9, .40] },
  { from: [EDGE, EDGE, CORE], to: [EDGE, EDGE, -CORE], normal: [1, 1, 0], handle: [.12, 1, .24] },
] as const;
const corners = [
  { point: [CORNER, CORNER, CORNER], normal: [1, 1, 1], handle: [.35, 1, .35] },
  { point: [-CORNER, CORNER, CORNER], normal: [-1, 1, 1], handle: [-.35, 1, .35] },
  { point: [CORNER, CORNER, -CORNER], normal: [1, 1, -1], handle: [.35, 1, -.35] },
] as const;

/** The same authored paths drive the brush and the surface shader. */
export const cubeStrokes: readonly CubeStroke[] = [
  ...paths.map((path, i) => ({ ...path, layer: 0 as const, start: 2 + i * 2.9, end: 4.2 + i * 2.9 })),
  ...paths.map((path, i) => ({ ...path, layer: 1 as const, start: 11.2 + i * 2.15, end: 12.7 + i * 2.15 })),
  ...corners.map((corner, i) => ({ from: corner.point, to: corner.point, normal: corner.normal, handle: corner.handle, layer: 2 as const, start: 17.8 + i * 1.4, end: i === 2 ? 21.4 : 18.65 + i * 1.4 })),
];

