import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryShell } from "@/components/library-shell";
import { OriginalLanguageNotice } from "@/components/original-language-notice";
import { VaultMarkdown } from "@/components/vault-markdown";
import { dictionaryValue, formatMessage, getDictionary } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/server";
import { getAuthor, getAuthorPapers, getAuthors } from "@/lib/vault";
import styles from "../../library.module.css";

type AuthorPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAuthors().map((author) => ({ slug: author.slug }));
}

export async function generateMetadata({ params }: AuthorPageProps): Promise<Metadata> {
  const author = getAuthor((await params).slug);
  const messages = getDictionary(await getRequestLocale());
  return author
    ? {
        title: `${author.name} | ${messages.authors.title}`,
        description: formatMessage(messages.metadata.authorDescription, { name: author.name }),
      }
    : {};
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const author = getAuthor((await params).slug);
  if (!author) notFound();
  const papers = getAuthorPapers(author.slug);
  const locale = await getRequestLocale();
  const messages = getDictionary(locale);

  return (
    <LibraryShell collection="authors" activeSlug={author.slug} locale={locale} messages={messages}>
      <article className={styles.authorDocument}>
        <header className={styles.authorHeader}>
          <p className={styles.eyebrow}>
            {messages.authors.author}{" · "}
            {dictionaryValue(messages.controlledValues, author.kind)}
          </p>
          <h2>{author.name}</h2>
          {author.aliases.length > 0 && (
            <p className={styles.aliases}>
              <strong>{messages.authors.alsoCataloguedAs}</strong> {author.aliases.join(" · ")}
            </p>
          )}
        </header>

        {author.body ? (
          <>
            <OriginalLanguageNotice locale={locale}>
              {messages.originalLanguage.research}
            </OriginalLanguageNotice>
            <VaultMarkdown locale={locale}>{author.body}</VaultMarkdown>
          </>
        ) : null}

        <section className={styles.linkedPapers}>
          <div className={styles.sectionHeading}>
            <h3>{messages.authors.linkedPapers}</h3>
            <span>{papers.length}</span>
          </div>
          <ol>
            {papers.map(({ paper, roles }, index) => (
              <li key={paper.slug}>
                <span className={styles.paperOrdinal}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <Link href={localePath(locale, `/sources/papers/${encodeURIComponent(paper.slug)}`)}>{paper.title}</Link>
                  <p>
                    {paper.year || messages.authors.undated}{" · "}
                    {roles.map((role) => dictionaryValue(messages.controlledValues, role)).join(" · ")}{" · "}
                    {dictionaryValue(messages.controlledValues, paper.workType)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </LibraryShell>
  );
}
