import path from "node:path";
import { Font } from "@react-pdf/renderer";

let registered = false;

/** Call once per document module before rendering — idempotent. */
export function registerSarabunFont() {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Sarabun",
    fonts: [
      { src: path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Regular.ttf"), fontWeight: "normal" },
      { src: path.join(process.cwd(), "src/lib/pdf/fonts/Sarabun-Bold.ttf"), fontWeight: "bold" },
    ],
  });

  // Thai (and other complex scripts) have no space-delimited "words" for react-pdf's
  // default hyphenation engine to break on — that mismeasures glyph advance widths and
  // clips trailing characters on long lines instead of wrapping. Disabling it fixes that.
  Font.registerHyphenationCallback((word) => [word]);
}

/**
 * @react-pdf/renderer (fontkit + yoga) reproducibly undercounts the measured width of a
 * Text node that ends exactly on a non-space glyph, silently clipping the last character —
 * worst with Thai since it has no inter-word spaces to give the measurement rounding any
 * slack. A trailing space on the string itself is the verified workaround; pure-ASCII
 * numeric strings (already right/center aligned) aren't affected and skip it to avoid a
 * visible alignment shift.
 */
export function t(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return `${value} `;
}

/**
 * The trailing-space trick in `t()` only protects the end of a single unwrapped line —
 * @react-pdf/renderer's own auto-wrap for a long paragraph clips the last 1-2 characters
 * of interior wrapped lines too (confirmed: increasing padding just moves the same bug to
 * a new boundary, it never goes away). The reliable fix is to never let it auto-wrap at
 * all: pre-break the text ourselves on word boundaries and render one already-short <Text>
 * per line, each safely single-line like the header rows that never exhibited the bug.
 */
export function wrapText(text: string, maxChars = 40): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}
