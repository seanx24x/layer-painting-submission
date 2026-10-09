import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { smooth } from "./shape-paint-motion";
import type { PaintingBrush } from "./painting-brush";

/** A palette in the same lit scene, with the same brush used on the sphere. */
export function createPaintingPalette(paintColor?: string) {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const pigment = new THREE.Color(paintColor ?? "#285cdf");
  const ridgeColor = paintColor ? pigment.clone().lerp(new THREE.Color("#ffffff"), .34) : new THREE.Color("#7796e3");
  const add = (g: THREE.BufferGeometry, m: THREE.Material) => {
    geometries.push(g); materials.push(m);
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  };
  const grainData = new Uint8Array(64*64*4);
  for(let i=0;i<64*64;i++){const value=120+Math.floor((Math.sin(i*73.31)*.5+.5)*70);grainData.set([value,value,value,255],i*4);}
  const grain = new THREE.DataTexture(grainData,64,64,THREE.RGBAFormat);
  grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(12,8);grain.needsUpdate=true;
  const board = add(new RoundedBoxGeometry(2.65, 1.65, .09, 6, .07), new THREE.MeshStandardMaterial({color:"#eeeae0",roughness:.87,bumpMap:grain,bumpScale:.0015}));
  board.position.y = -.02;
  const puddle = add(new THREE.SphereGeometry(1, 48, 24), new THREE.MeshPhysicalMaterial({color:pigment,roughness:.29,clearcoat:.3}));
  puddle.scale.set(.24,.14,.016); puddle.position.set(-.83,.39,.062);
  const drop = add(new THREE.SphereGeometry(1,32,16), new THREE.MeshPhysicalMaterial({color:"#92b8d2",transparent:true,opacity:.5,roughness:.12,clearcoat:1}));
  drop.scale.set(.055,.05,.023);
  const swatches = [0,1,2].map(i=>{
    const pad=add(new RoundedBoxGeometry(.67,.47,.012,3,.025),new THREE.MeshStandardMaterial({color:"#d4d1c8",roughness:.9,bumpMap:grain,bumpScale:.0025}));
    pad.position.set(-.86+i*.86,-.33,.057);
    const paint=add(new THREE.SphereGeometry(1,48,16),new THREE.MeshPhysicalMaterial({color:pigment,transparent:true,opacity:[1,.78,.28][i],roughness:i===2?.3:.68}));
    paint.position.set(pad.position.x,-.33,.076); paint.scale.set(.27,.047,i===0?.014:.002);
    return {pad,paint};
  });
  const striations = Array.from({length:5},(_,i)=>{
    const line = add(new THREE.CylinderGeometry(.002,.002,.48,6),new THREE.MeshStandardMaterial({color:ridgeColor,roughness:.7}));
    line.rotation.z=Math.PI/2; line.position.set(-.86,-.365+i*.018,.087);return line;
  });
  const unload=add(new THREE.SphereGeometry(1,32,16),new THREE.MeshStandardMaterial({color:pigment,transparent:true,opacity:.4,roughness:.7}));
  unload.position.set(-.38,.10,.063);
  const test=add(new THREE.SphereGeometry(1,48,16),new THREE.MeshPhysicalMaterial({color:pigment,roughness:.57,transparent:true,opacity:.83}));
  const bead=add(new THREE.SphereGeometry(1,32,16),new THREE.MeshPhysicalMaterial({color:pigment,roughness:.24,clearcoat:.3}));
  const orient = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(.45,.77,.45).normalize());
  return {
    group,
    update(time:number, brush:PaintingBrush, compare?:boolean) {
      const load = time>=25;
      const t=load?time-25:time-10;
      group.visible=time>=10&&time<35;
      swatches.forEach(({pad,paint},i)=>{pad.visible=!load;paint.visible=!load&&t>5+i*1.5;const p=smooth((t-5-i*1.5)/1.4);paint.scale.x=.27*p;paint.position.x=pad.position.x-.27+.27*p;});
      striations.forEach(l=>{l.visible=!load&&t>7;});
      drop.visible=!load&&t<4;drop.position.set(-.48-.3*smooth(t/4),.46-.07*smooth(t/4),.075);
      unload.visible=load&&t>3;unload.scale.set(.25*smooth((t-3)/3),.027,.001);
      test.visible=load&&t>6;
      const progress=smooth((t-6)/2.6);
      test.scale.set(.37*progress,compare?.09:.03,compare?.012:.002);
      test.position.set(.04+.37*progress,-.29,.078);
      bead.visible=load&&!!compare&&t>8;
      bead.position.set(.79,-.29,.082);bead.scale.set(.09,.085,.022);
      let x=-.83,y=.39,z=.083,pressure=.25;
      if(!load){
        x+=Math.sin(t*3)*.09;y+=Math.cos(t*3)*.045;brush.group.visible=t<4.8;
        if(t>=5&&t<9.4){const i=Math.min(2,Math.floor((t-5)/1.5));const p=smooth((t-5-i*1.5)/1.4);x=-.86+i*.86-.27+.54*p;y=-.33;z=.082;pressure=.25;brush.group.visible=true;}
      }
      else {
        brush.group.visible=true;
        if(t>=3&&t<6){const p=smooth((t-3)/3);x=-.83+.65*p;y=.39-.29*p;z+=Math.sin(p*Math.PI)*.07;}
        if(t>=6){x=.04+.74*progress;y=-.29;pressure=.35*(1-smooth((t-8.4)/1.3));z+=.12*smooth((t-8.4)/1.3);}
      }
      brush.group.position.set(x,y,z);brush.group.quaternion.copy(orient);brush.group.scale.set(1,.92,1);
      brush.setContact(pressure,pigment,load?1-.65*smooth((t-3)/3):.6);
    },
    dispose(){grain.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();},
  };
}
