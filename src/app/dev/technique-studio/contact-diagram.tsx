import "./contact-diagram.css";

type ContactStudy = "layers" | "edges";

/** A still contact reference, independent of the paint-only demonstration. */
export function ContactDiagram({ study }: { study: ContactStudy }) {
  const layers = study === "layers";

  return (
    <details className="sculptural-contact">
      <summary>Brush contact <span aria-hidden="true" /></summary>
      <figure
        aria-label={layers
          ? "Thin layers: the brush is held at a low angle, its bristles lightly touching a broad surface. Pull along the surface, then lift."
          : "Edge highlights: the side of the bristles rests lightly against a raised ridge. The pointed tip extends beyond the ridge."}
      >
        <svg viewBox="0 0 280 166" aria-hidden="true" focusable="false">
          {layers ? (
            <>
              <path className="contact-surface" d="M28 122H252" />
              <path className="contact-surface-detail" d="M28 128H252" />
              <path className="contact-bristle-outline" d="M47 66C86 78 129 97 159 111C172 117 179 120 187 122C174 124 162 120 151 117C118 107 80 92 43 82" />
              <path className="contact-bristle" d="M47 70C93 85 143 109 178 121M46 74C87 89 135 110 172 121M45 78C84 94 126 110 164 119" />
              <circle className="contact-point" cx="182" cy="122" r="2.4" />
              <path className="contact-direction" d="M189 91H222Q238 91 238 75M233 80L238 75L243 80" />
            </>
          ) : (
            <>
              <path className="contact-surface" d="M40 146L171 112L246 146" />
              <path className="contact-surface-detail" d="M171 112V146" />
              <path className="contact-bristle-outline" d="M43 84C91 86 136 90 177 96C196 99 214 102 231 102C214 108 192 110 172 110C133 110 85 107 43 103" />
              <path className="contact-bristle" d="M43 89C104 91 160 100 223 104M43 94C107 97 165 104 216 106M43 99C98 103 153 108 203 108" />
              <circle className="contact-point" cx="171" cy="111" r="2.4" />
              <path className="contact-direction" d="M162 69L207 57M201 54L207 57L204 63" />
            </>
          )}
        </svg>
        <figcaption>{layers
          ? "A light touch. Pull, then lift."
          : "Use the side of the bristles. Keep pressure light."}</figcaption>
      </figure>
    </details>
  );
}
