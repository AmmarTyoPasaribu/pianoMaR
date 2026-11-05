/**
 * Music theory helpers + the computer-keyboard mapping.
 *
 * The on-screen keyboard spans 61 keys, C2 (MIDI 36) to C7 (MIDI 96), the same
 * layout as virtualpiano.net: 36 white keys on the number/letter rows, and Shift +
 * the same key plays the black key just above it.
 */

export const LOW_KEY = 36; // C2
export const HIGH_KEY = 96; // C7
export const WHITE_KEY_COUNT = 36;

const SHARP_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export function isBlack(midi: number): boolean {
  return BLACK_PCS.has(((midi % 12) + 12) % 12);
}

export function pitchClassName(pc: number): string {
  return SHARP_NAMES[((pc % 12) + 12) % 12];
}

export function midiToName(midi: number): { name: string; octave: number; full: string } {
  const name = pitchClassName(midi);
  const octave = Math.floor(midi / 12) - 1;
  return { name, octave, full: `${name}${octave}` };
}

/** White keys, left to right, as typed characters. */
export const WHITE_CHARS = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
  "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
  "a", "s", "d", "f", "g", "h", "j", "k", "l",
  "z", "x", "c", "v", "b", "n", "m",
] as const;

/** Character shown for each black key (what you get when typing Shift + key on US QWERTY). */
const SHIFTED: Record<string, string> = {
  "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(", "0": ")",
};

export interface KeyDef {
  midi: number;
  black: boolean;
  /** Character to display on the key ("Q", "!", "W"...). */
  char: string;
  /** Physical key (KeyboardEvent.code) that plays it, before Shift. */
  code: string;
  /** For white keys: their index. For black keys: the index of the white key to their left. */
  whiteIndex: number;
}

function codeFor(ch: string): string {
  return /[0-9]/.test(ch) ? `Digit${ch}` : `Key${ch.toUpperCase()}`;
}

function buildKeys(): KeyDef[] {
  const keys: KeyDef[] = [];
  let midi = LOW_KEY;
  WHITE_CHARS.forEach((ch, i) => {
    // advance midi to the next white key
    while (isBlack(midi)) midi++;
    keys.push({ midi, black: false, char: ch.toUpperCase(), code: codeFor(ch), whiteIndex: i });
    const next = midi + 1;
    if (i < WHITE_CHARS.length - 1 && isBlack(next)) {
      const shifted = SHIFTED[ch] ?? ch.toUpperCase();
      keys.push({ midi: next, black: true, char: shifted, code: codeFor(ch), whiteIndex: i });
    }
    midi++;
  });
  return keys;
}

export const KEYS: KeyDef[] = buildKeys();
export const KEY_BY_MIDI = new Map(KEYS.map((k) => [k.midi, k]));

/** Physical key -> white-key MIDI. Uses e.code so it works on any OS keyboard layout. */
export const CODE_TO_WHITE = new Map(KEYS.filter((k) => !k.black).map((k) => [k.code, k.midi]));

/**
 * Real pianos don't center black keys on the white-key boundary: C♯/F♯ sit a bit
 * left, D♯/A♯ a bit right. Offsets are a fraction of the black key's width.
 */
export const BLACK_OFFSET: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 };

// ---------------------------------------------------------------------------
// Chord detection
// ---------------------------------------------------------------------------

const CHORD_TEMPLATES: [string, number[]][] = [
  ["", [0, 4, 7]],
  ["m", [0, 3, 7]],
  ["dim", [0, 3, 6]],
  ["aug", [0, 4, 8]],
  ["sus2", [0, 2, 7]],
  ["sus4", [0, 5, 7]],
  ["7", [0, 4, 7, 10]],
  ["maj7", [0, 4, 7, 11]],
  ["m7", [0, 3, 7, 10]],
  ["m(maj7)", [0, 3, 7, 11]],
  ["dim7", [0, 3, 6, 9]],
  ["m7♭5", [0, 3, 6, 10]],
  ["7sus4", [0, 5, 7, 10]],
  ["6", [0, 4, 7, 9]],
  ["m6", [0, 3, 7, 9]],
  ["add9", [0, 2, 4, 7]],
  ["m(add9)", [0, 2, 3, 7]],
  ["9", [0, 2, 4, 7, 10]],
  ["maj9", [0, 2, 4, 7, 11]],
  ["m9", [0, 2, 3, 7, 10]],
  ["6/9", [0, 2, 4, 7, 9]],
  ["7♭9", [0, 1, 4, 7, 10]],
  ["7♯9", [0, 3, 4, 7, 10]],
  ["11", [0, 2, 5, 7, 10]],
  ["13", [0, 2, 4, 7, 9, 10]],
  // voicings without the fifth (very common when playing)
  ["7", [0, 4, 10]],
  ["maj7", [0, 4, 11]],
  ["m7", [0, 3, 10]],
  ["5", [0, 7]],
];

const INTERVAL_NAMES = [
  "", "Minor 2nd", "Major 2nd", "Minor 3rd", "Major 3rd", "Perfect 4th",
  "Tritone", "Perfect 5th", "Minor 6th", "Major 6th", "Minor 7th", "Major 7th",
];

const TEMPLATE_KEYS =CHORD_TEMPLATES.map(([q, iv]) => [q, iv.slice().sort((a, b) => a - b).join(",")] as const);

/** Name the chord formed by the given MIDI notes, e.g. "Cmaj7" or "C/E". Null if none. */
export function detectChord(midis: Iterable<number>): string | null {
  const notes = [...midis];
  if (notes.length < 2) return null;
  const bass = Math.min(...notes);
  const bassPc = ((bass % 12) + 12) % 12;
  const pcs = [...new Set(notes.map((n) => ((n % 12) + 12) % 12))];
  if (pcs.length < 2) return null;

  // Try the bass note as root first, then every other pitch class (-> slash chord).
  const roots = [bassPc, ...pcs.filter((p) => p !== bassPc)];
  for (const root of roots) {
    const sig = pcs
      .map((p) => (p - root + 12) % 12)
      .sort((a, b) => a - b)
      .join(",");
    const match = TEMPLATE_KEYS.find(([, key]) => key === sig);
    if (match) {
      const name = `${pitchClassName(root)}${match[0]}`;
      return root === bassPc ? name : `${name}/${pitchClassName(bassPc)}`;
    }
  }

  if (pcs.length === 2) {
    const other = pcs.find((p) => p !== bassPc)!;
    const iv = (other - bassPc + 12) % 12;
    return INTERVAL_NAMES[iv] || null;
  }
  return null;
}
