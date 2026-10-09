/** Shared lighting maths for the 3D form, controls and accessible SVG fallback. */
export type LightPosition = { azimuth: number; elevation: number };
export type LightSurface = "sphere" | "block";
export type LightView = "light" | "paint";
export type LightStudyState = LightPosition & { surface: LightSurface; view: LightView };
export type LightVector = readonly [number, number, number];
export const LIGHT_LIMITS = { azimuth: [-80, 80], elevation: [10, 80] } as const;
export const DEFAULT_LIGHT: LightPosition = { azimuth: -35, elevation: 50 };
export const LIGHT_PRESETS = [
  { id: "upper-left", label: "Upper left", azimuth: -35, elevation: 50 },
  { id: "overhead", label: "Overhead", azimuth: 0, elevation: 80 },
  { id: "upper-right", label: "Upper right", azimuth: 35, elevation: 50 },
  { id: "low-side", label: "Low side", azimuth: -70, elevation: 15 },
] as const;
export const PAINT_BANDS = { shadow: "#536171", midtone: "#a6b3bf", highlight: "#e4e7df" } as const;
export const PAINT_THRESHOLDS = { midtone: .22, highlight: .72 } as const;
const radians = (degrees: number) => degrees * Math.PI / 180;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function constrainLight(position: LightPosition): LightPosition {
  return {
    azimuth: clamp(Number.isFinite(position.azimuth) ? position.azimuth : DEFAULT_LIGHT.azimuth, ...LIGHT_LIMITS.azimuth),
    elevation: clamp(Number.isFinite(position.elevation) ? position.elevation : DEFAULT_LIGHT.elevation, ...LIGHT_LIMITS.elevation),
  };
}
/** Direction from the surface towards the light. +Z faces the stationary camera. */
export function lightDirection(position: LightPosition): LightVector {
  const { azimuth, elevation } = constrainLight(position), a = radians(azimuth), e = radians(elevation);
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
}
export function lightExposure(normal: LightVector, position: LightPosition): number {
  const direction = lightDirection(position), length = Math.hypot(...normal);
  if (!length) return 0;
  return Math.max(0, (normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2]) / length);
}
export function paintBand(exposure: number): keyof typeof PAINT_BANDS {
  return exposure >= PAINT_THRESHOLDS.highlight ? "highlight" : exposure >= PAINT_THRESHOLDS.midtone ? "midtone" : "shadow";
}
/** Shared handle bounds leave room for its touch target at every viewport width. */
export function lightHandlePosition(position: LightPosition): { x: number; y: number } {
  const light = constrainLight(position);
  return { x: .12 + (light.azimuth + 80) / 160 * .76, y: .1 + (80 - light.elevation) / 70 * .3 };
}
export function lightFromHandle(x: number, y: number): LightPosition {
  return constrainLight({ azimuth: Math.round((x - .12) / .76 * 160 - 80), elevation: Math.round(80 - (y - .1) / .3 * 70) });
}
export function moveLightWithKey(position: LightPosition, key: string, fine = false): LightPosition | null {
  const increment = fine ? 1 : 5;
  const delta = { ArrowLeft: [-increment, 0], ArrowRight: [increment, 0], ArrowUp: [0, increment], ArrowDown: [0, -increment] }[key];
  return delta ? constrainLight({ azimuth: position.azimuth + delta[0], elevation: position.elevation + delta[1] }) : null;
}
export function lightPositionLabel(position: LightPosition): string {
  const light = constrainLight(position);
  return `${light.azimuth === 0 ? "Centred" : `${Math.abs(light.azimuth)}° ${light.azimuth < 0 ? "left" : "right"}`}, ${light.elevation}° above`;
}
