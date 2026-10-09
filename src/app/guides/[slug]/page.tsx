import { equipmentForGuide } from "@/lib/equipment-catalogue";
import LayerApp from "@/components/LayerApp";
import { getGuide, guides } from "@/lib/guides";
import { notFound } from "next/navigation";
export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const guide = getGuide((await params).slug);
  return {
    title: guide
      ? `${guide.faction} · ${guide.scheme ?? guide.style.charAt(0).toUpperCase() + guide.style.slice(1)}`
      : "Guide not found",
  };
}
export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  return <LayerApp view="guide" guideSlug={slug} equipment={equipmentForGuide(guide.tools)} />;
}
