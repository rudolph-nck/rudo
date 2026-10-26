import { afterEach, describe, expect, it } from "vitest";
import {
  checkCredentials,
  createSessionToken,
  safeEqual,
  verifySessionToken,
} from "../project-builder/session";

const SECRET = "test-secret";

describe("project builder session tokens", () => {
  it("accepts a token it signed", async () => {
    const now = 1_700_000_000_000;
    const token = await createSessionToken(now, SECRET);
    expect(await verifySessionToken(token, now + 1000, SECRET)).toBe(true);
  });

  it("rejects expired, tampered, foreign and missing tokens", async () => {
    const now = 1_700_000_000_000;
    const token = (await createSessionToken(now, SECRET))!;
    const [exp, sig] = token.split(".");
    expect(await verifySessionToken(token, now + 31 * 864e5, SECRET)).toBe(false);
    expect(await verifySessionToken(`${Number(exp) + 1}.${sig}`, now, SECRET)).toBe(false);
    expect(await verifySessionToken(token, now, "other-secret")).toBe(false);
    expect(await verifySessionToken(undefined, now, SECRET)).toBe(false);
    expect(await verifySessionToken("garbage", now, SECRET)).toBe(false);
    expect(await createSessionToken(now, null)).toBeNull();
  });
});

describe("project builder credentials", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("matches username case-insensitively and password exactly", () => {
    process.env.PROJECT_BUILDER_USERNAME = "Some.User";
    process.env.PROJECT_BUILDER_PASSWORD = "Secret1!";
    expect(checkCredentials("some.user", "Secret1!")).toBe(true);
    expect(checkCredentials(" Some.User ", "Secret1!")).toBe(true);
    expect(checkCredentials("some.user", "secret1!")).toBe(false);
    expect(checkCredentials("other", "Secret1!")).toBe(false);
  });

  it("refuses everyone when not configured", () => {
    delete process.env.PROJECT_BUILDER_USERNAME;
    delete process.env.PROJECT_BUILDER_PASSWORD;
    expect(checkCredentials("", "")).toBe(false);
  });

  it("safeEqual handles different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
