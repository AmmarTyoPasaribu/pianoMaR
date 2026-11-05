import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PianoMaR — Virtual Piano",
    short_name: "PianoMaR",
    description: "Play a real-sounding piano with your computer keyboard, touch or MIDI keyboard.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d0b0a",
    theme_color: "#0d0b0a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
