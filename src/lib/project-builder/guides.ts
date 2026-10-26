// Registry of Project Builder how-to guides. To add a guide: drop a full HTML
// document in src/content/project-builder/ and add an entry here.

export type Guide = {
  slug: string;
  title: string;
  description: string;
  file: string;
  tags: string[];
};

export const GUIDES: Guide[] = [
  {
    slug: "tub-shower-tile",
    title: "Tub Shower Tile Build",
    description:
      "Tile a tub surround over Durock with 12×24 tile and a framed niche: layout planner, niche cut list, step checklist and a have/need tool quiz that builds a shopping list.",
    file: "tub-shower-tile.html",
    tags: ["Bathroom", "Tile", "Beginner"],
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
