export const equipmentCategories = [
  {
    "id": "prepare",
    "name": "Cut & prepare",
    "title": "A clean beginning.",
    "description": "Remove seams, refine surfaces and make precise cuts."
  },
  {
    "id": "assemble",
    "name": "Assemble & sculpt",
    "title": "Give it form.",
    "description": "Join, hold and shape your miniature."
  },
  {
    "id": "paint",
    "name": "Brush & palette",
    "title": "Make your mark.",
    "description": "Choose how you hold, mix and apply paint."
  },
  {
    "id": "workspace",
    "name": "Your workspace",
    "title": "Room to focus.",
    "description": "Light, support and organise your work."
  },
  {
    "id": "powered",
    "name": "Air & power",
    "title": "A little more control.",
    "description": "Specialist equipment for spraying and powered work."
  },
  {
    "id": "resin",
    "name": "Cast & print",
    "title": "From idea to object.",
    "description": "Distinct materials and tools for casting and resin printing."
  }
] as const;
export type EquipmentCategory = typeof equipmentCategories[number]["id"];
export interface EquipmentType { id: string; category: EquipmentCategory; name: string; task: string; purpose: string; selection: string; aliases: string; }
export const equipmentTypes: EquipmentType[] = [
  {
    "id": "mould-remover",
    "category": "prepare",
    "name": "Mould line removers",
    "task": "Surface preparation",
    "purpose": "Remove raised casting seams before priming.",
    "selection": "Choose an edge that reaches the seam without flattening nearby detail. Inspect the bare model under a light.",
    "aliases": "mold line seam scraper"
  },
  {
    "id": "clippers",
    "category": "prepare",
    "name": "Sprue cutters",
    "task": "Surface preparation",
    "purpose": "Separate plastic parts from their frame.",
    "selection": "Match the cutter to the material. Fine single-blade nippers are finishing tools, not general wire cutters.",
    "aliases": "clippers nippers side cutters"
  },
  {
    "id": "knife",
    "category": "prepare",
    "name": "Precision knives",
    "task": "Surface preparation",
    "purpose": "Trim and refine small areas with a replaceable blade.",
    "selection": "Look for a secure blade clamp and comfortable grip. Use a cutting mat and the manufacturer\u2019s blade-changing instructions.",
    "aliases": "exacto xacto scalpel hobby knife"
  },
  {
    "id": "blades",
    "category": "prepare",
    "name": "Replacement blades",
    "task": "Surface preparation",
    "purpose": "Keep a compatible sharp blade available.",
    "selection": "Blade numbers do not guarantee handle compatibility. Check the handle manufacturer before choosing replacements.",
    "aliases": "exacto blades"
  },
  {
    "id": "files",
    "category": "prepare",
    "name": "Miniature files",
    "task": "Surface preparation",
    "purpose": "Refine small joins and edges.",
    "selection": "Choose a profile that fits the area and a finish appropriate to the material. Keep sharp details intact.",
    "aliases": "needle diamond files"
  },
  {
    "id": "sanding",
    "category": "prepare",
    "name": "Sanding sticks & paper",
    "task": "Surface preparation",
    "purpose": "Smooth surfaces and remove preparation marks.",
    "selection": "Use flexible abrasives for curves and a firm backing for flat surfaces. Check grit and dimensions, not colour alone.",
    "aliases": "sandpaper sand paper abrasive pads"
  },
  {
    "id": "hand-drill",
    "category": "prepare",
    "name": "Pin vices & hand drills",
    "task": "Drilling",
    "purpose": "Make controlled small holes for pins and conversions.",
    "selection": "Check chuck capacity against bit diameter. A hand drill offers deliberate control on small parts.",
    "aliases": "pin vise miniature precision drill"
  },
  {
    "id": "bits",
    "category": "prepare",
    "name": "Drill bits",
    "task": "Drilling",
    "purpose": "Match a hole to a pin or conversion part.",
    "selection": "Confirm shank size, cutting diameter and material suitability. Very fine bits are fragile.",
    "aliases": "drill bits"
  },
  {
    "id": "saw",
    "category": "prepare",
    "name": "Miniature saws",
    "task": "Surface preparation",
    "purpose": "Make controlled cuts through a part.",
    "selection": "Choose a blade for the material and secure the work. Follow resin handling instructions before cutting resin.",
    "aliases": "razor saw handsaw"
  },
  {
    "id": "tweezers",
    "category": "prepare",
    "name": "Tweezers",
    "task": "Assembly",
    "purpose": "Position small parts with less handling.",
    "selection": "Choose straight or angled tips for access; excessive pressure can launch or mark a part.",
    "aliases": "precision tweezers"
  },
  {
    "id": "cutting-mat",
    "category": "prepare",
    "name": "Cutting mats",
    "task": "Surface preparation",
    "purpose": "Protect the work surface during blade work.",
    "selection": "Choose enough working area to support the model and your hands. A painting mat is not necessarily a cutting mat.",
    "aliases": "self healing mat"
  },
  {
    "id": "plastic-cement",
    "category": "assemble",
    "name": "Plastic cement",
    "task": "Assembly",
    "purpose": "Join compatible plastic kit parts.",
    "selection": "Check the plastic type. Plastic cement is not a substitute for adhesive on metal or resin. Follow the product\u2019s ventilation instructions.",
    "aliases": "plastic glue"
  },
  {
    "id": "superglue",
    "category": "assemble",
    "name": "Cyanoacrylate glue",
    "task": "Assembly",
    "purpose": "Bond materials such as compatible resin and metal parts.",
    "selection": "Choose viscosity for the join and check the manufacturer\u2019s material guidance. Avoid contact with skin and eyes.",
    "aliases": "ca super glue superglue"
  },
  {
    "id": "pva",
    "category": "assemble",
    "name": "Basing glue",
    "task": "Assembly",
    "purpose": "Attach suitable basing and terrain materials.",
    "selection": "Check porous-material and foam compatibility on the product instructions.",
    "aliases": "pva white glue basing"
  },
  {
    "id": "epoxy-glue",
    "category": "assemble",
    "name": "Epoxy adhesive",
    "task": "Assembly",
    "purpose": "Bond suitable parts with a two-part adhesive.",
    "selection": "Use the exact product\u2019s mixing and curing instructions. Working time differs between formulations.",
    "aliases": "two part epoxy glue"
  },
  {
    "id": "putty",
    "category": "assemble",
    "name": "Sculpting putty",
    "task": "Sculpting",
    "purpose": "Fill gaps or build new forms.",
    "selection": "Choose a putty for the required finish and working time. Follow its own mixing instructions; do not assume all putties behave alike.",
    "aliases": "green stuff milliput epoxy putty"
  },
  {
    "id": "sculpting",
    "category": "assemble",
    "name": "Sculpting tools",
    "task": "Sculpting",
    "purpose": "Shape putty and texture bases.",
    "selection": "Match the tip to the scale of the mark. A worn brush can serve for some texture work.",
    "aliases": "texture tool clay shaper"
  },
  {
    "id": "clamps",
    "category": "assemble",
    "name": "Clamps & supports",
    "task": "Assembly",
    "purpose": "Hold parts while a suitable adhesive sets.",
    "selection": "Use light, stable pressure that does not deform the piece.",
    "aliases": "clamps helping hands"
  },
  {
    "id": "pins",
    "category": "assemble",
    "name": "Pinning materials",
    "task": "Assembly",
    "purpose": "Reinforce joins with fitted pins.",
    "selection": "Match the pin diameter to the drilled hole and use a cutter intended for the pin material.",
    "aliases": "brass rod wire pins"
  },
  {
    "id": "magnets",
    "category": "assemble",
    "name": "Miniature magnets",
    "task": "Assembly",
    "purpose": "Make interchangeable components.",
    "selection": "Check dimensions and polarity before fixing. Keep small magnets away from children and pets.",
    "aliases": "rare earth magnets"
  },
  {
    "id": "round-brush",
    "category": "paint",
    "name": "Pointed round brushes",
    "task": "Brush painting",
    "purpose": "Carry enough paint while keeping a controlled point.",
    "selection": "Look for a consistent tip and useful paint capacity. The smallest brush is not always the easiest to control.",
    "aliases": "basecoat medium general purpose sable synthetic"
  },
  {
    "id": "detail-brush",
    "category": "paint",
    "name": "Detail brushes",
    "task": "Brush painting",
    "purpose": "Place small marks with a fine tip.",
    "selection": "Compare shape, bristle material and published dimensions. Size labels are not standardised between brands or ranges.",
    "aliases": "fine detail brush size 0 1 2"
  },
  {
    "id": "flat-brush",
    "category": "paint",
    "name": "Flat & filbert brushes",
    "task": "Brush painting",
    "purpose": "Cover broader panels with a wider contact area.",
    "selection": "Choose width for the panel. A filbert\u2019s rounded edge and a flat\u2019s square edge make different marks.",
    "aliases": "flat filbert broad panels"
  },
  {
    "id": "drybrush",
    "category": "paint",
    "name": "Drybrushes & stippling brushes",
    "task": "Drybrushing",
    "purpose": "Catch texture with controlled, lightly loaded passes.",
    "selection": "Choose the head size for the area. A worn round can suit stippling; prepare the load before touching the model.",
    "aliases": "dry brush stipple stippling"
  },
  {
    "id": "wet-palette",
    "category": "paint",
    "name": "Wet palettes",
    "task": "Mixing paint",
    "purpose": "Keep suitable acrylic mixes workable during a session.",
    "selection": "Choose useful mixing space and compatible refill paper or membranes. Follow setup and cleaning instructions.",
    "aliases": "wet palette hydration"
  },
  {
    "id": "dry-palette",
    "category": "paint",
    "name": "Dry palettes",
    "task": "Mixing paint",
    "purpose": "Mix and inspect paint without a hydrated membrane.",
    "selection": "A smooth non-absorbent surface or a suitable household tile may be enough. Check solvent compatibility for oil work.",
    "aliases": "dry palette glass ceramic wells"
  },
  {
    "id": "texture-palette",
    "category": "paint",
    "name": "Texture palettes",
    "task": "Drybrushing",
    "purpose": "Prepare a drybrush and check its mark on texture.",
    "selection": "Look for raised detail that helps you judge the load. Practise away from the miniature first.",
    "aliases": "drybrush texture pad"
  },
  {
    "id": "refills",
    "category": "paint",
    "name": "Palette refills",
    "task": "Mixing paint",
    "purpose": "Replace worn paper, membranes or foam.",
    "selection": "Match the refill to the exact palette model and dimensions.",
    "aliases": "hydration paper membrane foam"
  },
  {
    "id": "handle",
    "category": "paint",
    "name": "Painting handles",
    "task": "Brush painting",
    "purpose": "Hold the miniature without touching painted areas.",
    "selection": "Choose a comfortable grip and secure base fit. A stable improvised holder can work too.",
    "aliases": "holder painting holders"
  },
  {
    "id": "water",
    "category": "paint",
    "name": "Water & rinse pots",
    "task": "Brush painting",
    "purpose": "Rinse acrylic brushes and refresh clean water.",
    "selection": "A stable household water pot is sufficient. Keep rinsing water separate from drinks and from oil-painting materials.",
    "aliases": "clean water water pot"
  },
  {
    "id": "cloth",
    "category": "paint",
    "name": "Absorbent cloth & paper",
    "task": "Brush painting",
    "purpose": "Wick excess moisture and check paint load.",
    "selection": "Choose a clean surface that does not shed fibres onto the brush. Keep separate materials for oils.",
    "aliases": "paper towel cotton buds absorbent cloth"
  },
  {
    "id": "cleaner",
    "category": "paint",
    "name": "Brush care",
    "task": "Brush painting",
    "purpose": "Clean and reshape a brush after use.",
    "selection": "Follow the brush maker\u2019s cleaner guidance. Do not leave brushes standing on their tips.",
    "aliases": "brush soap cleaner storage"
  },
  {
    "id": "medium",
    "category": "paint",
    "name": "Mediums & thinners",
    "task": "Mixing paint",
    "purpose": "Adjust a compatible paint without guessing its chemistry.",
    "selection": "Use the medium recommended for the paint system. Water, acrylic medium and oil solvent are not interchangeable.",
    "aliases": "contrast medium thinner solvent"
  },
  {
    "id": "varnish",
    "category": "paint",
    "name": "Varnishes",
    "task": "Finishing",
    "purpose": "Choose the surface finish for a specific painting process.",
    "selection": "Check compatibility and full drying instructions before applying another paint system.",
    "aliases": "gloss ultra matte varnish"
  },
  {
    "id": "light",
    "category": "workspace",
    "name": "Desk lights",
    "task": "Lighting",
    "purpose": "See the surface and judge colour consistently.",
    "selection": "Look for broad even light and a useful adjustable arm. Compare colour temperature and colour rendering separately from brightness.",
    "aliases": "lamp neutral desk light"
  },
  {
    "id": "magnifier",
    "category": "workspace",
    "name": "Magnifiers",
    "task": "Lighting",
    "purpose": "Inspect small detail at a comfortable distance.",
    "selection": "Choose working distance and magnification together; more magnification reduces the usable field.",
    "aliases": "magnifying light"
  },
  {
    "id": "organiser",
    "category": "workspace",
    "name": "Work mats & organisers",
    "task": "Organisation",
    "purpose": "Keep a clear stable area for your current tools.",
    "selection": "Choose storage for the tools you actually use. Keep sharp and chemical items appropriately stored.",
    "aliases": "storage paint station work mat"
  },
  {
    "id": "airbrush",
    "category": "powered",
    "name": "Airbrushes",
    "task": "Airbrushing",
    "purpose": "Apply controlled sprayed coats with appropriate preparation.",
    "selection": "Check nozzle, paint and cleaning compatibility. Spraying requires an appropriate workspace and extraction.",
    "aliases": "air brush"
  },
  {
    "id": "compressor",
    "category": "powered",
    "name": "Compressors & hoses",
    "task": "Airbrushing",
    "purpose": "Supply and connect regulated air.",
    "selection": "Confirm the airbrush connector, regulator and hose fit. Follow the equipment manual rather than a universal pressure setting.",
    "aliases": "air hose compressor"
  },
  {
    "id": "extraction",
    "category": "powered",
    "name": "Extraction & spray cleaning",
    "task": "Airbrushing",
    "purpose": "Manage overspray and clean suitable airbrush equipment.",
    "selection": "Match extraction to the exact material. A cleaning pot is not ventilation and a filter is not proof of solvent suitability.",
    "aliases": "spray booth cleaning pot ventilation"
  },
  {
    "id": "heat",
    "category": "powered",
    "name": "Precision heat tools",
    "task": "Powered work",
    "purpose": "Provide controlled heat for specifically supported workshop tasks.",
    "selection": "A specialist tool, not a shortcut for drying miniature paint. Follow the manual and material limitations; heat can deform parts.",
    "aliases": "heat gun hot air"
  },
  {
    "id": "rotary",
    "category": "powered",
    "name": "Rotary tools",
    "task": "Powered work",
    "purpose": "Drill, grind or polish compatible workpieces.",
    "selection": "Choose attachments and speed for the material. Secure the part and follow the manufacturer\u2019s protection and dust-control instructions.",
    "aliases": "dremel powered drill grinder"
  },
  {
    "id": "casting-resin",
    "category": "resin",
    "name": "Casting resins",
    "task": "Casting",
    "purpose": "Cast an original form into a compatible mould.",
    "selection": "Follow the exact resin\u2019s mixing, cure, ventilation and protective-equipment instructions.",
    "aliases": "urethane epoxy casting resin"
  },
  {
    "id": "silicone",
    "category": "resin",
    "name": "Mould-making silicone",
    "task": "Casting",
    "purpose": "Create a flexible mould around an original.",
    "selection": "Silicone mould material is distinct from casting resin. Check cure compatibility and the manufacturer\u2019s release guidance.",
    "aliases": "mold silicone rubber"
  },
  {
    "id": "uv-resin",
    "category": "resin",
    "name": "UV effects resin",
    "task": "Effects",
    "purpose": "Build small transparent effects with a compatible curing light.",
    "selection": "Check wavelength, layer limits and handling instructions. It is not interchangeable with printer resin.",
    "aliases": "uv water effects resin"
  },
  {
    "id": "printer-resin",
    "category": "resin",
    "name": "Printer resins",
    "task": "Resin printing",
    "purpose": "Supply a compatible resin printing workflow.",
    "selection": "Match printer compatibility and consult the resin SDS. Water-washable does not mean wash water can go down the drain.",
    "aliases": "photopolymer abs like resin"
  },
  {
    "id": "printer",
    "category": "resin",
    "name": "Resin printers",
    "task": "Resin printing",
    "purpose": "Produce parts from prepared digital models.",
    "selection": "Plan washing, curing and a suitable workspace as well as the printer. Follow resin and machine instructions.",
    "aliases": "3d printer msla"
  },
  {
    "id": "wash-cure",
    "category": "resin",
    "name": "Washing & curing",
    "task": "Resin printing",
    "purpose": "Finish a compatible resin print after printing.",
    "selection": "Check part capacity and resin-specific washing and cure instructions. A print is not ready just because printing has stopped.",
    "aliases": "uv light wash cure"
  },
  {
    "id": "protection",
    "category": "resin",
    "name": "Protection & consumables",
    "task": "Resin printing",
    "purpose": "Support the handling requirements of your chosen material.",
    "selection": "Use the exact material SDS to select gloves, eye protection and ventilation. Do not choose protection from a generic hobby recommendation.",
    "aliases": "ppe gloves goggles release film fep"
  }
];
export interface EquipmentProduct { id: string; brand: string; name: string; code: string | null; typeIds: string[]; variants: { label: string; specifications?: Record<string,string> }[]; specifications: Record<string,string>; sourceUrl: string; checkedAt: string; documents: { label: string; url: string }[]; }
