"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import type { StudyPalette } from "@/lib/study-palette";
import type { TechniqueId } from "@/lib/technique-study-types";
import type { LessonClock, WorkshopExperiment } from "@/lib/workshop";
import { FLAT_STROKES, flatDepositedPaint, flatLayerPassOpacity, flatPaintFrame, flatPalette, flatSceneViewBox, flatSurfacePoint, flatTint, type FlatBrush } from "@/lib/flat-painting";

export type FlatPaintingSceneProps = {
  technique: TechniqueId;
  time: number;
  playing: boolean;
  clock: LessonClock;
  palette?: StudyPalette;
  experiment?: WorkshopExperiment;
  detail: boolean;
  reducedMotion: boolean;
};
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const labels: Record<TechniqueId, string> = { layers: "Thin coats on a circle", edges: "Side-of-brush highlights on a three-face cube", recess: "Controlled shading inside a tile’s channels", drybrush: "Light sweeps across raised ridges" };

// The bottom edge is the contact line. Keeping its centre at (0, 0) means
// pressure can deform the bristles without moving them away from the mark.
function tipPath(width: number, pressure: number, dry: boolean, side = false) {
  const half = width / 2, neck = dry ? 13 : side ? 6 : 9;
  const offset = side ? 22 : 8 * pressure;
  const shoulder = -18 + pressure * 5;
  return `M${offset - neck} -32L${offset + neck} -32Q${half + offset * .3} ${shoulder} ${half} 0Q0 1 ${-half} 0Q${-half - offset * .15} ${shoulder} ${offset - neck} -32Z`;
}
function bristlePath(width: number, pressure: number, dry: boolean, side = false) {
  const count = dry ? 9 : 5, offset = side ? 22 : 8 * pressure;
  return Array.from({ length: count }, (_, i) => {
    const fraction = (i + 1) / (count + 1) - .5;
    const start = offset + fraction * (dry ? 23 : side ? 10 : 16);
    const end = fraction * width * .98;
    return `M${start.toFixed(2)} -29Q${((start + end) / 2).toFixed(2)} ${(-16 + pressure * 5).toFixed(2)} ${end.toFixed(2)} -1`;
  }).join(" ");
}
function handleTransform(pressure: number, side: boolean) {
  return `translate(${side ? 22 : 8 * pressure} 0)`;
}
function prepBrush(time: number): FlatBrush {
  let x = 274, y = 217, opacity = 1, angle = 28, contact = true;
  if (time < 15) {
    const t = clamp((time - 10.7) / 3.5);
    x += Math.sin(t * Math.PI * 2) * 22;
    y += Math.cos(t * Math.PI * 2) * 15;
    opacity = smooth((time - 10) / .7);
  } else if (time < 18) {
    const t = smooth((time - 15) / 3);
    x = 274 + t * 194; y = 217 - Math.sin(t * Math.PI) * 46;
    contact = false;
  } else if (time < 23.4) {
    const t = smooth((time - 18) / 4.6);
    x = 468 + t * 63; y = 207 + t * 85;
  } else if (time < 25) {
    x = 531; y = 292 - smooth((time - 23.4) / 1.2) * 35;
    opacity = 1 - smooth((time - 23.4) / 1.2); contact = false;
  } else if (time < 28) {
    const t = smooth((time - 25.3) / 2.2);
    x = 265 + t * 16; y = 200 + t * 29; opacity = smooth((time - 25) / .3);
  } else if (time < 31) {
    const t = smooth((time - 28) / 2.3);
    x = 283 + t * 57; y = 229 + t * 56; angle = 28 + t * 9;
  } else if (time < 34) {
    const t = smooth((time - 31) / 2.2);
    x = 468 + t * 61; y = 207 + t * 85;
    opacity = smooth((time - 31) / .35);
  } else {
    x = 529; y = 292 - smooth(time - 34) * 35; opacity = 1 - smooth(time - 34); contact = false;
  }
  return { point: { x, y }, angle, opacity, width: 22, pressure: contact ? .65 : 0, contact, coat: 0 };
}

export default function FlatPaintingScene(props: FlatPaintingSceneProps) {
  const id = useId().replaceAll(":", "");
  const surfaceClip = `${id}-surface`, ridgeClip = `${id}-ridges`, bristleMask = `${id}-bristle-mask`, bristleTexture = `${id}-bristle-texture`;
  const titleId = `${id}-title`, descriptionId = `${id}-description`;
  const scene = useRef<SVGSVGElement>(null);
  const surface = useRef<SVGGElement>(null);
  const preparation = useRef<SVGGElement>(null);
  const brush = useRef<SVGGElement>(null);
  const brushHandle = useRef<SVGGElement>(null);
  const contactShadow = useRef<SVGEllipseElement>(null);
  const brushTip = useRef<SVGPathElement>(null);
  const brushLines = useRef<SVGPathElement>(null);
  const light = useRef<SVGGElement>(null);
  const lightDiagram = useRef<SVGGElement>(null);
  const direction = useRef<SVGGElement>(null);
  const markRefs = useRef<(SVGPathElement | null)[]>([]);
  const coatRefs = useRef<(SVGGElement | null)[]>([]);
  const excessRefs = useRef<(SVGPathElement | null)[]>([]);
  const ridgeRefs = useRef<(SVGRectElement | null)[]>([]);
  const testStroke = useRef<SVGPathElement>(null);
  const water = useRef<SVGGElement>(null);
  const unload = useRef<SVGPathElement>(null);
  const latest = useRef(props);
  const stageSize = useRef({ width: 800, height: 480 });
  const drawRef = useRef<(time: number) => void>(() => {});
  const colours = flatPalette(props.technique, props.palette);
  const frame = useMemo(() => flatPaintFrame(props.technique, props.time, props.experiment), [props.technique, props.time, props.experiment]);
  const strokes = FLAT_STROKES[props.technique];
  const isTile = props.technique === "recess" || props.technique === "drybrush";
  const surfaceTransform = props.detail ? "translate(-126.4 -40.2) scale(1.28)" : undefined;
  const title = labels[props.technique];
  const initialPreparation = frame.phase === "mix" || frame.phase === "load";
  const initialBrush = initialPreparation ? prepBrush(props.time) : frame.brush;
  const initialBrushPoint = initialPreparation ? initialBrush.point : flatSurfacePoint(initialBrush.point, props.detail);
  const initialTestProgress = frame.phase === "load" ? smooth((props.time - 31) / 2.2) : smooth((props.time - 18) / 4.6);
  const initialRidgeWidth = 12 + frame.amount * 19;

  useEffect(() => {
    const previous = latest.current;
    // Semantic React snapshots must not rewind an actively playing SVG clock.
    latest.current = props.playing && previous.playing && props.time < previous.time && props.technique === previous.technique
      ? { ...props, time: previous.time } : props;
    drawRef.current = (time: number) => {
      const p = latest.current;
      const next = flatPaintFrame(p.technique, time, p.experiment);
      const palette = flatPalette(p.technique, p.palette);
      const prep = next.phase === "mix" || next.phase === "load";
      // Size by available height, not a fixed 800px canvas: the teaching surface
      // stays legible on a wide desktop and retains space around phone controls.
      scene.current?.setAttribute("viewBox", flatSceneViewBox(stageSize.current.width, stageSize.current.height, prep, p.detail));
      surface.current?.setAttribute("display", prep ? "none" : "inline");
      preparation.current?.setAttribute("display", prep ? "inline" : "none");
      scene.current?.setAttribute("data-phase", next.phase);
      scene.current?.setAttribute("data-contact", String(next.brush.contact));
      const showLight = next.phase === "light" || Boolean(p.experiment?.lighting);
      light.current?.setAttribute("display", showLight && !prep ? "inline" : "none");
      lightDiagram.current?.setAttribute("display", showLight && !prep ? "inline" : "none");
      const angle = p.experiment?.lighting ? p.experiment.light + 31 : 0;
      direction.current?.setAttribute("transform", `rotate(${angle} 380 240)`);
      lightDiagram.current?.setAttribute("transform", `rotate(${angle} 380 240)`);
      next.marks.forEach((mark, i) => {
        const el = markRefs.current[i];
        if (el) { el.setAttribute("d", mark.path); el.setAttribute("opacity", String(p.technique === "layers" ? flatLayerPassOpacity(mark.stroke.coat, next.amount) : mark.opacity)); el.setAttribute("fill", flatDepositedPaint(p.technique, palette.base, palette.coats[mark.stroke.coat])); }
        const spill = excessRefs.current[i];
        if (spill) { spill.setAttribute("d", mark.path); spill.setAttribute("opacity", String(p.technique === "drybrush" ? Math.max(0, (next.amount - .4) / .6) * .22 : 0)); spill.setAttribute("fill", palette.coats[mark.stroke.coat]); }
      });
      if (p.technique === "layers") coatRefs.current.forEach((element, coat) => {
        element?.setAttribute("opacity", String(next.marks.find(mark => mark.stroke.coat === coat)?.opacity ?? 1));
      });
      if (p.technique === "drybrush") {
        const width = 12 + next.amount * 19;
        ridgeRefs.current.forEach((el, i) => { el?.setAttribute("x", String(259 + i * 44 - width / 2)); el?.setAttribute("width", String(width)); });
      }
      const current = prep ? prepBrush(time) : next.brush;
      const bp = prep ? current.point : flatSurfacePoint(current.point, p.detail);
      brush.current?.setAttribute("transform", `translate(${bp.x} ${bp.y}) rotate(${current.angle}) scale(${p.detail && !prep ? 1.28 : 1})`);
      brush.current?.setAttribute("opacity", String(next.phase === "light" ? 0 : current.opacity));
      brushHandle.current?.setAttribute("transform", handleTransform(current.pressure, p.technique === "edges"));
      contactShadow.current?.setAttribute("rx", String(current.width / 2));
      contactShadow.current?.setAttribute("opacity", String(current.contact ? .1 : 0));
      brushTip.current?.setAttribute("d", tipPath(current.width, current.pressure, p.technique === "drybrush", p.technique === "edges"));
      brushTip.current?.setAttribute("fill", palette.coats[current.coat]);
      brushLines.current?.setAttribute("d", bristlePath(current.width, current.pressure, p.technique === "drybrush", p.technique === "edges"));
      brushLines.current?.setAttribute("stroke", flatTint(palette.coats[current.coat], "#FFFFFF", .28));
      const testProgress = next.phase === "load" ? smooth((time - 31) / 2.2) : smooth((time - 18) / 4.6);
      testStroke.current?.setAttribute("stroke-dasharray", `${testProgress * 106} 106`);
      water.current?.setAttribute("opacity", String(next.phase === "mix" ? 1 : 0));
      unload.current?.setAttribute("stroke-dasharray", `${next.phase === "load" ? smooth((time - 28) / 2.3) * 80 : 0} 80`);
    };
    drawRef.current(latest.current.time);
  }, [props]);
  useEffect(() => {
    const node = scene.current;
    if (!node) return;
    const update = () => {
      const bounds = node.getBoundingClientRect();
      stageSize.current = { width: bounds.width, height: bounds.height };
      drawRef.current(latest.current.time);
    };
    const observer = new ResizeObserver(update);
    observer.observe(node);
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => props.clock.subscribe(time => {
    latest.current = { ...latest.current, time };
    drawRef.current(time);
  }), [props.clock]);

  return <svg ref={scene} className="flat-painting-scene" viewBox={flatSceneViewBox(800, 480, frame.phase === "mix" || frame.phase === "load", props.detail)} role="img" aria-labelledby={`${titleId} ${descriptionId}`} data-technique={props.technique} data-paint-base={colours.base} data-paint-coats={colours.coats.join(",")} data-detail={props.detail} data-reduced-motion={props.reducedMotion} style={{ display: "block", width: "100%", height: "100%", overflow: "visible" }}>
    <title id={titleId}>{title}</title>
    <desc id={descriptionId}>An explanatory flat illustration of brush contact and paint placement. The brush and its mark respond to the same load or pressure control. {props.palette ? `Surface: ${props.palette.base.name}. Applied paints: ${[...new Set(props.palette.coats.map(paint => paint.name))].join(", ")}.` : ""}</desc>
    <defs>
      <clipPath id={surfaceClip}>{props.technique === "layers" ? <circle cx="380" cy="240" r="140" /> : props.technique === "edges" ? <path d="M380 100 500 166 500 300 380 365 260 300 260 166Z" /> : <rect x="244" y="119" width="272" height="242" rx="13" />}</clipPath>
      <pattern id={bristleTexture} width="97" height="19" patternUnits="userSpaceOnUse">
        <rect width="97" height="19" fill="white" opacity=".38" />
        <path d="M0 3Q25 2 48 3T97 3M0 10Q28 11 61 9T97 10M0 16Q41 15 97 17" fill="none" stroke="white" strokeWidth="1.5" opacity=".88" />
        <path d="M9 6H34M62 6H91M28 13H53" fill="none" stroke="white" strokeWidth=".8" opacity=".6" />
      </pattern>
      <mask id={bristleMask} maskUnits="userSpaceOnUse" x="230" y="100" width="300" height="275"><rect x="230" y="100" width="300" height="275" fill={`url(#${bristleTexture})`} /></mask>
      <clipPath id={ridgeClip}>{Array.from({ length: 6 }, (_, i) => <rect key={i} ref={el => { ridgeRefs.current[i] = el; }} x={259 + i * 44 - initialRidgeWidth / 2} y="129" width={initialRidgeWidth} height="222" rx="4" />)}</clipPath>
    </defs>
    <g ref={surface} transform={surfaceTransform} display={frame.phase === "mix" || frame.phase === "load" ? "none" : "inline"}>
      {props.technique === "layers" && <circle cx="380" cy="240" r="140" fill={colours.base} stroke={flatTint(colours.base, "#687078", .08)} strokeWidth="1" />}
      {props.technique === "edges" && <g strokeLinejoin="round">
        <path d="M260 166 380 100 500 166 380 230Z" fill={colours.base} />
        <path d="M260 166 380 230 380 365 260 300Z" fill={flatTint(colours.base, "#777D82", .10)} />
        <path d="M380 230 500 166 500 300 380 365Z" fill={flatTint(colours.base, "#777D82", .19)} />
        <path d="M380 100 500 166 500 300 380 365 260 300 260 166Z" fill="none" stroke={flatTint(colours.base, "#777D82", .10)} strokeWidth="1" />
      </g>}
      {isTile && <rect x="244" y="119" width="272" height="242" rx="13" fill={flatTint(colours.base, "#606A65", props.technique === "recess" ? .08 : .12)} />}
      {props.technique === "recess" && <g clipPath={`url(#${surfaceClip})`}>
        {[0, 1].flatMap(row => [0, 1, 2].map(col => <rect key={`${row}-${col}`} x={col === 0 ? 247 : col === 1 ? 335 : 435} y={row === 0 ? 122 : 245} width={col === 1 ? 90 : 78} height={row === 0 ? 113 : 113} rx="6" fill={colours.base} />))}
        <path d="M330 120V360 M430 120V360 M245 240H515" stroke={flatTint(colours.base, "#616B65", .14)} strokeWidth="3" fill="none" />
      </g>}
      {props.technique === "drybrush" && <g>{Array.from({ length: 6 }, (_, i) => <g key={i}>
        <rect x={247 + i * 44} y="126" width="36" height="228" rx="7" fill={flatTint(colours.base, "#FFFFFF", .16)} />
        <rect x={251 + i * 44} y="129" width="16" height="222" rx="5" fill={flatTint(colours.base, "#FFFFFF", .27)} />
      </g>)}</g>}
      <g clipPath={`url(#${surfaceClip})`}>
        {props.technique === "drybrush" && <g>{strokes.map((s, i) => <path key={s.id} ref={el => { excessRefs.current[i] = el; }} d={frame.marks[i].path} fill={colours.coats[s.coat]} opacity={Math.max(0, (frame.amount - .4) / .6) * .22} />)}</g>}
        {props.technique === "layers" ? [0, 1, 2].map(coat => <g key={coat} ref={element => { coatRefs.current[coat] = element; }} opacity={frame.marks.find(mark => mark.stroke.coat === coat)?.opacity ?? 1}>
          {strokes.map((stroke, index) => stroke.coat === coat ? <path key={stroke.id} ref={element => { markRefs.current[index] = element; }} d={frame.marks[index].path} fill={colours.coats[coat]} opacity={flatLayerPassOpacity(stroke.coat, frame.amount)} /> : null)}
        </g>) : <g clipPath={props.technique === "drybrush" ? `url(#${ridgeClip})` : undefined} mask={props.technique === "drybrush" ? `url(#${bristleMask})` : undefined}>
          {strokes.map((s, i) => <path key={s.id} ref={el => { markRefs.current[i] = el; }} d={frame.marks[i].path} fill={flatDepositedPaint(props.technique, colours.base, colours.coats[s.coat])} opacity={frame.marks[i].opacity} />)}
        </g>}
        {(props.technique === "layers" || props.technique === "edges") && <g ref={lightDiagram} display={frame.phase === "light" || props.experiment?.lighting ? "inline" : "none"}>
          {props.technique === "layers" ? <path d="M264 167C288 121 346 91 400 104C438 111 463 135 472 155C383 125 321 166 299 220C283 207 271 187 264 167Z" fill="#DFE6EC" opacity=".62" /> : <path d="M267 166 380 104 486 164 380 222Z" fill="#DCE6EB" opacity=".6" />}
        </g>}
      </g>
    </g>
    <g ref={light} display={frame.phase === "light" || props.experiment?.lighting ? "inline" : "none"}>
      <g ref={direction} transform={props.experiment?.lighting ? `rotate(${props.experiment.light + 31} 380 240)` : undefined} stroke="#8B979F" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M238 96 273 130 M261 129 273 130 272 118" />
        <path d="M225 82 228 85 M220 100H215 M243 78V73" opacity=".7" />
      </g>
    </g>
    <g ref={preparation} display={frame.phase === "mix" || frame.phase === "load" ? "inline" : "none"}>
      <rect x="167" y="118" width="208" height="225" rx="23" fill="#F8F8F4" stroke="#E2E5E4" strokeWidth="1" />
      <path d="M252 156C278 151 306 171 314 199C322 225 310 259 288 269C263 280 225 267 218 240C209 210 220 165 252 156Z" fill={colours.coats[0]} opacity=".7" />
      <path ref={unload} d="M283 229 340 285" pathLength="80" fill="none" stroke={colours.coats[0]} strokeWidth="17" strokeLinecap="round" strokeDasharray={`${frame.phase === "load" ? smooth((props.time - 28) / 2.3) * 80 : 0} 80`} opacity=".35" />
      <g ref={water} opacity={frame.phase === "mix" ? 1 : 0}>
        <path d="M333 156C333 148 340 141 344 134C348 141 355 148 355 156A11 11 0 0 1 333 156Z" fill="#DCE8EE" />
      </g>
      <rect x="423" y="145" width="173" height="181" rx="14" fill="#FAFAF7" stroke="#E2E5E4" strokeWidth="1" />
      {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M436 ${166 + i * 23}H583`} stroke="#DEE2E0" strokeWidth="1" />)}
      <path ref={testStroke} d="M468 207 531 292" pathLength="106" stroke={colours.coats[0]} strokeWidth="24" fill="none" strokeLinecap="round" opacity=".57" strokeDasharray={`${initialTestProgress * 106} 106`} />
    </g>
    <g ref={brush} transform={`translate(${initialBrushPoint.x} ${initialBrushPoint.y}) rotate(${initialBrush.angle}) scale(${props.detail && !initialPreparation ? 1.28 : 1})`} opacity={frame.phase === "light" ? 0 : initialBrush.opacity}>
      <ellipse ref={contactShadow} cx="0" cy="1" rx={initialBrush.width / 2} ry="2.5" fill="#25313B" opacity={initialBrush.contact ? .1 : 0} />
      <g ref={brushHandle} transform={handleTransform(initialBrush.pressure, props.technique === "edges")}>
        <path d="M-6 -49 -5 -99Q-4 -111 0 -113Q4 -111 5 -99L6 -49Z" fill="#414D56" />
        <path d="M-3 -56 -2 -97" fill="none" stroke="#68757C" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M-7 -53H7L10 -32H-10Z" fill="#BBC3C7" />
        <path d="M-6 -48H6M-8 -36H8" stroke="#93A0A7" strokeWidth=".8" />
      </g>
      <path ref={brushTip} d={tipPath(initialBrush.width, initialBrush.pressure, props.technique === "drybrush", props.technique === "edges")} fill={colours.coats[initialBrush.coat]} />
      <path ref={brushLines} d={bristlePath(initialBrush.width, initialBrush.pressure, props.technique === "drybrush", props.technique === "edges")} stroke={flatTint(colours.coats[initialBrush.coat], "#FFFFFF", .28)} strokeWidth=".65" opacity=".85" fill="none" strokeLinecap="round" />
    </g>
  </svg>;
}
