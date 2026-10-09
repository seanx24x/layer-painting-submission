import { strict as assert } from "node:assert";
import { test } from "node:test";
import { paintStrokes, strokePoint, strokeProgress, sphereBrushPose, sphereWetStroke, SPHERE_RADIUS } from "./shape-paint-motion";

test("brush contact and SphereGeometry texture coordinates identify the same surface point", () => {
  for (const stroke of paintStrokes) {
    for (const t of [0, .1, .25, .5, .75, .9, 1]) {
      const p = strokePoint(stroke, t);
      const phi = p.u * Math.PI * 2;
      const theta = (1-p.v) * Math.PI;
      const expected = [-SPHERE_RADIUS*Math.cos(phi)*Math.sin(theta), SPHERE_RADIUS*Math.cos(theta), SPHERE_RADIUS*Math.sin(phi)*Math.sin(theta)];
      [p.x,p.y,p.z].forEach((value,i)=>assert.ok(Math.abs(value-expected[i])<1e-10));
      assert.ok(Math.abs(Math.hypot(p.x,p.y,p.z)-SPHERE_RADIUS)<1e-10);
    }
  }
});

test("sphere brush touches the painted point and clears the surface on every transfer",()=>{
  for(const stroke of paintStrokes){
    const time=(stroke.start+stroke.end)/2;
    const pose=sphereBrushPose(time),paint=strokePoint(stroke,strokeProgress(stroke,time));
    assert.ok(pose.contact&&pose.visible);
    assert.ok(Math.hypot(pose.point.x-paint.x,pose.point.y-paint.y,pose.point.z-paint.z)<.00601);
    assert.ok(pose.pressure>0);
  }
  for(let t=35;t<=79;t+=.01){
    const pose=sphereBrushPose(t);
    assert.ok(Number.isFinite(pose.point.x+pose.point.y+pose.point.z));
    assert.ok(Math.hypot(pose.point.x,pose.point.y,pose.point.z)>=SPHERE_RADIUS+.00599);
    if(!pose.contact)assert.equal(pose.pressure,0);
  }
});

test("sphere lift and landing are continuous at every authored stroke boundary",()=>{
  for(const stroke of paintStrokes){
    for(const t of [stroke.start,stroke.end]){
      const before=sphereBrushPose(t-.0001),after=sphereBrushPose(t+.0001);
      assert.ok(Math.hypot(before.point.x-after.point.x,before.point.y-after.point.y,before.point.z-after.point.z)<.001);
    }
    const original=sphereBrushPose(stroke.start+.3);
    sphereBrushPose(80);
    assert.deepEqual(sphereBrushPose(stroke.start+.3),original);
  }
});

test("fresh sheen follows current contact instead of the previous drying stroke",()=>{
  for(const stroke of paintStrokes){
    assert.equal(sphereWetStroke(stroke.start+.05),stroke);
  }
  const first=paintStrokes[0];
  assert.equal(sphereWetStroke(first.end+.1),first);
  assert.equal(sphereWetStroke(80),undefined);
});
test("paint progress is bounded and reversible for deterministic seeking", () => {
  for (const stroke of paintStrokes) {
    assert.equal(strokeProgress(stroke,stroke.start-1),0);
    assert.equal(strokeProgress(stroke,stroke.end+1),1);
    const mid=(stroke.start+stroke.end)/2;
    const original=strokeProgress(stroke,mid);
    strokeProgress(stroke,stroke.end);
    assert.equal(strokeProgress(stroke,mid),original);
    assert.ok(Math.abs(original-.5)<1e-10);
  }
});
test("each deposit has a lift interval before the next stroke and stays away from UV seams", () => {
  paintStrokes.forEach((stroke,i)=>{
    assert.ok(stroke.end>stroke.start);
    if(i) assert.ok(stroke.start>paintStrokes[i-1].end);
    for(const t of [0,.5,1]) {
      const p=strokePoint(stroke,t);
      assert.ok(p.u>.08&&p.u<.92&&p.v>.08&&p.v<.92);
    }
  });
});
