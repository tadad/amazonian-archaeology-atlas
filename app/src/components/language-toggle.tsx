"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";
import { localeCookieName, localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import styles from "./language-toggle.module.css";

type LanguageToggleProps = {
  locale: Locale;
  messages: Dictionary["language"];
};

export function LanguageToggle({ locale, messages }: LanguageToggleProps) {
  const pathname = usePathname();

  function chooseLocale(event: MouseEvent<HTMLAnchorElement>, nextLocale: Locale) {
    document.cookie = `${localeCookieName}=${nextLocale}; Max-Age=31536000; Path=/; SameSite=Lax`;
    const destination = localePath(
      nextLocale,
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    event.preventDefault();
    window.location.assign(destination);
  }

  return (
    <span className={styles.toggle} role="group" aria-label={messages.switcherLabel}>
      <Link
        href={localePath("en", pathname)}
        hrefLang="en"
        lang="en"
        aria-current={locale === "en" ? "true" : undefined}
        aria-label={messages.switchToEnglish}
        onClick={(event) => chooseLocale(event, "en")}
      >
        EN
      </Link>
      <span className={styles.divider} aria-hidden="true">/</span>
      <Link
        href={localePath("pt", pathname)}
        hrefLang="pt-BR"
        lang="pt-BR"
        aria-current={locale === "pt" ? "true" : undefined}
        aria-label={messages.switchToPortuguese}
        onClick={(event) => chooseLocale(event, "pt")}
      >
        PT
      </Link>
    </span>
  );
}
