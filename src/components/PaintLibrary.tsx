"use client";

import { useDeferredValue, useEffect, useMemo, useRef, type ComponentProps, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ExternalLink, Search, X } from "lucide-react";
import type { PaintRecord } from "@/lib/paint-types";
import { paintBrands, swatchMethodLabel } from "@/lib/paint-types";
import { filterPaints } from "@/lib/paint-search";
import { PAINT_PAGE_SIZE, ownsPaintDialogEntry, paintLibraryHref, readPaintLibraryUrl } from "@/lib/paint-library-url";
import { Modal } from "./shared";

export function PaintInfoDialog({ paint, trigger, open, onOpenChange, onCloseAutoFocus }: {
  paint: PaintRecord;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<typeof Modal>["onCloseAutoFocus"];
}) {
  return (
    <Modal
      title={paint.name}
      description={`${paint.brand} · ${paint.range}${paint.code ? ` · ${paint.code}` : ""}`}
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      onCloseAutoFocus={onCloseAutoFocus}
    >
      <div
        className={`paint-detail-chip ${paint.swatch.hex ? "" : "unverified-chip"}`}
        style={paint.swatch.hex ? { background: paint.swatch.hex } : undefined}
        aria-label={
          paint.swatch.hex
            ? `${paint.name} digital swatch`
            : "No verified digital swatch"
        }
      />
      <dl className="paint-facts">
        <div>
          <dt>Product code</dt>
          <dd>{paint.code ?? "Not supplied in source"}</dd>
        </div>
        {paint.finish && (
          <div>
            <dt>Type / finish</dt>
            <dd>{paint.finish}</dd>
          </div>
        )}
        <div>
          <dt>Swatch source</dt>
          <dd>{swatchMethodLabel[paint.swatch.kind]}</dd>
        </div>
        {paint.swatch.hex && (
          <div>
            <dt>Display colour</dt>
            <dd>{paint.swatch.hex.toUpperCase()}</dd>
          </div>
        )}
        <div>
          <dt>Source checked</dt>
          <dd>{paint.verifiedAt}</dd>
        </div>
      </dl>
      <p className="paint-source-note">
        A screen reference, not a calibrated paint match. Finish, thinning,
        undercoat and lighting can change the result.
      </p>
      <div className="paint-source-links">
        <a href={paint.sourceUrl} target="_blank" rel="noreferrer">
          Product / catalogue source <ExternalLink size={13} />
        </a>
        {paint.swatch.sourceUrl !== paint.sourceUrl && (
          <a href={paint.swatch.sourceUrl} target="_blank" rel="noreferrer">
            Swatch source <ExternalLink size={13} />
          </a>
        )}
      </div>
      <details className="paint-method-details">
        <summary>How this swatch was captured</summary>
        <p className="paint-source-note">{paint.swatch.note}</p>
      </details>
    </Modal>
  );
}

export function PaintLibrary({ paints }: { paints: PaintRecord[] }) {
  const params = useSearchParams();
  const { query, brand, range, sort, visibleCount, item } = readPaintLibraryUrl(params, paints);
  const selected = paints.find(paint => paint.id === item);
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const nextPageFocus = useRef<number | null>(null);
  useEffect(() => {
    const index = nextPageFocus.current;
    if (index === null) return;
    nextPageFocus.current = null;
    gridRef.current
      ?.querySelectorAll<HTMLButtonElement>(".catalogue-paint")
      [index]?.focus();
  }, [visibleCount]);
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(
    () => filterPaints(paints, { query: deferredQuery, brand, range, sort }),
    [paints, deferredQuery, brand, range, sort],
  );
  const ranges = useMemo(
    () =>
      [
        ...new Set(
          paints
            .filter((paint) => !brand || paint.brand === brand)
            .map((paint) => paint.range),
        ),
      ].sort(),
    [paints, brand],
  );
  const stats = paintBrands.map((entry) => ({
    ...entry,
    count: paints.filter((paint) => paint.brand === entry.name).length,
  }));
  const totalSwatches = paints.filter((paint) => paint.swatch.hex).length;
  function update(changes: Record<string, string>, replace = false) {
    const href = paintLibraryHref(window.location.search, changes, window.location.hash);
    window.history[replace ? "replaceState" : "pushState"](null, "", href);
  }
  function filter(changes: Record<string, string>, replace = false) {
    update({ ...changes, limit: "", item: "" }, replace);
  }
  function openPaint(paint: PaintRecord, button: HTMLButtonElement) {
    opener.current = button;
    const href = paintLibraryHref(window.location.search, { item: paint.id }, window.location.hash);
    // Ownership belongs to this history entry, so Back/Forward and reload keep
    // close behavior correct. A shared direct link has no owned parent entry.
    window.history.pushState({ layerPaintDialog: href }, "", href);
  }
  function closePaint() {
    const href = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (ownsPaintDialogEntry(window.history.state, href)) window.history.back();
    else update({ item: "" }, true);
  }
  function clear() {
    filter({ q: "", brand: "", range: "" });
    searchRef.current?.focus();
  }
  return (
    <section className="paint-library">
      <div className="library-intro">
        <div>
          <h1>Paints</h1>
          <p className="lede">
            Find a paint by name, colour or product code. Every reference has a source.
          </p>
        </div>
        <div className="library-count">
          <strong>{paints.length.toLocaleString()}</strong>
          <span>
            paints across {stats.filter((item) => item.count).length} brands
          </span>
        </div>
      </div>
      <div className="library-search">
        <Search size={20} aria-hidden />
        <label className="sr-only" htmlFor="paint-search">
          Search paints by name, code or brand
        </label>
        <input
          ref={searchRef}
          id="paint-search"
          type="search"
          value={query}
          placeholder="Try Macragge Blue, 70.950 or Pro Acryl"
          onChange={(event) => {
            filter({ q: event.target.value }, true);
          }}
          autoComplete="off"
        />
        {query && (
          <button
            className="icon-button"
            aria-label="Clear paint search"
            onClick={() => {
              filter({ q: "" });
              searchRef.current?.focus();
            }}
          >
            <X size={17} />
          </button>
        )}
      </div>
      <div className="brand-filters" aria-label="Filter paint brands">
        <button
          className={!brand ? "selected" : ""}
          aria-pressed={!brand}
          onClick={() => {
            filter({ brand: "", range: "" });
          }}
        >
          All paints <span>{paints.length}</span>
        </button>
        {stats.map((entry) => (
          <button
            key={entry.name}
            className={brand === entry.name ? "selected" : ""}
            aria-pressed={brand === entry.name}
            onClick={() => {
              filter({ brand: entry.name, range: "" });
            }}
          >
            {entry.label}
            <span>{entry.count}</span>
          </button>
        ))}
      </div>
      <div className="catalogue-toolbar">
        <div className="catalogue-results"><p role="status" aria-live="polite">
          {filtered.length.toLocaleString()}{" "}
          {filtered.length === 1 ? "paint" : "paints"}
          {deferredQuery && <> for “{deferredQuery}”</>}
        </p>{(query || brand || range) && <button className="text-button" onClick={clear}>Clear filters <X size={12} aria-hidden /></button>}</div>
        <div>
          <label className="mobile-maker-filter">Maker <select value={brand} onChange={event => filter({ brand: event.target.value, range: "" })}><option value="">All makers</option>{stats.map(entry => <option key={entry.name} value={entry.name}>{entry.label}</option>)}</select></label>
          <label>
            Range{" "}
            <select
              value={range}
              onChange={(event) => {
                filter({ range: event.target.value });
              }}
            >
              <option value="">All ranges</option>
              {ranges.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            Sort{" "}
            <select
              value={sort}
              onChange={(event) => {
                filter({ sort: event.target.value });
              }}
            >
              <option value="name">Name</option>
              <option value="colour">Colour</option>
              <option value="code">Product code</option>
            </select>
          </label>
        </div>
      </div>
      <p className="catalogue-swatch-note">Screen swatches are references, not calibrated paint matches. Open a colour for its source and finish.</p>
      {filtered.length ? (
        <div
          ref={gridRef}
          className="catalogue-grid"
          aria-busy={query !== deferredQuery}
        >
          {filtered.slice(0, visibleCount).map((paint) => (
            <button
              key={paint.id}
              className="catalogue-paint"
              data-paint-id={paint.id}
              aria-haspopup="dialog"
              aria-label={`View ${paint.brand} ${paint.name}, ${paint.range}${paint.code ? `, ${paint.code}` : ""}`}
              onClick={event => openPaint(paint, event.currentTarget)}
            >
              <span className={`catalogue-chip ${paint.swatch.hex ? "" : "unverified-chip"}`} style={paint.swatch.hex ? { background: paint.swatch.hex } : undefined} aria-hidden="true">
                {!paint.swatch.hex && <span>No verified swatch</span>}
              </span>
              <span className="catalogue-brand">{paintBrands.find(brand => brand.name === paint.brand)?.label ?? paint.brand}</span>
              <strong>{paint.name}</strong>
              <span className="catalogue-meta"><span>{paint.range}</span><span>{paint.code ?? "No chart code"}</span></span>
            </button>
          ))}
        </div>
      ) : (
        <div className="catalogue-empty">
          <h2>No colours found.</h2>
          <p>Try a shorter name, product code, or a different range.</p>
          <button className="secondary-button" onClick={clear}>
            Clear filters
          </button>
        </div>
      )}
      {visibleCount < filtered.length && (
        <div className="catalogue-more">
          <p className="quiet-note" role="status">
            Showing {Math.min(visibleCount, filtered.length)} of{" "}
            {filtered.length} paints
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              nextPageFocus.current = visibleCount;
              update({ limit: String(visibleCount + PAINT_PAGE_SIZE) });
            }}
          >
            Show {Math.min(PAINT_PAGE_SIZE, filtered.length - visibleCount)} more
            colours
          </button>
        </div>
      )}
      {item && !selected && <p role="status">That paint is not in the current catalogue. <button className="text-button" onClick={() => { update({ item: "" }, true); searchRef.current?.focus(); }}>Dismiss</button></p>}
      {selected && <PaintInfoDialog paint={selected} open onOpenChange={open => { if (!open) closePaint(); }} onCloseAutoFocus={event => {
        event.preventDefault();
        const matchingCard = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>(".catalogue-paint") ?? []).find(button => button.dataset.paintId === selected.id);
        (opener.current?.isConnected && opener.current.dataset.paintId === selected.id ? opener.current : matchingCard ?? searchRef.current)?.focus();
      }} />}
      <details className="catalogue-provenance">
        <summary>
          About this colour reference{" "}
          <span>{totalSwatches.toLocaleString()} sourced swatches</span>
        </summary>
        <div>
          <p>
            Names, product codes and swatches come from manufacturer catalogues,
            charts or product pages. Open any paint to see its exact source and
            how its swatch was obtained. A source check date records when we
            checked the reference, not when a paint was released or whether it
            is in stock.
          </p>
          <p>
            These are the documented ranges in this edition, not every paint
            each company has ever made. Warhammer Colour is also searchable as
            Citadel; Pro Acryl is made by Monument Hobbies. Transparent, wash,
            effect and metallic colours need particular care: a flat screen
            swatch does not reproduce their physical finish.
          </p>
          <p>
            Colour sorting uses the digital swatches. It does not establish
            equivalent paints or interchangeable recipes between brands.
          </p>
          <div className="catalogue-brand-sources">
            {stats.map((entry) => (
              <a
                key={entry.name}
                href={entry.source}
                target="_blank"
                rel="noreferrer"
              >
                {entry.label} <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>
      </details>
    </section>
  );
}
