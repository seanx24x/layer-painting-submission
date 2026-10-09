import { groupGuidesByFaction } from "./guide-collection";
import { guideSetting, type Guide, type GuideSetting } from "./guides";

export type HeroGuideRequest = {
  faction: string;
  style: string;
  setting: GuideSetting;
  studySlug?: string;
};

const factionKey = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[‘’]/g, "'");

/** Resolve setting before style so changing era never opens a guide from another era. */
export function resolveHeroGuideSelection(guides: Guide[], request: HeroGuideRequest) {
  const groups = groupGuidesByFaction(guides);
  const group = groups.find(item => factionKey(item.faction) === factionKey(request.faction)) ?? groups[0];
  if (!group) return undefined;

  const settings = (["warhammer-40k", "horus-heresy"] as const).filter(setting => group.guides.some(guide => guideSetting(guide) === setting));
  const setting = settings.includes(request.setting) ? request.setting : settings[0];
  const settingGuides = group.guides.filter(guide => guideSetting(guide) === setting);
  const styles = [...new Set(settingGuides.map(guide => guide.style))];
  const style = styles.includes(request.style) ? request.style : styles.includes("classic") ? "classic" : styles[0];
  const studies = settingGuides.filter(guide => guide.style === style);
  const guide = studies.find(study => study.slug === request.studySlug) ?? studies[0];
  return { faction: group.faction, setting, style, settings, styles, studies, guide };
}
