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
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
