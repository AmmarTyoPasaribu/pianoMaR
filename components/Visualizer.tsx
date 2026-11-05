"use client";

import { useEffect, useRef } from "react";
import { BLACK_OFFSET, KEY_BY_MIDI } from "@/lib/music";
import { getController } from "@/lib/piano/controller";
import type { ThemeId } from "@/lib/store";

interface Bar {
  key: number;
  start: number;
  end: number | null;
  vel: number;
  black: boolean;
}

/** x / width of a key in CSS px, matching the CSS layout in globals.css. */
function keyRect(key: number, kw: number) {
  const def = KEY_BY_MIDI.get(key);
  if (!def) return null;
  if (!def.black) return { x: def.whiteIndex * kw, w: kw - 1 };
  const bkw = kw * 0.58;
  const off = BLACK_OFFSET[key % 12] ?? 0;
  return { x: (def.whiteIndex + 1) * kw - bkw / 2 + off * bkw - 0.5, w: bkw };
}

function readColors() {
  const s = getComputedStyle(document.documentElement);
  return {
    a: s.getPropertyValue("--accent").trim() || "#ff5b3a",
    b: s.getPropertyValue("--accent-2").trim() || "#ffb648",
  };
}

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function Visualizer({ kw, theme }: { kw: number; theme: ThemeId }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ kw, theme, colors: { a: "#ff5b3a", b: "#ffb648" } });
  const drawRef = useRef<() => void>(() => {});

  useEffect(() => {
    state.current.kw = kw;
    state.current.theme = theme;
    // Wait a frame so the new theme's CSS variables are applied before reading them.
    const id = requestAnimationFrame(() => {
      state.current.colors = readColors();
      drawRef.current();
    });
    return () => cancelAnimationFrame(id);
  }, [kw, theme]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const wrap = wrapRef.current!;
    const ctx = canvas.getContext("2d")!;
    const bars: Bar[] = [];
    let raf: number | null = null;
    let W = 0;
    let H = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    };

    const draw = () => {
      const { kw: k, theme: th, colors } = state.current;
      const now = performance.now() / 1000;
      const speed = Math.min(170, Math.max(70, H * 0.34));
      ctx.clearRect(0, 0, W, H);

      // Octave guides at every C.
      ctx.fillStyle = th === "ivory" ? "rgba(27,25,23,0.06)" : "rgba(255,255,255,0.035)";
      for (let i = 0; i <= 35; i += 7) ctx.fillRect(Math.round(i * k) - 0.5, 0, 1, H);

      ctx.globalCompositeOperation = th === "ivory" ? "source-over" : "lighter";
      for (let i = bars.length - 1; i >= 0; i--) {
        const bar = bars[i];
        const rect = keyRect(bar.key, k);
        const top = H - (now - bar.start) * speed;
        const bottom = bar.end === null ? H : H - (now - bar.end) * speed;
        if (!rect || bottom < -4) {
          bars.splice(i, 1);
          continue;
        }
        const inset = bar.black ? 1 : Math.max(2, k * 0.12);
        const x = rect.x + inset;
        const w = rect.w - inset * 2;
        const h = Math.max(4, bottom - top);
        const alpha = 0.55 + bar.vel * 0.45;

        // soft glow
        ctx.fillStyle = withAlpha(colors.a, 0.16 * alpha);
        roundRect(x - 4, top - 4, w + 8, h + 8, 8);
        ctx.fill();

        const g = ctx.createLinearGradient(0, top, 0, top + h);
        g.addColorStop(0, withAlpha(colors.b, alpha));
        g.addColorStop(1, withAlpha(colors.a, alpha));
        ctx.fillStyle = g;
        roundRect(x, top, w, h, Math.min(6, w / 2));
        ctx.fill();

        if (bar.end === null) {
          // glow where the note meets the key
          const cx = x + w / 2;
          const rg = ctx.createRadialGradient(cx, H, 0, cx, H, k * 1.6);
          rg.addColorStop(0, withAlpha(colors.a, 0.45 * alpha));
          rg.addColorStop(1, withAlpha(colors.a, 0));
          ctx.fillStyle = rg;
          ctx.fillRect(cx - k * 1.6, H - k * 1.6, k * 3.2, k * 1.6);
        }
      }

      // Fade bars out as they rise toward the top.
      ctx.globalCompositeOperation = "destination-out";
      const fade = ctx.createLinearGradient(0, 0, 0, H * 0.45);
      fade.addColorStop(0, "rgba(0,0,0,1)");
      fade.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, W, H * 0.45);
      ctx.globalCompositeOperation = "source-over";
    };
    drawRef.current = draw;

    const loop = () => {
      draw();
      raf = bars.length ? requestAnimationFrame(loop) : null;
    };
    const kick = () => {
      if (raf === null) raf = requestAnimationFrame(loop);
    };

    const unsub = getController().subscribe((e) => {
      const now = performance.now() / 1000;
      if (e.type === "on") {
        if (!KEY_BY_MIDI.has(e.key)) return;
        bars.push({ key: e.key, start: now, end: null, vel: e.velocity / 127, black: KEY_BY_MIDI.get(e.key)!.black });
        kick();
      } else if (e.type === "off") {
        for (let i = bars.length - 1; i >= 0; i--) {
          if (bars[i].key === e.key && bars[i].end === null) {
            bars[i].end = now;
            break;
          }
        }
      } else if (e.type === "reset") {
        for (const b of bars) if (b.end === null) b.end = now;
      }
    });

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    return () => {
      unsub();
      ro.disconnect();
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={wrapRef} className="vis" aria-hidden>
      <canvas ref={canvasRef} />
    </div>
  );
}
