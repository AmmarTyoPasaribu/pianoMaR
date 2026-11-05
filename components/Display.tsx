"use client";

import { Check, Copy, Eraser, RotateCcw, TriangleExclamationPoint } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getInstrument } from "@/lib/audio/instruments";
import { detectChord, KEY_BY_MIDI, midiToName } from "@/lib/music";
import { getController } from "@/lib/piano/controller";
import { useSettings, useUI } from "@/lib/store";
import { formatTime } from "./ui";

interface Chip {
  id: number;
  key: string;
  note: string;
  black: boolean;
  gap?: boolean;
}

const MAX_CHIPS = 48;
const GAP_MS = 1400;

function useElapsed(active: boolean, since: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(performance.now());
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [active]);
  return active ? now - since : 0;
}

export function Display() {
  const historyMode = useSettings((s) => s.historyMode);
  const setSettings = useSettings((s) => s.set);
  const engine = useUI((s) => s.engine);
  const sustain = useUI((s) => s.sustain);
  const transpose = useUI((s) => s.transpose);
  const transport = useUI((s) => s.transport);
  const transportStart = useUI((s) => s.transportStart);
  const midiDevices = useUI((s) => s.midiDevices);
  const metronomeOn = useUI((s) => s.metronomeOn);
  const bpm = useSettings((s) => s.bpm);

  const [note, setNote] = useState<{ name: string; octave: number } | null>(null);
  const [chord, setChord] = useState<string | null>(null);
  const [chips, setChips] = useState<Chip[]>([]);
  const [copied, setCopied] = useState(false);
  const lastAt = useRef(0);
  const nextId = useRef(0);
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const c = getController();
    // The chord is named when notes go down; letting go of a chord keeps its name
    // on screen for a moment instead of degrading it note by note.
    const onNoteOn = () => {
      if (chordTimer.current) clearTimeout(chordTimer.current);
      chordTimer.current = null;
      const held = c.heldNotes();
      const name = detectChord(held);
      if (name) setChord(name);
      else if (held.length <= 1) setChord(null);
    };
    const onNoteOff = () => {
      if (c.heldNotes().length || chordTimer.current) return;
      chordTimer.current = setTimeout(() => {
        chordTimer.current = null;
        if (!c.heldNotes().length) setChord(null);
      }, 1600);
    };

    const unsub = c.subscribe((e) => {
      if (e.type === "on") {
        const n = midiToName(e.midi);
        setNote({ name: n.name, octave: n.octave });
        const def = KEY_BY_MIDI.get(e.key);
        const now = performance.now();
        const gap = lastAt.current > 0 && now - lastAt.current > GAP_MS;
        lastAt.current = now;
        setChips((prev) => {
          const next = [...prev];
          if (gap && next.length) next.push({ id: nextId.current++, key: " ", note: " ", black: false, gap: true });
          next.push({ id: nextId.current++, key: def?.char ?? n.full, note: n.full, black: def?.black ?? false });
          return next.slice(-MAX_CHIPS);
        });
        onNoteOn();
      } else if (e.type === "off") {
        onNoteOff();
      }
    });
    return () => {
      unsub();
      if (chordTimer.current) clearTimeout(chordTimer.current);
    };
  }, []);

  const copy = async () => {
    const text = chips
      .map((c) => (c.gap ? " " : historyMode === "keys" ? c.key : `${c.note} `))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  const loading = engine.status === "loading" && engine.loadingId;
  const elapsed = useElapsed(transport !== "idle", transportStart);
  const playingName = getInstrument(engine.activeId).name;

  return (
    <section className="display" aria-label="Piano display">
      <div className="lcd-note">
        <span className="lcd-label">Note</span>
        <div className="lcd-big" aria-live="off">
          {note ? (
            <>
              {note.name}
              <small>{note.octave}</small>
            </>
          ) : (
            "—"
          )}
        </div>
        <div className="lcd-chord">{chord ?? " "}</div>
      </div>

      <div className="lcd-history">
        <div className="lcd-history-head">
          <span className="lcd-label">Played</span>
          <button
            type="button"
            className="lcd-mini-btn"
            onClick={() => setSettings({ historyMode: historyMode === "keys" ? "notes" : "keys" })}
            title="Show keys or note names"
          >
            {historyMode === "keys" ? "Keys" : "Notes"}
          </button>
          <button type="button" className="lcd-mini-btn" onClick={copy} disabled={!chips.length} title="Copy to clipboard">
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="lcd-mini-btn"
            onClick={() => {
              setChips([]);
              lastAt.current = 0;
            }}
            disabled={!chips.length}
            title="Clear"
            aria-label="Clear history"
          >
            <Eraser size={12} />
          </button>
        </div>
        <div className="history-track">
          {chips.length === 0 ? (
            <span className="history-empty">Play something — your notes show up here.</span>
          ) : (
            chips.map((c) =>
              c.gap ? (
                <span key={c.id} className="history-chip gap" />
              ) : (
                <span key={c.id} className={`history-chip${c.black ? " black" : ""}`}>
                  {historyMode === "keys" ? c.key : c.note}
                </span>
              ),
            )
          )}
        </div>
      </div>

      <div className="lcd-status">
        {loading ? (
          <div className="lcd-progress" role="status">
            <div className="lcd-progress-row">
              <span>
                Loading <b>{getInstrument(engine.loadingId!).name}</b>
              </span>
              <span>{Math.round(engine.progress * 100)}%</span>
            </div>
            <div className="bar">
              <i style={{ width: `${Math.max(4, engine.progress * 100)}%` }} />
            </div>
          </div>
        ) : engine.error ? (
          <div className="lcd-error" role="alert">
            <TriangleExclamationPoint size={14} />
            <span>{engine.error}</span>
            <button
              type="button"
              className="lcd-mini-btn"
              onClick={() => void getController().engine.loadInstrument(useSettings.getState().instrument)}
            >
              <RotateCcw size={12} /> Retry
            </button>
          </div>
        ) : null}
        <span className={`lcd-tag${sustain ? " on" : ""}`}>SUS {sustain ? "ON" : "OFF"}</span>
        <span className={`lcd-tag${transpose ? " on" : ""}`}>TRN {transpose > 0 ? `+${transpose}` : transpose}</span>
        {transport === "recording" && <span className="lcd-tag rec">REC {formatTime(elapsed)}</span>}
        {transport === "playing" && <span className="lcd-tag on">PLAY {formatTime(elapsed)}</span>}
        {metronomeOn && <span className="lcd-tag">♩ {bpm}</span>}
        {midiDevices.length > 0 && <span className="lcd-tag on">MIDI</span>}
        {!loading && !engine.error && engine.status === "ready" && (
          <span className="lcd-tag" title="Current instrument" style={{ gridColumn: "1 / -1" }}>
            {playingName.toUpperCase()}
          </span>
        )}
      </div>
    </section>
  );
}
