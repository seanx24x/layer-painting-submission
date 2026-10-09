import {strict as assert} from "node:assert";
import {test} from "node:test";
import {lessonChapters} from "./painting-lesson";
import {TECHNIQUE_OUTCOMES,techniqueStrokes,strokeReplayWindow,techniqueBrushMoment} from "./technique-coaching";
import {createTileStudy} from "./tile-paint-study";

test("each non-sphere chapter has a complete replayable stroke and an observable outcome",()=>{
  for(const id of ["edges","recess","drybrush"] as const){
    lessonChapters(id).forEach((c,i)=>{
      const strokes=techniqueStrokes(id).filter(s=>s.start>=c.start&&s.end<=c.end);
      assert.ok(strokes.length>0);
      assert.ok(strokes.every(s=>s.end+.4<=c.end));
      assert.ok(TECHNIQUE_OUTCOMES[id][i]);
    });
  }
});
test("comparison inspection hides the brush and returning restores exact tile paint state",()=>{
  for(const id of ["recess","drybrush"] as const){
    const surface=createTileStudy(id);
    surface.update(4);
    const point=surface.group.userData.brushPoint;
    const paint=surface.group.userData.paintState;
    surface.group.userData.comparison=id;
    surface.group.userData.before=true;
    surface.update(24);
    assert.equal(surface.group.userData.contact,false);
    surface.group.userData.comparison=undefined;
    surface.group.userData.before=false;
    surface.update(4);
    assert.equal(surface.group.userData.paintState,paint);
    assert.equal(surface.group.userData.brushPoint,point);
    surface.dispose();
  }
});
test("replay returns to the stroke just watched during a gap, including the final stroke",()=>{
  const chapter=lessonChapters("recess")[0];
  assert.deepEqual(strokeReplayWindow("recess",5.4,chapter),{start:1.55,end:5.7});
  const final=strokeReplayWindow("recess",10,chapter)!;
  assert.equal(final.start,5.55);
  assert.ok(Math.abs(final.end-9.7)<1e-9);
});
test("replay follows the current stroke and never reaches outside its chapter",()=>{
  const chapter=lessonChapters("edges")[1];
  const before=strokeReplayWindow("edges",chapter.start,chapter)!;
  assert.equal(before.start,chapter.start);
  assert.equal(before.end,13.1);
  const active=strokeReplayWindow("edges",16,chapter)!;
  assert.equal(active.start,15.05);
  assert.equal(active.end,17.4);
  assert.equal(strokeReplayWindow("layers",20,lessonChapters("layers")[1]),null);
});
test("tight sphere gaps stop before the next contact and replay the same stroke again",()=>{
  const firstCoat=lessonChapters("layers")[3];
  const first=strokeReplayWindow("layers",38,firstCoat)!;
  assert.equal(first.end,39.95);
  assert.deepEqual(strokeReplayWindow("layers",first.end,firstCoat),first);
  const secondCoat=lessonChapters("layers")[4];
  const quick=strokeReplayWindow("layers",60.4,secondCoat)!;
  assert.ok(Math.abs(quick.end-60.93)<1e-9);
  assert.deepEqual(strokeReplayWindow("layers",quick.end,secondCoat),quick);
  for(const chapter of [firstCoat,secondCoat]){
    const strokes=techniqueStrokes("layers").filter(stroke=>stroke.start>=chapter.start&&stroke.end<=chapter.end);
    strokes.forEach((stroke,index)=>{
      const replay=strokeReplayWindow("layers",(stroke.start+stroke.end)/2,chapter)!;
      assert.ok(replay.end>=stroke.end);
      if(strokes[index+1])assert.ok(replay.end<strokes[index+1].start);
      assert.deepEqual(strokeReplayWindow("layers",replay.end,chapter),replay);
    });
  }
});
test("brush cues separate contact, stroke, lift and a quiet reposition",()=>{
  assert.deepEqual(techniqueBrushMoment("recess",1.8),{phase:null,action:"Guide"});
  assert.deepEqual(techniqueBrushMoment("recess",2.1),{phase:"contact",action:"Guide"});
  assert.deepEqual(techniqueBrushMoment("recess",3),{phase:"stroke",action:"Guide"});
  assert.deepEqual(techniqueBrushMoment("recess",5.4),{phase:"lift",action:"Guide"});
  assert.deepEqual(techniqueBrushMoment("recess",5.8),{phase:null,action:"Guide"});
  assert.deepEqual(techniqueBrushMoment("drybrush",3),{phase:"stroke",action:"Sweep"});
  assert.deepEqual(techniqueBrushMoment("edges",18.2),{phase:"stroke",action:"Touch"});
  assert.equal(techniqueBrushMoment("layers",56).phase,null);
  assert.equal(techniqueBrushMoment("layers",80).phase,null);
});
