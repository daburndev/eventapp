import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Kanit } from "next/font/google";

import { EVENT_BRAND } from "@/lib/constants/event-brand";
import { QueryProvider } from "@/lib/providers/QueryProvider";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Thai-capable display face for the event screen, bundled so projector PCs don't fall back to a thin system font.
const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["thai", "latin"],
  weight: ["600", "800"],
});

export const metadata: Metadata = {
  title: EVENT_BRAND.name,
  description: `Send your photo and message to the screen at ${EVENT_BRAND.name}.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${kanit.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
