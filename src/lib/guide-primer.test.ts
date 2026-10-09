import assert from "node:assert/strict";
import test from "node:test";
import { getGuide, guides, type Guide } from "./guides";
import { getGuidePaintMaterials, getGuidePrimer } from "./guide-primer";
import { createSession, readSessions, saveSessions, updateSession, type GuideSessionDefinition, type SessionStorage } from "./session";

function guide(slug: string): Guide {
  const result = getGuide(slug);
  assert.ok(result, `Missing test guide ${slug}`);
  return result;
}

test("every guide has a named, sourced preparation product without changing its lesson palette", () => {
  const before = JSON.stringify(guides);
  for (const item of guides) {
    const primer = getGuidePrimer(item);
    const materials = getGuidePaintMaterials(item);
    assert.match(primer.name, / Spray$/, item.id);
    assert.equal(primer.range, "Spray primer");
    assert.equal(primer.selection, "layer-choice");
    assert.match(primer.context, /^Layer primer choice/);
    assert.match(primer.hex, /^#[0-9A-F]{6}$/i);
    assert.equal(new URL(primer.sourceUrl).hostname, "www.warhammer-community.com");
    assert.equal(materials.length, item.paints.length + 1);
    assert.equal(materials[0].id, primer.id);
    assert.equal(new Set(materials.map((paint) => paint.id)).size, materials.length);
    assert.deepEqual(materials.slice(1), item.paints);
    assert.deepEqual(getGuidePrimer(item), primer);
  }
  assert.equal(JSON.stringify(guides), before);
});

test("named primer choices follow the existing preparation colours rather than the final faction palette", () => {
  for (const [slug, name] of [
    ["ultramarines-classic", "Mechanicus Standard Grey Spray"],
    ["ultramarines-grimdark", "Chaos Black Spray"],
    ["grey-knights-silver", "Chaos Black Spray"],
    ["heresy-solar-auxilia", "Mechanicus Standard Grey Spray"],
    ["heresy-white-scars", "Grey Seer Spray"],
    ["white-scars-white", "White Scar Spray"],
    ["tyranids-leviathan", "Wraithbone Spray"],
    ["imperial-fists-yellow", "Wraithbone Spray"],
  ]) assert.equal(getGuidePrimer(guide(slug)).name, name, slug);
  const unspecified = getGuidePrimer(guide("salamanders-classic"));
  assert.equal(unspecified.selection, "layer-choice");
  assert.match(unspecified.context, /does not prescribe a primer colour/);
});

test("a primer spray and its pot colour retain distinct material identities", () => {
  const tyranids = guide("tyranids-leviathan");
  const materials = getGuidePaintMaterials(tyranids);
  assert.equal(materials.filter((paint) => paint.name === "Wraithbone Spray").length, 1);
  assert.equal(materials.filter((paint) => paint.name === "Wraithbone").length, 1);
  assert.notEqual(getGuidePrimer(tyranids).id, tyranids.paints.find((paint) => paint.name === "Wraithbone")?.id);
  // Grey Seer is a badge paint in this guide, not its undercoat.
  assert.equal(getGuidePrimer(guide("raven-guard-black")).name, "Chaos Black Spray");
});

test("an explicitly named recipe primer is preserved and is not added twice", () => {
  const base = guide("ultramarines-classic");
  const named = {
    ...base,
    paints: [...base.paints, {
      id: "existing-grey-seer-spray", name: "Grey Seer", role: "Primer", range: "Spray",
      brand: "Warhammer Colour", hex: "#ADADAD", sourceUrl: "https://www.warhammer-community.com/en-gb/articles/llZeorVj/a-new-era-of-paints-new-contrast-colours-reformulated-shades-and-our-best-white-spray-ever/",
    }],
  };
  const primer = getGuidePrimer(named);
  assert.equal(primer.id, "existing-grey-seer-spray");
  assert.equal(primer.name, "Grey Seer Spray");
  assert.equal(primer.selection, "recipe");
  assert.equal(getGuidePaintMaterials(named).length, named.paints.length);
  assert.equal(getGuidePaintMaterials(named).at(-1)?.name, "Grey Seer Spray");
  assert.equal(named.paints.at(-1)?.name, "Grey Seer", "helper must not mutate the recipe");
});

test("a named preparation spray wins, while faction names are not mistaken for products", () => {
  const base = guide("ultramarines-classic");
  const explicit = { ...base, prerequisites: ["Prime with Grey Seer Spray and allow it to cure."] };
  assert.equal(getGuidePrimer(explicit).name, "Grey Seer Spray");
  assert.equal(getGuidePrimer(explicit).selection, "recipe");
  const faction = { ...base, prerequisites: ["A White Scars miniature, primed black and dry."] };
  assert.equal(getGuidePrimer(faction).name, "Chaos Black Spray");
  assert.equal(getGuidePrimer(faction).selection, "layer-choice");
});

test("a generic primer placeholder or unsourced unknown product cannot claim recipe provenance", () => {
  const base = guide("ultramarines-classic");
  for (const name of ["Primer", "Grey primer", "Unverified Custom Product"]) {
    const placeholder = { ...base, paints: [{ id: "primer", name, role: "Primer", hex: "#999999" }, ...base.paints] };
    const primer = getGuidePrimer(placeholder);
    assert.equal(primer.name, "Mechanicus Standard Grey Spray");
    assert.equal(primer.selection, "layer-choice");
    assert.equal(placeholder.paints[0].name, name);
  }
});

test("legacy material readiness restores unchanged and the new primer survives save and reload", () => {
  const item = guide("ultramarines-classic");
  const definition = (includePrimer: boolean): GuideSessionDefinition => ({
    id: item.id, version: 1, stepIds: item.steps.map((step) => step.id),
    preparedIds: [...(includePrimer ? getGuidePaintMaterials(item) : item.paints).map((paint) => paint.id), ...item.tools.map((_, i) => `tool-${i}`)],
  });
  const legacyDefinition = definition(false);
  const currentDefinition = definition(true);
  const now = "2026-10-09T18:00:00.000Z";
  let session = createSession(legacyDefinition, now);
  session = updateSession(session, { type: "prepare", preparedId: "macragge-blue", prepared: true }, legacyDefinition, now);
  session = updateSession(session, { type: "note", stepId: "base", note: "Keep the first coat thin." }, legacyDefinition, now);
  const values = new Map<string, string>();
  const storage: SessionStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
  assert.deepEqual(saveSessions({ [item.id]: session }, [legacyDefinition], storage), { ok: true });
  const legacy = readSessions([currentDefinition], storage);
  assert.ok(legacy.ok);
  assert.deepEqual(legacy.sessions[item.id], session);
  assert.ok(!legacy.sessions[item.id].preparedIds.includes(getGuidePrimer(item).id));
  const prepared = updateSession(legacy.sessions[item.id], { type: "prepare", preparedId: getGuidePrimer(item).id, prepared: true }, currentDefinition, now);
  assert.deepEqual(saveSessions({ [item.id]: prepared }, [currentDefinition], storage), { ok: true });
  const restored = readSessions([currentDefinition], storage);
  assert.ok(restored.ok);
  assert.deepEqual(restored.sessions[item.id], prepared);
  assert.ok(restored.sessions[item.id].preparedIds.includes(getGuidePrimer(item).id));
  assert.equal(restored.sessions[item.id].notes.base, "Keep the first coat thin.");
});
