type TileTechnique = "recess" | "drybrush";
export type TileStroke = {
  start: number; end: number; layer: number;
  from: readonly [number, number]; to: readonly [number, number]; width: number;
};
export function tilePaintStrokes(technique: TileTechnique): readonly TileStroke[] {
  if (technique === "recess") {
    const grooves = [-.48, -.16, .16, .48];
    return [
      ...grooves.map((x, i) => ({
        start: [2, 6, 11.2, 14.1][i], end: [5.3, 9.3, 13.5, 16.5][i], layer: i < 2 ? 0 : 1,
        from: [x, .60] as const, to: [x, -.60] as const, width: .052,
      })),
      ...grooves.map((x, i) => ({
        start: 17.8 + i * .88, end: 18.43 + i * .88, layer: 2,
        from: [x, .47] as const, to: [x, -.53] as const, width: .034,
      })),
    ];
  }
  return [.45, -.45, .15, -.15, .46, .18].map((y, i) => ({
    start: [2, 6, 11.2, 14.1, 17.8, 19.65][i],
    end: [5.3, 9.3, 13.5, 16.5, 19.18, 21.10][i],
    layer: Math.floor(i / 2),
    from: [i % 2 ? .76 : -.76, y] as const,
    to: [i % 2 ? -.76 : .76, y] as const,
    width: i > 3 ? .13 : .19,
  }));
}

