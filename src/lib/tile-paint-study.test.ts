import { strict as assert } from "node:assert";
import { test } from "node:test";
import * as THREE from "three";
import { createTileStudy, tileBrushPose, tilePaintStrokes, tileStrokePoint, tileSurfaceHeight } from "./tile-paint-study";

test("recess strokes stay in valleys while the drybrush clears the same raised surface", () => {
  for (const technique of ["recess", "drybrush"] as const) {
    const strokes = tilePaintStrokes(technique);
    for (const stroke of strokes) {
      for (let sample = 0; sample <= 60; sample++) {
        const point = tileStrokePoint(stroke, sample / 60, technique);
        const surface = tileSurfaceHeight(point.x, point.y);
        if (technique === "recess") {
          assert.ok(Math.abs(point.z - surface) < 1e-12);
          assert.ok(surface < .104, "A recess brush must stay below the adjacent ridges.");
        } else {
          assert.ok(point.z >= surface - 1e-12, "The drybrush must not sink into the relief.");
          assert.ok(Math.abs(point.z - tileSurfaceHeight(0, 0)) < 1e-12);
        }
      }
    }
  }
});

test("tile brush lifts clear of ridges and returns continuously without leaving paint in transit", () => {
  for (const technique of ["recess", "drybrush"] as const) {
    const strokes = tilePaintStrokes(technique);
    for (const boundary of strokes.flatMap(stroke => [stroke.start, stroke.end])) {
      const before = tileBrushPose(technique, boundary - .0001);
      const after = tileBrushPose(technique, boundary + .0001);
      assert.ok(before.point.distanceTo(after.point) < .001, `Contact jump at ${technique} ${boundary}`);
      assert.ok(before.handle.angleTo(after.handle) < .001, `Wrist jump at ${technique} ${boundary}`);
    }
    for (let i = 1; i < strokes.length; i++) {
      for (let sample = 1; sample < 60; sample++) {
        const time = THREE.MathUtils.lerp(strokes[i - 1].end, strokes[i].start, sample / 60);
        const pose = tileBrushPose(technique, time);
        assert.equal(pose.contact, false);
        assert.equal(pose.pressure, 0);
        assert.ok(pose.point.z >= tileSurfaceHeight(pose.point.x, pose.point.y), `Brush crosses the relief at ${technique} ${time}`);
      }
    }
    const finalStroke = strokes[strokes.length - 1];
    const leaving = tileBrushPose(technique, 23.99);
    assert.ok(leaving.point.distanceTo(tileStrokePoint(finalStroke, 1, technique)) > 3, "The brush leaves the frame before hiding.");
  }
});

test("each tile contact follows its deposit path and the brush pose is independent of playback direction", () => {
  for (const technique of ["recess", "drybrush"] as const) {
    for (const stroke of tilePaintStrokes(technique)) {
      for (const fraction of [.1, .5, .9]) {
        const time = THREE.MathUtils.lerp(stroke.start, stroke.end, fraction);
        const pose = tileBrushPose(technique, time);
        const progress = fraction * fraction * (3 - 2 * fraction);
        const expected = tileStrokePoint(stroke, progress, technique).add(new THREE.Vector3(0, 0, .003));
        assert.ok(pose.point.distanceTo(expected) < 1e-12);
        assert.equal(pose.contact, true);
        assert.ok(pose.pressure > 0);
        tileBrushPose(technique, 24);
        assert.deepEqual(tileBrushPose(technique, time), pose);
      }
    }
  }
});

test("tile geometry remains finite and seeking restores exactly the same paint and contact state", () => {
  for (const technique of ["recess", "drybrush"] as const) {
    const study = createTileStudy(technique);
    study.group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const position = object.geometry.getAttribute("position");
      for (const value of position.array) assert.ok(Number.isFinite(value));
    });
    study.update(7.5);
    const before = JSON.stringify(study.group.userData);
    study.update(24);
    study.update(7.5);
    assert.equal(JSON.stringify(study.group.userData), before);
    assert.equal(study.group.userData.contact, true);
    study.update(0);
    assert.equal(study.group.userData.contact, false);
    assert.ok(study.group.userData.paintState.split(",").every((value: string) => Number(value) === 0));
    study.dispose();
    study.dispose();
    assert.equal(study.group.children.length, 0);
  }
});
