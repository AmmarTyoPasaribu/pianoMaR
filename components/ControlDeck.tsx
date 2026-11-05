"use client";

import { ChevronDown, Download, Minus, Play, Plus, Square, Trash, Volume1, Volume2, VolumeX, WavesHorizontal } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getController } from "@/lib/piano/controller";
import {
  setPopover,
  setTranspose,
  togglePlayback,
  togglePopover,
  toggleRecording,
  toggleMetronome,
  toggleSustain,
  transposeBy,
  useSettings,
  useUI,
  type Touch,
} from "@/lib/store";
import { MetronomeIcon, PedalIcon } from "./icons";
import { formatTime, Range, Segmented, useDismiss } from "./ui";

export function ControlDeck() {
  return (
    <div className="deck panel" role="toolbar" aria-label="Piano controls">
      <SustainControl />
      <TransposeControl />
      <TouchControl />
      <VolumeControl />
      <ReverbControl />
      <MetronomeControl />
      <RecorderControl />
    </div>
  );
}

function SustainControl() {
  const sustain = useUI((s) => s.sustain);
  const mode = useSettings((s) => s.sustainMode);
  return (
    <div className="ctl">
      <button
        type="button"
        className="pedal"
        aria-pressed={sustain}
        onClick={toggleSustain}
        title={mode === "hold" ? "Hold Space for sustain (click to latch)" : "Toggle sustain (Space)"}
      >
        <PedalIcon size={22} />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.15 }}>
          <span>Sustain</span>
          <span className="pedal-state">{sustain ? "ON" : mode === "hold" ? "HOLD SPACE" : "SPACE"}</span>
        </span>
      </button>
    </div>
  );
}

function TransposeControl() {
  const transpose = useUI((s) => s.transpose);
  return (
    <div className="ctl">
      <span className="ctl-label">
        Transpose <kbd>←</kbd>
        <kbd>→</kbd>
      </span>
      <div className="stepper">
        <button type="button" onClick={() => transposeBy(-1)} disabled={transpose <= -12} aria-label="Transpose down">
          <Minus size={15} />
        </button>
        <output
          className={transpose ? "nonzero" : ""}
          onDoubleClick={() => setTranspose(0)}
          title="Double-click to reset"
          aria-live="polite"
        >
          {transpose > 0 ? `+${transpose}` : transpose}
        </output>
        <button type="button" onClick={() => transposeBy(1)} disabled={transpose >= 12} aria-label="Transpose up">
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

function TouchControl() {
  const touch = useSettings((s) => s.touch);
  const set = useSettings((s) => s.set);
  return (
    <div className="ctl">
      <span className="ctl-label">Touch</span>
      <Segmented<Touch>
        label="Key touch"
        value={touch}
        onChange={(v) => set({ touch: v })}
        options={[
          { value: "soft", label: "Soft", title: "Play softly (pianissimo)" },
          { value: "medium", label: "Med", title: "Normal touch" },
          { value: "hard", label: "Hard", title: "Play loudly (fortissimo)" },
        ]}
      />
    </div>
  );
}

function VolumeControl() {
  const volume = useSettings((s) => s.volume);
  const set = useSettings((s) => s.set);
  const last = useRef(0.8);
  const Icon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className="ctl ctl-grow">
      <span className="ctl-label">Volume</span>
      <div className="ctl-row">
        <button
          type="button"
          className="icon-btn"
          style={{ width: 28, height: 28 }}
          onClick={() => {
            if (volume > 0) {
              last.current = volume;
              set({ volume: 0 });
            } else set({ volume: last.current || 0.8 });
          }}
          aria-label={volume === 0 ? "Unmute" : "Mute"}
        >
          <Icon size={16} />
        </button>
        <Range label="Volume" value={volume} onChange={(v) => set({ volume: v })} />
        <span className="ctl-value">{Math.round(volume * 100)}</span>
      </div>
    </div>
  );
}

function ReverbControl() {
  const reverb = useSettings((s) => s.reverb);
  const space = useSettings((s) => s.reverbSpace);
  const set = useSettings((s) => s.set);
  return (
    <div className="ctl ctl-grow">
      <span className="ctl-label">
        Reverb · <span style={{ textTransform: "none", letterSpacing: 0 }}>{space[0].toUpperCase() + space.slice(1)}</span>
      </span>
      <div className="ctl-row">
        <WavesHorizontal size={16} style={{ color: "var(--text-3)", flex: "none" }} aria-hidden />
        <Range label="Reverb amount" value={reverb} onChange={(v) => set({ reverb: v })} />
        <span className="ctl-value">{Math.round(reverb * 100)}</span>
      </div>
    </div>
  );
}

function MetronomeControl() {
  const on = useUI((s) => s.metronomeOn);
  const beat = useUI((s) => s.beat);
  const open = useUI((s) => s.popover === "metronome");
  const bpm = useSettings((s) => s.bpm);
  const beats = useSettings((s) => s.beats);
  const vol = useSettings((s) => s.metronomeVolume);
  const set = useSettings((s) => s.set);
  const ref = useRef<HTMLDivElement>(null);
  const taps = useRef<number[]>([]);
  const close = useCallback(() => setPopover(null), []);
  useDismiss(ref, open, close);

  const tap = () => {
    const now = performance.now();
    const t = taps.current.filter((x) => now - x < 2500);
    t.push(now);
    taps.current = t.slice(-5);
    if (taps.current.length >= 2) {
      const intervals = taps.current.slice(1).map((x, i) => x - taps.current[i]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      set({ bpm: Math.max(30, Math.min(260, Math.round(60000 / avg))) });
    }
  };

  return (
    <div className="ctl">
      <span className="ctl-label">Metronome</span>
      <div className="metro pop-anchor" ref={ref}>
        <button type="button" className="metro-toggle" aria-pressed={on} onClick={toggleMetronome} title="Start / stop metronome">
          <MetronomeIcon size={17} />
          {bpm}
        </button>
        <button
          type="button"
          className="metro-more"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Metronome settings"
          onClick={() => togglePopover("metronome")}
        >
          <ChevronDown size={15} />
        </button>
        <div className="beat-dots" aria-hidden>
          {Array.from({ length: beats }, (_, i) => (
            <i key={i} className={`${on && beat === i ? "on" : ""}${i === 0 ? " accent" : ""}`} />
          ))}
        </div>
        {open && (
          <div className="popover metro-pop" role="dialog" aria-label="Metronome settings">
            <div className="metro-bpm">
              <output>
                {bpm}
                <small>BPM</small>
              </output>
              <Range label="Tempo" min={30} max={260} step={1} value={bpm} onChange={(v) => set({ bpm: v })} />
            </div>
            <div className="metro-row">
              <span className="field-label">Beats per bar</span>
              <Segmented<string>
                label="Beats per bar"
                value={String(beats)}
                onChange={(v) => set({ beats: Number(v) })}
                options={["2", "3", "4", "6"].map((v) => ({ value: v, label: v }))}
              />
            </div>
            <div className="metro-row">
              <span className="field-label">Click volume</span>
              <Range label="Metronome volume" value={vol} onChange={(v) => set({ metronomeVolume: v })} />
            </div>
            <div className="metro-row">
              <div className="stepper">
                <button type="button" onClick={() => set({ bpm: Math.max(30, bpm - 1) })} aria-label="Slower">
                  <Minus size={15} />
                </button>
                <output>{bpm}</output>
                <button type="button" onClick={() => set({ bpm: Math.min(260, bpm + 1) })} aria-label="Faster">
                  <Plus size={15} />
                </button>
              </div>
              <button type="button" className="btn" onClick={tap}>
                Tap tempo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RecorderControl() {
  const transport = useUI((s) => s.transport);
  const since = useUI((s) => s.transportStart);
  const takeDuration = useUI((s) => s.takeDuration);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (transport === "idle") return;
    const tick = () => setNow(performance.now());
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [transport]);

  const live = transport !== "idle";
  const time = live ? Math.max(0, now - since) : (takeDuration ?? 0);
  const hasTake = takeDuration !== null;

  const download = () => {
    const blob = getController().exportMidi();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    a.href = url;
    a.download = `pianomar-${stamp}.mid`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="ctl">
      <span className="ctl-label">Recorder</span>
      <div className="rec-row">
        <button
          type="button"
          className="rec-btn record"
          aria-pressed={transport === "recording"}
          onClick={toggleRecording}
          title={transport === "recording" ? "Stop recording" : "Record"}
        >
          <span className="rec-dot" />
          {transport === "recording" ? "Stop" : "Rec"}
        </button>
        <button
          type="button"
          className="rec-btn"
          onClick={togglePlayback}
          disabled={!hasTake || transport === "recording"}
          aria-label={transport === "playing" ? "Stop playback" : "Play recording"}
          title={transport === "playing" ? "Stop" : "Play back"}
        >
          {transport === "playing" ? <Square size={14} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
        </button>
        <span className={`rec-time${live ? " live" : ""}`}>{formatTime(time)}</span>
        <button
          type="button"
          className="rec-btn"
          onClick={download}
          disabled={!hasTake || live}
          aria-label="Download as MIDI file"
          title="Download .mid"
        >
          <Download size={15} />
        </button>
        <button
          type="button"
          className="rec-btn"
          onClick={() => getController().clearTake()}
          disabled={!hasTake || live}
          aria-label="Delete recording"
          title="Delete recording"
        >
          <Trash size={15} />
        </button>
      </div>
    </div>
  );
}
