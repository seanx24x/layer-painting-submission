import assert from "node:assert/strict";
import test from "node:test";
import { equipmentBrowseGroups } from "./equipment-browse";
import { equipmentProducts } from "./equipment-catalogue";
import { equipmentTypes } from "./equipment-types";
import { emptyEquipmentFilters, filterEquipment } from "./equipment-search";
import { equipmentLibraryHref, ownsEquipmentDialogEntry, readEquipmentLibraryUrl } from "./equipment-library-url";

test("browse topics expose every authored tool type and contain no obsolete or duplicated associations", () => {
  const typeIds = equipmentTypes.map(type => type.id).sort();
  const groupedIds = [...new Set(equipmentBrowseGroups.flatMap(group => group.typeIds))].sort();
  assert.deepEqual(groupedIds, typeIds, "every tool, including types without a branded product, needs a browse route");
  assert.equal(new Set(equipmentBrowseGroups.map(group => group.id)).size, equipmentBrowseGroups.length);
  for (const group of equipmentBrowseGroups) {
    assert.ok(group.name && group.description && group.typeIds.length, group.id);
    assert.equal(new Set(group.typeIds).size, group.typeIds.length, group.id);
    for (const type of group.typeIds) {
      const entry = readEquipmentLibraryUrl(new URLSearchParams({ group: group.id, type }), equipmentProducts);
      assert.equal(entry.filters.type, type, `${group.id}/${type} remains directly reachable`);
      assert.equal(entry.directory, false);
    }
  }
});

test("browse topics combine with search, maker, task and type instead of broadening results", () => {
  const matches = filterEquipment(equipmentProducts, {
    ...emptyEquipmentFilters,
    group: "palettes", q: "glass", category: "paint", type: "dry-palette", task: "Mixing paint", brand: "Redgrass",
  });
  assert.deepEqual(matches.map(product => product.id), ["redgrass-rgg-glass-palette"]);
  assert.deepEqual(filterEquipment(equipmentProducts, { ...emptyEquipmentFilters, group: "brushes", type: "dry-palette" }), []);
  assert.deepEqual(filterEquipment(equipmentProducts, { ...emptyEquipmentFilters, group: "cutting-mats", brand: "Redgrass" }), []);
  const redgrassBrushes = filterEquipment(equipmentProducts, { ...emptyEquipmentFilters, group: "brushes", brand: "Redgrass" });
  assert.deepEqual(redgrassBrushes.map(product => product.id), ["redgrass-redgrass-brushes"]);
  const refills = filterEquipment(equipmentProducts, { ...emptyEquipmentFilters, group: "palettes", type: "refills", brand: "Redgrass" });
  assert.deepEqual(refills.map(product => product.id).sort(), ["redgrass-15x-reusable-membranes", "redgrass-50-x-hydration-paper-sheets"].sort());
});

test("directory, all-products and deep item links restore different deliberate entry points", () => {
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams(), equipmentProducts).directory, true);
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ guide: "ultramarines-classic" }), equipmentProducts).directory, true);
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ all: "1" }), equipmentProducts).directory, false);
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ all: "unexpected" }), equipmentProducts).directory, true);
  const item = "redgrass-rgg-glass-palette";
  const state = readEquipmentLibraryUrl(new URLSearchParams({ type: "dry-palette", item, guide: "ultramarines-classic", limit: "48" }), equipmentProducts);
  assert.equal(state.directory, false);
  assert.equal(state.filters.type, "dry-palette");
  assert.equal(state.count, 48);
  assert.equal(state.item, item);
  const missing = readEquipmentLibraryUrl(new URLSearchParams({ item: "removed-product" }), equipmentProducts);
  assert.equal(missing.item, "removed-product", "a missing item must remain available to the recovery message");
  assert.equal(missing.directory, false);
});

test("malformed filters and pagination fall back to usable finite catalogue state", () => {
  const invalid = readEquipmentLibraryUrl(new URLSearchParams({ group: "unknown", category: "unknown", type: "unknown", task: "unknown", brand: "unknown" }), equipmentProducts);
  assert.deepEqual(invalid.filters, emptyEquipmentFilters);
  assert.equal(invalid.directory, true);
  for (const limit of ["NaN", "Infinity", "-Infinity", "-24", "0", "23.9"]) {
    assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ limit }), equipmentProducts).count, 24, limit);
  }
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ limit: "48.9" }), equipmentProducts).count, 48);
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ limit: "999999999" }), equipmentProducts).count, equipmentProducts.length);
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ limit: "24" }), []).count, 0);
});

test("a type outside the active browse topic or workbench area cannot become an invisible selected filter", () => {
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ group: "brushes", type: "cutting-mat" }), equipmentProducts).filters.type, "");
  assert.equal(readEquipmentLibraryUrl(new URLSearchParams({ category: "prepare", type: "dry-palette" }), equipmentProducts).filters.type, "");
  const valid = readEquipmentLibraryUrl(new URLSearchParams({ group: "palettes", category: "paint", type: "dry-palette" }), equipmentProducts);
  assert.equal(valid.filters.type, "dry-palette");
});

test("single-tool browse links keep their choosing guidance after a direct visit or filter reset", () => {
  for (const type of [undefined, "", "detail-brush"]) {
    const params = new URLSearchParams({ group: "cutting-mats" });
    if (type !== undefined) params.set("type", type);
    const entry = readEquipmentLibraryUrl(params, equipmentProducts);
    assert.equal(entry.filters.type, "cutting-mat");
    assert.equal(entry.directory, false);
  }
  const incompatible = readEquipmentLibraryUrl(new URLSearchParams({ group: "cutting-mats", category: "paint" }), equipmentProducts);
  assert.equal(incompatible.filters.type, "", "an incompatible explicit area is not silently overridden");
});

test("opening, filtering and dismissing product details preserve guide return context", () => {
  const search = "?guide=ultramarines-classic&group=palettes&type=dry-palette&brand=Redgrass&limit=48&all=1";
  const opened = equipmentLibraryHref(search, { item: "redgrass-rgg-glass-palette" });
  const parsed = new URL(opened, "https://layer.test");
  assert.equal(parsed.pathname, "/equipment");
  for (const [key, value] of new URLSearchParams(search)) assert.equal(parsed.searchParams.get(key), value);
  const dismissed = new URL(equipmentLibraryHref(parsed.search, { item: "" }), parsed.origin);
  assert.equal(dismissed.search, search);
  const cleared = new URL(equipmentLibraryHref(parsed.search, { ...emptyEquipmentFilters, item: "", limit: "", all: "" }), parsed.origin);
  assert.equal(cleared.search, "?guide=ultramarines-classic");
  const escaped = new URL(equipmentLibraryHref("?guide=ultramarines-classic", { q: "brush & palette", brand: "Winsor & Newton" }), parsed.origin);
  assert.equal(escaped.searchParams.get("q"), "brush & palette");
  assert.equal(escaped.searchParams.get("brand"), "Winsor & Newton");
});

test("only a matching equipment dialog history entry may close by navigating Back", () => {
  const href = "/equipment?group=palettes&item=redgrass-rgg-glass-palette";
  const entry = { layerEquipmentDialog: href };
  assert.equal(ownsEquipmentDialogEntry(entry, href), true);
  assert.equal(ownsEquipmentDialogEntry(JSON.parse(JSON.stringify(entry)), href), true, "reload and Forward preserve history ownership");
  for (const state of [null, {}, "invalid", { layerPaintDialog: href }, { layerEquipmentDialog: "/equipment?item=another" }, { layerEquipmentDialog: true }]) {
    assert.equal(ownsEquipmentDialogEntry(state, href), false);
  }
});
