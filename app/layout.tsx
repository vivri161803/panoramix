import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { THEME_COLOR, THEME_COOKIE, parseTheme } from "@/lib/theme";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Panoramix", template: "%s · Panoramix" },
  description: "Le medicine di chi assisti: calendario delle dosi, scorte in casa e avvisi per riordinare.",
  robots: { index: false, follow: false },
};

async function currentTheme() {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  return {
    width: "device-width",
    initialScale: 1,
    themeColor:
      theme === "system"
        ? [
            { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
            { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
          ]
        : THEME_COLOR[theme],
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = await currentTheme();
  return (
    <html lang="it" className={`${geist.variable} ${geistMono.variable}`} data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
