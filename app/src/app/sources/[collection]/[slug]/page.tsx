import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryShell } from "@/components/library-shell";
import { VaultRecordDocument } from "@/components/vault-record";
import { formatMessage, getDictionary, localizedRecordTitle } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getVaultCollections, getVaultRecord } from "@/lib/vault-catalogue";

type RecordPageProps = {
  params: Promise<{ collection: string; slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getVaultCollections()
    .filter((collection) => !["papers", "authors"].includes(collection.slug))
    .flatMap((collection) => collection.records.map((record) => ({
      collection: collection.slug,
      slug: record.slug,
    })));
}

export async function generateMetadata({ params }: RecordPageProps): Promise<Metadata> {
  const { collection, slug } = await params;
  const record = getVaultRecord(collection, slug);
  const messages = getDictionary(await getRequestLocale());
  const recordType = record
    ? (messages.recordTypes as Record<string, string>)[record.type] ?? record.type
    : "";
  return record
    ? {
        title: `${localizedRecordTitle(
          messages,
          record.collectionSlug,
          record.slug,
          record.title,
        )} | ${messages.metadata.wikiTitle}`,
        description: formatMessage(messages.metadata.recordDescription, { type: recordType }),
      }
    : {};
}

export default async function RecordPage({ params }: RecordPageProps) {
  const { collection, slug } = await params;
  if (["papers", "authors"].includes(collection)) notFound();
  const record = getVaultRecord(collection, slug);
  if (!record) notFound();
  const locale = await getRequestLocale();
  const messages = getDictionary(locale);

  return (
    <LibraryShell collection={collection} activeSlug={record.slug} locale={locale} messages={messages}>
      <VaultRecordDocument record={record} locale={locale} messages={messages} />
    </LibraryShell>
  );
}
