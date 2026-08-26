import type { Metadata } from "next";
import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { OriginalLanguageNotice } from "@/components/original-language-notice";
import { getDictionary } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getRequestLocale } from "@/i18n/server";
import { getVaultCollections } from "@/lib/vault-catalogue";
import styles from "@/app/sources/library.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getDictionary(await getRequestLocale());
  return {
    title: `${messages.nav.about} | ${messages.metadata.siteTitle}`,
    description: messages.metadata.siteDescription,
  };
}

export default async function AboutPage() {
  const locale = await getRequestLocale();
  const messages = getDictionary(locale);
  const counts = Object.fromEntries(
    getVaultCollections().map((collection) => [collection.slug, collection.records.length]),
  );

  return (
    <main className={styles.libraryPage}>
      <header className={styles.masthead}>
        <Link className={styles.wordmark} href={localePath(locale, "/")}>
          {messages.nav.siteName}
        </Link>
        <nav className={styles.primaryNav} aria-label={messages.nav.primaryLabel}>
          <Link href={localePath(locale, "/")}>{messages.nav.atlas}</Link>
          <Link href={localePath(locale, "/sources/lidar-scans")}>{messages.nav.wiki}</Link>
          <span aria-current="page">{messages.nav.about}</span>
          <LanguageToggle locale={locale} messages={messages.language} />
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
          <article className={styles.document} lang="en">
            <OriginalLanguageNotice locale={locale}>
              {messages.originalLanguage.about}
            </OriginalLanguageNotice>
            <header className={styles.documentHeader}>
              <p className={styles.eyebrow}>Scope and method</p>
              <h2>A Pan-Amazon LiDAR atlas anchored by the Acre knowledge graph.</h2>
              <p className={styles.indexLead}>
                This project connects LiDAR research across Amazonia with a deeply sourced Acre
                corpus of geoglyphs, ditched enclosures, roads, managed forests, and mound villages.
              </p>

              <dl className={styles.metadataGrid} aria-label="Corpus record counts">
                <div><dt>LiDAR scans</dt><dd>{counts["lidar-scans"] ?? 0}</dd></div>
                <div><dt>Investigations</dt><dd>{counts.investigations ?? 0}</dd></div>
                <div><dt>Archaeological sites</dt><dd>{counts["archaeological-sites"] ?? 0}</dd></div>
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
                Acre while new regional sources are incorporated through the same research-centered schema.
              </p>

              <h2 id="ontology">Research activity is the center of the graph</h2>
              <p>
                <strong>LiDAR scans</strong> represent acquisitions or coherent campaigns and link
                to the papers and organizations that produced, hold, or analyzed them.
                <strong> Investigations</strong> represent excavation, pedestrian survey, coring,
                paleoecology, community research, and other non-LiDAR fieldwork. Named
                <strong> archaeological sites</strong> are retained as the subjects of that work;
                regional corridors and survey centroids are not treated as sites. Papers link to
                canonical <strong>Authors</strong> and credited <strong>Organizations</strong>.
                Periods and cultures remain supporting vocabularies rather than the graph’s center.
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
                Archaeological-site records retain only deliberately generalized research-area
                placements. Exact coordinates and access points are withheld. Sites are not used
                as a map coverage layer; the atlas centers LiDAR acquisition footprints and
                source-fitted ancient-work evidence cells.
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
                <Link href={localePath(locale, "/")}>Explore the atlas</Link> or{" "}
                <Link href={localePath(locale, "/sources/lidar-scans")}>browse the wiki</Link>.
              </p>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
