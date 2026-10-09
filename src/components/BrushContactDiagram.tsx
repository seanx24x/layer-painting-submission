import type { TechniqueId } from "@/lib/technique-study-types";
import "./brush-contact-diagram.css";

const contactCopy: Record<TechniqueId, { description: string; caption: string }> = {
  layers: {
    description: "Thin layers: the brush is held at a low angle, its bristles lightly touching a broad surface. Pull along the surface, then lift.",
    caption: "A light touch. Pull, then lift.",
  },
  edges: {
    description: "Edge highlights: the side of the bristles rests lightly against a raised ridge. The pointed tip extends beyond the ridge.",
    caption: "Use the side of the bristles. Keep pressure light.",
  },
  recess: {
    description: "Recess shading: only the pointed brush tip touches the recessed groove. Guide the tip along the groove, keeping paint off the surrounding surface.",
    caption: "Keep the tip in the groove. Guide a little shade along it.",
  },
  drybrush: {
    description: "Drybrushing: the ends of the bristles skim across the highest parts of a textured surface. The bristles pass over the low spaces without reaching into them.",
    caption: "Skim the raised texture. Leave the low places untouched.",
  },
};

function ContactDrawing({ technique }: { technique: TechniqueId }) {
  switch (technique) {
    case "layers":
      return <>
        <path className="brush-contact-surface" d="M28 122H252" />
        <path className="brush-contact-surface-detail" d="M28 128H252" />
        <path className="brush-contact-outline" d="M47 66C86 78 129 97 159 111C172 117 179 120 187 122C174 124 162 120 151 117C118 107 80 92 43 82" />
        <path className="brush-contact-bristles" d="M47 70C93 85 143 109 178 121M46 74C87 89 135 110 172 121M45 78C84 94 126 110 164 119" />
        <circle className="brush-contact-point" cx="182" cy="122" r="2.4" />
        <path className="brush-contact-direction" d="M189 91H222Q238 91 238 75M233 80L238 75L243 80" />
      </>;
    case "edges":
      return <>
        <path className="brush-contact-surface" d="M40 146L171 112L246 146" />
        <path className="brush-contact-surface-detail" d="M171 112V146" />
        <path className="brush-contact-outline" d="M43 84C91 86 136 90 177 96C196 99 214 102 231 102C214 108 192 110 172 110C133 110 85 107 43 103" />
        <path className="brush-contact-bristles" d="M43 89C104 91 160 100 223 104M43 94C107 97 165 104 216 106M43 99C98 103 153 108 203 108" />
        <circle className="brush-contact-point" cx="171" cy="111" r="2.4" />
        <path className="brush-contact-direction" d="M162 69L207 57M201 54L207 57L204 63" />
      </>;
    case "recess":
      return <>
        <path className="brush-contact-surface" d="M28 116H252M28 124H252" />
        <path className="brush-contact-surface-detail" d="M28 120H252" />
        <path className="brush-contact-outline" d="M65 45C89 60 117 81 140 98C151 106 162 115 169 120C160 117 148 111 136 104C111 89 85 69 55 59" />
        <path className="brush-contact-bristles" d="M63 49C96 69 132 100 164 117M60 53C92 71 125 97 160 115M57 56C89 74 122 100 153 111" />
        <circle className="brush-contact-point" cx="168" cy="120" r="2.4" />
        <path className="brush-contact-direction" d="M192 143H239M234 138L239 143L234 148" />
      </>;
    case "drybrush":
      return <>
        <path className="brush-contact-surface" d="M28 134H61V116H88V134H111V116H139V134H161V116H190V134H214V116H241V134H252" />
        <path className="brush-contact-outline" d="M61 58C87 73 112 89 131 107L139 114M85 44C118 58 154 81 186 106L198 114" />
        <path className="brush-contact-bristles" d="M65 56C92 72 119 94 143 115M70 53C103 70 131 94 152 115M75 50C110 69 140 93 162 115M80 47C116 67 151 91 175 115M84 46C124 66 162 89 186 115" />
        <circle className="brush-contact-point" cx="136" cy="116" r="2.2" />
        <circle className="brush-contact-point" cx="175" cy="116" r="2.2" />
        <path className="brush-contact-direction" d="M192 79H239M234 74L239 79L234 84" />
      </>;
  }
}

/** A still contact reference, independent of the paint-only demonstration. */
export function BrushContactDiagram({ technique }: { technique: TechniqueId }) {
  const copy = contactCopy[technique];
  return <details className="brush-contact-diagram">
    <summary>Brush contact <span aria-hidden="true" /></summary>
    <figure aria-label={copy.description}>
      <svg viewBox="0 0 280 166" aria-hidden="true" focusable="false">
        <ContactDrawing technique={technique} />
      </svg>
      <figcaption>{copy.caption}</figcaption>
    </figure>
  </details>;
}
