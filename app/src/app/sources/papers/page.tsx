import type { Metadata } from "next";
import { LibraryShell } from "@/components/library-shell";
import { getPapers } from "@/lib/vault";
import styles from "../library.module.css";

export const metadata: Metadata = {
  title: "Papers | Acre Archaeology Atlas",
  description: "Browse the papers in the Acre archaeology research vault.",
};

export default function PapersIndexPage() {
  const papers = getPapers();
  const pageCount = papers.reduce((total, paper) => total + paper.pages, 0);

  return (
    <LibraryShell collection="papers">
      <div className={styles.indexPage}>
        <p className={styles.eyebrow}>The paper record</p>
        <h2>{papers.length} studies, source-linked.</h2>
        <p className={styles.indexLead}>
          Articles, theses, books, chapters, and reports on Acre geoglyphs, earthworks, managed
          forests, roads, ceramics, and mound villages. Each record preserves its source and credits.
        </p>
        <dl className={styles.indexStats}>
          <div>
            <dt>Documents</dt>
            <dd>{papers.length}</dd>
          </div>
          <div>
            <dt>PDF pages</dt>
            <dd>{pageCount.toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt>Collections</dt>
            <dd>{new Set(papers.map((paper) => paper.collection)).size}</dd>
          </div>
        </dl>
        <p className={styles.indexInstruction}>Choose a paper from the catalogue to begin reading.</p>
      </div>
    </LibraryShell>
  );
}
