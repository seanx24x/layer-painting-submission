import assert from "node:assert/strict";
import test from "node:test";
import { filterPaints } from "./paint-search";
import type { PaintRecord } from "./paint-types";

function record(
  id: string,
  name: string,
  brand: string,
  range: string,
  code: string | null,
  hex: string | null,
): PaintRecord {
  return {
    id,
    name,
    brand,
    range,
    code,
    finish: null,
    swatch: {
      hex,
      kind: hex ? "sampled-manufacturer-chart" : "unverified",
      sourceUrl: "https://example.com/chart",
      note: "Test fixture",
    },
    sourceUrl: "https://example.com/product",
    verifiedAt: "2026-10-07",
  };
}
const sample = [
  record(
    "vallejo-70951",
    "White",
    "Vallejo",
    "Model Color",
    "70.951",
    "#FFFFFF",
  ),
  record(
    "vallejo-72001",
    "White",
    "Vallejo",
    "Game Color",
    "72.001",
    "#FFFFFF",
  ),
  record(
    "citadel-base-abaddon-black",
    "Abaddon Black",
    "Warhammer Colour",
    "Base",
    null,
    "#171717",
  ),
  record(
    "pro-acryl-001",
    "Bold Titanium White",
    "Monument Hobbies",
    "Pro Acryl",
    "001",
    "#FBFBF9",
  ),
  record("pending", "Awaiting source", "Vallejo", "Model Color", null, null),
];
test("legacy and colloquial brand names find the canonical manufacturer", () => {
  assert.equal(
    filterPaints(sample, { query: "Citadel Abaddon" })[0]?.id,
    "citadel-base-abaddon-black",
  );
  assert.equal(
    filterPaints(sample, { query: "Pro Acrylic Titanium" })[0]?.id,
    "pro-acryl-001",
  );
});
test("product-code punctuation is optional while brand and range stay exact", () => {
  assert.equal(filterPaints(sample, { query: "70951" })[0]?.code, "70.951");
  assert.equal(filterPaints(sample, { query: "70.951" }).length, 1);
  assert.equal(
    filterPaints(sample, {
      query: "white",
      brand: "Vallejo",
      range: "Game Color",
    })[0]?.code,
    "72.001",
  );
  assert.equal(
    filterPaints(sample, { query: "white", brand: "Warhammer Colour" }).length,
    0,
  );
});
test("same-name paints in different ranges remain separate and missing swatches sort last", () => {
  assert.equal(
    filterPaints(sample, { query: "White", brand: "Vallejo" }).length,
    2,
  );
  assert.equal(filterPaints(sample, { sort: "colour" }).at(-1)?.id, "pending");
  const before = sample.map((paint) => paint.id);
  filterPaints(sample, { sort: "name" });
  assert.deepEqual(
    sample.map((paint) => paint.id),
    before,
  );
});

test("range search does not leak across brand aliases", () => {
  assert.equal(
    filterPaints(sample, { query: "Vallejo Model Color 72.001" }).length,
    0,
  );
  assert.equal(
    filterPaints(sample, { query: "Vallejo Model Colour 70.951" })[0]?.code,
    "70.951",
  );
});
