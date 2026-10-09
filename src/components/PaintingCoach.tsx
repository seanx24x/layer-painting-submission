"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ArrowUp, LoaderCircle, Play, RotateCcw } from "lucide-react";
import type { Guide, GuideStep } from "@/lib/guides";
import { coachPrompts, MAX_COACH_QUESTION_LENGTH, type CoachResponse } from "@/lib/coach";
import { requestCoachReply } from "@/lib/coach-request";
import { getLessonExample, lessonExamples, type LessonExample } from "@/lib/lesson-examples";
import "./painting-coach.css";

export type PaintingCoachProps = {
  guide: Guide;
  step: GuideStep;
  onShowExample: (example: LessonExample) => void;
};

type Exchange = { id: number; question: string; response?: CoachResponse };

export function PaintingCoach(props: PaintingCoachProps) {
  return <StepCoach key={`${props.guide.id}/${props.step.id}`} {...props} />;
}

export default PaintingCoach;

function suggestedQuestions(guide: Guide, step: GuideStep): string[] {
  // Keep these prompts tied to the reviewed examples. Broad technique labels
  // also cover oil, airbrush and cleanup steps that have no brush simulation.
  switch (lessonExamples(guide.id, step.id)[0]?.technique) {
    case "layers": return ["My coat looks patchy", "How much paint goes on the brush?"];
    case "edges": return ["My highlight is too wide", "How should I hold the brush?"];
    case "recess": return ["The shade spreads onto the surface", "How much paint goes on the brush?"];
    case "drybrush": return ["How do I keep the recesses dark?", "How much pressure should I use?"];
    default: return coachPrompts(step).slice(0, 2);
  }
}

function StepCoach({ guide, step, onShowExample }: PaintingCoachProps) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [pending, setPending] = useState(false);
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);
  const answerTitle = useRef<HTMLHeadingElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const focusAnswer = useRef(false);
  const latest = exchanges.at(-1);
  const previous = exchanges.slice(0, -1);

  useEffect(() => () => {
    sequence.current += 1;
    request.current?.abort();
  }, []);

  useEffect(() => {
    if (!focusAnswer.current || !latest) return;
    focusAnswer.current = false;
    // A selected suggestion is removed with the empty state. Give keyboard
    // focus a stable home; never steal it back when the network reply arrives.
    if (document.activeElement === document.body) answerTitle.current?.focus({ preventScroll: true });
  }, [latest]);

  async function ask(question: string, fromSuggestion = false) {
    const trimmed = question.trim();
    if (!trimmed || request.current || trimmed.length > MAX_COACH_QUESTION_LENGTH) return;
    const nextId = ++sequence.current;
    const controller = new AbortController();
    request.current = controller;
    focusAnswer.current = fromSuggestion;
    setPending(true);
    setDraft("");
    setExchanges((current) => [...current.slice(-3), { id: nextId, question: trimmed }]);
    try {
      const result = await requestCoachReply(guide, step, trimmed, controller.signal);
      if (result && nextId === sequence.current) {
        setExchanges((current) => current.map((exchange) => exchange.id === nextId ? { ...exchange, response: result } : exchange));
      }
    } finally {
      if (nextId === sequence.current) {
        request.current = null;
        setPending(false);
      }
    }
  }

  function showExample(exampleId: string) {
    const example = getLessonExample(exampleId);
    if (example && lessonExamples(guide.id, step.id).some((candidate) => candidate.id === exampleId)) onShowExample(example);
  }

  return <section className="painting-coach" aria-labelledby={`${id}-title`}>
    <header className="painting-coach-header">
      <h2 id={`${id}-title`}>Help with this step</h2>
      <span className="painting-coach-badge"><i aria-hidden="true" />AI</span>
    </header>
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{pending ? "Finding guidance in this lesson…" : latest?.response ? "Guidance ready." : ""}</p>
    {previous.length > 0 && <details className="painting-coach-history">
      <summary>Earlier questions ({previous.length})</summary>
      {previous.map(exchange => <article className="painting-coach-exchange" key={exchange.id}>
        <p className="painting-coach-question">{exchange.question}</p>
        {exchange.response && <CoachAnswer response={exchange.response} currentAction={step.action} onShowExample={showExample} onRetry={() => void ask(exchange.question, true)} pending={pending} />}
      </article>)}
    </details>}
    {latest ? <article className="painting-coach-current">
      <h3 className="painting-coach-question painting-coach-answer-title" ref={answerTitle} tabIndex={-1}><span>You asked</span>{latest.question}</h3>
      <div aria-busy={pending}>
        {!latest.response ? <p className="painting-coach-pending" aria-hidden="true"><LoaderCircle size={16} className="spinner" />Finding guidance…</p> : <CoachAnswer response={latest.response} currentAction={step.action} onShowExample={showExample} onRetry={() => void ask(latest.question, true)} pending={pending} />}
      </div>
    </article> : <div className="painting-coach-prompts" aria-label="Suggested questions">
      {suggestedQuestions(guide, step).map(prompt => <button key={prompt} onClick={() => void ask(prompt, true)}><span>{prompt}</span><ArrowRight size={14} aria-hidden="true" /></button>)}
    </div>}
    <div className="painting-coach-composer">
      <form onSubmit={(event) => { event.preventDefault(); void ask(draft); }}>
        <label className="sr-only" htmlFor={`${id}-question`}>Ask about this painting step</label>
        <textarea ref={composer} id={`${id}-question`} aria-describedby={`${id}-note`} rows={2} maxLength={MAX_COACH_QUESTION_LENGTH} placeholder={latest ? "Ask another question about this step…" : "Or ask about this step…"} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(draft); } }} />
        <button className="painting-coach-send" type="submit" disabled={pending || !draft.trim()} aria-label="Ask about this step">{pending ? <LoaderCircle size={18} className="spinner" /> : <ArrowUp size={18} />}</button>
      </form>
      <p id={`${id}-note`} className="painting-coach-note">AI finds guidance from this lesson. Your notes stay private.</p>
      {draft.length > MAX_COACH_QUESTION_LENGTH - 100 && <p className="painting-coach-limit" role="status">{MAX_COACH_QUESTION_LENGTH - draft.length} characters remaining</p>}
    </div>
  </section>;
}

function CoachAnswer({ response, currentAction, onShowExample, onRetry, pending }: { response: CoachResponse; currentAction: string; onShowExample: (id: string) => void; onRetry: () => void; pending: boolean }) {
  const example = response.exampleId ? getLessonExample(response.exampleId) : undefined;
  return <div className="painting-coach-answer">
    <span className="painting-coach-answer-label">{response.kind === "ai" ? "Reviewed lesson guidance" : response.kind === "unsupported" ? "Outside this lesson" : "Reviewed note · AI unavailable"}</span>
    <p>{response.answer}</p>
    {response.nextAction.trim() !== currentAction.trim() && <div className="painting-coach-next"><span>Try next</span><p>{response.nextAction}</p></div>}
    {example && <><button className="painting-coach-example" onClick={() => onShowExample(example.id)}><Play size={14} aria-hidden="true" /><span><strong>Show me</strong><small>{example.label}</small></span><ArrowRight size={14} aria-hidden="true" /></button>{example.note && <p className="painting-coach-example-note">{example.note}</p>}</>}
    {response.sources.length > 0 && <details className="painting-coach-sources"><summary>Lesson sources</summary><ul>{response.sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowRight size={12} aria-hidden="true" /></a></li>)}</ul></details>}
    {response.retryable && <button className="painting-coach-retry" onClick={onRetry} disabled={pending}><RotateCcw size={13} aria-hidden="true" />Try AI again</button>}
  </div>;
}
