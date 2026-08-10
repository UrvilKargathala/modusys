import type { Metadata } from "next";
import localFont from "next/font/local";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  weight: "300",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Modusys",
  description: "The Furn Enterprise — B2B modular kitchen & furniture platform",
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
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
