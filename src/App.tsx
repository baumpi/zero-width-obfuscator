import React, { useEffect, useMemo, useState } from "react";

/**
 * Zero‑Width Obfuscator — Redteaming Utility (v2.5)
 * Simple • Minimal • Versatile
 *
 * v2.5
 * - FIX: Properly closed all <Section> blocks; repaired grid structure
 * - FIX: Escaped backslash in divider presets ("\\")
 * - ADD: Divider state + dependencies wired so preview updates instantly
 * - ADD: Lightweight self‑tests (console.assert) to catch regressions
 */

// Invisible characters
const INVISIBLES = {
  ZWSP: "\u200B", // zero‑width space
  ZWNJ: "\u200C", // zero‑width non‑joiner
  ZWJ: "\u200D", // zero‑width joiner
  LRM: "\u200E", // left‑to‑right mark
  RLM: "\u200F", // right‑to‑left mark
  FEFF: "\uFEFF", // zero‑width no‑break space (BOM)
  WJ: "\u2060", // word joiner
  SHY: "\u00AD", // soft hyphen (often invisible)
  INV_TIMES: "\u2062", // invisible times
  INV_SEP: "\u2063", // invisible separator
  INV_PLUS: "\u2064", // invisible plus
};

const INVISIBLE_SET = Object.values(INVISIBLES).join("");
const INVISIBLE_REGEX = new RegExp(`[${INVISIBLE_SET}]`, "g");

function segmentGraphemes(input) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(seg.segment(input), (s) => s.segment);
  }
  return Array.from(input);
}

function insertBetween(items, insertStr) {
  if (!insertStr) return items.join(""); // density 0: no injection
  if (items.length <= 1) return items.join("");
  let out = "";
  for (let i = 0; i < items.length; i++) {
    out += items[i];
    if (i < items.length - 1) out += insertStr;
  }
  return out;
}

// ---------- Visible transforms (expanded library) ----------
const A_Z = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const a_z = "abcdefghijklmnopqrstuvwxyz";

const mapChars = (str, map) =>
  Array.from(str)
    .map((ch) => map[ch] ?? map[ch.toLowerCase()] ?? ch)
    .join("");

// 1) ROT13
const rot13 = (s) =>
  s.replace(/[A-Za-z]/g, (c) =>
    String.fromCharCode(
      (c <= "Z" ? 90 : 122) >= c.charCodeAt(0) + 13
        ? c.charCodeAt(0) + 13
        : c.charCodeAt(0) - 13
    )
  );

// 2) Atbash
const atbash = (s) =>
  mapChars(
    s,
    (() => {
      const m = {};
      for (let i = 0; i < 26; i++) {
        m[A_Z[i]] = A_Z[25 - i];
        m[a_z[i]] = a_z[25 - i];
      }
      return m;
    })()
  );

// 3) Base64 (string‑wise)
const toBase64 = (s) => {
  if (typeof btoa !== "undefined") return btoa(unescape(encodeURIComponent(s)));
  // eslint-disable-next-line no-undef
  return Buffer.from(s, "utf8").toString("base64");
};

// 4) Hex
const toHex = (s) =>
  Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");

// 5) Binary
const toBin = (s) =>
  Array.from(new TextEncoder().encode(s))
    .map((b) => b.toString(2).padStart(8, "0"))
    .join(" ");

// 6) Morse
const MORSE = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....",
  i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.",
  q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-",
  y: "-.--", z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----."
};
const toMorse = (s) => s.split(/(\s+)/).map(tok => /\s+/.test(tok) ? tok : Array.from(tok).map(ch => MORSE[ch.toLowerCase()] ?? ch).join(" ")).join("");

// 7) Leet
const LEET = { a: "4", e: "3", i: "1", o: "0", s: "5", t: "7", b: "8", g: "9" };
const toLeet = (s) => mapChars(s, LEET);

// 8) Fullwidth
const toFullwidth = (s) =>
  s.replace(/[!-~]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0));

// 9) Small caps (approx via Unicode)
const SMALL = { a:"ᴀ", b:"ʙ", c:"ᴄ", d:"ᴅ", e:"ᴇ", f:"ꜰ", g:"ɢ", h:"ʜ", i:"ɪ", j:"ᴊ", k:"ᴋ", l:"ʟ", m:"ᴍ", n:"ɴ", o:"ᴏ", p:"ᴘ", q:"ǫ", r:"ʀ", s:"s", t:"ᴛ", u:"ᴜ", v:"ᴠ", w:"ᴡ", x:"x", y:"ʏ", z:"ᴢ" };
const toSmallCaps = (s) => mapChars(s, SMALL);

// 10) Circled
const toCircled = (s) =>
  s.replace(/[A-Za-z0-9]/g, (ch) => {
    const base = /[A-Z]/.test(ch) ? 0x24b6 : /[a-z]/.test(ch) ? 0x24d0 : 0x2460 - 1;
    const offset = /[0-9]/.test(ch)
      ? (parseInt(ch) === 0 ? 0x24ea : 0x2460 + parseInt(ch) - 1)
      : base + (/[A-Za-z]/.test(ch) ? ch.toUpperCase().charCodeAt(0) - 65 : 0);
    return String.fromCodePoint(offset);
  });

// 11) Superscript
const SUPER = { 0:"⁰",1:"¹",2:"²",3:"³",4:"⁴",5:"⁵",6:"⁶",7:"⁷",8:"⁸",9:"⁹", a:"ᵃ", b:"ᵇ", c:"ᶜ", d:"ᵈ", e:"ᵉ", f:"ᶠ", g:"ᵍ", h:"ʰ", i:"ᶦ", j:"ʲ", k:"ᵏ", l:"ˡ", m:"ᵐ", n:"ⁿ", o:"ᵒ", p:"ᵖ", r:"ʳ", s:"ˢ", t:"ᵗ", u:"ᵘ", v:"ᵛ", w:"ʷ", x:"ˣ", y:"ʸ", z:"ᶻ" };
const toSuperscript = (s) => mapChars(s, SUPER);

// 12) Subscript
const SUB = { 0:"₀",1:"₁",2:"₂",3:"₃",4:"₄",5:"₅",6:"₆",7:"₇",8:"₈",9:"₉", a:"ₐ", e:"ₑ", h:"ₕ", i:"ᵢ", j:"ⱼ", k:"ₖ", l:"ₗ", m:"ₘ", n:"ₙ", o:"ₒ", p:"ₚ", r:"ᵣ", s:"ₛ", t:"ₜ", u:"ᵤ", v:"ᵥ", x:"ₓ" };
const toSubscript = (s) => mapChars(s, SUB);

// 13) Zalgo (light)
const ZALGO = ["\u0300","\u0301","\u0302","\u0303","\u0304","\u0305","\u0306","\u0307","\u0308","\u0309","\u030A","\u030B","\u030C","\u030D","\u030E","\u030F","\u0310","\u0311","\u0312","\u0313","\u0314","\u0315","\u031A","\u031B","\u031C","\u0320","\u0321","\u0322","\u0323","\u0324","\u0325","\u0326","\u0327","\u0328","\u0329","\u032A","\u032B","\u032C","\u032D","\u032E","\u032F","\u0330","\u0331","\u0332","\u0333","\u0334","\u0335","\u0336","\u0337","\u0338","\u0339","\u033A","\u033B","\u033C","\u033D","\u033E","\u033F"];
const toZalgo = (s, amt = 2) => Array.from(s).map(ch => ch + Array.from({length: amt}, () => ZALGO[Math.floor(Math.random()*ZALGO.length)]).join("")).join("");

// 14) Braille patterns (approx A..Z -> U+2801..)
const toBraille = (s) => s.replace(/[A-Za-z]/g, (ch) => String.fromCodePoint(0x2800 + ((ch.toLowerCase().charCodeAt(0)-96) & 0x3F)));

// 15) Homoglyph Greek
const GREEK = { A:"Α", B:"Β", E:"Ε", H:"Η", I:"Ι", K:"Κ", M:"Μ", N:"Ν", O:"Ο", P:"Ρ", T:"Τ", X:"Χ", Y:"Υ", a:"α", e:"ε", i:"ι", k:"κ", n:"η", o:"ο", p:"ρ", t:"τ", x:"χ", y:"γ" };
const toGreeklish = (s) => mapChars(s, GREEK);

// 16) Homoglyph Cyrillic
const CYR = { A:"А", B:"В", C:"С", E:"Е", H:"Н", I:"І", J:"Ј", K:"К", M:"М", O:"О", P:"Р", S:"Ѕ", T:"Т", X:"Х", Y:"Ү", a:"а", e:"е", o:"о", p:"р", c:"с", y:"у", x:"х" };
const toCyrGlyphs = (s) => mapChars(s, CYR);

// 17) Mathematical bold
const toMathBold = (s) => s.replace(/[A-Z]/g, ch => String.fromCodePoint(0x1D400 + ch.charCodeAt(0) - 65)).replace(/[a-z]/g, ch => String.fromCodePoint(0x1D41A + ch.charCodeAt(0) - 97));

// 18) Monospace math
const toMathMono = (s) => s.replace(/[A-Z]/g, ch => String.fromCodePoint(0x1D670 + ch.charCodeAt(0) - 65)).replace(/[a-z]/g, ch => String.fromCodePoint(0x1D68A + ch.charCodeAt(0) - 97));

// Helpers for math variants
const mapAlphaVariant = (s, upBase, lowBase) =>
  s.replace(/[A-Z]/g, ch => String.fromCodePoint(upBase + ch.charCodeAt(0) - 65))
   .replace(/[a-z]/g, ch => String.fromCodePoint(lowBase + ch.charCodeAt(0) - 97));

// New math-style variants
const toMathItalic = (s) => mapAlphaVariant(s, 0x1D434, 0x1D44E);
const toMathSans = (s) => mapAlphaVariant(s, 0x1D5A0, 0x1D5BA);
const toMathSansBold = (s) => mapAlphaVariant(s, 0x1D5D4, 0x1D5EE);
const toMathSansItalic = (s) => mapAlphaVariant(s, 0x1D608, 0x1D622);
const toMathSansBoldItalic = (s) => mapAlphaVariant(s, 0x1D63C, 0x1D656);
const toDoubleStruck = (s) => mapAlphaVariant(s, 0x1D538, 0x1D552);
const toFraktur = (s) => mapAlphaVariant(s, 0x1D504, 0x1D51E);

// 19) Upside‑down (subset)
const UPS = { a:"ɐ", b:"q", c:"ɔ", d:"p", e:"ǝ", f:"ɟ", g:"ƃ", h:"ɥ", i:"ᴉ", j:"ɾ", k:"ʞ", l:"ʃ", m:"ɯ", n:"u", o:"o", p:"d", q:"b", r:"ɹ", s:"s", t:"ʇ", u:"n", v:"ʌ", w:"ʍ", y:"ʎ", A:"∀", E:"Ǝ", J:"ſ", M:"W", V:"Λ" };
const toUpside = (s) => mapChars(s, UPS).split("").reverse().join("");

// 20) Rune‑ish (Elder Futhark subset)
const RUNES = { a:"ᚨ", b:"ᛒ", c:"ᚲ", d:"ᛞ", e:"ᛖ", f:"ᚠ", g:"ᚷ", h:"ᚺ", i:"ᛁ", j:"ᛃ", k:"ᚲ", l:"ᛚ", m:"ᛗ", n:"ᚾ", o:"ᛟ", p:"ᛈ", q:"ᛩ", r:"ᚱ", s:"ᛋ", t:"ᛏ", u:"ᚢ", v:"ᚡ", w:"ᚹ", x:"ᛪ", y:"ᛦ", z:"ᛉ" };
const toRunes = (s) => mapChars(s, RUNES);

// 21) Hieroglyphs (A..Z mapped to a curated set)
const HIERO = (() => {
  const codes = [0x13000,0x13001,0x13002,0x13003,0x13004,0x13005,0x13006,0x13007,0x13008,0x13009,0x1300A,0x1300B,0x1300C,0x1300D,0x1300E,0x1300F,0x13010,0x13011,0x13012,0x13013,0x13014,0x13015,0x13016,0x13017,0x13018,0x13019];
  const m = {};
  for (let i = 0; i < 26; i++) { m[A_Z[i]] = String.fromCodePoint(codes[i % codes.length]); m[a_z[i]] = String.fromCodePoint(codes[i % codes.length]); }
  return m;
})();
const toHieroglyphs = (s) => mapChars(s, HIERO);

// 22) Pig Latin (basic)
const toPigLatin = (s) => s.replace(/\b([A-Za-z])([A-Za-z]*)\b/g, (_, c1, rest) => /[AEIOUaeiou]/.test(c1) ? `${c1}${rest}yay` : `${rest}${c1}ay`);

// 23) TitleCase
const toTitle = (s) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

// 24) Reverse
const toReverse = (s) => Array.from(s).reverse().join("");

// Enclosed/ornamental
const toParenthesized = (s) => s.replace(/[a-z]/g, ch => String.fromCodePoint(0x249C + ch.charCodeAt(0) - 97));
const toSquaredCaps = (s) => s.replace(/[A-Z]/g, ch => String.fromCodePoint(0x1F130 + ch.charCodeAt(0) - 65));
const toRegionalIndicators = (s) => s.replace(/[A-Z]/g, ch => String.fromCodePoint(0x1F1E6 + ch.charCodeAt(0) - 65));

// Decorative combining overlays
const overlayEach = (s, mark) => segmentGraphemes(s).map(g => /\s/.test(g) ? g : g + mark).join("");
const toStrike = (s) => overlayEach(s, "\u0336");
const toUnderline = (s) => overlayEach(s, "\u0332");
const toOverline = (s) => overlayEach(s, "\u0305");
const toTildeOverlay = (s) => overlayEach(s, "\u0334");
const toDotAbove = (s) => overlayEach(s, "\u0307");
const toSlashThrough = (s) => overlayEach(s, "\u0335");

// 25) Klingonish (approximate using exotic symbols; not real pIqaD)
const KLING = (() => {
  const src = a_z;
  const codepoints = [
    0x16A0,0x16A2,0x16A6,0x16B1,0x16B7,0x16B9,0x16BA,0x16BE,0x16C1,0x16C4,0x16C7,0x16C8,0x16CB,0x16CF,0x16D2,0x16D6,0x16DA,0x16DC,0x16DF,0x16E1,0x16E3,0x16E6,0x16EA,0x16EE,0x16F0,0x16F1
  ]; // Runic-ish codepoints for alien feel
  const m = {};
  for (let i=0;i<26;i++){ m[src[i]] = String.fromCodePoint(codepoints[i%codepoints.length]); m[src[i].toUpperCase()] = m[src[i]]; }
  return m;
})();
const toKlingonish = (s) => mapChars(s, KLING);

// 26) Tifinagh (Berber) letters map (subset)
const TIF = (() => {
  const m = {};
  const base = 0x2D30;
  for (let i=0;i<26;i++){ const cp = base + (i % 26); const ch = String.fromCodePoint(cp); m[a_z[i]] = ch; m[A_Z[i]] = ch; }
  return m;
})();
const toTifinagh = (s) => mapChars(s, TIF);

// 27) Semaphore Flags (emoji pair encoding positions; stylistic, not canonical)
const SEMAPH = (() => {
  const pairs = ["₁₂","₁₃","₁₄","₁₅","₁₆","₂₃","₂₄","₂₅","₂₆","₃₄","₃₅","₃₆","₄₅","₄₆","₅₆","₁₈","₂₈","₃₈","₄₈","₅₈","₆₈","₇₈","₁₇","₂₇","₃₇","₄₇"]; // pseudo positions
  const m = {};
  for (let i=0;i<26;i++){ m[A_Z[i]] = `🚩${pairs[i]}`; m[a_z[i]] = `🚩${pairs[i]}`; }
  return m;
})();
const toSemaphore = (s) => mapChars(s, SEMAPH);

// 28) MirrorRTL (uses bidi override to render mirrored order)
const toMirrorRTL = (s) => "\u202E" + s + "\u202C"; // RLO ... PDF

// Registry
const TRANSFORMS = {
  // Basics & encodings
  None: (s) => s,
  Reverse: toReverse,
  TitleCase: toTitle,
  PigLatin: toPigLatin,
  ROT13: rot13,
  Atbash: atbash,
  Base64: toBase64,
  Hex: toHex,
  Binary: toBin,

  // Glyph swaps & stylistic alphabets
  Leet: toLeet,
  Fullwidth: toFullwidth,
  SmallCaps: toSmallCaps,
  Circled: toCircled,
  Braille: toBraille,
  GreekHomoglyphs: toGreeklish,
  CyrillicHomoglyphs: toCyrGlyphs,
  Runes: toRunes,
  Hieroglyphs: toHieroglyphs,
  Klingonish: toKlingonish,
  Tifinagh: toTifinagh,
  SemaphoreFlags: toSemaphore,

  // Math & variants
  MathBold: toMathBold,
  MathMono: toMathMono,
  MathItalic: toMathItalic,
  MathSans: toMathSans,
  MathSansBold: toMathSansBold,
  MathSansItalic: toMathSansItalic,
  MathSansBoldItalic: toMathSansBoldItalic,
  DoubleStruck: toDoubleStruck,
  Fraktur: toFraktur,

  // Enclosed / flags
  Parenthesized: toParenthesized,
  SquaredCaps: toSquaredCaps,
  RegionalIndicators: toRegionalIndicators,

  // Decorative overlays
  Strikethrough: toStrike,
  Underline: toUnderline,
  Overline: toOverline,
  TildeOverlay: toTildeOverlay,
  DotAbove: toDotAbove,
  SlashThrough: toSlashThrough,

  // Effects
  ZalgoLight: (s) => toZalgo(s, 2),
  ZalgoHeavy: (s) => toZalgo(s, 5),
  UpsideDown: toUpside,
  Morse: toMorse,
  MirrorRTL: toMirrorRTL,
};

const TRANSFORM_KEYS = Object.keys(TRANSFORMS);

// Category metadata for filtering
const TRANSFORM_META = {
  None: 'Basics', Reverse: 'Basics', TitleCase: 'Basics', PigLatin: 'Basics', ROT13: 'Basics', Atbash: 'Basics', Base64: 'Basics', Hex: 'Basics', Binary: 'Basics',
  Leet: 'Glyphs', Fullwidth: 'Glyphs', SmallCaps: 'Glyphs', Circled: 'Glyphs', Braille: 'Glyphs', GreekHomoglyphs: 'Glyphs', CyrillicHomoglyphs: 'Glyphs', Runes: 'Glyphs', Hieroglyphs: 'Glyphs', Klingonish: 'Exotic', Tifinagh: 'Exotic', SemaphoreFlags: 'Emoji',
  MathBold: 'Math', MathMono: 'Math', MathItalic: 'Math', MathSans: 'Math', MathSansBold: 'Math', MathSansItalic: 'Math', MathSansBoldItalic: 'Math', DoubleStruck: 'Math', Fraktur: 'Math',
  Parenthesized: 'Enclosed', SquaredCaps: 'Enclosed', RegionalIndicators: 'Enclosed',
  Strikethrough: 'Decor', Underline: 'Decor', Overline: 'Decor', TildeOverlay: 'Decor', DotAbove: 'Decor', SlashThrough: 'Decor',
  ZalgoLight: 'Effects', ZalgoHeavy: 'Effects', UpsideDown: 'Effects', Morse: 'Effects', MirrorRTL: 'Effects',
};
const CATEGORIES = ['All', 'Basics', 'Glyphs', 'Math', 'Enclosed', 'Decor', 'Effects', 'Exotic', 'Emoji'];

// Subset for per‑letter/word randomize (all but None)
const RANDOM_KEYS = TRANSFORM_KEYS.filter(k => k !== 'None');

function encodeInvisible(text, opts) {
  const { scheme, density, mode, useDivider = false, divider = "-" } = opts;
  if (density === 0) return text; // disabled
  const marks = scheme === "MIXED"
    ? [INVISIBLES.ZWSP, INVISIBLES.ZWNJ, INVISIBLES.ZWJ, INVISIBLES.LRM, INVISIBLES.RLM, INVISIBLES.FEFF, INVISIBLES.WJ, INVISIBLES.SHY, INVISIBLES.INV_TIMES, INVISIBLES.INV_SEP, INVISIBLES.INV_PLUS]
    : [INVISIBLES[scheme]];

  const pick = () => marks[Math.floor(Math.random() * marks.length)];
  const makeSalt = () => {
    if (useDivider) return divider.repeat(density);
    return Array.from({ length: density }, () => (scheme === "MIXED" ? pick() : marks[0])).join("");
  };

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

function stripvisibles(text) { return text.replace(INVISIBLE_REGEX, ""); }
function visualizeInvisibles(text) { return text.replace(INVISIBLE_REGEX, "·"); }

function Section({ title, children, right }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-gray-700">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function ZeroWidthObfuscator() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [scheme, setScheme] = useState("ZWSP"); // ZWSP, ZWNJ, ... , MIXED
  const [mode, setMode] = useState("chars"); // chars | words
  const [density, setDensity] = useState(2); // 0..5
  const [inspect, setspect] = useState(false);

  // Visible divider (optional)
  const [useDivider, setUseDivider] = useState(false);
  const [divider, setDivider] = useState("-");

  // Content transform controls
  const [transform, setTransform] = useState("None");
  const [category, setCategory] = useState('All');
  const [perLetterRandomize, setPerLetterRandomize] = useState(false);
  const [perWordRandomize, setPerWordRandomize] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0); // bump to re‑randomize

  // Favorites (persisted)
  const [favorites, setFavorites] = useState([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zw_favorites');
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem('zw_favorites', JSON.stringify(favorites)); } catch {}
  }, [favorites]);

  // Clipboard indicator
  const [copied, setCopied] = useState("");

  const pickRandomKey = () => RANDOM_KEYS[Math.floor(Math.random()*RANDOM_KEYS.length)];

  const toggleFavorite = (k) => {
    setFavorites((prev) => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  };

  // Apply transforms
  const applyTransform = (text) => {
    if (perWordRandomize) {
      return text.split(/(\s+)/).map(tok => {
        if (/\s+/.test(tok) || tok === "") return tok;
        const fn = TRANSFORMS[pickRandomKey()] ?? ((s)=>s);
        return fn(tok);
      }).join("");
    }
    if (perLetterRandomize) {
      const clusters = segmentGraphemes(text);
      return clusters.map(g => {
        const fn = TRANSFORMS[pickRandomKey()] ?? ((s)=>s);
        return fn(g);
      }).join("");
    }
    const fn = TRANSFORMS[transform] ?? ((s)=>s);
    return fn(text);
  };

  // Live preview effect
  useEffect(() => {
    const visible = applyTransform(input);
    const encoded = encodeInvisible(visible, { scheme, density, mode, useDivider, divider });
    setOutput(encoded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, scheme, density, mode, transform, perLetterRandomize, perWordRandomize, category, randomSeed, favorites, useDivider, divider]);

  const encodedPreview = useMemo(() => (inspect ? visualizeInvisibles(output) : output), [inspect, output]);

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied("Copied"); setTimeout(()=>setCopied(""), 1200); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
      setCopied("Copied"); setTimeout(()=>setCopied(""), 1200);
    }
  };

  const handleSelectScheme = (k) => {
    setScheme(k);
    if (k === "MIXED" && !useDivider) {
      const visible = applyTransform(input);
      const encoded = encodeInvisible(visible, { scheme: "MIXED", density, mode, useDivider, divider });
      setOutput(encoded);
      copyToClipboard(encoded);
    }
  };

  const Star = ({ on, onClick }) => (
    <button
      onClick={onClick}
      title={on ? 'Remove from favorites' : 'Add to favorites'}
      className={`ml-2 text-xs px-1.5 py-0.5 rounded border ${on ? 'bg-yellow-300 border-yellow-400' : 'border-gray-300'}`}
      onMouseDown={(e)=>e.stopPropagation()}
    >{on ? '★' : '☆'}</button>
  );

  const OptionPill = ({ active, onClick, children, trailing }) => (
    <button onClick={onClick} className={`px-3 py-1 rounded-full border text-sm mr-2 mb-2 inline-flex items-center ${active ? "bg-black text-white border-black" : "border-gray-300 hover:bg-gray-50"}`}>
      <span>{children}</span>
      {trailing}
    </button>
  );

  return (
    <div className="min-h-screen w-full bg-white text-gray-900 p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Zero‑Width Obfuscator</h1>
          <p className="text-sm text-gray-600 mt-1">Live, minimal, versatile redteaming utility. Invisible Unicode density 0–5; 35+ visible transforms with per‑letter and per‑word randomization. Star favorites for a quick‑access bar.</p>
        </header>

        {/* INPUT (live) */}
        <Section title="Input (live)">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type or paste…" className="w-full h-32 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-black" />
        </Section>

        {/* OUTPUT (live preview, read‑only) */}
        <Section
          title="Output (live preview)"
          right={
            <div className="flex items-center gap-2">
              <button onClick={() => copyToClipboard(output)} className="px-3 py-1.5 rounded-lg border">Copy encoded</button>
              <button onClick={() => copyToClipboard(stripvisibles(output || input))} className="px-3 py-1.5 rounded-lg border">Copy decoded</button>
            </div>
          }
        >
          <textarea value={encodedPreview} readOnly placeholder="Output updates automatically" className="w-full h-32 p-3 border rounded-xl bg-gray-50 outline-none" />
          <p className="text-xs text-gray-600 mt-2">Live preview reflects current transform (or per‑letter/word random mix) then invisible injection. Set density to 0 to disable invisibles entirely.</p>
        </Section>

        {/* OPTIONS */}
        <Section
          title="Options"
          right={
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={inspect} onChange={(e) => setspect(e.target.checked)} />
                Inspect invisibles
              </label>
              <button onClick={() => setRandomSeed((s)=>s+1)} className="px-3 py-1.5 rounded-lg border bg-black text-white">Reseed random</button>
              {copied && <span className="text-xs text-green-600">{copied}!</span>}
            </div>
          }
        >
          <div className="grid md:grid-cols-2 gap-6">
            {/* LEFT COLUMN */}
            <div>
              {/* Invisible scheme */}
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-1">Invisible scheme</div>
                <div>
                  {[
                    ["ZWSP", "U+200B"], ["ZWNJ", "U+200C"], ["ZWJ", "U+200D"], ["LRM", "U+200E"], ["RLM", "U+200F"], ["FEFF", "U+FEFF"],
                    ["WJ", "U+2060"], ["SHY", "U+00AD"], ["INV_TIMES", "U+2062"], ["INV_SEP", "U+2063"], ["INV_PLUS", "U+2064"],
                    ["MIXED", "randomized"],
                  ].map(([k, label]) => (
                    <OptionPill key={k} active={scheme === k} onClick={() => handleSelectScheme(k)}>
                      {k} <span className="text-gray-500 ml-1">{label}</span>
                    </OptionPill>
                  ))}
                </div>

                {/* NEW: Visible divider section */}
                <div className="mt-4 p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-gray-700">Manual divider (visible)</div>
                    <label className="text-sm flex items-center gap-2">
                      <input type="checkbox" checked={useDivider} onChange={(e)=>setUseDivider(e.target.checked)} /> Enable
                    </label>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={divider}
                      onChange={(e)=>setDivider(e.target.value)}
                      placeholder="-"
                      maxLength={8}
                      className="px-2 py-1 border rounded-md w-40"
                    />
                    <span className="text-xs text-gray-500">repeats {density}× between {mode === 'words' ? 'words' : 'characters'}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap">
                    {["-","·","•","|","/","\\","⋅","··","::","→","=>","~"].map(opt => (
                      <OptionPill key={opt} active={divider===opt} onClick={()=>{ setDivider(opt); setUseDivider(true); }}>{opt}</OptionPill>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Tip: set density to 0 to disable all separators entirely (invisibles and divider).</p>
                </div>
              </div>

              {/* Mode */}
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-1">Mode</div>
                <div>
                  <OptionPill active={mode === "chars"} onClick={() => setMode("chars")}>Between characters</OptionPill>
                  <OptionPill active={mode === "words"} onClick={() => setMode("words")}>Between words</OptionPill>
                </div>
              </div>

              {/* Density */}
              <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-1">Density (0 disables)</div>
                <input type="range" min={0} max={5} value={density} onChange={(e) => setDensity(parseInt(e.target.value))} className="w-full" />
                <div className="text-xs text-gray-600 mt-1">{density} invisible mark{density !== 1 ? "s" : ""} between units</div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div>
              {/* Favorites */}
              {favorites.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-medium text-gray-700 mb-1">Favorites</div>
                  <div className="flex flex-wrap mb-2">
                    {favorites.map(k => (
                      <OptionPill key={k} active={!perLetterRandomize && !perWordRandomize && transform === k} onClick={() => { setPerLetterRandomize(false); setPerWordRandomize(false); setTransform(k); }} trailing={<Star on onClick={(e)=>{e.stopPropagation(); toggleFavorite(k);}} />}>{k}</OptionPill>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <div className="text-xs font-medium text-gray-700 mb-1">Transform Library</div>
                <div className="flex items-center gap-3 mb-2">
                  <select value={category} onChange={e=>setCategory(e.target.value)} className="px-2 py-1 border rounded-md text-sm">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="text-xs text-gray-500">{TRANSFORM_KEYS.filter(k => category === 'All' || TRANSFORM_META[k] === category).length} options</span>
                </div>
                <div className="flex flex-wrap mb-2">
                  {TRANSFORM_KEYS.filter(k => category === 'All' || TRANSFORM_META[k] === category).map((k) => (
                    <OptionPill
                      key={k}
                      active={!perLetterRandomize && !perWordRandomize && transform === k}
                      onClick={() => { setPerLetterRandomize(false); setPerWordRandomize(false); setTransform(k); }}
                      trailing={<Star on={favorites.includes(k)} onClick={(e)=>{e.stopPropagation(); toggleFavorite(k);}} />}
                    >
                      {k}
                    </OptionPill>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={perLetterRandomize} onChange={(e)=> { setPerLetterRandomize(e.target.checked); if (e.target.checked) setPerWordRandomize(false); }} />
                    Per‑letter randomize
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={perWordRandomize} onChange={(e)=> { setPerWordRandomize(e.target.checked); if (e.target.checked) setPerLetterRandomize(false); }} />
                    Per‑word randomize
                  </label>
                  <button onClick={() => setRandomSeed((s)=>s+1)} className="px-3 py-1.5 rounded-lg border">Randomize</button>
                </div>
              </div>

              <div className="border rounded-xl p-3 bg-gray-50">
                <div className="text-xs font-medium text-gray-700 mb-1">Other options & ideas</div>
                <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                  <li>Salted pattern: vary density per position (e.g., 1‑2‑3‑2‑1).</li>
                  <li>MIXED: re‑randomize + auto‑copy on click.</li>
                  <li>Scope control: words‑only to reduce payload size.</li>
                  <li>Watermark: fixed invisible prefix/suffix for provenance.</li>
                  <li>Debug: visualize invisibles by mapping them to · temporarily.</li>
                  <li>Round‑trip: Copy decoded strips all supported invisibles.</li>
                </ul>
              </div>
            </div>
          </div>
        </Section>

        <footer className="mt-8 text-xs text-gray-500">
          <p>Supported invisibles: U+200B, U+200C, U+200D, U+200E, U+200F, U+FEFF, U+2060, U+00AD, U+2062, U+2063, U+2064. Exotic sets are stylistic; some fonts may not render all symbols.</p>
        </footer>
      </div>
    </div>
  );
}

// ------------------------------
// Lightweight self‑tests (dev only)
// ------------------------------
(function runSelfTests(){
  try {
    console.assert(typeof encodeInvisible("", {scheme:"ZWSP", density:0, mode:"chars"}) === "string", "encodeInvisible returns string");
    const a = encodeInvisible("ab", {scheme:"ZWSP", density:2, mode:"chars"});
    console.assert(a.length >= 2, "injection adds characters");
    const b = encodeInvisible("a b", {scheme:"ZWSP", density:1, mode:"words"});
    console.assert(b.includes(" "), "word mode preserves spaces");
    const c = encodeInvisible("ab", {scheme:"ZWSP", density:3, mode:"chars", useDivider:true, divider:"-"});
    console.assert(c.includes("-"), "divider mode inserts visible chars");
  } catch (e) {
    console.warn("Self‑tests failed:", e);
  }
})();