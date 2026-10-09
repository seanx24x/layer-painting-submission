import LayerApp from "@/components/LayerApp";
import { TechniqueLibrary } from "@/components/TechniqueLibrary";
export const metadata = { title: "Techniques", description: "Learn light, thin layers, edge highlights, recess shading and drybrushing with interactive painting studies." };
export default function TechniquesPage() {
  return <LayerApp view="techniques"><TechniqueLibrary /></LayerApp>;
}
