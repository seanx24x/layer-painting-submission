"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { MiniatureViewer } from "./MiniatureViewer";

export type PaintingTechnique =
  "basecoat" | "drybrush" | "wash" | "highlight" | "finish";

export type ArmourVariant = "base" | "recess" | "tidy" | "edge" | "fine";

export type TechniqueDemoProps = {
  technique: PaintingTechnique;
  baseColor?: string;
  highlightColor?: string;
  variant?: ArmourVariant;
  /** The preceding recess colour for tidy, or wider highlight colour for fine. */
  previousColor?: string;
  recessColor?: string;
  paintLabel?: string;
};

type Lesson = {
  label: string;
  action: string;
  result: string;
  stages: [string, string, string];
  stageDetails?: [string, string, string];
  target: string;
  direction?: string;
};

const LESSONS: Record<PaintingTechnique, Lesson> = {
  basecoat: {
    label: "Build an even base",
    action: "The brush passes over the surface, building a layer of colour.",
    result: "The base colour covers both raised details and lower surfaces.",
    stages: ["Prepared surface", "Apply the colour", "An even base"],
    target: "Whole surface",
  },
  drybrush: {
    label: "Catch the raised details",
    action: "The brush travels across the texture, catching the raised faces.",
    result:
      "Lighter colour remains on the raised details. Recesses stay darker.",
    stages: ["Find the texture", "Brush across it", "Raised details emerge"],
    target: "Raised details",
  },
  wash: {
    label: "Define the recesses",
    action: "The darker colour gathers between the raised details.",
    result: "Darker recesses help separate the shapes on the surface.",
    stages: ["Find the recesses", "Guide the shade", "More definition"],
    target: "Recesses",
  },
  highlight: {
    label: "Pick out the edges",
    action: "The brush follows the raised edges with a lighter colour.",
    result: "A narrow highlight makes each edge easier to read.",
    stages: ["Find the edges", "Follow the edge", "A clearer shape"],
    target: "Raised edges",
  },
  finish: {
    label: "Bring the finish together",
    action: "A final, even pass moves across the painted surface.",
    result: "Compare the surface and check that the finish is consistent.",
    stages: ["Review the surface", "An even pass", "Check the finish"],
    target: "Painted surface",
  },
};

const ARMOUR_LESSONS: Record<ArmourVariant, Lesson> = {
  base: {
    label: "Cover the flat armour",
    action: "Work across the flat panels, building an even base colour.",
    result: "Check for even coverage, then let the base colour dry.",
    stages: ["Start with primer", "Cover the panels", "Check coverage"],
    stageDetails: [
      "Begin with dry primer on the armour, shown in grey. Other details are already coloured for reference.",
      "Move across each panel, spreading the base colour evenly.",
      "Look for an even base before moving on. Let each coat dry.",
    ],
    target: "Flat panels",
    direction: "Across the panel",
  },
  recess: {
    label: "Guide the shade into the seam",
    action:
      "Follow the narrow recess with the brush tip. Keep the surrounding panels blue.",
    result: "The seam is darker, while the flat armour keeps its base colour.",
    stages: ["Find the seam", "Follow the recess", "Keep panels clear"],
    stageDetails: [
      "Find the recessed line between the two plates.",
      "Draw the brush tip along the seam, keeping the shade inside it.",
      "Check that the recess is defined and the flat panels still show their base colour.",
    ],
    target: "Inside the seam",
    direction: "Down the recess",
  },
  tidy: {
    label: "Tidy around the recess",
    action:
      "Cover stray shade on the flat panel with the base colour. Keep the dark seam visible.",
    result:
      "The spill is covered. The dark line inside the recess remains intact.",
    stages: ["Spot the spill", "Restore the base", "Preserve the seam"],
    stageDetails: [
      "Notice the stray dark paint beside the seam. The dark recess itself should stay.",
      "Use the base colour over the spill on the flat panel, stopping before the recess.",
      "The panel is tidy again, with the dark seam still separating the plates.",
    ],
    target: "Spill on the panel",
    direction: "Beside the recess",
  },
  edge: {
    label: "Follow the raised edge",
    action:
      "Run the brush along a blue armour plate rim or helmet ridge to place the first highlight.",
    result: "A lighter line defines the edge of the blue armour.",
    stages: ["Find an armour edge", "Trace the edge", "Check the line"],
    stageDetails: [
      "Choose a raised edge on the blue armour, such as a plate rim or helmet ridge. The gold shoulder trim stays gold.",
      "Follow the blue armour edge with the first highlight colour.",
      "Look for a controlled lighter line that makes the armour edge easier to read.",
    ],
    target: "Blue armour edges",
    direction: "Along an armour edge",
  },
  fine: {
    label: "Add a finer highlight",
    action:
      "Place a narrower light line inside the first highlight, leaving the previous colour visible.",
    result:
      "The fine light line sits within the wider first highlight. Both colours remain visible.",
    stages: ["Keep the first line", "Add a finer line", "See both colours"],
    stageDetails: [
      "The wider first highlight is already in place along the blue armour edge.",
      "Follow it with a narrower, lighter line, leaving some of the previous highlight showing.",
      "Check that the first highlight remains visible around the fine line.",
    ],
    target: "Inside the first line",
    direction: "Along the existing highlight",
  },
};

const SURFACE_DURATION = 4200;
const MODEL_DURATION = 6500;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeInOut = (value: number) => value * value * (3 - 2 * value);

function subscribeToMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** An original, abstract teaching diagram, not a simulation of paint behaviour. */
function SurfaceIllustration({
  technique,
  progress,
  baseColor,
  highlightColor,
  showBrush = true,
}: Required<
  Pick<TechniqueDemoProps, "technique" | "baseColor" | "highlightColor">
> & {
  progress: number;
  showBrush?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const coverage = clamp((progress - 0.12) / 0.72);
  const sweep = clamp((progress - 0.06) / 0.82);
  const shade = technique === "basecoat" ? "#bac5ce" : baseColor;
  const brushX =
    technique === "wash"
      ? 300 + Math.sin(sweep * Math.PI * 2) * 23
      : 163 + sweep * 292;
  const brushY =
    technique === "wash"
      ? 83 + sweep * 140
      : technique === "highlight"
        ? 99 + Math.sin(sweep * Math.PI) * 3
        : 153 +
          Math.sin(sweep * Math.PI * (technique === "drybrush" ? 4 : 2)) * 14;
  const brushOpacity =
    progress < 0.88 ? 1 : 1 - clamp((progress - 0.88) / 0.12);
  const ridges = [186, 247, 308, 369];

  return (
    <svg
      viewBox="0 0 600 300"
      className="technique-demo__scene"
      role="img"
      aria-label={`${LESSONS[technique].label}. Abstract illustration of paint on a ridged surface.`}
    >
      <defs>
        <linearGradient id={`${id}-surface`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#fff" stopOpacity=".35" />
          <stop offset=".55" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#102236" stopOpacity=".21" />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" x2="1">
          <stop stopColor="#c6ccd2" />
          <stop offset=".32" stopColor="#fafcfe" />
          <stop offset=".6" stopColor="#b2bac4" />
          <stop offset="1" stopColor="#75808e" />
        </linearGradient>
        <linearGradient id={`${id}-finish`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".24" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}-paint`}>
          {technique === "wash" ? (
            <rect x="150" y="78" width="295" height={coverage * 155} />
          ) : (
            <rect x="151" y="70" width={coverage * 298} height="172" />
          )}
        </clipPath>
      </defs>

      <ellipse
        cx="300"
        cy="250"
        rx="160"
        ry="10"
        fill="#152b43"
        opacity=".055"
      />
      <rect x="157" y="85" width="286" height="151" rx="23" fill="#637587" />
      <rect x="157" y="76" width="286" height="151" rx="23" fill={shade} />
      <rect
        x="157"
        y="76"
        width="286"
        height="151"
        rx="23"
        fill={`url(#${id}-surface)`}
      />
      <rect
        x="162"
        y="81"
        width="276"
        height="141"
        rx="19"
        fill="none"
        stroke="#fff"
        strokeOpacity=".22"
      />

      {ridges.map((x) => (
        <g key={x}>
          <rect
            x={x + 3}
            y="100"
            width="32"
            height="112"
            rx="9"
            fill="#10233a"
            opacity=".2"
          />
          <rect x={x} y="92" width="32" height="112" rx="9" fill={shade} />
          <rect
            x={x}
            y="92"
            width="32"
            height="112"
            rx="9"
            fill={`url(#${id}-surface)`}
          />
          <path
            d={`M${x + 5} 192 V102 Q${x + 5} 97 ${x + 11} 97 H${x + 23}`}
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeOpacity=".25"
            strokeLinecap="round"
          />
        </g>
      ))}

      <g clipPath={`url(#${id}-paint)`}>
        {technique === "basecoat" && (
          <g>
            <rect
              x="157"
              y="76"
              width="286"
              height="151"
              rx="23"
              fill={baseColor}
            />
            <rect
              x="157"
              y="76"
              width="286"
              height="151"
              rx="23"
              fill={`url(#${id}-surface)`}
            />
            {ridges.map((x) => (
              <g key={x}>
                <rect
                  x={x + 3}
                  y="100"
                  width="32"
                  height="112"
                  rx="9"
                  fill="#10233a"
                  opacity=".2"
                />
                <rect
                  x={x}
                  y="92"
                  width="32"
                  height="112"
                  rx="9"
                  fill={baseColor}
                />
                <rect
                  x={x}
                  y="92"
                  width="32"
                  height="112"
                  rx="9"
                  fill={`url(#${id}-surface)`}
                />
                <path
                  d={`M${x + 5} 192 V102 Q${x + 5} 97 ${x + 11} 97 H${x + 23}`}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeOpacity=".25"
                  strokeLinecap="round"
                />
              </g>
            ))}
          </g>
        )}
        {technique === "drybrush" &&
          ridges.map((x) => (
            <g key={x}>
              <rect
                x={x + 1}
                y="93"
                width="29"
                height="105"
                rx="8"
                fill={highlightColor}
                opacity=".63"
              />
              <path
                d={`M${x + 4} 188 V101 Q${x + 4} 97 ${x + 10} 97 H${x + 24}`}
                fill="none"
                stroke={highlightColor}
                strokeWidth="3"
                strokeLinecap="round"
              />
              {[109, 132, 155, 181].map((y) => (
                <path
                  key={y}
                  d={`M${x + 7} ${y} l12 -1`}
                  stroke={highlightColor}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity=".7"
                />
              ))}
            </g>
          ))}
        {technique === "wash" && (
          <g fill={highlightColor} opacity=".54">
            {[225, 286, 347, 408].map((x) => (
              <rect key={x} x={x} y="105" width="11" height="103" rx="5" />
            ))}
            <path
              d="M173 208 Q173 216 184 216 H419 Q429 216 429 206"
              fill="none"
              stroke={highlightColor}
              strokeWidth="7"
              strokeLinecap="round"
            />
          </g>
        )}
        {technique === "highlight" &&
          ridges.map((x) => (
            <path
              key={x}
              d={`M${x + 3} 117 V102 Q${x + 3} 95 ${x + 10} 95 H${x + 24}`}
              fill="none"
              stroke={highlightColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        {technique === "finish" && (
          <g>
            <rect
              x="160"
              y="79"
              width="280"
              height="145"
              rx="21"
              fill={`url(#${id}-finish)`}
            />
            {ridges.map((x) => (
              <path
                key={x}
                d={`M${x + 4} 114 V102 Q${x + 4} 96 ${x + 11} 96 H${x + 24}`}
                fill="none"
                stroke={highlightColor}
                strokeWidth="2"
                strokeLinecap="round"
                opacity=".75"
              />
            ))}
          </g>
        )}
      </g>

      <g fill="#334a60" opacity=".35">
        <circle cx="173" cy="92" r="2.2" />
        <circle cx="427" cy="92" r="2.2" />
        <circle cx="173" cy="211" r="2.2" />
        <circle cx="427" cy="211" r="2.2" />
      </g>

      {showBrush && (
        <g
          transform={`translate(${brushX} ${brushY}) rotate(34)`}
          opacity={brushOpacity}
        >
          <ellipse cx="0" cy="5" rx="15" ry="6" fill="#0d253e" opacity=".11" />
          <path
            d="M-9 -30 H9 C10 -15 7 -4 0 5 C-7 -4 -10 -15 -9 -30Z"
            fill="#8b6744"
          />
          <path
            d="M-7 -17 C-5 -6 -3 0 0 5 C4 -1 6 -9 7 -17Z"
            fill={technique === "basecoat" ? baseColor : highlightColor}
          />
          <path
            d="M-4 -27 L-2 -8 M0 -28 V-8 M4 -27 L2 -8"
            stroke="#e4d0a8"
            strokeWidth=".75"
            opacity=".6"
          />
          <path
            d="M-9 -61 H9 L9 -29 Q0 -25 -9 -29Z"
            fill={`url(#${id}-metal)`}
          />
          <path d="M-8 -56 H8 M-8 -33 H8" stroke="#6e7c8b" strokeOpacity=".5" />
          <path d="M-9 -62 L-6 -138 Q0 -152 6 -138 L9 -62Z" fill="#263849" />
          <path
            d="M-4 -132 L-5 -70"
            stroke="#fff"
            strokeOpacity=".2"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path d="M-8 -65 H8" stroke="#8398ad" strokeWidth="2" />
        </g>
      )}
    </svg>
  );
}

const LEFT_PANEL = "M213 83 H294 V235 H247 L202 204 L185 111 Z";
const RIGHT_PANEL = "M306 83 H387 L415 111 L398 204 L353 235 H306 Z";
const ARMOUR_OUTLINE =
  "M211 78 H389 L423 110 L405 209 L356 245 H244 L195 209 L177 110 Z";
const EDGE_PATH = "M204 199 L190 112 L215 88 H286";
const EDGE_POINTS = [
  [204, 199],
  [190, 112],
  [215, 88],
  [286, 88],
];
const EDGE_SEGMENTS = EDGE_POINTS.slice(1).map((point, index) => ({
  start: EDGE_POINTS[index],
  end: point,
  length: Math.hypot(
    point[0] - EDGE_POINTS[index][0],
    point[1] - EDGE_POINTS[index][1],
  ),
}));
const EDGE_LENGTH = EDGE_SEGMENTS.reduce(
  (sum, segment) => sum + segment.length,
  0,
);

function pointOnEdge(progress: number) {
  let distance = progress * EDGE_LENGTH;
  for (const segment of EDGE_SEGMENTS) {
    if (distance <= segment.length) {
      const fraction = distance / segment.length;
      return {
        x: segment.start[0] + (segment.end[0] - segment.start[0]) * fraction,
        y: segment.start[1] + (segment.end[1] - segment.start[1]) * fraction,
      };
    }
    distance -= segment.length;
  }
  return { x: 286, y: 88 };
}

/** Original schematic: paint placement and layer order, not fluid or brush simulation. */
function ArmourIllustration({
  variant,
  baseColor,
  highlightColor,
  previousColor,
  recessColor,
  progress,
  showBrush,
}: {
  variant: ArmourVariant;
  baseColor: string;
  highlightColor: string;
  previousColor?: string;
  recessColor?: string;
  progress: number;
  showBrush: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const paintProgress = easeInOut(clamp((progress - 0.14) / 0.7));
  const edge = pointOnEdge(paintProgress);
  const currentColour = variant === "base" ? baseColor : highlightColor;
  const isEdge = variant === "edge" || variant === "fine";
  const brush = isEdge
    ? edge
    : variant === "recess"
      ? { x: 300, y: 88 + paintProgress * 142 }
      : variant === "tidy"
        ? { x: 282, y: 105 + paintProgress * 100 }
        : { x: 174 + paintProgress * 252, y: 157 };
  const brushOpacity =
    clamp(progress / 0.1) * (1 - clamp((progress - 0.85) / 0.1));

  return (
    <svg
      viewBox="0 0 600 300"
      className="technique-demo__scene"
      role="img"
      aria-label={`${ARMOUR_LESSONS[variant].label}. Original diagram of two armour panels and the seam between them.`}
    >
      <defs>
        <clipPath id={`${id}-panels`}>
          <path d={LEFT_PANEL} />
          <path d={RIGHT_PANEL} />
        </clipPath>
        <clipPath id={`${id}-base-pass`}>
          <rect x="174" y="76" width={paintProgress * 252} height="172" />
        </clipPath>
        <clipPath id={`${id}-tidy-pass`}>
          <rect x="272" y="101" width="22" height={paintProgress * 108} />
        </clipPath>
        <linearGradient id={`${id}-armour-light`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" stopOpacity=".1" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".12" />
        </linearGradient>
        <linearGradient id={`${id}-ferrule`} x1="0" x2="1">
          <stop stopColor="#a6b0bb" />
          <stop offset=".45" stopColor="#ecf0f4" />
          <stop offset="1" stopColor="#8794a0" />
        </linearGradient>
      </defs>

      <ellipse cx="300" cy="256" rx="121" ry="8" fill="#203448" opacity=".06" />
      <path
        d={ARMOUR_OUTLINE}
        fill={variant === "base" ? "#909da8" : baseColor}
      />
      <path d={ARMOUR_OUTLINE} fill="#000" opacity=".24" />
      {variant === "base" && (
        <g clipPath={`url(#${id}-base-pass)`}>
          <path d={ARMOUR_OUTLINE} fill={baseColor} />
          <path d={ARMOUR_OUTLINE} fill="#000" opacity=".24" />
        </g>
      )}
      <g fill={variant === "base" ? "#c5cdd3" : baseColor}>
        <path d={LEFT_PANEL} />
        <path d={RIGHT_PANEL} />
      </g>
      {variant === "base" && (
        <g clipPath={`url(#${id}-base-pass)`} fill={baseColor}>
          <path d={LEFT_PANEL} />
          <path d={RIGHT_PANEL} />
        </g>
      )}

      {/* The seam is separate from the flat panels. The tidy pass cannot cover it. */}
      {variant === "recess" && paintProgress > 0 && (
        <path
          d="M300 86 V232"
          stroke={currentColour}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="146 146"
          strokeDashoffset={146 * (1 - paintProgress)}
        />
      )}
      {variant === "tidy" && (
        <>
          <path
            d="M300 86 V232"
            stroke={recessColor ?? previousColor ?? "#17202a"}
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M286 111 Q276 131 285 152 Q279 172 286 198"
            fill="none"
            stroke={recessColor ?? previousColor ?? "#17202a"}
            strokeWidth="11"
            strokeLinecap="round"
          />
          <g clipPath={`url(#${id}-tidy-pass)`}>
            <path d={LEFT_PANEL} fill={currentColour} />
          </g>
        </>
      )}
      <g clipPath={`url(#${id}-panels)`}>
        <rect
          x="180"
          y="80"
          width="240"
          height="160"
          fill={`url(#${id}-armour-light)`}
        />
      </g>

      {isEdge && (
        <path
          d="M300 86 V232"
          stroke={recessColor ?? "#17202a"}
          strokeWidth="8"
          strokeLinecap="round"
        />
      )}

      {/* A wider previous line remains visible on both sides of the fine line. */}
      {variant === "fine" && (
        <path
          d={EDGE_PATH}
          fill="none"
          stroke={previousColor ?? baseColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {isEdge && (
        <>
          {variant === "edge" && (
            <path
              d={EDGE_PATH}
              fill="none"
              stroke="#fff"
              strokeWidth="1.5"
              strokeDasharray="3 5"
              strokeOpacity={0.55 * (1 - paintProgress)}
            />
          )}
          {paintProgress > 0 && (
            <path
              d={EDGE_PATH}
              fill="none"
              stroke={currentColour}
              strokeWidth={variant === "fine" ? 2.5 : 8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${EDGE_LENGTH} ${EDGE_LENGTH}`}
              strokeDashoffset={EDGE_LENGTH * (1 - paintProgress)}
            />
          )}
        </>
      )}

      {/* A quiet direction marker outside the model, independent of paint colour. */}
      <g
        stroke="#65798b"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".65"
      >
        {variant === "base" ? (
          <path d="M267 270 H330 M325 265 L330 270 L325 275" />
        ) : isEdge ? (
          <path d="M154 169 L145 114 L159 101 M152 102 L159 101 L158 108" />
        ) : (
          <path d="M446 137 V185 M441 180 L446 185 L451 180" />
        )}
      </g>

      {showBrush && (
        <g
          transform={`translate(${brush.x} ${brush.y}) rotate(42)`}
          opacity={brushOpacity}
        >
          <path d="M-4 -22 H4 Q4 -8 0 0 Q-4 -8 -4 -22Z" fill="#9b7953" />
          <path d="M-3 -12 L0 0 L3 -12Z" fill={currentColour} />
          <path d="M-5 -45 H5 L4 -21 H-4Z" fill={`url(#${id}-ferrule)`} />
          <path d="M-5 -45 L-3 -95 Q0 -101 3 -95 L5 -45Z" fill="#314557" />
          <path
            d="M-1 -91 V-53"
            stroke="#fff"
            strokeOpacity=".2"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}

function PlayIcon({ paused }: { paused: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      {paused ? (
        <>
          <rect x="4" y="3" width="3" height="10" rx=".6" />
          <rect x="9" y="3" width="3" height="10" rx=".6" />
        </>
      ) : (
        <path d="M5 2.7c0-.5.5-.8.9-.5l7.2 5.3c.4.2.4.8 0 1L5.9 13.8c-.4.3-.9 0-.9-.5V2.7Z" />
      )}
    </svg>
  );
}

type DemoMode = "animation" | "steps";

function TechniquePlayer({
  technique,
  baseColor = "#3976ba",
  highlightColor = "#b3d8f4",
  variant,
  previousColor,
  recessColor,
  paintLabel,
  mode,
  onModeChange,
  reducedMotion,
}: TechniqueDemoProps & {
  mode: DemoMode;
  onModeChange: (mode: DemoMode) => void;
  reducedMotion: boolean;
}) {
  const [status, setStatus] = useState<
    "idle" | "playing" | "paused" | "complete"
  >("idle");
  const [progress, setProgress] = useState(0);
  const [staticStep, setStaticStep] = useState(0);
  const [flatDiagram, setFlatDiagram] = useState(false);
  const sequenceKey = `${technique}-${variant}-${baseColor}-${highlightColor}-${previousColor}-${recessColor}-${paintLabel}`;
  const [observedSequence, setObservedSequence] = useState(sequenceKey);
  const [observedMode, setObservedMode] = useState(mode);
  const elapsed = useRef(0);
  const lesson = variant ? ARMOUR_LESSONS[variant] : LESSONS[technique];
  const captionId = useId();
  const sceneProgress = mode === "steps" ? [0, 0.52, 1][staticStep] : progress;
  const diagramProgress = variant
    ? 0.14 + clamp((sceneProgress - 0.18) / 0.62) * 0.7
    : sceneProgress;
  const showBrush = variant
    ? mode === "steps"
      ? staticStep === 1
      : progress > 0.18 && progress < 0.85
    : mode === "animation" || staticStep === 1;
  const duration = variant ? MODEL_DURATION : SURFACE_DURATION;
  const phase = sceneProgress < 0.18 ? 0 : sceneProgress < 0.8 ? 1 : 2;

  // Keep the viewer mounted when the lesson changes; only its demonstration resets.
  if (observedSequence !== sequenceKey) {
    setObservedSequence(sequenceKey);
    setStatus("idle");
    setProgress(0);
    setStaticStep(0);
  }
  if (observedMode !== mode) {
    setObservedMode(mode);
    if (status === "playing") setStatus("paused");
  }

  useEffect(() => {
    elapsed.current = 0;
  }, [sequenceKey]);

  useEffect(() => {
    if (status !== "playing" || mode !== "animation") return;
    let request = 0;
    let previous: number | null = null;
    function frame(time: number) {
      if (previous !== null) elapsed.current += Math.min(time - previous, 80);
      previous = time;
      const next = clamp(elapsed.current / duration);
      setProgress(next);
      if (next === 1) setStatus("complete");
      else request = window.requestAnimationFrame(frame);
    }
    function pauseWhenHidden() {
      if (document.hidden) setStatus("paused");
    }
    document.addEventListener("visibilitychange", pauseWhenHidden);
    request = window.requestAnimationFrame(frame);
    return () => {
      window.cancelAnimationFrame(request);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
  }, [status, mode, duration, sequenceKey]);

  function replay() {
    elapsed.current = 0;
    setProgress(0);
    setStatus("playing");
  }

  function togglePlayback() {
    if (status === "playing") setStatus("paused");
    else if (status === "complete") replay();
    else setStatus("playing");
  }

  function changeMode(nextMode: DemoMode) {
    if (status === "playing") setStatus("paused");
    onModeChange(nextMode);
  }

  const playControls =
    mode === "animation" ? (
      <div className="technique-demo__controls">
        <button
          type="button"
          className="technique-demo__play"
          onClick={togglePlayback}
          aria-label={
            status === "playing"
              ? "Pause technique illustration"
              : status === "paused"
                ? "Resume technique illustration"
                : status === "complete"
                  ? "Replay technique illustration"
                  : "Play technique illustration"
          }
        >
          <PlayIcon paused={status === "playing"} />
          {status === "playing"
            ? "Pause"
            : status === "paused"
              ? "Resume"
              : status === "complete"
                ? "Replay"
                : "Play"}
        </button>
        {(status === "paused" || status === "playing") && (
          <button
            type="button"
            className="technique-demo__replay"
            onClick={replay}
            aria-label="Restart technique illustration"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M3 6a5.25 5.25 0 1 1-.15 3.55M3 2.5V6h3.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    ) : null;

  return (
    <section
      className="technique-demo"
      aria-label={`${lesson.label}: ${variant ? "armour paint preview and brush study" : "technique illustration"}`}
    >
      <div className="technique-demo__heading">
        <span className="technique-demo__eyebrow">
          <span aria-hidden="true" />
          {variant ? "Armour colour study" : "Technique illustration"}
        </span>
        <span className="technique-demo__target">{lesson.target}</span>
      </div>

      <div className="technique-demo__options">
        <div
          className="technique-demo__modes"
          role="group"
          aria-label="Illustration view"
        >
          <button
            type="button"
            aria-pressed={mode === "animation"}
            onClick={() => changeMode("animation")}
          >
            Animation
          </button>
          <button
            type="button"
            aria-pressed={mode === "steps"}
            onClick={() => changeMode("steps")}
          >
            Step by step
          </button>
        </div>
        {variant ? (
          <button
            type="button"
            className="technique-demo__diagram-toggle"
            aria-pressed={flatDiagram}
            onClick={() => {
              if (status === "playing") setStatus("paused");
              setFlatDiagram(!flatDiagram);
            }}
          >
            {flatDiagram ? "Return to miniature" : "Enlarge brush study"}
          </button>
        ) : lesson.direction ? (
          <span className="technique-demo__direction">
            Brush path: {lesson.direction.toLowerCase()}
          </span>
        ) : null}
        {variant && playControls}
      </div>

      <div
        className={`technique-demo__canvas${variant && !flatDiagram ? " technique-demo__canvas--model" : ""}`}
        aria-describedby={captionId}
      >
        {variant && (
          <div hidden={flatDiagram}>
            <MiniatureViewer
              baseColor={baseColor}
              edgeColor={
                variant === "fine"
                  ? (previousColor ?? baseColor)
                  : variant === "edge"
                    ? highlightColor
                    : baseColor
              }
              fineColor={highlightColor}
              recessColor={recessColor}
              stage={
                variant === "base"
                  ? "base"
                  : variant === "recess" || variant === "tidy"
                    ? "shade"
                    : variant
              }
              technique={variant}
              progress={sceneProgress}
              playing={
                status === "playing" && mode === "animation" && !flatDiagram
              }
              paused={status === "paused" && mode === "animation"}
              staticMode={mode === "steps"}
              staticStep={staticStep}
              reducedMotion={reducedMotion}
              context="lesson"
              sequenceKey={sequenceKey}
              onInteract={() => {
                if (status === "playing") setStatus("paused");
              }}
            />
            <div className="technique-demo__paired-study">
              <div>
                <strong>Brush study</strong>
                <p>
                  {variant === "tidy"
                    ? "The miniature shows the cleaned result. Practise correcting a spill below."
                    : "See the blue armour change above, then follow the brush placement below."}
                  {" "}Gold trim, weapon and other details stay finished for reference.
                </p>
              </div>
              <ArmourIllustration
                variant={variant}
                baseColor={baseColor}
                highlightColor={highlightColor}
                previousColor={previousColor}
                recessColor={recessColor}
                progress={diagramProgress}
                showBrush={showBrush}
              />
            </div>
          </div>
        )}
        {variant && flatDiagram ? (
          <ArmourIllustration
            variant={variant}
            baseColor={baseColor}
            highlightColor={highlightColor}
            previousColor={previousColor}
            recessColor={recessColor}
            progress={diagramProgress}
            showBrush={showBrush}
          />
        ) : !variant ? (
          <SurfaceIllustration
            technique={technique}
            baseColor={baseColor}
            highlightColor={highlightColor}
            progress={sceneProgress}
            showBrush={showBrush}
          />
        ) : null}
        <div className="technique-demo__legend">
          {variant === "fine" ? (
            <>
              <span style={{ background: previousColor ?? baseColor }} />
              First highlight
              <span style={{ background: highlightColor }} />
              {paintLabel ?? "Fine highlight"}
            </>
          ) : variant === "tidy" || technique === "basecoat" ? (
            <>
              <span style={{ background: baseColor }} />
              {paintLabel ?? "Base colour"}
            </>
          ) : (
            <>
              <span style={{ background: baseColor }} />
              Base colour
              <span style={{ background: highlightColor }} />
              {paintLabel ??
                (technique === "wash" ? "Shade in recesses" : "Lighter colour")}
            </>
          )}
        </div>
      </div>

      {mode === "steps" && (
        <ol
          className="technique-demo__stages"
          aria-label="Static demonstration steps"
        >
          {lesson.stages.map((stage, index) => (
            <li key={stage}>
              <button
                type="button"
                aria-pressed={staticStep === index}
                onClick={() => setStaticStep(index)}
              >
                <span>{index + 1}</span>
                {stage}
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="technique-demo__footer">
        <div className="technique-demo__caption">
          <strong>{lesson.label}</strong>
          <p id={captionId}>
            {mode === "steps"
              ? (lesson.stageDetails?.[staticStep] ??
                (staticStep === 2 ? lesson.result : lesson.action))
              : variant && phase === 0
                ? lesson.stageDetails?.[0]
                : progress >= (variant ? 0.8 : 0.9)
                  ? lesson.result
                  : lesson.action}
          </p>
        </div>
        {!variant && playControls}
      </div>
      {mode === "animation" && (
        <div className="technique-demo__track" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      <span className="technique-demo__sr-only" role="status">
        {mode === "steps"
          ? `${reducedMotion ? "Reduced motion is enabled. " : ""}Static step ${staticStep + 1} of 3: ${lesson.stages[staticStep]}.`
          : status === "complete"
            ? "Illustration complete."
            : status === "paused"
              ? "Illustration paused."
              : status === "playing"
                ? "Illustration playing."
                : "Press Play to see the technique."}
      </span>
      <style>{`
        .technique-demo{overflow:hidden;border:1px solid #e1e7ed;border-radius:20px;background:#f5f7f9;color:#213346;font-family:inherit;isolation:isolate}
        .technique-demo__heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:19px 22px 0}
        .technique-demo__eyebrow{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:#617184;letter-spacing:.025em}
        .technique-demo__eyebrow>span{width:6px;height:6px;border-radius:50%;background:#7b97b3}
        .technique-demo__target{font-size:10px;line-height:1.5;font-weight:500;padding:3px 8px;border:1px solid #dce3eb;border-radius:6px;color:#607186;background:#ffffff80}
        .technique-demo__options{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 21px 0;flex-wrap:wrap}
        .technique-demo__modes{display:flex;gap:2px;padding:3px;background:#e8edf2;border-radius:9px}
        .technique-demo__modes button{border:0;border-radius:6px;min-height:34px;padding:6px 11px;background:transparent;color:#607186;font-size:11px;font-weight:600}
        .technique-demo__modes button[aria-pressed=true]{background:#fff;color:#263f58;box-shadow:0 1px 3px #18375912}
        .technique-demo__modes button:hover{color:#263f58}
        .technique-demo__direction{font-size:10px;line-height:1.5;color:#607186}
        .technique-demo__diagram-toggle{min-height:34px;padding:6px 9px;border:1px solid transparent;border-radius:7px;background:transparent;color:#607186;font-size:11px}
        .technique-demo__diagram-toggle:hover{background:#e8edf2;color:#263f58}
        .technique-demo__diagram-toggle[aria-pressed=true]{border-color:#bacad8;background:#fff;color:#263f58}
        .technique-demo__canvas{position:relative;background:radial-gradient(ellipse at 50% 47%,#ffffff 0%,#f5f7f900 68%)}
        .technique-demo__canvas--model .technique-demo__legend{position:static;padding:2px 16px 16px}
        .technique-demo__scene{display:block;width:100%;height:auto;overflow:visible}
        .technique-demo__legend{display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;padding:0 12px;position:absolute;bottom:9px;left:0;right:0;font-size:10px;line-height:1.5;color:#607186}
        .technique-demo__legend>span{width:7px;height:7px;border-radius:50%;border:1px solid #29415f20}
        .technique-demo__legend>span:not(:first-child){margin-left:12px}
        .technique-demo__footer{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:17px 21px;background:#ffffffcc;border-top:1px solid #e5eaf0}
        .technique-demo__caption{max-width:390px}
        .technique-demo__caption strong{font-size:13px;font-weight:600;line-height:1.5}
        .technique-demo__caption p{margin:3px 0 0;color:#637184;font-size:11px;line-height:1.6;max-width:48ch}
        .technique-demo__controls{display:flex;align-items:center;gap:4px;flex-shrink:0}.technique-demo__options>.technique-demo__controls{margin-left:auto}
        .technique-demo button{font-family:inherit;cursor:pointer}
        .technique-demo__play{display:flex;align-items:center;justify-content:center;gap:6px;min-height:36px;min-width:74px;padding:8px 11px;border:1px solid #d7e0ea;border-radius:9px;background:#fff;color:#24415e;font-size:11px;font-weight:600;box-shadow:0 1px 2px #18375907}
        .technique-demo__play:hover{background:#edf4fc;border-color:#b5c9df}
        .technique-demo__replay{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:8px;background:transparent;color:#627389}
        .technique-demo__replay:hover{background:#eaf0f6}
        .technique-demo button:focus-visible{outline:3px solid #387dd1;outline-offset:3px}
        .technique-demo__track{height:3px;background:#e6edf4}
        .technique-demo__track>span{display:block;width:100%;height:100%;background:#5e94ce;transform-origin:left}
        .technique-demo__stages{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:0;padding:0 20px 18px;list-style:none}
        .technique-demo__stages li{min-width:0}
        .technique-demo__stages button{display:flex;width:100%;height:100%;min-height:44px;align-items:center;gap:7px;padding:8px;border:1px solid #dce3eb;border-radius:9px;background:#ffffff80;color:#5d6f81;font-size:11px;line-height:1.5;text-align:left}
        .technique-demo__stages button>span{display:grid;place-items:center;flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#e7edf3;font-size:10px;font-weight:600}
        .technique-demo__stages button[aria-pressed=true]{border-color:#9db7ce;background:#fff;color:#263f58;box-shadow:0 0 0 1px #9db7ce}
        .technique-demo__stages button[aria-pressed=true]>span{background:#365d80;color:#fff}
        .technique-demo__stages button:hover{background:#fff}
        .technique-demo__sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        @media(max-width:480px){.technique-demo__heading{padding:15px 14px 0;align-items:flex-start}.technique-demo__options{padding:13px 14px 0;gap:8px}.technique-demo__direction{width:100%}.technique-demo__footer{padding:14px;gap:12px;align-items:flex-start}.technique-demo__target{font-size:9px}.technique-demo__caption p{font-size:11px}.technique-demo__legend{position:static;padding:0 14px 14px;font-size:10px}.technique-demo__stages{grid-template-columns:1fr;gap:6px;padding:0 14px 14px}.technique-demo__stages button{font-size:12px}.technique-demo__modes button,.technique-demo__diagram-toggle,.technique-demo__play,.technique-demo__replay{min-height:44px}}
      `}</style>
    </section>
  );
}

export default function TechniqueDemo(props: TechniqueDemoProps) {
  const reducedMotion = useReducedMotion();
  const [preferredMode, setPreferredMode] = useState<DemoMode | null>(null);
  const [observedReducedMotion, setObservedReducedMotion] =
    useState(reducedMotion);
  if (observedReducedMotion !== reducedMotion) {
    setObservedReducedMotion(reducedMotion);
    setPreferredMode(null);
  }
  const mode = preferredMode ?? (reducedMotion ? "steps" : "animation");
  return (
    <TechniquePlayer
      {...props}
      mode={mode}
      onModeChange={setPreferredMode}
      reducedMotion={reducedMotion}
    />
  );
}
