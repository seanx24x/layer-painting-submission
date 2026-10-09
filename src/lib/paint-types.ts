export interface PaintRecord {
  id: string;
  brand: string;
  range: string;
  name: string;
  code: string | null;
  finish: string | null;
  swatch: {
    hex: string | null;
    kind:
      "manufacturer-published" | "sampled-manufacturer-chart" | "unverified";
    sourceUrl: string;
    note: string;
  };
  sourceUrl: string;
  verifiedAt: string;
}

export const paintBrands = [
  {
    name: "AK Interactive",
    label: "AK Interactive",
    aliases: "ak 3gen 3rd generation third generation",
    source: "https://ak-interactive.com/",
  },
  {
    name: "Warhammer Colour",
    label: "Warhammer Colour",
    aliases: "citadel games workshop gw warhammer paints",
    source: "https://paint.warhammer.com/",
  },
  {
    name: "Vallejo",
    label: "Vallejo",
    aliases: "av acrylicos",
    source: "https://acrylicosvallejo.com/",
  },
  {
    name: "The Army Painter",
    label: "Army Painter",
    aliases: "army painter",
    source: "https://thearmypainter.com/pages/downloads",
  },
  {
    name: "Monument Hobbies",
    label: "Pro Acryl",
    aliases: "pro acryl pro acrylic proacryl monument hobbies",
    source: "https://monumenthobbies.com/pages/color-brochure",
  },
] as const;

export const swatchMethodLabel: Record<PaintRecord["swatch"]["kind"], string> =
  {
    "manufacturer-published": "Manufacturer digital colour",
    "sampled-manufacturer-chart": "Digitised manufacturer swatch",
    unverified: "Swatch not verified",
  };
