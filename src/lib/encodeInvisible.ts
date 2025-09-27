export const INVISIBLES = {
  ZWSP: "\u200B",
  ZWNJ: "\u200C",
  ZWJ: "\u200D",
  LRM: "\u200E",
  RLM: "\u200F",
  FEFF: "\uFEFF",
  WJ: "\u2060",
  SHY: "\u00AD",
  INV_TIMES: "\u2062",
  INV_SEP: "\u2063",
  INV_PLUS: "\u2064",
} as const;

const INVISIBLE_SET = Object.values(INVISIBLES).join("");
export const INVISIBLE_REGEX = new RegExp(`[${INVISIBLE_SET}]`, "g");

function segmentGraphemes(input: string): string[] {
  if (typeof Intl !== "undefined" && (Intl as any).Segmenter) {
    const seg = new (Intl as any).Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(input), (s: any) => s.segment);
  }
  return Array.from(input);
}

function insertBetween(items: string[], insertStr: string): string {
  if (!insertStr || items.length <= 1) return items.join("");
  let out = "";
  for (let i = 0; i < items.length; i++) {
    out += items[i];
    if (i < items.length - 1) out += insertStr;
  }
  return out;
}

export type EncodeOpts = {
  scheme: keyof typeof INVISIBLES | "MIXED";
  density: number; // 0..5
  mode: "chars" | "words";
  useDivider?: boolean;
  divider?: string;
};

export function encodeInvisible(text: string, opts: EncodeOpts): string {
  const { scheme, density, mode, useDivider = false, divider = "-" } = opts;
  if (density === 0) return text;

  const marks = scheme === "MIXED"
    ? [INVISIBLES.ZWSP, INVISIBLES.ZWNJ, INVISIBLES.ZWJ, INVISIBLES.LRM, INVISIBLES.RLM, INVISIBLES.FEFF, INVISIBLES.WJ, INVISIBLES.SHY, INVISIBLES.INV_TIMES, INVISIBLES.INV_SEP, INVISIBLES.INV_PLUS]
    : [INVISIBLES[scheme as keyof typeof INVISIBLES]];

  const pick = () => marks[Math.floor(Math.random() * marks.length)];
  const makeSalt = () => useDivider ? divider.repeat(density) : Array.from({ length: density }, () => (scheme === "MIXED" ? pick() : marks[0])).join("");

  if (mode === "words") {
    const parts = text.split(/(\s+)/);
    let out = "";
    for (let i = 0; i < parts.length; i++) {
      out += parts[i];
      if (i % 2 === 0 && i < parts.length - 2) out += makeSalt();
    }
    return out;
  }
  return text
    .split(/(\r?\n)/)
    .map((chunk) => (/\r?\n/.test(chunk) ? chunk : insertBetween(segmentGraphemes(chunk), makeSalt())))
    .join("");
}

export const stripInvisibles = (text: string) => text.replace(INVISIBLE_REGEX, "");
export const visualizeInvisibles = (text: string) => text.replace(INVISIBLE_REGEX, "·");
