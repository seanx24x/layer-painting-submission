import { LibraryLoading } from "@/components/LibraryLoading";
import { Suspense } from "react";
import LayerApp from "@/components/LayerApp";
import { EquipmentLibrary } from "@/components/EquipmentLibrary";
import { equipmentProducts } from "@/lib/equipment-catalogue";
import { guides } from "@/lib/guides";
export const metadata = { title: "Equipment", description: "Explore sourced miniature painting tools, palettes, brushes and workshop equipment. Find suitable tools for your next study." };
export default function EquipmentPage() {
  return <LayerApp view="equipment"><Suspense fallback={<LibraryLoading title="Equipment" />}><EquipmentLibrary products={equipmentProducts} guideLinks={guides.map(g=>({slug:g.slug,name:g.faction}))} /></Suspense></LayerApp>;
}
