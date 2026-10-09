import type { Guide } from "./guides";

/** Group after filtering so each card opens a study that matches the search. */
export function groupGuidesByFaction(studies: Guide[]) {
  const groups = new Map<string, { faction: string; guides: Guide[] }>();
  for (const guide of studies) {
    const key = guide.faction.normalize("NFKC").toLowerCase().replace(/[‘’]/g, "'");
    const group = groups.get(key);
    if (group) group.guides.push(guide);
    else groups.set(key, { faction: guide.faction, guides: [guide] });
  }
  return [...groups.values()];
}
