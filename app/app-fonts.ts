import type { CSSProperties } from "react";
import localFont from "next/font/local";
import { Manrope, Outfit } from "next/font/google";

// App fonts, shared by app/layout.tsx and app/global-error.tsx (which replaces
// the root layout and so must set them on its own <html>).

const raleway = localFont({
  variable: "--font-heading",
  src: [{ path: "./fonts/Raleway-Regular.ttf", weight: "400", style: "normal" }],
});

const ralewayLight = localFont({
  variable: "--font-body",
  src: [{ path: "./fonts/Raleway-Light.ttf", weight: "300", style: "normal" }],
});

const outfitLight = Outfit({
  variable: "--font-number",
  weight: ["300", "400"],
  subsets: ["latin"],
});

// Every digit (and the rupee sign) in the whole app is set in Manrope: this face covers only those characters (unicode-range), and it is put in front of
// the heading / body / number fonts below, so any text keeps its own font and any number, in any page, PDF or old saved data, gets Manrope.
const manropeDigits = localFont({
  src: [{ path: "./fonts/Manrope-Variable.ttf", weight: "200 800", style: "normal" }],
  declarations: [{ prop: "unicode-range", value: "U+0030-0039, U+20B9" }],
  display: "swap",
  // No metric-adjusted fallback face: it would cover every character and keep the real fonts behind it from being used.
  adjustFontFallback: false,
});
const withDigits = (f: { style: { fontFamily: string } }) => `${manropeDigits.style.fontFamily}, ${f.style.fontFamily}`;

// Numbers in the purchase order PDFs (see .po-num in globals.css).
const manrope = Manrope({
  variable: "--font-manrope",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const fontClassName = `${raleway.variable} ${ralewayLight.variable} ${outfitLight.variable} ${manrope.variable}`;
// The font variables set by the classes above, with the Manrope digits face first (an inline style wins over the class).
export const fontStyle = {
  "--font-heading": withDigits(raleway),
  "--font-body": withDigits(ralewayLight),
  "--font-number": withDigits(outfitLight),
} as CSSProperties;
