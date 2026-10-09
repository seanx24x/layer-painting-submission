"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { StudyPalette } from "@/lib/study-palette";
import type { ShapePaintSceneProps } from "@/components/ShapePaintScene";

const ShapePaintScene = dynamic(() => import("@/components/ShapePaintScene"), { ssr: false });

const spherePalette: StudyPalette = {
  base: { id: "primer", name: "Porcelain white", hex: "#fafaf7" },
  coats: [
    { id: "lilac", name: "Soft lilac", hex: "#c7c3df" },
    { id: "blue", name: "Powder blue", hex: "#bdcfe6" },
    { id: "mint", name: "Pale mint", hex: "#c6dfd9" },
  ],
};

const tileBase = { id: "artwork-sage", name: "Pale sage", hex: "#d3e1dc" };
const recessPalette: StudyPalette = {
  base: tileBase,
  coats: [
    { id: "sage-wash", name: "Sage wash", hex: "#aac8bc" },
    { id: "sage-shade", name: "Sage shade", hex: "#91b2a5" },
    { id: "sage-depth", name: "Sage depth", hex: "#789b90" },
  ],
};
const drybrushPalette: StudyPalette = {
  base: tileBase,
  coats: [
    { id: "pale-sage", name: "Pale sage", hex: "#e6efe8" },
    { id: "ivory", name: "Ivory", hex: "#f1f4ec" },
    { id: "chalk", name: "Chalk", hex: "#fafbf5" },
  ],
};

export function ThumbnailCapture(props: Pick<ShapePaintSceneProps, "technique" | "time" | "duration" | "view">) {
  const [status, setStatus] = useState("loading");
  const ready = useCallback(() => setStatus("ready"), []);
  const error = useCallback(() => setStatus("error"), []);
  return <main style={{ padding: 20 }}>
    <div id="thumbnail-render" data-status={status} style={{ position: "relative", width: 1000, height: 800, overflow: "hidden", background: "var(--object-stage-background)" }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <ShapePaintScene {...props} palette={props.technique === "layers" ? spherePalette : props.technique === "recess" ? recessPalette : props.technique === "drybrush" ? drybrushPalette : undefined} artwork playing={false} onReady={ready} onError={error} />
      </div>
    </div>
    <p style={{ marginTop: 16 }}>{props.technique} · {props.time}s · {props.view} · {status}</p>
    <nav style={{ display: "flex", gap: 20, paddingTop: 12 }}>
      {["layers", "edges", "recess", "drybrush"].map((technique) => <a key={technique} href={`?technique=${technique}`}>{technique}</a>)}
    </nav>
  </main>;
}
