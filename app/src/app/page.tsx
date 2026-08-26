import { AtlasExplorer } from "@/components/atlas-explorer";
import { getAtlasData } from "@/lib/atlas";

export default function Home() {
  return <AtlasExplorer data={getAtlasData()} />;
}
