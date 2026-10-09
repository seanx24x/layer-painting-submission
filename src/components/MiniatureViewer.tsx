"use client";

import { useState, useSyncExternalStore } from "react";
import { Expand, Focus, Rotate3D } from "lucide-react";
import { MiniatureScene } from "./MiniatureScene";
import "./miniature-viewer.css";

type FocusTarget = "model" | "shoulder" | "helmet";
type Perspective = "front" | "three-quarter" | "side";
type Stage = "primer" | "base" | "shade" | "edge" | "fine";
type Technique =
  "base" | "recess" | "tidy" | "edge" | "fine" | "drybrush" | "finish";

function subscribeMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

const focusLabels: Record<FocusTarget, string> = {
  model: "Whole miniature",
  shoulder: "Shoulder detail",
  helmet: "Helmet detail",
};

export type MiniatureViewerProps = {
  baseColor: string;
  edgeColor: string;
  fineColor: string;
  recessColor?: string;
  stage: Stage;
  technique?: Technique;
  progress?: number;
  playing?: boolean;
  paused?: boolean;
  staticMode?: boolean;
  staticStep?: number;
  reducedMotion?: boolean;
  context?: "overview" | "lesson";
  sequenceKey?: string;
  focusTarget?: FocusTarget;
  onInteract?: () => void;
};

/** Shared camera vocabulary for the outcome preview and each painting step. */
export function MiniatureViewer({
  baseColor,
  edgeColor,
  fineColor,
  recessColor,
  stage,
  technique,
  progress = 0,
  playing = false,
  paused = false,
  staticMode = false,
  staticStep = 0,
  reducedMotion = false,
  context = "lesson",
  sequenceKey = "preview",
  focusTarget = "model",
  onInteract,
}: MiniatureViewerProps) {
  const systemReducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const [perspective, setPerspective] = useState<Perspective>("three-quarter");
  const [manualView, setManualView] = useState<{
    key: string;
    focus: FocusTarget;
  } | null>(null);
  const [wasPlaying, setWasPlaying] = useState(playing);
  if (wasPlaying !== playing) {
    setWasPlaying(playing);
    if (playing) setManualView(null);
  }
  const key = `${sequenceKey}-${focusTarget}-${staticMode ? staticStep : "animation"}`;
  const lessonFocus: FocusTarget = technique === "edge" || technique === "fine" ? "helmet" : "shoulder";
  // Locate first, demonstrate after the camera settles, then recover context.
  const automaticFocus: FocusTarget =
    context === "overview"
      ? focusTarget
      : staticMode
        ? staticStep === 0
          ? "model"
          : lessonFocus
        : progress > 0 && progress < 0.86
          ? lessonFocus
          : "model";
  const focus =
    !playing && manualView?.key === key ? manualView.focus : automaticFocus;
  const paintProgress = staticMode
    ? [0, 0.5, 1][staticStep]
    : Math.max(0, Math.min(1, (progress - 0.18) / 0.62));
  const phase =
    context === "overview"
      ? "Explore the sculpt"
      : staticMode
        ? ["Locate the surface", `Study the ${lessonFocus}`, "Inspect the detail"][
            staticStep
          ]
        : progress === 0
          ? "Start with the whole miniature"
          : progress < 0.18
            ? `Move closer to the ${lessonFocus}`
            : progress < 0.8
              ? `Study the ${lessonFocus} detail`
              : "Return to the whole miniature";

  function chooseFocus(next: FocusTarget) {
    onInteract?.();
    setManualView({ key, focus: next });
  }

  return (
    <div className={`miniature-viewer miniature-viewer--${context}`}>
      <div className="miniature-viewer__scene-wrap">
        <MiniatureScene
          baseColor={baseColor}
          edgeColor={edgeColor}
          fineColor={fineColor}
          recessColor={recessColor}
          stage={stage}
          focus={focus}
          perspective={perspective}
          technique={technique}
          progress={paintProgress}
          cameraPaused={paused && !staticMode && manualView?.key !== key}
          reducedMotion={staticMode || reducedMotion || systemReducedMotion}
        />
        <div className="miniature-viewer__location" aria-hidden="true">
          <span className="miniature-viewer__location-dot" />
          {focusLabels[focus]}
        </div>
        <div className="miniature-viewer__annotation" aria-hidden="true">
          <span>
            {perspective === "three-quarter"
              ? "¾"
              : perspective === "front"
                ? "F"
                : "S"}
          </span>
          <span>{focus === "model" ? "Context" : "Detail"}</span>
        </div>
      </div>
      <div className="miniature-viewer__toolbar">
        <div
          className="miniature-viewer__focus"
          role="group"
          aria-label="Model focus"
        >
          <button
            type="button"
            aria-pressed={focus === "model"}
            onClick={() => chooseFocus("model")}
          >
            <Expand size={13} aria-hidden="true" />
            Whole model
          </button>
          <button
            type="button"
            aria-pressed={focus === "shoulder"}
            onClick={() => chooseFocus("shoulder")}
          >
            <Focus size={13} aria-hidden="true" />
            Shoulder
          </button>
          {(
            <button
              type="button"
              aria-pressed={focus === "helmet"}
              onClick={() => chooseFocus("helmet")}
            >
              Helmet
            </button>
          )}
        </div>
        <div
          className="miniature-viewer__angles"
          role="group"
          aria-label="Model perspective"
        >
          <Rotate3D size={13} aria-hidden="true" />
          {(["front", "three-quarter", "side"] as const).map((angle) => (
            <button
              type="button"
              key={angle}
              aria-label={`${angle === "three-quarter" ? "Three-quarter" : angle === "front" ? "Front" : "Side"} view`}
              aria-pressed={perspective === angle}
              onClick={() => {
                onInteract?.();
                setPerspective(angle);
                setManualView({ key, focus });
              }}
            >
              {angle === "three-quarter"
                ? "¾"
                : angle === "front"
                  ? "Front"
                  : "Side"}
            </button>
          ))}
        </div>
      </div>
      <p className="miniature-viewer__phase" role="status">
        {playing ? phase : focusLabels[focus]}
        <span className="miniature-viewer__credit">
          <a href="https://www.nexprint.com/en/models/G6817715" target="_blank" rel="noreferrer">Sculpt: DicamoCM</a>
          <a href="/models/primaris-space-marine-LICENSE.txt" target="_blank" rel="noreferrer">CC BY 4.0</a>
        </span>
      </p>
    </div>
  );
}
