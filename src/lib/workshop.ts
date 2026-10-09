import type { TechniqueId } from './technique-study-types';
export type WorkshopMode = 'watch' | 'explore' | 'compare' | 'paint';
export type WorkshopExperiment = { amount: number; reference: boolean; light: number; lighting: boolean };
export const WORKSHOPS = {
  layers: { control: 'Paint load', low: 'Unloaded', high: 'Overloaded', noun: 'load', start: 35.8, end: 54, result: 54, chapter: 'first-coat', instruction: 'Change the load. Watch the same stroke leave a different mark.', outcome: 'A controlled first coat lets some primer show. Let it dry before building coverage.', practice: 'Test one light stroke on your primed surface. Let it dry, then add another coat.' },
  edges: { control: 'Brush pressure', low: 'Featherlight', high: 'Heavy', noun: 'pressure', start: 1.6, end: 10, result: 10, chapter: 'stage-1', instruction: 'Change the pressure. Keep the path exactly the same.', outcome: 'Light side contact keeps the highlight narrow. More pressure spreads the bristles and the mark.', practice: 'Rest the side of your brush against an accessible edge. Pull gently, then lift.' },
  recess: { control: 'Paint load', low: 'Unloaded', high: 'Overloaded', noun: 'load', start: 1.6, end: 10, result: 10, chapter: 'stage-1', instruction: 'Change the load. See where the shade travels.', outcome: 'A small controlled load stays close to the channel. Excess paint stains the surrounding surface.', practice: 'Place a small amount of shade into a recess. Guide it along the channel without flooding it.' },
  drybrush: { control: 'Brush pressure', low: 'Featherlight', high: 'Heavy', noun: 'pressure', start: 1.6, end: 10, result: 10, chapter: 'stage-1', instruction: 'Change the pressure. Notice which parts catch paint.', outcome: 'Light passes catch the crests. Pressing harder takes pigment farther down the texture.', practice: 'Prepare your brush following the guide. Test a light pass across raised texture before painting the miniature.' },
} as const;
export function experimentFactors(technique: TechniqueId, experiment?: WorkshopExperiment) {
  const amount = !experiment || experiment.reference ? .4 : Math.max(0, Math.min(1, Number.isFinite(experiment.amount) ? experiment.amount : .4));
  const pressure = technique === 'edges' || technique === 'drybrush' ? .25 + amount * 1.875 : 1;
  return { amount, pressure, load: technique === 'layers' || technique === 'recess' ? .15 + amount * .875 : .35, excess: Math.max(0, (amount - .4) / .6) };
}
const experimentObservations = {
  layers: ['Less paint leaves a lighter, less complete coat. Build coverage with another dry layer.', 'Excess load leaves an uneven deposit. Unload the brush and test a short stroke first.'],
  edges: ['Featherlight contact leaves a fine edge. Let the side of the brush follow the corner.', 'More pressure spreads the bristles and widens the highlight. Ease off to recover a finer line.'],
  recess: ['A small load leaves less shade in the channel. Add another controlled pass if needed.', 'Excess load spreads beyond the channel. Remove some paint before touching the surface.'],
  drybrush: ['Light contact catches the highest texture. Build the effect with gentle passes.', 'Heavy contact reaches farther down the texture. Use less pressure to preserve the recesses.'],
} as const;

/** Explain the displayed mark, including the fixed reference when it is selected. */
export function describeExperiment(technique: TechniqueId, amount: number, reference: boolean) {
  const factors = experimentFactors(technique, { amount, reference, light: 0, lighting: false });
  if (factors.amount < .25) return experimentObservations[technique][0];
  if (factors.amount > .65) return experimentObservations[technique][1];
  return WORKSHOPS[technique].outcome;
}
/** A synchronous scene clock; React only subscribes to semantic/low-frequency updates. */
export function createLessonClock() {
  const listeners = new Set<(time: number) => void>();
  return { publish(time: number) { listeners.forEach(listener => listener(time)); }, subscribe(listener: (time: number) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; } };
}
export type LessonClock = ReturnType<typeof createLessonClock>;
