export type InstrumentCategory = "Pianos" | "Keys" | "Mallets" | "Organs" | "Ensemble";

export interface InstrumentDef {
  id: string;
  name: string;
  category: InstrumentCategory;
  /** General MIDI program number (used when exporting .mid files). */
  program: number;
  source: "salamander" | "soundfont";
  /** Seconds for the sound to die away after a key is released. */
  release: number;
  /** Percussive instruments ring out naturally; key-up does not cut them. */
  ring?: boolean;
  /** Output trim so instruments sit at a similar loudness. */
  gain: number;
  /** Short hint shown in the picker. */
  blurb: string;
}

export const INSTRUMENTS: InstrumentDef[] = [
  { id: "grand", name: "Concert Grand", category: "Pianos", program: 0, source: "salamander", release: 0.6, gain: 1, blurb: "Yamaha C5, multi-velocity" },
  { id: "bright_acoustic_piano", name: "Bright Piano", category: "Pianos", program: 1, source: "soundfont", release: 0.5, gain: 1.7, blurb: "Punchy, cuts through" },
  { id: "electric_grand_piano", name: "Electric Grand", category: "Pianos", program: 2, source: "soundfont", release: 0.45, gain: 1.6, blurb: "CP-70 stage piano" },
  { id: "honkytonk_piano", name: "Honky-Tonk", category: "Pianos", program: 3, source: "soundfont", release: 0.45, gain: 1.6, blurb: "Detuned saloon upright" },
  { id: "electric_piano_1", name: "Rhodes", category: "Pianos", program: 4, source: "soundfont", release: 0.4, gain: 1.9, blurb: "Warm tine electric piano" },
  { id: "electric_piano_2", name: "FM Piano", category: "Pianos", program: 5, source: "soundfont", release: 0.4, gain: 1.8, blurb: "Glassy 80s digital" },

  { id: "harpsichord", name: "Harpsichord", category: "Keys", program: 6, source: "soundfont", release: 0.25, gain: 1.5, blurb: "Plucked baroque" },
  { id: "clavinet", name: "Clavinet", category: "Keys", program: 7, source: "soundfont", release: 0.12, gain: 1.6, blurb: "Funky and percussive" },
  { id: "celesta", name: "Celesta", category: "Keys", program: 8, source: "soundfont", release: 0.8, ring: true, gain: 1.8, blurb: "Sugar-plum sparkle" },
  { id: "music_box", name: "Music Box", category: "Keys", program: 10, source: "soundfont", release: 1, ring: true, gain: 1.8, blurb: "Tiny steel comb" },

  { id: "vibraphone", name: "Vibraphone", category: "Mallets", program: 11, source: "soundfont", release: 1.2, gain: 1.7, blurb: "Soft jazz mallets" },
  { id: "marimba", name: "Marimba", category: "Mallets", program: 12, source: "soundfont", release: 0.6, ring: true, gain: 1.9, blurb: "Rosewood bars" },
  { id: "xylophone", name: "Xylophone", category: "Mallets", program: 13, source: "soundfont", release: 0.5, ring: true, gain: 1.6, blurb: "Bright and dry" },
  { id: "tubular_bells", name: "Tubular Bells", category: "Mallets", program: 14, source: "soundfont", release: 2, ring: true, gain: 1.5, blurb: "Orchestral chimes" },

  { id: "drawbar_organ", name: "Drawbar Organ", category: "Organs", program: 16, source: "soundfont", release: 0.08, gain: 1.3, blurb: "Classic tonewheel" },
  { id: "church_organ", name: "Pipe Organ", category: "Organs", program: 19, source: "soundfont", release: 0.35, gain: 1.3, blurb: "Cathedral pipes" },
  { id: "reed_organ", name: "Reed Organ", category: "Organs", program: 20, source: "soundfont", release: 0.15, gain: 1.6, blurb: "Pump harmonium" },
  { id: "accordion", name: "Accordion", category: "Organs", program: 21, source: "soundfont", release: 0.12, gain: 1.4, blurb: "Parisian café" },

  { id: "string_ensemble_1", name: "Strings", category: "Ensemble", program: 48, source: "soundfont", release: 0.6, gain: 1.6, blurb: "Lush string section" },
  { id: "choir_aahs", name: "Choir", category: "Ensemble", program: 52, source: "soundfont", release: 0.6, gain: 1.6, blurb: "Ethereal voices" },
  { id: "orchestral_harp", name: "Harp", category: "Ensemble", program: 46, source: "soundfont", release: 1.2, ring: true, gain: 1.8, blurb: "Concert pedal harp" },
  { id: "acoustic_guitar_nylon", name: "Nylon Guitar", category: "Ensemble", program: 24, source: "soundfont", release: 0.5, ring: true, gain: 1.8, blurb: "Classical guitar" },
  { id: "pad_2_warm", name: "Warm Pad", category: "Ensemble", program: 89, source: "soundfont", release: 1.4, gain: 1.4, blurb: "Analog synth pad" },
];

export const INSTRUMENT_BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]));
export const DEFAULT_INSTRUMENT = "grand";
export const CATEGORIES: InstrumentCategory[] = ["Pianos", "Keys", "Mallets", "Organs", "Ensemble"];

export function getInstrument(id: string): InstrumentDef {
  return INSTRUMENT_BY_ID.get(id) ?? INSTRUMENT_BY_ID.get(DEFAULT_INSTRUMENT)!;
}
