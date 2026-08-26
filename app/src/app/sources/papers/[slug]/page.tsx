import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LibraryShell } from "@/components/library-shell";
import { VaultMarkdown } from "@/components/vault-markdown";
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
  return {
    title: `${paper.title} | Papers`,
    description: `${paper.year || "Undated"} ${paper.workType} in the Acre archaeology vault.`,
  };
}

function ContributorList({ contributors }: { contributors: ContributorLink[] }) {
  return contributors.map((contributor, index) => (
    <span key={`${contributor.collection}/${contributor.slug}`}>
      {index > 0 ? ", " : ""}
      <Link href={`/sources/${contributor.collection}/${encodeURIComponent(contributor.slug)}`}>
        {contributor.name}
      </Link>
    </span>
  ));
}

export default async function PaperPage({ params }: PaperPageProps) {
  const paper = getPaper((await params).slug);
  if (!paper) notFound();

  return (
    <LibraryShell collection="papers" activeSlug={paper.slug}>
      <article className={styles.document}>
        <header className={styles.documentHeader}>
          <p className={styles.eyebrow}>
            Paper · {paper.collection} · {paper.year || "Undated"}
          </p>
          <h2>{paper.title}</h2>
          <p className={styles.byline}>
            <ContributorList contributors={[...paper.authors, ...paper.organizations]} />
          </p>

          <dl className={styles.metadataGrid}>
            <div>
              <dt>Type</dt>
              <dd>{paper.workType.replaceAll("-", " ")}</dd>
            </div>
            <div>
              <dt>Languages</dt>
              <dd>{paper.languages.join(" · ").toUpperCase()}</dd>
            </div>
            <div>
              <dt>Local pagination</dt>
              <dd>
                {paper.pages} PDF page{paper.pages === 1 ? "" : "s"}
              </dd>
            </div>
            <div>
              <dt>Text</dt>
              <dd>{paper.extractionStatus}</dd>
            </div>
          </dl>

          {(paper.contributors.length > 0 || paper.editors.length > 0 || paper.translators.length > 0) && (
            <div className={styles.creditLines}>
              {paper.contributors.length > 0 && (
                <p>
                  <strong>With contributions by</strong>{" "}
                  <ContributorList contributors={paper.contributors} />
                </p>
              )}
              {paper.editors.length > 0 && (
                <p>
                  <strong>Edited by</strong> <ContributorList contributors={paper.editors} />
                </p>
              )}
              {paper.translators.length > 0 && (
                <p>
                  <strong>Translated by</strong> <ContributorList contributors={paper.translators} />
                </p>
              )}
            </div>
          )}

          {paper.sourceUrl && (
            <a className={styles.sourceButton} href={paper.sourceUrl} target="_blank" rel="noreferrer">
              Open source record <span aria-hidden="true">↗</span>
            </a>
          )}
        </header>

        <VaultMarkdown>{paper.body}</VaultMarkdown>
      </article>
    </LibraryShell>
  );
}
