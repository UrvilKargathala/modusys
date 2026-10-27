import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Manrope, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/react";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { ToastViewport } from "@/components/shared/toast-viewport";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

const BRAND = "#288AB8";

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

export const metadata: Metadata = {
  title: {
    default: "Modusys",
    template: "%s | Modusys",
  },
  description: "The Furn Enterprise — B2B modular kitchen & furniture platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Modusys",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: BRAND,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${raleway.variable} ${ralewayLight.variable} ${outfitLight.variable} ${manrope.variable} h-full antialiased`}
      // The font variables set by the classes above, with the Manrope digits face first (an inline style wins over the class).
      style={{ "--font-heading": withDigits(raleway), "--font-body": withDigits(ralewayLight), "--font-number": withDigits(outfitLight) } as React.CSSProperties}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-body">
        <Providers>{children}</Providers>
        {/* One toast area for every page (app, sign-in, PDFs). */}
        <ToastViewport />
        <PWAInstallPrompt />
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
