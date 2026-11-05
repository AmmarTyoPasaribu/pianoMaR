"use client";

import { useEffect } from "react";
import { CODE_TO_WHITE, KEY_BY_MIDI } from "@/lib/music";
import { getController } from "@/lib/piano/controller";
import {
  handleEscape,
  setSustain,
  startAudio,
  togglePanel,
  toggleSustain,
  TOUCH_VELOCITY,
  transposeBy,
  useSettings,
  useUI,
} from "@/lib/store";
import { ControlDeck } from "./ControlDeck";
import { Display } from "./Display";
import { Footer } from "./Footer";
import { HelpDialog } from "./HelpDialog";
import { SettingsSheet } from "./SettingsSheet";
import { Stage } from "./Stage";
import { StartOverlay } from "./StartOverlay";
import { TopBar } from "./TopBar";

export default function PianoApp() {
  const focus = useUI((s) => s.focus);
  const started = useUI((s) => s.started);

  useHydrateSettings();
  useEngineBridge();
  useSettingsSync();
  useComputerKeyboard();

  return (
    <div className="app" data-focus={focus}>
      <TopBar />
      <section className="dash shell">
        <Display />
        <ControlDeck />
      </section>
      <Stage />
      <Footer />
      <SettingsSheet />
      <HelpDialog />
      {!started && <StartOverlay />}
    </div>
  );
}

function useHydrateSettings() {
  useEffect(() => {
    void useSettings.persist.rehydrate();
  }, []);
}

/** Mirror controller / engine state into the UI store, and never leave notes stuck. */
function useEngineBridge() {
  useEffect(() => {
    const c = getController();
    c.engine.onStatus = (engine) => useUI.setState({ engine });
    c.engine.onLayerProgress = (layerProgress) => useUI.setState({ layerProgress });
    useUI.setState({ engine: c.engine.status, sustain: c.sustain, transpose: c.transpose });

    const unsub = c.subscribe((e) => {
      switch (e.type) {
        case "sustain":
          useUI.setState({ sustain: e.on });
          break;
        case "transpose":
          useUI.setState({ transpose: e.value });
          break;
        case "transport":
          useUI.setState({ transport: e.state, transportStart: e.startedAt, takeDuration: e.takeDuration });
          break;
        case "beat":
          useUI.setState({ beat: e.beat });
          break;
      }
    });

    const releaseAll = () => {
      c.releaseInputs();
      if (useSettings.getState().sustainMode === "hold") c.setSustain(false);
    };
    const onVisibility = () => {
      if (document.hidden) releaseAll();
    };
    // Mouse clicks shouldn't leave buttons focused: Space would then "click" them too.
    const noFocusSteal = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (el?.closest("button") && !el.closest("dialog")) e.preventDefault();
    };

    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("mousedown", noFocusSteal);
    return () => {
      unsub();
      c.engine.onStatus = null;
      c.engine.onLayerProgress = null;
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("mousedown", noFocusSteal);
    };
  }, []);
}

/** Push persisted settings into the audio engine / controller and the page theme. */
function useSettingsSync() {
  const s = useSettings();
  const c = getController();

  useEffect(() => void c.engine.loadInstrument(s.instrument), [c, s.instrument]);
  useEffect(() => c.engine.setVolume(s.volume), [c, s.volume]);
  useEffect(() => c.engine.setReverb(s.reverb), [c, s.reverb]);
  useEffect(() => c.engine.setReverbSpace(s.reverbSpace), [c, s.reverbSpace]);
  useEffect(() => c.engine.setBrightness(s.brightness), [c, s.brightness]);
  useEffect(() => c.engine.setStereo(s.stereo), [c, s.stereo]);
  useEffect(() => c.engine.setVelocityLayers(s.velocityLayers), [c, s.velocityLayers]);
  useEffect(() => {
    c.velocity = TOUCH_VELOCITY[s.touch];
  }, [c, s.touch]);
  useEffect(() => {
    c.metronome.bpm = s.bpm;
    c.metronome.beats = s.beats;
    c.metronome.setVolume(s.metronomeVolume);
  }, [c, s.bpm, s.beats, s.metronomeVolume]);
  useEffect(() => {
    if (s.sustainMode === "hold") c.setSustain(false);
  }, [c, s.sustainMode]);
  useEffect(() => {
    // Read from the store, not the render value: right after hydration the render value can
    // still be the default for one frame, which would flash the wrong theme.
    const theme = useSettings.getState().theme;
    document.documentElement.dataset.theme = theme;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
  }, [s.theme]);
}

function isTextField(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range";
}

/** Computer-keyboard input. Uses e.code (physical position) so any layout works. */
function useComputerKeyboard() {
  useEffect(() => {
    const c = getController();
    const held = new Map<string, number>();

    const onDown = (e: KeyboardEvent) => {
      if (isTextField(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const onRange = e.target instanceof HTMLInputElement && e.target.type === "range";

      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        startAudio();
        if (useSettings.getState().sustainMode === "hold") setSustain(true);
        else toggleSustain();
        return;
      }
      if (e.key === "Escape") {
        handleEscape();
        return;
      }
      if (useUI.getState().panel === "help") return;
      if (e.key === "?") {
        togglePanel("help");
        return;
      }
      if ((e.code === "ArrowLeft" || e.code === "ArrowRight") && !onRange) {
        e.preventDefault();
        transposeBy(e.code === "ArrowLeft" ? -1 : 1);
        return;
      }

      const white = CODE_TO_WHITE.get(e.code);
      if (white === undefined) return;
      e.preventDefault();
      if (e.repeat || held.has(e.code)) return;
      const black = white + 1;
      const key = e.shiftKey && KEY_BY_MIDI.get(black)?.black ? black : white;
      startAudio();
      held.set(e.code, key);
      c.press(`kb:${e.code}`, key);
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (useSettings.getState().sustainMode === "hold") setSustain(false);
        return;
      }
      if (held.has(e.code)) {
        held.delete(e.code);
        c.release(`kb:${e.code}`);
      }
    };

    const onBlur = () => held.clear();

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
}
