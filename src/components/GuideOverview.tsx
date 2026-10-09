"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { guideSetting, settingLabels, type Guide } from "@/lib/guides";
import { hasPracticeActivity } from "@/lib/practice-progress";
import { getGuidePaintMaterials, getGuidePrimer } from "@/lib/guide-primer";
import { usePractice } from "./PracticeProvider";
import { Sources, titleCase } from "./shared";
import { GuideToolHelp, type GuideEquipment } from "./GuideToolHelp";
import { PaletteSphere } from "./PaletteSphere";
import { GuidePauldronPreview } from "./GuidePauldronPreview";
import "./guide-preparation.css";

export function GuideOverview({ guide, equipment }: { guide: Guide; equipment?: GuideEquipment }) {
  const { sessions, ready, change } = usePractice();
  const session = sessions[guide.id];
  const paintMaterials = getGuidePaintMaterials(guide);
  const primer = getGuidePrimer(guide);
  const paintsReady = paintMaterials.filter((paint) =>
    session?.preparedIds.includes(paint.id),
  ).length;
  const toolsReady = guide.tools.filter((_, index) =>
    session?.preparedIds.includes(`tool-${index}`),
  ).length;
  const started = hasPracticeActivity(session, guide.steps[0].id);
  const deskReady =
    paintsReady === paintMaterials.length && toolsReady === guide.tools.length;
  const currentStep = guide.steps.find(
    (step) => step.id === session?.currentStepId,
  );
  const actionLabel = session?.completedAt
    ? "Review your study"
    : started
      ? "Continue painting"
      : "Start painting";
  const isArmourStudy = guide.id === "ultramarines-classic";
  const isPaletteStudy = Boolean(guide.scheme) && guide.style !== "grimdark" && guide.id !== "salamanders-classic";
  return (
    <>
      <Link className="back-link" href="/#guides">
        <ArrowLeft size={16} /> All guides
      </Link>
      <section
        className="overview-hero overview-hero--focused"
      >
        <div className="overview-intro">
          <span className="eyebrow">
            {settingLabels[guideSetting(guide)]} / {guide.faction}
          </span>
          <h1>{guide.faction}</h1>
          <p className="lede">
            {isArmourStudy
              ? "Turn flat blue armour into defined panels and crisp edges. Practise on one armour panel, with a brush and five paints."
              : guide.description}
          </p>
          <div className="guide-facts">
            <span>{guide.scheme ?? titleCase(guide.style)}</span>
            <span>{guide.steps.length} steps</span>
            <span>{paintMaterials.length - 1} paints + primer</span>
            <span>{guide.level}</span>
          </div>
          <ul className="learning-list">
            {guide.learning.map((item) => (
              <li key={item}>
                <Check size={16} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="overview-actions">
            <Link
              href={`/paint/${guide.slug}`}
              className={`button ${!ready ? "waiting" : ""}`}
              onClick={() => change(guide.id, { type: "start" })}
            >
              {actionLabel}
              <ArrowRight size={18} />
            </Link>
            <a className="text-button" href="#materials">
              Gather materials
            </a>
          </div>
          <Sources guide={guide} />
        </div>
        <div className="study-preview-board study-preview-board--palette" aria-label="Colours and focus for this study">
          <div className="study-preview-sphere">
            <PaletteSphere guide={guide} caption={false} />
          </div>
          <div className="study-preview-copy">
            <span className="eyebrow">{isPaletteStudy ? "Your palette" : "Your study"}</span>
            <h2>{guide.style === "grimdark" ? "Light, texture and atmosphere." : guide.id === "salamanders-classic" ? "Texture that catches the light." : guide.scheme ?? "A little control in every coat."}</h2>
            <p>{guide.style === "grimdark" ? "An intermediate armour exercise. Gather your airbrush and oil-painting materials before you begin." : guide.scheme ? "A complete palette, a clear sequence and a place to keep your own observations." : "Watch the movement on simple shapes, then practise the same control on your miniature."}</p>
            <span className="quiet-note">Digital palette illustration. Physical paint will vary.</span>
          </div>
        </div>
      </section>
      <GuidePauldronPreview key={guide.id} guide={guide} />
      <section
        className="palette-section"
        id="materials"
        aria-labelledby="palette-heading"
      >
        <div className="section-heading">
          <div>
            <h2 id="palette-heading">Your painting palette.</h2>
          </div>
        </div>
        <div className={`desk-readiness${ready && deskReady ? " is-ready" : ""}`}>
          <p className="palette-intro">
            {ready && deskReady
              ? "Paints and tools, ready for your next mark."
              : "Check off what’s on your desk, then make yourself comfortable."}
          </p>
          <div className="desk-readiness-counts" role="status" aria-live="polite" aria-atomic="true">
            {ready ? <>
              <span><Check size={14} aria-hidden /><strong>{paintsReady}/{paintMaterials.length}</strong> paints</span>
              <a href="#tools"><strong>{toolsReady}/{guide.tools.length}</strong> tools <ArrowRight size={13} aria-hidden /></a>
            </> : <span>Restoring your materials…</span>}
          </div>
        </div>
        <div className={`paint-grid${paintMaterials.length === 6 ? " paint-grid--six" : ""}`}>
          {paintMaterials.map((paint) => (
            <label
              className={`paint-swatch ${session?.preparedIds.includes(paint.id) ? "prepared" : ""}`}
              key={paint.id}
            >
              <input
                type="checkbox"
                aria-label={`${paint.name.replace("Citadel ", "")}, ready on your desk`}
                aria-describedby={`${guide.id}-${paint.id}-purpose`}
                disabled={!ready}
                checked={session?.preparedIds.includes(paint.id) ?? false}
                onChange={(event) =>
                  change(guide.id, {
                    type: "prepare",
                    preparedId: paint.id,
                    prepared: event.target.checked,
                  })
                }
              />
              <span className="swatch-colour" style={{ background: paint.hex }}>
                <span className="swatch-check">
                  <Check size={18} />
                </span>
              </span>
              <strong>{paint.name.replace("Citadel ", "")}</strong>
              <span className="guide-paint-meta">
                {paint.brand && <small className="guide-paint-brand">{paint.brand}</small>}
                {paint.range && <small className="guide-paint-type">{paint.range}</small>}
              </span>
              <span className="paint-role" id={`${guide.id}-${paint.id}-purpose`} title={paint.role}>{paint.role}</span>
            </label>
          ))}
        </div>
        <p className="palette-primer-note">{primer.context} <a href={primer.sourceUrl} target="_blank" rel="noreferrer">Primer details <span aria-hidden>↗</span></a></p>
      </section>
      <section className="preparation-section" aria-label="Equipment and chapters">
        <div className="guide-equipment">
          <div className="tools-heading" id="tools">
            <h2>Equipment</h2>
            <span>{ready ? `${toolsReady} of ${guide.tools.length} ready` : "Restoring…"}</span>
          </div>
          <div className="tools-list">
            {guide.tools.map((tool, index) => (
              <div key={tool} className="tool-checklist-row"><label className={session?.preparedIds.includes(`tool-${index}`) ? "is-ready" : undefined}>
                <input
                  type="checkbox"
                  disabled={!ready}
                  checked={
                    session?.preparedIds.includes(`tool-${index}`) ?? false
                  }
                  onChange={(event) =>
                    change(guide.id, {
                      type: "prepare",
                      preparedId: `tool-${index}`,
                      prepared: event.target.checked,
                    })
                  }
                />
                <span>{tool}</span>
              </label>
              {equipment && <GuideToolHelp tool={tool} equipment={equipment} guideSlug={guide.slug} />}
              </div>
            ))}
          </div>
        </div>
        <div className="stage-outline">
          <h2>Chapters</h2>
          <ol>
            {guide.steps.map((step, index) => (
              <li key={step.id}>
                <Link
                  href={`/paint/${guide.slug}?step=${step.id}`}
                  onClick={() =>
                    change(guide.id, { type: "navigate", stepId: step.id })
                  }
                  aria-label={`Open step ${index + 1}: ${step.title}${session?.completedStepIds.includes(step.id) ? ", completed" : ""}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.lookFor}</p>
                  </div>
                  {session?.completedStepIds.includes(step.id) ? (
                    <Check size={16} aria-label="Completed" />
                  ) : (
                    <ArrowRight size={16} aria-hidden />
                  )}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section
        className="preparation-footer"
        aria-label="Begin your painting session"
      >
        <div>
          <h2>
            {session?.completedAt
              ? "Your study is complete."
              : started
                ? "Pick up where you left off."
                : ready && deskReady
                  ? "Your desk is ready."
                  : "Ready for the first coat?"}
          </h2>
          <p>
            {session?.completedAt
              ? "Return to your notes, revisit a movement or practise the study again."
              : started && currentStep
                ? `Continue with “${currentStep.title}”. Your materials and notes will be there.`
                : ready && deskReady
                  ? "Watch the movement, notice the result, then try it with your own brush."
                  : "Still gathering materials? You can watch the demonstrations first and paint when you’re ready."}
          </p>
        </div>
        <Link
          href={`/paint/${guide.slug}`}
          onClick={() => change(guide.id, { type: "start" })}
          className={`button ${!ready ? "waiting" : ""}`}
        >
          {actionLabel}
          <ArrowRight size={18} />
        </Link>
      </section>
    </>
  );
}
