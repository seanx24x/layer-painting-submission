import { cubeStrokes } from "./cube-strokes";
import { tilePaintStrokes } from "./tile-strokes";
import { paintStrokes } from "./shape-paint-motion";
import type { TechniqueId, StudyComparison } from "./technique-study-types";

export const COMPARISONS: Record<StudyComparison,{label:string;before:string;after:string;note:string}> = {
  coverage:{label:"Coat coverage",before:"First coat",after:"Second coat",note:"Same paint, same light. Another dry coat builds opacity."},
  load:{label:"Brush loading",before:"Overloaded",after:"Controlled",note:"Same mixture. Removing excess liquid keeps the mark controlled."},
  light:{label:"Highlight placement",before:"Bright everywhere",after:"Light-facing edges",note:"Reserve the brightest edges for the light-facing planes."},
  result:{label:"Before & after",before:"Dry basecoat",after:"Finished study",note:"Same surface, camera and light. Compare only the painted result."},
  recess:{label:"Shade placement",before:"Flooded surface",after:"Controlled recesses",note:"Keep the shade in the channels. The raised base colour stays clear."},
  drybrush:{label:"Brush pressure",before:"Paint in the gaps",after:"Light crest contact",note:"Skim the raised texture. Pressure that reaches the valleys removes the contrast."},
};
export const TECHNIQUE_COMPARISONS: Record<TechniqueId,StudyComparison[]> = {
  layers:["coverage","load","light"],edges:["result","light"],recess:["result","recess"],drybrush:["result","drybrush"],
};
export function techniqueStrokes(id:TechniqueId) {
  return id==="layers"?paintStrokes:id==="edges"?cubeStrokes:tilePaintStrokes(id);
}
/** Replay the stroke being watched, or the last one seen during a lift/reposition. */
export function strokeReplayWindow(id:TechniqueId,time:number,chapter:{start:number;end:number}) {
  const strokes=techniqueStrokes(id).filter(stroke=>stroke.start>=chapter.start&&stroke.end<=chapter.end);
  const stroke=strokes.findLast(stroke=>stroke.start<=time)??strokes[0];
  if(!stroke)return null;
  const next=strokes.find(candidate=>candidate.start>stroke.start);
  const liftEnd=next?Math.max(stroke.end,next.start-.05):chapter.end;
  return {start:Math.max(chapter.start,stroke.start-.45),end:Math.min(chapter.end,stroke.end+.4,liftEnd)};
}
type BrushMoment = {phase:"contact"|"stroke"|"lift"|null;action:"Pull"|"Guide"|"Sweep"|"Touch"};
/** Quiet, deterministic cues for the same authored contact times as the brush. */
export function techniqueBrushMoment(id:TechniqueId,time:number):BrushMoment {
  const strokes=techniqueStrokes(id);
  const stroke=strokes.findLast(stroke=>stroke.start<=time);
  const action=id==="recess"?"Guide":id==="drybrush"?"Sweep":id==="edges"&&stroke?.layer===2?"Touch":"Pull";
  if(!stroke||time>stroke.end+.3)return {phase:null,action};
  if(time>stroke.end)return {phase:"lift",action};
  const contactEnd=stroke.start+Math.min(.22,(stroke.end-stroke.start)*.18);
  return {phase:time<contactEnd?"contact":"stroke",action};
}
export const TECHNIQUE_OUTCOMES: Record<string,readonly string[]> = {
  edges:["The raised edge is defined, while the broad face keeps its base colour.","A narrow bright line leaves the first highlight visible beside it.","Small upper-corner accents lead the eye. Lower edges stay quieter."],
  recess:["Shade follows the first grooves without staining the raised ridges.","The channels read together, with clean base colour between them.","Selected recesses are deeper; the tops remain clear."],
  drybrush:["A broken, light mark catches the crests and leaves the valleys dark.","Repeated light passes increase coverage without filling the gaps.","The brightest marks sit on the highest texture, with earlier colour beneath."],
};
export function techniqueCue(id:TechniqueId,time:number,fallback:string) {
  if(id==="layers")return fallback;
  const strokes=techniqueStrokes(id);
  if(time<2)return id==="edges"?"Dry basecoat. Remove excess paint and reform the point.":id==="recess"?"A small brush load. Test before touching the recess.":"Slightly damp bristles. Remove most paint and test the mark.";
  if(time>21.4)return "Brush away. Inspect the result before the next pass.";
  const active=strokes.find(s=>time>=s.start&&time<=s.end);
  if(!active)return "Lift clear. Reposition without dragging paint.";
  if(id==="edges")return active.layer===2?"Touch the light-facing corner. Lift away.":active.layer===1?"A finer line. Keep the first highlight visible.":"Use light side contact along the raised edge.";
  if(id==="recess")return "Guide the tip along the valley. Keep the tops clear.";
  return active.layer===2?"Less paint. Barely skim the highest points.":"Sweep across the ridges, not down into the gaps.";
}
