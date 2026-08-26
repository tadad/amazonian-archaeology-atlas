import "server-only";

import { headers } from "next/headers";
import {
  defaultLocale,
  isLocale,
  localeRequestHeader,
  type Locale,
} from "@/i18n/config";

export async function getRequestLocale(): Promise<Locale> {
  const value = (await headers()).get(localeRequestHeader);
  return isLocale(value) ? value : defaultLocale;
}
