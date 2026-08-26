import { redirect } from "next/navigation";
import { localePath } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/server";

export default async function SourcesPage() {
  redirect(localePath(await getRequestLocale(), "/sources/lidar-scans"));
}
