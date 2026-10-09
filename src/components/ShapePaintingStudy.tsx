"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import SurfacePaintingScene from "./SurfacePaintingScene";
import { BrushContactDiagram } from "./BrushContactDiagram";
import { PAINTING_TECHNIQUES, TECHNIQUE_ORDER } from "@/lib/painting-techniques";
import { advanceLesson, chapterIndex, lessonChapters, lessonLocation, paletteLessonChapters, LESSON_SOURCES } from "@/lib/painting-lesson";
import { chapterContactTime, chapterResultTime, lessonCheckpoints, nearestLessonCheckpoint, nextGuidedMoment, phasesForChapter, resolveLessonEntry, type GuidedPhase } from "@/lib/guided-lesson";
import { WORKSHOPS, createLessonClock, describeExperiment } from "@/lib/workshop";
import { flatPaintIsDrying } from "@/lib/flat-painting";
import { cancelStudioFrame, requestStudioFrame } from "@/lib/studio-scheduler";
import type { StudyContext } from "@/lib/study-context";
import { materialReturnHref } from "@/lib/study-links";
import type { TechniqueId } from "@/lib/technique-study-types";
import "./guided-painting-study.css";

function subscribeMotion(change: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
export type LessonFocus = { technique: TechniqueId; chapterId: string; revision: number; workshop?: "explore" | "compare" };
type PlayerProps = {
  embedded?: boolean; initialTechnique?: TechniqueId; initialChapterId?: string;
  focusRequest?: LessonFocus; suspended?: boolean; returnHref?: string; fullLessonHref?: string;
  paintContext?: StudyContext; initialMaterialId?: string; onMaterialChange?: (id: string) => void;
};
type Moment = { technique: TechniqueId; chapterId: string; phase: GuidedPhase };
const phaseLabels = { watch: "See how it works", explore: "Make a small change", compare: "Notice the difference", practice: "Take it to your table" };

export function ShapePaintingStudy({ embedded = false, initialTechnique = "layers", initialChapterId, focusRequest, suspended = false, returnHref, fullLessonHref, paintContext, initialMaterialId, onMaterialChange }: PlayerProps = {}) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const adjustment = useRef<HTMLDivElement>(null);
  const detailButton = useRef<HTMLButtonElement>(null);
  const lightControl = useRef<HTMLInputElement>(null);
  const pendingCoachFocus = useRef(false);
  const clock = useMemo(() => createLessonClock(), []);
  const [moment, setMoment] = useState<Moment>(() => ({ technique: initialTechnique, chapterId: initialChapterId ?? lessonChapters(initialTechnique)[0].id, phase: "watch" }));
  const [time, setTime] = useState(() => lessonChapters(initialTechnique).find(c => c.id === initialChapterId)?.start ?? 0);
  const elapsed = useRef(time);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);
  const [visible, setVisible] = useState(true);
  const [amount, setAmount] = useState(.4);
  const [reference, setReference] = useState(false);
  const [adjustmentClosed, setAdjustmentClosed] = useState(false);
  const [detail, setDetail] = useState(false);
  const [light, setLight] = useState(-35);
  const [lightOpen, setLightOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stills, setStills] = useState(false);
  const [materialId, setMaterialId] = useState(initialMaterialId);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const staticMode = reduced || stills;
  const blocked = staticMode || suspended;
  const [previousBlocked, setPreviousBlocked] = useState(blocked);
  if (blocked !== previousBlocked) {
    setPreviousBlocked(blocked);
    if (blocked) setPlaying(false);
  }
  const availableKey = (paintContext ? TECHNIQUE_ORDER.filter(t => paintContext.options[t]?.length) : TECHNIQUE_ORDER).join(",");
  const available = TECHNIQUE_ORDER.filter(t => availableKey.split(",").includes(t));
  const options = paintContext?.options[moment.technique] ?? [];
  const material = options.find(item => item.id === materialId) ?? options[0];
  const palette = material?.palette;
  const chapters = useMemo(() => paletteLessonChapters(moment.technique, palette), [moment.technique, palette]);
  const chapter = chapters.find(c => c.id === moment.chapterId) ?? chapters[0];
  const index = chapters.indexOf(chapter);
  const study = PAINTING_TECHNIQUES[moment.technique];
  const workshop = WORKSHOPS[moment.technique];
  const experimenting = moment.phase === "explore" || moment.phase === "compare";
  const adjustmentVisible = experimenting && !adjustmentClosed;
  const canAdjust = phasesForChapter(moment.technique, chapter.id).includes("explore");
  const matchingReference = Math.abs(amount - .4) < .001;
  const preparing = moment.technique === "layers" && ["prepare", "load"].includes(chapter.id);
  const lightExercise = moment.technique === "layers" && chapter.id === "light";
  const watchPlayback = moment.phase === "watch" && !staticMode && !lightExercise;
  const running = playing && visible && !suspended && !staticMode;
  const experiment = experimenting ? { amount, reference: (embedded || moment.phase === "compare") && reference, light, lighting: lightOpen } : chapter.id === "light" || lightOpen ? { amount: .4, reference: true, light, lighting: true } : undefined;
  const paint = palette?.coats[moment.technique === "layers" ? (index < 4 ? 0 : index === 4 ? 1 : 2) : index];
  const phaseHeading = moment.phase === "explore" ? (workshop.noun === "load" ? "A little less. A little more." : "Find the lightest touch.")
    : moment.phase === "compare" ? matchingReference ? "A controlled mark." : "One change. See the difference."
    : moment.phase === "practice" ? "Now, your brush." : chapter.name;
  const instruction = moment.phase === "explore" ? workshop.instruction : moment.phase === "compare" ? matchingReference ? `Your ${workshop.noun} matches the reference. Adjust it to see what changes.` : workshop.outcome : moment.phase === "practice" ? chapter.instruction.split(/(?<=\.)\s/).slice(0, 2).join(" ") : chapter.cue;
  const resultTime = chapterResultTime(moment.technique, chapter.id);
  const contactTime = chapterContactTime(moment.technique, chapter.id);
  const next = nextGuidedMoment(moment.technique, chapter.id, moment.phase);
  const checkpoints = lessonCheckpoints(moment.technique, chapter.id);
  const checkpoint = checkpoints.find(point => Math.abs(time - point.value) < .02)?.label;
  const displayedAmount = reference ? .4 : amount;
  const embeddedAmountLabel = workshop.noun === "load"
    ? displayedAmount < .25 ? "Less paint" : displayedAmount > .65 ? "More paint" : "Moderate amount"
    : displayedAmount < .25 ? "Light pressure" : displayedAmount > .65 ? "Firm pressure" : "Moderate pressure";
  const embeddedStageState = flatPaintIsDrying(moment.technique, time) ? "Let the coat dry"
    : experimenting ? reference ? "Reference setting" : "Your setting"
    : running ? chapter.cue
    : checkpoint === "Contact" ? "Paint application"
    : checkpoint === "Result" && moment.technique === "layers" && chapter.id === "first-coat" ? "One thin coat"
    : checkpoint ?? "Paused";
  const stageState = flatPaintIsDrying(moment.technique, time) ? "Let the coat dry" : running ? "Watch the paint build" : experimenting ? reference ? "Controlled mark" : "Your mark" : checkpoint === "Contact" ? "Application" : checkpoint ?? "Paused";

  const revealDemoIfClipped = useCallback(() => {
    const titleBounds = heading.current?.getBoundingClientRect();
    const sceneBounds = scene.current?.getBoundingClientRect();
    if (!titleBounds || !sceneBounds) return;
    const controlBounds = (lightExercise ? lightControl.current ?? primary.current : primary.current)?.getBoundingClientRect();
    const adjustmentBounds = embedded ? adjustment.current?.getBoundingClientRect() : undefined;
    const viewport = window.visualViewport;
    const safeTop = (viewport?.offsetTop ?? 0) + 16;
    const safeBottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 16;
    const top = embedded ? sceneBounds.top : titleBounds.top;
    const bottom = Math.max(sceneBounds.bottom, controlBounds?.bottom ?? 0, adjustmentBounds?.bottom ?? 0);
    if (top >= safeTop && bottom <= safeBottom) return;
    // Keep an already visible demonstration still. On a short viewport, reveal
    // its heading rather than repeatedly pulling the page between controls.
    const offset = bottom - top > safeBottom - safeTop || top < safeTop ? top - safeTop : bottom - safeBottom;
    window.scrollBy({ top: offset, behavior: "instant" });
  }, [embedded, lightExercise]);

  function seek(value: number) { elapsed.current = value; clock.publish(value); setTime(value); }
  function go(technique: TechniqueId, chapterId: string, phase: GuidedPhase = "watch", focus = false) {
    const target = lessonChapters(technique).find(c => c.id === chapterId);
    if (!target) return;
    setPlaying(false); setFinished(false); setDetail(false); setReference(false); setLightOpen(false);
    setMoment({ technique, chapterId, phase });
    seek(phase === "watch" ? target.start : chapterResultTime(technique, chapterId));
    if (!embedded) window.history.replaceState(null, "", `#${technique}/${chapterId}`);
    if (focus) requestAnimationFrame(() => {
      primary.current?.focus({ preventScroll: true });
      if (!embedded) revealDemoIfClipped();
    });
  }
  function proceed() {
    if (embedded) return;
    if (next) go(moment.technique, next.chapterId, next.phase, true);
    else { go(moment.technique, chapters[0].id, "watch", true); }
  }
  function replay() {
    setFinished(false);
    seek(staticMode ? (Math.abs(time - contactTime) < .02 ? resultTime : contactTime) : chapter.start);
    setPlaying(!staticMode);
  }
  function togglePlayback() {
    if (running) { setPlaying(false); setTime(elapsed.current); }
    else if (finished || elapsed.current >= resultTime - .01) replay();
    else setPlaying(true);
  }
  function toggleDemoPlayback() {
    if (experimenting) {
      setMoment(previous => ({ ...previous, phase: "watch" }));
      setAdjustmentClosed(false);
      setReference(false);
      replay();
    } else togglePlayback();
    if (!running) revealDemoIfClipped();
  }
  function selectDemoCheckpoint(value: number) {
    setPlaying(false);
    setFinished(value >= resultTime - .01);
    setReference(false);
    setAdjustmentClosed(false);
    setMoment(previous => ({ ...previous, phase: "watch" }));
    seek(value);
  }
  function toggleAdjustment() {
    setPlaying(false);
    if (adjustmentVisible) {
      // Collapse only the controls. Keep the learner's visible result until Replay.
      setAdjustmentClosed(true);
      return;
    }
    setAdjustmentClosed(false);
    setReference(false);
    setFinished(true);
    setMoment(previous => ({ ...previous, phase: "explore" }));
    seek(resultTime);
  }

  useEffect(() => {
    if (!running) return;
    let frame = 0, previous: number | undefined, lastUI = 0;
    const tick = (now: number) => {
      const delta = previous === undefined ? 0 : Math.min(64, now - previous) / 1000;
      const update = advanceLesson(elapsed.current, delta, speed, resultTime, resultTime);
      previous = now; elapsed.current = update.time; clock.publish(update.time);
      if (now - lastUI > 120 || update.stopped) { setTime(update.time); lastUI = now; }
      if (update.stopped) { setPlaying(false); setFinished(true); }
      else frame = requestStudioFrame(tick);
    };
    frame = requestStudioFrame(tick);
    return () => cancelStudioFrame(frame);
  }, [running, speed, resultTime, clock]);
  useEffect(() => {
    if (!staticMode) return;
    // This also responds when the system preference changes during playback.
    // Keep the selected teaching moment explicit in both the scene and controls.
    const frame = requestStudioFrame(() => {
      const value = nearestLessonCheckpoint(moment.technique, moment.chapterId, elapsed.current);
      elapsed.current = value; clock.publish(value); setTime(value); setPlaying(false);
    });
    return () => cancelStudioFrame(frame);
  }, [staticMode, moment.technique, moment.chapterId, clock]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { setPlaying(false); setTime(elapsed.current); } };
    document.addEventListener("visibilitychange", hide);
    const observer = new IntersectionObserver(([entry]) => { setVisible(entry.isIntersecting); if (!entry.isIntersecting) setPlaying(false); }, { threshold: .08 });
    if (scene.current) observer.observe(scene.current);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", hide); };
  }, []);
  useEffect(() => {
    if (embedded) return;
    const read = () => {
      // Back/forward may restore a cached server entry with older props. The
      // current URL owns the material; rendering still validates its option.
      setMaterialId(new URL(window.location.href).searchParams.get("material") ?? undefined);
      const target = lessonLocation(window.location.hash);
      if (!target || !availableKey.split(",").includes(target.id)) return;
      const targetChapter = lessonChapters(target.id)[chapterIndex(lessonChapters(target.id), target.time)];
      setPlaying(false); setFinished(false); setDetail(false); setReference(false); setLightOpen(false); setAmount(.4);
      setMoment({ technique: target.id, chapterId: targetChapter.id, phase: "watch" });
      elapsed.current = target.time; setTime(target.time); clock.publish(target.time);
    };
    read(); window.addEventListener("hashchange", read); window.addEventListener("popstate", read);
    return () => { window.removeEventListener("hashchange", read); window.removeEventListener("popstate", read); };
  }, [embedded, availableKey, clock]);
  useEffect(() => {
    if (!focusRequest || !availableKey.split(",").includes(focusRequest.technique)) return;
    const target = resolveLessonEntry(focusRequest.technique, focusRequest.chapterId, focusRequest.workshop);
    if (!target) return;
    // Coach actions arrive from outside this player. Apply and focus them together.
    const frame = requestStudioFrame(() => {
      setPlaying(false); setFinished(false); setDetail(false); setReference(target.reference); setAdjustmentClosed(false); setLightOpen(false); setAmount(target.amount);
      setMoment({ chapterId: target.chapterId, phase: target.phase, technique: focusRequest.technique });
      elapsed.current = target.time; setTime(target.time); clock.publish(target.time);
      pendingCoachFocus.current = true;
    });
    return () => cancelStudioFrame(frame);
  }, [focusRequest, availableKey, clock]);
  useEffect(() => {
    if (!pendingCoachFocus.current) return;
    pendingCoachFocus.current = false;
    revealDemoIfClipped();
    (lightExercise ? lightControl.current : primary.current)?.focus({ preventScroll: true });
  }, [moment, lightExercise, revealDemoIfClipped]);
  useEffect(() => {
    if (embedded && adjustmentVisible) revealDemoIfClipped();
  }, [embedded, adjustmentVisible, revealDemoIfClipped]);
  useEffect(() => {
    if (!detail || suspended) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && !event.defaultPrevented) { setDetail(false); detailButton.current?.focus({ preventScroll: true }); } };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [detail, suspended]);

  const primaryText = moment.phase === "watch" ? (!watchPlayback ? "Continue" : running ? "Pause" : finished ? "Continue" : "Watch this step")
    : moment.phase === "explore" ? "Compare the marks" : moment.phase === "compare" ? "Try it with your brush" : next ? "Next step" : "Revisit the lesson";
  return <section ref={root} className={`shape-study guided-study${embedded ? " shape-study--embedded" : ""}`} aria-label="Painting technique player">
    {!embedded && <header className="guided-header"><Link href={materialReturnHref(returnHref, material?.id) ?? "/#techniques"}><ArrowLeft size={14} />{returnHref ? "Return to your painting step" : "All techniques"}</Link>
      <label className="guided-technique">Technique<select aria-label="Painting technique" value={moment.technique} onChange={e => { const technique = e.target.value as TechniqueId; setAmount(.4); go(technique, lessonChapters(technique)[0].id); }}>{available.map(t => <option key={t} value={t}>{PAINTING_TECHNIQUES[t].label}</option>)}</select></label>
    </header>}
    {!embedded && <div className="guided-heading" aria-live="polite" aria-atomic="true">
      <p className="guided-eyebrow">{study.label}<span aria-hidden="true">/</span>{String(index + 1).padStart(2, "0")} of {String(chapters.length).padStart(2, "0")}</p>
      <h1 ref={heading}>{phaseHeading}</h1>
      <p className="guided-instruction">{instruction}</p>
    </div>}
    {!embedded && options.length > 1 && <label className="guided-material">Practise on<select value={material?.id ?? ""} onChange={e => { setPlaying(false); setMaterialId(e.target.value); onMaterialChange?.(e.target.value); const url = new URL(window.location.href); url.searchParams.set("material", e.target.value); window.history.replaceState(null, "", url); }}>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
    <div className="guided-stage" ref={scene} data-phase={moment.phase} data-playing={running} data-technique={moment.technique}>
      <SurfacePaintingScene technique={moment.technique} time={time} clock={clock} palette={palette} experiment={experiment} detail={detail} />
      <div className="guided-stage-caption">{embedded ? <h2 ref={heading} className="embedded-technique-heading">{study.label}</h2> : <span>{detail ? "A closer look" : preparing ? "Preparation" : study.surface}</span>}{paint && <span className="guided-paint"><i aria-hidden="true" style={{ background: paint.hex }} />{paint.name.replace("Citadel ", "")}</span>}</div>
      <div className={`guided-stage-footer${preparing ? " guided-stage-footer--preparing" : lightExercise ? " guided-stage-footer--light" : ""}`}>
        {preparing ? <><span>{chapter.id === "load" ? "Load & unload" : "On the palette"}</span><span>Test the mark</span></> : lightExercise ? null : <>
          <span className="guided-view-state">{embedded ? embeddedStageState : stageState}</span>
          <button ref={detailButton} className="guided-detail" aria-label={detail ? "Return to whole surface" : "Examine paint application"} aria-pressed={detail} onClick={() => { setPlaying(false); setDetail(!detail); if (!detail && moment.phase !== "compare" && moment.phase !== "practice") seek(contactTime); }}>{detail ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{detail ? "Whole surface" : "Closer look"}</span></button>
        </>}
      </div>
    </div>
    {embedded ? <div className="embedded-demonstration-controls">
      {lightExercise ? <div className="guided-experiment embedded-light-control">
        <label htmlFor={`${id}-demo-light`}>Painted light direction</label>
        <input ref={lightControl} id={`${id}-demo-light`} type="range" min="-80" max="80" value={light} onChange={event => setLight(event.currentTarget.valueAsNumber)} aria-valuetext={`${light} degrees from above`} />
      </div> : <>
        <div className="embedded-demo-transport">
          {!staticMode && <button ref={primary} className="guided-primary" onClick={toggleDemoPlayback}>
            {running ? <Pause size={15} aria-hidden /> : finished || experimenting || time >= resultTime - .01 ? <RotateCcw size={15} aria-hidden /> : <Play size={15} aria-hidden />}
            {running ? "Pause" : finished || experimenting || time >= resultTime - .01 ? "Replay" : time > chapter.start + .01 ? "Resume" : "Watch demo"}
          </button>}
          <div className="guided-static" role="group" aria-label="Demonstration checkpoints">
            {checkpoints.map((point, pointIndex) => <button ref={staticMode && pointIndex === 0 ? primary : undefined} key={point.label} aria-pressed={!running && Math.abs(time - point.value) < .02} onClick={() => selectDemoCheckpoint(point.value)}>{point.label === "Contact" ? "Application" : point.label}</button>)}
          </div>
          {canAdjust && <button className="guided-text-button embedded-adjust-toggle" aria-expanded={adjustmentVisible} aria-controls={`${id}-adjustment`} onClick={toggleAdjustment}>Change {workshop.noun === "load" ? "paint amount" : "brush pressure"}<span aria-hidden>{adjustmentVisible ? "−" : "+"}</span></button>}
        </div>
        {canAdjust && adjustmentVisible && <div ref={adjustment} id={`${id}-adjustment`} className="embedded-adjustment">
          <div className="embedded-experiment-heading">
            <label htmlFor={`${id}-demo-amount`}>{workshop.noun === "load" ? "Paint on the brush" : "Brush pressure"}<output htmlFor={`${id}-demo-amount`}>{embeddedAmountLabel}</output></label>
            <div className="guided-comparison" role="group" aria-label="Compare paint application">
              <button aria-pressed={!reference} onClick={() => setReference(false)}>Your setting</button>
              <button aria-pressed={reference} onClick={() => setReference(true)}>Reference</button>
            </div>
          </div>
          <input id={`${id}-demo-amount`} type="range" min="0" max="1" step=".05" value={displayedAmount} aria-valuetext={embeddedAmountLabel} onChange={event => { setPlaying(false); setReference(false); setAmount(event.currentTarget.valueAsNumber); seek(detail ? contactTime : resultTime); }} />
          <div className="guided-range-labels"><span>{workshop.noun === "load" ? "Less paint" : "Light pressure"}</span><button onClick={() => { setAmount(.4); setReference(false); seek(detail ? contactTime : resultTime); }}>Reset</button><span>{workshop.noun === "load" ? "More paint" : "Firm pressure"}</span></div>
          <p className="embedded-comparison-note" aria-live="polite">{reference ? `Showing the reference ${workshop.noun === "load" ? "amount" : "pressure"} on the same strokes. Move the slider to return to your setting.` : describeExperiment(moment.technique, amount, false)}</p>
        </div>}
        <details className="embedded-playback-options">
          <summary>Demo options</summary>
          <label className="embedded-progress-label" htmlFor={`${id}-seek`}>Demo progress <span>{Math.round(Math.max(0, (time - chapter.start) / (resultTime - chapter.start)) * 100)}%</span></label>
          <input id={`${id}-seek`} type="range" min={chapter.start} max={resultTime} step=".01" value={time} onChange={event => { setPlaying(false); setFinished(false); seek(event.currentTarget.valueAsNumber); }} />
          <div className="guided-settings">
            {!staticMode && <label><input type="checkbox" checked={speed === .5} onChange={event => setSpeed(event.currentTarget.checked ? .5 : 1)} /> Half speed</label>}
            <label><input type="checkbox" checked={staticMode} disabled={reduced} onChange={event => { setPlaying(false); setStills(event.currentTarget.checked); }} /> Show still views</label>
          </div>
          {reduced && <p>Still views follow your reduced-motion preference.</p>}
          {options.length > 1 && <label className="guided-material">Practise on<select value={material?.id ?? ""} onChange={event => { setPlaying(false); setMaterialId(event.target.value); onMaterialChange?.(event.target.value); }}>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
          {fullLessonHref && <Link className="embedded-full-lesson" href={fullLessonHref}>Open full technique lesson <ArrowRight size={13} aria-hidden /></Link>}
        </details>
        <BrushContactDiagram key={moment.technique} technique={moment.technique} />
      </>}
      {lightExercise && <>
        {options.length > 1 && <label className="guided-material">Practise on<select value={material?.id ?? ""} onChange={event => { setMaterialId(event.target.value); onMaterialChange?.(event.target.value); }}>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
        {fullLessonHref && <Link className="embedded-full-lesson" href={fullLessonHref}>Open full technique lesson <ArrowRight size={13} aria-hidden /></Link>}
      </>}
    </div> : <><div className="guided-interaction">
      {!(lightExercise && moment.phase === "watch") && <p className="guided-phase-label">{phaseLabels[moment.phase]}</p>}
      {moment.phase === "explore" && <div className="guided-experiment">
        <label htmlFor={`${id}-amount`}>{workshop.control}<output>{amount < .25 ? "Light" : amount > .65 ? "Heavy" : "Controlled"}</output></label>
        <input id={`${id}-amount`} type="range" min="0" max="1" step=".05" value={amount} aria-valuetext={`${amount < .25 ? "Low" : amount > .65 ? "High" : "Controlled"} ${workshop.noun}`} onChange={e => { setPlaying(false); setAmount(e.currentTarget.valueAsNumber); seek(detail ? contactTime : resultTime); }} />
        <div className="guided-range-labels"><span>{workshop.low}</span><button onClick={() => { setAmount(.4); setPlaying(false); seek(detail ? contactTime : resultTime); }}>Reset</button><span>{workshop.high}</span></div>
      </div>}
      {moment.phase === "compare" && <div className="guided-compare-controls"><div className="guided-comparison" role="group" aria-label="Compare paint application"><button aria-pressed={!reference} onClick={() => setReference(false)}>Your mark</button><button aria-pressed={reference} onClick={() => setReference(true)}>Controlled mark</button></div><button className="guided-text-button" onClick={() => go(moment.technique, chapter.id, "explore", true)}>Adjust {workshop.noun}</button></div>}
      {moment.phase === "watch" && chapter.id === "light" && <div className="guided-experiment"><label htmlFor={`${id}-light-first`}>Painted light direction</label><input ref={lightControl} id={`${id}-light-first`} type="range" min="-80" max="80" value={light} onChange={e => { setPlaying(false); setLight(e.currentTarget.valueAsNumber); }} aria-valuetext={`${light} degrees from above`} /></div>}
      {staticMode && !lightExercise && moment.phase !== "practice" && <div className="guided-static" role="group" aria-label="Still checkpoints">{checkpoints.map(point => <button key={point.label} aria-pressed={Math.abs(time-point.value)<.02} onClick={() => {setPlaying(false);seek(point.value);}}>{point.label === "Contact" ? "Application" : point.label}</button>)}</div>}
      <div className="guided-actions">
        <button ref={primary} className="guided-primary" onClick={() => watchPlayback && !finished ? togglePlayback() : proceed()}>{watchPlayback && !finished ? running ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" /> : null}{primaryText}{!(watchPlayback && !finished) && <ArrowRight size={15} />}</button>
        {watchPlayback && !finished && <button className="guided-text-button" onClick={proceed}>Continue <ArrowRight size={13} /></button>}
        {(finished || moment.phase === "explore" || moment.phase === "compare") && <button className="guided-text-button" onClick={() => { if (running) { setPlaying(false); setTime(elapsed.current); } else replay(); }}>{running ? <Pause size={14} /> : <RotateCcw size={14} />}{staticMode ? "Application / result" : running ? "Pause" : "Replay this step"}</button>}
      </div>
      <p className="guided-footnote">{moment.phase === "practice" ? "Your place is yours to choose. Watching does not complete physical practice." : experimenting ? "An illustration of cause and effect. Actual paints and brushes vary." : lightExercise ? "Painted light is a choice, separate from the lamp on your desk." : "Illustrated timing. Let each real coat dry before the next."}</p>
    </div>
    <BrushContactDiagram key={moment.technique} technique={moment.technique} />
    <details className="guided-steps"><summary>Lesson steps <span>{index + 1} / {chapters.length}</span></summary>
      <div className="guided-step-content"><nav aria-label="Lesson chapters">{chapters.map((c, i) => <button key={c.id} aria-current={chapter.id === c.id ? "step" : undefined} onClick={() => go(moment.technique, c.id, "watch", true)}><span>{String(i + 1).padStart(2, "0")}</span>{c.name}</button>)}</nav>
        <div className="guided-notes"><h3>{chapter.name}</h3><p>{chapter.instruction}</p>
          <label htmlFor={`${id}-progress`}>Step progress <span>{Math.round(Math.max(0, (time-chapter.start)/(resultTime-chapter.start))*100)}%</span></label><input id={`${id}-progress`} aria-label="Step progress" type="range" min={chapter.start} max={resultTime} step=".01" value={time} onChange={e => { setPlaying(false);setFinished(false);seek(e.currentTarget.valueAsNumber); }} />
          <div className="guided-settings"><label>Speed<select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.currentTarget.value))}><option value={1}>Normal</option><option value={.5}>Half speed</option></select></label><label><input type="checkbox" checked={staticMode} disabled={reduced} onChange={e => { setPlaying(false);setStills(e.currentTarget.checked); }} /> Still checkpoints</label></div>
          {(moment.technique === "layers" || moment.technique === "edges") && chapter.id !== "light" && <details className="guided-light"><summary>Understand the light direction</summary><p>A diagram of where you intend the light to come from, rather than simulated surface lighting.</p><label><input type="checkbox" checked={lightOpen} onChange={e => {setPlaying(false);setLightOpen(e.currentTarget.checked);}} /> Show light diagram</label><input aria-label="Painted light direction" type="range" min="-80" max="80" value={light} onChange={e => setLight(e.currentTarget.valueAsNumber)} /></details>}
        </div>
      </div>
      <details className="guided-sources"><summary>Learn from the painters</summary>{LESSON_SOURCES.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.name} ↗</a>)}</details>
    </details></>}
  </section>;
}
