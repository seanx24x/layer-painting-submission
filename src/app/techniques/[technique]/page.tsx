import { notFound } from "next/navigation";
import { Suspense } from "react";
import LayerApp from "@/components/LayerApp";
import { TechniqueLessonWorkbench } from "@/components/TechniqueLessonWorkbench";
import { TECHNIQUE_LESSONS } from "@/lib/technique-lessons";
import { isTechniqueLessonId } from "@/lib/technique-navigation";

type Props = { params: Promise<{ technique: string }> };
export async function generateMetadata({ params }: Props) {
  const { technique } = await params;
  if (!isTechniqueLessonId(technique)) return {};
  const lesson = TECHNIQUE_LESSONS[technique];
  return { title: `${lesson.label} · Techniques`, description: lesson.intro };
}
export default async function TechniquePage({ params }: Props) {
  const { technique } = await params;
  if (!isTechniqueLessonId(technique)) notFound();
  return <LayerApp view="techniques"><Suspense fallback={<p role="status">Preparing your technique study…</p>}><TechniqueLessonWorkbench lessonId={technique} /></Suspense></LayerApp>;
}
