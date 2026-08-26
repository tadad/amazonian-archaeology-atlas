import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryShell } from "@/components/library-shell";
import { OriginalLanguageNotice } from "@/components/original-language-notice";
import { VaultMarkdown } from "@/components/vault-markdown";
import { dictionaryValue, formatMessage, getDictionary } from "@/i18n";
import { localePath, type Locale } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/server";
import { getPaper, getPapers, type ContributorLink } from "@/lib/vault";
import styles from "../../library.module.css";

type PaperPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getPapers().map((paper) => ({ slug: paper.slug }));
}

export async function generateMetadata({ params }: PaperPageProps): Promise<Metadata> {
  const paper = getPaper((await params).slug);
  if (!paper) return {};
  const messages = getDictionary(await getRequestLocale());
  return {
    title: `${paper.title} | ${messages.papers.title}`,
    description: formatMessage(messages.metadata.paperDescription, {
      year: paper.year || messages.papers.undated,
      type: dictionaryValue(messages.controlledValues, paper.workType),
    }),
  };
}

function ContributorList({ contributors, locale }: { contributors: ContributorLink[]; locale: Locale }) {
  return contributors.map((contributor, index) => (
    <span key={`${contributor.collection}/${contributor.slug}`}>
      {index > 0 ? ", " : ""}
      <Link href={localePath(locale, `/sources/${contributor.collection}/${encodeURIComponent(contributor.slug)}`)}>
        {contributor.name}
      </Link>
    </span>
  ));
}

export default async function PaperPage({ params }: PaperPageProps) {
  const paper = getPaper((await params).slug);
  if (!paper) notFound();
  const locale = await getRequestLocale();
  const messages = getDictionary(locale);

  return (
    <LibraryShell collection="papers" activeSlug={paper.slug} locale={locale} messages={messages}>
      <article className={styles.document}>
        <header className={styles.documentHeader}>
          <p className={styles.eyebrow}>
            {messages.papers.paper}{" · "}{paper.collection}{" · "}
            {paper.year || messages.papers.undated}
          </p>
          <h2>{paper.title}</h2>
          <p className={styles.byline}>
            <ContributorList contributors={[...paper.authors, ...paper.organizations]} locale={locale} />
          </p>

          <dl className={styles.metadataGrid}>
            <div>
              <dt>{messages.papers.type}</dt>
              <dd>{dictionaryValue(messages.controlledValues, paper.workType)}</dd>
            </div>
            <div>
              <dt>{messages.papers.languages}</dt>
              <dd>{paper.languages.join(" · ").toUpperCase()}</dd>
            </div>
            <div>
              <dt>{messages.papers.localPagination}</dt>
              <dd>
                {paper.pages}{" "}
                {paper.pages === 1 ? messages.papers.pdfPage : messages.papers.pdfPagesPlural}
              </dd>
            </div>
            <div>
              <dt>{messages.papers.text}</dt>
              <dd>{dictionaryValue(messages.controlledValues, paper.extractionStatus)}</dd>
            </div>
          </dl>

          {(paper.contributors.length > 0 || paper.editors.length > 0 || paper.translators.length > 0) && (
            <div className={styles.creditLines}>
              {paper.contributors.length > 0 && (
                <p>
                  <strong>{messages.papers.contributionsBy}</strong>{" "}
                  <ContributorList contributors={paper.contributors} locale={locale} />
                </p>
              )}
              {paper.editors.length > 0 && (
                <p>
                  <strong>{messages.papers.editedBy}</strong>{" "}
                  <ContributorList contributors={paper.editors} locale={locale} />
                </p>
              )}
              {paper.translators.length > 0 && (
                <p>
                  <strong>{messages.papers.translatedBy}</strong>{" "}
                  <ContributorList contributors={paper.translators} locale={locale} />
                </p>
              )}
            </div>
          )}

          {paper.sourceUrl && (
            <a className={styles.sourceButton} href={paper.sourceUrl} target="_blank" rel="noreferrer">
              {messages.papers.openSource} <span aria-hidden="true">↗</span>
            </a>
          )}
        </header>

        <OriginalLanguageNotice locale={locale}>
          {messages.originalLanguage.research}
        </OriginalLanguageNotice>
        <VaultMarkdown locale={locale}>{paper.body}</VaultMarkdown>
      </article>
    </LibraryShell>
  );
}
