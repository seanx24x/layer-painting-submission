import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as THREE from "three";
import { createCubeStudy, cubeBrushPose, cubeStrokeProgress, cubeStrokes, cubeSurfaceDistance } from "./cube-paint-study";

test("cube highlight paths lie on the rounded surface and each pass has a lift interval", () => {
  cubeStrokes.forEach((stroke, i) => {
    for (const point of [stroke.from, stroke.to]) assert.ok(Math.abs(cubeSurfaceDistance(new THREE.Vector3().fromArray(point))) < 1e-8);
    assert.ok(stroke.end > stroke.start);
    if (i) assert.ok(stroke.start > cubeStrokes[i - 1].end);
    assert.equal(cubeStrokeProgress(stroke, stroke.start), -1);
    assert.equal(cubeStrokeProgress(stroke, stroke.end), 1);
  });
});

test("brush remains outside the cube through every stroke and repositioning arc", () => {
  for (let tick = 0; tick <= 2400; tick++) {
    const pose = cubeBrushPose(tick / 100);
    assert.ok(pose.point.toArray().every(Number.isFinite));
    assert.ok(cubeSurfaceDistance(pose.point) >= 0);
    assert.ok(Math.abs(pose.handle.length() - 1) < 1e-8);
    if (pose.contact) assert.ok(pose.pressure > 0 && pose.pressure <= .30 + 1e-8);
    else assert.equal(pose.pressure, 0);
  }
});

test("every contact follows its authored painted edge and fine highlights use a lighter touch", () => {
  cubeStrokes.forEach(stroke => {
    const normal = new THREE.Vector3().fromArray(stroke.normal).normalize();
    for (const fraction of [.1, .25, .5, .75, .9]) {
      const time = stroke.start + (stroke.end - stroke.start) * fraction;
      const pose = cubeBrushPose(time);
      const expected = new THREE.Vector3().fromArray(stroke.from)
        .lerp(new THREE.Vector3().fromArray(stroke.to), cubeStrokeProgress(stroke, time))
        .addScaledVector(normal, .004);
      assert.ok(pose.point.distanceTo(expected) < 1e-8, "Contact must not drift off its painted path");
    }
    const middle = cubeBrushPose((stroke.start + stroke.end) / 2);
    assert.equal(middle.pressure, stroke.layer === 0 ? .30 : stroke.layer === 1 ? .15 : .27);
    assert.ok(cubeBrushPose(stroke.start + .005).pressure < middle.pressure * .01);
    assert.ok(cubeBrushPose(stroke.end - .005).pressure < middle.pressure * .01);
  });
});

test("contact transitions remain continuous and transfers lift clear of the solid", () => {
  for (const stroke of cubeStrokes) {
    for (const boundary of [stroke.start, stroke.end]) {
      const before = cubeBrushPose(boundary - .0001);
      const after = cubeBrushPose(boundary + .0001);
      assert.ok(before.point.distanceTo(after.point) < .0001, "A transfer must not snap the contact point");
      assert.ok(before.handle.angleTo(after.handle) < .0001, "A transfer must not snap brush orientation");
    }
  }
  cubeStrokes.slice(1).forEach((stroke, index) => {
    const previous = cubeStrokes[index];
    const pose = cubeBrushPose((previous.end + stroke.start) / 2);
    assert.ok(cubeSurfaceDistance(pose.point) > .23, "Repositioning must visibly clear the edge");
    assert.equal(pose.contact, false);
  });
});

test("seeking restores exact cube paint, brush and contact state without frame history", () => {
  const study = createCubeStudy();
  study.update(6.2);
  const original = JSON.stringify(study.group.userData);
  study.update(24);
  study.update(6.2);
  assert.equal(JSON.stringify(study.group.userData), original);
  study.update(6.2);
  assert.equal(JSON.stringify(study.group.userData), original);
  study.update(0);
  assert.equal(study.group.userData.paintState, Array(9).fill("-1.0000").join(","));
  study.dispose();
  assert.equal(study.group.children.length, 0);
});
