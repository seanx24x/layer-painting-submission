import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { forgetStudio, invalidateStudio } from "./studio-scheduler";
import { DEFAULT_STUDIO_STATE, DRY_STROKES, EDGE_STROKE, LAYER_STROKES, STROKE_FEATHER, STROKE_TIP_ASPECT, STUDIES, edgeHighlightWidth, layerOpacity, reliefHeight, renderState, sampleLightAngles, smooth, strokeProgress, type StudioState, type StudyId } from "./sculptural-studio";

export type StudioMetrics = { loadMs: number; drawMs: number; triangles: number; dpr: number };
type Hooks = { onStatus: (status: "ready" | "lost") => void; onMetrics?: (metrics: StudioMetrics) => void };
export type SculpturalStudio = { update: (state: StudioState) => void; captureCovers: () => Record<StudyId, string>; simulateContextLoss: () => void; dispose: () => void };
const f = (n: number) => Number.isInteger(n) ? `${n}.0` : String(n);
const vertexVaryings = "varying vec3 vStudyPosition; varying vec3 vStudyNormal; varying vec2 vStudyUv;\n";
const shaderHelpers = `
  uniform float uTime, uAmount, uMap;
  uniform vec3 uDirection;
  varying vec3 vStudyPosition; varying vec3 vStudyNormal; varying vec2 vStudyUv;
  float eased(float t) { t = clamp(t, 0.0, 1.0); return t*t*(3.0-2.0*t); }
  float footprint(vec2 p, vec2 a, vec2 b, float radius, float start, float end, float feather, float capAspect) {
    if (uTime <= start) return 0.0;
    radius *= eased((uTime-start)/0.3);
    vec2 direction=normalize(b-a);
    b = mix(a, b, eased((uTime-start)/(end-start)));
    vec2 ab=b-a;
    float t=clamp(dot(p-a,ab)/max(dot(ab,ab),0.000001),0.0,1.0);
    vec2 residual=p-a-t*ab;
    float along=dot(residual,direction);
    float across=dot(residual,vec2(-direction.y,direction.x));
    float d=length(vec2(across,along/capAspect));
    float aa=max(fwidth(d),0.001);
    return 1.0-smoothstep(radius*feather-aa,radius+aa,d);
  }
  float segmentDistance(vec3 p, vec3 a, vec3 b) {
    vec3 ab=b-a; return length(p-a-clamp(dot(p-a,ab)/max(dot(ab,ab),0.000001),0.0,1.0)*ab);
  }
`;
const vec = (a: readonly number[]) => `vec2(${a.map(f).join(",")})`;
const colour = (hex: string) => { const c = new THREE.Color(hex); return `vec3(${f(c.r)},${f(c.g)},${f(c.b)})`; };
function paintShader(id: StudyId) {
  if (id === "light") return ""; // Light uses its own material below, with world normals.
  if (id === "layers") return `
    float first=0.0, second=0.0;
    ${LAYER_STROKES.map(s => `${s.coat ? "second" : "first"}=max(${s.coat ? "second" : "first"},footprint(vStudyUv,${vec(s.from)},${vec(s.to)},${f(s.width)},${f(s.start)},${f(s.end)},${f(STROKE_FEATHER)},${f(STROKE_TIP_ASPECT)}));`).join("\n")}
    float opacity=${f(layerOpacity(0))}+uAmount*${f(layerOpacity(1) - layerOpacity(0))};
    float coverage=(1.0-(1.0-first*opacity)*(1.0-second*opacity))*smoothstep(0.0,0.35,vStudyNormal.z);
    diffuseColor.rgb=mix(diffuseColor.rgb,${colour("#587da8")},coverage);
  `;
  if (id === "edges") return `
    float progress=eased((uTime-${f(EDGE_STROKE.start)})/${f(EDGE_STROKE.end - EDGE_STROKE.start)});
    vec3 a=vec3(0.0,${f(EDGE_STROKE.from)},0.5), b=vec3(0.0,mix(${f(EDGE_STROKE.from)},${f(EDGE_STROKE.to)},progress),0.5);
    float distanceToEdge=segmentDistance(vStudyPosition,a,b);
    float width=${f(edgeHighlightWidth(0))}+uAmount*uAmount*${f(edgeHighlightWidth(1) - edgeHighlightWidth(0))};
    float aa=max(fwidth(distanceToEdge),0.001);
    float ink=(1.0-smoothstep(width-aa,width+aa,distanceToEdge))*eased((uTime-${f(EDGE_STROKE.start)})/0.24);
    ink*=smoothstep(0.6,0.85,normalize(vStudyNormal).z);
    diffuseColor.rgb=mix(diffuseColor.rgb,${colour("#faf8ef")},ink*0.96);
  `;
  if (id === "recess") return `
    float progress=eased((uTime-1.0)/5.8);
    float d=abs(vStudyPosition.x);
    float aa=max(fwidth(d),0.001);
    float channel=1.0-smoothstep(0.045-aa,0.072+aa,d);
    float head=mix(0.97,-1.0,progress);
    float trail=smoothstep(head-0.08,head+0.08,vStudyPosition.y)*step(1.001,uTime);
    float overflow=smoothstep(0.6,1.0,uAmount);
    float pool=exp(-pow(vStudyPosition.x/(0.09+overflow*0.22),2.0))*overflow;
    pool*=0.65+0.35*sin(vStudyPosition.y*7.0+0.5);
    float coverage=max(channel*(0.45+uAmount*0.55),pool*0.75)*trail;
    diffuseColor.rgb=mix(diffuseColor.rgb,${colour("#344b46")},coverage);
  `;
  return `
    float deposition=0.0;
    float height=vStudyPosition.z;
    float raised=smoothstep(0.178-uAmount*0.085,0.205-uAmount*0.065,height);
    ${DRY_STROKES.map(s => `{
      float pass=footprint(vStudyUv,${vec(s.from)},${vec(s.to)},${f(s.width)},${f(s.start)},${f(s.end)},0.88,1.0);
      deposition=1.0-(1.0-deposition)*(1.0-pass*raised*(0.48+uAmount*0.3));
    }`).join("\n")}
    float grain=0.92+0.08*sin(vStudyPosition.x*210.0+sin(vStudyPosition.y*170.0));
    diffuseColor.rgb=mix(diffuseColor.rgb,${colour("#dfd7bf")},deposition*grain);
  `;
}

type PaintMaterial = { material: THREE.Material; update: (s: StudioState, direction: THREE.Vector3) => void };
function makePaintMaterial(id: StudyId): PaintMaterial {
  const uniforms = { uTime: { value: 0 }, uAmount: { value: .4 }, uMap: { value: 0 }, uDirection: { value: new THREE.Vector3(-.5, .7, 1).normalize() } };
  if (id === "light") {
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `varying vec3 vNormal; void main(){ vNormal=mat3(modelMatrix)*normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uDirection; uniform float uMap; varying vec3 vNormal;
        void main(){
          vec3 n=normalize(vNormal);
          float exposure=max(dot(n,uDirection),0.0);
          vec3 base=mix(${colour("#6a7785")},${colour("#ddd2b6")},pow(exposure,0.9));
          base*=0.85+0.15*max(n.y,0.0);
          float aa=max(fwidth(exposure),0.003);
          vec3 mapped=mix(${colour("#5d6c7d")},${colour("#aeb3b1")},smoothstep(0.18-aa,0.18+aa,exposure));
          mapped=mix(mapped,${colour("#e1d6b7")},smoothstep(0.72-aa,0.72+aa,exposure));
          gl_FragColor=vec4(mix(base,mapped,uMap),1.0);
          #include <colorspace_fragment>
        }`,
    });
    return { material, update(s, direction) { uniforms.uDirection.value.copy(direction); uniforms.uMap.value = s.paintMap ? 1 : 0; } };
  }
  if (id === "layers" || id === "edges") {
    // The same quiet, broad illumination as Light & form. No glossy specular cues.
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: `${vertexVaryings} varying vec3 vWorldNormal;
        void main(){vStudyPosition=position;vStudyNormal=normal;
          vStudyUv=vec2(position.x/2.0+0.5,position.y/2.3+0.5);
          vWorldNormal=mat3(modelMatrix)*normal;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `${shaderHelpers} varying vec3 vWorldNormal;
        void main(){
          vec4 diffuseColor=vec4(${colour(id === "layers" ? "#ecebe5" : "#e5e7e5")},1.0);
          ${paintShader(id)}
          float light=pow(max(dot(normalize(vWorldNormal),normalize(vec3(-0.75,0.65,1.0))),0.0),0.9);
          vec3 shade=mix(vec3(0.66,0.71,0.78),vec3(1.0,0.995,0.98),light);
          gl_FragColor=vec4(diffuseColor.rgb*shade,1.0);
          #include <colorspace_fragment>
        }`,
    });
    return { material, update(s) { uniforms.uTime.value = s.time; uniforms.uAmount.value = s.amount; } };
  }
  const base = { recess: "#94aaa0", drybrush: "#7f817b" }[id];
  const material = new THREE.MeshStandardMaterial({ color: base, roughness: .82, metalness: 0 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = vertexVaryings + shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvStudyPosition=position; vStudyNormal=normal; vStudyUv=uv;");
    shader.fragmentShader = shaderHelpers + shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>\n${paintShader(id)}`);
  };
  material.customProgramCacheKey = () => `sculptural-${id}-v1`;
  return { material, update(s) { uniforms.uTime.value = s.time; uniforms.uAmount.value = s.amount; } };
}

/** A continuous rounded front surface. Fragment coverage never follows triangle boundaries. */
function makeRelief(id: "recess" | "drybrush", material: THREE.Material, sideMaterial: THREE.Material) {
  const n = 144, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const point = (u: number, v: number) => {
    const y = (v - .5) * 2.22, radius = .18;
    const corner = Math.max(0, Math.abs(y) - (1.11 - radius));
    const halfWidth = 1.06 - radius + Math.sqrt(Math.max(0, radius * radius - corner * corner));
    const x = (u - .5) * 2 * halfWidth;
    let z: number;
    if (id === "recess") z = .22 - .15 * Math.exp(-Math.pow(x / .052, 2));
    else z = reliefHeight(u, v);
    // A small bevel makes the perimeter feel solid without changing the authored surface paths.
    const edge = Math.min(u, 1 - u, v, 1 - v);
    z -= .04 * (1 - smooth(edge / .025));
    return [x, y, z];
  };
  for (let row = 0; row <= n; row++) for (let col = 0; col <= n; col++) { positions.push(...point(col / n, row / n)); uvs.push(col / n, row / n); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = y * (n + 1) + x, b = a + n + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  const front = new THREE.BufferGeometry();
  front.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); front.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); front.setIndex(indices); front.computeVertexNormals();
  const mesh = new THREE.Mesh(front, material), group = new THREE.Group(); group.add(mesh);
  const ring: number[][] = [];
  for (let x = 0; x < n; x++) ring.push(point(x / n, 0));
  for (let y = 0; y < n; y++) ring.push(point(1, y / n));
  for (let x = n; x > 0; x--) ring.push(point(x / n, 1));
  for (let y = n; y > 0; y--) ring.push(point(0, y / n));
  const sides: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], c = [a[0], a[1], -.18], d = [b[0], b[1], -.18];
    sides.push(...a, ...c, ...b, ...b, ...c, ...d, 0, 0, -.18, ...d, ...c);
  }
  const wall = new THREE.BufferGeometry(); wall.setAttribute("position", new THREE.Float32BufferAttribute(sides, 3)); wall.computeVertexNormals();
  group.add(new THREE.Mesh(wall, sideMaterial)); return group;
}

/** A thin, gently curved sheet. Its painted face keeps the same quiet form. */
export function makeLayerSheet(material: THREE.Material) {
  const columns = 112, rows = 144, halfWidth = .94, halfHeight = 1.06, radius = .11;
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const point = (u: number, v: number) => {
    const y = (v - .5) * halfHeight * 2;
    const corner = Math.max(0, Math.abs(y) - (halfHeight - radius));
    const edge = halfWidth - radius + Math.sqrt(Math.max(0, radius * radius - corner * corner));
    const x = (u - .5) * 2 * edge;
    return [x, y, .13 * (1 - (x / halfWidth) ** 2)];
  };
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= columns; col++) {
    positions.push(...point(col / columns, row / rows));
    uvs.push(col / columns, row / rows);
  }
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const a = row * (columns + 1) + col, b = a + columns + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const group = new THREE.Group(); group.add(new THREE.Mesh(geometry, material));
  const ring: number[][] = [];
  for (let col = 0; col < columns; col++) ring.push(point(col / columns, 0));
  for (let row = 0; row < rows; row++) ring.push(point(1, row / rows));
  for (let col = columns; col > 0; col--) ring.push(point(col / columns, 1));
  for (let row = rows; row > 0; row--) ring.push(point(0, row / rows));
  const walls: number[] = [];
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index], b = ring[(index + 1) % ring.length];
    const c = [a[0], a[1], a[2] - .026], d = [b[0], b[1], b[2] - .026];
    walls.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  const wall = new THREE.BufferGeometry();
  wall.setAttribute("position", new THREE.Float32BufferAttribute(walls, 3));
  wall.computeVertexNormals();
  group.add(new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ color: "#d5dbd9", side: THREE.DoubleSide })));
  return group;
}

/** Two broad faces, a softly folded ridge, and a thin closed perimeter. */
export function makeFold(material: THREE.Material) {
  const positions: number[] = [], indices: number[] = [], uvs: number[] = [];
  const n = 128;
  for (let row = 0; row < 2; row++) for (let col = 0; col <= n; col++) {
    const x = (col / n - .5) * 1.9;
    positions.push(x, row ? .98 : -.98, .5 - .64 * (Math.sqrt(x * x + .0009) - .03));
    uvs.push(col / n, row);
  }
  for (let col = 0; col < n; col++) indices.push(col, col + 1, col + n + 1, col + 1, col + n + 2, col + n + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const group = new THREE.Group(); group.add(new THREE.Mesh(geometry, material));
  const walls: number[] = [];
  const addWall = (a: number[], b: number[]) => {
    const c = [a[0], a[1], a[2] - .045], d = [b[0], b[1], b[2] - .045];
    walls.push(...a, ...b, ...c, ...b, ...d, ...c);
  };
  for (let col = 0; col < n; col++) {
    addWall(positions.slice(col * 3, col * 3 + 3), positions.slice((col + 1) * 3, (col + 1) * 3 + 3));
    const top = (col + n + 1) * 3;
    addWall(positions.slice(top + 3, top + 6), positions.slice(top, top + 3));
  }
  addWall(positions.slice((n + 1) * 3, (n + 1) * 3 + 3), positions.slice(0, 3));
  addWall(positions.slice(n * 3, n * 3 + 3), positions.slice((2 * n + 1) * 3, (2 * n + 1) * 3 + 3));
  const wall = new THREE.BufferGeometry(); wall.setAttribute("position", new THREE.Float32BufferAttribute(walls, 3)); wall.computeVertexNormals();
  group.add(new THREE.Mesh(wall, new THREE.MeshBasicMaterial({ color: "#cbd2d2", side: THREE.DoubleSide })));
  return group;
}

function makeBrush(wide = false) {
  const group = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.033, .046, .72, 20), new THREE.MeshStandardMaterial({ color: "#68767b", roughness: .5 }));
  shaft.position.y = .69;
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(.047, .055, .23, 20), new THREE.MeshStandardMaterial({ color: "#b2b8b7", metalness: .65, roughness: .36 })); ferrule.position.y = .23;
  if (wide) ferrule.scale.set(7.5, 1, .7);
  const bristles = new THREE.Group();
  const hairMaterial = new THREE.MeshStandardMaterial({ color: "#c2b090", roughness: 1 });
  for (let i = 0; i < (wide ? 39 : 13); i++) {
    const angle = i * 2.39996, r = Math.sqrt(i / 13) * .045;
    const hair = new THREE.Mesh(new THREE.CylinderGeometry(.009, .004, .17 + (i % 3) * .006, 5), hairMaterial);
    hair.position.set(wide ? (i / 38 - .5) * .82 : Math.cos(angle) * r, .074, wide ? Math.sin(angle) * .028 : Math.sin(angle) * r); bristles.add(hair);
  }
  group.add(shaft, ferrule, bristles); group.visible = false;
  return { group, bristles };
}

export function createSculpturalStudio(container: HTMLElement, initialState: StudioState, hooks: Hooks): SculpturalStudio {
  const started = performance.now();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: true });
  const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(dpr); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0, 0);
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
  container.append(renderer.domElement);
  container.dataset.browser = navigator.userAgent;
  container.dataset.graphics = renderer.getContext().getParameter(renderer.getContext().VERSION);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2.5, 2.5, 1.8, -1.8, .1, 30); camera.position.set(0, 0, 8);
  const ambient = new THREE.HemisphereLight("#f2f1e9", "#687885", 2.2); scene.add(ambient);
  const key = new THREE.DirectionalLight("#fff0cf", 3.4); key.position.set(-3, 5, 6); scene.add(key);
  const fill = new THREE.DirectionalLight("#dce7ff", 1.1); fill.position.set(4, 1, 3); scene.add(fill);
  const objects = new Map<StudyId, THREE.Group>();
  const materials = new Map<StudyId, PaintMaterial>();
  let lightSphere: THREE.Mesh | undefined, lightBlock: THREE.Mesh | undefined;
  for (const study of STUDIES) {
    const paint = makePaintMaterial(study.id); materials.set(study.id, paint);
    const group = new THREE.Group(); group.rotation.set(.18, -.32, -.09);
    if (study.id === "light") {
      lightSphere = new THREE.Mesh(new THREE.SphereGeometry(1, 80, 56), paint.material);
      lightBlock = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.7, 1.7, 6, .12), paint.material);
      group.add(lightSphere, lightBlock); group.rotation.set(.24, -.38, -.08);
    } else if (study.id === "layers") {
      group.add(makeLayerSheet(paint.material)); group.rotation.set(.08, -.13, -.105);
    } else if (study.id === "edges") {
      group.add(makeFold(paint.material)); group.rotation.set(.15, -.23, -.32);
    } else {
      const side = new THREE.MeshStandardMaterial({ color: study.id === "recess" ? "#91a39b" : "#7c7e76", roughness: .9 });
      group.add(makeRelief(study.id, paint.material, side));
      if (study.id === "drybrush") group.rotation.set(.2, -.27, -.18);
    }
    if (study.id === "layers" || study.id === "edges") {
      // Centre the actual projected silhouette, including the folded depth,
      // while leaving paint coordinates and the fixed camera unchanged.
      const center = new THREE.Box3().setFromObject(group, true).getCenter(new THREE.Vector3());
      group.position.x -= center.x; group.position.y -= center.y;
    }
    objects.set(study.id, group); scene.add(group);
  }
  const shadowMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: "varying vec2 vUv; void main(){float r=length((vUv-.5)*2.0);gl_FragColor=vec4(.30,.35,.42,exp(-r*r*5.0)*.15*(1.0-smoothstep(.7,1.0,r)));}",
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.0, .48), shadowMaterial); shadow.position.set(0, -1.38, -1); scene.add(shadow);
  const dryBrush = makeBrush(true);
  scene.add(dryBrush.group);
  // Brush and deposited mark use the same object coordinates and eased stroke time.
  let state = { ...initialState }, disposed = false, available = true, visible = true;
  let width = 800, height = 540, drawCount = 0, drawSum = 0, loadMs = 0;
  function configure(next: StudioState) {
    const s = renderState(next);
    for (const [id, group] of objects) group.visible = id === s.study;
    const object = objects.get(s.study)!;
    object.add(dryBrush.group); dryBrush.group.visible = false;
    shadow.visible = s.study !== "layers" && s.study !== "edges";
    lightSphere!.visible = s.form === "sphere"; lightBlock!.visible = s.form === "block";
    const angles = sampleLightAngles(s), az = angles.azimuth * Math.PI / 180, el = angles.elevation * Math.PI / 180;
    const direction = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).normalize();
    materials.get(s.study)!.update(s, direction);
    const aspect = width / height, extent = s.close ? 1.02 : 1.68;
    const halfHeight = Math.max(extent, extent / Math.max(aspect, .5));
    camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
    camera.top = halfHeight; camera.bottom = -halfHeight;
    camera.position.y = 0;
    camera.updateProjectionMatrix();
    if (!s.reference && s.study === "drybrush") {
      const stroke = DRY_STROKES.find(s0 => s.time > s0.start && s.time < s0.end);
      if (stroke) {
        const t = strokeProgress(stroke, s.time), u = stroke.from[0] + (stroke.to[0] - stroke.from[0]) * t, v = stroke.from[1];
        dryBrush.group.visible = true;
        dryBrush.group.position.set((u - .5) * 2.12, (v - .5) * 2.22, .225);
        const axis = new THREE.Vector3(-.55, 0, .83).normalize();
        dryBrush.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), axis, new THREE.Vector3(axis.z, 0, -axis.x)));
        dryBrush.bristles.scale.set(1 + s.amount * .12, 1 - s.amount * .25, 1);
      }
    }
  }
  function measure(drawMs: number) {
    drawCount++; drawSum += drawMs;
    const metrics = { loadMs, drawMs: drawSum / drawCount, triangles: renderer.info.render.triangles, dpr };
    container.dataset.studioMetrics = JSON.stringify(metrics);
    container.dataset.draws = String(drawCount);
    if (drawCount === 1 || drawCount % 30 === 0) hooks.onMetrics?.(metrics);
  }
  const draw = () => {
    if (disposed || !available || !visible || document.hidden) return;
    configure(state); const t = performance.now(); renderer.render(scene, camera); measure(performance.now() - t);
  };
  function resize() {
    if (disposed) return;
    width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    // Resizing clears WebGL's drawing buffer. Redraw atomically once initialised,
    // including when a browser capture temporarily changes the viewport.
    if (loadMs > 0) draw(); else invalidateStudio(draw);
  }
  const observer = new ResizeObserver(resize); observer.observe(container);
  const intersection = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) invalidateStudio(draw); else forgetStudio(draw); }); intersection.observe(container);
  const visibility = () => { if (document.hidden) forgetStudio(draw); else invalidateStudio(draw); };
  const lost = (event: Event) => { event.preventDefault(); available = false; forgetStudio(draw); hooks.onStatus("lost"); };
  const restored = () => { available = true; hooks.onStatus("ready"); resize(); };
  renderer.domElement.addEventListener("webglcontextlost", lost); renderer.domElement.addEventListener("webglcontextrestored", restored); document.addEventListener("visibilitychange", visibility);
  const dispose = () => {
    if (disposed) return;
    disposed = true; forgetStudio(draw); observer.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", visibility);
    renderer.domElement.removeEventListener("webglcontextlost", lost); renderer.domElement.removeEventListener("webglcontextrestored", restored);
    const geometries = new Set<THREE.BufferGeometry>(), ownedMaterials = new Set<THREE.Material>();
    scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); const list = Array.isArray(object.material) ? object.material : [object.material]; list.forEach(m => ownedMaterials.add(m)); } });
    geometries.forEach(g => g.dispose()); ownedMaterials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove();
  };
  try {
    resize(); configure(state); renderer.render(scene, camera); loadMs = performance.now() - started; hooks.onStatus("ready");
  } catch (error) { dispose(); throw error; }
  return {
    update(next) { if (disposed) return; state = { ...next }; invalidateStudio(draw); },
    captureCovers() {
      const covers = {} as Record<StudyId, string>;
      if (disposed || !available) return covers;
      const oldWidth = width, oldHeight = height;
      width = 560; height = 440; renderer.setPixelRatio(1.5); renderer.setSize(width, height, false);
      for (const study of STUDIES) {
        const cover = { ...DEFAULT_STUDIO_STATE, study: study.id, time: study.duration, reference: true };
        if (study.id === "light") { cover.reference = false; cover.time = 0; }
        // Hold a partially applied first coat so the cover shows both primer and colour.
        if (study.id === "layers") { cover.reference = false; cover.time = 5.2; }
        configure(cover); dryBrush.group.visible = false; renderer.render(scene, camera);
        covers[study.id] = renderer.domElement.toDataURL("image/png");
      }
      width = oldWidth; height = oldHeight; renderer.setPixelRatio(dpr); renderer.setSize(width, height, false); configure(state); renderer.render(scene, camera);
      return covers;
    },
    simulateContextLoss() {
      if (disposed) return;
      const extension = renderer.getContext().getExtension("WEBGL_lose_context");
      if (!extension) { hooks.onStatus("lost"); return; }
      extension.loseContext();
      window.setTimeout(() => { if (!disposed) extension.restoreContext(); }, 900);
    },
    dispose,
  };
}
