import { equipmentTypes, type EquipmentProduct } from "./equipment-types";
import { equipmentBrowseGroup } from "./equipment-browse";
export interface EquipmentFilters { q: string; category: string; type: string; task: string; brand: string; group?: string; }
export const emptyEquipmentFilters: EquipmentFilters = { q: "", category: "", type: "", task: "", brand: "", group: "" };
const normalise = (text: string) => text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function filterEquipment(products: EquipmentProduct[], filters: EquipmentFilters) {
  const words = normalise(filters.q).split(/\s+/).filter(Boolean);
  const group = equipmentBrowseGroup(filters.group);
  return products.filter(product => {
    const types = equipmentTypes.filter(type => product.typeIds.includes(type.id));
    if (group && !product.typeIds.some(id => group.typeIds.includes(id))) return false;
    if (filters.category && !types.some(t => t.category === filters.category)) return false;
    if (filters.type && !product.typeIds.includes(filters.type)) return false;
    if (filters.task && !types.some(t => t.task === filters.task)) return false;
    if (filters.brand && product.brand !== filters.brand) return false;
    const haystack = normalise([product.brand, product.name, product.code, ...product.variants.map(v => v.label), ...types.flatMap(t => [t.name, t.task, t.aliases])].join(" "));
    return words.every(word => haystack.includes(word));
  });
}
