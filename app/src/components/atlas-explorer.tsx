"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AtlasSearchBox } from "@/components/atlas-search-box";
import { LanguageToggle } from "@/components/language-toggle";
import { OriginalLanguageNotice } from "@/components/original-language-notice";
import { VaultMarkdown } from "@/components/vault-markdown";
import en from "@/i18n/dictionaries/en.json";
import {
  formatMessage,
  localizedControlledText,
  localizedGeneratedLabel,
  type Dictionary,
} from "@/i18n";
import { localePath, localeTag, type Locale } from "@/i18n/config";
import {
  type AtlasAncientFeatureCell,
  type AtlasData,
  type AtlasLidarFootprint,
  type AtlasLidarGeometryProvenance,
  type AtlasLidarReviewClass,
  type AtlasLidarSurvey,
  type AtlasMarkerRole,
  type AtlasPlace,
  type AtlasSearchResult,
  type LocationStatus,
  atlasMarkerRoleOrder,
  lidarReviewClassForStatus,
  lidarReviewClassForSurveys,
  locationStatusOrder,
  locationStatusFor,
} from "@/lib/atlas-types";

const AtlasLoadingContext = createContext(en.atlas);

function MapLoading() {
  const messages = useContext(AtlasLoadingContext);
  return (
    <div className="map-loading" role="status">
      <span className="loading-mark" aria-hidden="true" />
      {messages.loadingMap}
    </div>
  );
}

const ExcavationMap = dynamic(() => import("./excavation-map"), {
  ssr: false,
  loading: MapLoading,
});

const siteQueryParam = "place";
const noMapSites: AtlasPlace[] = [];

type LidarReviewOption = {
  id: AtlasLidarReviewClass;
  label: string;
  detail: string;
  title: string;
};

function lidarFootprintReviewClass(
  footprint: AtlasLidarFootprint,
  surveysById: ReadonlyMap<string, AtlasLidarSurvey>,
): AtlasLidarReviewClass {
  const surveys = footprint.surveyIds
    .map((surveyId) => surveysById.get(surveyId))
    .filter((survey): survey is AtlasLidarSurvey => Boolean(survey));
  return lidarReviewClassForSurveys(surveys);
}

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

function ResearchLinks({
  links,
  locale,
  heading,
}: {
  links: readonly ResearchLink[];
  locale: Locale;
  heading: string;
}) {
  if (!links.length) return null;

  return (
    <div className="research-links">
      <h3>{heading}</h3>
      <ul>
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a href={link.href} target="_blank" rel="noreferrer">{link.label} ↗</a>
            ) : (
              <Link href={localePath(locale, link.href)}>{link.label} →</Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

type LidarDisplayProvenance = "released" | "source-derived" | "context";

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

function lidarScanRecordId(surveyId: string): string {
  return surveyId.startsWith("2026-acre-amazonas-als-line-")
    ? "2026-acre-amazonas-als-campaign"
    : surveyId;
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

type AtlasExplorerProps = {
  data: AtlasData;
  locale: Locale;
  messages: Dictionary;
};

export function AtlasExplorer({ data, locale, messages }: AtlasExplorerProps) {
  const router = useRouter();
  const ui = messages.atlas;
  const isRouteAtlas = data.routePositions.length > 0;
  const lidarReviewClasses = (["reviewed", "partial", "unreviewed"] as const).map(
    (id): LidarReviewOption => ({ id, ...messages.atlas.reviewClasses[id] }),
  );
  const digs = data.places;
  const findLabels = Object.fromEntries(
    data.finds.map((find) => [
      find.id,
      (messages.finds as Record<string, string>)[find.id] ?? find.name,
    ]),
  );
  const techniqueLabels = Object.fromEntries(
    data.techniques.map((technique) => [
      technique.id,
      (messages.siteKinds as Record<string, string>)[technique.id] ?? technique.name,
    ]),
  );
  const periodLabels = Object.fromEntries(
    data.periods.map((period) => [
      period.name,
      (messages.periods as Record<string, string>)[period.id] ?? period.name,
    ]),
  );
  const cultureLabels = Object.fromEntries(
    data.cultures.map((culture) => [
      culture.name,
      (messages.cultures as Record<string, string>)[culture.id] ?? culture.name,
    ]),
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
  const [activeLocationStatus, setActiveLocationStatus] = useState<Record<LocationStatus, boolean>>({
    located: true,
    approximate: true,
  });
  const [activeMarkerRoles, setActiveMarkerRoles] = useState<Record<AtlasMarkerRole, boolean>>({
    research: true,
    expedition: true,
  });

  const visibleDigs = useMemo(
    () => digs.filter(
      (dig) =>
        activeLocationStatus[locationStatusFor(dig.coordinateMethod)] &&
        activeMarkerRoles[dig.markerRole],
    ),
    [activeLocationStatus, activeMarkerRoles, digs],
  );

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
    ? visibleDigs.find((dig) => dig.id === selectedId) ?? null
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
              : `${messages.papers.paper}: ${survey.sourceLabel}`,
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

  function toggleLocationStatus(status: LocationStatus) {
    setActiveLocationStatus((current) => {
      const enabledCount = Object.values(current).filter(Boolean).length;
      if (current[status] && enabledCount === 1) return current;
      return { ...current, [status]: !current[status] };
    });
  }

  function toggleMarkerRole(role: AtlasMarkerRole) {
    setActiveMarkerRoles((current) => {
      const enabledCount = Object.values(current).filter(Boolean).length;
      if (current[role] && enabledCount === 1) return current;
      return { ...current, [role]: !current[role] };
    });
  }

  function selectSearchResult(result: AtlasSearchResult) {
    const target = result.target;
    if (target.kind === "knowledge-record") {
      router.push(localePath(locale, target.href));
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
        <h1>{isRouteAtlas ? messages.orellana.siteName : messages.nav.siteName}</h1>
        <nav className="masthead-nav" aria-label={messages.nav.primaryLabel}>
          {isRouteAtlas ? (
            <Link href={localePath(locale, "/")}>{messages.nav.atlas}</Link>
          ) : (
            <span aria-current="page">{messages.nav.atlas}</span>
          )}
          {isRouteAtlas ? (
            <span aria-current="page">{messages.nav.orellana}</span>
          ) : (
            <Link href={localePath(locale, "/orellana")}>{messages.nav.orellana}</Link>
          )}
          <Link href={localePath(locale, "/sources/lidar-scans")}>{messages.nav.wiki}</Link>
          <Link href={localePath(locale, "/about")}>{messages.nav.about}</Link>
          <LanguageToggle locale={locale} messages={messages.language} />
        </nav>
      </header>

      <section className="atlas-workspace" aria-label={isRouteAtlas ? messages.orellana.workspaceLabel : ui.workspaceLabel}>
        <div className="map-column">
          <div className="map-toolbar">
            {isRouteAtlas ? (
              <div className="location-filters" aria-label={messages.orellana.mapControlsLabel}>
                {locationStatusOrder.map((status) => {
                  const count = digs.filter(
                    (dig) => locationStatusFor(dig.coordinateMethod) === status,
                  ).length;
                  const meta = messages.locationStatuses[status];
                  return (
                    <button
                      className={`location-filter location-${status}`}
                      type="button"
                      key={status}
                      aria-pressed={activeLocationStatus[status]}
                      aria-label={formatMessage(messages.orellana.locationFilterLabel, {
                        label: meta.label,
                        count,
                      })}
                      onClick={() => toggleLocationStatus(status)}
                      title={meta.description}
                    >
                      <span className="location-symbol" aria-hidden="true" />
                      <span>{meta.label}</span>
                      <span className="filter-count">{count}</span>
                    </button>
                  );
                })}
                {atlasMarkerRoleOrder.map((role) => {
                  const count = digs.filter((dig) => dig.markerRole === role).length;
                  const meta = messages.orellana.markerRoles[role];
                  return (
                    <button
                      className={`location-filter marker-role-filter marker-${role}`}
                      type="button"
                      key={role}
                      aria-pressed={activeMarkerRoles[role]}
                      aria-label={formatMessage(messages.orellana.markerRoleFilterLabel, {
                        label: meta.label,
                        count,
                      })}
                      onClick={() => toggleMarkerRole(role)}
                      title={meta.description}
                    >
                      <span className="marker-role-symbol" aria-hidden="true" />
                      <span>{meta.label}</span>
                      <span className="filter-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="location-filters" aria-label={ui.mapControlsLabel}>
                <button
                  className="location-filter layer-filter"
                  type="button"
                  aria-pressed={showAncientFeatures}
                  aria-label={formatMessage(ui.earthworksLayer, { count: data.ancientFeatureCells.length })}
                  onClick={toggleAncientFeatures}
                  title={ui.earthworksTitle}
                >
                  <span className="layer-symbol earthworks-symbol" aria-hidden="true" />
                  <span>{ui.earthworks}</span>
                  <span className="filter-count">{data.ancientFeatureCells.length}</span>
                </button>
                {lidarReviewClasses.map((review) => (
                  <button
                    className={`location-filter layer-filter review-layer-filter review-${review.id}`}
                    type="button"
                    aria-pressed={visibleLidarReviews[review.id]}
                    aria-label={formatMessage(ui.reviewFootprintsLabel, {
                      label: review.label,
                      detail: review.detail,
                      count: lidarFootprintCountsByReview[review.id],
                    })}
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
                      {lidarFootprintCountsByReview[review.id].toLocaleString(localeTag(locale))}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="visible-count" aria-live="polite">
              {isRouteAtlas
                ? formatMessage(messages.orellana.visibleSummary, {
                    visible: visibleDigs.length.toLocaleString(localeTag(locale)),
                  })
                : formatMessage(ui.visibleSummary, {
                    footprints: filteredLidarFootprints.length.toLocaleString(localeTag(locale)),
                    studies: filteredLidarSurveys.length.toLocaleString(localeTag(locale)),
                  })}
            </p>
          </div>

          <div className="map-frame">
            <AtlasLoadingContext.Provider value={ui}>
              <ExcavationMap
                digs={isRouteAtlas ? visibleDigs : noMapSites}
                ancientFeatureCells={data.ancientFeatureCells}
                lidarSurveys={filteredLidarSurveys}
                lidarFootprints={filteredLidarFootprints}
                showAncientFeatures={showAncientFeatures}
                showLidar={filteredLidarFootprints.length > 0}
                selected={isRouteAtlas ? selected : null}
                selectedLidarFootprintIds={selectedLidarFootprintIds}
                selectedAncientFeatureId={selectedAncientFeatureId}
                focusBounds={focusBounds}
                onSelect={selectDig}
                onSelectLidar={selectLidarSurveys}
                onSelectAncientFeature={selectAncientFeature}
                messages={messages}
                routePositions={data.routePositions}
              />
            </AtlasLoadingContext.Provider>
          </div>

        </div>

        <aside
          ref={panelRef}
          className="research-panel"
          aria-label={ui.selectedDetails}
        >
          {isRouteAtlas ? null : (
            <AtlasSearchBox onSelect={selectSearchResult} messages={messages} />
          )}

          {selected && selectedLocationStatus ? (
            <article className="site-record" key={selected.id}>
              <p className="record-kind">
                {techniqueLabels[selected.techniques[0]] ?? selected.kind}
              </p>
              <h2>{selected.name}</h2>
              <div className={`location-badge location-${selectedLocationStatus}`}>
                <span className="location-symbol" aria-hidden="true" />
                {messages.locationStatuses[selectedLocationStatus].label}
              </div>
              <OriginalLanguageNotice locale={locale}>
                {messages.originalLanguage.research}
              </OriginalLanguageNotice>

              <div className="location-context">
                <p
                  className="location-method"
                  title={messages.coordinateMethods[selected.coordinateMethod].description}
                >
                  {messages.coordinateMethods[selected.coordinateMethod].label}
                </p>
                <p className="location-basis">{selected.basis}</p>
                <p className="location-uncertainty">
                  {formatMessage(ui.displayUncertainty, { distance: selected.uncertaintyKm })}
                </p>
                {selected.note ? <p className="location-note">{selected.note}</p> : null}
                <a
                  className="google-maps-link"
                  href={googleMapsUrlFor(selected)}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={formatMessage(ui.openGeneralizedAreaLabel, { name: selected.name })}
                >
                  {ui.openGeneralizedArea} <span aria-hidden="true">↗</span>
                </a>
              </div>

              <dl className="record-classification">
                <div>
                  <dt>{isRouteAtlas ? messages.orellana.chronology : ui.chronology}</dt>
                  <dd>
                    {selected.periods.length ? (
                      selected.periods.map((period) => (
                        <span className="classification-tag" key={period}>{periodLabels[period] ?? period}</span>
                      ))
                    ) : (
                      <span className="classification-empty">{ui.notSecurelyAssigned}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{isRouteAtlas ? messages.orellana.historicalAssociation : ui.traditionModel}</dt>
                  <dd>
                    {selected.cultures.length ? (
                      selected.cultures.map((culture) => (
                        <span className="classification-tag" key={culture}>{cultureLabels[culture] ?? culture}</span>
                      ))
                    ) : (
                      <span className="classification-empty">{ui.notSecurelyAssigned}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{isRouteAtlas ? messages.orellana.reportedInvestigated : ui.whatWasFound}</dt>
                  <dd>
                    {selected.finds.length ? (
                      selected.finds.map((find) => findLabels[find]).join(", ")
                    ) : (
                      <span className="classification-empty">{ui.notDescribed}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{isRouteAtlas ? messages.orellana.pointType : ui.placeType}</dt>
                  <dd>
                    {selected.techniques.length ? (
                      selected.techniques
                        .map((technique) => techniqueLabels[technique])
                        .join(", ")
                    ) : (
                      <span className="classification-empty">{ui.notDescribed}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{isRouteAtlas ? messages.orellana.latestSource : ui.latestStudy}</dt>
                  <dd>
                    {selected.latestStudyLabel ? (
                      selected.latestStudyLabel
                    ) : (
                      selected.lastFieldworkLabel ??
                      ui.notDocumented
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{isRouteAtlas ? messages.orellana.fieldwork : ui.lastFieldInvestigation}</dt>
                  <dd>
                    {selected.lastFieldworkLabel ??
                      ui.notDocumented}
                  </dd>
                </div>
              </dl>

              <div className="place-document">
                <VaultMarkdown locale={locale}>{selected.body}</VaultMarkdown>
              </div>
              <p className="place-record-link">
                <Link href={localePath(locale, `/sources/${isRouteAtlas ? "route-locations" : "archaeological-sites"}/${encodeURIComponent(selected.id)}`)}>
                  {ui.openWikiRecord}
                </Link>
              </p>
            </article>
          ) : selectedAncientFeature ? (
            <article className="site-record ancient-feature-record" key={selectedAncientFeature.id}>
              <h2>{localizedGeneratedLabel(messages, selectedAncientFeature.region)}</h2>
              <OriginalLanguageNotice locale={locale}>
                {messages.originalLanguage.research}
              </OriginalLanguageNotice>
              <dl className="research-data">
                <div>
                  <dt>{ui.features}</dt>
                  <dd>{localizedControlledText(messages, selectedAncientFeature.featureTypes.join(", "))}</dd>
                </div>
                <div>
                  <dt>{ui.identifiedBy}</dt>
                  <dd>{localizedControlledText(messages, selectedAncientFeature.discoveryMethods.join(", "))}</dd>
                </div>
                {selectedAncientFeatureStudies.length ? (
                  <div>
                    <dt>{ui.associatedResearch}</dt>
                    <dd>
                      {selectedAncientFeatureStudies
                        .map((study) => {
                          const label = study.surveys[0].sourceLabel;
                          const count = study.surveys.length;
                          return `${label} · ${formatMessage(
                            count === 1 ? ui.overlappingZone : ui.overlappingZones,
                            { count },
                          )}`;
                        })
                        .join("; ")}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="research-description">{selectedAncientFeature.contextNote}</p>
              <ResearchLinks
                links={selectedAncientFeatureLinks}
                locale={locale}
                heading={ui.relevantLinks}
              />
            </article>
          ) : selectedLidarStudies.length ? (
            <article className="site-record lidar-research-record" key={selectedLidarSurveyIds.join(":")}>
              <h2>
                {selectedLidarStudies.length === 1
                  ? selectedLidarStudies[0].surveys.map((survey) => survey.name).join(" + ")
                  : formatMessage(ui.lidarStudiesOverlap, { count: selectedLidarStudies.length })}
              </h2>
              <OriginalLanguageNotice locale={locale}>
                {messages.originalLanguage.research}
              </OriginalLanguageNotice>
              <div className="lidar-research-list">
                {selectedLidarStudies.map((study) => {
                  const countries = [...new Set(study.surveys.map((survey) => survey.country))];
                  const regions = [...new Set(study.surveys.map((survey) => survey.region))];
                  const purposes = [...new Set(study.surveys.map((survey) =>
                    survey.acquisitionPurpose === "archaeology"
                      ? ui.archaeology
                      : ui.otherPurpose,
                  ))];
                  const reviewStatuses = [...new Set(study.surveys.map((survey) =>
                    messages.atlas.reviewStatuses[survey.archaeologyReviewStatus],
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
                      ? ui.unknown
                      : `${survey.terrainResolutionM.toFixed(2)} m/pixel`,
                  ))];
                  const pointDensities = [...new Set(study.surveys.map((survey) =>
                    survey.pointDensityM2 === null
                      ? ui.notReported
                      : `${survey.pointDensityM2.toLocaleString(localeTag(locale))} ${ui.pointsPerSquareMeter}`,
                  ))];
                  const representative = study.surveys[0];
                  const studySurveyIds = new Set(study.surveys.map((survey) => survey.id));
                  const studyFootprints = selectedLidarFootprints.filter((footprint) =>
                    footprint.surveyIds.some((surveyId) => studySurveyIds.has(surveyId)),
                  );
                  const provenanceLabels = [...new Set(
                    studyFootprints.map((footprint) => lidarDisplayProvenance(footprint.provenance)),
                  )].map((provenance) => messages.atlas.provenance[provenance]);
                  const footprintSources = [...new Map(
                    studyFootprints.map((footprint) => [
                      `${footprint.sourceLabel}:${footprint.sourceUrl ?? ""}`,
                      footprint,
                    ]),
                  ).values()];
                  const relevantLinks = [...new Map([
                    ...study.surveys.map((survey) => {
                      const scanId = lidarScanRecordId(survey.id);
                      return [
                        `/sources/lidar-scans/${encodeURIComponent(scanId)}`,
                        {
                          href: `/sources/lidar-scans/${encodeURIComponent(scanId)}`,
                          label: formatMessage(ui.scanRecord, {
                            name: survey.name.replace(/\s+line\s+L\d+$/i, ""),
                          }),
                          external: false,
                        },
                      ] as const;
                    }),
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
                          label: ui.reviewEvidence,
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
                        <div><dt>{ui.year}</dt><dd>{study.year}</dd></div>
                        <div><dt>{ui.location}</dt><dd>{regions.join("; ")} · {countries.join(" + ")}</dd></div>
                        <div><dt>{ui.reviewStatus}</dt><dd>{reviewStatuses.join(" + ")}</dd></div>
                        {reviewShares.length ? (
                          <div><dt>{ui.reviewedShare}</dt><dd>{reviewShares.join(" + ")}</dd></div>
                        ) : null}
                        <div><dt>{ui.reviewScope}</dt><dd>{reviewScopes.join(" ")}</dd></div>
                        <div><dt>{ui.purpose}</dt><dd>{purposes.join(" + ")}</dd></div>
                        <div><dt>{ui.terrainGrid}</dt><dd>{terrainGrids.join(" + ")}</dd></div>
                        <div><dt>{ui.pointDensity}</dt><dd>{pointDensities.join(" + ")}</dd></div>
                        <div>
                          <dt>{ui.coverage}</dt>
                          <dd>
                            {study.surveys.length.toLocaleString(localeTag(locale))}{" "}
                            {study.surveys.length === 1 ? ui.mappedZone : ui.mappedZones}
                            {studyFootprints.length
                              ? ` · ${studyFootprints.length.toLocaleString(localeTag(locale))} ${studyFootprints.length === 1 ? ui.selectedFootprint : ui.selectedFootprints}`
                              : ""}
                          </dd>
                        </div>
                        {provenanceLabels.length ? (
                          <div><dt>{ui.footprintSource}</dt><dd>{provenanceLabels.join(" + ")}</dd></div>
                        ) : null}
                      </dl>
                      <p className="research-description">{representative.description}</p>
                      <ResearchLinks links={relevantLinks} locale={locale} heading={ui.relevantLinks} />
                    </section>
                  );
                })}
              </div>
            </article>
          ) : (
            <div className="no-site-selected">
              <span aria-hidden="true">◎</span>
              <p>{isRouteAtlas ? messages.orellana.selectPrompt : ui.selectPrompt}</p>
            </div>
          )}

        </aside>
      </section>
    </main>
  );
}
