import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import { getDictionary } from "@/i18n";
import { localeTag } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/server";
import "./globals.css";
import "./filters.css";
import "./basemap.css";
import "./site-study-history.css";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  return {
    title: dictionary.metadata.siteTitle,
    description: dictionary.metadata.siteDescription,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  return (
    <html lang={localeTag(locale)}>
      <body>{children}</body>
    </html>
  );
}
