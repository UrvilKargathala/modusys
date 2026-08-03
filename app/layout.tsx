import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

const raleway = localFont({
  variable: "--font-heading",
  src: [{ path: "./fonts/Raleway-Regular.ttf", weight: "400", style: "normal" }],
});

const ralewayLight = localFont({
  variable: "--font-body",
  src: [{ path: "./fonts/Raleway-Light.ttf", weight: "300", style: "normal" }],
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
      className={`${raleway.variable} ${ralewayLight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
