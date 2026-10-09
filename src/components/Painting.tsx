"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  NotebookPen,
  Pause,
  RotateCcw,
} from "lucide-react";
import { type Guide } from "@/lib/guides";
import { MAX_SESSION_NOTES_LENGTH } from "@/lib/session";
import { materialInstructions } from "@/lib/material-instructions";
import { resolvePracticeView, showsPracticeSummary, type PracticeView } from "@/lib/practice-view";
import { usePractice } from "./PracticeProvider";
import { ShapePaintingStudy, type LessonFocus } from "./ShapePaintingStudy";
import { PaintingCoach } from "./PaintingCoach";
import { lessonExample, type LessonExample } from "@/lib/lesson-examples";
import { guideStudyContext } from "@/lib/study-context";
import { Modal, Sources } from "./shared";
import { techniqueHref } from "@/lib/technique-navigation";
import { WorkbenchProgression } from "./WorkbenchProgression";
import "./painting-refinements.css";
import "./painting-workspace.css";

export function Painting({ guide }: { guide: Guide }) {
  return (
    <Suspense fallback={<PracticeLoading />}>
      <PaintingFromUrl guide={guide} />
    </Suspense>
  );
}

function PracticeLoading() {
  return <div className="workbench-loading" role="status"><span className="sr-only">Restoring your painting table…</span><div aria-hidden="true" className="loading-heading" /><div aria-hidden="true" className="loading-stage" /></div>;
}

function PaintingFromUrl({ guide }: { guide: Guide }) {
  const params = useSearchParams();
  const query = params.get("step");
  const requestedStepId = guide.steps.find((step) => step.id === query)?.id;
  return (
    <PaintingPractice
      key={guide.id}
      guide={guide}
      requestedStepId={requestedStepId}
      requestedMaterialId={params.get("material") ?? undefined}
      requestedNote={params.get("note") === "1"}
    />
  );
}

function PaintingPractice({
  guide,
  requestedStepId,
  requestedMaterialId,
  requestedNote = false,
}: {
  guide: Guide;
  requestedStepId?: string;
  requestedMaterialId?: string;
  requestedNote?: boolean;
}) {
  const { sessions, ready, error, change, advance } = usePractice();
  const [view, setView] = useState<PracticeView | null>(null);
  const [appliedQuery, setAppliedQuery] = useState(requestedStepId);
  const appliedEntry = useRef<string | undefined>(undefined);
  const [notesOpen, setNotesOpen] = useState(requestedNote);
  const [summaryNotesOpen, setSummaryNotesOpen] = useState(false);
  const [focusRequest, setFocusRequest] = useState({
    target: requestedNote ? "notes" : "heading",
    revision: requestedStepId || requestedNote ? 1 : 0,
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const summaryNotesRef = useRef<HTMLElement>(null);
  const session = sessions[guide.id];
  const localView = resolvePracticeView(view, guide.steps.map(item => item.id), session, requestedStepId, appliedQuery !== requestedStepId);
  // Storage hydration and URL navigation are external inputs. Capture them before
  // rendering the editor; subsequent storage events do not change its local view.
  if (ready && localView !== view) setView(localView);
  if (ready && appliedQuery !== requestedStepId) setAppliedQuery(requestedStepId);
  const stepIndex = Math.max(
    0,
    guide.steps.findIndex(
      (item) => item.id === localView.stepId,
    ),
  );
  const step = guide.steps[stepIndex];
  const lookForParts = step.lookFor.match(/^(.+?[.!?])(?:\s+|$)([\s\S]*)$/);
  const lookForLead = lookForParts?.[1] ?? step.lookFor;
  const completed = session?.completedStepIds.length ?? 0;
  const pendingSteps = guide.steps.filter(
    (item) => item.id !== step.id && !session?.completedStepIds.includes(item.id),
  );
  const showSummary = showsPracticeSummary(localView, session);
  const stepPaints = guide.paints.filter((paint) =>
    step.paintIds.includes(paint.id),
  );
  const isBlueClassic = guide.id === "ultramarines-classic";
  const example = lessonExample(guide.id, step.id);
  const actionSentences = step.action.split(/(?<=[.!?])\s+/);
  const materialRows = materialInstructions(step, guide.paints);
  const mappedPaintIds = new Set(materialRows.flatMap(row => row.kind === "material" ? [row.paint.id] : []));
  const combinedMaterials = !example && mappedPaintIds.size > 0;
  const groupedInstructions = !example && (actionSentences.length > 2 || combinedMaterials);
  const remainingPhysicalPaints = combinedMaterials ? stepPaints.filter(paint => !mappedPaintIds.has(paint.id)) : stepPaints;
  const paintContext = useMemo(()=>guideStudyContext(guide,step),[guide,step]);
  const initialMaterialId = requestedStepId === step.id && Object.values(paintContext.options).some(options => options?.some(option => option.id === requestedMaterialId)) ? requestedMaterialId : undefined;
  const [demoFocus, setDemoFocus] = useState<LessonFocus & { stepId: string }>();
  const [demoMaterial,setDemoMaterial] = useState<{stepId:string;id:string}>();
  // A new step or explicit material link starts a new demonstration entry.
  // Choosing a material inside the player leaves this identity unchanged.
  const demoEntry = `${step.id}:${initialMaterialId ?? "default"}`;
  const [appliedDemoEntry, setAppliedDemoEntry] = useState(demoEntry);
  if (appliedDemoEntry !== demoEntry) {
    setAppliedDemoEntry(demoEntry);
    setDemoMaterial(undefined);
  }
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const chapterNavigation = useRef(false);
  const [lastCompletedId, setLastCompletedId] = useState<string>();
  const currentDemoFocus = demoFocus?.stepId === step.id ? demoFocus : undefined;
  const fullLessonTarget = currentDemoFocus ?? example;
  const selectedDemoMaterialId = demoMaterial?.stepId === step.id ? demoMaterial.id : initialMaterialId;
  function showExample(target: LessonExample) {
    setDemoFocus({ stepId: step.id, technique: target.technique, chapterId: target.chapterId, workshop: target.workshop, revision: Date.now() });
  }
  const notedSteps = guide.steps.filter((item) =>
    session?.notes[item.id]?.trim(),
  );

  useEffect(() => {
    if (!ready || appliedEntry.current === requestedStepId) return;
    appliedEntry.current = requestedStepId;
    if (requestedStepId && session?.currentStepId !== requestedStepId) {
      change(guide.id, { type: "navigate", stepId: requestedStepId });
    }
  }, [ready, requestedStepId, session?.currentStepId, guide.id, change]);

  function syncStepUrl(stepId?: string) {
    const url = new URL(window.location.href);
    if (stepId) url.searchParams.set("step", stepId);
    else url.searchParams.delete("step");
    url.searchParams.delete("material");
    url.searchParams.delete("note");
    // Next synchronizes native history changes with useSearchParams without
    // remounting the lesson or losing the selected demonstration display mode.
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  function requestFocus(target = "heading") {
    setFocusRequest((previous) => ({
      target,
      revision: previous.revision + 1,
    }));
  }
  useEffect(() => {
    if (!ready || (!focusRequest.revision && !requestedStepId)) return;
    const target =
      focusRequest.target === "notes"
        ? noteRef.current ?? headingRef.current
        : focusRequest.target === "summary-notes"
          ? summaryNotesRef.current ?? headingRef.current
          : headingRef.current;
    target?.focus({ preventScroll: true });
    const bounds = target?.getBoundingClientRect();
    if (bounds && (bounds.top < 16 || bounds.bottom > window.innerHeight - 16)) target?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [focusRequest, ready, requestedStepId]);

  function navigate(index: number, openNotes = false) {
    chapterNavigation.current = chaptersOpen;
    setChaptersOpen(false);
    setLastCompletedId(undefined);
    const destination = guide.steps[index];
    if (!destination) return;
    syncStepUrl(destination.id);
    setView({ stepId: destination.id, mode: "step" });
    setNotesOpen(openNotes || Boolean(session?.notes[destination.id]));
    change(guide.id, { type: "navigate", stepId: destination.id });
    requestFocus(openNotes ? "notes" : "heading");
  }

  function completeAndAdvance() {
    // Persistence rereads other tabs before applying this action. Use its result
    // for the local view as well, so a remote completion/undo cannot split them.
    const result = advance(guide.id, step.id);
    if (!result) return;
    const advanced = result.session;
    const finished = stepIndex === guide.steps.length - 1 && Boolean(advanced.completedAt);
    setChaptersOpen(false);
    setLastCompletedId(result.completionAdded ? step.id : undefined);
    syncStepUrl(finished ? undefined : advanced.currentStepId);
    setView({ stepId: advanced.currentStepId, mode: finished ? "summary" : "step" });
    setNotesOpen(Boolean(advanced.notes[advanced.currentStepId]));
    requestFocus();
  }

  if (!ready || !view) return <PracticeLoading />;

  return (
    <div className="painting-workbench">
      <div className="painting-top">
        <Link className="workbench-breadcrumb" href={`/guides/${guide.slug}`}>
          <ArrowLeft size={16} aria-hidden />
          <span>{guide.faction}</span><span className="workbench-scheme">/ {guide.scheme ?? guide.style}</span>
        </Link>
        <Popover.Root open={chaptersOpen} onOpenChange={setChaptersOpen}>
          <Popover.Trigger asChild>
            <button className="workbench-steps-toggle" aria-label={`Steps, ${stepIndex + 1} of ${guide.steps.length}`}>
              <span className="workbench-step-progress" aria-hidden="true">
                {guide.steps.map((item, index) => <i key={item.id} className={`${session?.completedStepIds.includes(item.id) ? "is-complete" : ""} ${!showSummary && index === stepIndex ? "is-current" : ""}`} />)}
              </span>
              <span>{showSummary ? "Study complete" : `Steps · ${stepIndex + 1} of ${guide.steps.length}`}</span>
              <ChevronDown size={14} aria-hidden />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="workbench-chapters" align="end" sideOffset={8} aria-label="Study steps" onCloseAutoFocus={event => { if (chapterNavigation.current) { event.preventDefault(); chapterNavigation.current = false; } }}>
              <p>{completed} of {guide.steps.length} steps complete</p>
              <nav aria-label="Painting steps">
                {guide.steps.map((item, index) => <button key={item.id} aria-label={`Step ${index + 1}: ${item.title}${session?.completedStepIds.includes(item.id) ? ", completed" : ""}`} aria-current={!showSummary && index === stepIndex ? "step" : undefined} onClick={() => navigate(index)}>
                  <span className={`step-number ${session?.completedStepIds.includes(item.id) ? "is-done" : ""}`}>
                    {session?.completedStepIds.includes(item.id) ? <Check size={13} /> : String(index + 1).padStart(2, "0")}
                  </span><span>{item.title}</span>
                </button>)}
              </nav>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
      <div className="painting-layout">
        <section className={`lesson-main workbench-lesson${showSummary ? " workbench-lesson--summary" : ""}`} aria-labelledby="lesson-title">
          {showSummary ? (
            <div className="completion">
              {lastCompletedId && session?.completedStepIds.includes(lastCompletedId) && <div className="workbench-completion-feedback">
        <p role="status"><Check size={14} aria-hidden />{guide.steps.find(item => item.id === lastCompletedId)?.title} complete.</p>
        <button onClick={() => {
          const index = guide.steps.findIndex(item => item.id === lastCompletedId);
          change(guide.id, { type: "complete-step", stepId: lastCompletedId, completed: false });
          navigate(index);
        }}>Undo</button>
      </div>}
              <span className="completion-mark">
                <Check size={34} />
              </span>
              <span className="eyebrow">Study complete</span>
              <h1 id="lesson-title" ref={headingRef} tabIndex={-1}>
                You’ve completed
                <br />
                every step.
              </h1>
              <p>
                All {guide.steps.length} stages of {guide.title.toLowerCase()}.
                Come back to your notes, or revisit a step you want to try
                again.
              </p>
              <p
                className={
                  error ? "completion-save-error" : "completion-save-note"
                }
              >
                {error
                  ? "Your latest progress and notes have not been saved. Keep this page open and use the save notice above."
                  : "Your progress and notes are saved on this device."}
              </p>
              <div className="completion-review-actions">
                <button className="button" onClick={() => navigate(0)}>
                  Review the steps <ArrowRight size={17} />
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    if (!notedSteps.length) {
                      navigate(guide.steps.length - 1, true);
                    } else {
                      setSummaryNotesOpen(true);
                      requestFocus("summary-notes");
                    }
                  }}
                >
                  <NotebookPen size={16} />{" "}
                  {notedSteps.length
                    ? `Review notes (${notedSteps.length})`
                    : "Add a practice note"}
                </button>
              </div>
              {summaryNotesOpen && (
                <section
                  className="practice-reflections"
                  ref={summaryNotesRef}
                  tabIndex={-1}
                  aria-labelledby="reflection-title"
                >
                  <h2 id="reflection-title">Notes for your next practice</h2>
                  <div className="reflection-notes">
                    {notedSteps.map((item) => (
                      <div key={item.id}>
                        <h3>{item.title}</h3>
                        <p>{session?.notes[item.id]}</p>
                        <button
                          className="small-link"
                          onClick={() =>
                            navigate(guide.steps.indexOf(item), true)
                          }
                        >
                          Edit this note <ArrowRight size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <div className="completion-other-actions">
                <Link className="text-button" href="/#guides">
                  Find another study <ArrowRight size={15} />
                </Link>
                <Modal
                  title="Begin this study again?"
                  description="Your completed steps, notes, and prepared paints and tools for this study will be cleared on this device. Your other studies will stay saved."
                  trigger={
                    <button className="text-button">
                      Start a fresh practice
                    </button>
                  }
                >
                  <Dialog.Close asChild>
                    <button
                      className="button"
                      onClick={() => {
                        change(guide.id, { type: "restart" });
                        syncStepUrl();
                        setView({ stepId: guide.steps[0].id, mode: "step" });
                        setNotesOpen(false);
                        setSummaryNotesOpen(false);
                        requestFocus();
                      }}
                    >
                      Start fresh <RotateCcw size={16} />
                    </button>
                  </Dialog.Close>
                </Modal>
              </div>
            </div>
          ) : (
            <>
              <div className="lesson-heading">
                {session?.completedAt && (
                  <button
                    className="small-link review-summary"
                    onClick={() => {
                      syncStepUrl();
                      setView({ stepId: step.id, mode: "summary" });
                      requestFocus();
                    }}
                  >
                    View practice summary <ArrowRight size={14} />
                  </button>
                )}
                <h1 id="lesson-title" className={step.action.length > 150 ? "long-instruction" : undefined} ref={headingRef} tabIndex={-1}>
                  {groupedInstructions ? `${step.title}.` : step.action}
                </h1>
                {example && <p className="workbench-orientation">See how the paint builds on a simple surface, then try it on your miniature.</p>}
              </div>
              <div className="workbench-painting">
                {example ? <div className="workspace-demonstration">
                  <ShapePaintingStudy key={`${guide.id}:${demoEntry}`} embedded initialTechnique={example.technique} initialChapterId={example.chapterId} initialMaterialId={initialMaterialId} focusRequest={currentDemoFocus} paintContext={paintContext} onMaterialChange={id=>setDemoMaterial({stepId:step.id,id})} fullLessonHref={techniqueHref(fullLessonTarget!.technique, { chapter: fullLessonTarget!.chapterId, from: `/paint/${guide.slug}?step=${step.id}`, material: selectedDemoMaterialId })} />
                  {example.note && <p className="workspace-example-note">{example.note}</p>}
                </div> : <section className="workbench-physical" aria-labelledby="physical-step-title">
                  <span className="eyebrow">At your painting table</span>
                  <h2 id="physical-step-title">{groupedInstructions ? "Paint each area" : step.title}</h2>
                  {combinedMaterials ? <ul className="workbench-material-actions">
                    {materialRows.map((row, index) => row.kind === "material" ? <li className="workbench-material-action" key={`${row.paint.id}-${index}`}>
                      <span className="workbench-material-swatch" aria-hidden="true" style={{ backgroundColor: row.paint.hex }} />
                      <div><strong>{row.paint.name}</strong><p>{row.area.charAt(0).toUpperCase() + row.area.slice(1)}</p></div>
                    </li> : <li className="workbench-material-explanation" key={`explanation-${index}`}>{row.text}</li>)}
                  </ul> : groupedInstructions && <ul className="workbench-action-list">{actionSentences.map((sentence, index) => <li key={index}>{sentence}</li>)}</ul>}
                  <p>{step.detail}</p>
                  {remainingPhysicalPaints.length > 0 && <StepPaints paints={remainingPhysicalPaints} tidy={isBlueClassic && step.id === "tidy"} />}
                </section>}
              </div>
              <aside className="workbench-guidance" aria-label="Guidance for this step">
                <section className="workbench-look-for" aria-labelledby="look-for-title">
                  <h2 id="look-for-title">What to look for</h2>
                  {isBlueClassic && step.id === "base" ? <>
                    <p className="workbench-look-heading">Keep the sculpted details clear.</p>
                    <p>Some primer may show through the first coat. Let it dry, then add another thin coat if needed.</p>
                  </> : <>
                    <p className={`workbench-look-heading${lookForLead.length > 75 ? " workbench-look-heading--long" : ""}`}>{lookForLead}</p>
                    {lookForParts?.[2] && <p>{lookForParts[2]}</p>}
                  </>}
                </section>
                {example && <details key={step.id} className="workbench-step-details" open={/\bbelow\b/i.test(step.action)}>
                  <summary>Brush & paint for this step <ChevronDown size={14} aria-hidden /></summary>
                  <p>{step.detail}</p>
                  {stepPaints.length > 0 && <StepPaints paints={stepPaints} tidy={false} />}
                </details>}
                <PaintingCoach key={`${guide.id}:${step.id}`} guide={guide} step={step} onShowExample={showExample} />
              </aside>
              <WorkbenchProgression>
              {lastCompletedId && session?.completedStepIds.includes(lastCompletedId) && <div className="workbench-completion-feedback">
        <p role="status"><Check size={14} aria-hidden />{guide.steps.find(item => item.id === lastCompletedId)?.title} complete.</p>
        <button onClick={() => {
          const index = guide.steps.findIndex(item => item.id === lastCompletedId);
          change(guide.id, { type: "complete-step", stepId: lastCompletedId, completed: false });
          navigate(index);
        }}>Undo</button>
      </div>}
              <div className="lesson-navigation">
                <button
                  className="secondary-button"
                  disabled={stepIndex === 0}
                  onClick={() => navigate(stepIndex - 1)}
                >
                  <ArrowLeft size={16} /> Previous
                </button>
                {stepIndex < guide.steps.length - 1 ? (
                  <button
                    className="secondary-button workbench-next"
                    onClick={completeAndAdvance}
                  >
                    Next: {guide.steps[stepIndex + 1].title.toLowerCase()} <ArrowRight size={17} />
                  </button>
                ) : (
                  <button
                    className="secondary-button workbench-next"
                    onClick={completeAndAdvance}
                  >
                    {pendingSteps.length ? "Complete step" : "Finish study"} <Check size={17} />
                  </button>
                )}
              </div>
              </WorkbenchProgression>
              {stepIndex === guide.steps.length - 1 && pendingSteps.length > 0 && (
                <section
                  className="pending-practice"
                  aria-labelledby="pending-practice-title"
                >
                  <h2 id="pending-practice-title">Steps remaining</h2>
                  <p>Complete this step to return to the first unfinished step.</p>
                  <ul>
                    {pendingSteps.map((item) => (
                      <li key={item.id}>
                        <button
                          onClick={() => navigate(guide.steps.indexOf(item))}
                        >
                          <span>
                            Step {guide.steps.indexOf(item) + 1}: {item.title}
                          </span>
                          <ArrowRight size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <div className="practice-extras" key={`${guide.id}:${step.id}`}>
                <details
                  className="practice-disclosure"
                  open={notesOpen}
                  onToggle={(event) => setNotesOpen(event.currentTarget.open)}
                >
                  <summary>
                    <span>
                      <NotebookPen size={18} />{" "}
                      {session?.notes[step.id]
                        ? "Your note for this step"
                        : "Add a practice note"}
                    </span>
                    <ChevronDown size={16} />
                  </summary>
                  <div className="notes-section">
                    <label htmlFor="practice-note">
                      A note for next time <span>Optional</span>
                    </label>
                    <textarea
                      id="practice-note"
                      aria-describedby="practice-note-status"
                      ref={noteRef}
                      placeholder="What worked? What would you try differently?"
                      maxLength={MAX_SESSION_NOTES_LENGTH}
                      value={session?.notes[step.id] ?? ""}
                      onChange={(event) =>
                        change(guide.id, {
                          type: "note",
                          stepId: step.id,
                          note: event.target.value,
                        })
                      }
                    />
                    <div className="note-meta">
                    <p id="practice-note-status" className={error ? "note-save-status is-unsaved" : "note-save-status"}>
                      {error ? <>Not saved yet. Keep this page open. <a href="#practice-save-notice">Review saving issue</a></> : session?.notes[step.id] ? "Saved on this device." : "Your note saves as you type."}
                    </p>
                    <span className="note-count">
                      {session?.notes[step.id]?.length ?? 0}/
                      {MAX_SESSION_NOTES_LENGTH}
                    </span>
                    </div>
                  </div>
                </details>
                <Sources guide={guide} step={step} />
                <div className="workbench-save-row">
                  <span className="save-state" role="status">{error ? "Changes not saved. See the notice above." : session ? "Saved on this device" : "Progress saves as you go"}</span>
                  <Link href="/saved" className="practice-pause-link" onNavigate={() => change(guide.id, { type: "pause", stepId: step.id })}><Pause size={14} aria-hidden />{error ? "View saved studies" : "Save and pause"}</Link>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function StepPaints({ paints, tidy }: { paints: Guide["paints"]; tidy: boolean }) {
  return <div className="workbench-paints" aria-label={paints.length > 1 ? "Paints for this step" : "Paint for this step"}>
    {paints.map(paint => <div className="workbench-paint" key={paint.id}>
      <span aria-hidden="true" style={{ backgroundColor: paint.hex }} />
      <div><strong>{paint.name.replace("Citadel ", "")}</strong><small>{tidy ? "Restore flat surfaces" : paint.role}</small></div>
    </div>)}
  </div>;
}
