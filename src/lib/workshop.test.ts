import test from 'node:test';
import assert from 'node:assert/strict';
import { experimentFactors, createLessonClock, WORKSHOPS, describeExperiment } from './workshop';
import { lessonExamples } from './lesson-examples';
import { createCubeStudy } from './cube-paint-study';
import { createTileStudy } from './tile-paint-study';

test('reference snapshots ignore experiment amount and invalid inputs remain bounded', () => {
  for (const technique of ['layers','edges','recess','drybrush'] as const) {
    assert.deepEqual(experimentFactors(technique,{amount:1,reference:true,light:0,lighting:false}),experimentFactors(technique));
    assert.equal(experimentFactors(technique,{amount:NaN,reference:false,light:0,lighting:false}).amount,.4);
    const low=experimentFactors(technique,{amount:0,reference:false,light:0,lighting:false});
    const high=experimentFactors(technique,{amount:1,reference:false,light:0,lighting:false});
    assert.ok(technique==='layers'||technique==='recess'?high.load>low.load:high.pressure>low.pressure);
    assert.ok(WORKSHOPS[technique].start<WORKSHOPS[technique].end);
  }
});
test('scene clock unsubscribes disposed renderers',()=>{
  const clock=createLessonClock();const seen:number[]=[];const off=clock.subscribe(t=>seen.push(t));clock.publish(1);off();clock.publish(2);assert.deepEqual(seen,[1]);
});
test('experiment explanations follow the displayed reference rather than the hidden slider value', () => {
  for (const technique of ['layers', 'edges', 'recess', 'drybrush'] as const) {
    assert.notEqual(describeExperiment(technique, 0, false), describeExperiment(technique, 1, false));
    assert.equal(describeExperiment(technique, 1, true), WORKSHOPS[technique].outcome);
    assert.equal(describeExperiment(technique, NaN, false), WORKSHOPS[technique].outcome);
  }
});
test('experiment parameters preserve deterministic path and seeking on cube and tile',()=>{
  for(const technique of ['edges','recess','drybrush'] as const){
    const surface=technique==='edges'?createCubeStudy():createTileStudy(technique);
    surface.update(6);const point=surface.group.userData.brushPoint;const paint=surface.group.userData.paintState;
    surface.update(6,{amount:1,reference:false,light:0,lighting:false});
    assert.equal(surface.group.userData.brushPoint,point);
    surface.update(20);surface.update(6);assert.equal(surface.group.userData.paintState,paint);assert.equal(surface.group.userData.brushPoint,point);surface.dispose();
  }
});
test('coach workshop actions stay constrained to the reviewed step technique',()=>{
  const examples=lessonExamples('ultramarines-classic','base');
  assert.ok(examples.some(e=>e.id==='layers-explore'&&e.workshop==='explore'));
  assert.ok(!examples.some(e=>e.id==='recess-explore'));
  assert.deepEqual(lessonExamples('missing','missing'),[]);
});
