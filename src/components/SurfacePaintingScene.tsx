"use client";

import { useEffect, useId, useRef, useState } from "react";
import { evaluateSurfacePainting, type SurfacePaintingInput } from "@/lib/surface-painting";
import type { LessonClock } from "@/lib/workshop";
import type { createSurfacePaintingRenderer } from "@/lib/surface-painting-renderer";
import "./surface-painting-scene.css";

const descriptions = {
  layers: "Thin paint builds in separate coats on a softly curved panel.",
  edges: "Progressively finer highlights follow the ridge of a folded surface.",
  recess: "Shade follows the recessed lines of a pale tile, leaving its faces clear.",
  drybrush: "Light passes catch raised ribs while their recessed gaps remain visible.",
};

/** A readable, palette-aware illustration also serves browsers without WebGL. */
function SurfaceFallback({ input }: { input: SurfacePaintingInput }) {
  const id = useId();
  const frame = evaluateSurfacePainting(input);
  const { technique } = frame;
  const point = ([u, v]: readonly [number, number]) => `${240 + u * 320} ${370 - v * 260}`;
  const ribCentres = Array.from({ length: 9 }, (_, i) => 264 + i * 34);
  const ribContactWidth = 14 + frame.amount * 8;
  const lightAngle = frame.light * Math.PI / 180;
  const lightSource = { x: 400 + Math.sin(lightAngle) * 195, y: 240 - Math.cos(lightAngle) * 190 };
  const lightTarget = { x: 400 + Math.sin(lightAngle) * 110, y: 240 - Math.cos(lightAngle) * 110 };
  const unload = frame.preparation === "load" ? frame.preparationUnloadProgress : 1;
  return <svg viewBox="0 0 800 480" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id={`${id}-surface`}><rect x="240" y="110" width="320" height="260" rx="3" /></clipPath>
      <clipPath id={`${id}-ribs`}>{ribCentres.map(x => <rect key={x} x={x - ribContactWidth / 2} y="124" width={ribContactWidth} height="232" rx="5" />)}</clipPath>
      <marker id={`${id}-light-arrow`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M1 1L6 3.5L1 6" fill="none" stroke="#778390" strokeWidth="1" /></marker>
    </defs>
    <g transform={frame.detail ? "translate(-160 -96) scale(1.4)" : undefined}>
      <rect x="240" y="110" width="320" height="260" rx="3" fill={frame.phase === "preparation" ? "#ECEBE5" : frame.base} />
      {technique === "edges" && <path d="M400 110H560V370H400Z" fill="#000" opacity=".055" />}
      {technique === "recess" && <path d="M400 110V370M240 240H560" stroke="#68716c" strokeWidth="2" opacity=".22" />}
      {technique === "drybrush" && ribCentres.map(x => <g key={x}>
        <rect x={x - 12} y="122" width="24" height="236" rx="6" fill="#000" opacity=".045" />
        <rect x={x - 10} y="124" width="20" height="232" rx="5" fill="#FFF" opacity=".22" />
      </g>)}
      <g clipPath={`url(#${id}-surface)`}>
        <g clipPath={technique === "drybrush" ? `url(#${id}-ribs)` : undefined}>
          {frame.passes.filter(pass => pass.progress > 0).map(pass => {
            const end: readonly [number, number] = [pass.from[0] + (pass.to[0] - pass.from[0]) * pass.progress, pass.from[1] + (pass.to[1] - pass.from[1]) * pass.progress];
            return <path key={pass.id} d={`M${point(pass.from)}L${point(end)}`} stroke={frame.depositedCoats[pass.coat]} strokeWidth={pass.width * 640} strokeLinecap="butt" opacity={pass.opacity} />;
          })}
        </g>
        {frame.phase === "preparation" && <>
          <path d={`M${point([.28, .67])}L${point([.28 + .05 * unload, .67 - .18 * unload])}`} stroke={frame.coats[0]} strokeWidth="58" strokeLinecap="butt" opacity=".83" />
          <path d={`M${point([.60, .69])}L${point([.60 + .04 * frame.preparationTestProgress, .69 - .40 * frame.preparationTestProgress])}`} stroke={frame.coats[0]} strokeWidth="41" strokeLinecap="butt" opacity={.30 + frame.amount * .42} />
        </>}
        {frame.lighting && <ellipse cx={400 + Math.sin(lightAngle) * 80} cy={240 - Math.cos(lightAngle) * 82} rx="106" ry="62" fill="#FFF" opacity=".28" />}
      </g>
      {frame.lighting && <g fill="none" stroke="#778390" strokeWidth="1.5">
        <circle cx={lightSource.x} cy={lightSource.y} r="7" />
        <path d={`M${lightSource.x} ${lightSource.y}L${lightTarget.x} ${lightTarget.y}`} strokeDasharray="3 5" markerEnd={`url(#${id}-light-arrow)`} />
      </g>}
    </g>
  </svg>;
}

type Props = SurfacePaintingInput & { clock: LessonClock };
type Renderer = ReturnType<typeof createSurfacePaintingRenderer>;

export default function SurfacePaintingScene({ clock, ...input }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<Renderer | null>(null);
  const current = useRef(input);
  const [status, setStatus] = useState<"loading" | "ready" | "lost" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    current.current = input;
    renderer.current?.update(input);
  }, [input]); // The clock supplies the frames between React's sampled updates.

  useEffect(() => clock.subscribe(time => {
    current.current = { ...current.current, time };
    renderer.current?.update(current.current);
  }), [clock]);

  useEffect(() => {
    let disposed = false;
    let active: Renderer | undefined;
    void import("@/lib/surface-painting-renderer").then(({ createSurfacePaintingRenderer }) => {
      if (disposed || !host.current) return;
      setStatus("loading");
      active = createSurfacePaintingRenderer(host.current, current.current, {
        onStatus: value => { if (!disposed) setStatus(value); },
      });
      renderer.current = active;
    }).catch(() => { if (!disposed) setStatus("failed"); });
    return () => { disposed = true; active?.dispose(); renderer.current = null; };
  }, [attempt]);

  return <div className="surface-painting-scene" role="group" aria-label={descriptions[input.technique]} data-renderer={status}>
    <div className="surface-painting-fallback" hidden={status === "ready"}><SurfaceFallback input={input} /></div>
    <div ref={host} className="surface-painting-canvas" aria-hidden="true" />
    {(status === "failed" || status === "lost") && <div className="surface-painting-recovery" role="status">
      <span>Showing a simplified view.</span><button onClick={() => setAttempt(value => value + 1)}>Restore detailed view</button>
    </div>}
  </div>;
}
