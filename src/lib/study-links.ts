/** Carry a material choice back to an authored painting step, never another site. */
export function materialReturnHref(href: string | undefined, materialId?: string) {
  if (!href || !/^\/paint\/[a-z0-9-]+(?:\?step=[a-z0-9-]+)?$/.test(href)) return undefined;
  if (!materialId) return href;
  return `${href}${href.includes("?") ? "&" : "?"}material=${encodeURIComponent(materialId)}`;
}
