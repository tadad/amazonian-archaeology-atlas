import type { Metadata } from "next";
import { LibraryShell } from "@/components/library-shell";
import { getAuthors } from "@/lib/vault";
import styles from "../library.module.css";

export const metadata: Metadata = {
  title: "Authors | Acre Archaeology Atlas",
  description: "Browse the people credited by the Acre archaeology vault.",
};

export default function AuthorsIndexPage() {
  const authors = getAuthors();
  return (
    <LibraryShell collection="authors">
      <div className={styles.indexPage}>
        <p className={styles.eyebrow}>The author record</p>
        <h2>{authors.length} credited contributors.</h2>
        <p className={styles.indexLead}>
          People are reconciled into canonical records, while attested spelling and catalogue
          variants remain visible as aliases. Institutions have their own Organization records.
        </p>
        <dl className={styles.indexStats}>
          <div>
            <dt>People</dt>
            <dd>{authors.length}</dd>
          </div>
          <div>
            <dt>Author records</dt>
            <dd>{authors.length}</dd>
          </div>
        </dl>
        <p className={styles.indexInstruction}>Choose an author to see every linked paper and role.</p>
      </div>
    </LibraryShell>
  );
}
