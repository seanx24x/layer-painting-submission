"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { ChevronDown, RotateCcw, Sun } from "lucide-react";
import { constrainLight, DEFAULT_LIGHT, LIGHT_PRESETS, lightFromHandle, lightHandlePosition, lightPositionLabel, moveLightWithKey, PAINT_BANDS, type LightPosition, type LightStudyState, type LightSurface, type LightView } from "@/lib/light-placement";
import type { LightPlacementRenderer } from "@/lib/light-placement-renderer";
import { LightPlacementFallback } from "./LightPlacementFallback";
import "./light-placement.css";

const chapterLabels = { place: "Move the light. Watch the form respond.", read: "Compare a curved surface with flat planes.", paint: "Turn the light into a simple painting plan." };

export default function LightPlacementStudy({ chapterId }: { chapterId: "place" | "read" | "paint" }) {
  const [position, setPosition] = useState<LightPosition>(DEFAULT_LIGHT);
  const [surface, setSurface] = useState<LightSurface>("sphere");
  const [view, setView] = useState<LightView>(chapterId === "paint" ? "paint" : "light");
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [generation, setGeneration] = useState(0);
  const [dragging, setDragging] = useState(false);
  const id = useId().replaceAll(":", "");
  const stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null);
  const renderer = useRef<LightPlacementRenderer | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const state = useMemo<LightStudyState>(() => ({ ...position, surface, view }), [position, surface, view]);
  const latest = useRef(state);
  const handle = lightHandlePosition(position);

  useEffect(() => { latest.current = state; renderer.current?.update(state); }, [state]);
  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    let cancelled = false;
    import("@/lib/light-placement-renderer").then(({ createLightPlacementRenderer }) => {
      if (cancelled) return;
      try {
        renderer.current = createLightPlacementRenderer(node, latest.current, available => { if (!cancelled) setStatus(available ? "ready" : "fallback"); });
        setStatus("ready");
      } catch { setStatus("fallback"); }
    }).catch(() => { if (!cancelled) setStatus("fallback"); });
    return () => { cancelled = true; renderer.current?.dispose(); renderer.current = null; };
  }, [generation]);

  function movePointer(event: PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !stage.current) return;
    const rect = stage.current.getBoundingClientRect();
    setPosition(lightFromHandle((event.clientX - dragOffset.current.x - rect.left) / rect.width, (event.clientY - dragOffset.current.y - rect.top) / rect.height));
  }
  function releasePointer(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  }
  const positionLabel = lightPositionLabel(position);

  return <section className="light-placement-study" aria-label="Interactive light study" data-chapter={chapterId}>
    <div className="light-stage-header">
      <div className="light-segmented light-surface-options" role="group" aria-label="Study surface">
        <button type="button" aria-pressed={surface === "sphere"} onClick={() => setSurface("sphere")}>Sphere</button>
        <button type="button" aria-pressed={surface === "block"} onClick={() => setSurface("block")}>Bevelled block</button>
      </div>
      <button className="light-reset" type="button" onClick={() => setPosition(DEFAULT_LIGHT)} aria-label="Reset light position"><RotateCcw size={15} aria-hidden="true" /><span>Reset light</span></button>
    </div>
    <div ref={stage} className="light-placement-stage" data-dragging={dragging || undefined} role="group" aria-label={`${surface === "sphere" ? "Curved sphere" : "Bevelled block"}, ${view === "paint" ? "suggested painted values" : "matte lighting"}. Light ${positionLabel}.`}>
      <div ref={canvas} className="light-canvas" style={{ visibility: status === "ready" ? "visible" : "hidden" }} />
      {status === "loading" && <div className="light-stage-loading" role="status">Preparing the light study…</div>}
      {status === "fallback" && <LightPlacementFallback state={state} id={id} />}
      <svg className="light-direction-line" aria-hidden="true"><line x1={`${handle.x * 100}%`} y1={`${handle.y * 100}%`} x2="50%" y2="51%" /></svg>
      <button type="button" className="light-source-handle" style={{ left: `${handle.x * 100}%`, top: `${handle.y * 100}%` }} role="slider" aria-label="Light position. Drag or use arrow keys; Shift for fine adjustment." aria-valuemin={-80} aria-valuemax={80} aria-valuenow={position.azimuth} aria-valuetext={positionLabel} aria-describedby={`${id}-help`}
        onPointerDown={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          dragOffset.current = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 };
          event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
        }} onPointerMove={movePointer} onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={() => setDragging(false)}
        onKeyDown={event => { const next = moveLightWithKey(position, event.key, event.shiftKey); if (next) { event.preventDefault(); setPosition(next); } }}>
        <Sun size={22} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <div className="light-stage-caption"><span id={`${id}-help`}>Drag the light</span><span>{positionLabel}</span></div>
    </div>
    <div className="light-placement-controls">
      <div className="light-segmented light-view-options" role="group" aria-label="Surface view">
        <button type="button" aria-pressed={view === "light"} onClick={() => setView("light")}>Light on the form</button>
        <button type="button" aria-pressed={view === "paint"} onClick={() => setView("paint")}>Where to paint</button>
      </div>
      {view === "paint" && <ul className="light-paint-legend" aria-label="Painted value map">{(["shadow", "midtone", "highlight"] as const).map(band => <li key={band}><i style={{ backgroundColor: PAINT_BANDS[band] }} />{band === "midtone" ? "Midtone" : band === "shadow" ? "Shadow" : "Highlight"}</li>)}</ul>}
      <details className="light-position-disclosure"><summary>Light position <ChevronDown size={16} aria-hidden="true" /></summary>
        <div className="light-preset-options" role="group" aria-label="Light position presets">{LIGHT_PRESETS.map(preset => <button key={preset.id} type="button" aria-pressed={position.azimuth === preset.azimuth && position.elevation === preset.elevation} onClick={() => setPosition({ azimuth: preset.azimuth, elevation: preset.elevation })}>{preset.label}</button>)}</div>
        <div className="light-angle-controls">
          <label htmlFor={`${id}-azimuth`}><span>Direction <output>{position.azimuth === 0 ? "Centred" : `${Math.abs(position.azimuth)}° ${position.azimuth < 0 ? "left" : "right"}`}</output></span><input id={`${id}-azimuth`} type="range" min="-80" max="80" step="1" value={position.azimuth} aria-valuetext={position.azimuth === 0 ? "Centred" : `${Math.abs(position.azimuth)} degrees ${position.azimuth < 0 ? "left" : "right"}`} onChange={event => setPosition(constrainLight({ ...position, azimuth: Number(event.target.value) }))} /></label>
          <label htmlFor={`${id}-elevation`}><span>Elevation <output>{position.elevation}°</output></span><input id={`${id}-elevation`} type="range" min="10" max="80" step="1" value={position.elevation} aria-valuetext={`${position.elevation} degrees above`} onChange={event => setPosition(constrainLight({ ...position, elevation: Number(event.target.value) }))} /></label>
        </div>
      </details>
      {status === "fallback" && <p className="light-fallback-notice" role="status">3D is unavailable. This illustrated view uses the same lighting controls.<button type="button" onClick={() => { setStatus("loading"); setGeneration(value => value + 1); }}>Try 3D again</button></p>}
    </div>
    <p className="light-study-hint">{chapterLabels[chapterId]}{view === "paint" ? " These three values are a painting guide, not a finished recipe." : ""}</p>
  </section>;
}
