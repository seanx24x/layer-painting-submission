import records from "./equipment-products.json";
import { equipmentTypes, type EquipmentProduct } from "./equipment-types";
import { guideToolTypes } from "./guide-equipment";
export const equipmentProducts: EquipmentProduct[] = records as EquipmentProduct[];
export function equipmentForGuide(tools: string[]) {
  const ids = new Set(tools.flatMap(tool => guideToolTypes[tool] ?? []));
  return {
    types: equipmentTypes.filter(type => ids.has(type.id)),
    products: equipmentProducts.filter(product => product.typeIds.some(id => ids.has(id))),
  };
}
