import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import {
  formatMessage,
  localizedRecordSubtitle,
  localizedRecordTitle,
  type Dictionary,
} from "@/i18n";
import { localePath, localeTag, type Locale } from "@/i18n/config";
import { getVaultCollection, getVaultCollections } from "@/lib/vault-catalogue";
import styles from "@/app/sources/library.module.css";

type LibraryShellProps = {
  collection: string;
  activeSlug?: string;
  children: ReactNode;
  locale: Locale;
  messages: Dictionary;
};

export function LibraryShell({
  collection: collectionSlug,
  activeSlug,
  children,
  locale,
  messages,
}: LibraryShellProps) {
  const collections = getVaultCollections();
  const collection = getVaultCollection(collectionSlug);
  if (!collection) throw new Error(`Unknown vault collection: ${collectionSlug}`);
  const collectionName =
    (messages.collections as Record<string, string>)[collection.slug] ?? collection.name;
  const collectionNameLower = collectionName.toLocaleLowerCase(localeTag(locale));

  return (
    <main className={styles.libraryPage}>
      <header className={styles.masthead}>
        <Link className={styles.wordmark} href={localePath(locale, "/")}>
          {messages.nav.siteName}
        </Link>
        <nav className={styles.primaryNav} aria-label={messages.nav.primaryLabel}>
          <Link href={localePath(locale, "/")}>{messages.nav.atlas}</Link>
          <span aria-current="page">{messages.nav.wiki}</span>
          <Link href={localePath(locale, "/about")}>{messages.nav.about}</Link>
          <LanguageToggle locale={locale} messages={messages.language} />
        </nav>
      </header>

      <div className={styles.libraryWorkspace}>
        <aside className={styles.catalogue}>
          <div className={styles.catalogueHeader}>
            <p className={styles.eyebrow}>{messages.wiki.catalogueEyebrow}</p>
            <h1>{messages.nav.wiki}</h1>
            <nav className={styles.kindNav} aria-label={messages.wiki.browseCollectionsLabel}>
              {collections.map((candidate) => (
                <Link
                  key={candidate.slug}
                  aria-current={candidate.slug === collection.slug ? "page" : undefined}
                  href={localePath(locale, `/sources/${candidate.slug}`)}
                >
                  {(messages.collections as Record<string, string>)[candidate.slug] ?? candidate.name}{" "}
                  <span>{candidate.records.length}</span>
                </Link>
              ))}
            </nav>
          </div>

          <details className={styles.recordDrawer} open>
            <summary>
              {formatMessage(messages.wiki.browseRecords, {
                count: collection.records.length,
                collection: collectionNameLower,
              })}
            </summary>
            <div className={styles.recordListViewport}>
              <ol className={styles.recordList}>
                {collection.records.map((record, index) => (
                  <li key={record.slug}>
                    <Link
                      aria-current={activeSlug === record.slug ? "page" : undefined}
                      href={localePath(
                        locale,
                        `/sources/${collection.slug}/${encodeURIComponent(record.slug)}`,
                      )}
                    >
                      <span className={styles.recordNumber}>{String(index + 1).padStart(3, "0")}</span>
                      <span>
                        <strong>
                          {localizedRecordTitle(
                            messages,
                            record.collectionSlug,
                            record.slug,
                            record.title,
                          )}
                        </strong>
                        <small>{localizedRecordSubtitle(messages, record.subtitle)}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        </aside>

        <section className={styles.reader} aria-label={messages.wiki.articleLabel} tabIndex={0}>
          {children}
        </section>
      </div>
    </main>
  );
}
