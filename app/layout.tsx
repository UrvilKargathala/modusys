import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/react";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

const BRAND = "#9e7676";

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
      className={`${raleway.variable} ${ralewayLight.variable} ${outfitLight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">
        <Providers>{children}</Providers>
        <PWAInstallPrompt />
        <ServiceWorkerRegister />
        <Analytics />
      </body>
    </html>
  );
}
