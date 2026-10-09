import { notFound } from "next/navigation";
import type { TechniqueId } from "@/lib/technique-study-types";

const moments = { layers: 80, edges: 24, recess: 24, drybrush: 24 };

/** Local asset capture only. The public application serves static thumbnails. */
export default async function TechniqueThumbnails({ searchParams }: {
  searchParams: Promise<{ technique?: string; time?: string; view?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const technique = Object.hasOwn(moments, params.technique ?? "") ? params.technique as TechniqueId : "layers";
  const duration = technique === "layers" ? 80 : 24;
  const time = params.time !== undefined && Number.isFinite(Number(params.time)) ? Math.min(duration, Math.max(0, Number(params.time))) : moments[technique];
  const view = params.view === "close" || params.view === "turn" ? params.view : "front";
  const { ThumbnailCapture } = await import("./thumbnail-capture");
  return <ThumbnailCapture key={`${technique}-${time}-${view}`} technique={technique} time={time} duration={duration} view={view} />;
}
