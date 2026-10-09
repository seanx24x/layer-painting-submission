import type { Guide, GuidePaint, GuideStep } from "./guides";
import type { TechniqueId } from "./technique-study-types";

/** Catalogue colours are illustrative screen swatches, not calibrated finishes. */
export type StudyPaint = { id: string; name: string; hex: string };
export type StudyPalette = { base: StudyPaint; coats: [StudyPaint, StudyPaint, StudyPaint] };
export type StudyPaletteOption = { id: string; label: string; palette: StudyPalette };

type Material = {
  label: string;
  foundation: string;
  highlights: string[];
  shades: string[];
  layers: string[];
};
type MaterialSpec = [label: string, foundation: string, highlights?: string, shades?: string, layers?: string];
const ids = (value = "") => value.split(" ").filter(Boolean);
const material = ([label, foundation, highlights, shades, layers]: MaterialSpec): Material => ({
  label, foundation, highlights: ids(highlights), shades: ids(shades), layers: ids(layers),
});

// Heresy recipes use prose roles and sometimes several separate materials in a
// single step. These reviewed associations keep a white armour highlight off a
// blue shoulder, or a metal wash off the adjacent red armour. They reference
// catalogue IDs only; no faction colour or lighter swatch is invented here.
const authoredMaterials: Record<string, MaterialSpec[]> = {
  "ultramarines-grimdark": [["Blue armour", "macragge-blue", "calgar-blue blue-horror", "burnt-umber"]],
  "ultramarines-classic": [["Blue armour", "macragge-blue", "altdorf-guard-blue fenrisian-grey", "abaddon-black nuln-oil"]],
  "salamanders-classic": [["Green armour", "warpstone-glow", "moot-green", "dark-angels-green"]],
  "heresy-dark-angels": [
    ["Black armour", "abaddon-black", "eshin-grey dawnstone"],
    ["Red heraldry", "mephiston-red", "evil-sunz-scarlet"],
    ["Weapon metal", "leadbelcher", "", "nuln-oil"],
  ],
  "heresy-white-scars": [
    ["White armour", "corax-white", "white-scar", "soulblight-grey"],
    ["Red markings", "mephiston-red", "evil-sunz-scarlet"],
    ["Black joints", "abaddon-black"], ["Weapon metal", "leadbelcher"],
  ],
  "heresy-space-wolves": [
    ["Grey armour", "mechanicus-standard-grey", "dawnstone administratum-grey", "nuln-oil"],
    ["Gold trim", "retributor-armour", "", "agrax-earthshade"],
    ["Red markings", "mephiston-red"], ["Black joints", "abaddon-black"],
  ],
  "heresy-imperial-fists": [
    ["Yellow armour", "averland-sunset", "yriel-yellow flash-gitz-yellow", "seraphim-sepia"],
    ["Black fittings", "abaddon-black", "eshin-grey"],
    ["Red markings", "mephiston-red"], ["Weapon metal", "leadbelcher"],
  ],
  "heresy-blood-angels": [
    ["Red armour", "mephiston-red", "evil-sunz-scarlet wild-rider-red", "carroburg-crimson"],
    ["Gold ornament", "retributor-armour", "", "reikland-fleshshade"],
    ["Black joints", "abaddon-black"],
  ],
  "heresy-iron-hands": [
    ["Blackened steel", "leadbelcher", "ironbreaker stormhost-silver", "", "black-legion"],
    ["Black joints", "abaddon-black"], ["Blue lenses", "caledor-sky"], ["Pale insignia", "corax-white"],
  ],
  "heresy-ultramarines": [
    ["Blue armour", "macragge-blue", "altdorf-guard-blue calgar-blue", "drakenhof-nightshade"],
    ["Gold trim", "retributor-armour", "", "agrax-earthshade"],
    ["Black joints", "abaddon-black"], ["Pale insignia", "corax-white"],
  ],
  "heresy-salamanders": [
    ["Green armour", "waaagh-flesh", "elysian-green ogryn-camo", "athonian-camoshade"],
    ["Black fittings", "abaddon-black"], ["Bronze ornament", "balthasar-gold"], ["Red lenses", "mephiston-red"],
  ],
  "heresy-raven-guard": [
    ["Black armour", "abaddon-black", "dark-reaper thunderhawk-blue"],
    ["Pale insignia", "corax-white"], ["Red lenses", "mephiston-red"], ["Steel fittings", "leadbelcher", "", "nuln-oil"],
  ],
  "heresy-emperors-children": [
    ["Purple armour", "naggaroth-night", "genestealer-purple", "druchii-violet", "xereus-purple"],
    ["Gold trim", "retributor-armour", "", "reikland-fleshshade"],
    ["Black fittings", "abaddon-black"], ["Pale panels", "corax-white"],
  ],
  "heresy-iron-warriors": [
    ["Iron armour", "leadbelcher", "ironbreaker", "nuln-oil"],
    ["Yellow markings", "averland-sunset", "yriel-yellow"],
    ["Black markings", "abaddon-black"], ["Bronze trim", "balthasar-gold"],
  ],
  "heresy-night-lords": [
    ["Blue armour", "kantor-blue", "caledor-sky lothern-blue white-scar", "drakenhof-nightshade"],
    ["Warm trim", "balthasar-gold"], ["Black joints", "abaddon-black"], ["Red lenses", "mephiston-red"],
  ],
  "heresy-world-eaters": [
    ["White armour", "corax-white", "white-scar", "soulblight-grey"],
    ["Blue shoulders", "macragge-blue", "calgar-blue"],
    ["Black joints", "abaddon-black"], ["Steel details", "leadbelcher"],
  ],
  "heresy-death-guard": [
    ["Ivory armour", "rakarth-flesh", "pallid-wych-flesh", "agrax-earthshade"],
    ["Green panels", "loren-forest", "ogryn-camo"],
    ["Steel details", "leadbelcher"], ["Black joints", "abaddon-black"],
  ],
  "heresy-thousand-sons": [
    ["Red armour", "ironbreaker", "", "carroburg-crimson", "flesh-tearers-red"],
    ["Gold trim", "retributor-armour", "stormhost-silver", "reikland-fleshshade"],
    ["Black joints", "abaddon-black"], ["White panels", "corax-white"],
  ],
  "heresy-sons-of-horus": [
    ["Sea-green armour", "lupercal-green", "sybarite-green gauss-blaster-green", "coelia-greenshade", "sons-of-horus-green"],
    ["Gold details", "retributor-armour"], ["Black joints", "abaddon-black"], ["Red lenses", "mephiston-red"],
  ],
  "heresy-word-bearers": [
    ["Crimson armour", "khorne-red", "wazdakka-red squig-orange", "carroburg-crimson"],
    ["Black panels", "abaddon-black"], ["Gold ornament", "retributor-armour", "", "agrax-earthshade"],
    ["Parchment", "ushabti-bone"],
  ],
  "heresy-alpha-legion": [
    ["Tinted armour", "leadbelcher", "stormhost-silver", "coelia-greenshade", "ironbreaker akhelian-green"],
    ["Black joints", "abaddon-black"], ["Red lenses", "mephiston-red"],
  ],
  "heresy-mechanicum": [
    ["Red panels", "mephiston-red", "evil-sunz-scarlet", "agrax-earthshade"],
    ["Machinery", "leadbelcher", "ironbreaker", "nuln-oil"],
    ["Black cables", "abaddon-black"], ["White markings", "corax-white"],
  ],
  "heresy-dark-mechanicum": [
    ["Red panels", "khorne-red", "wazdakka-red", "agrax-earthshade"],
    ["Machinery", "iron-warriors", "ironbreaker", "nuln-oil"],
    ["Black cables", "abaddon-black"], ["Pale symbols", "pallid-wych-flesh"],
  ],
  "heresy-solar-auxilia": [
    ["Silver armour", "leadbelcher", "stormhost-silver", "nuln-oil"],
    ["Burgundy panels", "barak-nar-burgundy", "screamer-pink"],
    ["Dark undersuit", "eshin-grey"], ["Brass trim", "runelord-brass"], ["Black casing", "abaddon-black"],
  ],
  "heresy-imperialis-militia": [
    ["Khaki cloth", "steel-legion-drab", "karak-stone", "agrax-earthshade"],
    ["Olive armour", "castellan-green", "elysian-green", "agrax-earthshade"],
    ["Leather equipment", "rhinox-hide"], ["Weapon metal", "leadbelcher"], ["Black casing", "abaddon-black"],
  ],
  "heresy-legio-custodes": [
    ["Gold armour", "retributor-armour", "auric-armour-gold stormhost-silver", "reikland-fleshshade"],
    ["Crimson cloth", "khorne-red", "wazdakka-red"], ["Black fittings", "abaddon-black"],
  ],
  "heresy-sisters-of-silence": [
    ["Bronze armour", "balthasar-gold", "sycorax-bronze stormhost-silver", "agrax-earthshade"],
    ["Crimson cloth", "khorne-red", "wazdakka-red"], ["Black equipment", "abaddon-black"], ["Weapon metal", "leadbelcher"],
  ],
  "heresy-knight-households": [
    ["Bone panels", "balor-brown", "screaming-skull", "agrax-earthshade", "ushabti-bone"],
    ["Black trim", "abaddon-black", "eshin-grey"], ["Mechanical frame", "leadbelcher", "", "nuln-oil"],
  ],
  "heresy-titan-legions": [
    ["Grey armour", "mechanicus-standard-grey", "dawnstone administratum-grey"],
    ["Yellow panels", "averland-sunset", "yriel-yellow"], ["Metal frame", "leadbelcher", "", "nuln-oil"],
    ["Panel separations", "abaddon-black"],
  ],
  "heresy-daemons-of-the-ruinstorm": [
    ["Flesh", "rakarth-flesh", "pallid-wych-flesh", "druchii-violet"],
    ["Horns and claws", "rhinox-hide", "karak-stone"], ["Dark sockets", "abaddon-black"], ["Eye accents", "fire-dragon-bright"],
  ],
  "heresy-blackshields": [
    ["Black armour", "abaddon-black", "eshin-grey dawnstone"],
    ["Exposed metal", "leadbelcher", "", "nuln-oil"], ["Pale markings", "corax-white"],
  ],
  "heresy-shattered-legions": [
    ["Iron Hands armour", "abaddon-black", "ironbreaker"],
    ["Salamanders armour", "waaagh-flesh", "elysian-green ogryn-camo", "athonian-camoshade"],
    ["Raven Guard armour", "abaddon-black", "dark-reaper thunderhawk-blue"],
  ],
};

function structuredMaterials(guide: Guide): Material[] {
  const result = new Map<string, Material>();
  const add = (label: string, role: keyof Pick<Material, "foundation" | "highlights" | "shades" | "layers">, id: string) => {
    const item = result.get(label) ?? { label, foundation: "", highlights: [], shades: [], layers: [] };
    if (role === "foundation") item.foundation = id;
    else if (!item[role].includes(id)) item[role].push(id);
    result.set(label, item);
  };
  for (const paint of guide.paints) {
    for (const role of paint.role.split(";").map((part) => part.trim())) {
      if (role === "Main foundation") add("Main surface", "foundation", paint.id);
      if (role === "Main colour recovery") add("Main surface", "layers", paint.id);
      if (role === "Main recess shade") add("Main surface", "shades", paint.id);
      if (role === "First highlight" || role === "Finest light") add("Main surface", "highlights", paint.id);
      if (role === "Focal detail foundation") add("Focal detail", "foundation", paint.id);
      if (role === "Focal detail light") add("Focal detail", "highlights", paint.id);
      const match = /^(Foundation|Shade|Highlight): (.+)$/.exec(role);
      if (match) {
        const label = match[2].replace(/^the /, "");
        add(label.charAt(0).toUpperCase() + label.slice(1), { Foundation: "foundation", Shade: "shades", Highlight: "highlights" }[match[1]] as "foundation" | "shades" | "highlights", paint.id);
      }
    }
  }
  return [...result.values()].filter((item) => item.foundation);
}

function getPaint(guide: Guide, id: string): GuidePaint {
  const paint = guide.paints.find((candidate) => candidate.id === id);
  if (!paint) throw new Error(`${guide.id}: study palette references missing paint ${id}`);
  return paint;
}
function swatch(paint: GuidePaint): StudyPaint {
  return { id: paint.id, name: paint.name, hex: paint.hex };
}

function primer(guide: Guide): StudyPaint {
  const preparation = [...guide.prerequisites, ...guide.steps.filter((step) => step.id === "prepare").map((step) => step.action)].join(" ").toLowerCase();
  if (/warm off-white/.test(preparation)) return { id: "practice-primer-warm", name: "Warm off-white primer", hex: "#e6dfcf" };
  if (/(?:primed |dry |suitable |with )black|black primer/.test(preparation)) return { id: "practice-primer-black", name: "Black primer", hex: "#202123" };
  if (/light grey|off-white|white primer/.test(preparation)) return { id: "practice-primer-light", name: "Light primer", hex: "#d0d0c9" };
  return { id: "practice-primer-neutral", name: "Neutral practice primer", hex: "#aaa9a2" };
}

function underlyingPaint(guide: Guide, step: GuideStep, item: Material, technique: TechniqueId): StudyPaint {
  if (technique === "layers") return primer(guide);
  if (guide.id === "salamanders-classic" && step.id === "recover") return swatch(getPaint(guide, "dark-angels-green"));
  const stepIndex = guide.steps.findIndex((candidate) => candidate.id === step.id);
  let surface = item.foundation;
  for (const previous of guide.steps.slice(0, Math.max(0, stepIndex))) {
    // Layers explicitly include tinted finishes where a later shade must be
    // placed over the red/teal finish, not the silver foundation beneath it.
    for (const id of previous.paintIds) {
      if (id === item.foundation && previous.technique === "basecoat") surface = id;
      if (item.layers.includes(id)) surface = id;
    }
  }
  return swatch(getPaint(guide, surface));
}

/**
 * One option represents one physical material. Applied coats always come from
 * the current step. A single named paint is repeated, never auto-lightened;
 * multi-colour highlights retain the recipe's order and repeat its final paint.
 */
export function studyPaletteOptions(guide: Guide, step: GuideStep, technique: TechniqueId): StudyPaletteOption[] {
  if (!step.paintIds.length) return [];
  const materials = authoredMaterials[guide.id]?.map(material) ?? structuredMaterials(guide);
  const options: StudyPaletteOption[] = [];
  for (const item of materials) {
    if (!authoredMaterials[guide.id]) {
      if (["foundation", "recover", "light"].includes(step.id) && item.label !== "Main surface") continue;
      if (["materials", "material-light"].includes(step.id) && item.label === "Main surface") continue;
    }
    // Secondary 40K foundation and light stages should not also offer an eye
    // lens merely because it reuses one of the material's red paints.
    if (step.id === "focal-point" && item.label !== "Focal detail") continue;
    if (step.id !== "focal-point" && item.label === "Focal detail") continue;
    const applicable = technique === "layers" ? [item.foundation, ...item.layers]
      : technique === "recess" ? item.shades
      : technique === "drybrush" ? [item.foundation, ...item.layers, ...item.highlights]
      : item.highlights;
    const applied = step.paintIds.filter((id) => applicable.includes(id));
    if (!applied.length) continue;
    const first = swatch(getPaint(guide, applied[0]));
    // A layer or recess study demonstrates repeated placement of a single
    // paint. It must not turn a list of separate washes into stacked colours.
    const sequence = technique === "layers" || technique === "recess" ? [first] : applied.map((id) => swatch(getPaint(guide, id)));
    options.push({
      id: `${item.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${first.id}`,
      label: item.label,
      palette: { base: underlyingPaint(guide, step, item, technique), coats: [sequence[0], sequence[1] ?? sequence[0], sequence[2] ?? sequence.at(-1)!] },
    });
  }
  if (options.length) {
    // Follow the authored step, including blue shoulders appearing before a
    // white repair paint, rather than the order of the full guide's palette.
    return options.sort((a, b) => step.paintIds.indexOf(a.palette.coats[0].id) - step.paintIds.indexOf(b.palette.coats[0].id));
  }
  // Unsupported/finishing techniques have no authored simulation, but callers
  // asking for a colour still receive the actual requested paint, never blue.
  return step.paintIds.map((id) => {
    const paint = swatch(getPaint(guide, id));
    return { id: paint.id, label: paint.name, palette: { base: primer(guide), coats: [paint, paint, paint] } };
  });
}

export function resolveStudyPalette(guide: Guide, step: GuideStep, technique: TechniqueId): StudyPalette {
  const palette = studyPaletteOptions(guide, step, technique)[0]?.palette;
  if (!palette) throw new Error(`${guide.id}/${step.id}: this step has no paint to demonstrate`);
  return palette;
}
