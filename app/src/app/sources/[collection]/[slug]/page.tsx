import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LibraryShell } from "@/components/library-shell";
import { VaultRecordDocument } from "@/components/vault-record";
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
  return record
    ? {
        title: `${record.title} | Acre Archaeology Wiki`,
        description: `${record.type} record generated from the archaeology vault.`,
      }
    : {};
}

export default async function RecordPage({ params }: RecordPageProps) {
  const { collection, slug } = await params;
  if (["papers", "authors"].includes(collection)) notFound();
  const record = getVaultRecord(collection, slug);
  if (!record) notFound();

  return (
    <LibraryShell collection={collection} activeSlug={record.slug}>
      <VaultRecordDocument record={record} />
    </LibraryShell>
  );
}
