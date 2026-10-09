import sourcedPaints from "@/data/guide-paints.json";
import type { Guide, GuidePaint, GuideTechnique } from "./guides";

export interface FactionGuideDefinition {
  id: string;
  slug: string;
  title: string;
  faction: string;
  setting: string;
  scheme: string;
  description: string;
  level: string;
  accent: string;
  paintNames: { name: string; role: string; range?: string }[];
  prerequisites: string[];
  tools: string[];
  learning: string[];
  sources: Guide["sources"];
  steps: {
    id: string;
    title: string;
    action: string;
    detail: string;
    lookFor: string;
    simpleExplanation: string;
    technique: string;
    paintNames: string[];
    sourceIds: string[];
    exampleIds?: string[];
  }[];
}

const techniques = new Set<GuideTechnique>(["basecoat", "drybrush", "wash", "highlight", "finish"]);

/** Names resolve to a generated manufacturer subset, never guessed RGB values. */
export function factionGuide(definition: FactionGuideDefinition): Guide {
  const { paintNames, steps, ...metadata } = definition;
  if (metadata.setting !== "warhammer-40k" && metadata.setting !== "horus-heresy") {
    throw new Error(`Invalid universe: ${metadata.id}`);
  }
  const paints: GuidePaint[] = paintNames.map(({ name, role, range }) => {
    const matches = Object.entries(sourcedPaints).filter(([, paint]) => paint.name === name && (!range || paint.range === range));
    if (matches.length !== 1) throw new Error(`${metadata.id}: unresolved paint ${name}. Run paints:sync-guides.`);
    const [id, paint] = matches[0];
    return { id, ...paint, role };
  });
  return {
    ...metadata,
    setting: metadata.setting,
    style: "classic",
    featured: false,
    paletteNote: "Warhammer swatches are digitised from the manufacturer’s 2025 chart. Screen colours are approximate; metallic sparkle and translucent finishes cannot be represented by a flat swatch.",
    editorialNote: "An original Layer brush study of the faction colours shown in the linked references. Paint choices and teaching steps are our interpretation, not an official studio recipe. This named scheme is one option within the faction; the description defines what the exercise covers.",
    paints,
    steps: steps.map(({ paintNames: names, technique, ...step }) => {
      if (!techniques.has(technique as GuideTechnique)) throw new Error(`${metadata.id}/${step.id}: invalid technique`);
      return {
        ...step,
        technique: technique as GuideTechnique,
        paintIds: names.map((name) => {
          const paint = paints.find((candidate) => candidate.name === name);
          if (!paint) throw new Error(`${metadata.id}/${step.id}: missing palette paint ${name}`);
          return paint.id;
        }),
      };
    }),
  };
}
