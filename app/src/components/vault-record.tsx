import Link from "next/link";
import { OriginalLanguageNotice } from "@/components/original-language-notice";
import { VaultMarkdown } from "@/components/vault-markdown";
import {
  formatMessage,
  localizedRecordSubtitle,
  localizedRecordTitle,
  type Dictionary,
} from "@/i18n";
import { localePath, localeTag, type Locale } from "@/i18n/config";
import {
  type VaultRecord,
  vaultWebLink,
} from "@/lib/vault-catalogue";
import styles from "@/app/sources/library.module.css";

function propertyLabel(key: string, messages: Dictionary): string {
  return (
    (messages.propertyLabels as Record<string, string>)[key] ??
    key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
  );
}

type PropertyValueProps = {
  value: unknown;
  locale: Locale;
  messages: Dictionary;
};

function PropertyValue({ value, locale, messages }: PropertyValueProps) {
  if (value === null || value === undefined || value === "") return <span className={styles.emptyValue}>—</span>;
  if (typeof value === "boolean") return <>{value ? messages.wiki.yes : messages.wiki.no}</>;
  if (typeof value === "number") return <>{value.toLocaleString(localeTag(locale), { useGrouping: false })}</>;
  if (typeof value === "string") {
    const linked = vaultWebLink(value);
    if (linked) {
      const [, , collectionSlug = "", recordSlug = ""] = linked.href.split("/");
      return (
        <Link href={localePath(locale, linked.href)}>
          {localizedRecordTitle(
            messages,
            collectionSlug,
            decodeURIComponent(recordSlug),
            linked.label,
          )}
        </Link>
      );
    }
    if (/^https?:\/\//.test(value)) {
      return <a href={value} target="_blank" rel="noreferrer">{value}</a>;
    }
    return <>
      {(messages.controlledValues as Record<string, string>)[value] ??
        (messages.recordTypes as Record<string, string>)[value] ??
        (messages.siteKinds as Record<string, string>)[value] ??
        (messages.finds as Record<string, string>)[value] ??
        (messages.featureTypes as Record<string, string>)[value] ??
        (messages.discoveryMethods as Record<string, string>)[value] ??
        value}
    </>;
  }
  if (value instanceof Date) return <>{value.toISOString().slice(0, 10)}</>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className={styles.emptyValue}>—</span>;
    return (
      <span className={styles.propertyList}>
        {value.map((item, index) => (
          <span key={index}><PropertyValue value={item} locale={locale} messages={messages} /></span>
        ))}
      </span>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className={styles.nestedProperties}>
        {Object.entries(value).map(([key, nested]) => (
          <div key={key}>
            <dt>{propertyLabel(key, messages)}</dt>
            <dd><PropertyValue value={nested} locale={locale} messages={messages} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <>{String(value)}</>;
}

type VaultRecordDocumentProps = {
  record: VaultRecord;
  locale: Locale;
  messages: Dictionary;
};

export function VaultRecordDocument({ record, locale, messages }: VaultRecordDocumentProps) {
  const properties = Object.entries(record.properties).filter(([key]) => !["name", "title"].includes(key));
  const siteId = record.properties.site_id;
  const isPublicGeneralized =
    record.properties.coordinate_precision === "regional-centroid" &&
    record.properties.location_visibility === "public-generalized";
  const atlasHref =
    record.collectionSlug === "archaeological-sites" &&
    typeof siteId === "string" &&
    record.properties.atlas === true &&
    isPublicGeneralized
      ? localePath(locale, `/?place=${encodeURIComponent(siteId)}`)
      : null;
  const recordType =
    (messages.recordTypes as Record<string, string>)[record.type] ?? record.type;

  return (
    <article className={styles.document}>
      <header className={styles.documentHeader}>
        <p className={styles.eyebrow}>
          {formatMessage(messages.wiki.recordEyebrow, { type: recordType })}
        </p>
        <h2>
          {localizedRecordTitle(
            messages,
            record.collectionSlug,
            record.slug,
            record.title,
          )}
        </h2>
        {atlasHref ? (
          <p className={styles.atlasLink}>
            <Link href={atlasHref}>{messages.wiki.viewInAtlas}</Link>
          </p>
        ) : null}
        <OriginalLanguageNotice locale={locale}>
          {messages.originalLanguage.research}
        </OriginalLanguageNotice>
        <dl className={styles.propertyGrid}>
          {properties.map(([key, value]) => (
            <div key={key}>
              <dt>{propertyLabel(key, messages)}</dt>
              <dd><PropertyValue value={value} locale={locale} messages={messages} /></dd>
            </div>
          ))}
        </dl>
      </header>

      {record.body ? <VaultMarkdown locale={locale}>{record.body}</VaultMarkdown> : null}

      {record.backlinks.length ? (
        <section className={styles.linkedPapers}>
          <div className={styles.sectionHeading}>
            <h3>{messages.wiki.referencedBy}</h3>
            <span>{record.backlinks.length}</span>
          </div>
          <ol>
            {record.backlinks.map((backlink, index) => (
              <li key={`${backlink.collectionSlug}/${backlink.slug}`}>
                <span className={styles.paperOrdinal}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <Link href={localePath(locale, `/sources/${backlink.collectionSlug}/${encodeURIComponent(backlink.slug)}`)}>
                    {backlink.title}
                  </Link>
                  <p>
                    {(messages.recordTypes as Record<string, string>)[backlink.type] ?? backlink.type}
                    {" · "}{localizedRecordSubtitle(messages, backlink.subtitle)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
