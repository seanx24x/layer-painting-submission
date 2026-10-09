import { paintBrands, type PaintRecord } from "./paint-types";

export const normalisePaintText = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bcolour\b/g, "color")
    .replace(/[^a-z0-9 ]/g, "");

export interface PaintFilters {
  query?: string;
  brand?: string;
  range?: string;
  sort?: "name" | "colour" | "code";
}

function colourOrder(hex: string | null): number {
  if (!hex) return 1000;
  const [r, g, b] = [1, 3, 5].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    delta = max - min;
  if (delta < 0.07) return 500 + (1 - (max + min) / 2) * 100;
  const hue =
    max === r
      ? ((g - b) / delta + 6) % 6
      : max === g
        ? (b - r) / delta + 2
        : (r - g) / delta + 4;
  return hue * 60 + (1 - (max + min) / 2) * 0.5;
}

export function filterPaints(
  paints: readonly PaintRecord[],
  filters: PaintFilters,
): PaintRecord[] {
  const tokens = normalisePaintText(filters.query ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const matches = paints.filter((paint) => {
    if (filters.brand && paint.brand !== filters.brand) return false;
    if (filters.range && paint.range !== filters.range) return false;
    const aliases =
      paintBrands.find((brand) => brand.name === paint.brand)?.aliases ?? "";
    const searchable = normalisePaintText(
      [
        paint.name,
        paint.code,
        paint.brand,
        paint.range,
        paint.finish,
        aliases,
      ].join(" "),
    );
    return tokens.every((token) => searchable.includes(token));
  });
  return matches.sort((a, b) => {
    if (filters.sort === "colour")
      return (
        colourOrder(a.swatch.hex) - colourOrder(b.swatch.hex) ||
        a.name.localeCompare(b.name)
      );
    if (filters.sort === "code")
      return (
        a.brand.localeCompare(b.brand) ||
        (a.code ?? "\uffff").localeCompare(b.code ?? "\uffff", undefined, {
          numeric: true,
        }) ||
        a.name.localeCompare(b.name)
      );
    return (
      a.name.localeCompare(b.name) ||
      a.brand.localeCompare(b.brand) ||
      a.range.localeCompare(b.range)
    );
  });
}
