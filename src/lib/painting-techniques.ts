import type { TechniqueId } from "./technique-study-types";

export const STUDY_DURATION = 24;
export const TECHNIQUE_ORDER: readonly TechniqueId[] = ["layers", "edges", "recess", "drybrush"];

export type PaintingStage = {
  name: string;
  detail: string;
  colour: string;
  start: number;
  end: number;
  instruction: string;
  cue: string;
};

export type PaintingTechniqueStudy = {
  id: TechniqueId;
  label: string;
  surface: string;
  heading: readonly [string, string];
  intro: string;
  preparation: string;
  result: string;
  disclosure: string;
  stages: readonly [PaintingStage, PaintingStage, PaintingStage];
};

export const PAINTING_TECHNIQUES: Record<TechniqueId, PaintingTechniqueStudy> = {
  layers: {
    id: "layers",
    label: "Thin layers",
    surface: "Curved panel",
    heading: ["Thin layers.", "Convincing depth."],
    intro: "Learn to prepare your paint, control the brush and build depth. Six quiet chapters. One surface.",
    preparation: "Begin with a primed surface",
    result: "Three layers, one surface",
    disclosure: "An illustrative study of brush contact, coverage and layering. In practice, let each coat dry before adding the next.",
    stages: [
      {
        name: "First coat",
        detail: "Build the foundation",
        colour: "#285cdf",
        start: 2,
        end: 10,
        instruction: "Let a little of the surface show through. Overlapping strokes build a thin, even foundation without covering everything at once.",
        cue: "Light pressure. Overlapping strokes.",
      },
      {
        name: "Second coat",
        detail: "Deepen the coverage",
        colour: "#285cdf",
        start: 11.2,
        end: 17,
        instruction: "Follow the curve with another light coat. Notice how the colour becomes richer where the strokes overlap the first layer.",
        cue: "Same direction. A little more coverage.",
      },
      {
        name: "Light-facing highlight",
        detail: "Bring the surface to life",
        colour: "#599ddd",
        start: 17.8,
        end: 21.4,
        instruction: "Introduce a lighter paint with a gentle pass. A translucent layer keeps the colour beneath visible and softens the transition.",
        cue: "A lighter colour. A softer touch.",
      },
    ],
  },
  edges: {
    id: "edges",
    label: "Edge highlighting",
    surface: "Folded edge",
    heading: ["Follow the edge.", "Find the shape."],
    intro: "A simple form makes each edge easy to see. Follow three increasingly delicate highlights as they give the shape definition.",
    preparation: "Begin with a dry basecoat",
    result: "Brighter edges, defined corners",
    disclosure: "An illustrative study of edge placement and progressively finer highlights. In practice, let each layer dry before adding the next.",
    stages: [
      {
        name: "First highlight",
        detail: "Define the raised edges",
        colour: "#70a7e5",
        start: 2,
        end: 10,
        instruction: "Use the side of the brush against an accessible raised edge. Follow its shape with a controlled highlight, keeping the broad faces clear.",
        cue: "Light contact. Follow the edge.",
      },
      {
        name: "Fine highlight",
        detail: "Leave the first line visible",
        colour: "#c1dcf1",
        start: 11.2,
        end: 17,
        instruction: "Add a narrower, lighter line along the first highlight. Leave some of the earlier colour visible beside it so the colours form a gradual transition.",
        cue: "A finer line inside the first.",
      },
      {
        name: "Corner accents",
        detail: "Keep the brightest marks small",
        colour: "#e0edf7",
        start: 17.8,
        end: 21.4,
        instruction: "Place small, bright touches on selected corners. Reserve the brightest accents for light-facing corners. Match darker edges with a quieter highlight instead of outlining everything equally.",
        cue: "Small touches. Selected corners.",
      },
    ],
  },
  recess: {
    id: "recess",
    label: "Recess shading",
    surface: "Recessed tile",
    heading: ["Follow the gaps.", "Reveal the depth."],
    intro: "Let the grooves guide you. Watch a controlled shade separate the raised surfaces while keeping their base colour visible.",
    preparation: "Begin with a dry basecoat",
    result: "Darker grooves, clearer texture",
    disclosure: "An illustrative study of placing shade in recesses. The animation does not simulate paint flow. In practice, let each pass dry before adding more.",
    stages: [
      {
        name: "First grooves",
        detail: "Place shade in the recesses",
        colour: "#27515e",
        start: 2,
        end: 10,
        instruction: "Bring a small amount of shade to the groove with the brush tip. Work along the recessed line and keep the raised surfaces clear.",
        cue: "A small amount. Inside the groove.",
      },
      {
        name: "Join the shadows",
        detail: "Connect the recessed lines",
        colour: "#234651",
        start: 11.2,
        end: 17,
        instruction: "Continue along the remaining grooves. Keep each pass narrow so the recessed lines read together without flooding the raised texture.",
        cue: "Follow the joins. Keep the tops clear.",
      },
      {
        name: "Refine the depth",
        detail: "Strengthen selected recesses",
        colour: "#17343f",
        start: 17.8,
        end: 21.4,
        instruction: "Check the dried shade, then deepen selected recesses with another light pass. Preserve the base colour above them so the separation stays clear.",
        cue: "Deepen the gaps, preserve the surface.",
      },
    ],
  },
  drybrush: {
    id: "drybrush",
    label: "Drybrushing",
    surface: "Ridged tile",
    heading: ["Catch the texture.", "Keep the depth."],
    intro: "Less paint on the brush, more definition on the surface. Sweep lightly across the texture and watch the raised details emerge.",
    preparation: "Begin with a dry basecoat",
    result: "Lighter ridges, darker recesses",
    disclosure: "An illustrative study of raised-surface contact. In practice, remove most paint from the brush, test the mark, and let each pass dry before building more colour.",
    stages: [
      {
        name: "First sweep",
        detail: "Catch the raised texture",
        colour: "#70a9ae",
        start: 2,
        end: 10,
        instruction: "For this controlled-moisture method, start with slightly damp bristles, not a wet brush. Remove most paint on a non-absorbent textured palette and test the mark before touching the model. Sweep lightly across the ridges so colour catches the raised surfaces.",
        cue: "Very little paint. A light sweep.",
      },
      {
        name: "Build the texture",
        detail: "Add coverage gradually",
        colour: "#8ac0c2",
        start: 11.2,
        end: 17,
        instruction: "Repeat gentle sweeps to build the colour gradually. Let the brush skim the texture without pressing down into the darker gaps.",
        cue: "Build slowly. Leave the gaps dark.",
      },
      {
        name: "Final highlights",
        detail: "Lift the highest points",
        colour: "#d0dddd",
        start: 17.8,
        end: 21.4,
        instruction: "Use a little of a lighter colour for the final passes. Focus on the most raised details and keep some of the earlier colour visible underneath.",
        cue: "Lighter colour. Less contact.",
      },
    ],
  },
};
