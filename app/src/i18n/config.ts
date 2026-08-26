export const locales = ["en", "pt"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";
export const localeCookieName = "amazon-atlas-locale";
export const localeRequestHeader = "x-atlas-locale";

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function localeTag(locale: Locale): "en-US" | "pt-BR" {
  return locale === "pt" ? "pt-BR" : "en-US";
}

export function stripLocalePrefix(pathname: string): string {
  const parts = pathname.split("/");
  if (isLocale(parts[1])) {
    const stripped = `/${parts.slice(2).join("/")}`;
    return stripped === "/" ? "/" : stripped.replace(/\/$/, "");
  }
  return pathname || "/";
}

export function localePath(locale: Locale, href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;

  const hashIndex = href.indexOf("#");
  const queryIndex = href.indexOf("?");
  const suffixIndex = [hashIndex, queryIndex]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const pathname = suffixIndex === undefined ? href : href.slice(0, suffixIndex);
  const suffix = suffixIndex === undefined ? "" : href.slice(suffixIndex);
  const unprefixed = stripLocalePrefix(pathname);

  return `/${locale}${unprefixed === "/" ? "" : unprefixed}${suffix}`;
}
