import Link from "next/link";
import type { ReactNode } from "react";
import { getVaultCollection, getVaultCollections } from "@/lib/vault-catalogue";
import styles from "@/app/sources/library.module.css";

type LibraryShellProps = {
  collection: string;
  activeSlug?: string;
  children: ReactNode;
};

export function LibraryShell({ collection: collectionSlug, activeSlug, children }: LibraryShellProps) {
  const collections = getVaultCollections();
  const collection = getVaultCollection(collectionSlug);
  if (!collection) throw new Error(`Unknown vault collection: ${collectionSlug}`);

  return (
    <main className={styles.libraryPage}>
      <header className={styles.masthead}>
        <Link className={styles.wordmark} href="/">
          Archaeology of Amazonia
        </Link>
        <nav className={styles.primaryNav} aria-label="Primary navigation">
          <Link href="/">Atlas</Link>
          <span aria-current="page">Wiki</span>
          <Link href="/about">About</Link>
        </nav>
      </header>

      <div className={styles.libraryWorkspace}>
        <aside className={styles.catalogue}>
          <div className={styles.catalogueHeader}>
            <p className={styles.eyebrow}>Acre research vault</p>
            <h1>Wiki</h1>
            <nav className={styles.kindNav} aria-label="Browse vault collections">
              {collections.map((candidate) => (
                <Link
                  key={candidate.slug}
                  aria-current={candidate.slug === collection.slug ? "page" : undefined}
                  href={`/sources/${candidate.slug}`}
                >
                  {candidate.name} <span>{candidate.records.length}</span>
                </Link>
              ))}
            </nav>
          </div>

          <details className={styles.recordDrawer} open>
            <summary>
              Browse {collection.records.length} {collection.name.toLocaleLowerCase()}
            </summary>
            <div className={styles.recordListViewport}>
              <ol className={styles.recordList}>
                {collection.records.map((record, index) => (
                  <li key={record.slug}>
                    <Link
                      aria-current={activeSlug === record.slug ? "page" : undefined}
                      href={`/sources/${collection.slug}/${encodeURIComponent(record.slug)}`}
                    >
                      <span className={styles.recordNumber}>{String(index + 1).padStart(3, "0")}</span>
                      <span>
                        <strong>{record.title}</strong>
                        <small>{record.subtitle}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        </aside>

        <section className={styles.reader} aria-label="Wiki article" tabIndex={0}>
          {children}
        </section>
      </div>
    </main>
  );
}
