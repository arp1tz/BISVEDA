import type { Metadata } from "next";
import {
  Noto_Sans,
  Noto_Sans_Devanagari,
  Noto_Sans_Bengali,
  Noto_Sans_Tamil,
  Noto_Sans_Telugu,
  Noto_Sans_Gujarati,
  Noto_Sans_Kannada,
  Noto_Sans_Malayalam,
  Noto_Sans_Gurmukhi,
  Noto_Sans_Oriya,
} from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { AccessibilityBar } from "@/components/a11y/AccessibilityBar";

// UX4G handbook (Typography, p.152): Noto is the recommended government typeface for
// harmonious, accessible multilingual rendering across Indic scripts. Latin + Devanagari
// are preloaded (English/Hindi/Marathi are the primary demo languages); the remaining
// scripts load on demand only when that script actually appears on the page.
const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-noto-sans",
  display: "swap",
});
const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-devanagari",
  display: "swap",
});
const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-bengali",
  display: "swap",
  preload: false,
});
const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-tamil",
  display: "swap",
  preload: false,
});
const notoTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-telugu",
  display: "swap",
  preload: false,
});
const notoGujarati = Noto_Sans_Gujarati({
  subsets: ["gujarati"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-gujarati",
  display: "swap",
  preload: false,
});
const notoKannada = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-kannada",
  display: "swap",
  preload: false,
});
const notoMalayalam = Noto_Sans_Malayalam({
  subsets: ["malayalam"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-malayalam",
  display: "swap",
  preload: false,
});
const notoGurmukhi = Noto_Sans_Gurmukhi({
  subsets: ["gurmukhi"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-gurmukhi",
  display: "swap",
  preload: false,
});
const notoOriya = Noto_Sans_Oriya({
  subsets: ["oriya"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-oriya",
  display: "swap",
  preload: false,
});

const notoFontVars = [
  notoSans.variable,
  notoDevanagari.variable,
  notoBengali.variable,
  notoTamil.variable,
  notoTelugu.variable,
  notoGujarati.variable,
  notoKannada.variable,
  notoMalayalam.variable,
  notoGurmukhi.variable,
  notoOriya.variable,
].join(" ");

export const metadata: Metadata = {
  title: "BISVEDA | AI Assistant for Indian Standards & BIS Services",
  description:
    "Grounded, source-backed intelligence platform for discovering Indian Standards, mandatory QCOs, testing laboratories, and certification schemes for the Bureau of Indian Standards.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={notoFontVars}>
      <body className="min-h-screen flex flex-col antialiased">
        <AccessibilityBar />
        {children}
      </body>
    </html>
  );
}
