import * as THREE from "three";
import { makeFold, makeLayerSheet } from "./sculptural-studio-renderer";
import { forgetStudio, invalidateStudio } from "./studio-scheduler";
import { evaluateSurfacePainting, type SurfacePaintingInput } from "./surface-painting";
import type { TechniqueId } from "./technique-study-types";

type SurfacePaintingHooks = { onStatus: (status: "ready" | "lost") => void };
export type SurfacePaintingRenderer = {
  update: (input: SurfacePaintingInput) => void;
  dispose: () => void;
  simulateContextLoss: () => void;
};

// The longest authored lesson has 21 passes. The fixed limit keeps the shader
// small and avoids rebuilding programs when seeking between chapters.
const MAX_PASSES = 24;
const TECHNIQUE_INDEX: Record<TechniqueId, number> = { layers: 0, edges: 1, recess: 2, drybrush: 3 };

function makeMaterial() {
  const uniforms = {
    uBase: { value: new THREE.Color() },
    uCoats: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
    uPaths: { value: Array.from({ length: MAX_PASSES }, () => new THREE.Vector4()) },
    uPasses: { value: Array.from({ length: MAX_PASSES }, () => new THREE.Vector4()) },
    uCount: { value: 0 }, uTechnique: { value: 0 }, uPhase: { value: 0 },
    uAmount: { value: .4 }, uPreparation: { value: 0 },
    uTest: { value: 0 }, uUnload: { value: 0 },
    uDirection: { value: new THREE.Vector3(-.75, .65, 1).normalize() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vPosition, vWorldNormal;
      void main() {
        vUv=uv; vPosition=position;
        vWorldNormal=mat3(modelMatrix)*normal;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }`,
    fragmentShader: `
      uniform vec3 uBase, uCoats[3], uDirection;
      uniform vec4 uPaths[${MAX_PASSES}], uPasses[${MAX_PASSES}];
      uniform int uCount, uTechnique, uPhase, uPreparation;
      uniform float uAmount, uTest, uUnload;
      varying vec2 vUv;
      varying vec3 vPosition, vWorldNormal;

      float footprint(vec2 p, vec2 a, vec2 b, float progress, float radius, float capAspect) {
        if(progress<=0.0 || radius<=0.0) return 0.0;
        vec2 direction=normalize(b-a);
        vec2 end=mix(a,b,progress), segment=end-a;
        float t=clamp(dot(p-a,segment)/max(dot(segment,segment),0.000001),0.0,1.0);
        vec2 residual=p-a-t*segment;
        float along=dot(residual,direction);
        float across=dot(residual,vec2(-direction.y,direction.x));
        float distance=length(vec2(across,along/capAspect));
        float aa=max(fwidth(distance),0.0003);
        return 1.0-smoothstep(radius*0.86-aa,radius+aa,distance);
      }

      void main() {
        vec3 pigment=uBase;
        if(uPhase==2) {
          // Union neighbouring passes inside a coat, then build translucent
          // coats in order. There is no frame-dependent paint accumulation.
          vec3 coverage=vec3(0.0);
          for(int i=0;i<${MAX_PASSES};i++) {
            if(i>=uCount) break;
            vec4 path=uPaths[i], pass=uPasses[i];
            float cap=uTechnique==0 ? 0.32 : 0.75;
            float ink=footprint(vUv,path.xy,path.zw,pass.x,pass.y,cap)*pass.z;
            if(uTechnique==3) {
              // Contact reaches the rib crests first. Heavier pressure spreads
              // down their shoulders; the recessed channels remain legible.
              float threshold=0.031-uAmount*0.030;
              ink*=smoothstep(threshold,threshold+0.014,vPosition.z-0.06);
            }
            if(pass.w<0.5) coverage.x=max(coverage.x,ink);
            else if(pass.w<1.5) coverage.y=max(coverage.y,ink);
            else coverage.z=max(coverage.z,ink);
          }
          pigment=mix(pigment,uCoats[0],coverage.x);
          pigment=mix(pigment,uCoats[1],coverage.y);
          pigment=mix(pigment,uCoats[2],coverage.z);
        } else if(uPhase==1) {
          // A palette test on the same unadorned surface. The left mark holds
          // the loaded paint; the right is the controlled test after unloading.
          pigment=vec3(0.8388,0.8308,0.7835);
          float loadedMark=footprint(vUv,vec2(0.28,0.67),vec2(0.33,0.49),1.0,0.092,0.45);
          if(uPreparation==2) loadedMark*=uUnload;
          float test=footprint(vUv,vec2(0.60,0.69),vec2(0.64,0.29),uTest,0.064,0.32);
          pigment=mix(pigment,uCoats[0],loadedMark*0.83);
          pigment=mix(pigment,uCoats[0],test*(0.30+uAmount*0.42));
        }
        float light=pow(max(dot(normalize(vWorldNormal),uDirection),0.0),0.9);
        vec3 shade=mix(vec3(0.66,0.71,0.78),vec3(1.0,0.995,0.98),light);
        // A very low diffuse reflection keeps black paint readable as a form.
        vec3 lit=pigment*shade+vec3(0.0035)*light*light*(1.0-pigment);
        gl_FragColor=vec4(lit,1.0);
        #include <colorspace_fragment>
      }`,
  });
  return { material, uniforms };
}

/** A thin tile with either two recessed seams or a row of soft raised ribs. */
function makeRelief(technique: "recess" | "drybrush", material: THREE.Material) {
  const n = 176, halfWidth = .99, halfHeight = 1.02, radius = .09;
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const point = (u: number, v: number) => {
    const y = (v - .5) * halfHeight * 2;
    const corner = Math.max(0, Math.abs(y) - halfHeight + radius);
    const edge = halfWidth - radius + Math.sqrt(Math.max(0, radius * radius - corner * corner));
    const x = (u - .5) * edge * 2;
    let z: number;
    if (technique === "recess") {
      const incision = Math.max(Math.exp(-((x / .029) ** 2)), Math.exp(-((y / .029) ** 2)));
      z = .07 - .052 * incision;
    } else {
      const spacing = .215, local = x - Math.round(x / spacing) * spacing;
      const rib = Math.exp(-((local / .057) ** 4));
      const end = Math.max(0, (Math.abs(y) - .83) / .10);
      z = .06 + .050 * rib * Math.exp(-(end ** 2));
    }
    return [x, y, z];
  };
  for (let row = 0; row <= n; row++) for (let col = 0; col <= n; col++) {
    positions.push(...point(col / n, row / n)); uv.push(col / n, row / n);
  }
  for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
    const a = row * (n + 1) + col, b = a + n + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const front = new THREE.BufferGeometry();
  front.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  front.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  front.setIndex(indices); front.computeVertexNormals();
  const group = new THREE.Group(); group.add(new THREE.Mesh(front, material));
  const ring: number[][] = [], walls: number[] = [];
  for (let i = 0; i < n; i++) ring.push(point(i / n, 0));
  for (let i = 0; i < n; i++) ring.push(point(1, i / n));
  for (let i = n; i > 0; i--) ring.push(point(i / n, 1));
  for (let i = n; i > 0; i--) ring.push(point(0, i / n));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const c = [a[0], a[1], -.014], d = [b[0], b[1], -.014];
    walls.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute("position", new THREE.Float32BufferAttribute(walls, 3)); wall.computeVertexNormals();
  group.add(new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ color: "#cbd2d0", side: THREE.DoubleSide })));
  return group;
}

export function createSurfacePaintingRenderer(
  container: HTMLElement,
  initial: SurfacePaintingInput,
  hooks: SurfacePaintingHooks,
): SurfacePaintingRenderer {
  const started = performance.now();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;width:100%;height:100%;pointer-events:none";
  container.append(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 1.68, -1.68, .1, 30);
  camera.position.set(0, 0, 8);
  const paint = makeMaterial(), objects = new Map<TechniqueId, THREE.Group>();
  let input = initial, disposed = false, available = true, visible = true;
  let width = 1, height = 1, draws = 0, restoreTimer: number | undefined;

  function surface(technique: TechniqueId) {
    let group = objects.get(technique);
    if (group) return group;
    group = technique === "layers" ? makeLayerSheet(paint.material)
      : technique === "edges" ? makeFold(paint.material) : makeRelief(technique, paint.material);
    if (technique === "layers") group.rotation.set(.08, -.13, -.105);
    else if (technique === "edges") group.rotation.set(.15, -.23, -.32);
    else group.rotation.set(.12, -.16, -.105);
    const centre = new THREE.Box3().setFromObject(group, true).getCenter(new THREE.Vector3());
    group.position.x -= centre.x; group.position.y -= centre.y;
    group.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial) {
        object.material.userData.neutralColour = object.material.color.clone();
      }
    });
    objects.set(technique, group); scene.add(group);
    return group;
  }

  function configure() {
    const frame = evaluateSurfacePainting(input), uniforms = paint.uniforms;
    const currentSurface = surface(frame.technique);
    for (const [technique, group] of objects) group.visible = technique === frame.technique;
    uniforms.uTechnique.value = TECHNIQUE_INDEX[frame.technique];
    uniforms.uPhase.value = frame.phase === "light" ? 0 : frame.phase === "preparation" ? 1 : 2;
    uniforms.uPreparation.value = frame.preparation === "load" ? 2 : 1;
    uniforms.uTest.value = frame.preparationTestProgress;
    uniforms.uUnload.value = frame.preparationUnloadProgress;
    uniforms.uAmount.value = frame.amount;
    uniforms.uBase.value.set(frame.base);
    currentSurface.traverse(object => {
      if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshBasicMaterial)) return;
      if (input.palette) object.material.color.copy(uniforms.uBase.value).multiplyScalar(.78);
      else object.material.color.copy(object.material.userData.neutralColour);
    });
    frame.depositedCoats.forEach((hex, index) => uniforms.uCoats.value[index].set(hex));
    uniforms.uCount.value = Math.min(frame.passes.length, MAX_PASSES);
    frame.passes.slice(0, MAX_PASSES).forEach((pass, index) => {
      uniforms.uPaths.value[index].set(...pass.from, ...pass.to);
      uniforms.uPasses.value[index].set(pass.progress, pass.width, pass.opacity, pass.coat);
    });
    if (frame.lighting) {
      const angle = frame.light * Math.PI / 180;
      uniforms.uDirection.value.set(Math.sin(angle), .65, Math.cos(angle)).normalize();
    } else uniforms.uDirection.value.set(-.75, .65, 1).normalize();
    const extent = frame.detail ? 1.02 : 1.68, aspect = width / height;
    const halfHeight = Math.max(extent, extent / Math.max(aspect, .5));
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    container.dataset.surfaceChapter = frame.chapterId;
    container.dataset.surfacePhase = frame.phase;
    container.dataset.surfacePasses = String(frame.passes.filter(pass => pass.progress > 0).length);
  }

  const draw = () => {
    if (disposed || !available || !visible || document.hidden) return;
    configure(); renderer.render(scene, camera);
    container.dataset.surfaceDraws = String(++draws);
  };
  const resize = () => {
    if (disposed) return;
    width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    draw();
  };
  const observer = new ResizeObserver(resize);
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) invalidateStudio(draw); else forgetStudio(draw);
  });
  const visibility = () => { if (document.hidden) forgetStudio(draw); else invalidateStudio(draw); };
  const lost = (event: Event) => {
    event.preventDefault(); available = false; forgetStudio(draw); hooks.onStatus("lost");
  };
  const restored = () => {
    if (disposed) return;
    available = true; resize(); hooks.onStatus("ready");
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  document.addEventListener("visibilitychange", visibility);
  observer.observe(container); intersection.observe(container);

  const dispose = () => {
    if (disposed) return;
    disposed = true; forgetStudio(draw);
    if (restoreTimer !== undefined) window.clearTimeout(restoreTimer);
    observer.disconnect(); intersection.disconnect();
    document.removeEventListener("visibilitychange", visibility);
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>([paint.material]);
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
    renderer.dispose(); canvas.remove();
  };
  try {
    resize();
    container.dataset.surfaceLoadMs = (performance.now() - started).toFixed(1);
    hooks.onStatus("ready");
  } catch (error) { dispose(); throw error; }

  return {
    update(next) { if (disposed) return; input = next; invalidateStudio(draw); },
    simulateContextLoss() {
      if (disposed || !available) return;
      const extension = renderer.getContext().getExtension("WEBGL_lose_context");
      if (!extension) return;
      extension.loseContext();
      restoreTimer = window.setTimeout(() => { if (!disposed) extension.restoreContext(); }, 900);
    },
    dispose,
  };
}
