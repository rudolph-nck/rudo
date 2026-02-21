import { describe, it, expect } from "vitest";
import {
  parseContentFilter,
  matchesContentFilter,
  DEFAULT_CONTENT_FILTER,
} from "../recommendation";

describe("parseContentFilter", () => {
  it("returns defaults for null", () => {
    expect(parseContentFilter(null)).toEqual(DEFAULT_CONTENT_FILTER);
  });

  it("returns defaults for undefined", () => {
    expect(parseContentFilter(undefined)).toEqual(DEFAULT_CONTENT_FILTER);
  });

  it("returns defaults for non-object", () => {
    expect(parseContentFilter("string")).toEqual(DEFAULT_CONTENT_FILTER);
    expect(parseContentFilter(42)).toEqual(DEFAULT_CONTENT_FILTER);
  });

  it("parses valid settings", () => {
    const result = parseContentFilter({ showAll: false, hideHot: true, mildOnly: false });
    expect(result).toEqual({ showAll: false, hideHot: true, mildOnly: false });
  });

  it("uses defaults for missing fields", () => {
    const result = parseContentFilter({ hideHot: true });
    expect(result).toEqual({ showAll: true, hideHot: true, mildOnly: false });
  });

  it("ignores non-boolean values", () => {
    const result = parseContentFilter({ showAll: "yes", hideHot: 1 });
    expect(result.showAll).toBe(true);
    expect(result.hideHot).toBe(false);
  });
});

describe("matchesContentFilter", () => {
  it("shows everything with default filter", () => {
    expect(matchesContentFilter("mild", DEFAULT_CONTENT_FILTER)).toBe(true);
    expect(matchesContentFilter("medium", DEFAULT_CONTENT_FILTER)).toBe(true);
    expect(matchesContentFilter("hot", DEFAULT_CONTENT_FILTER)).toBe(true);
    expect(matchesContentFilter(null, DEFAULT_CONTENT_FILTER)).toBe(true);
  });

  it("hideHot blocks hot content", () => {
    const filter = { showAll: false, hideHot: true, mildOnly: false };
    expect(matchesContentFilter("mild", filter)).toBe(true);
    expect(matchesContentFilter("medium", filter)).toBe(true);
    expect(matchesContentFilter("hot", filter)).toBe(false);
  });

  it("mildOnly only shows mild", () => {
    const filter = { showAll: false, hideHot: false, mildOnly: true };
    expect(matchesContentFilter("mild", filter)).toBe(true);
    expect(matchesContentFilter("medium", filter)).toBe(false);
    expect(matchesContentFilter("hot", filter)).toBe(false);
  });

  it("treats null contentRating as medium", () => {
    const filter = { showAll: false, hideHot: false, mildOnly: true };
    expect(matchesContentFilter(null, filter)).toBe(false); // null = medium, mildOnly blocks it

    const filter2 = { showAll: false, hideHot: true, mildOnly: false };
    expect(matchesContentFilter(null, filter2)).toBe(true); // null = medium, hideHot allows it
  });

  it("showAll with no restrictions passes everything", () => {
    const filter = { showAll: true, hideHot: false, mildOnly: false };
    expect(matchesContentFilter("hot", filter)).toBe(true);
    expect(matchesContentFilter("mild", filter)).toBe(true);
  });
});
