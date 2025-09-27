import { describe, it, expect } from "vitest";
import { encodeInvisible, stripInvisibles } from "./encodeInvisible";

describe("encodeInvisible", () => {
  it("returns string for density 0", () => {
    expect(encodeInvisible("abc", { scheme: "ZWSP", density: 0, mode: "chars" })).toBe("abc");
  });

  it("inserts between characters in char mode", () => {
    const out = encodeInvisible("ab", { scheme: "ZWSP", density: 1, mode: "chars" });
    expect(out.length).toBeGreaterThan(2);
  });

  it("preserves spaces and inserts between words in word mode", () => {
    const out = encodeInvisible("a b", { scheme: "ZWSP", density: 1, mode: "words" });
    expect(out.includes(" ")).toBe(true);
  });

  it("visible divider repeats", () => {
    const out = encodeInvisible("ab", { scheme: "ZWSP", density: 3, mode: "chars", useDivider: true, divider: "-" });
    expect(out.includes("---")).toBe(true);
  });

  it("round-trips stripping invisibles (divider remains)", () => {
    const out = encodeInvisible("a b", { scheme: "ZWSP", density: 2, mode: "words" });
    expect(stripInvisibles(out)).toBe("a b");
  });
});
