import { useMemo } from "react";
import { lightExposure, PAINT_BANDS, paintBand, type LightStudyState } from "@/lib/light-placement";

const colourForNormal = (normal: readonly [number, number, number], state: LightStudyState) => {
  const exposure = lightExposure(normal, state);
  if (state.view === "paint") return PAINT_BANDS[paintBand(exposure)];
  // Linear-light diffuse conversion matches the WebGL material's one key + fill.
  const linear = (n: number) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
  const srgb = (n: number) => n <= .0031308 ? n * 12.92 : 1.055 * n ** (1 / 2.4) - .055;
  const rgb = [174, 184, 190].map(channel => Math.round(Math.min(1, srgb(linear(channel / 255) * (.27 + exposure * .88))) * 255));
  return `rgb(${rgb.join(" ")})`;
};

export function LightPlacementFallback({ state, id }: { state: LightStudyState; id: string }) {
  const sphere = useMemo(() => {
    if (state.surface !== "sphere") return [];
    const cells: { x: number; y: number; fill: string }[] = [], count = 72, step = 252 / count;
    for (let row = 0; row < count; row++) for (let column = 0; column < count; column++) {
      const x = (column + .5) / count * 2 - 1, y = 1 - (row + .5) / count * 2, radius = x * x + y * y;
      if (radius > 1.04) continue;
      const length = Math.max(1, Math.sqrt(radius));
      cells.push({ x: 274 + column * step, y: 126 + row * step, fill: colourForNormal([x / length, y / length, Math.sqrt(Math.max(0, 1 - radius))], state) });
    }
    return cells;
  }, [state]);
  // The fallback keeps the same directional maths; planar silhouettes are schematic.
  const front = colourForNormal([-.4969, -.2147, .8406], state);
  const side = colourForNormal([.8678, -.1229, .4814], state);
  const top = colourForNormal([0, .9689, .2474], state);
  const project = (points: readonly (readonly [number, number, number])[]) => points.map(([x, y, z], index) => {
    const scale = 126 / .91, cx = Math.cos(.25), sx = Math.sin(.25), cy = Math.cos(-.52), sy = Math.sin(-.52);
    return `${index ? "L" : "M"}${400 + (cy * x + sy * z) * scale} ${252 - (sx * sy * x + cx * y - sx * cy * z) * scale}`;
  }).join(" ") + "Z";
  return <svg className="light-fallback" viewBox="0 0 800 480" aria-hidden="true">
    <defs><clipPath id={`${id}-circle`}><circle cx="400" cy="252" r="126" /></clipPath><radialGradient id={`${id}-shadow`}><stop stopColor="#616a76" stopOpacity=".13" /><stop offset="1" stopColor="#616a76" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="400" cy="410" rx="145" ry="18" fill={`url(#${id}-shadow)`} />
    {state.surface === "sphere" ? <g clipPath={`url(#${id}-circle)`}>{sphere.map((cell, index) => <rect key={index} x={cell.x} y={cell.y} width="3.6" height="3.6" fill={cell.fill} />)}</g> : <g strokeLinejoin="round" strokeWidth="1">
      <path d={project([[-.71, .71, -.71], [.71, .71, -.71], [.71, .71, .71], [-.71, .71, .71]])} fill={top} stroke={top} />
      <path d={project([[.71, .71, .71], [.71, .71, -.71], [.71, -.71, -.71], [.71, -.71, .71]])} fill={side} stroke={side} />
      <path d={project([[-.71, .71, .71], [.71, .71, .71], [.71, -.71, .71], [-.71, -.71, .71]])} fill={front} stroke={front} />
    </g>}
  </svg>;
}
