import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type {
  AtlasAncientFeatureCell,
  AtlasData,
  AtlasLidarFootprint,
  AtlasLidarSurvey,
  AtlasPlace,
  TaxonomyEntry,
} from "@/lib/atlas-types";
import { vaultRouteSlug } from "@/lib/vault-catalogue";

let atlasCache: AtlasData | undefined;
const collator = new Intl.Collator("pt", { sensitivity: "base", numeric: true });

function vaultRoot(): string {
  const candidates = [path.resolve(process.cwd(), "..", "vault"), path.resolve(process.cwd(), "vault")];
  const match = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "Archaeological Sites")),
  );
  if (!match) throw new Error(`Could not locate the Acre vault from ${process.cwd()}`);
  return match;
}

function markdownFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(directory, entry.name));
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function optionalYear(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function wikiLabel(value: string): string {
  const match = value.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
  return match ? match[2] || path.basename(match[1].split("#", 1)[0]) : value;
}

function stripLeadingTitle(markdown: string): string {
  return markdown.replace(/^\s*# [^\n]+\n+/, "").trimStart();
}

function webMarkdown(markdown: string): string {
  return markdown.replace(
    /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, label: string | undefined) => {
      const [filename, heading] = target.split("#", 2);
      const slash = filename.indexOf("/");
      if (slash < 1) return label || path.basename(filename);
      const collection = vaultRouteSlug(filename.slice(0, slash));
      const slug = filename.slice(slash + 1);
      const anchor = heading?.match(/^Page (\d+)$/)?.[1];
      return `[${label || path.basename(filename)}](/sources/${collection}/${encodeURIComponent(slug)}${anchor ? `#page-${anchor}` : ""})`;
    },
  );
}

function taxonomy(directory: string, type: "period" | "culture"): TaxonomyEntry[] {
  return markdownFiles(directory)
    .map((filename) => {
      const parsed = matter(fs.readFileSync(filename, "utf8"));
      if (parsed.data.type !== type) throw new Error(`Expected ${type} record in ${filename}`);
      return {
        id: String(parsed.data[`${type}_id`] || path.basename(filename, ".md")),
        name: String(parsed.data.name || path.basename(filename, ".md")),
        description: stripLeadingTitle(parsed.content).trim(),
        sortOrder: Number(parsed.data.sort_order || 0),
      };
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || collator.compare(left.name, right.name));
}

function humanize(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/\b\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function placeRecord(filename: string): AtlasPlace | null {
  const parsed = matter(fs.readFileSync(filename, "utf8"));
  if (parsed.data.type !== "archaeological-site") {
    throw new Error(`Expected archaeological-site record in ${filename}`);
  }

  const id = String(parsed.data.site_id || path.basename(filename, ".md"));
  const coordinatePrecision = String(parsed.data.coordinate_precision || "withheld");
  const locationVisibility = String(parsed.data.location_visibility || "withheld");
  const lat = typeof parsed.data.latitude === "number" ? parsed.data.latitude : null;
  const lon = typeof parsed.data.longitude === "number" ? parsed.data.longitude : null;
  const uncertaintyKm =
    typeof parsed.data.coordinate_uncertainty_km === "number"
      ? parsed.data.coordinate_uncertainty_km
      : null;
  const hasAnyCoordinate = lat !== null || lon !== null;
  const hasApprovedPolicy =
    coordinatePrecision === "regional-centroid" && locationVisibility === "public-generalized";

  if (hasAnyCoordinate && !hasApprovedPolicy) {
    throw new Error(`Refusing to publish unapproved coordinates for ${id}`);
  }
  if (hasApprovedPolicy && (lat === null || lon === null)) {
    throw new Error(`Approved generalized placement on ${id} requires both coordinates`);
  }
  if (hasApprovedPolicy && (uncertaintyKm === null || uncertaintyKm < 8)) {
    throw new Error(`Approved generalized placement on ${id} requires at least 8 km uncertainty`);
  }
  if (!hasApprovedPolicy || lat === null || lon === null) return null;
  if (parsed.data.atlas !== true) return null;
  if (!String(parsed.data.atlas_basis || "").trim()) {
    throw new Error(`Atlas site ${id} requires atlas_basis`);
  }

  const kind = String(parsed.data.site_kind || "archaeological-site");
  return {
    id,
    name: String(parsed.data.name || id),
    lat,
    lon,
    coordinateMethod: "reconstructed",
    kind: humanize(kind),
    basis: String(parsed.data.coordinate_basis || "Generalized public research geography"),
    note: String(parsed.data.coordinate_note || ""),
    uncertaintyKm: uncertaintyKm as number,
    periods: strings(parsed.data.periods).map(wikiLabel),
    cultures: strings(parsed.data.cultures).map(wikiLabel),
    finds: strings(parsed.data.finds),
    techniques: [kind],
    latestStudyYear: optionalYear(parsed.data.latest_study_year),
    latestStudyLabel: parsed.data.latest_study_label ? String(parsed.data.latest_study_label) : null,
    lastFieldworkYear: optionalYear(parsed.data.last_fieldwork_year),
    lastFieldworkLabel: parsed.data.last_fieldwork_label
      ? String(parsed.data.last_fieldwork_label)
      : optionalYear(parsed.data.last_fieldwork_year)?.toString() ?? null,
    body: webMarkdown(stripLeadingTitle(parsed.content)),
  };
}

function facets(values: string[], label: (value: string) => string): TaxonomyEntry[] {
  return [...new Set(values)]
    .sort(collator.compare)
    .map((value, index) => ({ id: value, name: label(value), description: label(value), sortOrder: index + 1 }));
}

function amazonEarthworkInventoryLayer(root: string): AtlasAncientFeatureCell[] {
  const filename = path.join(path.dirname(root), "_data", "amazon-earthwork-inventory.json");
  const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as {
    peripato_records?: unknown;
    kalliola_records?: unknown;
    displayed_cells?: unknown;
    cells?: unknown;
  };
  if (
    parsed.peripato_records !== 961 ||
    parsed.kalliola_records !== 1279 ||
    typeof parsed.displayed_cells !== "number" ||
    !Array.isArray(parsed.cells)
  ) {
    throw new Error(`Invalid Amazon earthwork inventory layer in ${filename}`);
  }
  const cells = parsed.cells.map((value, index) => {
    const cell = value as Record<string, unknown>;
    if (
      typeof cell.id !== "string" ||
      typeof cell.peripato_records !== "number" ||
      typeof cell.kalliola_records !== "number" ||
      cell.peripato_records + cell.kalliola_records < 1 ||
      typeof cell.source_id !== "string" ||
      typeof cell.source_label !== "string" ||
      typeof cell.source_url !== "string" ||
      !Array.isArray(cell.bounds) ||
      cell.bounds.length !== 2 ||
      !cell.bounds.every(
        (corner) => Array.isArray(corner) && corner.length === 2 && corner.every(Number.isFinite),
      )
    ) {
      throw new Error(`Invalid Amazon earthwork inventory cell ${index} in ${filename}`);
    }
    return cell as {
      id: string;
      bounds: [[number, number], [number, number]];
      peripato_records: number;
      kalliola_records: number;
      source_id: string;
      source_label: string;
      source_url: string;
    };
  });
  if (cells.length !== parsed.displayed_cells) {
    throw new Error(`Amazon earthwork cell count does not match metadata in ${filename}`);
  }
  return cells.map((cell) => ({
    id: `inventory:${cell.id}`,
    bounds: cell.bounds,
    region: `Earthwork inventory cell · ${Math.abs((cell.bounds[0][0] + cell.bounds[1][0]) / 2).toFixed(2)}°${cell.bounds[1][0] <= 0 ? "S" : "N"}, ${Math.abs((cell.bounds[0][1] + cell.bounds[1][1]) / 2).toFixed(2)}°${cell.bounds[1][1] <= 0 ? "W" : "E"}`,
    sourceId: cell.source_id,
    sourceLabel: cell.source_label,
    sourceUrl: cell.source_url,
    featureTypes: ["documented pre-Columbian earthworks"],
    discoveryMethods: ["published archaeological inventories", "field survey and remote sensing"],
    contextNote:
      "One or more public earthwork-inventory coordinates fall within this occupied 0.01-degree cell.",
  }));
}

function acreAmazonasAlsEarthworkLayer(root: string): AtlasAncientFeatureCell[] {
  const filename = path.join(
    path.dirname(root),
    "_data",
    "2024-acre-amazonas-als-earthworks.json",
  );
  const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as {
    campaign_records?: unknown;
    public_coordinate_records?: unknown;
    withheld_indigenous_territory_records?: unknown;
    displayed_cells?: unknown;
    source_id?: unknown;
    source_label?: unknown;
    source_url?: unknown;
    cells?: unknown;
  };
  if (
    parsed.campaign_records !== 432 ||
    parsed.public_coordinate_records !== 406 ||
    parsed.withheld_indigenous_territory_records !== 26 ||
    typeof parsed.displayed_cells !== "number" ||
    typeof parsed.source_id !== "string" ||
    typeof parsed.source_label !== "string" ||
    typeof parsed.source_url !== "string" ||
    !Array.isArray(parsed.cells)
  ) {
    throw new Error(`Invalid 2024 Acre–Amazonas ALS earthwork layer in ${filename}`);
  }

  const cells = parsed.cells.map((value, index) => {
    const cell = value as Record<string, unknown>;
    if (
      typeof cell.id !== "string" ||
      typeof cell.record_count !== "number" ||
      typeof cell.aquiry_record_count !== "number" ||
      typeof cell.other_record_count !== "number" ||
      typeof cell.partial_record_count !== "number" ||
      cell.record_count !== cell.aquiry_record_count + cell.other_record_count ||
      !Array.isArray(cell.feature_types) ||
      !cell.feature_types.every((feature) => typeof feature === "string") ||
      !Array.isArray(cell.bounds) ||
      cell.bounds.length !== 2 ||
      !cell.bounds.every(
        (corner) => Array.isArray(corner) && corner.length === 2 && corner.every(Number.isFinite),
      )
    ) {
      throw new Error(`Invalid 2024 Acre–Amazonas ALS earthwork cell ${index} in ${filename}`);
    }
    return cell as {
      id: string;
      bounds: [[number, number], [number, number]];
      record_count: number;
      aquiry_record_count: number;
      other_record_count: number;
      partial_record_count: number;
      feature_types: string[];
    };
  });
  if (
    cells.length !== parsed.displayed_cells ||
    cells.reduce((total, cell) => total + cell.record_count, 0) !==
      parsed.public_coordinate_records
  ) {
    throw new Error(`2024 Acre–Amazonas ALS cell totals do not match metadata in ${filename}`);
  }

  return cells.map((cell) => {
    const centerLatitude = (cell.bounds[0][0] + cell.bounds[1][0]) / 2;
    const centerLongitude = (cell.bounds[0][1] + cell.bounds[1][1]) / 2;
    const partialNote = cell.partial_record_count
      ? ` ${cell.partial_record_count} ${cell.partial_record_count === 1 ? "structure intersects" : "structures intersect"} the scanned swath by less than half.`
      : "";
    return {
      id: `als-2024:${cell.id}`,
      bounds: cell.bounds,
      region: `2024 ALS detections · ${Math.abs(centerLatitude).toFixed(3)}°S, ${Math.abs(centerLongitude).toFixed(3)}°W`,
      sourceId: parsed.source_id as string,
      sourceLabel: parsed.source_label as string,
      sourceUrl: parsed.source_url as string,
      featureTypes: cell.feature_types,
      discoveryMethods: ["2024 airborne LiDAR campaign"],
      contextNote:
        `Supplementary Table 2 places ${cell.record_count} ${cell.record_count === 1 ? "published detection" : "published detections"} in this occupied 0.01-degree cell.${partialNote}`,
    } as AtlasAncientFeatureCell;
  });
}

function cellsOverlap(
  left: AtlasAncientFeatureCell["bounds"],
  right: AtlasAncientFeatureCell["bounds"],
): boolean {
  return (
    left[0][0] < right[1][0] &&
    left[1][0] > right[0][0] &&
    left[0][1] < right[1][1] &&
    left[1][1] > right[0][1]
  );
}

function panAmazonAncientFeatureLayer(
  root: string,
  surveys: readonly AtlasLidarSurvey[],
): AtlasAncientFeatureCell[] {
  const filename = path.join(path.dirname(root), "_data", "amazon-ancient-feature-evidence.json");
  const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as {
    coordinate_policy?: unknown;
    cells?: unknown;
  };

  if (typeof parsed.coordinate_policy !== "string" || !Array.isArray(parsed.cells)) {
    throw new Error(`Invalid Pan-Amazon ancient-feature evidence layer in ${filename}`);
  }

  return parsed.cells.map((value, index) => {
    const cell = value as Record<string, unknown>;
    if (
      typeof cell.id !== "string" ||
      !Array.isArray(cell.bounds) ||
      cell.bounds.length !== 2 ||
      !cell.bounds.every(
        (corner) => Array.isArray(corner) && corner.length === 2 && corner.every(Number.isFinite),
      ) ||
      typeof cell.source_id !== "string" ||
      !Array.isArray(cell.feature_types) ||
      !cell.feature_types.every((feature) => typeof feature === "string") ||
      !Array.isArray(cell.discovery_methods) ||
      !cell.discovery_methods.every((method) => typeof method === "string") ||
      !(cell.region === undefined || typeof cell.region === "string") ||
      !(cell.source_label === undefined || typeof cell.source_label === "string") ||
      !(
        cell.source_url === undefined ||
        cell.source_url === null ||
        (typeof cell.source_url === "string" && cell.source_url.startsWith("https://"))
      ) ||
      !(cell.context_note === undefined || typeof cell.context_note === "string")
    ) {
      throw new Error(`Invalid Pan-Amazon ancient-feature evidence cell ${index} in ${filename}`);
    }

    const relatedSurveys = surveys.filter((survey) => survey.paperId === cell.source_id);
    const sourceLabel =
      typeof cell.source_label === "string" ? cell.source_label : relatedSurveys[0]?.sourceLabel;
    const sourceUrl =
      typeof cell.source_url === "string" || cell.source_url === null
        ? cell.source_url
        : relatedSurveys.find((survey) => survey.sourceUrl)?.sourceUrl ?? null;
    const region =
      typeof cell.region === "string"
        ? cell.region
        : [...new Set(relatedSurveys.map((survey) => survey.region))].join(" + ");

    if (!sourceLabel || !region) {
      throw new Error(`Ancient-feature cell ${cell.id} lacks resolvable source metadata`);
    }

    return {
      id: `amazon:${cell.id}`,
      bounds: cell.bounds,
      region,
      sourceId: cell.source_id,
      sourceLabel,
      sourceUrl,
      featureTypes: cell.feature_types,
      discoveryMethods: cell.discovery_methods,
      contextNote:
        typeof cell.context_note === "string"
          ? cell.context_note
          : "Generalized evidence cell derived from published research geography; not an exact archaeological-site location.",
    } as AtlasAncientFeatureCell;
  });
}

type SourceLidarSurvey = AtlasLidarSurvey & { atlasVisible: boolean };

function lidarLayer(root: string): { surveys: SourceLidarSurvey[]; coordinatePolicy: string } {
  const filename = path.join(path.dirname(root), "_data", "acre-lidar-surveys.json");
  const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as {
    coordinate_policy?: unknown;
    surveys?: unknown;
  };
  if (typeof parsed.coordinate_policy !== "string" || !Array.isArray(parsed.surveys)) {
    throw new Error(`Invalid Acre LiDAR layer in ${filename}`);
  }

  const allowedKinds = new Set([
    "prototype",
    "survey",
    "method",
    "discovery",
    "regional-survey",
    "screened-legacy",
    "unscreened-archive",
    "site-documentation",
    "preliminary-program",
  ]);
  const allowedAcquisitionPurposes = new Set(["archaeology", "other"]);
  const allowedArchaeologyReviewStatuses = new Set([
    "systematic",
    "partial",
    "ongoing",
    "none-found",
  ]);
  const allowedCoverageModes = new Set(["continuous", "corridor", "distributed", "context"]);
  const surveys = parsed.surveys.map((value, index) => {
    const survey = value as Record<string, unknown>;
    if (
      typeof survey.id !== "string" ||
      typeof survey.name !== "string" ||
      !(
        survey.atlas_visible === undefined ||
        typeof survey.atlas_visible === "boolean"
      ) ||
      typeof survey.year !== "number" ||
      typeof survey.paper_id !== "string" ||
      typeof survey.kind !== "string" ||
      !allowedKinds.has(survey.kind) ||
      typeof survey.coverage_mode !== "string" ||
      !allowedCoverageModes.has(survey.coverage_mode) ||
      typeof survey.acquisition_purpose !== "string" ||
      !allowedAcquisitionPurposes.has(survey.acquisition_purpose) ||
      typeof survey.archaeology_review_status !== "string" ||
      !allowedArchaeologyReviewStatuses.has(survey.archaeology_review_status) ||
      !(
        (typeof survey.archaeology_review_fraction === "number" &&
          survey.archaeology_review_fraction >= 0 &&
          survey.archaeology_review_fraction <= 1) ||
        survey.archaeology_review_fraction === null
      ) ||
      typeof survey.archaeology_review_scope !== "string" ||
      !(
        typeof survey.archaeology_review_url === "string" ||
        survey.archaeology_review_url === null
      ) ||
      typeof survey.archaeology_usable !== "boolean" ||
      typeof survey.country !== "string" ||
      typeof survey.region !== "string" ||
      typeof survey.source_label !== "string" ||
      !(typeof survey.source_url === "string" || survey.source_url === null) ||
      typeof survey.footprint_note !== "string" ||
      !(
        (typeof survey.terrain_resolution_m === "number" && survey.terrain_resolution_m > 0) ||
        survey.terrain_resolution_m === null
      ) ||
      !(
        (typeof survey.point_density_m2 === "number" && survey.point_density_m2 > 0) ||
        survey.point_density_m2 === null
      ) ||
      typeof survey.resolution_basis !== "string" ||
      !Array.isArray(survey.positions) ||
      survey.positions.length < 3 ||
      !survey.positions.every(
        (position) =>
          Array.isArray(position) && position.length === 2 && position.every(Number.isFinite),
      ) ||
      !Array.isArray(survey.metrics) ||
      !survey.metrics.every((metric) => typeof metric === "string") ||
      typeof survey.description !== "string"
    ) {
      throw new Error(`Invalid Acre LiDAR survey ${index} in ${filename}`);
    }
    return {
      id: survey.id,
      name: survey.name,
      atlasVisible: survey.atlas_visible !== false,
      year: survey.year,
      paperId: survey.paper_id,
      kind: survey.kind,
      coverageMode: survey.coverage_mode,
      acquisitionPurpose: survey.acquisition_purpose,
      archaeologyReviewStatus: survey.archaeology_review_status,
      archaeologyReviewFraction: survey.archaeology_review_fraction,
      archaeologyReviewScope: survey.archaeology_review_scope,
      archaeologyReviewUrl: survey.archaeology_review_url,
      archaeologyUsable: survey.archaeology_usable,
      country: survey.country,
      region: survey.region,
      sourceLabel: survey.source_label,
      sourceUrl: survey.source_url,
      footprintNote: survey.footprint_note,
      terrainResolutionM: survey.terrain_resolution_m,
      pointDensityM2: survey.point_density_m2,
      resolutionBasis: survey.resolution_basis,
      positions: survey.positions,
      metrics: survey.metrics,
      description: survey.description,
    } as SourceLidarSurvey;
  });

  return { surveys, coordinatePolicy: parsed.coordinate_policy };
}

function lidarFootprintLayer(
  root: string,
  surveys: readonly AtlasLidarSurvey[],
): { footprints: AtlasLidarFootprint[]; coordinatePolicy: string } {
  const filename = path.join(path.dirname(root), "_data", "amazon-lidar-footprints.json");
  const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as {
    coordinate_policy?: unknown;
    provenance_counts?: unknown;
    footprints?: unknown;
  };
  if (
    typeof parsed.coordinate_policy !== "string" ||
    !Array.isArray(parsed.footprints) ||
    typeof parsed.provenance_counts !== "object" ||
    parsed.provenance_counts === null
  ) {
    throw new Error(`Invalid Amazon LiDAR footprint layer in ${filename}`);
  }

  const surveyIds = new Set(surveys.map((survey) => survey.id));
  const allowedProvenance = new Set(["released", "published-map", "reconstructed", "context"]);
  const footprints = parsed.footprints.map((value, index) => {
    const footprint = value as Record<string, unknown>;
    if (
      typeof footprint.id !== "string" ||
      !Array.isArray(footprint.survey_ids) ||
      footprint.survey_ids.length < 1 ||
      !footprint.survey_ids.every((id) => typeof id === "string" && surveyIds.has(id)) ||
      !Array.isArray(footprint.positions) ||
      footprint.positions.length < 3 ||
      !footprint.positions.every(
        (position) =>
          Array.isArray(position) && position.length === 2 && position.every(Number.isFinite),
      ) ||
      typeof footprint.provenance !== "string" ||
      !allowedProvenance.has(footprint.provenance) ||
      typeof footprint.source_label !== "string" ||
      !(
        footprint.source_url === null ||
        (typeof footprint.source_url === "string" && footprint.source_url.startsWith("https://"))
      ) ||
      typeof footprint.note !== "string"
    ) {
      throw new Error(`Invalid Amazon LiDAR footprint ${index} in ${filename}`);
    }
    return {
      id: footprint.id,
      surveyIds: footprint.survey_ids,
      positions: footprint.positions,
      provenance: footprint.provenance,
      sourceLabel: footprint.source_label,
      sourceUrl: footprint.source_url,
      note: footprint.note,
    } as AtlasLidarFootprint;
  });

  const declaredCounts = parsed.provenance_counts as Record<string, unknown>;
  for (const provenance of allowedProvenance) {
    const actual = footprints.filter((footprint) => footprint.provenance === provenance).length;
    if (declaredCounts[provenance] !== actual) {
      throw new Error(`Amazon LiDAR ${provenance} footprint count does not match metadata`);
    }
  }

  return { footprints, coordinatePolicy: parsed.coordinate_policy };
}

function validateAtlas(data: AtlasData): void {
  const ids = new Set<string>();
  const periodNames = new Set(data.periods.map((entry) => entry.name));
  const cultureNames = new Set(data.cultures.map((entry) => entry.name));
  for (const place of data.places) {
    if (ids.has(place.id)) throw new Error(`Duplicate site_id: ${place.id}`);
    ids.add(place.id);
    for (const period of place.periods) {
      if (!periodNames.has(period)) throw new Error(`Unknown period ${period} on ${place.id}`);
    }
    for (const culture of place.cultures) {
      if (!cultureNames.has(culture)) throw new Error(`Unknown culture ${culture} on ${place.id}`);
    }
  }
}

export function getAtlasData(): AtlasData {
  if (process.env.NODE_ENV === "production" && atlasCache) return atlasCache;
  const root = vaultRoot();
  const lidar = lidarLayer(root);
  const lidarFootprints = lidarFootprintLayer(root, lidar.surveys);
  const atlasLidarSurveys = lidar.surveys
    .filter((survey) => survey.atlasVisible)
    .map(({ atlasVisible: _atlasVisible, ...survey }) => survey);
  const atlasLidarSurveyIds = new Set(atlasLidarSurveys.map((survey) => survey.id));
  const atlasLidarFootprints = lidarFootprints.footprints
    .map((footprint) => ({
      ...footprint,
      surveyIds: footprint.surveyIds.filter((surveyId) => atlasLidarSurveyIds.has(surveyId)),
    }))
    .filter((footprint) => footprint.surveyIds.length > 0);
  const inventoryAncientFeatures = amazonEarthworkInventoryLayer(root);
  const acreAmazonasAlsEarthworks = acreAmazonasAlsEarthworkLayer(root);
  const panAmazonAncientFeatures = panAmazonAncientFeatureLayer(root, atlasLidarSurveys);
  const specificAncientFeatures = [...acreAmazonasAlsEarthworks, ...panAmazonAncientFeatures];
  const unsupersededInventoryFeatures = inventoryAncientFeatures.filter(
    (inventoryCell) =>
      !specificAncientFeatures.some((specificCell) =>
        cellsOverlap(inventoryCell.bounds, specificCell.bounds),
      ),
  );
  const places = markdownFiles(path.join(root, "Archaeological Sites"))
    .map(placeRecord)
    .filter((place): place is AtlasPlace => place !== null)
    .sort((left, right) => collator.compare(left.name, right.name));
  const data: AtlasData = {
    places,
    periods: taxonomy(path.join(root, "Periods"), "period"),
    cultures: taxonomy(path.join(root, "Cultures"), "culture"),
    finds: facets(places.flatMap((place) => place.finds), humanize),
    techniques: facets(places.flatMap((place) => place.techniques), humanize),
    ancientFeatureCells: [...unsupersededInventoryFeatures, ...specificAncientFeatures],
    lidarSurveys: atlasLidarSurveys,
    lidarFootprints: atlasLidarFootprints,
    lidarCoordinatePolicy: lidar.coordinatePolicy,
    lidarFootprintPolicy: lidarFootprints.coordinatePolicy,
  };
  validateAtlas(data);
  if (process.env.NODE_ENV === "production") atlasCache = data;
  return data;
}
