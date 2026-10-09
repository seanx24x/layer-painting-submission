/** Practical entry points. These are explicit tool associations, never product rankings. */
export interface EquipmentBrowseGroup {
  id: string;
  name: string;
  description: string;
  typeIds: string[];
}

export const equipmentBrowseGroups: EquipmentBrowseGroup[] = [
  { id: "brushes", name: "Brushes", description: "Shape, point and the mark you want to make.", typeIds: ["round-brush", "detail-brush", "flat-brush", "drybrush"] },
  { id: "palettes", name: "Palettes", description: "Mix, thin and keep paint workable.", typeIds: ["wet-palette", "dry-palette", "texture-palette", "refills"] },
  { id: "cutting", name: "Cutting", description: "Cutters, knives and tools for clean preparation.", typeIds: ["clippers", "knife", "blades", "saw", "mould-remover", "tweezers"] },
  { id: "cutting-mats", name: "Cutting mats", description: "A protected surface with room to work.", typeIds: ["cutting-mat"] },
  { id: "sanding", name: "Sanding", description: "Files and abrasives for a smooth foundation.", typeIds: ["files", "sanding"] },
  { id: "glues", name: "Glues", description: "Choose an adhesive for the materials you use.", typeIds: ["plastic-cement", "superglue", "pva", "epoxy-glue"] },
  { id: "sculpting", name: "Sculpting", description: "Fill joins, build forms and refine detail.", typeIds: ["putty", "sculpting"] },
  { id: "assembly", name: "Assembly", description: "Drill, pin and hold small parts together.", typeIds: ["hand-drill", "bits", "clamps", "pins", "magnets"] },
  { id: "lights", name: "Lights", description: "See colour, edges and small details clearly.", typeIds: ["light", "magnifier"] },
  { id: "workspace", name: "Workspace", description: "Handles, water pots and a place for your tools.", typeIds: ["handle", "water", "cloth", "organiser"] },
  { id: "paint-care", name: "Paint care", description: "Clean brushes, adjust paint and protect a finish.", typeIds: ["cleaner", "medium", "varnish"] },
  { id: "airbrushing", name: "Airbrushing", description: "Airbrushes, air supply and extraction.", typeIds: ["airbrush", "compressor", "extraction"] },
  { id: "power-tools", name: "Power tools", description: "Controlled heat and precision rotary work.", typeIds: ["heat", "rotary"] },
  { id: "resin", name: "Resin", description: "Different materials for casting, effects and printing.", typeIds: ["casting-resin", "silicone", "uv-resin", "printer-resin", "protection"] },
  { id: "printing", name: "3D printing", description: "Printers, washing and curing equipment.", typeIds: ["printer", "wash-cure", "protection"] },
];

export const equipmentBrowseGroup = (id: string | undefined) => equipmentBrowseGroups.find(group => group.id === id);
