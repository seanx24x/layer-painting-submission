import type { TechniqueId } from "./technique-study-types";
import type { StudyPalette } from "./study-palette";

/** A light foundation is a lesson, not a new coach action or guide technique. */
export type TechniqueLessonId = TechniqueId | "light";
export type TechniqueSource = { id: string; name: string; url: string; verifiedAt: string };
export type TechniqueChapter = {
  id: string;
  title: string;
  prepared: string;
  instruction: string;
  lookFor: string;
  mistake: string;
  practice: string;
  sourceIds: readonly string[];
};
export type TechniqueLesson = {
  id: TechniqueLessonId;
  label: string;
  outcome: string;
  intro: string;
  chapters: readonly TechniqueChapter[];
};

// Teaching references, checked against the publishers' own material. The
// exercises and demonstrations are original Layer studies, not reproductions.
export const TECHNIQUE_LESSON_SOURCES: readonly TechniqueSource[] = [
  {
    id: "giraldez-basics",
    name: "Ángel Giráldez · paint preparation and brush control",
    url: "https://www.redgrasscreative.com/wp-content/uploads/2023/06/redgrass-free-painting-book-V2-2023-1-1.pdf",
    verifiedAt: "2026-10-09",
  },
  {
    id: "lappat-light",
    name: "Roman Lappat · planning light and shadow",
    url: "https://massivevoodoo.blogspot.com/2010/08/tutorial-zenithal-lightning-work-order.html",
    verifiedAt: "2026-10-09",
  },
  {
    id: "warhammer-highlights",
    name: "Warhammer painting team · edges and corner highlights",
    url: "https://www.warhammer-community.com/en-gb/articles/nJFh2M9g/highlights-basing-and-eyes-the-warhammer-painting-team-answer-your-hobby-questions/",
    verifiedAt: "2026-10-09",
  },
  {
    id: "artis-opus-moisture",
    name: "Artis Opus · controlled drybrush moisture",
    url: "https://store.artis-opus.com/products/dampening-pad-preorder",
    verifiedAt: "2026-10-09",
  },
];

export const TECHNIQUE_LESSON_ORDER: readonly TechniqueLessonId[] = ["light", "layers", "edges", "recess", "drybrush"];

export const TECHNIQUE_LESSONS: Record<TechniqueLessonId, TechniqueLesson> = {
  light: {
    id: "light",
    label: "Light & form",
    outcome: "Choose where the light belongs before you paint it.",
    intro: "Move a light across simple forms, then turn what you see into a plan for your highlights.",
    chapters: [
      {
        id: "place", title: "Choose where the light comes from.",
        prepared: "An unpainted matte form, ready to inspect.",
        instruction: "Drag the light around the form. Pause at an angle where you can distinguish a bright area from a darker one.",
        lookFor: "The brighter area faces the light. Surfaces turning away receive less of it.",
        mistake: "Moving the light does not repaint the object. Choose a direction to keep when you start painting.",
        practice: "Use the presets, then choose one position of your own. Point to its light-facing and shadow areas before continuing.",
        sourceIds: ["lappat-light"],
      },
      {
        id: "read", title: "Compare a curve with a flat face.",
        prepared: "Your chosen light position, held still.",
        instruction: "Switch between the sphere and the block. Keep the light in one place and follow how the surface turns beneath it.",
        lookFor: "A curve changes gradually; adjoining flat faces can have distinct brightness.",
        mistake: "Every upper surface need not be equally bright. Its angle to your chosen light matters.",
        practice: "Find a curved panel and a flat panel on your miniature. Decide how their highlights should differ.",
        sourceIds: ["lappat-light"],
      },
      {
        id: "paint", title: "Make a plan for your highlights.",
        prepared: "A light direction and a form you have inspected.",
        instruction: "Switch to Where to paint. Use the simplified regions to plan darker paint, a middle colour and a smaller highlight.",
        lookFor: "The highlight stays on the light-facing area, leaving room for midtone and shadow.",
        mistake: "This map is a starting point for a matte surface. Metal, reflections and cast shadows need further study.",
        practice: "Sketch three regions for one armour panel. Keep this plan beside you when you practise thin layers.",
        sourceIds: ["lappat-light", "warhammer-highlights"],
      },
    ],
  },
  layers: {
    id: "layers",
    label: "Thin layers",
    outcome: "Build even colour while keeping the surface detail clear.",
    intro: "Prepare a controllable brush, build coverage in separate coats, then place a smaller highlight.",
    chapters: [
      {
        id: "prepare", title: "Mix the paint, then test a stroke.",
        prepared: "Paint on your palette and a primed practice surface.",
        instruction: "Mix in a little water and test the paint. Add gradually until it moves smoothly without puddling.",
        lookFor: "A continuous mark that leaves fine texture readable.",
        mistake: "A fixed water ratio will not suit every paint. Judge the mark you make.",
        practice: "Compare two small test strokes before painting your model.",
        sourceIds: ["giraldez-basics"],
      },
      {
        id: "load", title: "Draw off the excess paint.",
        prepared: "Mixed paint that flows in your test stroke.",
        instruction: "Load the brush, draw it across the palette and reshape its point. Test again with this smaller load.",
        lookFor: "A controlled start without a large bead of liquid.",
        mistake: "If the first touch floods, unload and retest rather than changing the mixture immediately.",
        practice: "Make three short strokes with a consistent starting mark.",
        sourceIds: ["giraldez-basics"],
      },
      {
        id: "first-coat", title: "Apply one thin coat.",
        prepared: "Dry primer and a brush carrying a tested amount of paint.",
        instruction: "Pull a controlled stroke across the panel, then lift. Work beside it without repeatedly disturbing drying paint.",
        lookFor: "An even application; some primer may remain visible.",
        mistake: "Stop if the surface becomes tacky. Give it time to dry before correcting it.",
        practice: "Paint one panel and inspect its texture when dry.",
        sourceIds: ["giraldez-basics"],
      },
      {
        id: "second-coat", title: "Let it dry, then build coverage.",
        prepared: "A first coat that has dried fully.",
        instruction: "Apply the same colour again in controlled passes. The demonstration skips drying time; your miniature needs the real pause.",
        lookFor: "More opaque colour without a ridge of paint.",
        mistake: "Adding paint while the earlier coat is wet can disturb it. Wait and reassess.",
        practice: "Compare your dried first and second coats. Add more only where coverage needs it.",
        sourceIds: ["giraldez-basics"],
      },
      {
        id: "depth", title: "Place a smaller, lighter layer.",
        prepared: "An even, dry basecoat and a chosen light direction.",
        instruction: "Use a lighter colour over a smaller light-facing area. Leave the earlier colour around it.",
        lookFor: "A brighter area that describes the form without replacing the entire basecoat.",
        mistake: "Repeating one colour improves coverage; a lighter colour creates this highlight.",
        practice: "Place one small highlight, inspect from normal viewing distance, then decide whether it needs more.",
        sourceIds: ["giraldez-basics", "lappat-light"],
      },
    ],
  },
  edges: {
    id: "edges",
    label: "Edge highlighting",
    outcome: "Define a raised edge with a controlled, narrow highlight.",
    intro: "Let an accessible edge guide the side of your brush. Refine the line, then choose a few brighter corners.",
    chapters: [
      {
        id: "stage-1", title: "Guide the brush along a raised edge.",
        prepared: "A dry basecoat and an accessible raised edge.",
        instruction: "Turn the model for a comfortable angle. Touch the side of the brush near its tip to the edge and draw it along gently.",
        lookFor: "The line follows the edge while the broad face stays clear.",
        mistake: "A spreading line can mean excess paint or pressure. Unload the brush and try a lighter touch.",
        practice: "Highlight one short edge. Rotate your model before trying the next.",
        sourceIds: ["giraldez-basics", "warhammer-highlights"],
      },
      {
        id: "stage-2", title: "Add a finer highlight inside the first.",
        prepared: "A first edge highlight that has dried.",
        instruction: "Use a brighter colour and less contact. Follow the existing edge with a narrower line, leaving the earlier colour visible beside the new mark.",
        lookFor: "Two distinct widths rather than one thick stripe.",
        mistake: "If the earlier line disappears, stop, let it dry and restore its edge with the earlier colour.",
        practice: "Refine one edge and compare its width with the first pass.",
        sourceIds: ["warhammer-highlights"],
      },
      {
        id: "stage-3", title: "Touch in selected bright corners.",
        prepared: "Dry edge highlights with a few light-facing corners chosen.",
        instruction: "Place a tiny brighter mark where selected edges meet. Lift immediately and inspect before adding another.",
        lookFor: "Small accents that draw attention without turning every corner equally bright.",
        mistake: "A large dot can overpower the edge. Let it dry, reduce it with the previous colour and try again.",
        practice: "Choose two corners. Compare the result at normal viewing distance.",
        sourceIds: ["warhammer-highlights"],
      },
    ],
  },
  recess: {
    id: "recess",
    label: "Recess shading",
    outcome: "Separate surfaces with shade placed inside their recesses.",
    intro: "Practise controlled placement in a groove. Connect the lines and deepen only the areas that need it.",
    chapters: [
      {
        id: "stage-1", title: "Place a small amount of shade in a groove.",
        prepared: "A fully dry basecoat with a visible recessed line.",
        instruction: "Bring the brush tip to the groove and guide a small amount of shade along it. Refill in small amounts.",
        lookFor: "A darker groove with its neighbouring surfaces still readable.",
        mistake: "If liquid pools, touch it with a clean, damp brush to lift the excess before it begins drying.",
        practice: "Shade one short recess before working around the rest of a panel.",
        sourceIds: ["giraldez-basics"],
      },
      {
        id: "stage-2", title: "Build depth in connected recesses.",
        prepared: "An initial pass of shade, fully dry, with the broad surfaces clear.",
        instruction: "Add another narrow pass along selected connected grooves. Keep the raised surfaces clear and inspect the intersections for excess liquid.",
        lookFor: "Stronger separation along the grooves without a wet pool at the intersection.",
        mistake: "Do not keep brushing shade that has started drying. Leave it to dry, then correct the area.",
        practice: "Repeat a controlled pass along one dry panel boundary and check each corner for excess liquid.",
        sourceIds: ["giraldez-basics"],
      },
      {
        id: "stage-3", title: "Inspect the dry shade and refine it.",
        prepared: "The earlier shade has dried completely.",
        instruction: "Compare the recesses. Add another controlled pass only where you want stronger separation.",
        lookFor: "Clear recesses with the base colour preserved on the raised surfaces.",
        mistake: "If shade has stained a broad face, restore it with thin base-colour passes after everything dries.",
        practice: "Choose one recess to deepen and leave another untouched. Compare the difference.",
        sourceIds: ["giraldez-basics"],
      },
    ],
  },
  drybrush: {
    id: "drybrush",
    label: "Drybrushing",
    outcome: "Catch raised texture while preserving darker gaps.",
    intro: "Use very little paint and gentle contact. This study follows a controlled-moisture method; other recipes may prepare the brush differently.",
    chapters: [
      {
        id: "stage-1", title: "Skim raised texture with a prepared brush.",
        prepared: "A dry basecoat and a lightly damp drybrush, unloaded and tested on spare texture.",
        instruction: "With the brush prepared and tested, sweep lightly across the raised detail. Let the bristles skim the tops while leaving the darker gaps clear.",
        lookFor: "Colour catches the tops without flooding the gaps.",
        mistake: "If the test leaves a wet smear, remove more paint and moisture. If it is chalky, reassess brush moisture and paint build-up.",
        practice: "Before painting, start with slightly damp bristles, work out most paint on a non-absorbent textured palette and test on spare texture. Follow your recipe if it specifies a different preparation method.",
        sourceIds: ["artis-opus-moisture"],
      },
      {
        id: "stage-2", title: "Build colour with gentle passes.",
        prepared: "A tested brush load and an initial pass across the texture.",
        instruction: "Repeat light sweeps across the raised areas. Inspect between passes and let applied paint dry before building further.",
        lookFor: "The ridges become clearer while the low areas remain dark.",
        mistake: "More pressure pushes the bristles into the gaps. Reduce contact rather than trying to force coverage.",
        practice: "Compare one pass with several gentle passes on a spare textured piece.",
        sourceIds: ["artis-opus-moisture", "giraldez-basics"],
      },
      {
        id: "stage-3", title: "Keep the final highlights restrained.",
        prepared: "Dry raised texture with the earlier colour still visible.",
        instruction: "Use a smaller amount of a lighter colour. Focus gentle contact on the highest details you want to emphasise.",
        lookFor: "A few lighter peaks, with earlier colour still surrounding them.",
        mistake: "Covering every ridge equally can flatten the result. Stop and compare before adding more.",
        practice: "Highlight one small area, then look at the whole piece to decide whether it needs another pass.",
        sourceIds: ["artis-opus-moisture", "warhammer-highlights"],
      },
    ],
  },
};

/**
 * Keep the whole teaching card consistent with an authored guide palette.
 * Paint identity, not a hex comparison, decides whether this is another pass
 * with one paint. Standalone studies and the light foundation remain unchanged.
 */
export function paletteTechniqueChapter(
  lessonId: TechniqueLessonId,
  chapter: TechniqueChapter,
  palette?: StudyPalette,
): TechniqueChapter {
  if (!palette || lessonId === "light") return chapter;
  const index = TECHNIQUE_LESSONS[lessonId].chapters.findIndex(item => item.id === chapter.id);
  if (index < 0) return chapter;
  const [first, second, final] = palette.coats;
  if (lessonId === "layers") {
    switch (chapter.id) {
      case "prepare": return { ...chapter, instruction: `Mix a little water into ${first.name} on your palette and test a stroke. Add gradually until it moves smoothly without puddling.` };
      case "load": return { ...chapter, instruction: `Load the brush with ${first.name}, draw it across the palette and reshape its point. Test again with this smaller load.` };
      case "first-coat": return { ...chapter, instruction: `Apply ${first.name} in a controlled stroke across the panel, then lift. Work beside it without repeatedly disturbing drying paint.` };
      case "second-coat": return { ...chapter, instruction: `Apply ${second.name}${second.id === first.id ? " again" : ""} in controlled passes once the first coat is dry. The demonstration skips drying time; your miniature needs the real pause.` };
      case "depth": return final.id === first.id ? {
        ...chapter,
        title: "Refine the coverage with the same paint.",
        instruction: `Use ${final.name} for a restrained final pass after the previous coat dries. Keep the application thin and preserve the surface detail. This guide step repeats one paint; follow the guide for later highlights.`,
        lookFor: "More even coverage with the surface detail still clear.",
        mistake: "Another pass with the same paint builds coverage. It does not introduce a new highlight colour.",
        practice: `Inspect a dry panel and use ${final.name} only where its coverage needs a final pass.`,
      } : { ...chapter, instruction: `Use ${final.name} over a smaller light-facing area. Leave the earlier ${second.name} colour around it.` };
    }
  }
  if (lessonId === "edges") {
    if (index === 0) return { ...chapter, instruction: `Load a small amount of ${first.name} and turn the model for a comfortable angle. Touch the side of the brush near its tip to the edge and draw it along gently.` };
    const paint = palette.coats[index];
    const previous = palette.coats[index - 1];
    if (index === 1) return paint.id === previous.id ? {
      ...chapter,
      title: "Refine the line with the same paint.",
      instruction: `Use ${paint.name} again with less contact. Follow the existing dry edge highlight and keep the new pass narrow.`,
      lookFor: "A controlled, narrow line with the broad faces clear.",
      mistake: `If the line spreads onto a broad face, let it dry and tidy the outside with ${palette.base.name}. Adding more ${paint.name} will not make it narrower.`,
      practice: "Keep one existing edge narrow and controlled. Compare its width before continuing around the model.",
    } : { ...chapter, instruction: `Use ${paint.name} with less contact. Follow the existing edge with a narrower line, leaving ${previous.name} visible beside the new mark.` };
    return paint.id === previous.id ? {
      ...chapter,
      title: "Place small accents on selected corners.",
      instruction: `Use tiny touches of ${paint.name} on selected light-facing corners. Lift immediately and inspect before adding another. This pass uses the same paint as the previous one.`,
      lookFor: "Small, deliberate marks confined to the selected corners.",
      mistake: `If a mark spreads, let it dry before tidying it. Repeating ${paint.name} does not introduce a brighter paint.`,
      practice: "Choose two corners and practise keeping each mark small. Compare them at normal viewing distance.",
    } : { ...chapter, instruction: `Place a tiny mark of ${paint.name} where selected light-facing edges meet. Lift immediately and inspect before adding another.` };
  }
  if (lessonId === "recess") {
    const paint = palette.coats[index];
    const instructions = [
      `Bring a small amount of ${paint.name} to the groove with the brush tip. Guide it along the recessed line and refill in small amounts.`,
      `Add another narrow pass of ${paint.name} along selected dry, connected grooves. Keep the raised surfaces clear and inspect the intersections for excess liquid.`,
      `Compare the dry recesses. Add another controlled pass of ${paint.name} only where you want stronger separation.`,
    ];
    return { ...chapter, instruction: instructions[index] };
  }
  if (lessonId === "drybrush") {
    if (index === 0) return { ...chapter, instruction: `With the brush prepared and tested, sweep a very small amount of ${first.name} across the raised detail. Let the bristles skim the tops while leaving the darker gaps clear.` };
    if (index === 1) return { ...chapter, instruction: `Build ${second.name} with light sweeps across the raised areas. Inspect between passes and let applied paint dry before building further.` };
    return final.id === second.id ? {
      ...chapter,
      title: "Keep the final passes restrained.",
      instruction: `Use very little ${final.name} for the final passes. Focus gentle contact on the highest details and keep the darker gaps clear. This pass repeats the previous paint.`,
      lookFor: "A controlled final application on the highest texture, with the gaps still dark.",
      mistake: "Repeated passes build coverage. Stop before they cover the gaps or obscure the texture.",
      practice: `Try one small final pass with ${final.name}, then inspect the whole piece before deciding whether to add more.`,
    } : { ...chapter, instruction: `Use a smaller amount of ${final.name}. Focus gentle contact on the highest details and leave ${second.name} visible around them.` };
  }
  return chapter;
}
