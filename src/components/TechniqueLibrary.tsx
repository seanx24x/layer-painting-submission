import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TECHNIQUE_LESSONS, TECHNIQUE_LESSON_ORDER } from "@/lib/technique-lessons";
import { techniqueHref } from "@/lib/technique-navigation";
import { TechniqueCover } from "./TechniqueCover";
import "./technique-workbench.css";

export function TechniqueLibrary() {
  return <section className="technique-library" aria-labelledby="technique-library-title">
    <header className="technique-library-heading">
      <span className="eyebrow">The painting fundamentals</span>
      <h1 id="technique-library-title">Techniques</h1>
      <p>Interactive studies in light, colour and brush control. Try them here, then on your miniature.</p>
    </header>
    <div className="technique-library-grid">
      {TECHNIQUE_LESSON_ORDER.map((id, index) => {
        const lesson = TECHNIQUE_LESSONS[id];
        return <Link href={techniqueHref(id)} className={`technique-lesson-card${id === "light" ? " technique-lesson-card--foundation" : ""}`} key={id}>
          <div className="technique-lesson-art"><TechniqueCover technique={id} /></div>
          <div className="technique-lesson-copy">
            <span className="technique-lesson-meta">{id === "light" ? "Start with the light" : `Brush study ${String(index).padStart(2, "0")}`}<span>{lesson.chapters.length} chapters</span></span>
            <h2>{lesson.label}<ArrowRight size={23} aria-hidden /></h2>
            <p>{lesson.outcome}</p>
            {id === "light" && <span className="technique-lesson-cta">Place the light <ArrowRight size={16} aria-hidden /></span>}
          </div>
        </Link>;
      })}
    </div>
    <div className="technique-library-ending"><p>Ready to put a technique to work?</p><Link href="/#guides">Choose a faction study <ArrowRight size={16} aria-hidden /></Link></div>
  </section>;
}
