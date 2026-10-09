import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const source = JSON.parse(readFileSync(new URL("../../src/data/paints/citadel.json", import.meta.url), "utf8"));
const wanted = {
  "macragge-blue": ["Macragge Blue", "Base"],
  "calgar-blue": ["Calgar Blue", "Layer"],
  "blue-horror": ["Blue Horror", "Layer"],
  "abaddon-black": ["Abaddon Black", "Base"],
  "nuln-oil": ["Nuln Oil", "Shade"],
  "altdorf-guard-blue": ["Altdorf Guard Blue", "Layer"],
  "fenrisian-grey": ["Fenrisian Grey", "Layer"],
  "warpstone-glow": ["Warpstone Glow", "Layer"],
  "dark-angels-green": ["Dark Angels Green", "Contrast"],
  "moot-green": ["Moot Green", "Layer"],
};
for (const file of ["faction-guides-40k.json", "faction-guides-heresy.json"]) {
  const guides = JSON.parse(readFileSync(new URL(`../../src/data/${file}`, import.meta.url), "utf8"));
  for (const guide of guides) {
    for (const { name, range } of guide.paintNames) {
      const existing = Object.values(wanted).find(([knownName, knownRange]) => knownName === name && (!range || knownRange === range));
      if (existing) continue;
      const matches = source.filter((paint) => paint.name === name && (!range || paint.range === range));
      if (matches.length !== 1) throw new Error(`${guide.id}: ambiguous or missing paint ${name}. Specify its range.`);
      const localId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (wanted[localId]) throw new Error(`Paint identity collision: ${localId}`);
      wanted[localId] = [name, matches[0].range];
    }
  }
}
const entries = Object.entries(wanted).map(([localId, [name, range]]) => {
  const matches = source.filter((paint) => paint.name === name && paint.range === range);
  if (matches.length !== 1 || !matches[0].swatch.hex) throw new Error(`Expected one sourced ${range} / ${name} swatch; found ${matches.length}.`);
  const paint = matches[0];
  return [localId, { catalogueId:paint.id, brand:paint.brand, range:paint.range, name:paint.name, hex:paint.swatch.hex, sourceUrl:paint.swatch.sourceUrl, swatchKind:paint.swatch.kind }];
});
const path = new URL("../../src/data/guide-paints.json", import.meta.url);
writeFileSync(path, `${JSON.stringify(Object.fromEntries(entries),null,2)}\n`);
console.log(`Synced ${entries.length} exact name/range matches to ${fileURLToPath(path)}.`);
