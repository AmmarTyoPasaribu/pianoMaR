"use client";

import { Check, ChevronDown, CircleQuestionMark, LoaderCircle, Maximize2, Minimize2, Palette, Settings2 } from "lucide-react";
import { useCallback, useRef } from "react";
import { CATEGORIES, getInstrument, INSTRUMENTS } from "@/lib/audio/instruments";
import { setFocus, setPopover, THEMES, togglePanel, togglePopover, useSettings, useUI } from "@/lib/store";
import { InstrumentIcon, LogoMark, MidiIcon } from "./icons";
import { useDismiss } from "./ui";

export function TopBar() {
  const focus = useUI((s) => s.focus);
  const panel = useUI((s) => s.panel);
  const midiCount = useUI((s) => s.midiDevices.length);

  return (
    <header className="topbar shell">
      <div className="brand">
        <div className="brand-mark">
          <LogoMark size={20} />
        </div>
        <span className="brand-name">
          Piano<span>MaR</span>
        </span>
      </div>

      <div className="picker-wrap">
        <InstrumentPicker />
      </div>

      <div className="top-actions">
        <button
          type="button"
          className="icon-btn hide-in-focus"
          onClick={() => togglePanel("settings")}
          aria-label={midiCount ? `MIDI: ${midiCount} device connected` : "Connect a MIDI keyboard"}
          title={midiCount ? "MIDI keyboard connected" : "MIDI keyboard"}
        >
          <MidiIcon size={19} />
          {midiCount > 0 && <span className="dot" />}
        </button>
        <ThemePicker />
        <button
          type="button"
          className="icon-btn hide-in-focus"
          aria-expanded={panel === "settings"}
          onClick={() => togglePanel("settings")}
          aria-label="Sound & settings"
          title="Sound & settings"
        >
          <Settings2 size={19} />
        </button>
        <button
          type="button"
          className="icon-btn hide-in-focus"
          aria-expanded={panel === "help"}
          onClick={() => togglePanel("help")}
          aria-label="Keyboard shortcuts"
          title="How to play (?)"
        >
          <CircleQuestionMark size={19} />
        </button>
        <span className="top-divider hide-in-focus" />
        <button
          type="button"
          className="icon-btn"
          aria-pressed={focus}
          onClick={() => setFocus(!focus)}
          aria-label={focus ? "Exit focus mode" : "Focus mode"}
          title={focus ? "Exit focus mode (Esc)" : "Focus mode: piano + visualizer only (Esc)"}
        >
          {focus ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>
    </header>
  );
}

function InstrumentPicker() {
  const instrument = useSettings((s) => s.instrument);
  const set = useSettings((s) => s.set);
  const open = useUI((s) => s.popover === "instrument");
  const loadingId = useUI((s) => s.engine.loadingId);
  const progress = useUI((s) => s.engine.progress);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPopover(null), []);
  useDismiss(ref, open, close);

  const def = getInstrument(instrument);

  return (
    <div className="pop-anchor" ref={ref}>
      <button
        type="button"
        className="picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => togglePopover("instrument")}
      >
        <span className="picker-icon">
          {loadingId ? <LoaderCircle size={17} className="spin" /> : <InstrumentIcon id={def.id} size={17} />}
        </span>
        <span className="picker-text">
          <span className="picker-label">
            {loadingId ? `Loading ${Math.round(progress * 100)}%` : def.category === "Pianos" ? "Piano" : def.category}
          </span>
          <span className="picker-name">{def.name}</span>
        </span>
        <ChevronDown size={17} className="picker-chevron" />
      </button>

      {open && (
        <div className="popover instrument-pop" role="listbox" aria-label="Instruments">
          {CATEGORIES.map((cat) => (
            <div className="inst-group" key={cat}>
              <div className="popover-title">{cat}</div>
              <div className="inst-grid">
                {INSTRUMENTS.filter((i) => i.category === cat).map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    role="option"
                    className="inst-item"
                    aria-checked={i.id === instrument}
                    aria-selected={i.id === instrument}
                    onClick={() => {
                      set({ instrument: i.id });
                      setPopover(null);
                    }}
                  >
                    <span className="picker-icon">
                      <InstrumentIcon id={i.id} size={16} />
                    </span>
                    <span className="inst-meta">
                      <span className="inst-name">{i.name}</span>
                      <span className="inst-blurb">{i.blurb}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThemePicker() {
  const theme = useSettings((s) => s.theme);
  const set = useSettings((s) => s.set);
  const open = useUI((s) => s.popover === "theme");
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setPopover(null), []);
  useDismiss(ref, open, close);

  return (
    <div className="pop-anchor hide-in-focus" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => togglePopover("theme")}
        aria-label="Color theme"
        title="Color theme"
      >
        <Palette size={19} />
      </button>
      {open && (
        <div className="popover theme-pop" role="menu" aria-label="Color theme">
          <div className="popover-title">Theme</div>
          <div className="theme-list">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="menuitemradio"
                className="theme-item"
                aria-checked={theme === t.id}
                onClick={() => set({ theme: t.id })}
              >
                <span className="swatch">
                  {t.swatch.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                {t.name}
                {theme === t.id && <Check size={16} className="check" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
