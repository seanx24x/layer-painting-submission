import type { PaintRecord } from "./paint-types";
import type { PaintFilters } from "./paint-search";

export const PAINT_PAGE_SIZE = 60;

/** URL values are display state only; catalogue and saved-practice IDs stay unchanged. */
export function readPaintLibraryUrl(params: Pick<URLSearchParams, "get">, paints: readonly PaintRecord[]) {
  const requestedBrand = params.get("brand") ?? "";
  const brand = paints.some(paint => paint.brand === requestedBrand) ? requestedBrand : "";
  const requestedRange = params.get("range") ?? "";
  const range = paints.some(paint => (!brand || paint.brand === brand) && paint.range === requestedRange) ? requestedRange : "";
  const requestedSort = params.get("sort");
  const sort: NonNullable<PaintFilters["sort"]> = requestedSort === "colour" || requestedSort === "code" ? requestedSort : "name";
  const requestedLimit = Number(params.get("limit"));
  const limit = Number.isFinite(requestedLimit) ? Math.max(PAINT_PAGE_SIZE, Math.floor(requestedLimit)) : PAINT_PAGE_SIZE;
  return {
    query: params.get("q") ?? "",
    brand,
    range,
    sort,
    visibleCount: Math.min(paints.length, limit),
    item: params.get("item") ?? "",
  };
}

/** Preserve return context and unrelated parameters when changing catalogue state. */
export function paintLibraryHref(search: string, changes: Record<string, string>, hash = "") {
  const params = new URLSearchParams(search);
  for (const [key, value] of Object.entries(changes)) {
    if (!value || (key === "sort" && value === "name") || (key === "limit" && value === String(PAINT_PAGE_SIZE))) params.delete(key);
    else params.set(key, value);
  }
  return `/paints${params.size ? `?${params}` : ""}${hash}`;
}

export function ownsPaintDialogEntry(state: unknown, href: string): boolean {
  if (!state || typeof state !== "object" || !("layerPaintDialog" in state)) return false;
  return state.layerPaintDialog === href;
}
