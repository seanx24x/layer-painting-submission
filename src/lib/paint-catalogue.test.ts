import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { PaintRecord } from "./paint-types";
import { guides } from "./guides";

const batches = [
  { file: "ak.json", brand: "AK Interactive" },
  { file: "vallejo.json", brand: "Vallejo" },
  { file: "citadel.json", brand: "Warhammer Colour" },
  { file: "army-painter.json", brand: "The Army Painter" },
  { file: "pro-acryl.json", brand: "Monument Hobbies" },
].map(({ file, brand }) => {
  const records: unknown = JSON.parse(
    readFileSync(new URL(`../data/paints/${file}`, import.meta.url), "utf8"),
  );
  assert.ok(Array.isArray(records), `${file}: expected a catalogue array`);
  return { file, brand, records: records as PaintRecord[] };
});

const paints = batches.flatMap(({ records }) => records);
const normalize = (value: string) => value.trim().toLowerCase();

function assertText(value: unknown, label: string): asserts value is string {
  assert.equal(typeof value, "string", `${label}: expected text`);
  assert.ok((value as string).trim().length > 0, `${label}: missing text`);
}

function isManufacturerSource(source: string, brand: string): boolean {
  const url = new URL(source);
  if (url.protocol !== "https:" || url.username || url.password) return false;
  const host = url.hostname.replace(/^www\./, "");
  switch (brand) {
    case "AK Interactive":
      return ["ak-interactive.com", "ak-masters.com"].includes(host);
    case "Vallejo":
      return ["acrylicosvallejo.com", "vallejocolors.com"].includes(host);
    case "Warhammer Colour":
      return [
        "warhammer.com",
        "paint.warhammer.com",
        "warhammer-community.com",
        "assets.warhammer-community.com",
      ].includes(host);
    case "The Army Painter":
      return host === "thearmypainter.com" || (
        host === "cdn.shopify.com" &&
        url.pathname === "/s/files/1/0781/9850/5747/files/A3_All_Warpaints_Fanatic_Poster.pdf"
      );
    case "Monument Hobbies":
      return host === "monumenthobbies.com" || (
        // This exact document is linked by the manufacturer's color-brochure page.
        // A generic Google Drive or Shopify URL is not manufacturer evidence.
        host === "drive.google.com" && url.pathname === "/uc" &&
        url.searchParams.get("id") === "1s37xlpZDHq1IGg4wyGyhsNbBSnrLqTzZ"
      );
    default:
      return false;
  }
}

test("all five requested manufacturers have substantial, correctly labelled batches", () => {
  assert.equal(batches.length, 5);
  for (const { file, brand, records } of batches) {
    assert.ok(records.length >= 100, `${file}: incomplete batch (${records.length} records)`);
    assert.ok(records.every((paint) => paint.brand === brand), `${file}: mixed or incorrect brand`);
  }
});

test("paint IDs and manufacturer/range/product identities are unique", () => {
  const ids = new Set<string>();
  const identities = new Set<string>();
  for (const paint of paints) {
    assertText(paint.id, "paint.id");
    assert.match(paint.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, paint.id);
    assert.ok(!ids.has(paint.id), `duplicate ID: ${paint.id}`);
    ids.add(paint.id);
    assertText(paint.range, `${paint.id}.range`);
    assertText(paint.name, `${paint.id}.name`);
    assert.ok(paint.code === null || typeof paint.code === "string", `${paint.id}.code`);
    if (paint.code !== null) assertText(paint.code, `${paint.id}.code`);
    // Citadel's chart publishes names without SKUs. Names are scoped to range:
    // Layer Dawnstone and Dry Dawnstone must remain separate valid records.
    const product = paint.code === null ? `name:${normalize(paint.name)}` : `code:${normalize(paint.code)}`;
    const identity = JSON.stringify([normalize(paint.brand), normalize(paint.range), product]);
    assert.ok(!identities.has(identity), `duplicate product identity: ${identity}`);
    identities.add(identity);
  }
});

test("every paint retains official sources, a real verification date and readable labels", () => {
  for (const paint of paints) {
    assertText(paint.sourceUrl, `${paint.id}.sourceUrl`);
    assertText(paint.swatch?.sourceUrl, `${paint.id}.swatch.sourceUrl`);
    for (const source of [paint.sourceUrl, paint.swatch.sourceUrl]) {
      assert.ok(isManufacturerSource(source, paint.brand), `${paint.id}: unrecognized manufacturer source ${source}`);
    }
    assertText(paint.swatch.note, `${paint.id}.swatch.note`);
    assertText(paint.verifiedAt, `${paint.id}.verifiedAt`);
    assert.match(paint.verifiedAt, /^\d{4}-\d{2}-\d{2}$/, paint.id);
    assert.equal(new Date(`${paint.verifiedAt}T00:00:00Z`).toISOString().slice(0, 10), paint.verifiedAt, paint.id);
    assert.equal(paint.name, paint.name.trim(), `${paint.id}: surrounding whitespace`);
    assert.doesNotMatch(paint.name, /[\r\n\uFFFD]|\s{2,}|https?:|\b(?:color chart|equivalence table|download pdf)\b/i, paint.id);
    assert.ok(paint.finish === null || (typeof paint.finish === "string" && paint.finish.trim().length > 0), `${paint.id}.finish`);
  }
});

test("chart colors are valid RGB approximations and unverified swatches stay empty", () => {
  for (const paint of paints) {
    const { hex, kind, note } = paint.swatch;
    if (kind === "unverified") {
      assert.equal(hex, null, `${paint.id}: unverified paint must not receive a guessed color`);
      assert.match(note, /not|no |omitted|unverified|unavailable/i, `${paint.id}: explain missing swatch`);
    } else {
      // These five imports digitize manufacturer charts. They do not publish
      // physical paint measurements or manufacturer-authored hex specifications.
      assert.equal(kind, "sampled-manufacturer-chart", `${paint.id}: overstated color provenance`);
      assert.equal(typeof hex, "string", `${paint.id}: missing digitized swatch`);
      assert.match(hex!, /^#[0-9a-f]{6}$/i, `${paint.id}: invalid RGB value`);
      assert.match(note, /median|sample|render|digitis|digitiz/i, `${paint.id}: extraction method missing`);
      assert.match(note, /not[^.]*?(?:calibrated|measured|physical)/i, `${paint.id}: physical-accuracy limitation missing`);
    }
  }
});

test("reviewed source anchors retain their names, codes and correct families", () => {
  const anchors = [
    { brand: "AK Interactive", code: "AK11001", name: "White", range: "3GEN General Series" },
    { brand: "Vallejo", code: "70.951", name: "White", range: "Model Color" },
    { brand: "Monument Hobbies", code: "MPA-001", name: "Bold Titanium White", range: "Pro Acryl" },
    { brand: "Warhammer Colour", code: null, name: "Macragge Blue", range: "Base" },
  ];
  for (const anchor of anchors) {
    const matches = paints.filter((paint) => paint.brand === anchor.brand &&
      paint.code === anchor.code && paint.name === anchor.name && paint.range === anchor.range);
    assert.equal(matches.length, 1, `missing or changed anchor: ${JSON.stringify(anchor)}`);
    assert.equal(matches[0].swatch.kind, "sampled-manufacturer-chart");
    assert.notEqual(matches[0].swatch.hex, null);
  }
});


test("generated guide paints match current catalogue sources and preserve lesson IDs", () => {
  type SourcedPaint = {
    catalogueId: string;
    brand: string;
    range: string;
    name: string;
    hex: string;
    sourceUrl: string;
    swatchKind: string;
  };
  const sourced = JSON.parse(
    readFileSync(new URL("../data/guide-paints.json", import.meta.url), "utf8"),
  ) as Record<string, SourcedPaint>;
  // These IDs are used by authored lesson steps and saved paint selections.
  // A catalogue refresh must update metadata without replacing local identities.
  for (const preservedId of [
    "abaddon-black", "altdorf-guard-blue", "blue-horror", "calgar-blue",
    "dark-angels-green", "fenrisian-grey", "macragge-blue", "moot-green",
    "nuln-oil", "warpstone-glow",
  ]) assert.ok(sourced[preservedId], `Missing preserved identity ${preservedId}`);
  for (const [localId, snapshot] of Object.entries(sourced)) {
    const matches = paints.filter((paint) => paint.id === snapshot.catalogueId);
    assert.equal(matches.length, 1, `${localId}: catalogue identity no longer resolves`);
    const current = matches[0];
    assert.deepEqual(snapshot, {
      catalogueId: current.id,
      brand: current.brand,
      range: current.range,
      name: current.name,
      hex: current.swatch.hex,
      sourceUrl: current.swatch.sourceUrl,
      swatchKind: current.swatch.kind,
    }, `${localId}: stale generated guide paint; run the source synchronization`);
    const uses = guides.flatMap((guide) => guide.paints)
      .filter((paint) => paint.catalogueId === current.id);
    assert.ok(uses.length > 0, `${localId}: generated paint is not used by a guide`);
    for (const paint of uses) {
      const { id, role, ...metadata } = paint;
      assert.equal(id, localId, `${current.id}: guide-local paint ID changed`);
      assertText(role, `${localId}.role`);
      assert.deepEqual(metadata, snapshot, `${localId}: guide bypasses current sourced metadata`);
    }
  }
  for (const guide of guides) {
    for (const paint of guide.paints) {
      if (paint.catalogueId) {
        assert.equal(sourced[paint.id]?.catalogueId, paint.catalogueId,
          `${guide.id}/${paint.id}: sourced paint is missing from the generated subset`);
      }
    }
    for (const step of guide.steps) {
      for (const localId of step.paintIds) {
        assert.equal(guide.paints.filter((paint) => paint.id === localId).length, 1,
          `${guide.id}/${step.id}: paint ID ${localId} does not resolve within this guide`);
      }
    }
  }
});
