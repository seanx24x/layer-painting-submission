import type { Guide, GuidePaint } from "./guides";

export interface GuidePrimer extends GuidePaint {
  brand: string;
  range: string;
  sourceUrl: string;
  context: string;
  selection: "recipe" | "layer-choice";
  verifiedAt?: string;
}

type PrimerProduct = Omit<GuidePrimer, "context" | "selection">;
type Preparation = "black" | "grey" | "light-grey" | "white" | "warm-off-white";

const sprayReference = "https://www.warhammer-community.com/en-gb/articles/llZeorVj/a-new-era-of-paints-new-contrast-colours-reformulated-shades-and-our-best-white-spray-ever/";
const darkSprayReference = "https://www.warhammer-community.com/en-gb/articles/pjll9gb2/saturday-pre-orders-the-lion-brings-the-arks-of-omen-series-to-a-close/";

/**
 * Manufacturer articles verify the product names and spray/undercoat use.
 * They do not prescribe these products for every Layer guide. Screen swatches
 * are illustrative, including pot-colour chart references for matching names;
 * they are not measurements of the aerosol finish. No stock claim is made.
 */
const products: Record<Preparation, PrimerProduct> = {
  black: {
    id: "citadel-spray-chaos-black", name: "Chaos Black Spray", brand: "Warhammer Colour", range: "Spray primer",
    hex: "#17191C", role: "Preparation undercoat", sourceUrl: darkSprayReference,
    swatchKind: "illustrative-spray-colour", verifiedAt: "2026-10-09",
  },
  grey: {
    id: "citadel-spray-mechanicus-standard-grey", name: "Mechanicus Standard Grey Spray", brand: "Warhammer Colour", range: "Spray primer",
    hex: "#394447", role: "Preparation undercoat", sourceUrl: darkSprayReference,
    swatchKind: "illustrative-spray-colour", verifiedAt: "2026-10-09",
  },
  "light-grey": {
    id: "citadel-spray-grey-seer", name: "Grey Seer Spray", brand: "Warhammer Colour", range: "Spray primer",
    hex: "#ADADAD", role: "Preparation undercoat", sourceUrl: sprayReference,
    swatchKind: "illustrative-spray-colour", verifiedAt: "2026-10-09",
  },
  white: {
    id: "citadel-spray-white-scar", name: "White Scar Spray", brand: "Warhammer Colour", range: "Spray primer",
    hex: "#FFFFFF", role: "Preparation undercoat", sourceUrl: sprayReference,
    swatchKind: "illustrative-spray-colour", verifiedAt: "2026-10-09",
  },
  "warm-off-white": {
    id: "citadel-spray-wraithbone", name: "Wraithbone Spray", brand: "Warhammer Colour", range: "Spray primer",
    hex: "#DFD4AB", role: "Preparation undercoat", sourceUrl: sprayReference,
    swatchKind: "illustrative-spray-colour", verifiedAt: "2026-10-09",
  },
};

const isPrimerMaterial = (paint: GuidePaint) => /\bprimer\b/i.test(`${paint.role} ${paint.range ?? ""}`)
  || (/\bspray\b/i.test(`${paint.name} ${paint.range ?? ""}`) && /\bundercoat\b/i.test(paint.role));

function preparationText(guide: Guide): string {
  return [
    ...guide.prerequisites,
    ...guide.steps.filter((step) => /^(prepare|preparation|prime|primer|priming)$/.test(step.id))
      .flatMap((step) => [step.action, step.detail]),
  ].filter((text) => /\bprim(?:e|er|ed|ing)\b|\bundercoat/i.test(text)).join(" ");
}

function namedProduct(text: string): PrimerProduct | undefined {
  return Object.values(products).find((product) => {
    const name = product.name.replace(/ Spray$/, "");
    // A faction called White Scars or a pot elsewhere in the recipe is not a
    // named primer. Require an explicit preparation phrase around the product.
    return new RegExp(`\\b${name} (?:spray|primer|undercoat)\\b`, "i").test(text)
      || new RegExp(`\\b(?:prime(?:d)?|undercoat(?:ed)?) (?:with |using |in )${name}\\b`, "i").test(text);
  });
}

function specifiedPreparation(text: string): Preparation | undefined {
  if (/does not prescribe|no (?:specified|prescribed) primer|primer colou?r (?:is )?(?:unspecified|not specified)/i.test(text)) return undefined;
  if (/warm off[ -]white|bone(?:[ -]colou?red)? primer|primed (?:in )?bone|ivory primer/i.test(text)) return "warm-off-white";
  if (/white(?: or very light gr[ae]y)? (?:miniature )?primer|primed (?:in )?white\b/i.test(text)) return "white";
  if (/light gr[ae]y (?:miniature )?primer|primed (?:in )?light gr[ae]y/i.test(text)) return "light-grey";
  if (/black (?:miniature )?primer|primed (?:in )?black\b/i.test(text)) return "black";
  if (/gr[ae]y (?:miniature )?primer|primed (?:in )?(?:neutral |dark )?gr[ae]y\b/i.test(text)) return "grey";
  return undefined;
}

/** Select a real preparation product without changing the guide's lesson paints. */
export function getGuidePrimer(guide: Guide): GuidePrimer {
  const existing = guide.paints.find((paint) => {
    if (!isPrimerMaterial(paint)) return false;
    const placeholder = /^(?:(?:black|white|(?:light |dark |neutral )?gr[ae]y|bone|warm off-white) )?(?:miniature )?(?:spray )?primer(?: spray)?$/i.test(paint.name.trim());
    return !placeholder && Boolean(paint.sourceUrl || namedProduct(`${paint.name} ${paint.range ?? ""} ${paint.role}`));
  });
  if (existing) {
    const product = namedProduct(`${existing.name} ${existing.range ?? ""} ${existing.role}`);
    const sourceUrl = existing.sourceUrl ?? product?.sourceUrl;
    if (!sourceUrl) throw new Error(`${guide.id}: the named primer needs a product source`);
    return {
      ...existing,
      name: /\bspray\b/i.test(existing.range ?? "") && !/\bspray\b/i.test(existing.name) ? `${existing.name} Spray` : existing.name,
      brand: existing.brand ?? product?.brand ?? "",
      range: existing.range ?? product?.range ?? "Primer",
      sourceUrl,
      context: "Primer named in this guide’s preparation.",
      selection: "recipe",
      verifiedAt: product?.verifiedAt,
    };
  }

  const preparation = preparationText(guide);
  const named = namedProduct(preparation);
  if (named) return { ...named, context: "Primer named in this guide’s preparation.", selection: "recipe" };

  const colour = specifiedPreparation(preparation);
  const product = products[colour ?? "grey"];
  const colourLabel = colour === "warm-off-white" ? "warm off-white" : colour?.replaceAll("-", " ");
  return {
    ...product,
    context: colourLabel
      ? `Layer primer choice for this guide’s ${colourLabel} preparation.`
      : "Layer primer choice; this guide does not prescribe a primer colour.",
    selection: "layer-choice",
  };
}

/** Preparation materials include a primer; lesson recipes keep their original IDs. */
export function getGuidePaintMaterials(guide: Guide): GuidePaint[] {
  const primer = getGuidePrimer(guide);
  const existingIndex = guide.paints.findIndex((paint) => paint.id === primer.id);
  return existingIndex >= 0
    ? guide.paints.map((paint, index) => index === existingIndex ? primer : paint)
    : [primer, ...guide.paints];
}
