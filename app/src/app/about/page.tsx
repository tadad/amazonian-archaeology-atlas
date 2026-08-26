import type { Metadata } from "next";
import Link from "next/link";
import { getVaultCollections } from "@/lib/vault-catalogue";
import styles from "@/app/sources/library.module.css";

export const metadata: Metadata = {
  title: "About | Amazonian Archaeology Atlas",
  description:
    "Scope, evidence standards, source handling, and coordinate policy for the Amazonian LiDAR atlas and Acre research corpus.",
};

export default function AboutPage() {
  const counts = Object.fromEntries(
    getVaultCollections().map((collection) => [collection.slug, collection.records.length]),
  );

  return (
    <main className={styles.libraryPage}>
      <header className={styles.masthead}>
        <Link className={styles.wordmark} href="/">
          Archaeology of Amazonia
        </Link>
        <nav className={styles.primaryNav} aria-label="Primary navigation">
          <Link href="/">Atlas</Link>
          <Link href="/sources/places">Wiki</Link>
          <span aria-current="page">About</span>
        </nav>
      </header>

      <div className={styles.libraryWorkspace}>
        <aside className={styles.catalogue}>
          <div className={styles.catalogueHeader}>
            <p className={styles.eyebrow}>Project guide</p>
            <h1>About</h1>
            <nav className={styles.kindNav} aria-label="About this project">
              <a href="#scope">Scope</a>
              <a href="#ontology">Ontology</a>
              <a href="#evidence">Evidence</a>
              <a href="#coordinates">Coordinates</a>
              <a href="#sources">Sources</a>
            </nav>
          </div>
        </aside>

        <section className={styles.reader}>
          <article className={styles.document}>
            <header className={styles.documentHeader}>
              <p className={styles.eyebrow}>Scope and method</p>
              <h2>A Pan-Amazon LiDAR atlas anchored by the Acre knowledge graph.</h2>
              <p className={styles.indexLead}>
                This project connects LiDAR research across Amazonia with a deeply sourced Acre
                corpus of geoglyphs, ditched enclosures, roads, managed forests, and mound villages.
              </p>

              <dl className={styles.metadataGrid} aria-label="Corpus record counts">
                <div><dt>Place records</dt><dd>{counts.places ?? 0}</dd></div>
                <div><dt>Paper records</dt><dd>{counts.papers ?? 0}</dd></div>
                <div><dt>Authors</dt><dd>{counts.authors ?? 0}</dd></div>
                <div><dt>Organizations</dt><dd>{counts.organizations ?? 0}</dd></div>
              </dl>
            </header>

            <div className={styles.markdown}>
              <h2 id="scope">Scope</h2>
              <p>
                The map tracks published archaeological LiDAR results, archaeologically screened
                legacy surveys, unscreened data archives, preliminary programs, and community-led
                documentation across Amazonia. The navigable knowledge graph remains centered on
                Acre while new regional sources are incorporated with the same six-entity schema.
              </p>

              <h2 id="ontology">One graph, six record types</h2>
              <p>
                <strong>Places</strong> link to <strong>Periods</strong>, <strong>Cultures</strong>,
                and directly supporting <strong>Papers</strong>. Papers link to canonical
                <strong> Authors</strong> and credited <strong>Organizations</strong>. Organization
                records connect institutions to affiliated people, papers, and places. Culture
                records include archaeological traditions, named Indigenous peoples, and the
                explicitly interpretive Aquiry model without treating those categories as
                interchangeable. Backlinks supply the reverse relationships.
              </p>

              <h2 id="evidence">How to read the evidence</h2>
              <p>
                The corpus distinguishes field observations, laboratory results, regional models,
                and later interpretation. Bibliographic verification means a publication record
                was checked; it does not mean every full text has been acquired or reviewed.
              </p>
              <blockquote>
                “Aquiry” is retained as a published interpretive model, not presented as a
                demonstrated single ethnicity. Indigenous peoples and archaeological traditions
                remain distinct graph records unless a source supports a more specific relation.
              </blockquote>

              <h2 id="coordinates">Map coordinates</h2>
              <p>
                Public markers are deliberately coarse research-area placements. The atlas renders
                a coordinate only when its record explicitly declares both
                <code> regional-centroid</code> precision and <code>public-generalized</code>
                visibility. Exact archaeological coordinates and access points are withheld; a
                policy mismatch stops the build instead of silently publishing a marker.
              </p>
              <p>
                LiDAR geometry follows a separate provenance system. Solid footprints come from
                released acquisition GIS; other line styles distinguish polygons digitized from
                publication maps, reconstructed coverage, and context-only geography. A footprint
                represents scanned ground coverage—not a literal aircraft GPS trajectory—and does
                not by itself show that the data have been archaeologically screened.
              </p>

              <h2 id="sources">Sources and machine text</h2>
              <p>
                Paper records preserve stable source URLs, DOI links, authorship, organizations,
                access status, and restricted-file provenance when available. Restricted local
                PDFs are not linked from the public graph because source documents may contain
                exact archaeological coordinates. Verify consequential claims against the original
                publication before reuse.
              </p>
              <p>
                <Link href="/">Explore the atlas</Link> or <Link href="/sources/places">browse the wiki</Link>.
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
