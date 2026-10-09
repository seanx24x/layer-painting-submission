import LayerApp from "@/components/LayerApp";
import { getGuide, guides } from "@/lib/guides";
import { notFound } from "next/navigation";
export function generateStaticParams() {
  return guides.map(({ slug }) => ({ slug }));
}
export const metadata = { title: "Painting practice" };
export default async function PaintPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getGuide(slug)) notFound();
  return <LayerApp view="paint" guideSlug={slug} />;
}
