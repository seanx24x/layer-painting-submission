"use client";

import { useDeferredValue, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { equipmentCategories, equipmentTypes, type EquipmentProduct } from "@/lib/equipment-types";
import { equipmentBrowseGroup, equipmentBrowseGroups } from "@/lib/equipment-browse";
import { emptyEquipmentFilters, filterEquipment } from "@/lib/equipment-search";
import { EQUIPMENT_PAGE_SIZE, equipmentLibraryHref, ownsEquipmentDialogEntry, readEquipmentLibraryUrl } from "@/lib/equipment-library-url";
import { Modal } from "./shared";
import { EquipmentDetails } from "./EquipmentDetails";
import "./equipment.css";

export function EquipmentLibrary({ products, guideLinks }: { products: EquipmentProduct[]; guideLinks: { slug: string; name: string }[] }) {
  const params = useSearchParams();
  const { filters, count, directory, item } = readEquipmentLibraryUrl(params, products);
  const group = equipmentBrowseGroup(filters.group);
  const deferredQuery = useDeferredValue(filters.q);
  const matches = filterEquipment(products, { ...filters, q: deferredQuery });
  const selected = products.find(product => product.id === item);
  const selectedType = equipmentTypes.find(type => type.id === filters.type);
  const returnGuide = guideLinks.find(guide => guide.slug === params.get("guide"));
  const heading = useRef<HTMLHeadingElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const nextPageFocus = useRef<number | null>(null);
  const headingFocus = useRef(false);
  const previousView = useRef({ directory });
  const lastGroup = useRef(filters.group);
  const brands = [...new Set(products.map(product => product.brand))].sort();
  const tasks = [...new Set(equipmentTypes.map(type => type.task))].sort();
  const topicTypes = equipmentTypes.filter(type => (!group || group.typeIds.includes(type.id)) && (!filters.category || type.category === filters.category));
  const refinementCount = [filters.category, filters.task, filters.brand].filter(Boolean).length;
  const explicitType = group?.typeIds.length === 1 ? "" : filters.type;
  const hasRefinements = [filters.q, filters.category, explicitType, filters.task, filters.brand].some(Boolean);

  useEffect(() => {
    if (nextPageFocus.current !== null) {
      grid.current?.querySelectorAll<HTMLButtonElement>(".equipment-card")[nextPageFocus.current]?.focus();
      nextPageFocus.current = null;
    }
    if (directory && !previousView.current.directory) {
      (document.getElementById(`equipment-topic-${lastGroup.current}`) ?? heading.current)?.focus();
    } else if (headingFocus.current || (!directory && previousView.current.directory && !filters.q)) {
      heading.current?.focus();
    }
    headingFocus.current = false;
    if (filters.group) lastGroup.current = filters.group;
    previousView.current = { directory };
  }, [count, directory, filters.group, filters.q]);

  function update(changes: Record<string, string>, replace = false) {
    window.history[replace ? "replaceState" : "pushState"](null, "", equipmentLibraryHref(window.location.search, changes));
  }
  function filter(key: string, value: string, replace = false) {
    update({ [key]: value, limit: "", item: "", all: "1", ...(key === "category" ? { type: "" } : {}) }, replace);
  }
  function browse(groupId: string) {
    const topic = equipmentBrowseGroup(groupId);
    headingFocus.current = true;
    update({ ...emptyEquipmentFilters, group: groupId, type: topic?.typeIds.length === 1 ? topic.typeIds[0] : "", limit: "", item: "", all: groupId ? "" : "1" });
  }
  function open(product: EquipmentProduct, button: HTMLButtonElement) {
    opener.current = button;
    const href = equipmentLibraryHref(window.location.search, { item: product.id });
    window.history.pushState({ layerEquipmentDialog: href }, "", href);
  }
  function close() {
    const href = `${window.location.pathname}${window.location.search}`;
    if (ownsEquipmentDialogEntry(window.history.state, href)) window.history.back();
    else update({ item: "" }, true);
  }
  function reset() {
    update({ ...emptyEquipmentFilters, group: filters.group ?? "", limit: "", item: "", all: "1" });
    search.current?.focus();
  }

  return <div className="equipment-library">
    {returnGuide && <Link className="back-link" href={`/guides/${returnGuide.slug}#tools`}><ArrowLeft size={16} /> Back to {returnGuide.name} preparation</Link>}
    {!directory && <button className="back-link equipment-back" onClick={() => update({ ...emptyEquipmentFilters, limit: "", item: "", all: "" })}><ArrowLeft size={16} /> All equipment categories</button>}
    <header className={`equipment-intro ${directory ? "" : "equipment-intro--topic"}`}>
      <div>
        <h1 ref={heading} tabIndex={-1}>{directory ? "Equipment" : group?.name ?? selectedType?.name ?? "All equipment"}</h1>
        <p>{directory ? "Find the right tool for your next layer. Start with what you use." : group?.description ?? selectedType?.purpose ?? "Explore tools, materials and the details that help you choose."}</p>
      </div>
      {directory && <p className="equipment-catalogue-size">{products.length} product families<br />{brands.length} makers · {products.reduce((sum, product) => sum + product.variants.length, 0)} documented variants</p>}
    </header>
      {group && topicTypes.length > 1 && <div className="equipment-tool-options" aria-label={`Types of ${group.name.toLowerCase()}`}>
        <button aria-pressed={!filters.type} onClick={() => filter("type", "")}>All {group.name.toLowerCase()}</button>
        {topicTypes.map(type => <button key={type.id} aria-pressed={filters.type === type.id} onClick={() => filter("type", filters.type === type.id ? "" : type.id)}>{type.name}</button>)}
      </div>}
    <div className="equipment-toolbar" key="equipment-toolbar">
    <div className="library-search equipment-search"><Search size={19} aria-hidden /><input ref={search} type="search" aria-label="Search equipment" placeholder={group ? `Search within ${group.name.toLowerCase()}…` : "Search tools, materials or makers…"} value={filters.q} onChange={event => filter("q", event.target.value, true)} /></div>
      {!directory && <>
      <details className="equipment-filter-disclosure">
        <summary><SlidersHorizontal size={16} aria-hidden /> Filters{refinementCount > 0 && <span>{refinementCount} active</span>}</summary>
        <div className="equipment-filters">
          {!group && <label>Tool type<select value={filters.type} onChange={event => filter("type", event.target.value)}><option value="">All tools</option>{topicTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>}
          <label>Workbench area<select value={filters.category} onChange={event => filter("category", event.target.value)}><option value="">Every area</option>{equipmentCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Task<select value={filters.task} onChange={event => filter("task", event.target.value)}><option value="">Every task</option>{tasks.map(task => <option key={task}>{task}</option>)}</select></label>
          <label>Maker<select value={filters.brand} onChange={event => filter("brand", event.target.value)}><option value="">All makers</option>{brands.map(brand => <option key={brand}>{brand}</option>)}</select></label>
        </div>
      </details>
      </>}
    </div>

    {directory ? <>
      <nav className="equipment-directory" aria-label="Browse equipment by tool">
        {equipmentBrowseGroups.map(topic => <button id={`equipment-topic-${topic.id}`} key={topic.id} className="equipment-topic" onClick={() => browse(topic.id)}>
          <span className="equipment-topic-name">{topic.name}<ArrowRight aria-hidden /></span>
          <span className="equipment-topic-description">{topic.description}</span>
        </button>)}
      </nav>
      <button className="text-button equipment-all" onClick={() => browse("")}>Browse all {products.length} product families <ArrowRight size={18} /></button>
    </> : <section className="equipment-results" aria-label="Equipment choices">
      {selectedType && <details className="equipment-choosing"><summary>Choosing {selectedType.name.toLowerCase()}</summary><p>{group && `${selectedType.purpose} `}{selectedType.selection}</p></details>}
      <div className="equipment-result-heading"><h2>Product examples</h2>{hasRefinements && <button className="text-button" onClick={reset}>Clear filters</button>}</div>
      <p className="equipment-result-count" role="status">{Math.min(count, matches.length)} of {matches.length} product families</p>
      {matches.length ? <div className="equipment-grid" ref={grid}>{matches.slice(0, count).map(product => {
        const type = equipmentTypes.find(type => type.id === product.typeIds[0])!;
        return <button className="equipment-card" key={product.id} data-equipment-id={product.id} aria-haspopup="dialog" onClick={event => open(product, event.currentTarget)}>
          <span className="equipment-brand">{product.brand}</span><strong>{product.name}</strong><span className="equipment-card-type">{type.name}</span>
          <span className="equipment-card-footer"><span>{product.code ?? "View product details"}{product.variants.length > 0 && <small>{product.variants.length} documented {product.variants.length === 1 ? "variant" : "variants"}</small>}</span><ArrowRight size={18} aria-hidden /></span>
        </button>;
      })}</div> : <div className="equipment-empty"><h3>No matching product families.</h3><p>{selectedType ? "Use the tool guidance above, or clear a filter to explore more examples. Some everyday tools do not need a branded purchase." : "Try a broader tool name, or clear a filter."}</p><button className="button secondary" onClick={reset}>Clear filters</button></div>}
      {count < matches.length && <div className="equipment-load"><button className="button secondary" onClick={() => { nextPageFocus.current = count; update({ limit: String(count + EQUIPMENT_PAGE_SIZE) }); }}>Load more <span aria-hidden>+</span></button></div>}
      {item && !selected && <p className="equipment-missing" role="status">That product is not in the current catalogue. <button className="text-button" onClick={() => update({ item: "" }, true)}>Dismiss</button></p>}
    </section>}

    <aside className="equipment-editorial"><h2>Start with what you own.</h2><div><p>A suitable equivalent is enough. These manufacturer-sourced examples help you choose a tool when you need one.</p><details><summary>About this library</summary><p>Names and published specifications are checked against manufacturer listings. Unknown specifications are omitted. Documented size and colour variants are grouped within product families. This is a curated selection, with no prices, paid rankings or affiliate links.</p><p>Specialist casting, printing and powered equipment is for browsing and research. Follow the manufacturer’s material, care and safety instructions.</p><a className="inline-link" href="https://blog.rosemaryandco.com/question/what-size-are-the-brushes/" target="_blank" rel="noreferrer">Why brush sizes differ between makers ↗</a></details></div></aside>
    <Modal open={!!selected} onOpenChange={open => { if (!open) close(); }} title={selected?.name ?? "Equipment"} description="A product example. Choose for the task and the materials you use." onCloseAutoFocus={event => { event.preventDefault(); (opener.current?.isConnected ? opener.current : heading.current)?.focus(); }}>{selected && <EquipmentDetails product={selected} types={equipmentTypes} />}</Modal>
  </div>;
}
