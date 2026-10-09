"use client";

import Link from "next/link";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowRight, Check, ChevronDown, ChevronRight } from "lucide-react";
import { guideSetting, settingLabels, type Guide } from "@/lib/guides";
import { guideCardDescription } from "@/lib/guide-card-copy";
import { hasPracticeActivity } from "@/lib/practice-progress";
import { usePractice } from "./PracticeProvider";
import { ColourStrip, GuideArtwork, Modal, titleCase } from "./shared";

export function GuideCard({ studies }: { studies: Guide[] }) {
  const [selectedId, setSelectedId] = useState("");
  const guide = studies.find((study) => study.id === selectedId) ?? studies[0];
  const { sessions } = usePractice();
  const saved = sessions[guide.id];
  const started = hasPracticeActivity(saved, guide.steps[0].id);
  return (
    <article className="guide-card">
      <Link
        href={`/guides/${guide.slug}`}
        className="art-link"
        aria-label={`Explore ${guide.faction}: ${guide.scheme ?? guide.style}`}
      >
        <GuideArtwork guide={guide} />
      </Link>
      <div className="card-meta">
        <span>
          {settingLabels[guideSetting(guide)]}
        </span>
        <span>{guide.steps.length} steps</span>
      </div>
      <Link href={`/guides/${guide.slug}`} className="card-title" aria-label={`${guide.faction}: ${guide.scheme ?? guide.style}`}>
        <h3>{guide.faction}</h3>
        <ArrowRight size={20} aria-hidden />
      </Link>
      {studies.length > 1 ? (
        <Modal
          trigger={<button className="card-study-picker" aria-label={`Choose a study for ${guide.faction}, currently ${guide.scheme ?? guide.style}`}><span>{guide.scheme ?? titleCase(guide.style)}</span><span>{studies.length} studies <ChevronDown size={13} aria-hidden /></span></button>}
          title={`${guide.faction} studies`}
          description="Choose a colour scheme or painting approach. The palette and walkthrough update to match."
        >
          <div className="option-list">
            {studies.map((study) => (
              <Dialog.Close asChild key={study.id}>
                <button className="select-option" aria-pressed={guide.id === study.id} onClick={() => setSelectedId(study.id)}>
                  <span><strong>{study.scheme ?? titleCase(study.style)}</strong><small>{settingLabels[guideSetting(study)]} · {study.title}</small></span>
                  {guide.id === study.id ? <Check size={20} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
                </button>
              </Dialog.Close>
            ))}
          </div>
        </Modal>
      ) : <p className="card-scheme">{guide.scheme ?? titleCase(guide.style)}</p>}
      <p className="card-outcome">{guideCardDescription(guide)}</p>
      <div className="card-bottom">
        <ColourStrip guide={guide} maxVisible={6} />
        {saved && (
          <Link href={started ? `/paint/${guide.slug}` : `/guides/${guide.slug}#materials`} className="small-link">
            {saved.completedAt ? "Review study" : started ? "Resume" : "Prepare"}
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </article>
  );
}
