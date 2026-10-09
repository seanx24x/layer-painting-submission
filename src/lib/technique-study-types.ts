import type { WorkshopExperiment } from "./workshop";
import type * as THREE from "three";

export type TechniqueId = "layers" | "edges" | "recess" | "drybrush";

export type StudyComparison = "coverage" | "load" | "light" | "result" | "recess" | "drybrush";

/** A surface and its authored brush sequence, centred at the origin. */
export type TechniqueSurface = {
  group: THREE.Group;
  update: (time: number, experiment?: WorkshopExperiment) => void;
  dispose: () => void;
};
