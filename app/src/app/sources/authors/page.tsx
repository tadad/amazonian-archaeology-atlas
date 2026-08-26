import type { Metadata } from "next";
import { LibraryShell } from "@/components/library-shell";
import { formatMessage, getDictionary } from "@/i18n";
import { getRequestLocale } from "@/i18n/server";
import { getAuthors } from "@/lib/vault";
import styles from "../library.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getDictionary(await getRequestLocale());
  return {
    title: `${messages.authors.title} | ${messages.metadata.siteTitle}`,
    description: messages.metadata.authorsDescription,
  };
}

export default async function AuthorsIndexPage() {
  const locale = await getRequestLocale();
  const messages = getDictionary(locale);
  const authors = getAuthors();
  return (
    <LibraryShell collection="authors" locale={locale} messages={messages}>
      <div className={styles.indexPage}>
        <p className={styles.eyebrow}>{messages.authors.eyebrow}</p>
        <h2>{formatMessage(messages.authors.indexTitle, { count: authors.length })}</h2>
        <p className={styles.indexLead}>{messages.authors.indexLead}</p>
        <dl className={styles.indexStats}>
          <div>
            <dt>{messages.authors.people}</dt>
            <dd>{authors.length}</dd>
          </div>
          <div>
            <dt>{messages.authors.records}</dt>
            <dd>{authors.length}</dd>
          </div>
        </dl>
        <p className={styles.indexInstruction}>{messages.authors.instruction}</p>
      </div>
    </LibraryShell>
  );
}
