"use client";

import { Headphones, Keyboard, MousePointerClick, Play } from "lucide-react";
import { startAudio } from "@/lib/store";
import { LogoMark, MidiIcon } from "./icons";

export function StartOverlay() {
  return (
    <div className="start" onClick={() => startAudio()} role="presentation">
      <div className="start-card" role="dialog" aria-modal="true" aria-labelledby="start-title">
        <div className="brand-mark">
          <LogoMark size={36} />
        </div>
        <h1 id="start-title">
          Piano<span>MaR</span>
        </h1>
        <p>A concert grand in your browser. Play with your keyboard, mouse, touch, or a real MIDI keyboard.</p>
        <div className="start-features">
          <span>
            <Keyboard size={13} /> 61 keys
          </span>
          <span>
            <MousePointerClick size={13} /> Multi-touch
          </span>
          <span>
            <MidiIcon size={13} /> MIDI input
          </span>
          <span>
            <Headphones size={13} /> Real samples
          </span>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => startAudio()} autoFocus>
          <Play size={17} fill="currentColor" /> Start playing
        </button>
        <span className="start-hint">or press any key · headphones recommended</span>
      </div>
    </div>
  );
}
