# Paint catalogue imports

The application reads versioned JSON reference data from `src/data/paints`. This is a read-only catalogue, not an account or inventory database. Imports are explicit maintenance operations; live page requests never scrape a manufacturer's website.

Each paint carries stable identity, brand, range, source-published name/code, source URLs, a check date and swatch provenance. A display hex derived from a chart is labelled `sampled-manufacturer-chart`, including when the chart supplies vector colour fills. It is not represented as a calibrated paint measurement or an official published hex specification. No guessed colour fills may be inserted for missing swatches.

Run each manufacturer import script with `--help` for its inputs and options. The generated catalogue records carry their source URLs and swatch methods. Keep source PDFs or intermediate downloads under ignored `artifacts/`, not in the shipped web application. Preserve the official source links and record a source hash with import provenance when practical.

After updating a catalogue, run the guide-palette synchronization script (when changing Warhammer colours), `npm test`, `npm run typecheck`, and `npm run build`. A name/code mismatch or a nonunique match must be resolved explicitly rather than silently choosing the first paint with the same name. The UI keeps identical names from separate ranges as separate products.

This first edition prioritises documented paint ranges. It does not imply that every historical/new product or every auxiliary is included or currently in stock. No cross-brand equivalence is inferred from digital swatches.
