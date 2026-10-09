import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {FACTIONS,MAX_SEGMENTS,getBrushFrame,getPaintFactors,plateSignedDistance,type PaintBoundary,type Stroke,type StrokeLibrary} from '../../scripts/pauldron/data';

const stroke:Stroke={id:'test-contact',region:0,start:2,end:6,width:.3,opacity:.6,points:[
  {face:0,bary:[1,0,0],position:[0,0,0],normal:[0,0,1]},
  {face:0,bary:[0,1,0],position:[1,0,0],normal:[0,0,1]},
  {face:0,bary:[0,0,1],position:[1,1,0],normal:[0,0,1]},
]};
test('pauldron brush contact survives reverse seeking without accumulated state',()=>{
  const before=getBrushFrame([stroke],4.5);
  for(const t of [6,0,5,3,20]) getBrushFrame([stroke],t);
  assert.deepEqual(getBrushFrame([stroke],4.5),before);
  assert.deepEqual(before?.position,[1,.25,0]);
  assert.equal(getBrushFrame([stroke],1.7)?.contact,false);
  assert.equal(getBrushFrame([stroke],2)?.approach,0);
  assert.equal(getBrushFrame([stroke],6.3)?.contact,false);
  assert.equal(getBrushFrame([stroke],8),null);
});
test('pressure changes brush footprint; reference ignores the experimental setting',()=>{
  assert.ok(getBrushFrame([stroke],4,.9,false,'edge')!.width>getBrushFrame([stroke],4,.1,false,'edge')!.width);
  assert.deepEqual(getBrushFrame([stroke],4,.9,true,'edge'),getBrushFrame([stroke],4,.4,false,'edge'));
  assert.deepEqual(getPaintFactors('base',99),getPaintFactors('base',1));
  assert.ok(Number.isFinite(getPaintFactors('edge',NaN).width));
  for(const faction of Object.values(FACTIONS)) assert.match(faction.sourceUrl,/^https:\/\//);
  assert.equal(FACTIONS['blood-angels'].trim,FACTIONS['blood-angels'].plate);
});
const asset=new URL('../../docs/pauldron-assets/',import.meta.url);
const localSource=new URL('source.stl',asset);
test('pauldron source, region map and surface contacts remain lossless and aligned',{skip:!existsSync(localSource)&&'Local user-supplied STL is deliberately excluded from Git'},()=>{
  const bytes=readFileSync(localSource);const manifest=JSON.parse(readFileSync(new URL('manifest.json',asset),'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'a49fd57c0b1f9a5359f29f6ea73148c8f45c50799f42a7f91286c27a95085278');
  assert.equal(manifest.sourceSha256,'a49fd57c0b1f9a5359f29f6ea73148c8f45c50799f42a7f91286c27a95085278');
  const binary=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const geometry=new STLLoader().parse(binary);const positions=geometry.getAttribute('position').array as Float32Array;
  assert.equal(positions.length,85424*9);assert.equal(manifest.triangles,85424);
  const bits=new Uint32Array(positions.buffer,positions.byteOffset,positions.length);
  for(let face=0;face<85424;face++)for(let component=0;component<9;component++)assert.equal(bits[face*9+component],bytes.readUInt32LE(84+face*50+12+component*4));
  const regions=readFileSync(new URL('regions.bin',asset));assert.equal(regions.length,85424);
  for(const r of regions)assert.ok(r>=0&&r<=6);
  assert.equal(new Set(regions).size,7);
  const normalsBytes=readFileSync(new URL('smooth-normals.bin',asset));
  assert.equal(normalsBytes.byteLength,positions.length*4);
  for(let i=0;i<normalsBytes.byteLength;i+=4)assert.ok(Number.isFinite(normalsBytes.readFloatLE(i)));
  const library=JSON.parse(readFileSync(new URL('strokes.json',asset),'utf8')) as StrokeLibrary;
  for(const strokes of Object.values(library)){
    assert.ok(strokes.length>0);assert.ok(strokes.reduce((n,s)=>n+s.points.length-1,0)<=MAX_SEGMENTS);
    for(const s of strokes){assert.ok(s.end>s.start&&s.start>=0&&s.end<=20);assert.ok(s.width>0&&s.opacity>0);
      for(const p of s.points){assert.ok(p.face>=0&&p.face<85424);assert.equal(regions[p.face],s.region);assert.ok(Math.abs(p.bary.reduce((a,b)=>a+b,0)-1)<1e-5);
        for(let axis=0;axis<3;axis++){const rebuilt=p.bary.reduce((n,w,j)=>n+w*positions[p.face*9+j*3+axis],0);assert.ok(Math.abs(rebuilt-p.position[axis])<1e-5,`${s.id}: contact off source face`);}
        assert.ok(Math.abs(Math.hypot(...p.normal)-1)<1e-4);
      }
    }
  }
  geometry.dispose();
});


test('continuous plate border is source-bound and crosses face boundaries without colour steps',()=>{
  const boundary=JSON.parse(readFileSync(new URL('boundary.json',asset),'utf8')) as PaintBoundary;
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',asset),'utf8'));
  assert.equal(boundary.sourceSha256,manifest.sourceSha256);
  assert.equal(boundary.kind,'authored-profile-v1');
  assert.equal(boundary.radiusSquaredCoefficients.length,5);
  assert.equal(boundary.bottomCoefficients.length,3);
  assert.ok([...boundary.radiusSquaredCoefficients,...boundary.bottomCoefficients,boundary.frontDepthMinimum].every(Number.isFinite));
  // Surface labels do not enter this calculation. The same model point receives
  // one border regardless of which adjacent source triangle the renderer hits.
  assert.ok(plateSignedDistance(boundary.centerX,0,boundary)>0);
  assert.ok(plateSignedDistance(boundary.centerX,boundary.topY+.1,boundary)<0);
  for(const y of [-1,0,1,2,3,4]){
    const u=(y-boundary.yOrigin)/boundary.yScale;
    const r2=boundary.radiusSquaredCoefficients.reduce((sum,c,i)=>sum+c*u**i,0);
    assert.ok(r2>0);
    const edgeX=boundary.centerX+Math.sqrt(r2);
    assert.ok(plateSignedDistance(edgeX-.02,y,boundary)>0);
    assert.ok(plateSignedDistance(edgeX+.02,y,boundary)<0);
    assert.ok(Math.abs(plateSignedDistance(edgeX,y,boundary))<1e-8);
  }
});

test('base coats are separated by drying and paint load changes opacity without opening gaps',()=>{
  const library=JSON.parse(readFileSync(new URL('strokes.json',asset),'utf8')) as StrokeLibrary;
  const first=library.base.filter(s=>s.end<=8.8+.0001);
  const second=library.base.filter(s=>s.start>=10.5-.0001);
  assert.ok(first.length>=4&&second.length>=4);
  assert.equal(first.length+second.length,library.base.length);
  assert.ok(library.base.reduce((n,s)=>n+s.points.length-1,0)<=MAX_SEGMENTS);
  assert.ok(library.base.every(s=>s.region===0));
  assert.equal(getPaintFactors('base',0).width,getPaintFactors('base',1).width);
  assert.ok(getPaintFactors('base',0).opacity<getPaintFactors('base',1).opacity);
});
