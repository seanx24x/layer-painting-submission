"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Bookmark, Check, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { guides, guideSetting, settingLabels, type GuideSetting } from "@/lib/guides";
import { groupGuidesByFaction } from "@/lib/guide-collection";
import { getGuidePaintMaterials } from "@/lib/guide-primer";
import { resolveHeroGuideSelection, type HeroGuideRequest } from "@/lib/hero-guide-selection";
import { usePractice } from "./PracticeProvider";
import { GuideCard } from "./GuideCard";
import { Modal, titleCase } from "./shared";
import { HeroSelector } from "./HeroSelector";
import "./technique-workbench.css";
import { TechniqueCover } from "./TechniqueCover";
import { hasPracticeActivity, latestMeaningfulSession } from "@/lib/practice-progress";

const factionGroups = groupGuidesByFaction(guides);
const techniqueCovers = [
  { id: "light", title: "Light & form", detail: "Choose where the light belongs.", surface: "Start here" },
  { id: "layers", title: "Thin layers", detail: "Build colour without losing detail.", surface: "Colour & coverage" },
  { id: "edges", title: "Edge highlights", detail: "Let the side of the brush find the edge.", surface: "Raised edges" },
  { id: "recess", title: "Recess shading", detail: "Place shadow exactly where it belongs.", surface: "Recessed detail" },
  { id: "drybrush", title: "Drybrushing", detail: "Catch the texture. Keep the depth.", surface: "Surface texture" },
] as const;
function StudySelector({
  value,
  label,
  description,
  options,
  onChange,
}: {
  value: string;
  label: string;
  description: string;
  options: { value: string; label: string; detail?: string }[];
  onChange: (value: string) => void;
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value;
  return (
    <Modal
      trigger={
        <button
          className="scheme-option"
          aria-label={`Choose ${label}, currently ${selectedLabel}`}
        >
          {selectedLabel}
          <ChevronDown aria-hidden size={25} />
        </button>
      }
      title={`Choose your ${label}`}
      description={description}
    >
      <div className="option-list">
        {options.map((option) => (
            <Dialog.Close asChild key={option.value}>
              <button
                className="select-option"
                aria-pressed={value === option.value}
                onClick={() => onChange(option.value)}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.detail && <small>{option.detail}</small>}
                </span>
                {value === option.value ? (
                  <Check size={20} aria-hidden />
                ) : (
                  <ChevronRight size={18} aria-hidden />
                )}
              </button>
            </Dialog.Close>
          ))}
      </div>
    </Modal>
  );
}

export function Discover() {
  const router = useRouter();
  const { sessions } = usePractice();
  const [heroRequest, setHeroRequest] = useState<HeroGuideRequest>({ faction: "Ultramarines", style: "classic", setting: "warhammer-40k" });
  const [filter, setFilter] = useState<GuideSetting | "all">("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(9);
  const searchInput = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const firstAddedIndex = useRef<number | null>(null);
  useEffect(() => {
    if (firstAddedIndex.current !== null) {
      results.current?.children[firstAddedIndex.current]?.querySelector("a")?.focus();
      firstAddedIndex.current = null;
    }
  }, [visibleCount]);
  const { faction, style, setting, styles, settings, studies, guide: chosenGuide } = resolveHeroGuideSelection(guides, heroRequest)!;
  function changeHero(patch: Partial<HeroGuideRequest>) {
    const next = resolveHeroGuideSelection(guides, { faction, style, setting, studySlug: chosenGuide.slug, ...patch })!;
    setHeroRequest({ faction: next.faction, style: next.style, setting: next.setting, studySlug: next.guide.slug });
  }
  const searchWords = query.normalize("NFKC").toLocaleLowerCase().replace(/[‘’]/g, "'").trim().split(/\s+/).filter(Boolean);
  const filtered = guides.filter((guide) => {
    if (filter !== "all" && guideSetting(guide) !== filter) return false;
    const text = [guide.title, guide.faction, guide.scheme, guide.style, settingLabels[guideSetting(guide)], ...guide.paints.map((paint) => paint.name)].join(" ").normalize("NFKC").toLocaleLowerCase().replace(/[‘’]/g, "'");
    return searchWords.every((word) => text.includes(word));
  }).toSorted((a, b) => Number(b.id === "ultramarines-classic") - Number(a.id === "ultramarines-classic"));
  const collection = groupGuidesByFaction(filtered);
  const latest = latestMeaningfulSession(Object.values(sessions), Object.fromEntries(guides.map(guide => [guide.id, guide.steps[0].id])));
  const resumeGuide =
    latest && guides.find((guide) => guide.id === latest.guideId);
  const resumeStep = resumeGuide?.steps.find((step) => step.id === latest?.currentStepId);
  const resumeStarted = resumeGuide && hasPracticeActivity(latest, resumeGuide.steps[0].id);
  function findGuide() {
    if (chosenGuide) router.push(`/guides/${chosenGuide.slug}`);

  }
  return (
    <>
      {resumeGuide && (
        <Link className="resume-strip" href={resumeStarted ? `/paint/${resumeGuide.slug}?step=${latest.currentStepId}` : `/guides/${resumeGuide.slug}#materials`}>
          <Bookmark size={19} aria-hidden />
          <span>
            <small>{resumeStarted ? "Continue your practice" : "On your painting table"}</small>
            <strong>{resumeGuide.faction} · {resumeGuide.scheme ?? titleCase(resumeGuide.style)}</strong>
            <span className="resume-step">{resumeStarted ? resumeStep?.title : "Gather your paints and tools, then begin."}</span>
          </span>
          <span>{resumeStarted ? `${latest.completedStepIds.length} of ${resumeGuide.steps.length} steps completed` : `${latest.preparedIds.length} of ${getGuidePaintMaterials(resumeGuide).length + resumeGuide.tools.length} materials ready`}</span>
          <ArrowRight size={20} aria-hidden />
        </Link>
      )}
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">
          I want to paint{" "}
          <HeroSelector
            label="faction"
            value={faction}
            options={factionGroups.map((group) => ({ value: group.faction, detail: [...new Set(group.guides.map((guide) => settingLabels[guideSetting(guide)]))].join(" · ") }))}
            onChange={(value) => changeHero({ faction: value, studySlug: "" })}
          />{" "}
          in&nbsp;the{" "}
          <HeroSelector
            label="style"
            value={style}
            options={styles.map((value) => ({ value, detail: value === "grimdark" ? "Intermediate study using an airbrush and oils" : "Brush practice in colour, shadow and readable highlights" }))}
            onChange={(value) => changeHero({ style: value, studySlug: "" })}
          />{" "}
          style.
        </h1>
        <div className="hero-scheme"><span>Setting</span>{settings.length > 1 ? <StudySelector label="setting" description="Choose the setting for your painting study." value={setting} options={settings.map(value => ({ value, label: settingLabels[value] }))} onChange={value => changeHero({ setting: value as GuideSetting, studySlug: "" })} /> : <strong>{settingLabels[setting]}<span className="sr-only">, the available setting for {faction}</span></strong>}{studies.length > 1 && <><span>Study</span><StudySelector label="study" description="Choose a colour study within this setting and painting style." value={chosenGuide.slug} options={studies.map(guide => ({ value: guide.slug, label: guide.scheme ?? guide.title }))} onChange={value => changeHero({ studySlug: value })} /></>}</div>
        <div className="hero-bottom">
          <button className="button" onClick={findGuide}>
            Find my guide <ArrowRight size={18} />
          </button>
        </div>
      </section>
      <section className="guide-section" id="guides">
        <div className="section-heading">
          <div>
            <h2>Factions</h2>
          </div>
          <span className="section-aside">{factionGroups.length} factions · {guides.length} studies</span>
        </div>
        <p className="collection-intro">Explore the armies of the 41st Millennium and the Horus Heresy. Choose a faction, then a painting study. Each has its own palette, practical steps and sources.</p>
        <div className="collection-controls">
          <div className="filter-row" role="group" aria-label="Filter guides by universe">
            {(["all", "warhammer-40k", "horus-heresy"] as const).map((item) => (
              <button key={item} aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => { setFilter(item); setVisibleCount(9); }}>
                {item === "all" ? "All factions" : settingLabels[item]}
                <span>{groupGuidesByFaction(guides.filter((guide) => item === "all" || guideSetting(guide) === item)).length}</span>
              </button>
            ))}
          </div>
          <div className="collection-search">
            <Search size={17} aria-hidden />
            <input ref={searchInput} aria-label="Search guides" placeholder="Faction, scheme or paint…" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(9); }} />
            {query && <button className="icon-button" aria-label="Clear guide search" onClick={() => { setQuery(""); setVisibleCount(9); searchInput.current?.focus(); }}><X size={15} aria-hidden /></button>}
          </div>
        </div>
        <div className="collection-status" role="status" aria-live="polite">
          <span>{collection.length === 0 ? "No factions found" : `${Math.min(visibleCount, collection.length)} of ${collection.length} ${collection.length === 1 ? "faction" : "factions"}`}{query.trim() && ` for “${query.trim()}”`}</span>
        </div>
        <div className="guide-grid collection-grid" id="collection-results" ref={results}>
          {collection.slice(0, visibleCount).map((group) => <GuideCard key={group.faction} studies={group.guides} />)}
        </div>
        {collection.length === 0 && <div className="collection-empty"><h3>A different starting point?</h3><p>Try a faction name, a colour scheme or a paint you already own.</p><button className="secondary-button" onClick={() => { setQuery(""); setFilter("all"); searchInput.current?.focus(); }}>Show all factions <ArrowRight size={16} /></button></div>}
        {visibleCount < collection.length && <div className="collection-more"><button className="secondary-button" aria-controls="collection-results" onClick={() => { firstAddedIndex.current = visibleCount; setVisibleCount((count) => count + 9); }}>Show {Math.min(9, collection.length - visibleCount)} more {collection.length - visibleCount === 1 ? "faction" : "factions"} <ChevronDown size={16} aria-hidden /></button><span>{collection.length - visibleCount} more to explore</span></div>}
      </section>
      <section id="techniques" className="techniques-section technique-collection">
        <div>
          <h2>Techniques</h2>
          <p>
            Place the light. Find the right amount of paint. Practise the small
            movements that make a difference on your miniature.
          </p>
          <Link className="small-link" href="/techniques">Explore the technique studio <ArrowRight size={17} aria-hidden /></Link>
        </div>
        <div className="technique-card-grid technique-card-grid--five">
          {techniqueCovers.map((technique) => (
            <Link className="technique-card" key={technique.id} href={`/techniques/${technique.id}`}>
              <span className="technique-card-art" aria-hidden>
                <span className="technique-card-illustration"><TechniqueCover technique={technique.id} /></span>
              </span>
              <span className="technique-card-copy"><small>{technique.surface}</small><strong>{technique.title}<ArrowRight size={16} aria-hidden /></strong><span>{technique.detail}</span></span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
