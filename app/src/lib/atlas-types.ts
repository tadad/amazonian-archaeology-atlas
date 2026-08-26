export type CoordinateMethod = "reconstructed";
export type LocationStatus = "approximate";

export const locationStatusOrder: readonly LocationStatus[] = ["approximate"];

export const locationStatusMeta: Record<
  LocationStatus,
  { label: string; description: string }
> = {
  approximate: {
    label: "Generalized",
    description:
      "A coarse public research placement, never an archaeological-site coordinate or access point.",
  },
};

export const coordinateMethodMeta: Record<
  CoordinateMethod,
  { label: string; description: string }
> = {
  reconstructed: {
    label: "Generalized research placement",
    description:
      "The marker is intentionally generalized from source geography to protect archaeological locations.",
  },
};

export function locationStatusFor(_method: CoordinateMethod): LocationStatus {
  return "approximate";
}

export type AtlasPlace = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  coordinateMethod: CoordinateMethod;
  kind: string;
  basis: string;
  note: string;
  uncertaintyKm: number;
  periods: string[];
  cultures: string[];
  finds: string[];
  techniques: string[];
  latestStudyYear: number | null;
  latestStudyLabel: string | null;
  lastFieldworkYear: number | null;
  lastFieldworkLabel: string | null;
  body: string;
};

export type TaxonomyEntry = {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type AtlasAncientFeatureCell = {
  id: string;
  bounds: [[number, number], [number, number]];
  region: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string | null;
  featureTypes: string[];
  discoveryMethods: string[];
  contextNote: string;
};

export type AtlasLidarSurveyKind =
  | "prototype"
  | "survey"
  | "method"
  | "discovery"
  | "regional-survey"
  | "screened-legacy"
  | "unscreened-archive"
  | "site-documentation"
  | "preliminary-program";

export type AtlasLidarAcquisitionPurpose = "archaeology" | "other";

export type AtlasLidarArchaeologyReviewStatus =
  | "systematic"
  | "partial"
  | "ongoing"
  | "none-found";

export type AtlasLidarReviewClass = "reviewed" | "partial" | "unreviewed";

export function lidarReviewClassForStatus(
  status: AtlasLidarArchaeologyReviewStatus,
): AtlasLidarReviewClass {
  if (status === "systematic") return "reviewed";
  if (status === "none-found") return "unreviewed";
  return "partial";
}

export function lidarReviewClassForSurveys(
  surveys: readonly Pick<AtlasLidarSurvey, "archaeologyReviewStatus">[],
): AtlasLidarReviewClass {
  const classes = surveys.map((survey) =>
    lidarReviewClassForStatus(survey.archaeologyReviewStatus)
  );
  if (classes.includes("reviewed")) return "reviewed";
  if (classes.includes("partial")) return "partial";
  return "unreviewed";
}

export type AtlasLidarCoverageMode =
  | "continuous"
  | "corridor"
  | "distributed"
  | "context";

export type AtlasLidarGeometryProvenance =
  | "released"
  | "published-map"
  | "reconstructed"
  | "context";

export type AtlasLidarFootprint = {
  id: string;
  surveyIds: string[];
  positions: [number, number][];
  provenance: AtlasLidarGeometryProvenance;
  sourceLabel: string;
  sourceUrl: string | null;
  note: string;
};

export type AtlasLidarSurvey = {
  id: string;
  name: string;
  year: number;
  paperId: string;
  kind: AtlasLidarSurveyKind;
  coverageMode: AtlasLidarCoverageMode;
  acquisitionPurpose: AtlasLidarAcquisitionPurpose;
  archaeologyReviewStatus: AtlasLidarArchaeologyReviewStatus;
  archaeologyReviewFraction: number | null;
  archaeologyReviewScope: string;
  archaeologyReviewUrl: string | null;
  archaeologyUsable: boolean;
  country: string;
  region: string;
  sourceLabel: string;
  sourceUrl: string | null;
  footprintNote: string;
  terrainResolutionM: number | null;
  pointDensityM2: number | null;
  resolutionBasis: string;
  positions: [number, number][];
  metrics: string[];
  description: string;
};

export type AtlasData = {
  places: AtlasPlace[];
  periods: TaxonomyEntry[];
  cultures: TaxonomyEntry[];
  finds: readonly TaxonomyEntry[];
  techniques: readonly TaxonomyEntry[];
  ancientFeatureCells: readonly AtlasAncientFeatureCell[];
  lidarSurveys: readonly AtlasLidarSurvey[];
  lidarFootprints: readonly AtlasLidarFootprint[];
  lidarCoordinatePolicy: string;
  lidarFootprintPolicy: string;
};

export type AtlasSearchTarget =
  | { kind: "lidar"; surveyIds: string[] }
  | { kind: "ancient-feature"; cellId: string }
  | { kind: "knowledge-record"; href: string };

export type AtlasSearchResult = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  target: AtlasSearchTarget;
};
