import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as THREE from "three";
import { contactPressure, roundContactRadius } from "./brush-contact";
import { createPaintingBrush } from "./painting-brush";
import { createPaintingPalette } from "./painting-palette";

test("round bristle contact has the same radius as surface paint and releases to a point",()=>{
  const brush=createPaintingBrush();
  const tuft=brush.group.children.find(m=>m.name==="Flexible sable tuft") as THREE.Mesh;
  for(const t of [0,.03,.08,.5,.92,1]){
    const pressure=contactPressure(t);
    brush.setContact(pressure,new THREE.Color("blue"));
    const tip=tuft.geometry.getAttribute("position");
    assert.ok(Math.abs(tip.getX(0)-roundContactRadius(pressure))<1e-7);
    assert.ok(pressure<=.58);
  }
  assert.equal(contactPressure(0),0);assert.equal(contactPressure(1),0);
  brush.dispose();
});
test("palette loading and test marks rebuild deterministically on backward seeking",()=>{
  const brush=createPaintingBrush(), palette=createPaintingPalette();
  const state=()=>JSON.stringify(palette.group.children.map(c=>({visible:c.visible,position:c.position.toArray(),scale:c.scale.toArray()})));
  palette.update(30,brush);const initial=state();
  palette.update(34.8,brush,true);assert.notEqual(state(),initial);
  palette.update(30,brush);assert.equal(state(),initial);
  palette.dispose();brush.dispose();
});
