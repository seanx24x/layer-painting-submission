// Read-only, versioned catalogue. Import from server pages or build-time tooling only.
import ak from "@/data/paints/ak.json";
import citadel from "@/data/paints/citadel.json";
import vallejo from "@/data/paints/vallejo.json";
import armyPainter from "@/data/paints/army-painter.json";
import proAcryl from "@/data/paints/pro-acryl.json";
import type { PaintRecord } from "./paint-types";

export const paintCatalogue: PaintRecord[] = [
  ...ak,
  ...citadel,
  ...vallejo,
  ...armyPainter,
  ...proAcryl,
] as PaintRecord[];
