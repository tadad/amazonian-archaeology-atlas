"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AtlasSearchBox } from "@/components/atlas-search-box";
import { VaultMarkdown } from "@/components/vault-markdown";
import {
  type AtlasAncientFeatureCell,
  type AtlasData,
  type AtlasLidarFootprint,
  type AtlasLidarGeometryProvenance,
  type AtlasLidarReviewClass,
  type AtlasLidarSurvey,
  type AtlasPlace,
  type AtlasSearchResult,
  coordinateMethodMeta,
  lidarReviewClassForStatus,
  lidarReviewClassForSurveys,
  locationStatusFor,
  locationStatusMeta,
} from "@/lib/atlas-types";

const ExcavationMap = dynamic(() => import("./excavation-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading" role="status">
      <span className="loading-mark" aria-hidden="true" />
      Loading map…
    </div>
  ),
});

const siteQueryParam = "place";
const noMapSites: AtlasPlace[] = [];

const lidarReviewClasses: readonly {
  id: AtlasLidarReviewClass;
  label: string;
  detail: string;
  title: string;
}[] = [
  {
    id: "reviewed",
    label: "Reviewed",
    detail: "systematic screen",
    title: "Toggle LiDAR coverage with a published systematic archaeological review",
  },
  {
    id: "partial",
    label: "Partial",
    detail: "or ongoing",
    title: "Toggle LiDAR coverage with partial or ongoing archaeological review",
  },
  {
    id: "unreviewed",
    label: "No review",
    detail: "found",
    title: "Toggle LiDAR coverage for which no published archaeological review was found",
  },
];

function lidarFootprintReviewClass(
  footprint: AtlasLidarFootprint,
  surveysById: ReadonlyMap<string, AtlasLidarSurvey>,
): AtlasLidarReviewClass {
  const surveys = footprint.surveyIds
    .map((surveyId) => surveysById.get(surveyId))
    .filter((survey): survey is AtlasLidarSurvey => Boolean(survey));
  return lidarReviewClassForSurveys(surveys);
}

const lidarReviewLabels = {
  systematic: "Systematic review completed",
  partial: "Partially reviewed",
  ongoing: "Archaeological review ongoing",
  "none-found": "No published review found",
} as const;

function siteIdFromUrl(places: AtlasPlace[]) {
  const siteId = new URL(window.location.href).searchParams.get(siteQueryParam);
  return siteId && places.some((place) => place.id === siteId) ? siteId : null;
}

function updateSiteInUrl(siteId: string | null, mode: "push" | "replace" = "push") {
  const url = new URL(window.location.href);

  if (siteId) url.searchParams.set(siteQueryParam, siteId);
  else url.searchParams.delete(siteQueryParam);

  window.history[`${mode}State`](null, "", url);
}

function googleMapsUrlFor(place: AtlasPlace) {
  const coordinates = encodeURIComponent(`${place.lat},${place.lon}`);
  return `https://www.google.com/maps/search/?api=1&query=${coordinates}`;
}

type LidarStudyGroup = {
  paperId: string;
  year: number;
  surveys: AtlasLidarSurvey[];
};

type ResearchLink = {
  href: string;
  label: string;
  external: boolean;
};

function dedupeResearchLinks(links: readonly ResearchLink[]): ResearchLink[] {
  return [...new Map(links.map((link) => [link.href, link])).values()];
}

function ResearchLinks({ links }: { links: readonly ResearchLink[] }) {
  if (!links.length) return null;

  return (
    <div className="research-links">
      <h3>Relevant links</h3>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>
            ) : (
              <Link href={link.href}>{link.label} →</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type LidarDisplayProvenance = "released" | "source-derived" | "context";

const lidarProvenanceLabels: Record<LidarDisplayProvenance, string> = {
  released: "Released GIS",
  "source-derived": "Reconstructed from source",
  context: "Context only",
};

function lidarDisplayProvenance(
  provenance: AtlasLidarGeometryProvenance,
): LidarDisplayProvenance {
  if (provenance === "released" || provenance === "context") return provenance;
  return "source-derived";
}

function groupLidarStudies(surveys: readonly AtlasLidarSurvey[]): LidarStudyGroup[] {
  const groups = new Map<string, LidarStudyGroup>();

  for (const survey of surveys) {
    const group = groups.get(survey.paperId);
    if (group) group.surveys.push(survey);
    else groups.set(survey.paperId, { paperId: survey.paperId, year: survey.year, surveys: [survey] });
  }

  return [...groups.values()].sort((left, right) => right.year - left.year);
}

function surveyOverlapsFeatureCell(
  survey: AtlasLidarSurvey,
  cell: AtlasAncientFeatureCell,
): boolean {
  const latitudes = survey.positions.map(([latitude]) => latitude);
  const longitudes = survey.positions.map(([, longitude]) => longitude);
  const surveyBounds: [[number, number], [number, number]] = [
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)],
  ];
  return (
    surveyBounds[0][0] < cell.bounds[1][0] &&
    surveyBounds[1][0] > cell.bounds[0][0] &&
    surveyBounds[0][1] < cell.bounds[1][1] &&
    surveyBounds[1][1] > cell.bounds[0][1]
  );
}

function boundsForFootprints(
  footprints: readonly AtlasLidarFootprint[],
): [[number, number], [number, number]] | null {
  const positions = footprints.flatMap((footprint) => footprint.positions);
  if (!positions.length) return null;
  return [
    [
      Math.min(...positions.map(([latitude]) => latitude)),
      Math.min(...positions.map(([, longitude]) => longitude)),
    ],
    [
      Math.max(...positions.map(([latitude]) => latitude)),
      Math.max(...positions.map(([, longitude]) => longitude)),
    ],
  ];
}

export function AtlasExplorer({ data }: { data: AtlasData }) {
  const router = useRouter();
  const digs = data.places;
  const findLabels = Object.fromEntries(data.finds.map((find) => [find.id, find.name]));
  const techniqueLabels = Object.fromEntries(
    data.techniques.map((technique) => [technique.id, technique.name]),
  );
  const panelRef = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLidarSurveyIds, setSelectedLidarSurveyIds] = useState<string[]>([]);
  const [selectedLidarFootprintIds, setSelectedLidarFootprintIds] = useState<string[]>([]);
  const [selectedAncientFeatureId, setSelectedAncientFeatureId] = useState<string | null>(null);
  const [showAncientFeatures, setShowAncientFeatures] = useState(true);
  const [focusBounds, setFocusBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [visibleLidarReviews, setVisibleLidarReviews] = useState<
    Record<AtlasLidarReviewClass, boolean>
  >({ reviewed: true, partial: true, unreviewed: true });

  const mappedLidarSurveyIds = useMemo(
    () => new Set(
      data.lidarFootprints
        .filter((footprint) => footprint.provenance !== "context")
        .flatMap((footprint) => footprint.surveyIds),
    ),
    [data.lidarFootprints],
  );
  const usableLidarSurveys = useMemo(
    () => data.lidarSurveys.filter(
      (survey) => survey.archaeologyUsable && mappedLidarSurveyIds.has(survey.id),
    ),
    [data.lidarSurveys, mappedLidarSurveyIds],
  );
  const usableLidarSurveysById = useMemo(
    () => new Map(usableLidarSurveys.map((survey) => [survey.id, survey])),
    [usableLidarSurveys],
  );
  const filteredLidarSurveys = useMemo(
    () => usableLidarSurveys.filter(
      (survey) => visibleLidarReviews[
        lidarReviewClassForStatus(survey.archaeologyReviewStatus)
      ],
    ),
    [usableLidarSurveys, visibleLidarReviews],
  );
  const lidarFootprintCountsByReview = useMemo(
    () => Object.fromEntries(
      lidarReviewClasses.map(({ id }) => [
        id,
        data.lidarFootprints.filter(
          (footprint) =>
            footprint.provenance !== "context" &&
            footprint.surveyIds.some((surveyId) => usableLidarSurveysById.has(surveyId)) &&
            lidarFootprintReviewClass(footprint, usableLidarSurveysById) === id,
        ).length,
      ]),
    ) as Record<AtlasLidarReviewClass, number>,
    [data.lidarFootprints, usableLidarSurveysById],
  );
  const filteredLidarFootprints = useMemo(
    () => data.lidarFootprints.filter(
      (footprint) =>
        footprint.provenance !== "context" &&
        footprint.surveyIds.some((surveyId) => usableLidarSurveysById.has(surveyId)) &&
        visibleLidarReviews[
          lidarFootprintReviewClass(footprint, usableLidarSurveysById)
        ],
    ),
    [data.lidarFootprints, usableLidarSurveysById, visibleLidarReviews],
  );

  const selected = selectedId
    ? digs.find((dig) => dig.id === selectedId) ?? null
    : null;
  const selectedLocationStatus = selected ? locationStatusFor(selected.coordinateMethod) : null;
  const selectedLidarSurveys = filteredLidarSurveys.filter((survey) =>
    selectedLidarSurveyIds.includes(survey.id),
  );
  const selectedLidarFootprints = filteredLidarFootprints.filter((footprint) =>
    selectedLidarFootprintIds.includes(footprint.id),
  );
  const selectedLidarStudies = groupLidarStudies(selectedLidarSurveys);
  const selectedAncientFeature = selectedAncientFeatureId
    ? data.ancientFeatureCells.find((cell) => cell.id === selectedAncientFeatureId) ?? null
    : null;
  const selectedAncientFeatureStudies = selectedAncientFeature
    ? groupLidarStudies(
        data.lidarSurveys.filter(
          (survey) =>
            survey.paperId === selectedAncientFeature.sourceId &&
            surveyOverlapsFeatureCell(survey, selectedAncientFeature),
        ),
      )
    : [];
  const selectedAncientFeatureSurveyIds = new Set(
    selectedAncientFeatureStudies.flatMap((study) => study.surveys.map((survey) => survey.id)),
  );
  const selectedAncientFeatureLinks = selectedAncientFeature
    ? dedupeResearchLinks([
        {
          href:
            selectedAncientFeature.sourceUrl ??
            `/sources/papers/${encodeURIComponent(selectedAncientFeature.sourceId)}`,
          label: selectedAncientFeature.sourceLabel,
          external: Boolean(selectedAncientFeature.sourceUrl),
        },
        ...selectedAncientFeatureStudies.flatMap((study) =>
          study.surveys.map((survey) => ({
            href: survey.sourceUrl ?? `/sources/papers/${encodeURIComponent(study.paperId)}`,
            label: survey.sourceUrl
              ? survey.sourceLabel
              : `Atlas paper record: ${survey.sourceLabel}`,
            external: Boolean(survey.sourceUrl),
          })),
        ),
        ...data.lidarFootprints
          .filter((footprint) =>
            footprint.surveyIds.some((surveyId) =>
              selectedAncientFeatureSurveyIds.has(surveyId),
            ),
          )
          .flatMap((footprint) =>
            footprint.sourceUrl
              ? [{ href: footprint.sourceUrl, label: footprint.sourceLabel, external: true }]
              : [],
          ),
      ])
    : [];
  useEffect(() => {
    function restoreSelectionFromUrl() {
      const siteId = siteIdFromUrl(digs);
      setSelectedId(siteId);
      if (siteId) {
        setSelectedLidarSurveyIds([]);
        setSelectedLidarFootprintIds([]);
        setSelectedAncientFeatureId(null);
      }
    }

    restoreSelectionFromUrl();
    window.addEventListener("popstate", restoreSelectionFromUrl);

    return () => window.removeEventListener("popstate", restoreSelectionFromUrl);
  }, []);

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
      updateSiteInUrl(null, "replace");
    }
  }, [selected, selectedId]);

  function selectDig(dig: AtlasPlace) {
    setFocusBounds(null);
    setSelectedLidarSurveyIds([]);
    setSelectedLidarFootprintIds([]);
    setSelectedAncientFeatureId(null);
    setSelectedId(dig.id);
    if (siteIdFromUrl(digs) !== dig.id) updateSiteInUrl(dig.id);
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectLidarSurveys(
    surveys: AtlasLidarSurvey[],
    footprints: AtlasLidarFootprint[],
  ) {
    setFocusBounds(null);
    setSelectedId(null);
    setSelectedAncientFeatureId(null);
    setSelectedLidarSurveyIds(surveys.map((survey) => survey.id));
    setSelectedLidarFootprintIds(footprints.map((footprint) => footprint.id));
    if (siteIdFromUrl(digs)) updateSiteInUrl(null);
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectAncientFeature(cell: AtlasAncientFeatureCell) {
    setFocusBounds(null);
    setSelectedId(null);
    setSelectedLidarSurveyIds([]);
    setSelectedLidarFootprintIds([]);
    setSelectedAncientFeatureId(cell.id);
    if (siteIdFromUrl(digs)) updateSiteInUrl(null);
    panelRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleAncientFeatures() {
    if (showAncientFeatures) setSelectedAncientFeatureId(null);
    setShowAncientFeatures(!showAncientFeatures);
  }

  function toggleLidarReview(review: AtlasLidarReviewClass) {
    setVisibleLidarReviews((current) => ({
      ...current,
      [review]: !current[review],
    }));
    setSelectedLidarSurveyIds([]);
    setSelectedLidarFootprintIds([]);
  }

  function selectSearchResult(result: AtlasSearchResult) {
    const target = result.target;
    if (target.kind === "knowledge-record") {
      router.push(target.href);
      return;
    }

    if (target.kind === "ancient-feature") {
      const cell = data.ancientFeatureCells.find((candidate) => candidate.id === target.cellId);
      if (!cell) return;
      setShowAncientFeatures(true);
      selectAncientFeature(cell);
      setFocusBounds(cell.bounds);
      return;
    }

    const surveyIds = new Set(target.surveyIds);
    const surveys = data.lidarSurveys.filter((survey) => surveyIds.has(survey.id));
    const footprints = data.lidarFootprints.filter(
      (footprint) =>
        footprint.provenance !== "context" &&
        footprint.surveyIds.some((surveyId) => surveyIds.has(surveyId)),
    );
    if (!surveys.length || !footprints.length) return;
    setVisibleLidarReviews((current) => {
      const next = { ...current };
      surveys.forEach((survey) => {
        next[lidarReviewClassForStatus(survey.archaeologyReviewStatus)] = true;
      });
      return next;
    });
    selectLidarSurveys(surveys, footprints);
    setFocusBounds(boundsForFootprints(footprints));
  }

  return (
    <main className="atlas-shell">
      <header className="masthead">
        <h1>Archaeology of Amazonia</h1>
        <nav className="masthead-nav" aria-label="Primary navigation">
          <span aria-current="page">Atlas</span>
          <Link href="/sources/places">Wiki</Link>
          <Link href="/about">About</Link>
        </nav>
      </header>

      <section className="atlas-workspace" aria-label="Amazonian archaeology atlas">
        <div className="map-column">
          <div className="map-toolbar">
              <div className="location-filters" aria-label="Map visibility and archaeological review controls">
                <button
                  className="location-filter layer-filter"
                  type="button"
                  aria-pressed={showAncientFeatures}
                  aria-label={`Earthworks layer: ${data.ancientFeatureCells.length} source-fitted evidence cells`}
                  onClick={toggleAncientFeatures}
                  title="Toggle source-fitted cells where research documents Amazonian earthworks"
                >
                  <span className="layer-symbol earthworks-symbol" aria-hidden="true" />
                  <span>Earthworks</span>
                  <span className="filter-count">{data.ancientFeatureCells.length}</span>
                </button>
                {lidarReviewClasses.map((review) => (
                  <button
                    className={`location-filter layer-filter review-layer-filter review-${review.id}`}
                    type="button"
                    aria-pressed={visibleLidarReviews[review.id]}
                    aria-label={`${review.label}, ${review.detail}: ${lidarFootprintCountsByReview[review.id]} LiDAR acquisition footprints`}
                    onClick={() => toggleLidarReview(review.id)}
                    title={review.title}
                    key={review.id}
                  >
                    <span className="layer-symbol lidar-review-symbol" aria-hidden="true" />
                    <span className="review-button-label">
                      <strong>{review.label}</strong>
                      <small>{review.detail}</small>
                    </span>
                    <span className="filter-count">
                      {lidarFootprintCountsByReview[review.id].toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            <p className="visible-count" aria-live="polite">
              {filteredLidarFootprints.length.toLocaleString()} footprints · {filteredLidarSurveys.length} studies
            </p>
          </div>

          <div className="map-frame">
            <ExcavationMap
              digs={noMapSites}
              ancientFeatureCells={data.ancientFeatureCells}
              lidarSurveys={filteredLidarSurveys}
              lidarFootprints={filteredLidarFootprints}
              showAncientFeatures={showAncientFeatures}
              showLidar={filteredLidarFootprints.length > 0}
              selected={null}
              selectedLidarFootprintIds={selectedLidarFootprintIds}
              selectedAncientFeatureId={selectedAncientFeatureId}
              focusBounds={focusBounds}
              onSelect={selectDig}
              onSelectLidar={selectLidarSurveys}
              onSelectAncientFeature={selectAncientFeature}
            />
          </div>

        </div>

        <aside
          ref={panelRef}
          className="research-panel"
          aria-label="Selected map details"
        >
          <AtlasSearchBox onSelect={selectSearchResult} />

          {selected && selectedLocationStatus ? (
            <article className="site-record" key={selected.id}>
              <p className="record-kind">{selected.kind}</p>
              <h2>{selected.name}</h2>
              <div className={`location-badge location-${selectedLocationStatus}`}>
                <span className="location-symbol" aria-hidden="true" />
                {locationStatusMeta[selectedLocationStatus].label}
              </div>

              <div className="location-context">
                <p
                  className="location-method"
                  title={coordinateMethodMeta[selected.coordinateMethod].description}
                >
                  {coordinateMethodMeta[selected.coordinateMethod].label}
                </p>
                <p className="location-basis">{selected.basis}</p>
                <p className="location-uncertainty">
                  Display uncertainty: approximately {selected.uncertaintyKm} km radius
                </p>
                {selected.note ? <p className="location-note">{selected.note}</p> : null}
                <a
                  className="google-maps-link"
                  href={googleMapsUrlFor(selected)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open the generalized ${selected.name} research area in Google Maps (opens in a new tab)`}
                >
                  Open generalized area in Google Maps <span aria-hidden="true">↗</span>
                </a>
              </div>

              <dl className="record-classification">
                <div>
                  <dt>Chronology</dt>
                  <dd>
                    {selected.periods.length ? (
                      selected.periods.map((period) => (
                        <span className="classification-tag" key={period}>{period}</span>
                      ))
                    ) : (
                      <span className="classification-empty">Not securely assigned</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Tradition / model</dt>
                  <dd>
                    {selected.cultures.length ? (
                      selected.cultures.map((culture) => (
                        <span className="classification-tag" key={culture}>{culture}</span>
                      ))
                    ) : (
                      <span className="classification-empty">Not securely assigned</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>What was found here</dt>
                  <dd>
                    {selected.finds.length ? (
                      selected.finds.map((find) => findLabels[find]).join(", ")
                    ) : (
                      <span className="classification-empty">Not described</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Place type</dt>
                  <dd>
                    {selected.techniques.length ? (
                      selected.techniques
                        .map((technique) => techniqueLabels[technique])
                        .join(", ")
                    ) : (
                      <span className="classification-empty">Not described</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Latest study</dt>
                  <dd>
                    {selected.latestStudyLabel ? (
                      selected.latestStudyLabel
                    ) : (
                      selected.lastFieldworkLabel ??
                      "Not documented in the cited papers"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Last field investigation</dt>
                  <dd>
                    {selected.lastFieldworkLabel ??
                      "Not documented in the cited papers"}
                  </dd>
                </div>
              </dl>

              <div className="place-document">
                <VaultMarkdown>{selected.body}</VaultMarkdown>
              </div>
              <p className="place-record-link">
                <Link href={`/sources/places/${encodeURIComponent(selected.id)}`}>Open wiki record →</Link>
              </p>
            </article>
          ) : selectedAncientFeature ? (
            <article className="site-record ancient-feature-record" key={selectedAncientFeature.id}>
              <h2>{selectedAncientFeature.region}</h2>
              <dl className="research-data">
                <div>
                  <dt>Features</dt>
                  <dd>{selectedAncientFeature.featureTypes.join(", ")}</dd>
                </div>
                <div>
                  <dt>Identified by</dt>
                  <dd>{selectedAncientFeature.discoveryMethods.join(", ")}</dd>
                </div>
                {selectedAncientFeatureStudies.length ? (
                  <div>
                    <dt>Associated research</dt>
                    <dd>
                      {selectedAncientFeatureStudies
                        .map((study) => {
                          const label = study.surveys[0].sourceLabel;
                          const count = study.surveys.length;
                          return `${label} · ${count} overlapping mapped ${count === 1 ? "zone" : "zones"}`;
                        })
                        .join("; ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="research-description">{selectedAncientFeature.contextNote}</p>
              <ResearchLinks links={selectedAncientFeatureLinks} />
            </article>
          ) : selectedLidarStudies.length ? (
            <article className="site-record lidar-research-record" key={selectedLidarSurveyIds.join(":")}>
              <h2>
                {selectedLidarStudies.length === 1
                  ? selectedLidarStudies[0].surveys.map((survey) => survey.name).join(" + ")
                  : `${selectedLidarStudies.length} LiDAR studies overlap here`}
              </h2>
              <div className="lidar-research-list">
                {selectedLidarStudies.map((study) => {
                  const countries = [...new Set(study.surveys.map((survey) => survey.country))];
                  const regions = [...new Set(study.surveys.map((survey) => survey.region))];
                  const purposes = [...new Set(study.surveys.map((survey) =>
                    survey.acquisitionPurpose === "archaeology"
                      ? "Archaeology"
                      : "Other purpose, later reused",
                  ))];
                  const reviewStatuses = [...new Set(study.surveys.map((survey) =>
                    lidarReviewLabels[survey.archaeologyReviewStatus],
                  ))];
                  const reviewScopes = [...new Set(study.surveys.map((survey) =>
                    survey.archaeologyReviewScope,
                  ))];
                  const reviewShares = [...new Set(study.surveys
                    .map((survey) => survey.archaeologyReviewFraction)
                    .filter((fraction): fraction is number => fraction !== null)
                    .map((fraction) => `${Math.round(fraction * 100)}%`))];
                  const terrainGrids = [...new Set(study.surveys.map((survey) =>
                    survey.terrainResolutionM === null
                      ? "Unknown"
                      : `${survey.terrainResolutionM.toFixed(2)} m/pixel`,
                  ))];
                  const pointDensities = [...new Set(study.surveys.map((survey) =>
                    survey.pointDensityM2 === null
                      ? "Not reported"
                      : `${survey.pointDensityM2.toLocaleString()} points/m²`,
                  ))];
                  const representative = study.surveys[0];
                  const studySurveyIds = new Set(study.surveys.map((survey) => survey.id));
                  const studyFootprints = selectedLidarFootprints.filter((footprint) =>
                    footprint.surveyIds.some((surveyId) => studySurveyIds.has(surveyId)),
                  );
                  const provenanceLabels = [...new Set(
                    studyFootprints.map((footprint) => lidarDisplayProvenance(footprint.provenance)),
                  )].map((provenance) => lidarProvenanceLabels[provenance]);
                  const footprintSources = [...new Map(
                    studyFootprints.map((footprint) => [
                      `${footprint.sourceLabel}:${footprint.sourceUrl ?? ""}`,
                      footprint,
                    ]),
                  ).values()];
                  const relevantLinks = [...new Map([
                    ...study.surveys.map((survey) => [
                      survey.sourceUrl ?? `/sources/papers/${encodeURIComponent(study.paperId)}`,
                      {
                        href: survey.sourceUrl ?? `/sources/papers/${encodeURIComponent(study.paperId)}`,
                        label: survey.sourceLabel,
                        external: Boolean(survey.sourceUrl),
                      },
                    ] as const),
                    ...study.surveys
                      .filter((survey) => survey.archaeologyReviewUrl)
                      .map((survey) => [
                        survey.archaeologyReviewUrl as string,
                        {
                          href: survey.archaeologyReviewUrl as string,
                          label: "Archaeological review evidence",
                          external: true,
                        },
                      ] as const),
                    ...footprintSources
                      .filter((footprint) => footprint.sourceUrl)
                      .map((footprint) => [
                        footprint.sourceUrl as string,
                        {
                          href: footprint.sourceUrl as string,
                          label: footprint.sourceLabel,
                          external: true,
                        },
                      ] as const),
                  ]).values()];
                  return (
                    <section className="lidar-research-study" key={study.paperId}>
                      {selectedLidarStudies.length > 1 ? (
                        <h3>{study.surveys.map((survey) => survey.name).join(" + ")}</h3>
                      ) : null}
                      <dl className="research-data">
                        <div><dt>Year</dt><dd>{study.year}</dd></div>
                        <div><dt>Location</dt><dd>{regions.join("; ")} · {countries.join(" + ")}</dd></div>
                        <div><dt>Review status</dt><dd>{reviewStatuses.join(" + ")}</dd></div>
                        {reviewShares.length ? (
                          <div><dt>Reviewed share</dt><dd>{reviewShares.join(" + ")}</dd></div>
                        ) : null}
                        <div><dt>Review scope</dt><dd>{reviewScopes.join(" ")}</dd></div>
                        <div><dt>Purpose</dt><dd>{purposes.join(" + ")}</dd></div>
                        <div><dt>Terrain grid</dt><dd>{terrainGrids.join(" + ")}</dd></div>
                        <div><dt>Point density</dt><dd>{pointDensities.join(" + ")}</dd></div>
                        <div>
                          <dt>Coverage</dt>
                          <dd>
                            {study.surveys.length.toLocaleString()} {study.surveys.length === 1 ? "mapped zone" : "mapped zones"}
                            {studyFootprints.length ? ` · ${studyFootprints.length.toLocaleString()} selected ${studyFootprints.length === 1 ? "footprint" : "footprints"}` : ""}
                          </dd>
                        </div>
                        {provenanceLabels.length ? (
                          <div><dt>Footprint source</dt><dd>{provenanceLabels.join(" + ")}</dd></div>
                        ) : null}
                      </dl>
                      <p className="research-description">{representative.description}</p>
                      <ResearchLinks links={relevantLinks} />
                    </section>
                  );
                })}
              </div>
            </article>
          ) : (
            <div className="no-site-selected">
              <span aria-hidden="true">◎</span>
              <p>Select a LiDAR zone or red earthwork cell to read its associated research.</p>
            </div>
          )}

        </aside>
      </section>
    </main>
  );
}
