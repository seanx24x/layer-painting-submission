"use client";

import { useId } from "react";
import type { TechniqueLessonId } from "@/lib/technique-lessons";
import "./technique-cover.css";

/** Quiet surface studies. Their small tonal differences describe the technique. */
export function TechniqueCover({ technique }: { technique: TechniqueLessonId }) {
  const id = useId().replaceAll(":", "");
  const light = `${id}-light`;
  const paper = `${id}-paper`;
  const relief = `${id}-relief`;
  const surface = `${id}-surface`;

  return (
    <svg className="technique-cover" viewBox="0 0 400 320" aria-hidden="true" focusable="false" data-technique={technique}>
      <defs>
        <radialGradient id={light} cx=".29" cy=".23" r=".87">
          <stop stopColor="#ffffff" />
          <stop offset=".48" stopColor="#f8f8f5" />
          <stop offset="1" stopColor="#d9dad4" />
        </radialGradient>
        <linearGradient id={paper} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fdfdfb" />
          <stop offset="1" stopColor="#e9e9e4" />
        </linearGradient>
        <linearGradient id={relief} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset=".65" stopColor="#f7f7f3" />
          <stop offset="1" stopColor="#e0e1db" />
        </linearGradient>
        <clipPath id={surface}><rect x="106" y="68" width="188" height="184" rx="6" /></clipPath>
      </defs>

      {technique === "light" && <>
        <circle cx="211" cy="163" r="86" fill={`url(#${light})`} />
        <path d="M98 73L134 102" stroke="#c6c8c0" strokeWidth="1" strokeDasharray="2 5" />
        <circle cx="85" cy="62" r="13" fill="none" stroke="#d7d9d1" />
        <circle cx="85" cy="62" r="3" fill="#bfc2b7" />
      </>}

      {technique === "layers" && <g transform="rotate(-9 200 160)">
        <rect x="106" y="68" width="188" height="184" rx="6" fill="#e6e7e0" />
        <g clipPath={`url(#${surface})`} fill="#ffffff">
          <path d="M97 91Q149 87 203 91T303 91V132Q251 136 200 131T97 132Z" opacity=".37" />
          <path d="M97 124Q147 119 202 124T303 124V182Q249 186 201 181T97 181Z" opacity=".61" />
          <path d="M97 173Q154 168 202 173T303 173V236Q248 241 200 236T97 236Z" opacity=".88" />
        </g>
        <rect x="106.5" y="68.5" width="187" height="183" rx="5.5" fill="none" stroke="#dedfd8" strokeOpacity=".45" />
      </g>}

      {technique === "edges" && <g transform="rotate(-9 200 160)" strokeLinejoin="round">
        <path d="M109 77L201 64L292 83V247L201 232L109 248Z" fill="#e4e5de" />
        <path d="M109 77L201 64V232L109 248Z" fill={`url(#${paper})`} />
        <path d="M201 64V232" fill="none" stroke="#ffffff" strokeWidth="2.6" />
        <path d="M109 77L201 64L292 83" fill="none" stroke="#ffffff" strokeWidth="1" />
      </g>}

      {technique === "recess" && <g transform="rotate(-9 200 160)">
        <rect x="106" y="68" width="188" height="184" rx="6" fill="#dadcd3" />
        <rect x="106" y="68" width="91" height="87" rx="3" fill={`url(#${paper})`} />
        <rect x="201" y="68" width="93" height="87" rx="3" fill={`url(#${paper})`} />
        <rect x="106" y="159" width="91" height="93" rx="3" fill={`url(#${paper})`} />
        <rect x="201" y="159" width="93" height="93" rx="3" fill={`url(#${paper})`} />
        <path d="M202 70V154M108 160H196M202 160H291M202 161V249" fill="none" stroke="#ffffff" strokeWidth="1" opacity=".85" />
      </g>}

      {technique === "drybrush" && <g transform="rotate(-9 200 160)">
        <rect x="106" y="68" width="188" height="184" rx="6" fill="#e7e8e1" />
        {Array.from({ length: 7 }, (_, index) => {
          const y = 85 + index * 23;
          return <g key={y}>
            <rect x="107" y={y} width="186" height="11" rx="4" fill={`url(#${relief})`} />
            <path d={`M${125 + index % 3 * 12} ${y + 1.3}H${268 - index % 2 * 19}`} stroke="#ffffff" strokeWidth="2.1" strokeLinecap="round" strokeDasharray="19 3 31 2 11 4 23" />
          </g>;
        })}
      </g>}
    </svg>
  );
}
