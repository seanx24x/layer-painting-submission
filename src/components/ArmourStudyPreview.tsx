"use client";

import { useState } from "react";
import { MiniatureViewer } from "./MiniatureViewer";
import type { Guide } from "@/lib/guides";

const stages = [
  {
    label: "Base colour",
    title: "Start with an even blue foundation",
    description:
      "Macragge Blue covers the armour panels. Keep each coat thin so the sculpted detail stays clear.",
  },
  {
    label: "Recess shade",
    title: "Separate the armour plates",
    description:
      "Dark shade defines the joins while the broad panels stay blue. The recipe uses Abaddon Black with a little Nuln Oil.",
  },
  {
    label: "Edge highlights",
    title: "Bring the armour edges into focus",
    description:
      "Altdorf Guard Blue defines blue armour plate rims and helmet ridges. A finer Fenrisian Grey accent adds the final highlight.",
  },
];

/** Compare digital paint stages on the sculpt's authored armour regions. */
export function ArmourStudyPreview({ guide }: { guide: Guide }) {
  const [stage, setStage] = useState(0);
  const [focus, setFocus] = useState<"model" | "shoulder" | "helmet">("model");
  const colour = (paintId: string) =>
    guide.paints.find((paint) => paint.id === paintId)!.hex;
  const base = colour("macragge-blue");
  const edge = colour("altdorf-guard-blue");
  const fine = colour("fenrisian-grey");
  const dark = colour("abaddon-black");
  return (
    <section className="armour-preview" aria-label="Preview the armour study">
      <div className="armour-preview-heading">
        <span>The armour study</span>
        <span>Compare the layers</span>
      </div>
      <MiniatureViewer
        baseColor={base}
        edgeColor={edge}
        fineColor={fine}
        recessColor={dark}
        stage={stage === 0 ? "base" : stage === 1 ? "shade" : "fine"}
        focusTarget={focus}
        context="overview"
        sequenceKey={`preview-${stage}`}
      />
      <div
        className="armour-stage-buttons"
        role="group"
        aria-label="Compare armour paint stages"
      >
        {stages.map((item, index) => (
          <button
            key={item.label}
            aria-pressed={stage === index}
            onClick={() => {
              setStage(index);
              setFocus(index === 0 ? "model" : "helmet");
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="armour-stage-caption" aria-live="polite">
        <strong>{stages[stage].title}</strong>
        <p>{stages[stage].description}</p>
      </div>
      <p className="armour-preview-note">
        A digital colour study of the blue armour. Gold trim, weapon and other
        details are shown finished for context; this lesson focuses on armour.
      </p>
    </section>
  );
}
