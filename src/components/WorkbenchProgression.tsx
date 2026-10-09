"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** One navigation instance, with measured space reserved for its mobile dock. */
export function WorkbenchProgression({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const node = ref.current;
    const workbench = node?.closest<HTMLElement>(".painting-workbench");
    if (!node || !workbench) return;
    const measure = () => workbench.style.setProperty("--workbench-dock-height", `${node.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    const focus = () => setEditing(document.activeElement instanceof HTMLElement &&
      document.activeElement.matches('textarea, input:not([type="checkbox"]):not([type="range"]):not([type="button"])'));
    const onBlur = () => queueMicrotask(focus);
    document.addEventListener("focusin", focus);
    document.addEventListener("focusout", onBlur);
    return () => {
      observer.disconnect();
      workbench.style.removeProperty("--workbench-dock-height");
      document.removeEventListener("focusin", focus);
      document.removeEventListener("focusout", onBlur);
    };
  }, []);
  return <div ref={ref} className="workbench-progression" data-editing={editing || undefined}>{children}</div>;
}
