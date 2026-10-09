import { FLAT_STROKES, flatDepositedPaint, flatPaintIsDrying } from "./flat-painting";
import { lessonChapters } from "./painting-lesson";
import type { StudyPalette } from "./study-palette";
import type { TechniqueId } from "./technique-study-types";
import { experimentFactors, type WorkshopExperiment } from "./workshop";

export type SurfacePaintingInput = {
  technique: TechniqueId;
  time: number;
  palette?: StudyPalette;
  experiment?: WorkshopExperiment;
  detail?: boolean;
};

/** UVs run left to right and bottom to top. Width is a UV-space radius. */
export type SurfacePaintPass = {
  id: string;
  from: readonly [number, number];
  to: readonly [number, number];
  progress: number;
  width: number;
  opacity: number;
  coat: 0 | 1 | 2;
};

export type SurfacePaintingFrame = {
  technique: TechniqueId;
  time: number;
  chapterId: string;
  phase: "light" | "preparation" | "paint";
  preparation?: "mix" | "load";
  preparationProgress: number;
  preparationTestProgress: number;
  preparationUnloadProgress: number;
  drying: boolean;
  /** Exact catalogue/guide colours. Do not use display tint as paint identity. */
  base: string;
  coats: [string, string, string];
  /** Washes tint the underlying surface. Other techniques match coats exactly. */
  depositedCoats: [string, string, string];
  passes: SurfacePaintPass[];
  amount: number;
  detail: boolean;
  light: number;
  lighting: boolean;
};

type SurfaceStroke = Omit<SurfacePaintPass, "progress" | "opacity"> & { start: number; end: number };
type Path = Pick<SurfaceStroke, "from" | "to" | "width">;
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

const defaults: Record<TechniqueId, { base: string; coats: [string, string, string] }> = {
  layers: { base: "#ECEBE5", coats: ["#587DA8", "#587DA8", "#94ACC1"] },
  edges: { base: "#E5E7E5", coats: ["#F1F3EF", "#F8F8F0", "#FFFFFC"] },
  recess: { base: "#E7E8E3", coats: ["#A3ADA6", "#7D9083", "#5B7264"] },
  drybrush: { base: "#D4D9D5", coats: ["#E0DFD4", "#EEEBDD", "#F7F1E5"] },
};

const chapterLists = {
  layers: lessonChapters("layers"), edges: lessonChapters("edges"),
  recess: lessonChapters("recess"), drybrush: lessonChapters("drybrush"),
};

function pathFor(technique: TechniqueId, coat: 0 | 1 | 2, index: number): Path {
  if (technique === "layers") {
    if (coat < 2) {
      const u = .14 + index * .09;
      return { from: [u, .96], to: [u + .012, .04], width: .061 };
    }
    const u = .25 + index * .085;
    return { from: [u, .87 - index * .025], to: [u + .025, .63 - index * .025], width: .062 };
  }
  if (technique === "edges") {
    if (coat < 2) {
      const start = .09 + index * (.82 / 3);
      return { from: [.5, start], to: [.5, start + .82 / 3], width: coat === 0 ? .010 : .0044 };
    }
    return index === 0
      ? { from: [.5, .09], to: [.5, .135], width: .004 }
      : { from: [.5, .865], to: [.5, .91], width: .004 };
  }
  if (technique === "recess") {
    // First establish separated channels; then bridge the central join and
    // finish the right arm. The final short marks deepen selected intersections.
    const paths: Record<0 | 1 | 2, readonly Path[]> = {
      0: [
        { from: [.5, .91], to: [.5, .56], width: .011 },
        { from: [.5, .44], to: [.5, .09], width: .011 },
        { from: [.09, .5], to: [.44, .5], width: .011 },
      ],
      1: [
        { from: [.5, .585], to: [.5, .415], width: .0085 },
        { from: [.415, .5], to: [.91, .5], width: .0085 },
      ],
      2: [
        { from: [.5, .56], to: [.5, .44], width: .007 },
        { from: [.44, .5], to: [.56, .5], width: .007 },
      ],
    };
    return paths[coat][index];
  }
  const v = coat === 2 ? .76 - index * .25 : .76 - index * .26;
  return { from: [coat === 2 ? .16 : .04, v], to: [coat === 2 ? .84 : .96, v + .025], width: coat === 0 ? .14 : coat === 1 ? .11 : .067 };
}

/**
 * Keep source chapter/checkpoint timings while authoring contact paths for the
 * simpler surfaces. Both replay and reverse seeking reconstruct these marks;
 * the renderer keeps no accumulated paint state or frame-dependent randomness.
 */
function surfaceStrokes(technique: TechniqueId): readonly SurfaceStroke[] {
  const indices = [0, 0, 0];
  return FLAT_STROKES[technique].map((stroke) => ({
    id: stroke.id, coat: stroke.coat, start: stroke.start, end: stroke.end,
    ...pathFor(technique, stroke.coat, indices[stroke.coat]++),
  }));
}

export const SURFACE_STROKES: Readonly<Record<TechniqueId, readonly SurfaceStroke[]>> = {
  layers: surfaceStrokes("layers"),
  edges: surfaceStrokes("edges"),
  recess: surfaceStrokes("recess"),
  drybrush: surfaceStrokes("drybrush"),
};

/** Pure visual state; fixed reference load never changes the chapter or camera. */
export function evaluateSurfacePainting(input: SurfacePaintingInput): SurfacePaintingFrame {
  const { technique } = input;
  const chapters = chapterLists[technique];
  const time = clamp(input.time, 0, chapters[chapters.length - 1].end);
  const chapter = chapters.find((candidate) => time >= candidate.start && time < candidate.end) ?? chapters[chapters.length - 1];
  const f = experimentFactors(technique, input.experiment);
  const phase = technique === "layers" && time < 35 ? time < 10 ? "light" : "preparation" : "paint";
  const preparation = phase === "preparation" ? time < 25 ? "mix" : "load" : undefined;
  const preparationTestProgress = preparation === "mix" ? smooth((time - 18) / 4.6)
    : preparation === "load" ? smooth((time - 31) / 2.2) : 0;
  const preparationUnloadProgress = preparation === "load" ? smooth((time - 28) / 2.3) : 0;
  const base = input.palette?.base.hex ?? defaults[technique].base;
  const coats = input.palette ? input.palette.coats.map((paint) => paint.hex) as [string, string, string] : [...defaults[technique].coats] as [string, string, string];
  const passes = SURFACE_STROKES[technique].map((stroke): SurfacePaintPass => {
    const progress = smooth((time - stroke.start) / (stroke.end - stroke.start));
    const contact = smooth((time - stroke.start) / .24);
    const widthFactor = technique === "edges" ? .45 + f.amount ** 2 * 3.4375
      : technique === "recess" ? .65 + f.load * .7 + f.excess * 3.6
      : technique === "drybrush" ? .68 + f.pressure * .32
      : .85 + f.load * .3;
    const opacity = technique === "layers"
      ? stroke.coat === 2 ? .62 : stroke.coat === 1 ? Math.min(.96, .42 + f.load * .6) : .25 + f.load * .54
      : technique === "drybrush" ? .46 + f.amount * .34
      : technique === "recess" ? .48 + f.amount * .45 : .88;
    return {
      id: stroke.id, from: stroke.from, to: stroke.to, coat: stroke.coat,
      progress, width: stroke.width * widthFactor * contact, opacity,
    };
  });
  return {
    technique, time, chapterId: chapter.id, phase, preparation,
    preparationProgress: preparation === "load" ? (preparationUnloadProgress + preparationTestProgress) / 2 : preparationTestProgress,
    preparationTestProgress, preparationUnloadProgress,
    drying: flatPaintIsDrying(technique, time), base, coats,
    depositedCoats: coats.map((colour) => flatDepositedPaint(technique, base, colour)) as [string, string, string],
    passes, amount: f.amount, detail: Boolean(input.detail),
    light: Number.isFinite(input.experiment?.light) ? clamp(input.experiment!.light, -80, 80) : -35,
    lighting: phase === "light" || Boolean(input.experiment?.lighting),
  };
}
