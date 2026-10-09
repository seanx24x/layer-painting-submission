import { notFound } from "next/navigation";
import { STUDIES, type StudyId } from "@/lib/sculptural-studio";
import { StudioPreview } from "./studio-preview";

export const metadata = { title: "Technique studio preview", robots: { index: false, follow: false } };

/** A local visual study. Public lessons and saved practice remain independent. */
export default async function TechniqueStudioPreview({ searchParams }: {
  searchParams: Promise<{ study?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const initialStudy = STUDIES.some(study => study.id === params.study) ? params.study as StudyId : "light";
  return <StudioPreview initialStudy={initialStudy} />;
}
