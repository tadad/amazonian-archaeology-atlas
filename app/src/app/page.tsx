import { AtlasExplorer } from "@/components/atlas-explorer";
import { getDictionary } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getAtlasData } from "@/lib/atlas";

export default async function Home() {
  const locale = await getRequestLocale();
  return <AtlasExplorer data={getAtlasData()} locale={locale} messages={getDictionary(locale)} />;
}
