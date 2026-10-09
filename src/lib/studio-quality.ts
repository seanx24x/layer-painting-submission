import type { WebGLRenderer } from 'three';
/** Local diagnostics only. No telemetry, GPU readback, or extra render loop. */
export function studioQuality(renderer: WebGLRenderer, container: HTMLElement) {
  let last = 0, frames: number[] = [], ratio = Math.min(window.devicePixelRatio,2), draws = 0;
  return {
    begin(playing: boolean) {
      const now=performance.now();
      if(playing&&last&&now-last<150) frames.push(now-last);
      if(!playing) last=0; else last=now;
      if(frames.length>=90){
        const sorted=[...frames].sort((a,b)=>a-b);
        const median=sorted[Math.floor(sorted.length/2)];
        container.dataset.frameMs=median.toFixed(1);
        container.dataset.frameP95=sorted[Math.floor(sorted.length*.95)].toFixed(1);
        if(median>25&&ratio>1){ratio=Math.max(1,ratio-.25);renderer.setPixelRatio(ratio);renderer.setSize(container.clientWidth,container.clientHeight,false);}
        container.dataset.pixelRatio=ratio.toFixed(2);frames=[];
      }
      return now;
    },
    end(start:number){draws++;container.dataset.draws=String(draws);container.dataset.drawCpuMs=(performance.now()-start).toFixed(2);},
  };
}
