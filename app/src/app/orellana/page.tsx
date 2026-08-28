import type { Metadata } from "next";
import { AtlasExplorer } from "@/components/atlas-explorer";
import { getDictionary } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getOrellanaAtlasData } from "@/lib/atlas";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  return {
    title: dictionary.metadata.orellanaTitle,
    description: dictionary.metadata.orellanaDescription,
  };
}

export default async function OrellanaAtlas() {
  const locale = await getRequestLocale();
  return (
    <AtlasExplorer
      data={getOrellanaAtlasData()}
      locale={locale}
      messages={getDictionary(locale)}
    />
  );
}
