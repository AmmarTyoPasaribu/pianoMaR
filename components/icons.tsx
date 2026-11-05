import {
  Activity,
  AudioLines,
  Beer,
  Bell,
  Church,
  Cloud,
  Cpu,
  Crown,
  Drum,
  Fan,
  Feather,
  Gift,
  Guitar,
  Hammer,
  KeyboardMusic,
  MicVocal,
  Piano,
  SlidersVertical,
  Snowflake,
  Sparkles,
  WavesHorizontal,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: SVGProps<SVGSVGElement>) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

/** Brand mark: a slice of keyboard, two black keys over three white. */
export function LogoMark({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M9.17 13v7M14.83 13v7" strokeWidth={1.6} />
      <rect x="7.6" y="4" width="3.1" height="9" rx="0.9" fill="currentColor" stroke="none" />
      <rect x="13.3" y="4" width="3.1" height="9" rx="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Piano sustain pedal, seen from above. */
export function PedalIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M12 2.5v5.5" />
      <path d="M8.4 8h7.2a1 1 0 0 1 1 .86l1.5 9.6A2.3 2.3 0 0 1 15.83 21H8.17a2.3 2.3 0 0 1-2.27-2.54l1.5-9.6A1 1 0 0 1 8.4 8Z" />
      <path d="M9.5 13.5h5M9.2 16.5h5.6" strokeWidth={1.5} />
    </svg>
  );
}

export function MetronomeIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M9.6 3h4.8a1 1 0 0 1 .97.76l3.9 15.5a1.4 1.4 0 0 1-1.36 1.74H6.1a1.4 1.4 0 0 1-1.36-1.74l3.9-15.5A1 1 0 0 1 9.6 3Z" />
      <path d="M6.2 16h11.6" />
      <path d="M12 16l5-9" />
      <circle cx="15.6" cy="9.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 5-pin DIN MIDI connector. */
export function MidiIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.5 3.2v2.4h3V3.2" strokeWidth={1.6} />
      {[
        [7.2, 12],
        [16.8, 12],
        [8.6, 8.4],
        [15.4, 8.4],
        [12, 7],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.15" fill="currentColor" stroke="none" />
      ))}
    </svg>
  );
}

export const INSTRUMENT_ICONS: Record<string, LucideIcon> = {
  grand: Piano,
  bright_acoustic_piano: Sparkles,
  electric_grand_piano: KeyboardMusic,
  honkytonk_piano: Beer,
  electric_piano_1: Zap,
  electric_piano_2: Cpu,
  harpsichord: Crown,
  clavinet: Activity,
  celesta: Snowflake,
  music_box: Gift,
  vibraphone: AudioLines,
  marimba: Drum,
  xylophone: Hammer,
  tubular_bells: Bell,
  drawbar_organ: SlidersVertical,
  church_organ: Church,
  reed_organ: Wind,
  accordion: Fan,
  string_ensemble_1: Feather,
  choir_aahs: MicVocal,
  orchestral_harp: WavesHorizontal,
  acoustic_guitar_nylon: Guitar,
  pad_2_warm: Cloud,
};

export function InstrumentIcon({ id, size = 18 }: { id: string; size?: number }) {
  const Icon = INSTRUMENT_ICONS[id] ?? Piano;
  return <Icon size={size} strokeWidth={1.9} aria-hidden />;
}
