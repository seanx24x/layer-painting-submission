import assert from "node:assert/strict";
import test from "node:test";
import { paintCatalogue } from "./paint-catalogue";
import { ownsPaintDialogEntry, paintLibraryHref, readPaintLibraryUrl } from "./paint-library-url";

test("a paint catalogue link restores filters, pagination and a selected item without changing catalogue IDs", () => {
  const paint = paintCatalogue[0];
  const params = new URLSearchParams({ q: paint.name, brand: paint.brand, range: paint.range, sort: "colour", limit: "120", item: paint.id });
  assert.deepEqual(readPaintLibraryUrl(params, paintCatalogue), { query: paint.name, brand: paint.brand, range: paint.range, sort: "colour", visibleCount: 120, item: paint.id });
});

test("malformed URL filters cannot create impossible selects or unbounded pagination", () => {
  for (const limit of ["NaN", "Infinity", "-100", "0", "59.9"]) {
    assert.equal(readPaintLibraryUrl(new URLSearchParams({ limit }), paintCatalogue).visibleCount, 60);
  }
  assert.equal(readPaintLibraryUrl(new URLSearchParams({ limit: "120.9" }), paintCatalogue).visibleCount, 120);
  assert.equal(readPaintLibraryUrl(new URLSearchParams({ limit: "999999999" }), paintCatalogue).visibleCount, paintCatalogue.length);
  const state = readPaintLibraryUrl(new URLSearchParams({ brand: "Unknown maker", range: "Unknown range", sort: "broken", item: "unknown-paint" }), paintCatalogue);
  assert.equal(state.brand, "");
  assert.equal(state.range, "");
  assert.equal(state.sort, "name");
  assert.equal(state.item, "unknown-paint", "keep a missing item visible for recovery");
  const brand = paintCatalogue[0].brand;
  const otherRange = paintCatalogue.find(paint => !paintCatalogue.some(candidate => candidate.brand === brand && candidate.range === paint.range))!.range;
  assert.equal(readPaintLibraryUrl(new URLSearchParams({ brand, range: otherRange }), paintCatalogue).range, "");
});

test("changing filters or dismissing an item preserves unrelated return context", () => {
  const search = "?q=blue&brand=Vallejo&range=Model+Color&sort=code&limit=120&item=selected&guide=ultramarines-classic";
  const href = paintLibraryHref(search, { brand: "Warhammer Colour", range: "", limit: "", item: "" }, "#results");
  const params = new URL(href, "https://layer.test").searchParams;
  assert.equal(params.get("brand"), "Warhammer Colour");
  assert.equal(params.get("q"), "blue");
  assert.equal(params.get("sort"), "code");
  assert.equal(params.get("guide"), "ultramarines-classic");
  for (const key of ["range", "limit", "item"]) assert.equal(params.has(key), false);
  assert.ok(href.endsWith("#results"));
  assert.equal(paintLibraryHref("?sort=code&limit=120&item=selected", { sort: "name", limit: "60", item: "" }), "/paints");
});

test("only the exact locally opened dialog history entry closes with Back", () => {
  const href = "/paints?q=blue&item=citadel-blue";
  assert.equal(ownsPaintDialogEntry({ layerPaintDialog: href }, href), true);
  assert.equal(ownsPaintDialogEntry(JSON.parse(JSON.stringify({ layerPaintDialog: href })), href), true, "history ownership survives reload and Forward");
  for (const state of [null, {}, { layerPaintDialog: "/paints?item=another" }, { layerPaintDialog: true }]) assert.equal(ownsPaintDialogEntry(state, href), false);
});
