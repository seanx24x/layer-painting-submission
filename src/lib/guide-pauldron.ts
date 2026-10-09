import type { Guide, GuidePaint } from "./guides";
import { getGuidePrimer, type GuidePrimer } from "./guide-primer";

export interface GuidePauldronPalette {
  plate: string;
  trim: string;
  skull: string;
  shade: string;
  highlight: string;
  trimHighlight: string;
  /** Trim reflectivity, retained for the pauldron renderer's original contract. */
  metalness: number;
  plateMetalness: number;
  skullMetalness: number;
}

export interface GuidePauldronAssignment {
  regions: number[];
  label: "Plate" | "Trim" | "Details";
  paintId: string;
  name: string;
  hex: string;
  reason: string;
}

export interface GuidePauldronStudy {
  id: string;
  name: string;
  label: "Layer palette study";
  note: string;
  /** Additional scope for a disclosure, rather than a claim about this armour sculpt. */
  context: string;
  representation: "armour-palette" | "palette-adaptation";
  palette: GuidePauldronPalette;
  assignments: GuidePauldronAssignment[];
  primer: GuidePrimer;
  sources: Guide["sources"];
}

type Selection = {
  plate: string;
  trim?: string;
  shade?: string | null;
  highlight?: string;
  trimHighlight?: string;
  detail?: string;
  metallicPlate?: boolean;
  context?: string;
};

/**
 * Reviewed against the guides' own paint roles and teaching steps. These select
 * a colour within each bounded study, not a universal faction shoulder scheme.
 * In particular, a metallic undercoat must not replace its final coloured tint.
 */
const selections: Record<string, Selection> = {
  "blood-angels-red": { plate: "Mephiston Red", trim: "Mephiston Red" },
  "space-wolves-grey": { plate: "Averland Sunset", trim: "Russ Grey", shade: "Seraphim Sepia", highlight: "Yriel Yellow", trimHighlight: "Fenrisian Grey", context: "The guide's yellow shoulder is the colour reference; pack markings and shoulder side are not depicted." },
  "black-templars-crusade": { plate: "Corax White", trim: "Abaddon Black", shade: "Soulblight Grey", highlight: "White Scar", trimHighlight: "Thunderhawk Blue" },
  "deathwatch-veteran": { plate: "Leadbelcher", trim: "Leadbelcher", shade: "Nuln Oil", highlight: "Stormhost Silver", trimHighlight: "Stormhost Silver", context: "This samples the guide's silver Deathwatch shoulder. The sculpt is a practice form, without Deathwatch lettering or the separate parent-Chapter shoulder." },
  "heresy-dark-angels": { plate: "Abaddon Black", shade: null, highlight: "Dawnstone" },
  "heresy-white-scars": { plate: "Corax White", shade: "Soulblight Grey", highlight: "White Scar" },
  "heresy-space-wolves": { plate: "Mechanicus Standard Grey", shade: "Nuln Oil", highlight: "Administratum Grey", detail: "Retributor Armour" },
  "heresy-imperial-fists": { plate: "Yriel Yellow", shade: "Seraphim Sepia", highlight: "Flash Gitz Yellow" },
  "heresy-blood-angels": { plate: "Mephiston Red", trim: "Mephiston Red", shade: "Carroburg Crimson", highlight: "Wild Rider Red", detail: "Retributor Armour" },
  "heresy-iron-hands": { plate: "Black Legion", shade: "Abaddon Black", highlight: "Ironbreaker", metallicPlate: true, context: "The black tint over steel is represented by a coloured metallic surface. Transparent paint and exposed-metal wear remain illustrative." },
  "heresy-ultramarines": { plate: "Macragge Blue", trim: "Retributor Armour", shade: "Drakenhof Nightshade", highlight: "Calgar Blue" },
  "heresy-salamanders": { plate: "Waaagh! Flesh", shade: "Athonian Camoshade", highlight: "Ogryn Camo", detail: "Balthasar Gold" },
  "heresy-raven-guard": { plate: "Abaddon Black", shade: null, highlight: "Thunderhawk Blue" },
  "heresy-emperors-children": { plate: "Xereus Purple", trim: "Retributor Armour", shade: "Druchii Violet", highlight: "Genestealer Purple" },
  "heresy-iron-warriors": { plate: "Leadbelcher", trim: "Balthasar Gold", shade: "Nuln Oil", highlight: "Ironbreaker", context: "This shows the iron and bronze palette. The guide's optional hazard panel is not represented by the practice sculpt." },
  "heresy-night-lords": { plate: "Kantor Blue", trim: "Balthasar Gold", shade: "Drakenhof Nightshade", highlight: "Lothern Blue" },
  "heresy-world-eaters": { plate: "Macragge Blue", trim: "Corax White", shade: null, highlight: "Calgar Blue", trimHighlight: "White Scar", context: "The guide's blue shoulder panels and white armour are adapted to this sculpt. No shoulder markings or wear pattern are implied." },
  "heresy-death-guard": { plate: "Rakarth Flesh", shade: "Agrax Earthshade", highlight: "Pallid Wych Flesh" },
  "heresy-thousand-sons": { plate: "Flesh Tearers Red", trim: "Retributor Armour", shade: "Carroburg Crimson", highlight: "Stormhost Silver", metallicPlate: true, context: "The guide's red tint over silver is represented by a coloured metallic surface. It is an illustration of the palette, not a prediction of translucent paint coverage." },
  "heresy-sons-of-horus": { plate: "Sons of Horus Green", shade: "Coelia Greenshade", highlight: "Gauss Blaster Green", detail: "Retributor Armour" },
  "heresy-word-bearers": { plate: "Khorne Red", shade: "Carroburg Crimson", highlight: "Squig Orange", detail: "Retributor Armour" },
  "heresy-alpha-legion": { plate: "Akhelian Green", trim: "Stormhost Silver", shade: "Coelia Greenshade", highlight: "Ironbreaker", metallicPlate: true, context: "The guide's blue-green tint over metal is represented by a coloured metallic surface. It is an illustration of the palette, not a prediction of translucent paint coverage." },
  "heresy-mechanicum": { plate: "Mephiston Red", shade: "Agrax Earthshade", highlight: "Evil Sunz Scarlet" },
  "heresy-dark-mechanicum": { plate: "Khorne Red", shade: "Agrax Earthshade", highlight: "Wazdakka Red" },
  "heresy-solar-auxilia": { plate: "Leadbelcher", trim: "Runelord Brass", shade: "Nuln Oil", highlight: "Stormhost Silver" },
  "heresy-imperialis-militia": { plate: "Castellan Green", shade: "Agrax Earthshade", highlight: "Elysian Green" },
  "heresy-legio-custodes": { plate: "Retributor Armour", shade: "Reikland Fleshshade", highlight: "Auric Armour Gold" },
  "heresy-sisters-of-silence": { plate: "Balthasar Gold", shade: "Agrax Earthshade", highlight: "Sycorax Bronze" },
  "heresy-knight-households": { plate: "Ushabti Bone", trim: "Abaddon Black", shade: "Agrax Earthshade", highlight: "Screaming Skull", trimHighlight: "Eshin Grey" },
  "heresy-titan-legions": { plate: "Mechanicus Standard Grey", trim: "Leadbelcher", shade: null, highlight: "Administratum Grey" },
  "heresy-daemons-of-the-ruinstorm": { plate: "Rakarth Flesh", trim: "Rhinox Hide", shade: "Druchii Violet", highlight: "Pallid Wych Flesh", trimHighlight: "Karak Stone" },
  "heresy-blackshields": { plate: "Abaddon Black", shade: null, highlight: "Dawnstone" },
  "heresy-shattered-legions": { plate: "Abaddon Black", shade: null, highlight: "Thunderhawk Blue", context: "This samples the black Raven Guard palette within the three-Legion study. The Salamanders and Iron Hands recipes remain in the guide; a single pauldron does not represent all three." },
};

/**
 * These studies describe a contrast between materials rather than pauldron trim.
 * Sample that explicitly named material on the practice rim; do not infer a
 * shoulder scheme from the faction, or use a lens/accent colour as generic trim.
 */
const adaptedMaterials: Record<string, { area: string; foundation: string; highlight: string }> = {
  "tyranids-leviathan": { area: "carapace", foundation: "Foundation: the carapace plates", highlight: "Highlight: the carapace plates" },
  "orks-green-skin": { area: "painted armour", foundation: "Foundation: selected armour and weapon panels", highlight: "Highlight: selected armour and weapon panels" },
  "daemons-khorne-bloodletter": { area: "horns and claws", foundation: "Foundation: horns and claws", highlight: "Highlight: horns and claws" },
  "daemons-nurgle-plaguebearer": { area: "horns, claws and teeth", foundation: "Foundation: horns, claws and teeth", highlight: "Highlight: horns, claws and teeth" },
  "daemons-tzeentch-horror": { area: "tongue", foundation: "Foundation: the tongue and selected magical accents", highlight: "Highlight: the tongue and selected magical accents" },
  "daemons-slaanesh-daemonette": { area: "claws and hair", foundation: "Foundation: claws and hair", highlight: "Highlight: claws and hair" },
  "mechanicus-mars": { area: "exposed machinery", foundation: "Foundation: mechanical legs, mask and weapon fittings", highlight: "Highlight: mechanical legs, mask and weapon fittings" },
  "astra-militarum-cadian": { area: "fatigues", foundation: "Foundation: fatigues", highlight: "Highlight: fatigues" },
  "genestealer-cults-four-armed": { area: "purple cloth", foundation: "Foundation: the purple cloth", highlight: "Highlight: the purple cloth" },
  "heresy-imperialis-militia": { area: "khaki cloth", foundation: "Khaki cloth", highlight: "Cloth light" },
};

const metallicPaints = new Set([
  "Leadbelcher", "Iron Warriors", "Ironbreaker", "Stormhost Silver", "Grey Knights Steel",
  "Retributor Armour", "Liberator Gold", "Auric Armour Gold", "Balthasar Gold", "Sycorax Bronze",
  "Runelord Brass", "Canoptek Alloy",
]);

const powerArmourFactions = new Set([
  "Ultramarines", "Salamanders", "Dark Angels", "Blood Angels", "White Scars", "Imperial Fists",
  "Space Wolves", "Iron Hands", "Raven Guard", "Black Templars", "Deathwatch", "Grey Knights",
  "Chaos Space Marines", "Black Legion", "Death Guard", "Thousand Sons", "World Eaters", "Emperor's Children",
  "Iron Warriors", "Night Lords", "Sons of Horus", "Word Bearers", "Alpha Legion", "Blackshields", "Shattered Legions",
]);

const roles = (paint: GuidePaint) => paint.role.split(";").map((role) => role.trim());
const hasRole = (paint: GuidePaint, pattern: RegExp) => roles(paint).some((role) => pattern.test(role));
const metalness = (paint: GuidePaint) => metallicPaints.has(paint.name) ? 0.65 : 0;

/** Every displayed colour comes from this guide, never from a generic faction lookup. */
export function getGuidePauldronStudy(guide: Guide): GuidePauldronStudy {
  const selection = selections[guide.id];
  const representation = powerArmourFactions.has(guide.faction.replaceAll("’", "'")) ? "armour-palette" : "palette-adaptation";
  const adaptedMaterial = representation === "palette-adaptation" ? adaptedMaterials[guide.id] : undefined;
  const byName = (name: string) => {
    const paint = guide.paints.find((candidate) => candidate.name === name);
    if (!paint) throw new Error(`${guide.id}: missing pauldron palette paint ${name}`);
    return paint;
  };
  const byRole = (role: string) => {
    const paint = guide.paints.find((candidate) => roles(candidate).includes(role));
    if (!paint) throw new Error(`${guide.id}: missing pauldron material role ${role}`);
    return paint;
  };
  const fromStep = (techniques: string[], reverse = false) => {
    const steps = reverse ? [...guide.steps].reverse() : guide.steps;
    for (const step of steps) {
      if (!techniques.includes(step.technique)) continue;
      const paint = step.paintIds.map((id) => guide.paints.find((candidate) => candidate.id === id))
        .find((candidate) => candidate && !/primer|base texture|varnish/i.test(candidate.role));
      if (paint) return paint;
    }
  };
  const plate = selection ? byName(selection.plate)
    : guide.paints.find((paint) => hasRole(paint, /^Main colour recovery$/i))
      ?? guide.paints.find((paint) => hasRole(paint, /^Main foundation$/i))
      ?? fromStep(["basecoat"])
      ?? guide.paints.find((paint) => !/primer|base texture|varnish/i.test(paint.role));
  if (!plate) throw new Error(`${guide.id}: no paint available for the pauldron palette`);

  // Ornament is mapped only to the skull unless the guide calls it trim.
  const trim = selection?.trim ? byName(selection.trim)
    : guide.paints.find((paint) => hasRole(paint, /^Foundation: .*trim/i))
      ?? (adaptedMaterial ? byRole(adaptedMaterial.foundation) : plate);
  const detail = selection?.detail ? byName(selection.detail)
    : guide.paints.find((paint) => hasRole(paint, /^Foundation: .*bone/i))
      ?? guide.paints.find((paint) => hasRole(paint, /^Foundation: .*ornament/i))
      ?? trim;
  const shade = selection?.shade === null ? plate
    : selection?.shade ? byName(selection.shade)
      : guide.paints.find((paint) => hasRole(paint, /^Main recess shade$/i))
        ?? (!guide.scheme && !selection ? fromStep(["wash"]) : undefined)
        ?? plate;
  const highlight = selection?.highlight ? byName(selection.highlight)
    : guide.paints.find((paint) => hasRole(paint, /^Finest light$/i))
      ?? guide.paints.find((paint) => hasRole(paint, /^First highlight$/i))
      ?? fromStep(["highlight", "drybrush"], true)
      ?? plate;
  const trimHighlight = selection?.trimHighlight ? byName(selection.trimHighlight)
    : trim === plate ? highlight
      : guide.paints.find((paint) => hasRole(paint, /^Highlight: .*trim/i))
        ?? (adaptedMaterial ? byRole(adaptedMaterial.highlight) : trim);
  const assignment = (label: GuidePauldronAssignment["label"], regions: number[], paint: GuidePaint, reason: string): GuidePauldronAssignment => ({
    label, regions, paintId: paint.id, name: paint.name, hex: paint.hex, reason,
  });

  return {
    id: guide.id,
    name: guide.scheme ?? guide.title,
    label: "Layer palette study",
    note: "This guide’s palette, adapted to a practice pauldron.",
    context: [
      representation === "palette-adaptation" ? "This practice sculpt is a colour reference, not a model of this faction's armour or anatomy." : "The sculpt and its ornament are a practice surface, not a claim about armour pattern, rank or shoulder markings.",
      selection?.context,
      adaptedMaterial ? `The practice rim samples the guide's ${adaptedMaterial.area} colour to show the material contrast; this is not a faction shoulder marking.` : undefined,
      "Rivets follow the trim. The skull uses the guide's bone or ornament colour where present, otherwise the trim colour. These placements are Layer choices.",
    ].filter(Boolean).join(" "),
    representation,
    primer: getGuidePrimer(guide),
    palette: {
      plate: plate.hex, trim: trim.hex, skull: detail.hex, shade: shade.hex,
      highlight: highlight.hex, trimHighlight: trimHighlight.hex,
      metalness: metalness(trim), plateMetalness: selection?.metallicPlate ? 0.65 : metalness(plate), skullMetalness: metalness(detail),
    },
    assignments: [
      assignment("Plate", [0, 5, 6], plate, `The guide's ${plate.role.toLowerCase()} colour, adapted to the broad practice surface.`),
      assignment("Trim", [1, 2, 3], trim, trim === plate ? "The plate colour continues across the rim and rivets; this guide does not assign them a separate trim paint." : `The guide's ${trim.role.toLowerCase()} colour, adapted to the rim, band and rivets.`),
      assignment("Details", [4], detail, detail === trim ? "The skull follows the trim colour as a Layer display choice." : `The guide's ${detail.role.toLowerCase()} colour, adapted to the skull as a Layer display choice.`),
    ],
    sources: guide.sources,
  };
}
