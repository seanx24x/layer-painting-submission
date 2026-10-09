"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowDown, ArrowRight, Bookmark, Layers2 } from "lucide-react";
import { guides, getGuide, guideSetting, settingLabels } from "@/lib/guides";
import { usePractice } from "./PracticeProvider";
import { LibraryLoading } from "./LibraryLoading";
import { ColourStrip, Modal } from "./shared";
import { PaletteSphere } from "./PaletteSphere";
import { hasPracticeActivity } from "@/lib/practice-progress";
import { getGuidePaintMaterials } from "@/lib/guide-primer";
import "./site-refinement.css";

import type { GuideEquipment } from "./GuideToolHelp";

// Keep each view's controls and teaching code out of unrelated routes. Default
// SSR remains enabled so direct visits retain their rendered page content.
const Discover = dynamic(() => import("./Discover").then(module => module.Discover), {
  loading: () => <LibraryLoading title="Guides" />,
});
const GuideOverview = dynamic(() => import("./GuideOverview").then(module => module.GuideOverview), {
  loading: () => <LibraryLoading title="Your study" />,
});
const Painting = dynamic(() => import("./Painting").then(module => module.Painting), {
  loading: () => <LibraryLoading title="Your painting table" />,
});

type View = "discover" | "guide" | "paint" | "saved" | "paints" | "techniques" | "equipment";

function StorageNotice() {
  const { error, retry, reset } = usePractice();
  const replacementResult = useRef<boolean | null>(null);
  function focusContent() {
    const target = document.querySelector<HTMLElement>("#main h1") ?? document.querySelector<HTMLElement>("#main");
    if (!target) return;
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }
  if (!error) return null;
  const needsReset = [
    "invalid-data",
    "version-mismatch",
    "read-failed",
  ].includes(error.code);
  return (
    <div className="storage-notice" id="practice-save-notice" tabIndex={-1} role="alert">
      <p>
        <strong>Saving needs attention.</strong> {error.message} Current changes
        stay open in this session.
      </p>
      <button onClick={() => { if (retry()) requestAnimationFrame(focusContent); }} className="text-button">
        Try again
      </button>
      {needsReset && (
        <Modal
          title="Replace unreadable saved practice?"
          description="This replaces the saved practice on this device with the work currently open. Previous unreadable progress cannot be restored by Layer."
          trigger={<button className="text-button">Start fresh</button>}
          onCloseAutoFocus={(event) => {
            const saved = replacementResult.current;
            replacementResult.current = null;
            // Cancellation uses Radix's normal trigger restoration. Only this
            // explicit replacement attempt may choose a different destination.
            if (saved === null) return;
            event.preventDefault();
            requestAnimationFrame(() => {
              if (saved) { focusContent(); return; }
              const retryButton = document.querySelector<HTMLButtonElement>(".storage-notice > button");
              if (retryButton) retryButton.focus();
              else focusContent();
            });
          }}
        >
          <Dialog.Close asChild>
            <button className="button" onClick={() => { replacementResult.current = reset(); }}>
              Replace saved practice
            </button>
          </Dialog.Close>
        </Modal>
      )}
    </div>
  );
}

function Saved() {
  const { sessions, ready } = usePractice();
  const saved = guides.filter((guide) => sessions[guide.id]).sort((a, b) => {
    const aSession = sessions[a.id];
    const bSession = sessions[b.id];
    return (
      Number(!!aSession.completedAt) - Number(!!bSession.completedAt) ||
      bSession.updatedAt.localeCompare(aSession.updatedAt)
    );
  });
  return (
    <section className="saved-section">
      <div className="saved-heading">
        <div>
          <h1>My table</h1>
          <p className="lede">Keep your studies, materials and notes together on this device.</p>
        </div>
        {ready && saved.length > 0 && (
          <Link href="/#guides" className="secondary-button">
            Find a study <ArrowRight size={16} aria-hidden />
          </Link>
        )}
      </div>
      {!ready ? (
        <p role="status">Restoring your practice…</p>
      ) : saved.length ? (
        <div className="saved-session-list">
          {saved.map((guide) => {
            const session = sessions[guide.id];
            const started = hasPracticeActivity(session, guide.steps[0].id);
            const currentStep =
              guide.steps.find((step) => step.id === session.currentStepId) ?? guide.steps[0];
            // Notes have no edit timestamps. Prefer the current step rather than inventing recency.
            const noteStep = session.notes[currentStep.id]?.trim()
              ? currentStep
              : guide.steps.findLast((step) => session.notes[step.id]?.trim());
            return (
              <article key={guide.id} className="saved-session">
                <div className="saved-session-palette" aria-hidden="true">
                  <PaletteSphere guide={guide} caption={false} />
                </div>
                <div className="saved-session-detail">
                  <Link href={`/guides/${guide.slug}`} aria-label={`${guide.faction}: ${guide.scheme ?? guide.style}`}><h2>{guide.faction}</h2></Link>
                  <p className="saved-session-meta">
                    {settingLabels[guideSetting(guide)]} / {guide.scheme ?? guide.style}
                    <span className={session.completedAt ? "complete" : ""}>
                      {session.completedAt ? "Study complete" : started ? "In progress" : "Preparing"}
                    </span>
                  </p>
                  <p className="saved-current-step">
                    {session.completedAt
                      ? "Every step complete."
                      : started ? currentStep.title : "Gather your paints and tools."}
                  </p>
                  <div className="saved-session-progress">
                    <ColourStrip guide={guide} maxVisible={6} />
                    <span>{started ? `${session.completedStepIds.length} of ${guide.steps.length} steps completed` : `${session.preparedIds.length} of ${getGuidePaintMaterials(guide).length + guide.tools.length} materials ready`}</span>
                  </div>
                  {noteStep && (
                    <div className="saved-note">
                      <span>Your note on {noteStep.title.toLowerCase()}</span>
                      <p>{session.notes[noteStep.id]}</p>
                      <Link className="saved-note-link" href={`/paint/${guide.slug}?step=${noteStep.id}&note=1`}>Open this note <ArrowRight size={13} aria-hidden /></Link>
                    </div>
                  )}
                </div>
                <div className="saved-session-action">
                  <Link className="button" href={session.completedAt ? `/paint/${guide.slug}` : started ? `/paint/${guide.slug}?step=${currentStep.id}` : `/guides/${guide.slug}#materials`}>
                    {session.completedAt ? "Review study" : started ? "Resume" : "Prepare"}<ArrowRight size={16} aria-hidden />
                  </Link>
                  {started && <Link href={`/guides/${guide.slug}#materials`} className="small-link">Check materials</Link>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="saved-empty">
          <Bookmark size={32} />
          <h2>Choose your first study.</h2>
          <p>
            Find a guide and gather your paints. Your progress will appear here
            when you begin.
          </p>
          <Link className="button" href="/#guides">
            Explore the guides <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </section>
  );
}

export default function LayerApp({
  view,
  guideSlug,
  equipment,
  children,
}: {
  view: View;
  guideSlug?: string;
  equipment?: GuideEquipment;
  children?: React.ReactNode;
}) {
  const { sessions } = usePractice();
  const guide = guideSlug ? getGuide(guideSlug) : undefined;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="wordmark" href="/" aria-label="Layer home">
          <Layers2 size={24} strokeWidth={2.2} />
          layer<span className="wordmark-period">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link
            href="/#guides"
            aria-current={view === "discover" ? "page" : view === "guide" || view === "paint" ? "location" : undefined}
          >
            Guides
          </Link>
          <Link
            href="/paints"
            aria-current={view === "paints" ? "page" : undefined}
          >
            Paints
          </Link>
          <Link href="/equipment" aria-current={view === "equipment" ? "page" : undefined}>Equipment</Link>
          <Link href="/techniques" className="techniques-nav" aria-current={view === "techniques" ? "page" : undefined}>
            Techniques
          </Link>
          <Link
            href="/saved"
            className="saved-link"
            aria-current={view === "saved" ? "page" : undefined}
          >
            <Bookmark size={15} />
            <span>My table</span>
            {Object.keys(sessions).length > 0 && (
              <span className="saved-count">
                {Object.keys(sessions).length}
              </span>
            )}
          </Link>
        </nav>
      </header>
      <StorageNotice />
      <main id="main" tabIndex={-1} className={`main-content view-${view}`}>
        {view === "discover" && <Discover />}
        {view === "guide" && guide && <GuideOverview guide={guide} equipment={equipment} />}
        {view === "paint" && guide && <Painting guide={guide} />}
        {view === "saved" && <Saved />}
        {children}
      </main>
      <footer className="site-footer">
        <Link className="wordmark" href="/">
          layer.
        </Link>
        <a href="#main" className="back-top" aria-label="Back to top">
          <ArrowDown size={17} />
        </a>
      </footer>
    </div>
  );
}
