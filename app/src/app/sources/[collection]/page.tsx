import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryShell } from "@/components/library-shell";
import { formatMessage, getDictionary } from "@/i18n";
import { localeTag } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/server";
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
  const locale = await getRequestLocale();
  const messages = getDictionary(locale);
  const collectionName = collection
    ? (messages.collections as Record<string, string>)[collection.slug] ?? collection.name
    : "";
  return collection
    ? {
        title: `${collectionName} | ${messages.metadata.wikiTitle}`,
        description: formatMessage(messages.metadata.collectionDescription, {
          count: collection.records.length,
          collection: collectionName.toLocaleLowerCase(localeTag(locale)),
        }),
      }
    : {};
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const collection = getVaultCollection((await params).collection);
  if (!collection || ["papers", "authors"].includes(collection.slug)) notFound();
  const locale = await getRequestLocale();
  const messages = getDictionary(locale);
  const collectionName =
    (messages.collections as Record<string, string>)[collection.slug] ?? collection.name;
  const collectionNameLower = collectionName.toLocaleLowerCase(localeTag(locale));
  const recordType =
    (messages.recordTypes as Record<string, string>)[collection.type] ?? collection.type;

  return (
    <LibraryShell collection={collection.slug} locale={locale} messages={messages}>
      <div className={styles.indexPage}>
        <p className={styles.eyebrow}>
          {formatMessage(messages.wiki.indexEyebrow, { type: recordType })}
        </p>
        <h2>
          {formatMessage(messages.wiki.indexTitle, {
            count: collection.records.length,
            collection: collectionNameLower,
          })}
        </h2>
        <p className={styles.indexLead}>{messages.wiki.indexLead}</p>
        <p className={styles.indexInstruction}>{messages.wiki.indexInstruction}</p>
      </div>
    </LibraryShell>
  );
}
