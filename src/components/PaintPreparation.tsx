const mistakes = [
  { name: "Raised ridges", cause: "Paint too thick for this layer", fix: "Mix in a little water, test again, and aim for a smooth mark that preserves surface detail." },
  { name: "A flooded stroke", cause: "Too much liquid in the brush", fix: "Draw off the excess on your palette. Test again before changing the mixture." },
  { name: "A torn layer", cause: "Working over partially dried paint", fix: "Stop brushing and let the layer dry fully before adding another controlled coat." },
];
export function PaintMistake({ index, color }: { index: number; color?: string }) {
  const item = mistakes[index];
  return <div className="paint-mistake"><svg viewBox="0 0 320 100" role="img" aria-label={item.name}>
    <rect width="320" height="100" rx="10" fill="#e8e6df"/>
    <path d="M40 49 Q130 34 275 53" stroke={color ?? "#285cdf"} strokeWidth={index===1?39:31} strokeLinecap="round" fill="none" opacity={index===1?.35:.85}/>
    {index===0 && [0,1,2,3].map(i=><path key={i} d={`M44 ${36+i*8} Q135 ${23+i*9} 270 ${41+i*8}`} fill="none" stroke={color ? "white" : "#97b3f9"} strokeOpacity={color ? .5 : 1} strokeWidth="3"/>)}
    {index===1 && <ellipse cx="264" cy="53" rx="26" ry="24" fill={color ?? "#285cdf"} opacity=".45"/>}
    {index===2 && <path d="M98 37l20 7-9 11 25-3 6 15 30-22 19 13 15-21" fill="none" stroke="#e8e6df" strokeWidth="12"/>}
  </svg><strong>{item.cause}</strong><p>{item.fix}</p><small>Illustrated comparison, not a diagnosis of your paint.</small></div>;
}
