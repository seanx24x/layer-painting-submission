import assert from "node:assert/strict";
import { test } from "node:test";
import { equipmentProducts, equipmentForGuide } from "./equipment-catalogue";
import { equipmentCategories, equipmentTypes } from "./equipment-types";
import { guides } from "./guides";
import { guideToolTypes } from "./guide-equipment";
import { filterEquipment, emptyEquipmentFilters } from "./equipment-search";

test("catalogue references, identity, variant and provenance integrity",()=>{
  assert.equal(new Set(equipmentProducts.map(p=>p.id)).size,equipmentProducts.length);
  assert.equal(new Set(equipmentTypes.map(t=>t.id)).size,equipmentTypes.length);
  for(const type of equipmentTypes) assert.ok(equipmentCategories.some(c=>c.id===type.category));
  for(const product of equipmentProducts){
    assert.ok(product.name && product.brand && product.typeIds.length);
    assert.match(product.sourceUrl,/^https:\/\//);
    assert.match(product.checkedAt,/^\d{4}-\d{2}-\d{2}$/);
    for(const id of product.typeIds) assert.ok(equipmentTypes.some(t=>t.id===id),id);
    assert.equal(new Set(product.variants.map(v=>v.label)).size,product.variants.length);
    for(const value of Object.values(product.specifications)) assert.equal(typeof value,"string");
    for(const doc of product.documents) assert.match(doc.url,/^https:\/\//);
  }
});
test("all existing guide checklist entries have exact associations without mutating readiness keys",()=>{
  for(const guide of guides){
    const original=JSON.stringify(guide);
    const subset=equipmentForGuide(guide.tools);
    guide.tools.forEach((tool,index)=>{
      assert.ok(guideToolTypes[tool]?.length,`${guide.slug}: ${tool}`);
      for(const id of guideToolTypes[tool]) assert.ok(subset.types.some(t=>t.id===id));
      assert.equal(`tool-${index}`,`tool-${guide.tools.indexOf(tool)}`);
    });
    assert.equal(JSON.stringify(guide),original);
    assert.ok(subset.products.every(p=>p.typeIds.some(id=>subset.types.some(t=>t.id===id))));
  }
  assert.deepEqual(guideToolTypes["A palette, clean water and absorbent cloth"],["wet-palette","dry-palette","water","cloth"]);
});
test("each explicitly requested equipment category offers multiple manufacturers",()=>{
  for(const id of ["mould-remover","wet-palette","dry-palette","round-brush","detail-brush","plastic-cement","superglue","heat","knife","hand-drill","clippers","sanding","light","casting-resin","printer-resin"]){
    const brands=new Set(equipmentProducts.filter(p=>p.typeIds.includes(id)).map(p=>p.brand));
    assert.ok(brands.size>=2,id);
  }
});
test("search aliases and simultaneous filters narrow rather than broaden results",()=>{
  for(const q of ["exacto","mold line","sand paper","precision drill","wet palette"]){
    assert.ok(filterEquipment(equipmentProducts,{...emptyEquipmentFilters,q}).length,q);
  }
  const results=filterEquipment(equipmentProducts,{q:"palette",category:"paint",type:"dry-palette",task:"Mixing paint",brand:"Redgrass"});
  assert.equal(results.length,1);assert.equal(results[0].name,"RGG Glass Palette");
  assert.equal(filterEquipment(equipmentProducts,{...emptyEquipmentFilters,q:"no such equipment xyz"}).length,0);
});

test("legacy tool readiness and practiced notes round-trip for every guide after equipment projection", async()=>{
  const { createSession, updateSession, validateSessions } = await import("./session");
  for (const guide of guides) {
    const definition = { id: guide.id, version: 1 as const, stepIds: guide.steps.map(s=>s.id), preparedIds: [...guide.paints.map(p=>p.id), ...guide.tools.map((_,i)=>`tool-${i}`)] };
    const now = "2026-10-08T19:00:00.000Z";
    let session = createSession(definition,now);
    for (const preparedId of definition.preparedIds) session=updateSession(session,{type:"prepare",preparedId,prepared:true},definition,now);
    session=updateSession(session,{type:"note",stepId:definition.stepIds[0],note:"Keep my physical painting notes."},definition,now);
    equipmentForGuide(guide.tools);
    const restored = validateSessions(JSON.parse(JSON.stringify({[guide.id]:session})),[definition]);
    assert.equal(restored.ok,true);
    if(restored.ok) assert.deepEqual(restored.sessions[guide.id],session);
    assert.equal(session.completedStepIds.length,0);
  }
});
