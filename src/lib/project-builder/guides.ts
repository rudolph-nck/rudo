// Registry of Project Builder how-to guides. A guide is either a hand-built
// HTML page (`file`) or a JSON guide (`data`) rendered by the shared engine in
// src/content/project-builder/engine/ (see its README for the format).

export type Guide = {
  slug: string;
  title: string;
  description: string;
  category: "Bathroom" | "Flooring" | "Plumbing" | "Electrical" | "Walls" | "Carpentry" | "Painting";
  tags: string[];
  file?: string;
  data?: string;
};

export const CATEGORY_ORDER: Guide["category"][] = [
  "Bathroom",
  "Flooring",
  "Plumbing",
  "Electrical",
  "Walls",
  "Carpentry",
  "Painting",
];

export const GUIDES: Guide[] = [
  {
    slug: "tub-shower-tile",
    title: "Tub Shower Tile Build",
    description:
      "Tile a tub surround over Durock with 12×24 tile and a framed niche: layout planner, niche cut list, step checklist and a have/need tool quiz that builds a shopping list.",
    category: "Bathroom",
    file: "tub-shower-tile.html",
    tags: ["Tile", "Waterproofing", "Intermediate"],
  },
  {
    slug: "outlet-gfci",
    title: "Replace an Outlet or GFCI",
    description:
      "Swap a worn or two-prong outlet for a tamper-resistant outlet or GFCI: find the breaker, prove it's dead, wire LINE and LOAD correctly, and test.",
    category: "Electrical",
    data: "outlet-gfci.json",
    tags: ["Outlets", "GFCI", "Beginner"],
  },
  {
    slug: "tub-to-shower",
    title: "Convert Tub to Shower",
    description:
      "Replace a 60\" alcove tub with a walk-in shower: new base, moved 2\" drain, shower-only valve, waterproofed tile or panel walls, and a glass door or curtain.",
    category: "Bathroom",
    data: "tub-to-shower.json",
    tags: ["Plumbing", "Tile", "Advanced"],
  },
  {
    slug: "lvp-flooring",
    title: "Install LVP Flooring",
    description:
      "Install a floating click-lock luxury vinyl plank floor over wood or concrete, with flat prep, tight joints, even expansion gaps and clean transitions.",
    category: "Flooring",
    data: "lvp-flooring.json",
    tags: ["Vinyl plank", "Floating floor", "Beginner"],
  },
  {
    slug: "laminate-flooring",
    title: "Install Laminate Flooring",
    description:
      "Install a floating click-lock laminate floor with the right underlayment and vapor barrier, even expansion gaps and T-molding breaks.",
    category: "Flooring",
    data: "laminate-flooring.json",
    tags: ["Laminate", "Floating floor", "Beginner"],
  },
  {
    slug: "floor-tile",
    title: "Tile a Floor",
    description:
      "Tile a bathroom or kitchen floor over plywood with porcelain tile, from stiffness check and underlayment to grout, caulk and resetting the toilet.",
    category: "Flooring",
    data: "floor-tile.json",
    tags: ["Porcelain tile", "Underlayment", "Intermediate"],
  },
  {
    slug: "copper-pipe",
    title: "Cut and Join Copper Pipe",
    description:
      "Cut copper water pipe cleanly and join it with solder, push-to-connect or press fittings, to fix a pinhole leak, replace a section, or connect to PEX.",
    category: "Plumbing",
    data: "copper-pipe.json",
    tags: ["Copper", "Soldering", "Intermediate"],
  },
  {
    slug: "add-water-line",
    title: "Add a Water Line",
    description:
      "Tee into an existing copper, PEX or CPVC line and run PEX to a fridge, utility sink, hose bib or new fixture, ending at a stub-out with its own shutoff.",
    category: "Plumbing",
    data: "add-water-line.json",
    tags: ["PEX", "Supply lines", "Intermediate"],
  },
  {
    slug: "toilet-replace",
    title: "Replace a Toilet",
    description:
      "Pull out the old toilet, fix the flange if needed, and set a new one on a fresh seal that doesn't rock or leak.",
    category: "Plumbing",
    data: "toilet-replace.json",
    tags: ["Toilet", "Wax ring", "Intermediate"],
  },
  {
    slug: "toilet-repair",
    title: "Fix a Toilet",
    description:
      "Fix a running toilet, weak flush, leaks, slow fill or a loose handle, seeing only the steps for your problem.",
    category: "Plumbing",
    data: "toilet-repair.json",
    tags: ["Toilet", "Repair", "Beginner"],
  },
  {
    slug: "faucet-shutoff",
    title: "Replace a Faucet",
    description:
      "Swap a kitchen or bathroom faucet, and optionally replace the under-sink shutoff valves with quarter-turn angle stops.",
    category: "Plumbing",
    data: "faucet-shutoff.json",
    tags: ["Faucet", "Shutoff valves", "Intermediate"],
  },
  {
    slug: "light-fixture-switch",
    title: "Replace a Light or Switch",
    description:
      "Swap a ceiling or wall light and its single-pole, 3-way, dimmer or smart switch, with the power proven dead at both boxes.",
    category: "Electrical",
    data: "light-fixture-switch.json",
    tags: ["Lighting", "Switches", "Beginner"],
  },
  {
    slug: "add-outlet",
    title: "Add a New Outlet",
    description:
      "Extend a suitable circuit to a new tamper-resistant outlet in an old-work box, with a permit, matching wire size and the right AFCI/GFCI protection.",
    category: "Electrical",
    data: "add-outlet.json",
    tags: ["Outlets", "New wiring", "Advanced"],
  },
  {
    slug: "drywall-repair",
    title: "Repair Drywall Holes",
    description:
      "Fix nail pops, dents and holes of any size, match orange peel, knockdown or popcorn texture, and prime so the repair disappears.",
    category: "Walls",
    data: "drywall-repair.json",
    tags: ["Drywall", "Texture", "Beginner"],
  },
  {
    slug: "framing-wall",
    title: "Frame a Partition Wall",
    description:
      "Build a straight, plumb non-load-bearing 2x4 partition wall with an optional door opening, fastened to wood or concrete floors.",
    category: "Carpentry",
    data: "framing-wall.json",
    tags: ["Framing", "Walls", "Intermediate"],
  },
  {
    slug: "interior-painting",
    title: "Paint a Room",
    description:
      "Paint a room's ceiling, walls and trim in the right order, with correct paint quantities, clean cut-in lines and an even finish.",
    category: "Painting",
    data: "interior-painting.json",
    tags: ["Painting", "Interior", "Beginner"],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
