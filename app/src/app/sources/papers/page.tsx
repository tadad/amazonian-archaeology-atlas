import type { Metadata } from "next";
import { LibraryShell } from "@/components/library-shell";
import { formatMessage, getDictionary } from "@/i18n";
import { localeTag } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/server";
import { getPapers } from "@/lib/vault";
import styles from "../library.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getDictionary(await getRequestLocale());
  return {
    title: `${messages.papers.title} | ${messages.metadata.siteTitle}`,
    description: messages.metadata.papersDescription,
  };
}

export default async function PapersIndexPage() {
  const locale = await getRequestLocale();
  const messages = getDictionary(locale);
  const papers = getPapers();
  const pageCount = papers.reduce((total, paper) => total + paper.pages, 0);

  return (
    <LibraryShell collection="papers" locale={locale} messages={messages}>
      <div className={styles.indexPage}>
        <p className={styles.eyebrow}>{messages.papers.eyebrow}</p>
        <h2>{formatMessage(messages.papers.indexTitle, { count: papers.length })}</h2>
        <p className={styles.indexLead}>{messages.papers.indexLead}</p>
        <dl className={styles.indexStats}>
          <div>
            <dt>{messages.papers.documents}</dt>
            <dd>{papers.length}</dd>
          </div>
          <div>
            <dt>{messages.papers.pdfPages}</dt>
            <dd>{pageCount.toLocaleString(localeTag(locale))}</dd>
          </div>
          <div>
            <dt>{messages.papers.collections}</dt>
            <dd>{new Set(papers.map((paper) => paper.collection)).size}</dd>
          </div>
        </dl>
        <p className={styles.indexInstruction}>{messages.papers.instruction}</p>
      </div>
    </LibraryShell>
  );
}
