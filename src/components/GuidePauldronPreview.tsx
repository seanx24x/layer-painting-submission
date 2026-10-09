"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Minus, Plus, RotateCcw } from "lucide-react";
import type { Guide } from "@/lib/guides";
import { getGuidePauldronStudy, type GuidePauldronStudy } from "@/lib/guide-pauldron";
import type { PauldronViewer, PauldronViewerState } from "@/lib/pauldron-viewer";
import "./guide-pauldron.css";

const regions = ["Outer plate", "Raised rim", "Lower band", "Rivets", "Skull", "Inner cup", "Rear surfaces"];
const views = [
  { id: "three-quarter", label: "Three-quarter" },
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "close", label: "Close-up" },
] as const;
type View = typeof views[number]["id"] | "free";

function PauldronInspection({ study }: { study: GuidePauldronStudy }) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<PauldronViewer | null>(null);
  const [nearby, setNearby] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [view, setView] = useState<View>("three-quarter");
  const [state, setState] = useState<PauldronViewerState>({ palette: study.palette, primerColor: study.primer.hex, finish: "finished", regions: false, selectedRegion: null, shading: "smooth" });
  const latest = useRef(state);
  const ready = status === "ready";

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNearby(true); observer.disconnect(); }
    }, { rootMargin: "240px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    latest.current = state;
    viewer.current?.setState(state);
  }, [state]);

  useEffect(() => {
    const element = host.current;
    if (!element || !nearby) return;
    let cancelled = false;
    let instance: PauldronViewer | null = null;
    const controller = new AbortController();
    import("@/lib/pauldron-viewer").then(({ createPauldronViewer }) => createPauldronViewer(element, latest.current, {
      onReady() { if (!cancelled) setStatus("ready"); },
      onError() { if (!cancelled) setStatus("error"); },
      onInspect(region) { if (!cancelled) setState(previous => ({ ...previous, selectedRegion: region })); },
      onViewChange(next) { if (!cancelled) setView(next); },
    }, { signal: controller.signal })).then(created => {
      instance = created;
      if (cancelled) { created.dispose(); return; }
      viewer.current = created;
      created.setState(latest.current);
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; controller.abort(); instance?.dispose(); viewer.current = null; };
  }, [nearby, generation]);

  function update(patch: Partial<PauldronViewerState>) { setState(previous => ({ ...previous, ...patch })); }
  const selectedName = state.selectedRegion === null ? "The whole sculpt" : regions[state.selectedRegion];
  const paintGroups = study.assignments.reduce<{ paintId: string; name: string; hex: string; labels: string[] }[]>((groups, assignment) => {
    const existing = groups.find(group => group.paintId === assignment.paintId);
    if (existing) existing.labels.push(assignment.label.toLowerCase());
    else groups.push({ ...assignment, labels: [assignment.label.toLowerCase()] });
    return groups;
  }, []);
  const displayedPaints = state.finish === "primer"
    ? [{ paintId: study.primer.id, name: study.primer.name, hex: study.primer.hex, labels: ["Primer · " + study.primer.brand] }]
    : paintGroups;

  return (
    <div className="guide-pauldron-layout">
      <div className="guide-pauldron-stage">
        <div className="guide-pauldron-viewport">
          <div className="guide-pauldron-stage-label"><span>{state.regions ? "Surface map" : state.finish === "primer" ? study.primer.name : "Your colour study"}</span>{state.selectedRegion !== null && <span>{selectedName}<button type="button" onClick={() => { update({ selectedRegion: null }); host.current?.focus({ preventScroll: true }); }}>Show all</button></span>}</div>
          <div ref={host} className="guide-pauldron-canvas" tabIndex={ready ? 0 : -1} role="group" aria-label="Interactive pauldron. Drag to rotate. Arrow keys turn the model; plus and minus zoom. Home resets the view." aria-describedby={`pauldron-help-${study.id}`} />
          {!ready && <div className="guide-pauldron-status" role="status">
            {status === "loading" ? <><span className="guide-pauldron-loading-shape" aria-hidden /><p>Loading your colour study…</p></> : <><p>The 3D view couldn’t load.</p><span>You can still explore the paints below.</span><button type="button" className="text-button" onClick={() => { setStatus("loading"); setGeneration(value => value + 1); }}>Try again</button></>}
          </div>}
        </div>
        <div className="guide-pauldron-controls">
          <div className="guide-pauldron-views" role="group" aria-label="Pauldron camera views">
            {views.map(item => <button key={item.id} type="button" disabled={!ready} aria-pressed={view === item.id} onClick={() => viewer.current?.setView(item.id)}>{item.label}</button>)}
          </div>
          <div className="guide-pauldron-camera" role="group" aria-label="Zoom and reset">
            <button type="button" disabled={!ready} aria-label="Zoom out" onClick={() => viewer.current?.zoom("out")}><Minus size={16} /></button>
            <button type="button" disabled={!ready} aria-label="Zoom in" onClick={() => viewer.current?.zoom("in")}><Plus size={16} /></button>
            <button type="button" disabled={!ready} aria-label="Reset pauldron view" onClick={() => viewer.current?.reset()}><RotateCcw size={15} /></button>
          </div>
        </div>
        <p className="guide-pauldron-help" id={`pauldron-help-${study.id}`}>Drag to turn. Scroll or pinch to zoom. <span>Arrow keys turn; + / − zoom.</span></p>
      </div>
      <aside className="guide-pauldron-notes" aria-label="Pauldron colours and inspection">
        <div className="guide-pauldron-finish" role="group" aria-label="Pauldron finish">
          <button type="button" aria-pressed={state.finish === "finished" && !state.regions} onClick={() => update({ finish: "finished", regions: false })}>Colours</button>
          <button type="button" aria-pressed={state.finish === "primer" && !state.regions} onClick={() => update({ finish: "primer", regions: false })}>Primer</button>
        </div>
        <h3>On the sculpt</h3>
        <ul className="guide-pauldron-paints" style={{ gridTemplateColumns: `repeat(${displayedPaints.length}, minmax(0, 1fr))` }}>
          {displayedPaints.map(assignment => <li key={assignment.paintId}>
            <span className="guide-pauldron-swatch" style={{ backgroundColor: assignment.hex }} aria-hidden />
            <span><small>{assignment.labels.join(", ").replace(/^./, letter => letter.toUpperCase())}</small><strong>{assignment.name.replace(/^Citadel /, "")}</strong></span>
          </li>)}
        </ul>
        <p className="guide-pauldron-caption">{state.finish === "primer" ? study.primer.context : study.note}
          {state.finish === "primer" && <a className="guide-pauldron-material-link" href="#materials">In your materials <ChevronDown size={13} aria-hidden /></a>}
        </p>
        <details className="guide-pauldron-inspect">
          <summary>Inspect the surfaces <ChevronDown size={14} aria-hidden /></summary>
          <label className="guide-pauldron-label" htmlFor={`pauldron-region-${study.id}`}>Focus on a part</label>
          <select id={`pauldron-region-${study.id}`} value={state.selectedRegion ?? "all"} onChange={event => update({ selectedRegion: event.target.value === "all" ? null : Number(event.target.value) })}>
            <option value="all">The whole sculpt</option>{regions.map((name, index) => <option key={name} value={index}>{name}</option>)}
          </select>
          <label className="guide-pauldron-checkbox"><input type="checkbox" checked={state.regions} onChange={event => update({ regions: event.target.checked })} /><span>Show surface boundaries</span></label>
          <label className="guide-pauldron-label" htmlFor={`pauldron-shading-${study.id}`}>Display shading</label>
          <select id={`pauldron-shading-${study.id}`} value={state.shading} onChange={event => update({ shading: event.target.value as "smooth" | "facet" })}><option value="smooth">Smooth surfaces</option><option value="facet">Original facets</option></select>
          <p className="guide-pauldron-context">{study.context}</p>
        </details>
        <p className="guide-pauldron-colour-note">Digital colours are approximate.</p>
      </aside>
    </div>
  );
}

/** A palette reference only. Inspection never reads or writes painting progress. */
export function GuidePauldronPreview({ guide }: { guide: Guide }) {
  const [open, setOpen] = useState(true);
  const study = getGuidePauldronStudy(guide);
  return (
    <details className="optional-miniature guide-pauldron" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary><span><strong>See the colours on armour</strong><small>Turn the pauldron. Explore your palette.</small></span><ChevronDown size={18} aria-hidden /></summary>
      {open && <PauldronInspection study={study} />}
    </details>
  );
}
