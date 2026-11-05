"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { setPanel, useUI } from "@/lib/store";

const ROWS = [
  { keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], from: "C2" },
  { keys: ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"], from: "F3" },
  { keys: ["A", "S", "D", "F", "G", "H", "J", "K", "L"], from: "B4" },
  { keys: ["Z", "X", "C", "V", "B", "N", "M"], from: "D6" },
];
const C_KEYS = new Set(["1", "8", "T", "S", "L", "M"]);

const SHORTCUTS: [string[], string][] = [
  [["Shift", "+ key"], "Black keys (sharps)"],
  [["Space"], "Sustain pedal"],
  [["←", "→"], "Transpose ±1 semitone"],
  [["Esc"], "Focus mode / close panels"],
  [["?"], "Show this help"],
  [["Click", "Drag"], "Play & glissando with the mouse"],
];

export function HelpDialog() {
  const open = useUI((s) => s.panel === "help");
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="help-title"
      onClose={() => {
        if (useUI.getState().panel === "help") setPanel(null);
      }}
      onClick={(e) => {
        if (e.target === ref.current) setPanel(null);
      }}
    >
      <div className="sheet-head">
        <h2 id="help-title">How to play</h2>
        <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="sheet-body">
        <div className="help-grid">
          {SHORTCUTS.map(([keys, label]) => (
            <div className="help-item" key={label}>
              <span>{label}</span>
              <span className="keys-combo">
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>

        <div className="help-rows" aria-label="White key layout">
          {ROWS.map((r) => (
            <div className="help-row" key={r.from} style={{ paddingLeft: ROWS.indexOf(r) * 10 }}>
              {r.keys.map((k) => (
                <kbd key={k} className={C_KEYS.has(k) ? "oct" : ""}>
                  {k}
                </kbd>
              ))}
            </div>
          ))}
        </div>

        <p className="help-note">
          Every row of your keyboard is a stretch of white keys, left to right, from C2 up to C7. Keys highlighted in
          color are the C notes. Hold <kbd>Shift</kbd> to play the black key just above. Works with any keyboard layout
          (QWERTY, AZERTY, QWERTZ) because it follows key positions, not letters. You can also connect a MIDI keyboard
          from the settings panel.
        </p>
      </div>
    </dialog>
  );
}
