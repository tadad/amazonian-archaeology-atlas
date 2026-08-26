import Link from "next/link";
import { VaultMarkdown } from "@/components/vault-markdown";
import {
  type VaultRecord,
  vaultWebLink,
} from "@/lib/vault-catalogue";
import styles from "@/app/sources/library.module.css";

function propertyLabel(key: string): string {
  return key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function PropertyValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className={styles.emptyValue}>—</span>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (typeof value === "number") return <>{value.toLocaleString("en-US", { useGrouping: false })}</>;
  if (typeof value === "string") {
    const linked = vaultWebLink(value);
    if (linked) return <Link href={linked.href}>{linked.label}</Link>;
    if (/^https?:\/\//.test(value)) {
      return <a href={value} target="_blank" rel="noreferrer">{value}</a>;
    }
    return <>{value}</>;
  }
  if (value instanceof Date) return <>{value.toISOString().slice(0, 10)}</>;
  if (Array.isArray(value)) {
    if (!value.length) return <span className={styles.emptyValue}>—</span>;
    return (
      <span className={styles.propertyList}>
        {value.map((item, index) => <span key={index}><PropertyValue value={item} /></span>)}
      </span>
    );
  }
  if (typeof value === "object") {
    return (
      <dl className={styles.nestedProperties}>
        {Object.entries(value).map(([key, nested]) => (
          <div key={key}>
            <dt>{propertyLabel(key)}</dt>
            <dd><PropertyValue value={nested} /></dd>
          </div>
        ))}
      </dl>
    );
  }
  return <>{String(value)}</>;
}

export function VaultRecordDocument({ record }: { record: VaultRecord }) {
  const properties = Object.entries(record.properties).filter(([key]) => !["name", "title"].includes(key));
  const placeId = record.properties.place_id;
  const isPublicGeneralized =
    record.properties.coordinate_precision === "regional-centroid" &&
    record.properties.location_visibility === "public-generalized";
  const atlasHref =
    record.collectionSlug === "places" &&
    typeof placeId === "string" &&
    record.properties.atlas === true &&
    isPublicGeneralized
      ? `/?place=${encodeURIComponent(placeId)}`
      : null;

  return (
    <article className={styles.document}>
      <header className={styles.documentHeader}>
        <p className={styles.eyebrow}>{propertyLabel(record.type)} record</p>
        <h2>{record.title}</h2>
        {atlasHref ? (
          <p className={styles.atlasLink}>
            <Link href={atlasHref}>View in atlas →</Link>
          </p>
        ) : null}
        <dl className={styles.propertyGrid}>
          {properties.map(([key, value]) => (
            <div key={key}>
              <dt>{propertyLabel(key)}</dt>
              <dd><PropertyValue value={value} /></dd>
            </div>
          ))}
        </dl>
      </header>

      {record.body ? <VaultMarkdown>{record.body}</VaultMarkdown> : null}

      {record.backlinks.length ? (
        <section className={styles.linkedPapers}>
          <div className={styles.sectionHeading}>
            <h3>Referenced by</h3>
            <span>{record.backlinks.length}</span>
          </div>
          <ol>
            {record.backlinks.map((backlink, index) => (
              <li key={`${backlink.collectionSlug}/${backlink.slug}`}>
                <span className={styles.paperOrdinal}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <Link href={`/sources/${backlink.collectionSlug}/${encodeURIComponent(backlink.slug)}`}>
                    {backlink.title}
                  </Link>
                  <p>{backlink.type} · {backlink.subtitle}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
