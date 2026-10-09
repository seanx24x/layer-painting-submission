import { equipmentBrowseGroup } from "./equipment-browse";
import { emptyEquipmentFilters, type EquipmentFilters } from "./equipment-search";
import { equipmentCategories, equipmentTypes, type EquipmentProduct } from "./equipment-types";

export const EQUIPMENT_PAGE_SIZE = 24;

export function readEquipmentLibraryUrl(params: Pick<URLSearchParams, "get">, products: EquipmentProduct[]) {
  const raw = Object.fromEntries(Object.keys(emptyEquipmentFilters).map(key => [key, params.get(key) ?? ""])) as unknown as EquipmentFilters;
  const filters: EquipmentFilters = {
    q: raw.q,
    group: equipmentBrowseGroup(raw.group)?.id ?? "",
    category: equipmentCategories.some(category => category.id === raw.category) ? raw.category : "",
    type: equipmentTypes.some(type => type.id === raw.type) ? raw.type : "",
    task: equipmentTypes.some(type => type.task === raw.task) ? raw.task : "",
    brand: products.some(product => product.brand === raw.brand) ? raw.brand : "",
  };
  const group = equipmentBrowseGroup(filters.group);
  const selectedType = equipmentTypes.find(type => type.id === filters.type);
  if (selectedType && ((group && !group.typeIds.includes(selectedType.id)) || (filters.category && selectedType.category !== filters.category))) filters.type = "";
  if (!filters.type && group?.typeIds.length === 1) {
    const onlyType = equipmentTypes.find(type => type.id === group.typeIds[0]);
    if (onlyType && (!filters.category || onlyType.category === filters.category)) filters.type = onlyType.id;
  }
  const requestedLimit = Number(params.get("limit"));
  const limit = Number.isFinite(requestedLimit) ? Math.max(EQUIPMENT_PAGE_SIZE, Math.floor(requestedLimit)) : EQUIPMENT_PAGE_SIZE;
  return {
    filters,
    count: Math.min(products.length, limit),
    directory: !Object.values(filters).some(Boolean) && params.get("all") !== "1" && !params.get("item"),
    item: params.get("item") ?? "",
  };
}

export function equipmentLibraryHref(search: string, changes: Record<string, string>) {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return `/equipment${params.size ? `?${params}` : ""}`;
}

export function ownsEquipmentDialogEntry(state: unknown, href: string) {
  return !!state && typeof state === "object" && "layerEquipmentDialog" in state && state.layerEquipmentDialog === href;
}
