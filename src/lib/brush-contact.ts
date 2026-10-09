/** Shared round-brush footprint in local world units. */
export const roundContactRadius = (pressure: number) => Math.max(0, Math.min(1, pressure)) * .095;
export function contactPressure(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const ease = (x: number) => { const n = Math.max(0, Math.min(1, x)); return n*n*(3-2*n); };
  return .58 * ease(t / .04) * ease((1-t) / .055);
}
