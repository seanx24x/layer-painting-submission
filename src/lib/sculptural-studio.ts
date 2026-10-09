/** Local studio model. Geometry, lesson timing and paint appearance are independent. */
export type StudyId = "light" | "layers" | "edges" | "recess" | "drybrush";
export type StudioState = {
  study: StudyId; time: number; amount: number; close: boolean; reference: boolean;
  lightAzimuth: number; lightElevation: number; form: "sphere" | "block"; paintMap: boolean;
};
export const DEFAULT_STUDIO_STATE: StudioState = {
  study: "light", time: 0, amount: .4, close: false, reference: false,
  lightAzimuth: -35, lightElevation: 45, form: "sphere", paintMap: false,
};
export const STUDIES: readonly {
  id: StudyId; title: string; subtitle: string; prepared: string; action: string;
  lookFor: string; adjustment: "Light direction" | "Paint load" | "Pressure"; duration: number;
}[] = [
  { id: "light", title: "Light & form", subtitle: "Find where the light belongs.", prepared: "A matte form in a soft, neutral fill light.", action: "Move the light. Follow the bright area as the surface turns away from it.", lookFor: "A clear light-facing area, a quieter midtone and a connected shadow.", adjustment: "Light direction", duration: 10 },
  { id: "layers", title: "Thin layers", subtitle: "Let the colour build.", prepared: "A smooth, curved surface with dry ivory primer.", action: "Pull a thin stroke across the surface. Let it dry, then repeat over the same area.", lookFor: "Two thin coats. A richer blue, with the curve still clear.", adjustment: "Paint load", duration: 14 },
  { id: "edges", title: "Edge highlighting", subtitle: "Make a small edge count.", prepared: "Two pale, dry faces meeting at a single raised ridge.", action: "Draw the side of the brush lightly along the ridge. Lift before the end.", lookFor: "One fine line reveals where the two faces meet.", adjustment: "Pressure", duration: 8 },
  { id: "recess", title: "Recess shading", subtitle: "Give the panels depth.", prepared: "Two dry, sage-coloured panels separated by a narrow groove.", action: "Place a small amount of shade in the groove and guide it along the channel.", lookFor: "A darker join with clean, readable surfaces on either side.", adjustment: "Paint load", duration: 9 },
  { id: "drybrush", title: "Drybrushing", subtitle: "Bring the texture forward.", prepared: "A stone relief with a dry, dark basecoat. Excess paint has been worked off the brush.", action: "Pass lightly across the raised texture. Build the effect over several passes.", lookFor: "The high points catch lighter colour while the deepest texture stays dark.", adjustment: "Pressure", duration: 12 },
];
export const clamp = (v: number, low = 0, high = 1) => Math.min(high, Math.max(low, Number.isFinite(v) ? v : low));
export const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
export function studyDuration(id: StudyId) { return STUDIES.find(study => study.id === id)!.duration; }
export function renderState(state: StudioState): StudioState {
  if (state.study === "light") return { ...state, time: clamp(state.time, 0, 10), amount: clamp(state.amount), paintMap: state.reference || state.paintMap };
  return { ...state, time: state.reference ? studyDuration(state.study) : clamp(state.time, 0, studyDuration(state.study)), amount: state.reference ? .4 : clamp(state.amount) };
}
export function sampleLightAngles(state: StudioState) {
  const time = clamp(state.time, 0, 10);
  return { azimuth: clamp(state.lightAzimuth + Math.sin(time / 10 * Math.PI) * 65, -80, 80), elevation: clamp(state.lightElevation, 10, 80) };
}
export type Stroke = { start: number; end: number; from: readonly [number, number]; to: readonly [number, number]; width: number; coat: number };
export const LAYER_STROKES: readonly Stroke[] = [0, 1].map(coat => ({
  start: coat ? 7.4 : 1, end: coat ? 11.4 : 5,
  from: [.46, .20] as const, to: [.54, .80] as const, width: .155, coat,
}));
export const DRY_STROKES: readonly Stroke[] = [0, 1, 2].map(index => ({ start: 1 + index * 2.9, end: 3.3 + index * 2.9, from: [-.15, .18 + index * .29], to: [1.15, .18 + index * .29], width: .22, coat: index }));
export function strokeProgress(stroke: Stroke, time: number) { return smooth((time - stroke.start) / (stroke.end - stroke.start)); }
export const STROKE_FEATHER = .86;
export const STROKE_TIP_ASPECT = .32;
export const layerOpacity = (amount: number) => .28 + clamp(amount) * .42;
export const edgeHighlightWidth = (amount: number) => .0045 + clamp(amount) ** 2 * .044;
export const EDGE_STROKE = { start: 1, end: 6, from: -.82, to: .82 } as const;

export function strokeCoverage(stroke: Stroke, time: number, u: number, v: number, width = stroke.width, feather = .88, capAspect = 1) {
  if (time <= stroke.start) return 0;
  width *= smooth((time - stroke.start) / .3);
  const p = strokeProgress(stroke, time), ax = stroke.from[0], ay = stroke.from[1];
  const dx = (stroke.to[0] - ax) * p, dy = (stroke.to[1] - ay) * p;
  const t = clamp(((u - ax) * dx + (v - ay) * dy) / Math.max(.000001, dx * dx + dy * dy));
  const rx = u - ax - dx * t, ry = v - ay - dy * t;
  const pathX = stroke.to[0] - ax, pathY = stroke.to[1] - ay;
  const length = Math.max(.000001, Math.hypot(pathX, pathY));
  const along = (rx * pathX + ry * pathY) / length;
  const across = (rx * -pathY + ry * pathX) / length;
  const distance = Math.hypot(across, along / capAspect);
  return 1 - smooth((distance - width * feather) / Math.max(width * (1 - feather), .000001));
}
export function layerCoverage(time: number, amount: number, u: number, v: number) {
  const coats = [0, 0];
  for (const stroke of LAYER_STROKES) coats[stroke.coat] = Math.max(coats[stroke.coat], strokeCoverage(stroke, time, u, v, stroke.width, STROKE_FEATHER, STROKE_TIP_ASPECT));
  const opacity = layerOpacity(amount);
  return 1 - (1 - coats[0] * opacity) * (1 - coats[1] * opacity);
}
/** Continuous, source-stable stone topography, shared by the mesh and paint mask. */
export function reliefHeight(u: number, v: number) {
  const x = u * 2 - 1, y = v * 2 - 1;
  return .14 + .05 * Math.sin(x * 10 + y * 3 + Math.sin(y * 5) * 1.4) + .027 * Math.sin(y * 7 - x * 4 + Math.cos(x * 6) * 1.1) + .012 * Math.sin(x * 31 + y * 19);
}
export function getStudyPhase(id: StudyId, time: number) {
  const end = studyDuration(id);
  if (time < .8) return { label: "Before", description: STUDIES.find(s => s.id === id)!.prepared };
  if (id === "layers" && time >= 5.4 && time < 7.4) return { label: "Let the first coat dry", description: "Drying time is compressed here. Wait for a fully dry surface at your table." };
  if (time >= end - 1) return { label: "Result", description: STUDIES.find(s => s.id === id)!.lookFor };
  const labels = { light: "Follow the light", layers: time < 7.4 ? "First coat" : "Second coat", edges: "Along the edge", recess: "Follow the channel", drybrush: "Across the high points" };
  return { label: labels[id], description: STUDIES.find(s => s.id === id)!.action };
}
