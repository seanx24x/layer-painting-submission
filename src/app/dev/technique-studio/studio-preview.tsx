"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronDown, Layers, Maximize2, Minimize2, Pause, Play, RotateCcw, SlidersHorizontal, Sun } from "lucide-react";
import { cancelStudioFrame, requestStudioFrame } from "@/lib/studio-scheduler";
import { DEFAULT_STUDIO_STATE, getStudyPhase, renderState, sampleLightAngles, STUDIES, type StudioState, type StudyId } from "@/lib/sculptural-studio";
import type { createSculpturalStudio } from "@/lib/sculptural-studio-renderer";
import { TechniqueCover } from "@/components/TechniqueCover";
import { ContactDiagram } from "./contact-diagram";
import "./studio-preview.css";

type Studio = ReturnType<typeof createSculpturalStudio>;
type RenderMetrics = { loadMs: number; drawMs: number; triangles: number; dpr: number };
type Status = "loading" | "ready" | "lost";

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const timestamp = (value: number) => `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, "0")}`;
const adjustmentCopy: Record<StudyId, { low: string; high: string }> = {
  light: { low: "Left", high: "Right" },
  layers: { low: "Less paint", high: "More paint" },
  edges: { low: "Light touch", high: "Firm touch" },
  recess: { low: "Less paint", high: "More paint" },
  drybrush: { low: "Light touch", high: "Firm touch" },
};

export function StudioPreview({ initialStudy = "light" }: { initialStudy?: StudyId }) {
  const initial = { ...DEFAULT_STUDIO_STATE, study: initialStudy };
  const [state, setState] = useState<StudioState>(initial);
  const [playing, setPlaying] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [covers, setCovers] = useState<Partial<Record<StudyId, string>>>({});
  const [generation, setGeneration] = useState(0);
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [pauseMotion, setPauseMotion] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [phase, setPhase] = useState(() => getStudyPhase(initialStudy, initial.time));
  const [metrics, setMetrics] = useState<RenderMetrics | null>(null);
  const [notice, setNotice] = useState("");
  const canvasHost = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const renderer = useRef<Studio | null>(null);
  const latest = useRef<StudioState>(initial);
  const playingRef = useRef(false);
  const frame = useRef(0);
  const previousFrame = useRef(0);
  const phaseLabel = useRef(phase.label);
  const timeline = useRef<HTMLInputElement>(null);
  const timeLabel = useRef<HTMLOutputElement>(null);
  const progress = useRef<HTMLDivElement>(null);
  const lightMarker = useRef<HTMLButtonElement>(null);
  const lightLine = useRef<SVGLineElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const study = STUDIES.find(item => item.id === state.study)!;
  const isLight = state.study === "light";
  const isSurfaceStudy = state.study === "layers" || state.study === "edges";
  const actionTime = study.id === "layers" ? 4 : study.id === "drybrush" ? 5 : study.duration * .5;
  const reducedMotion = systemReducedMotion || pauseMotion;
  const adjustment = adjustmentCopy[state.study];
  const shown = renderState(state);
  const sampledLight = sampleLightAngles(shown);
  const lightHandle = { x: 50 + sampledLight.azimuth * 0.34, y: 60 - sampledLight.elevation * 0.55 };
  const displayedAmount = state.study === "light" ? Math.round(sampledLight.azimuth) : Math.round(shown.amount * 100);
  const amountDescription = study.adjustment === "Pressure"
    ? shown.amount < .3 ? "Light" : shown.amount > .7 ? "Firm" : "Gentle"
    : shown.amount < .3 ? "Lean" : shown.amount > .7 ? "Full" : "Moderate";

  function syncTime(input: StudioState) {
    const value = renderState(input);
    const selected = STUDIES.find(item => item.id === value.study)!;
    const nextPhase = getStudyPhase(value.study, value.time);
    if (timeline.current) {
      timeline.current.value = String(value.time);
      timeline.current.setAttribute("aria-valuetext", `${timestamp(value.time)}, ${nextPhase.label}`);
    }
    if (timeLabel.current) timeLabel.current.textContent = `${timestamp(value.time)} / ${timestamp(selected.duration)}`;
    if (progress.current) progress.current.style.width = `${value.time / selected.duration * 100}%`;
    if (value.study === "light") {
      const light = sampleLightAngles(value);
      const x = `${50 + light.azimuth * 0.34}%`, y = `${60 - light.elevation * 0.55}%`;
      if (lightMarker.current) {
        lightMarker.current.style.left = x;
        lightMarker.current.style.top = y;
        lightMarker.current.setAttribute("aria-valuenow", String(Math.round(light.azimuth)));
        lightMarker.current.setAttribute("aria-valuetext", `${Math.round(Math.abs(light.azimuth))} degrees ${light.azimuth < 0 ? "left" : "right"}, ${light.elevation} degrees above`);
      }
      if (lightLine.current) { lightLine.current.setAttribute("x1", x); lightLine.current.setAttribute("y1", y); }
    }
    if (phaseLabel.current !== nextPhase.label) {
      phaseLabel.current = nextPhase.label;
      setPhase(nextPhase);
    }
  }

  function pause() {
    playingRef.current = false;
    cancelStudioFrame(frame.current);
    frame.current = 0;
    previousFrame.current = 0;
    setPlaying(false);
    setState({ ...latest.current });
  }

  function update(patch: Partial<StudioState>, pausePlayback = true) {
    if (pausePlayback) pause();
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setState(next);
    renderer.current?.update(next);
    syncTime(next);
  }

  function seek(time: number) {
    update({ time: clamp(time, 0, study.duration), reference: false });
    setNotice("");
  }

  function tick(now: number) {
    if (!playingRef.current) return;
    const selected = STUDIES.find(item => item.id === latest.current.study)!;
    const elapsed = previousFrame.current ? Math.min((now - previousFrame.current) / 1000, 0.1) : 0;
    previousFrame.current = now;
    const next = { ...latest.current, time: Math.min(selected.duration, latest.current.time + elapsed) };
    latest.current = next;
    renderer.current?.update(next);
    syncTime(next);
    if (next.time >= selected.duration) {
      playingRef.current = false;
      previousFrame.current = 0;
      setPlaying(false);
      setState(next);
    } else frame.current = requestStudioFrame(tick);
  }

  function watch() {
    if (playingRef.current) { pause(); return; }
    if (reducedMotion || status !== "ready") return;
    const next = { ...latest.current, reference: false, time: latest.current.time >= study.duration ? 0 : latest.current.time };
    latest.current = next;
    setState(next);
    syncTime(next);
    setNotice("");
    previousFrame.current = 0;
    playingRef.current = true;
    setPlaying(true);
    frame.current = requestStudioFrame(tick);
  }

  function selectStudy(id: StudyId) {
    update({ ...DEFAULT_STUDIO_STATE, study: id, time: 0 });
    const nextPhase = getStudyPhase(id, 0);
    phaseLabel.current = nextPhase.label;
    setPhase(nextPhase);
    setAdjustOpen(false);
    setNotice("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("study", id);
      window.history.replaceState(null, "", url);
    }
  }

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;
    let cancelled = false;
    let studio: Studio | null = null;
    import("@/lib/sculptural-studio-renderer").then(({ createSculpturalStudio: create }) => {
      if (cancelled) return;
      try {
        studio = create(host, latest.current, {
          onStatus(next) {
            if (cancelled) return;
            setStatus(next);
            if (next === "lost") {
              playingRef.current = false;
              cancelStudioFrame(frame.current);
              previousFrame.current = 0;
              setState({ ...latest.current });
              setPlaying(false);
            }
          },
          onMetrics(next) { if (!cancelled) setMetrics(next); },
        });
        renderer.current = studio;
        setCovers(studio.captureCovers());
        studio.update(latest.current);
        setStatus("ready");
      } catch {
        studio?.dispose();
        renderer.current = null;
        if (!cancelled) setStatus("lost");
      }
    }).catch(() => { if (!cancelled) setStatus("lost"); });
    return () => {
      cancelled = true;
      playingRef.current = false;
      cancelStudioFrame(frame.current);
      studio?.dispose();
      renderer.current = null;
    };
  }, [generation]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function stopForEnvironment() {
      playingRef.current = false;
      cancelStudioFrame(frame.current);
      previousFrame.current = 0;
      setPlaying(false);
      setState({ ...latest.current });
    }
    function motionChanged() {
      setSystemReducedMotion(preference.matches);
      if (preference.matches) stopForEnvironment();
    }
    function visibilityChanged() {
      if (document.hidden && playingRef.current) {
        stopForEnvironment();
        setNotice("Paused while you were away. Continue when you’re ready.");
      }
    }
    motionChanged();
    preference.addEventListener("change", motionChanged);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      preference.removeEventListener("change", motionChanged);
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, []);

  function moveLight(event: PointerEvent<HTMLButtonElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !surface.current) return;
    const rect = surface.current.getBoundingClientRect();
    const x = (event.clientX - dragOffset.current.x - rect.left) / rect.width * 100;
    const y = (event.clientY - dragOffset.current.y - rect.top) / rect.height * 100;
    update({ lightAzimuth: Math.round(clamp((x - 50) / 0.34, -80, 80)), lightElevation: Math.round(clamp((60 - y) / 0.55, 20, 80)), reference: false, time: 0 });
  }

  function lightKey(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 1 : 5;
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const visibleLight = sampleLightAngles(latest.current);
    const azimuth = visibleLight.azimuth + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0);
    const elevation = visibleLight.elevation + (event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0);
    update(event.key === "Home" ? { lightAzimuth: DEFAULT_STUDIO_STATE.lightAzimuth, lightElevation: DEFAULT_STUDIO_STATE.lightElevation, reference: false, time: 0 } : { lightAzimuth: clamp(azimuth, -80, 80), lightElevation: clamp(elevation, 20, 80), reference: false, time: 0 });
  }

  function stageKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === " ") { event.preventDefault(); watch(); }
    else if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      seek(event.key === "Home" ? 0 : event.key === "End" ? study.duration : latest.current.time + study.duration * (event.key === "ArrowLeft" ? -0.05 : 0.05));
    }
  }

  // Keep this mounted inside the disclosure so frame updates remain in sync when it is closed.
  const playbackTimeline = <div className="sculptural-timeline-row"><div className="sculptural-timeline-track"><div ref={progress} className="sculptural-timeline-progress" /><input ref={timeline} key={state.study} type="range" min="0" max={study.duration} step="0.01" defaultValue={shown.time} disabled={state.reference && !isLight} onChange={event => seek(Number(event.target.value))} aria-label="Demonstration progress" aria-valuetext={`${timestamp(shown.time)}, ${getStudyPhase(state.study, shown.time).label}`} /></div><output ref={timeLabel}>{timestamp(shown.time)} / {timestamp(study.duration)}</output></div>;
  const referenceControl = <button type="button" className="sculptural-reference" aria-pressed={state.reference} onClick={() => update({ reference: !state.reference })}><span className="sculptural-compare-icon" aria-hidden="true" />{state.reference ? "Your study" : "Reference"}</button>;
  const checkpoints = isLight
    ? [{ label: "Before", time: 0 }, { label: "Action", time: actionTime }, { label: "Result", time: study.duration }]
    : isSurfaceStudy
      ? [{ label: "Before", time: 0 }, { label: "Application", time: actionTime }, { label: "Result", time: study.duration }]
      : [{ label: "Before", time: 0 }, { label: "After", time: study.duration }];
  const paintAdjustment = <div className="sculptural-inline-adjustment">
    <label htmlFor="sculptural-paint-amount">{study.adjustment}</label>
    <input id="sculptural-paint-amount" type="range" disabled={state.reference} min="0" max="100" value={displayedAmount} aria-valuetext={`${amountDescription}, ${adjustment.low.toLowerCase()} to ${adjustment.high.toLowerCase()}`} onChange={event => update({ amount: Number(event.target.value) / 100, reference: false })} />
    <output htmlFor="sculptural-paint-amount">{amountDescription}</output>
  </div>;

  return <div className="sculptural-preview">
    <header className="sculptural-header">
      <Link href="/" className="sculptural-wordmark" aria-label="Layer home"><Layers size={22} strokeWidth={1.6} aria-hidden="true" />layer.</Link>
      <span className="sculptural-local-label"><i aria-hidden="true" />Local studio <span> / </span> Visual study</span>
      <Link href="/techniques" className="sculptural-back"><ArrowLeft size={14} aria-hidden="true" /><span>Current techniques</span></Link>
    </header>

    <main id="main" className="sculptural-main">
      <div className="sculptural-intro">
        <div><h1>The technique studio.</h1></div>
        <p>See what the paint is doing.<br /> Make one small change. Look again.</p>
      </div>

      <nav className="sculptural-covers" aria-label="Choose a technique">
        {STUDIES.map(item => <button key={item.id} type="button" className="sculptural-cover" aria-pressed={state.study === item.id} onClick={() => selectStudy(item.id)}>
          <span className="sculptural-cover-image">
            <TechniqueCover technique={item.id} />
            {state.study === item.id && <span className="sculptural-cover-selected" aria-hidden="true"><Check size={13} /></span>}
          </span>
          <span className="sculptural-cover-title">{item.title}</span><span className="sculptural-cover-description">{item.subtitle}</span>
        </button>)}
      </nav>

      <section className="sculptural-workbench" aria-labelledby="sculptural-title">
        <div className="sculptural-workbench-heading"><h2 id="sculptural-title">{study.title}</h2><span className="sculptural-workbench-summary">{study.subtitle}</span></div>
        <div className="sculptural-workbench-grid">
          <div className="sculptural-player" data-status={status}>
            <div ref={surface} className="sculptural-surface" tabIndex={0} onKeyDown={stageKey} role="group" aria-label={`${study.title} demonstration. ${reducedMotion ? "" : "Space to play or pause. "}Arrow keys to seek. Home for before, End for ${isLight || isSurfaceStudy ? "result" : "after"}.`}>
              <div ref={canvasHost} className="sculptural-canvas" aria-hidden="true" style={{ visibility: status === "ready" ? "visible" : "hidden" }} />
              <div className="sculptural-surface-top"><span>{state.reference ? state.study === "light" ? "A painting plan" : "Reference result" : state.study === "light" ? (state.paintMap ? "A painting plan" : "Light on the form") : state.study === "layers" ? "Build colour in two coats" : state.study === "edges" ? "Follow the raised edge" : "One deliberate movement"}</span><button type="button" className="sculptural-quiet-button" onClick={() => update({ close: !state.close })} aria-pressed={state.close}>{state.close ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}{state.close ? "Whole form" : "Closer look"}</button></div>
              {status === "loading" && <div className="sculptural-loading" role="status"><span className="sculptural-loading-dot" />Preparing the studio</div>}
              {status === "lost" && <div className="sculptural-fallback">
                {/* eslint-disable-next-line @next/next/no-img-element -- Runtime canvas capture retained after context loss. */}
                {covers[state.study] && <img src={covers[state.study]} alt={`Still reference for ${study.title}`} />}
                <div role="status"><p>The interactive view is unavailable.</p><span>{covers[state.study] ? "Your reference and lesson are still here." : "You can still read the lesson while the studio reconnects."}</span><button type="button" onClick={() => { setStatus("loading"); setGeneration(value => value + 1); }}><RotateCcw size={14} aria-hidden="true" />Try again</button></div>
              </div>}
              {state.study === "light" && status === "ready" && !state.reference && <>
                <svg className="sculptural-light-line" aria-hidden="true"><line ref={lightLine} x1={`${lightHandle.x}%`} y1={`${lightHandle.y}%`} x2="50%" y2="51%" /></svg>
                <button ref={lightMarker} type="button" className="sculptural-light-handle" style={{ left: `${lightHandle.x}%`, top: `${lightHandle.y}%` }} role="slider" aria-label="Light position. Drag or use arrow keys; Shift for small changes." aria-valuemin={-80} aria-valuemax={80} aria-valuenow={Math.round(sampledLight.azimuth)} aria-valuetext={`${Math.round(Math.abs(sampledLight.azimuth))} degrees ${sampledLight.azimuth < 0 ? "left" : "right"}, ${sampledLight.elevation} degrees above`} onKeyDown={lightKey}
                  onPointerDown={event => { const rect = event.currentTarget.getBoundingClientRect(); dragOffset.current = { x: event.clientX - rect.left - rect.width / 2, y: event.clientY - rect.top - rect.height / 2 }; event.currentTarget.setPointerCapture(event.pointerId); pause(); }}
                  onPointerMove={moveLight} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}><Sun size={19} strokeWidth={1.4} aria-hidden="true" /></button>
              </>}
              <div className="sculptural-surface-bottom"><span className="sculptural-phase"><i aria-hidden="true" />{state.reference ? state.study === "light" ? "Three simple values" : "A controlled application" : phase.label}</span><span>{state.study === "light" ? state.reference ? "Same form · Same light" : "Drag the light · Arrow keys to adjust" : "Illustrative paint coverage"}</span></div>
            </div>

            <div className={`sculptural-transport${isLight ? "" : " sculptural-transport--painting"}`}>
              <div className="sculptural-transport-main">
                {!reducedMotion && <button type="button" className="sculptural-play" onClick={watch} disabled={status !== "ready"}>{playing ? <Pause size={15} fill="currentColor" aria-hidden="true" /> : state.time >= study.duration ? <RotateCcw size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}{playing ? "Pause" : state.time >= study.duration ? "Replay" : "Watch"}</button>}
                <div className="sculptural-checkpoints" role="group" aria-label="Demonstration checkpoints">
                  {checkpoints.map(point => <button type="button" key={point.label} aria-pressed={!playing && !state.reference && Math.abs(state.time - point.time) < 0.001} onClick={() => seek(point.time)}>{point.label}</button>)}
                </div>
                {isLight || isSurfaceStudy ? referenceControl : paintAdjustment}
              </div>
              {isLight ? <>
                {playbackTimeline}
                <div className="sculptural-extra-controls">
                  <div className="sculptural-form-controls" role="group" aria-label="Practice form"><button type="button" aria-pressed={state.form === "sphere"} onClick={() => update({ form: "sphere" })}>Sphere</button><button type="button" aria-pressed={state.form === "block"} onClick={() => update({ form: "block" })}>Bevelled block</button><button type="button" className="sculptural-paint-map" aria-pressed={state.reference || state.paintMap} onClick={() => update({ reference: false, paintMap: !(state.reference || state.paintMap) })}>Painting plan {(state.reference || state.paintMap) && <Check size={12} aria-hidden="true" />}</button></div>
                  <button type="button" className="sculptural-adjust-toggle" aria-expanded={adjustOpen} aria-controls="sculptural-adjustment" onClick={() => setAdjustOpen(!adjustOpen)}><SlidersHorizontal size={14} aria-hidden="true" />{study.adjustment}</button>
                </div>
                {adjustOpen && <div id="sculptural-adjustment" className="sculptural-adjustment"><label htmlFor="sculptural-amount"><span>{study.adjustment}</span><output>{`${Math.abs(displayedAmount)}° ${displayedAmount < 0 ? "left" : displayedAmount > 0 ? "right" : "centred"}`}</output></label><input id="sculptural-amount" type="range" min="-80" max="80" value={displayedAmount} onChange={event => update({ lightAzimuth: Number(event.target.value), reference: false, time: 0 })} /><div className="sculptural-adjustment-extents"><span>{adjustment.low}</span><span>{adjustment.high}</span></div></div>}
              </> : <details key={state.study} className="sculptural-playback-options">
                <summary>{isSurfaceStudy ? `Adjust ${study.adjustment.toLowerCase()}` : "Playback options"} <ChevronDown size={12} aria-hidden="true" />{state.reference && <span className="sculptural-reference-status">Reference shown</span>}</summary>
                <div className="sculptural-playback-content">
                  {isSurfaceStudy && <div className="sculptural-study-adjustment">{paintAdjustment}<p>{state.study === "layers" ? "Less paint leaves more primer visible. A second dry coat builds the colour." : "A lighter touch keeps the line narrow. More pressure lets paint reach onto the faces."}</p></div>}
                  {playbackTimeline}
                  {!isSurfaceStudy && <div className="sculptural-playback-actions">
                    <button type="button" className="sculptural-action-checkpoint" aria-pressed={!playing && !state.reference && Math.abs(state.time - actionTime) < .001} onClick={() => seek(actionTime)}>During application</button>
                    {referenceControl}
                  </div>}
                </div>
              </details>}
            </div>
          </div>

          <aside className="sculptural-notes" aria-label="Painting guidance">
            <div className="sculptural-observation"><p className="sculptural-eyebrow">What to look for</p><h3>{study.lookFor}</h3></div>
            <div className="sculptural-instruction"><div><h3>Your starting point</h3><p>{study.prepared}</p></div></div>
            <div className="sculptural-instruction"><div><h3>The next movement</h3><p>{study.action}</p></div></div>
            <div className={state.reference || phase.label === "Let the first coat dry" ? "sculptural-current-moment" : "sr-only"} aria-live="polite" aria-atomic="true"><span className="sculptural-eyebrow">{state.reference ? "Compare the result" : phase.label}</span><p>{state.reference ? state.study === "light" ? "The light and the form stay in place. Three values suggest where to paint shadow, midtone and highlight." : "Look at the width of the marks and the detail left visible. Your study returns to exactly where you paused." : phase.description}</p></div>
            {(state.study === "layers" || state.study === "edges") && <ContactDiagram study={state.study} />}
            <p className="sculptural-practice-note">Look closely, then try the same movement on a spare piece.</p>
          </aside>
        </div>
        {(reducedMotion || notice) && <p className="sculptural-environment-notice" role="status">{reducedMotion ? isLight ? "Reduced motion is on. Use Before, Action and Result to explore at your own pace." : isSurfaceStudy ? "Reduced motion is on. Use Before, Application and Result to explore at your own pace." : "Reduced motion is on. Compare Before and After, or inspect a moment in Playback options." : notice}</p>}
      </section>

      <footer className="sculptural-footer"><p>Five small studies. One painting table.</p><details><summary>About this preview</summary><div><p>Local visual study. Illustrative paint coverage, with compressed drying time. Practice and saved progress are independent of the main site.</p>{metrics && <p className="sculptural-metrics">Renderer initialisation {Math.round(metrics.loadMs)} ms · Mean render submission {metrics.drawMs.toFixed(1)} ms · {metrics.triangles.toLocaleString()} triangles · {metrics.dpr.toFixed(1)}× resolution</p>}<div className="sculptural-preview-checks"><label><input type="checkbox" checked={pauseMotion || systemReducedMotion} disabled={systemReducedMotion} onChange={event => { setPauseMotion(event.target.checked); if (event.target.checked) pause(); }} />Pause motion{systemReducedMotion && <span>Enabled by your device</span>}</label><button type="button" disabled={status !== "ready"} onClick={() => { pause(); renderer.current?.simulateContextLoss(); }}>Test 3D recovery</button></div></div></details></footer>
    </main>
  </div>;
}
