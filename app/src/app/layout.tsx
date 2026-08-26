import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./filters.css";
import "./basemap.css";
import "./site-study-history.css";

export const metadata: Metadata = {
  title: "Amazonian Archaeology Atlas",
  description:
    "A source-linked atlas of Amazonian LiDAR research with an Acre archaeology knowledge graph.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
