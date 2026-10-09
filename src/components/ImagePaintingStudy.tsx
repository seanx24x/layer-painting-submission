"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Check, Maximize2, Pause, Play, RotateCcw, Scan } from "lucide-react";
import Link from "next/link";
import guidePaints from "@/data/guide-paints.json";
import "./image-painting-study.css";

const IMAGE = "/images/ultramarine-study.png";
const DURATION = 19000;
const PANEL = "M714 319 C737 310 765 324 789 352 C813 384 829 423 835 454 L740 472 Q731 475 724 472 C715 444 708 410 706 376 C705 349 706 329 714 319Z";
const RECESS = "M712 332 C707 360 708 399 716 438 Q719 454 725 468 Q771 462 830 452";
const EDGE = "M731 461 Q777 454 825 446";
const strokes = [
  "M716 326 C714 365 718 416 728 460",
  "M734 325 C734 367 738 419 747 460",
  "M753 332 C753 373 758 420 767 456",
  "M775 346 C777 384 782 421 789 452",
  "M796 372 C801 407 805 429 810 447",
  "M815 411 C818 434 821 442 824 447",
];
const lessons = [
  { name: "Base coat", paint: "Macragge Blue", colour: guidePaints["macragge-blue"].hex, start: 1.7, end: 9, title: "Let the brush do the work.", detail: "Lay down overlapping strokes across the blue armour. The paint follows the brush tip and stays inside the panel.", hint: "Broad strokes · light pressure" },
  { name: "Recess shade", paint: "Abaddon Black + Nuln Oil", colour: "#24262c", start: 9.6, end: 12.7, title: "Find the meeting point.", detail: "Guide the tip along the recessed join beside the gold trim. Keep the shade off the broad surface.", hint: "Fine tip · follow the join" },
  { name: "Edge highlight", paint: "Altdorf Guard Blue", colour: guidePaints["altdorf-guard-blue"].hex, start: 13.4, end: 16.6, title: "Finish with a lighter touch.", detail: "Trace a fine highlight along the armour ridge. A narrow line makes the curved surface easier to read.", hint: "Side of the brush · one controlled line" },
];
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => n < 0.5 ? 4*n*n*n : 1-Math.pow(-2*n+2,3)/2;
const channel = (seconds: number, start: number, end: number) => clamp((seconds-start)/(end-start));
function subscribeMotion(change: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change",change);
  return () => query.removeEventListener("change",change);
}

/** Exact original bitmap, with reversible vector teaching layers in its coordinates. */
export function ImagePaintingStudy() {
  const uid = useId().replace(/:/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const camera = useRef<SVGGElement>(null);
  const brush = useRef<SVGGElement>(null);
  const progressLine = useRef<HTMLInputElement>(null);
  const elapsed = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [original, setOriginal] = useState(true);
  const [view, setView] = useState<"auto"|"whole"|"detail">("auto");
  const [mode, setMode] = useState<"motion"|"steps">("motion");
  const [selected, setSelected] = useState(0);
  const [imageState, setImageState] = useState<"loading"|"ready"|"error">("loading");
  const reduced = useSyncExternalStore(subscribeMotion,()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches,()=>false);
  const [observedReduced, setObservedReduced] = useState(reduced);
  if (observedReduced !== reduced) {
    setObservedReduced(reduced);
    if (reduced) setPlaying(false);
  }
  const staticMode = reduced || mode === "steps";
  const seconds = time / 1000;
  const stage = original ? selected : seconds < 9.6 ? 0 : seconds < 13.4 ? 1 : 2;
  const lesson = lessons[stage];
  const base = channel(seconds,1.7,9);
  const shade = channel(seconds,9.6,12.7);
  const edge = channel(seconds,13.4,16.6);
  const finished = seconds >= 16.6;
  const stageAmount = channel(seconds, lesson.start, lesson.end);
  const title = original ? "A small surface. A little practice." : lesson.title;

  useEffect(() => {
    let active = true;
    const asset = new window.Image();
    asset.src = IMAGE;
    void asset.decode().then(() => {
      if (active) setImageState("ready");
    }).catch(() => {
      if (active) setImageState("error");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!playing || staticMode || original) return;
    let raf = 0;
    let previous: number | null = null;
    const frame = (now: number) => {
      if (previous !== null) elapsed.current = Math.min(DURATION, elapsed.current + Math.min(now-previous,64));
      previous = now;
      setTime(elapsed.current);
      if (elapsed.current < DURATION) raf = requestAnimationFrame(frame);
      else setPlaying(false);
    };
    const hidden = () => { if(document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange",hidden);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("visibilitychange",hidden); };
  },[playing, staticMode, original]);

  // Camera, brush and SVG deposit paths share the same source-image coordinate
  // system. The brush tip is sampled from exactly the path revealing the paint.
  useEffect(() => {
    if (!svg.current || !camera.current || !brush.current) return;
    const zoom = original || view === "whole" ? 0 : view === "detail" || staticMode ? 1 : seconds < 1.4 ? ease(channel(seconds,0,1.4)) : seconds > 17.3 ? 1-ease(channel(seconds,17.3,19)) : 1;
    const scale = 0.80 + 2.60 * zoom;
    const cx = 543 + (772-543)*zoom;
    const cy = 724 + (410-724)*zoom;
    camera.current.setAttribute("transform",`translate(800 640) scale(${scale}) translate(${-cx} ${-cy})`);
    let path: SVGPathElement | null = null;
    let amount = 0;
    let active = false;
    let brushWidth = 1;
    if(seconds >= 1.7 && seconds < 9) {
      const pass = Math.min(5,Math.floor(base*6));
      const passTime = base*6-pass;
      amount = ease(clamp(passTime/0.88));
      active = passTime < 0.88;
      path = svg.current.querySelector(`[data-deposit="${pass}"]`);
    } else if(seconds >= 9.6 && seconds < 12.7) {
      path = svg.current.querySelector('[data-deposit="shade"]'); amount=ease(shade);active=true;brushWidth=.55;
    } else if(seconds >= 13.4 && seconds < 16.6) {
      path = svg.current.querySelector('[data-deposit="edge"]'); amount=ease(edge);active=true;brushWidth=.48;
    }
    if(path && !original) {
      const length=path.getTotalLength();
      const point=path.getPointAtLength(length*amount);
      const lift=active?0:9;
      brush.current.setAttribute("transform",`translate(${point.x+lift} ${point.y-lift}) rotate(${-48+Math.sin(amount*Math.PI)*5}) scale(${brushWidth} 1)`);
      brush.current.setAttribute("opacity",active?"1":"0.65");
    } else brush.current.setAttribute("opacity","0");
  },[seconds,original,view,staticMode,base,shade,edge]);

  function seek(next: number) { elapsed.current=next;setTime(next); }
  function play() {
    if(imageState!=="ready") return;
    if(playing) {setPlaying(false);return;}
    if(original || elapsed.current>=DURATION) {seek(0);setView("auto");}
    setOriginal(false);setPlaying(true);
  }
  function choose(index:number) {
    setPlaying(false);setOriginal(false);setSelected(index);setView("detail");seek((lessons[index].start+.001)*1000);
  }
  function step(amount:number) {
    setPlaying(false);setOriginal(false);setView("detail");
    const l=lessons[stage]; seek((l.start+(l.end-l.start)*amount)*1000);
  }
  const basePaths=strokes.map((d,i)=>({d,amount:ease(clamp((base*6-i)/.88))}));

  return <main className="image-study" id="main">
    <header className="image-study__header">
      <Link href="/guides/ultramarines-classic"><ArrowLeft size={15}/> Back to the guide</Link>
      <span>THE SHOULDER STUDY <i/> 01</span>
    </header>
    <div className="image-study__layout">
      <section className="image-study__visual" aria-label="Interactive painting demonstration">
        <div className="image-study__scene" data-image-state={imageState} data-source-image={IMAGE} data-stage={original?"original":lesson.name} data-playing={playing&&!staticMode}>
          <svg ref={svg} viewBox="0 0 1600 1280" role="img" aria-labelledby={`${uid}-title ${uid}-description`}>
            <title id={`${uid}-title`}>Space Marine shoulder painting study</title>
            <desc id={`${uid}-description`}>The original miniature image with a reversible painting demonstration on the right-hand shoulder. The brush visibly reveals blue paint, then follows a recessed join and raised edge. The rest of the image stays unchanged.</desc>
            <defs>
              <clipPath id={`${uid}-panel`}><path d={PANEL}/></clipPath>
              <filter id={`${uid}-primer`} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
                <feColorMatrix type="saturate" values="0"/>
                <feComponentTransfer><feFuncR type="linear" slope=".65" intercept=".27"/><feFuncG type="linear" slope=".65" intercept=".285"/><feFuncB type="linear" slope=".65" intercept=".30"/></feComponentTransfer>
              </filter>
              <mask id={`${uid}-remaining`} maskUnits="userSpaceOnUse" x="695" y="307" width="150" height="180">
                <path d={PANEL} fill="white"/>
                {basePaths.map(({d,amount},i)=><path key={i} d={d} pathLength="1" fill="none" stroke="black" strokeWidth="35" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1-amount} opacity={amount>0?1:0}/>) }
              </mask>
              <linearGradient id={`${uid}-ferrule`}><stop stopColor="#7d858d"/><stop offset=".35" stopColor="#eff1ed"/><stop offset=".64" stopColor="#a9b1b4"/><stop offset="1" stopColor="#515e65"/></linearGradient>
              <linearGradient id={`${uid}-wood`}><stop stopColor="#544338"/><stop offset=".40" stopColor="#9a7b58"/><stop offset=".6" stopColor="#735b40"/><stop offset="1" stopColor="#423c34"/></linearGradient>
              <linearGradient id={`${uid}-bristles`} x1="0" x2="0" y1="0" y2="1"><stop stopColor={stage===1?"#202b3b":stage===2?"#8ba7c9":"#354f7c"}/><stop offset=".5" stopColor="#9c8162"/><stop offset="1" stopColor="#b69a77"/></linearGradient>
            </defs>
            <g ref={camera} transform="translate(800 640) scale(.8) translate(-543 -724)">
              <image href={IMAGE} width="1086" height="1448" onLoad={()=>setImageState("ready")} onError={()=>setImageState("error")}/>
              {!original && <g clipPath={`url(#${uid}-panel)`}>
                <g mask={`url(#${uid}-remaining)`}><image href={IMAGE} width="1086" height="1448" filter={`url(#${uid}-primer)`}/></g>
                <path data-deposit="shade" d={RECESS} pathLength="1" fill="none" stroke="#152333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1-ease(shade)} opacity={shade>0?.82:0}/>
                <path data-deposit="edge" d={EDGE} pathLength="1" fill="none" stroke="#8eaac9" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="1 1" strokeDashoffset={1-ease(edge)} opacity={edge>0?.88:0}/>
              </g>}
              {/* Geometry-only paths let the same curve drive the mask and tip. */}
              <g visibility="hidden">{strokes.map((d,i)=><path key={i} data-deposit={i} d={d}/>)}</g>
              <g ref={brush} opacity="0" aria-hidden="true" data-brush-tip="true" pointerEvents="none">
                <ellipse cx="2" cy="4" rx="8" ry="3" fill="#1a2533" opacity=".18"/>
                <path d="M0 0 C-4 5-8 13-7 23 L7 23 C8 13 4 5 0 0Z" fill={`url(#${uid}-bristles)`}/>
                <path d="M-4 19L-1 4M1 19L1 4M4 20L2 7" fill="none" stroke="#e1c6a0" strokeWidth=".6" opacity=".38"/>
                <path d="M-7 22L-6 49Q0 53 6 49L7 22Z" fill={`url(#${uid}-ferrule)`}/>
                <path d="M-6 48Q-5 87-2 133Q0 141 2 133Q5 87 6 48Z" fill={`url(#${uid}-wood)`}/>
                <path d="M-5 25H5M-5 45H5" stroke="#404b50" strokeWidth=".7" opacity=".5"/>
                <path d="M-2 56L-1 116" stroke="#d4b996" strokeWidth=".7" opacity=".5"/>
              </g>
            </g>
          </svg>
          {imageState!=="ready" && <div className="image-study__loading" role="status">{imageState==="error"?"The image could not load. Refresh to try again.":"Preparing your miniature…"}</div>}
          <div className="image-study__tag"><span/>{original?"Original image":finished?"Inspect the result":lesson.hint}</div>
        </div>
        <div className="image-study__viewbar">
          <div role="group" aria-label="Image framing">
            <button aria-pressed={view==="whole"||original} onClick={()=>{setPlaying(false);setView("whole");}}><Maximize2 size={14}/>Whole miniature</button>
            <button aria-pressed={view==="detail"&&!original} onClick={()=>{setPlaying(false);setOriginal(false);setView("detail");}}><Scan size={14}/>Shoulder</button>
          </div>
          <button aria-pressed={original} onClick={()=>{setPlaying(false);setOriginal(!original);}}>{original?<Check size={13}/>:null}Original image</button>
        </div>
        <div className="image-study__transport">
          {!staticMode && <button className="image-study__play" onClick={play} disabled={imageState!=="ready"} aria-label={playing?"Pause brush animation":time>=DURATION?"Replay brush animation":"Play brush animation"}>{playing?<Pause size={18}/>:<Play size={18}/>}</button>}
          <div className="image-study__timeline">
            <div><span>{original?"Watch the paint follow the brush":finished?"A small panel, three techniques":lesson.name}</span><span>{Math.floor(seconds).toString().padStart(2,"0")} / 19 sec</span></div>
            <input ref={progressLine} type="range" min="0" max={DURATION} step="50" value={time} aria-label="Painting animation progress" aria-valuetext={`${lesson.name}, ${Math.round(time/DURATION*100)} percent`} onChange={e=>{setPlaying(false);setOriginal(false);setView("auto");seek(Number(e.target.value));}}/>
          </div>
          <button className="image-study__restart" aria-label="Reset painting study" onClick={()=>{setPlaying(false);setOriginal(true);setView("auto");seek(0);}}><RotateCcw size={17}/></button>
        </div>
      </section>
      <aside className="image-study__instruction">
        <span className="image-study__eyebrow">SMALL THINGS. MADE WITH CARE.</span>
        <h1>{title}</h1>
        <p className="image-study__intro">{original?"Get closer. Follow the brush. See how a few considered strokes bring a miniature to life.":lesson.detail}</p>
        <div className="image-study__steps" role="group" aria-label="Painting techniques">
          {lessons.map((item,i)=><button key={item.name} aria-pressed={stage===i} onClick={()=>choose(i)}><span className="image-study__step-number">0{i+1}</span><span><strong>{item.name}</strong><small>{item.paint}</small></span><i style={{background:item.colour}}/></button>)}
        </div>
        <div className="image-study__mode" role="group" aria-label="Playback mode">
          <button aria-pressed={!staticMode} disabled={reduced} onClick={()=>setMode("motion")}>Animation</button>
          <button aria-pressed={staticMode} onClick={()=>{setPlaying(false);setMode("steps");}}>Step by step</button>
        </div>
        <div className="image-study__checkpoints" role="group" aria-label="Inspect painting stages">
          <button aria-pressed={!original && stageAmount<.002} onClick={()=>step(0)}>Before</button><button aria-pressed={!original && Math.abs(stageAmount-.48)<.002} onClick={()=>step(.48)}>During</button><button aria-pressed={!original && stageAmount>.998} onClick={()=>step(1)}>After</button>
        </div>
        {staticMode?<p className="image-study__note">{reduced?"Reduced motion is on. ":""}Use Before, During and After to inspect each technique at your own pace.</p>:<p className="image-study__note">Pause anywhere or move through the timeline. Paint stays inside the selected armour panel.</p>}
        <p className="image-study__disclosure">An illustrative brush study using the original image. Its existing weathering and lighting are preserved; this is a demonstration of placement, not a paint colour simulation.</p>
        <p className="sr-only" role="status" aria-live="polite">{original?"Original image displayed":`${lesson.name}${playing&&!staticMode?", animation playing":", paused"}`}</p>
      </aside>
    </div>
  </main>;
}
