import sourcedGuidePaints from "@/data/guide-paints.json";
import fortyKGuides from "@/data/faction-guides-40k.json";
import heresyGuides from "@/data/faction-guides-heresy.json";
import { factionGuide } from "./faction-guide";

export type GuideSetting = "warhammer-40k" | "horus-heresy";
export const settingLabels: Record<GuideSetting, string> = {
  "warhammer-40k": "Warhammer 40,000",
  "horus-heresy": "Horus Heresy",
};
export const guideSetting = (guide: Pick<Guide, "setting">): GuideSetting => guide.setting ?? "warhammer-40k";

export type GuideTechnique =
  "basecoat" | "drybrush" | "wash" | "highlight" | "finish";

export interface GuidePaint {
  id: string;
  name: string;
  /** Illustrative UI colour, never a calibrated paint match. */
  hex: string;
  role: string;
  brand?: string;
  range?: string;
  catalogueId?: string;
  sourceUrl?: string;
  swatchKind?: string;
}

export interface GuideSource {
  id: string;
  title: string;
  url: string;
}

export interface GuideStep {
  id: string;
  title: string;
  action: string;
  detail: string;
  lookFor: string;
  /** Reviewed fallback copy, not an AI response. */
  simpleExplanation: string;
  technique: GuideTechnique;
  paintIds: string[];
  sourceIds: string[];
  exampleIds?: string[];
}

export interface Guide {
  id: string;
  slug: string;
  title: string;
  faction: string;
  setting?: GuideSetting;
  scheme?: string;
  editorialNote?: string;
  style: string;
  description: string;
  /** Editorial judgement about this exercise, not a source certification. */
  level: string;
  paints: GuidePaint[];
  paletteNote: string;
  steps: GuideStep[];
  sources: GuideSource[];
  prerequisites: string[];
  tools: string[];
  learning: string[];
  featured: boolean;
  accent: string;
}

const paletteNote =
  "Warhammer swatches are digitised from the manufacturer’s 2025 chart. Screen colours are approximate.";
function cataloguePaint(
  id: keyof typeof sourcedGuidePaints,
  role: string,
): GuidePaint {
  return { id, role, ...sourcedGuidePaints[id] };
}
const paintRange: GuideSource = {
  id: "warhammer-paint-range",
  title: "Warhammer Colour · Paint types explained",
  url: "https://paint.warhammer.com/the-paint-range/",
};

/**
 * Small, reviewed armour studies. These are original condensed teaching notes,
 * not reproductions of complete tutorials or claims to finish every model detail.
 * Keep preparation, source links and scope visible when displaying the content.
 */
const originalGuides: Guide[] = [
  {
    id: "ultramarines-grimdark",
    slug: "ultramarines-grimdark",
    title: "Blue armour, earned in battle",
    faction: "Ultramarines",
    style: "grimdark",
    description:
      "A seven-stage armour study adapted from Richard Gray. Practise texture, focused light and oil weathering. Weapons, markings and bases are outside this lesson.",
    level: "Intermediate · airbrush + oils",
    featured: true,
    accent: "#396BB0",
    paletteNote: `${paletteNote} The oil swatch is illustrative.`,
    paints: [
      cataloguePaint("macragge-blue", "Textured foundation"),
      cataloguePaint("calgar-blue", "First light"),
      cataloguePaint("blue-horror", "Brightest light"),
      {
        id: "burnt-umber",
        name: "Winsor & Newton Burnt Umber oil",
        hex: "#5C4438",
        role: "Grime",
      },
    ],
    prerequisites: [
      "A prepared miniature or practice piece, primed black and dry.",
      "Familiarity with your airbrush and oil products. New to painting? Try the classic blue study first.",
      "Follow product ventilation, protection and disposal instructions. Keep solvents away from heat and flames.",
    ],
    tools: [
      "Stippling brush",
      "Airbrush and suitable thinner",
      "Detail brush",
      "Separate oil brush",
      "Palette",
      "Paper towel",
      "Cotton buds",
      "Oil-compatible solvent",
      "Gloss varnish",
      "Compatible ultra-matte varnish",
    ],
    learning: [
      "Build a textured foundation",
      "Place light deliberately",
      "Control weathering by removal",
    ],
    sources: [
      {
        id: "richard-gray-grimdark",
        title: "Richard Gray · Grimdark Ultramarine",
        url: "https://richardgraycreations.com/video-tutorial-how-to-paint-a-grimdark-ultramarine/",
      },
      {
        id: "wn-oil-safety",
        title: "Winsor & Newton · Working with oils",
        url: "https://www.winsornewton.com/blogs/guides/introduction-to-oil-painting",
      },
      {
        id: "wn-solvent",
        title: "Winsor & Newton · Solvent precautions",
        url: "https://uk.winsornewton.com/products/solvents-winsor-newton-oil-colour-artists-solvent-artists-white-spirit",
      },
      paintRange,
    ],
    steps: [
      {
        id: "texture",
        title: "Build the texture",
        action: "Stipple Macragge Blue over black.",
        detail: "Unload on paper; dab, rather than drybrush.",
        lookFor: "Broken coverage.",
        simpleExplanation: "Make blue dabs.",
        technique: "basecoat",
        paintIds: ["macragge-blue"],
        sourceIds: ["richard-gray-grimdark"],
      },
      {
        id: "light",
        title: "Place the light",
        action: "Airbrush Calgar Blue onto upper armour.",
        detail: "Preserve dark areas.",
        lookFor: "Brighter shoulders and helmet.",
        simpleExplanation: "Brighten selected areas.",
        technique: "highlight",
        paintIds: ["calgar-blue"],
        sourceIds: ["richard-gray-grimdark"],
      },
      {
        id: "brightest",
        title: "Narrow the highlight",
        action: "Airbrush smaller Blue Horror highlights.",
        detail: "Stay within previous highlights.",
        lookFor: "Bright centres.",
        simpleExplanation: "Go smaller.",
        technique: "highlight",
        paintIds: ["blue-horror"],
        sourceIds: ["richard-gray-grimdark"],
      },
      {
        id: "seal",
        title: "Prepare for weathering",
        action: "Apply gloss varnish; let it dry.",
        detail: "Follow product instructions.",
        lookFor: "Dry surface.",
        simpleExplanation: "Seal before grime.",
        technique: "finish",
        paintIds: [],
        sourceIds: ["richard-gray-grimdark"],
      },
      {
        id: "grime",
        title: "Add the grime",
        action: "Thin Burnt Umber oil with suitable solvent; wash the armour.",
        detail: "Follow the linked tutorial and product precautions.",
        lookFor: "Darker recesses.",
        simpleExplanation: "Add a thin grime layer.",
        technique: "wash",
        paintIds: ["burnt-umber"],
        sourceIds: ["richard-gray-grimdark", "wn-oil-safety", "wn-solvent"],
      },
      {
        id: "lift",
        title: "Recover the light",
        action: "Dab settling oil off highlights with cotton buds.",
        detail: "Check for fibres.",
        lookFor: "Light returns.",
        simpleExplanation: "Lift excess grime.",
        technique: "wash",
        paintIds: [],
        sourceIds: ["richard-gray-grimdark"],
      },
      {
        id: "finish",
        title: "Finish and reflect",
        action: "Once oils cure, apply compatible ultra-matte varnish.",
        detail:
          "Restore selected blue highlights. Follow product cure guidance.",
        lookFor: "Your preferred contrast.",
        simpleExplanation: "Let it cure first.",
        technique: "finish",
        paintIds: ["calgar-blue", "blue-horror"],
        sourceIds: ["richard-gray-grimdark", "wn-oil-safety"],
      },
    ],
  },
  {
    id: "ultramarines-classic",
    slug: "ultramarines-classic",
    title: "A clean blue foundation",
    faction: "Ultramarines",
    style: "classic",
    description:
      "A focused brush-control exercise: blue armour, dark panel lines and crisp edges. Adapted from Stahly’s recipe using his listed Citadel alternatives. Other miniature details are outside this lesson.",
    editorialNote:
      "The armour recipe follows Stahly’s listed Citadel alternatives. Brush handling and drying guidance draw on Ángel Giráldez’s Redgrass book. The practice prompts and observable checkpoints are Layer’s teaching adaptation, not quotations or a quality assessment.",
    level: "Beginner practice · brush control",
    featured: false,
    accent: "#4267C9",
    paletteNote,
    paints: [
      cataloguePaint("macragge-blue", "Armour base"),
      cataloguePaint("abaddon-black", "Recess colour"),
      cataloguePaint("nuln-oil", "Recess mix"),
      cataloguePaint("altdorf-guard-blue", "Raised edges"),
      cataloguePaint("fenrisian-grey", "Fine highlights"),
    ],
    prerequisites: [
      "A prepared miniature or practice piece with dry grey primer.",
      "Try the sequence on one armour panel first. Completion records practice, not a quality grade.",
    ],
    tools: [
      "Medium brush",
      "Fine detail brush",
      "Palette",
      "Clean water",
      "Paper towel",
      "Good desk light",
    ],
    learning: [
      "Build an even base",
      "Separate adjacent panels",
      "Practise smaller highlights",
    ],
    sources: [
      {
        id: "stahly-ultramarines",
        title: "Stahly · Painting Ultramarines",
        url: "https://taleofpainters.com/2019/05/tutorial-how-to-paint-ultramarines/",
      },
      {
        id: "giraldez-brush-handling",
        title: "Ángel Giráldez · Paint preparation and brush handling (pp. 35, 42–43, 48)",
        url: "https://www.redgrasscreative.com/wp-content/uploads/2023/06/redgrass-free-painting-book-V2-2023-1-1.pdf#page=35",
      },
      paintRange,
    ],
    steps: [
      {
        id: "base",
        title: "Start with blue",
        action: "Apply a thin coat of Macragge Blue to one armour panel.",
        detail: "Mix the paint with a little water on your palette. Pull controlled strokes in one direction, then leave the coat to dry before adding another.",
        lookFor: "The blue becomes even while the sculpted edges stay distinct. If the first coat is patchy, let it dry and add another thin coat.",
        simpleExplanation: "Paint a thin blue layer. Let it dry, then repeat until the colour looks even.",
        technique: "basecoat",
        paintIds: ["macragge-blue"],
        sourceIds: ["stahly-ultramarines", "giraldez-brush-handling", "warhammer-paint-range"],
      },
      {
        id: "shade",
        title: "Find the panel lines",
        action:
          "Use Abaddon Black mixed with a little Nuln Oil to trace one recessed panel line.",
        detail: "Let the blue dry first. Use your detail brush to place the mixture in the gap between plates. Let the shade dry before tidying any spills.",
        lookFor: "A dark line separates the panels. The broad blue faces remain blue rather than covered by the shade.",
        simpleExplanation: "Place the dark mixture in a gap. Leave it to dry before fixing any paint that strays onto the blue.",
        technique: "wash",
        paintIds: ["abaddon-black", "nuln-oil"],
        sourceIds: ["stahly-ultramarines", "giraldez-brush-handling"],
      },
      {
        id: "tidy",
        title: "Reclaim the flat surfaces",
        action: "Cover any dry dark spills on the flat armour with Macragge Blue.",
        detail:
          "Work beside the recessed line with a controlled thin coat. If the spill still shows after drying, add another small coat rather than filling the gap.",
        lookFor: "Blue reaches the edge of the panel while a narrow dark line remains in the recess.",
        simpleExplanation: "Paint blue over the spill, keeping the dark paint inside the gap.",
        technique: "basecoat",
        paintIds: ["macragge-blue"],
        sourceIds: ["stahly-ultramarines", "giraldez-brush-handling"],
      },
      {
        id: "edge",
        title: "Define the edges",
        action: "Draw Altdorf Guard Blue along one accessible raised edge.",
        detail:
          "Brace your hands and turn the model so you can use the side of the bristles against the edge. Make a light pass before working around the next panel.",
        lookFor: "A narrow blue highlight follows the ridge. Most of the flat panel stays the darker base colour.",
        simpleExplanation: "Touch the side of the brush to the raised edge and follow it gently.",
        technique: "highlight",
        paintIds: ["altdorf-guard-blue"],
        sourceIds: ["stahly-ultramarines", "giraldez-brush-handling", "warhammer-paint-range"],
      },
      {
        id: "fine",
        title: "Add a finer highlight",
        action:
          "Add a narrower Fenrisian Grey line along the highlighted edge.",
        detail:
          "Let the earlier highlight dry. Practise on the same short edge first, using less brush contact so the new mark stays inside the Altdorf Guard Blue.",
        lookFor: "Both highlights remain visible: a fine pale line with the wider blue highlight beside it.",
        simpleExplanation: "Make a smaller light line. Keep a little of the first blue highlight showing.",
        technique: "highlight",
        paintIds: ["fenrisian-grey"],
        sourceIds: ["stahly-ultramarines", "giraldez-brush-handling"],
      },
      {
        id: "review",
        title: "Look at what changed",
        action: "Set the brush down and compare a flat panel, a recess and an edge.",
        detail:
          "Notice where your paint stayed controlled and where the mark grew wider. Save one thing to repeat and one specific adjustment for your next panel.",
        lookFor: "You can identify the blue surface, dark gap and lighter edge, then choose a next action such as making a narrower highlight.",
        simpleExplanation: "Find one mark you like and one you want to try again. Leave yourself a useful note.",
        technique: "finish",
        paintIds: [],
        sourceIds: [],
      },
    ],
  },
  {
    id: "salamanders-classic",
    slug: "salamanders-classic",
    title: "Green armour, caught by light",
    faction: "Salamanders",
    style: "classic",
    description:
      "Learn a forgiving drybrush sequence through a green armour study, adapted from Rob’s Warhammer Community recipe. Weapons, insignia and bases are outside this lesson.",
    level: "Beginner practice · drybrushing",
    featured: false,
    accent: "#487C53",
    paletteNote,
    paints: [
      cataloguePaint("warpstone-glow", "Foundation and recovery"),
      cataloguePaint("dark-angels-green", "Shadows"),
      cataloguePaint("moot-green", "Upper edges"),
    ],
    prerequisites: [
      "A prepared, primed practice piece. The source does not prescribe a primer colour for this recipe.",
      "Keep an unpainted test surface nearby to check brush loading.",
    ],
    tools: [
      "Medium brush",
      "Small drybrush",
      "Palette",
      "Clean water",
      "Paper towel",
      "Good desk light",
    ],
    learning: [
      "Recover colour after shading",
      "Control drybrush pressure",
      "Suggest light from above",
    ],
    sources: [
      {
        id: "rob-salamanders",
        title: "Warhammer Community · Rob’s Salamanders",
        url: "https://www.warhammer-community.com/en-gb/articles/AP3DV0Ri/warhammer-community-staff-tackle-the-space-marines-of-leviathan/",
      },
      {
        id: "warhammer-drybrush",
        title: "White Dwarf Bunker · Drybrushing",
        url: "https://assets.warhammer-community.com/eng_hobby-hangout-zc9pb6pzsz-4nwupcj1la.pdf",
      },
      paintRange,
    ],
    steps: [
      {
        id: "base",
        title: "Establish the green",
        action: "Basecoat the armour with Warpstone Glow.",
        detail: "Aim for a consistent foundation before shading.",
        lookFor: "Even green armour.",
        simpleExplanation: "Start with one consistent green.",
        technique: "basecoat",
        paintIds: ["warpstone-glow"],
        sourceIds: ["rob-salamanders"],
      },
      {
        id: "shade",
        title: "Deepen the shadows",
        action: "Shade using two parts water to one part Dark Angels Green.",
        detail:
          "This is Rob’s specific Contrast mix, not a rule for other paints. Allow it to dry.",
        lookFor: "Darker details and recesses.",
        simpleExplanation: "Mix two drops of water with one of this paint.",
        technique: "wash",
        paintIds: ["dark-angels-green"],
        sourceIds: ["rob-salamanders"],
      },
      {
        id: "recover",
        title: "Bring the green back",
        action: "Drybrush the armour with Warpstone Glow.",
        detail:
          "Load the brush tip, then remove most paint on paper towel. Sweep the nearly dry bristles across raised details, leaving the recesses dark.",
        lookFor: "Brighter raised surfaces.",
        simpleExplanation:
          "Use very little paint; brush over the raised shapes.",
        technique: "drybrush",
        paintIds: ["warpstone-glow"],
        sourceIds: ["rob-salamanders", "warhammer-drybrush"],
      },
      {
        id: "light",
        title: "Let light fall from above",
        action: "Lightly drybrush Moot Green from top to bottom.",
        detail: "Keep this brighter pass restrained.",
        lookFor: "Upper edges catching the light.",
        simpleExplanation: "Brush downwards with the lighter green.",
        technique: "drybrush",
        paintIds: ["moot-green"],
        sourceIds: ["rob-salamanders"],
      },
      {
        id: "review",
        title: "Read the shape",
        action: "Turn the piece under your desk light.",
        detail:
          "Compare the upper and lower surfaces. Save one observation to help your next attempt.",
        lookFor: "Something you want to repeat.",
        simpleExplanation: "Choose what worked for you.",
        technique: "finish",
        paintIds: [],
        sourceIds: [],
      },
    ],
  },
];

export const guides: Guide[] = [...originalGuides, ...fortyKGuides.map(factionGuide), ...heresyGuides.map(factionGuide)];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
