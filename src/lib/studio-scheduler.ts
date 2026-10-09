/** One browser frame drives clocks/cameras, then at most one draw per studio. */
let nextId = 0;
let frame = 0;
const callbacks = new Map<number, FrameRequestCallback>();
const paints = new Set<() => void>();
function wake() { if (!frame) frame = requestAnimationFrame(flush); }
function flush(now: number) {
  // Keep frame nonzero while processing so all invalidations coalesce.
  const tasks = [...callbacks.values()]; callbacks.clear();
  tasks.forEach(task => task(now));
  const draws = [...paints]; paints.clear(); draws.forEach(draw => draw());
  frame = 0;
  if (callbacks.size || paints.size) wake();
}
export function requestStudioFrame(callback: FrameRequestCallback) { const id = ++nextId; callbacks.set(id, callback); wake(); return id; }
export function cancelStudioFrame(id: number) { callbacks.delete(id); }
export function invalidateStudio(draw: () => void) { paints.add(draw); wake(); }
export function forgetStudio(draw: () => void) { paints.delete(draw); }
