"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_INSTRUMENT } from "./audio/instruments";
import type { EngineStatus } from "./audio/engine";
import type { ReverbSpace } from "./audio/reverb";
import { getController, type Transport } from "./piano/controller";

export type LabelMode = "both" | "keys" | "notes" | "none";
export type ThemeId = "ember" | "noir" | "aurora" | "ivory";
export type Touch = "soft" | "medium" | "hard";
export type SustainMode = "toggle" | "hold";

export const TOUCH_VELOCITY: Record<Touch, number> = { soft: 46, medium: 84, hard: 118 };

export const THEMES: { id: ThemeId; name: string; swatch: [string, string, string] }[] = [
  { id: "ember", name: "Ember", swatch: ["#0d0b0a", "#ff5b3a", "#ffb648"] },
  { id: "noir", name: "Noir Gold", swatch: ["#0a0a0a", "#d9ad55", "#f3dca0"] },
  { id: "aurora", name: "Aurora", swatch: ["#070a12", "#4fe3c1", "#8b7bff"] },
  { id: "ivory", name: "Ivory", swatch: ["#f4f1ec", "#d9442b", "#1b1917"] },
];

export interface Settings {
  instrument: string;
  volume: number;
  reverb: number;
  reverbSpace: ReverbSpace;
  brightness: number;
  stereo: number;
  velocityLayers: boolean;
  touch: Touch;
  sustainMode: SustainMode;
  labels: LabelMode;
  theme: ThemeId;
  historyMode: "keys" | "notes";
  bpm: number;
  beats: number;
  metronomeVolume: number;
}

export const DEFAULT_SETTINGS: Settings = {
  instrument: DEFAULT_INSTRUMENT,
  volume: 0.8,
  reverb: 0.22,
  reverbSpace: "hall",
  brightness: 0,
  stereo: 0.5,
  velocityLayers: true,
  touch: "medium",
  sustainMode: "toggle",
  labels: "both",
  theme: "aurora",
  historyMode: "keys",
  bpm: 100,
  beats: 4,
  metronomeVolume: 0.7,
};

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "pianomar-settings",
      // v2: default theme became Aurora. v1 saved the old default ("ember") for everyone,
      // so move those visitors over too.
      version: 2,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<Settings>;
        if (version < 2 && s.theme === "ember") s.theme = "aurora";
        return s as SettingsStore;
      },
      // Hydrated manually after mount so server and client render the same markup.
      skipHydration: true,
      partialize: ({ set: _s, reset: _r, ...rest }) => rest,
    },
  ),
);

export type Panel = "settings" | "help" | null;
export type Popover = "instrument" | "theme" | "metronome" | null;

interface UIStore {
  started: boolean;
  engine: EngineStatus;
  layerProgress: number | null;
  sustain: boolean;
  transpose: number;
  focus: boolean;
  panel: Panel;
  popover: Popover;
  transport: Transport;
  transportStart: number;
  takeDuration: number | null;
  metronomeOn: boolean;
  beat: number;
  midiDevices: string[];
  midiConnected: boolean;
  midiError: string | null;
}

export const useUI = create<UIStore>()(() => ({
  started: false,
  engine: { status: "idle", activeId: DEFAULT_INSTRUMENT, loadingId: null, progress: 0 },
  layerProgress: null,
  sustain: true,
  transpose: 0,
  focus: false,
  panel: null,
  popover: null,
  transport: "idle",
  transportStart: 0,
  takeDuration: null,
  metronomeOn: false,
  beat: -1,
  midiDevices: [],
  midiConnected: false,
  midiError: null,
}));

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Unlock audio. Safe to call repeatedly; must run inside a user gesture the first time. */
export function startAudio() {
  getController().engine.start();
  if (!useUI.getState().started) useUI.setState({ started: true });
}

export function toggleSustain() {
  const c = getController();
  c.setSustain(!c.sustain);
}

export function setSustain(on: boolean) {
  getController().setSustain(on);
}

export function transposeBy(delta: number) {
  const c = getController();
  c.setTranspose(c.transpose + delta);
}

export function setTranspose(v: number) {
  getController().setTranspose(v);
}

export function setPanel(panel: Panel) {
  useUI.setState({ panel, popover: null });
}

export function togglePanel(panel: Exclude<Panel, null>) {
  const cur = useUI.getState().panel;
  setPanel(cur === panel ? null : panel);
}

export function setPopover(popover: Popover) {
  useUI.setState({ popover });
}

export function togglePopover(p: Exclude<Popover, null>) {
  useUI.setState((s) => ({ popover: s.popover === p ? null : p }));
}

export function setFocus(focus: boolean) {
  useUI.setState({ focus, popover: null, panel: focus ? null : useUI.getState().panel });
}

/** Esc closes the top-most layer first, and only then toggles focus mode. */
export function handleEscape() {
  const s = useUI.getState();
  if (s.popover) return useUI.setState({ popover: null });
  if (s.panel) return useUI.setState({ panel: null });
  setFocus(!s.focus);
}

export function toggleMetronome() {
  const c = getController();
  if (useUI.getState().metronomeOn) {
    c.stopMetronome();
    useUI.setState({ metronomeOn: false, beat: -1 });
  } else {
    startAudio();
    c.startMetronome();
    useUI.setState({ metronomeOn: true });
  }
}

export function toggleRecording() {
  const c = getController();
  if (c.transport === "recording") c.stopRecording();
  else {
    startAudio();
    c.startRecording();
  }
}

let midiCleanup: (() => void) | null = null;

export async function connectMIDI() {
  if (midiCleanup) return;
  startAudio();
  const c = getController();
  try {
    const { connectMidi } = await import("./midi/input");
    midiCleanup = await connectMidi({
      noteOn: (note, velocity) => c.press(`midi:${note}`, note, velocity),
      noteOff: (note) => c.release(`midi:${note}`),
      sustain: (on) => c.setSustain(on),
      devices: (names) => useUI.setState({ midiDevices: names }),
    });
    useUI.setState({ midiConnected: true, midiError: null });
  } catch (err) {
    console.warn("MIDI access failed", err);
    useUI.setState({
      midiConnected: false,
      midiError: "MIDI access was blocked. Allow MIDI for this site in your browser settings and try again.",
    });
  }
}

export function disconnectMIDI() {
  midiCleanup?.();
  midiCleanup = null;
  getController().releaseWhere("midi:");
  useUI.setState({ midiConnected: false, midiDevices: [] });
}

export function togglePlayback() {
  const c = getController();
  if (c.transport === "playing") c.stopPlayback();
  else {
    startAudio();
    c.play();
  }
}
