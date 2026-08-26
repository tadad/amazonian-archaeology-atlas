import type { Locale } from "@/i18n/config";
import styles from "./original-language-notice.module.css";

type OriginalLanguageNoticeProps = {
  locale: Locale;
  children: string;
};

export function OriginalLanguageNotice({ locale, children }: OriginalLanguageNoticeProps) {
  if (locale === "en") return null;
  return <p className={styles.notice}>{children}</p>;
}
