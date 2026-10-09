import LayerApp from "@/components/LayerApp";
import { LegacyTechniqueRedirect } from "@/components/LegacyTechniqueRedirect";
export const metadata = { title: "Painting techniques", description: "Interactive painting lessons in light, layers, edges, recesses and texture." };
export default async function ShapeStudyPage({ searchParams }: { searchParams: Promise<{ from?: string; material?: string }> }) {
  const { from, material } = await searchParams;
  return <LayerApp view="techniques"><LegacyTechniqueRedirect from={from} material={material} /></LayerApp>;
}
