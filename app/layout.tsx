import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["500", "600", "700"], display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", weight: ["500", "600", "700"], display: "swap" });

const title = "PianoMaR — Play piano online with your keyboard";
const description =
  "A free virtual piano with real concert grand samples. Play 61 keys with your computer keyboard, mouse, touch or a MIDI keyboard. Sustain, transpose, 23 instruments, reverb, metronome and MIDI recording.";

export const metadata: Metadata = {
  metadataBase: new URL("https://pianomar.vercel.app"),
  title,
  description,
  applicationName: "PianoMaR",
  keywords: ["virtual piano", "online piano", "piano keyboard", "play piano online", "MIDI piano", "piano simulator"],
  openGraph: { title, description, url: "/", siteName: "PianoMaR", type: "website" },
  twitter: { card: "summary", title, description },
  appleWebApp: { capable: true, title: "PianoMaR", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070a12",
};

// Applies the saved theme before first paint so there's no flash of the default theme.
// Mirrors the v1 -> v2 migration in lib/store.ts (old default "ember" becomes "aurora").
const themeScript = `try{var s=JSON.parse(localStorage.getItem("pianomar-settings")||"{}");var t=s&&s.state&&s.state.theme;if(t==="ember"&&!(s.version>=2))t="aurora";if(t)document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="aurora" className={`${inter.variable} ${outfit.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
