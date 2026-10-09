"use client";
import type { EquipmentProduct, EquipmentType } from "@/lib/equipment-types";
import { guideToolTypes } from "@/lib/guide-equipment";
import { Modal } from "./shared";
import { EquipmentTypeGuidance } from "./EquipmentDetails";
import "./equipment.css";
export type GuideEquipment = { types: EquipmentType[]; products: EquipmentProduct[] };
export function GuideToolHelp({ tool, equipment, guideSlug }: { tool: string; equipment: GuideEquipment; guideSlug: string }) {
  const ids = guideToolTypes[tool] ?? [];
  return <Modal trigger={<button className="tool-about" aria-label={`About this tool: ${tool}`}>About this tool <span aria-hidden>↗</span></button>} title={tool} description="Use a suitable tool you already own. Product examples are optional, and browsing does not change your checklist."><div className="equipment-detail">{equipment.types.filter(t=>ids.includes(t.id)).map(type=><EquipmentTypeGuidance key={type.id} type={type} products={equipment.products} guideSlug={guideSlug} />)}</div></Modal>;
}
