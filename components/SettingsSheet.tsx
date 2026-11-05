"use client";

import { RotateCcw, Unplug, X } from "lucide-react";
import { REVERB_SPACES, type ReverbSpace } from "@/lib/audio/reverb";
import { midiSupported } from "@/lib/midi/input";
import {
  connectMIDI,
  disconnectMIDI,
  setPanel,
  THEMES,
  useSettings,
  useUI,
  type LabelMode,
  type SustainMode,
  type Touch,
} from "@/lib/store";
import { MidiIcon } from "./icons";
import { Range, Segmented, Switch } from "./ui";

export function SettingsSheet() {
  const open = useUI((s) => s.panel === "settings");
  if (!open) return null;
  return <SheetContent />;
}

function SheetContent() {
  const s = useSettings();
  const layerProgress = useUI((u) => u.layerProgress);
  const midiConnected = useUI((u) => u.midiConnected);
  const midiDevices = useUI((u) => u.midiDevices);
  const midiError = useUI((u) => u.midiError);
  const supported = midiSupported();

  return (
    <aside className="sheet" aria-label="Sound and settings">
      <div className="sheet-head">
        <h2>Sound &amp; settings</h2>
        <button type="button" className="icon-btn" onClick={() => setPanel(null)} aria-label="Close settings">
          <X size={18} />
        </button>
      </div>

      <div className="sheet-body">
        <section className="sheet-section">
          <h3>Sound</h3>
          <div className="field">
            <div className="field-row">
              <span className="field-label">Reverb space</span>
            </div>
            <Segmented<ReverbSpace>
              label="Reverb space"
              value={s.reverbSpace}
              onChange={(v) => s.set({ reverbSpace: v })}
              options={REVERB_SPACES.map((r) => ({ value: r.id, label: r.label }))}
            />
          </div>
          <div className="field">
            <div className="field-row">
              <span className="field-label">Reverb amount</span>
              <span className="ctl-value">{Math.round(s.reverb * 100)}%</span>
            </div>
            <Range label="Reverb amount" value={s.reverb} onChange={(v) => s.set({ reverb: v })} />
          </div>
          <div className="field">
            <div className="field-row">
              <span className="field-label">Brightness</span>
              <span className="ctl-value">
                {s.brightness > 0 ? "+" : ""}
                {Math.round(s.brightness * 100)}
              </span>
            </div>
            <Range
              label="Brightness"
              min={-1}
              max={1}
              value={s.brightness}
              onChange={(v) => s.set({ brightness: Math.abs(v) < 0.04 ? 0 : v })}
              onDoubleClick={() => s.set({ brightness: 0 })}
            />
            <span className="field-hint">Darker for a mellow, felted tone; brighter for pop and jazz.</span>
          </div>
          <div className="field">
            <div className="field-row">
              <span className="field-label">Stereo width</span>
              <span className="ctl-value">{Math.round(s.stereo * 100)}%</span>
            </div>
            <Range label="Stereo width" value={s.stereo} onChange={(v) => s.set({ stereo: v })} />
            <span className="field-hint">Spreads low notes left and high notes right, like sitting at the piano.</span>
          </div>
          <div className="field">
            <div className="field-row">
              <span className="field-label">Grand piano dynamics</span>
              <Switch
                label="Multi-velocity grand piano"
                checked={s.velocityLayers}
                onChange={(v) => s.set({ velocityLayers: v })}
              />
            </div>
            <span className="field-hint">
              Loads extra soft and hard recordings (+10 MB) so the Concert Grand changes tone with how hard you play.
              {layerProgress !== null && ` Loading… ${Math.round(layerProgress * 100)}%`}
            </span>
          </div>
        </section>

        <section className="sheet-section">
          <h3>Playing</h3>
          <div className="field">
            <span className="field-label">Sustain pedal (Space)</span>
            <Segmented<SustainMode>
              label="Sustain mode"
              value={s.sustainMode}
              onChange={(v) => s.set({ sustainMode: v })}
              options={[
                { value: "toggle", label: "Press to toggle" },
                { value: "hold", label: "Hold like a pedal" },
              ]}
            />
          </div>
          <div className="field">
            <span className="field-label">Touch (keyboard, mouse &amp; touch)</span>
            <Segmented<Touch>
              label="Touch"
              value={s.touch}
              onChange={(v) => s.set({ touch: v })}
              options={[
                { value: "soft", label: "Soft" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" },
              ]}
            />
          </div>
          <div className="field">
            <span className="field-label">Key labels</span>
            <Segmented<LabelMode>
              label="Key labels"
              value={s.labels}
              onChange={(v) => s.set({ labels: v })}
              options={[
                { value: "both", label: "Both" },
                { value: "keys", label: "Keys" },
                { value: "notes", label: "Notes" },
                { value: "none", label: "None" },
              ]}
            />
          </div>
        </section>

        <section className="sheet-section">
          <h3>MIDI keyboard</h3>
          {!supported ? (
            <span className="field-hint">
              Your browser doesn&apos;t support Web MIDI. Use Chrome, Edge or Firefox on desktop to play with a USB MIDI
              keyboard.
            </span>
          ) : midiConnected ? (
            <div className="field">
              <div className="midi-devices">
                {midiDevices.length ? (
                  midiDevices.map((d) => (
                    <div className="midi-device" key={d}>
                      <i /> {d}
                    </div>
                  ))
                ) : (
                  <span className="field-hint">Listening… plug in a MIDI keyboard.</span>
                )}
              </div>
              <span className="field-hint">Velocity and the sustain pedal (CC64) are supported.</span>
              <button type="button" className="btn" onClick={disconnectMIDI}>
                <Unplug size={15} /> Disconnect
              </button>
            </div>
          ) : (
            <div className="field">
              <span className="field-hint">Play with a real USB or Bluetooth MIDI keyboard, with full velocity.</span>
              <button type="button" className="btn btn-primary" onClick={() => void connectMIDI()}>
                <MidiIcon size={16} /> Connect MIDI keyboard
              </button>
              {midiError && <span className="field-hint" style={{ color: "var(--record)" }}>{midiError}</span>}
            </div>
          )}
        </section>

        <section className="sheet-section">
          <h3>Appearance</h3>
          <div className="theme-grid" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                className="theme-card"
                aria-checked={s.theme === t.id}
                onClick={() => s.set({ theme: t.id })}
              >
                <span className="swatch">
                  {t.swatch.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                {t.name}
              </button>
            ))}
          </div>
        </section>

        <section className="sheet-section">
          <button type="button" className="btn" onClick={s.reset}>
            <RotateCcw size={15} /> Reset all settings
          </button>
        </section>
      </div>
    </aside>
  );
}
