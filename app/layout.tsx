import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontClassName, fontStyle } from "./app-fonts";
import { Providers } from "@/components/providers";
import { Analytics } from "@vercel/analytics/react";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";
import { ToastViewport } from "@/components/shared/toast-viewport";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

const BRAND = "#288AB8";

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
      className={`${fontClassName} h-full antialiased`}
      style={fontStyle}
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
