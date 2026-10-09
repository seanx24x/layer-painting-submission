"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ChevronDown, ExternalLink } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { TECHNIQUE_LESSONS, TECHNIQUE_LESSON_ORDER, TECHNIQUE_LESSON_SOURCES, paletteTechniqueChapter, type TechniqueLessonId } from "@/lib/technique-lessons";
import { resolveTechniqueLocation, techniqueHref } from "@/lib/technique-navigation";
import { studyContextFromHref } from "@/lib/study-context";
import { materialReturnHref } from "@/lib/study-links";
import { ShapePaintingStudy } from "./ShapePaintingStudy";
import LightPlacementStudy from "./LightPlacementStudy";
import { WorkbenchProgression } from "./WorkbenchProgression";
import "./painting-workspace.css";
import "./technique-workbench.css";

export function TechniqueLessonWorkbench({ lessonId: requestedLesson }: { lessonId: TechniqueLessonId }) {
  const search = useSearchParams();
  const resolved = resolveTechniqueLocation({ lesson: requestedLesson, chapter: search.get("chapter") ?? undefined, from: search.get("from") ?? undefined, material: search.get("material") ?? undefined });
  const lessonId = resolved.lessonId;
  const lesson = TECHNIQUE_LESSONS[lessonId];
  const index = lesson.chapters.findIndex(chapter => chapter.id === resolved.chapterId);
  const heading = useRef<HTMLHeadingElement>(null);
  const guide = studyContextFromHref(resolved.returnHref);
  const options = lessonId === "light" ? [] : guide?.context?.options[lessonId] ?? [];
  const material = options.find(option => option.id === resolved.material) ?? options[0];
  const chapters = lesson.chapters.map(chapter => paletteTechniqueChapter(lessonId, chapter, material?.palette));
  const chapter = chapters[index];
  const href = (chapterId: string) => techniqueHref(lessonId, { chapter: chapterId, from: resolved.returnHref, material: material?.id ?? resolved.material });
  const pendingFocus = useRef(false);
  const skipMenuRestore = useRef(false);
  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [resolved.chapterId]);
  function go(chapterId: string) {
    if (chapterId === chapter.id) return;
    pendingFocus.current = true;
    window.history.pushState(null, "", href(chapterId));
  }
  const nextLesson = TECHNIQUE_LESSON_ORDER[TECHNIQUE_LESSON_ORDER.indexOf(lessonId) + 1];
  const returnHref = materialReturnHref(resolved.returnHref, material?.id ?? resolved.material);
  return <div className="painting-workbench technique-workbench">
    <header className="technique-topline">
      <div className="technique-breadcrumb"><Link href={returnHref ?? "/techniques"}><ArrowLeft size={15} aria-hidden />{guide ? `${guide.context?.faction ?? "Your painting"}` : "Techniques"}</Link><span aria-hidden>/</span><span>{lesson.label}</span></div>
      <Popover.Root><Popover.Trigger className="technique-chapter-trigger" aria-label={`Choose chapter, ${index + 1} of ${lesson.chapters.length}`}><span className="technique-progress" aria-hidden>{lesson.chapters.map((item, i) => <i key={item.id} data-current={i === index || undefined} data-past={i < index || undefined} />)}</span>Chapter {index + 1} of {lesson.chapters.length}<ChevronDown size={14} aria-hidden /></Popover.Trigger><Popover.Portal><Popover.Content className="technique-chapter-menu" align="end" sideOffset={8} collisionPadding={16} onCloseAutoFocus={event => { if (skipMenuRestore.current) { event.preventDefault(); skipMenuRestore.current = false; } }}><p>{lesson.label}</p><nav aria-label="Technique chapters">{chapters.map((item, i) => <Popover.Close asChild key={item.id}><button aria-current={i === index ? "step" : undefined} onClick={() => { skipMenuRestore.current = item.id !== chapter.id; go(item.id); }}><span>{String(i + 1).padStart(2, "0")}</span>{item.title}</button></Popover.Close>)}</nav></Popover.Content></Popover.Portal></Popover.Root>
    </header>
    <div className="technique-chapter-heading">
      <h1 ref={heading} tabIndex={-1}>{chapter.title}</h1>
      <p>{chapter.instruction}</p>
    </div>
    <div className="technique-workbench-grid">
      <div className="technique-demonstration">
        {lessonId === "light" ? <LightPlacementStudy chapterId={chapter.id as "place" | "read" | "paint"} /> : <ShapePaintingStudy key={`${lessonId}:${chapter.id}:${material?.id ?? "default"}`} embedded initialTechnique={lessonId} initialChapterId={chapter.id} paintContext={guide?.context} initialMaterialId={material?.id} onMaterialChange={id => window.history.replaceState(null, "", techniqueHref(lessonId, { chapter: chapter.id, from: resolved.returnHref, material: id }))} />}
        <p className="technique-starting-state"><span>Starting here</span>{chapter.prepared}</p>
        {guide && lessonId !== "light" && <p className="technique-palette-context">{material ? `${material.label} · paints from your guide` : "Technique study colours. Your guide’s palette is waiting in your painting step."}</p>}
      </div>
      <aside className="technique-teaching" aria-label="Chapter guidance">
        <div className="technique-observation"><span className="eyebrow">What to look for</span><h2>{chapter.lookFor}</h2></div>
        <div className="technique-practice"><h3>{lessonId === "light" && chapter.id === "place" ? "Try it here" : "Take it to your table"}</h3><p>{chapter.practice}</p></div>
        <details className="technique-note"><summary>A useful reminder</summary><p>{chapter.mistake}</p></details>
        <details className="technique-note technique-reference"><summary>From the painters</summary><p>Original Layer exercises, informed by these painting references.</p>{TECHNIQUE_LESSON_SOURCES.filter(source => chapter.sourceIds.includes(source.id)).map(source => <a key={source.id} href={source.url} target="_blank" rel="noreferrer">{source.name}<ExternalLink size={13} aria-hidden /></a>)}</details>
      </aside>
      <WorkbenchProgression><nav className="lesson-navigation" aria-label="Chapter progression">{index > 0 ? <button onClick={() => go(lesson.chapters[index - 1].id)}><ArrowLeft size={16} aria-hidden />Previous</button> : <Link href="/techniques"><ArrowLeft size={16} aria-hidden />Techniques</Link>}{index < lesson.chapters.length - 1 ? <button className="button workbench-next" onClick={() => go(lesson.chapters[index + 1].id)}>Next chapter<ArrowRight size={17} aria-hidden /></button> : <Link className="button workbench-next" href={returnHref ?? (nextLesson ? techniqueHref(nextLesson) : "/techniques")}>{returnHref ? "Back to painting" : nextLesson ? `Next: ${TECHNIQUE_LESSONS[nextLesson].label.toLowerCase()}` : "Explore techniques"}<ArrowRight size={17} aria-hidden /></Link>}</nav></WorkbenchProgression>
    </div>
  </div>;
}
