import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryShell } from "@/components/library-shell";
import { getVaultCollection, getVaultCollections } from "@/lib/vault-catalogue";
import styles from "../library.module.css";

type CollectionPageProps = {
  params: Promise<{ collection: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getVaultCollections()
    .filter((collection) => !["papers", "authors"].includes(collection.slug))
    .map((collection) => ({ collection: collection.slug }));
}

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const collection = getVaultCollection((await params).collection);
  return collection
    ? {
        title: `${collection.name} | Acre Archaeology Wiki`,
        description: `Browse ${collection.records.length} ${collection.name.toLocaleLowerCase()} records from the archaeology vault.`,
      }
    : {};
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const collection = getVaultCollection((await params).collection);
  if (!collection || ["papers", "authors"].includes(collection.slug)) notFound();

  return (
    <LibraryShell collection={collection.slug}>
      <div className={styles.indexPage}>
        <p className={styles.eyebrow}>{collection.type} records</p>
        <h2>{collection.records.length} {collection.name.toLocaleLowerCase()}.</h2>
        <p className={styles.indexLead}>
          This index is generated directly from typed Markdown records in the Obsidian vault.
          New records and properties appear on the next build without application-specific pages.
        </p>
        <p className={styles.indexInstruction}>
          Choose a record from the catalogue to read its properties, document, and backlinks.
        </p>
      </div>
    </LibraryShell>
  );
}
