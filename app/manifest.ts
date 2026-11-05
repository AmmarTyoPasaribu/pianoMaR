import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PianoMaR — Virtual Piano",
    short_name: "PianoMaR",
    description: "Play a real-sounding piano with your computer keyboard, touch or MIDI keyboard.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#070a12",
    theme_color: "#070a12",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
