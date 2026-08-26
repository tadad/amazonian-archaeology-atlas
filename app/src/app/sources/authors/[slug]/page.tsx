import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryShell } from "@/components/library-shell";
import { VaultMarkdown } from "@/components/vault-markdown";
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
  return author
    ? {
        title: `${author.name} | Authors`,
        description: `Papers credited to ${author.name} in the Acre archaeology vault.`,
      }
    : {};
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const author = getAuthor((await params).slug);
  if (!author) notFound();
  const papers = getAuthorPapers(author.slug);

  return (
    <LibraryShell collection="authors" activeSlug={author.slug}>
      <article className={styles.authorDocument}>
        <header className={styles.authorHeader}>
          <p className={styles.eyebrow}>Author · {author.kind}</p>
          <h2>{author.name}</h2>
          {author.aliases.length > 0 && (
            <p className={styles.aliases}>
              <strong>Also catalogued as</strong> {author.aliases.join(" · ")}
            </p>
          )}
        </header>

        {author.body ? <VaultMarkdown>{author.body}</VaultMarkdown> : null}

        <section className={styles.linkedPapers}>
          <div className={styles.sectionHeading}>
            <h3>Linked papers</h3>
            <span>{papers.length}</span>
          </div>
          <ol>
            {papers.map(({ paper, roles }, index) => (
              <li key={paper.slug}>
                <span className={styles.paperOrdinal}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <Link href={`/sources/papers/${encodeURIComponent(paper.slug)}`}>{paper.title}</Link>
                  <p>
                    {paper.year || "Undated"} · {roles.join(" · ")} · {paper.workType.replaceAll("-", " ")}
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
