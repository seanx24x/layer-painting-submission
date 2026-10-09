import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { EquipmentProduct, EquipmentType } from "@/lib/equipment-types";

export function EquipmentDetails({ product, types }: { product: EquipmentProduct; types: EquipmentType[] }) {
  const relevant = types.filter(type => product.typeIds.includes(type.id));
  return <div className="equipment-detail">
    <p className="equipment-brand">{product.brand}{product.code ? ` · ${product.code}` : ""}</p>
    {relevant.map(type => <section key={type.id}><h3>{type.name}</h3><p>{type.purpose}</p><p className="equipment-selection">{type.selection}</p></section>)}
    {product.typeIds.some(id => id.includes("brush")) && <p className="equipment-callout">Brush size labels belong to each manufacturer. Compare the point, shape and dimensions, not the number alone.</p>}
    {!!Object.keys(product.specifications).length && <section><h3>Manufacturer specifications</h3><dl>{Object.entries(product.specifications).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></section>}
    {!!product.variants.length && <section><h3>Documented variants</h3><ul>{product.variants.map(v => <li key={v.label}>{v.label}{v.specifications && <span> · {Object.entries(v.specifications).map(([k,val])=>`${k}: ${val}`).join(" · ")}</span>}</li>)}</ul></section>}
    <section className="equipment-source"><h3>From the maker</h3><a href={product.sourceUrl} target="_blank" rel="noreferrer">Manufacturer listing <ExternalLink size={14} aria-hidden /></a>{product.documents.map(doc => <a key={doc.url} href={doc.url} target="_blank" rel="noreferrer">{doc.label} <ExternalLink size={14} aria-hidden /></a>)}<p>Source checked {product.checkedAt}. Specifications shown only where documented. Consult the maker for current variants, compatibility and care.</p></section>
  </div>;
}

export function EquipmentTypeGuidance({ type, products, guideSlug }: { type: EquipmentType; products: EquipmentProduct[]; guideSlug?: string }) {
  const candidates = products.filter(p => p.typeIds.includes(type.id));
  const seen = new Set<string>();
  const examples = candidates.filter(p => { if (seen.has(p.brand)) return false; seen.add(p.brand); return true; });
  return <section className="equipment-type-guidance"><h3>{type.name}</h3><p>{type.purpose}</p><p>{type.selection}</p>{examples.length ? <><h4>Product examples</h4><ul>{examples.slice(0,3).map(p => <li key={p.id}><Link href={`/equipment?type=${type.id}&item=${p.id}${guideSlug ? `&guide=${encodeURIComponent(guideSlug)}` : ""}`}>{p.brand} · {p.name} <span aria-hidden>↗</span></Link></li>)}</ul></> : <p className="quiet-note">{["water", "cloth"].includes(type.id) ? "A suitable household item is enough. Follow the guidance above." : "No branded example published yet. Follow your guide’s exact material requirements and the manufacturer’s compatibility instructions."}</p>}{examples.length > 0 && <Link className="inline-link" href={`/equipment?type=${type.id}${guideSlug ? `&guide=${encodeURIComponent(guideSlug)}` : ""}`}>Explore {type.name.toLowerCase()} →</Link>}</section>;
}
