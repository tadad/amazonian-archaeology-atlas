import "server-only";

import { getAtlasData } from "@/lib/atlas";
import type { AtlasSearchResult } from "@/lib/atlas-types";
import { getVaultSearchCandidates } from "@/lib/vault-catalogue";

type RankedCandidate = {
  result: AtlasSearchResult;
  searchText: string;
  priority: number;
};

const categoryLabels: Record<string, string> = {
  "archaeological-sites": "Archaeological sites",
  authors: "Authors",
  cultures: "Cultures",
  investigations: "Investigations",
  "lidar-scans": "LiDAR scans",
  organizations: "Organizations",
  papers: "Papers",
  periods: "Periods",
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isWithinOneEdit(left: string, right: string): boolean {
  if (Math.abs(left.length - right.length) > 1) return false;
  let leftIndex = 0;
  let rightIndex = 0;
  let edits = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] === right[rightIndex]) {
      leftIndex += 1;
      rightIndex += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) leftIndex += 1;
    else if (right.length > left.length) rightIndex += 1;
    else {
      leftIndex += 1;
      rightIndex += 1;
    }
  }
  return edits + Number(leftIndex < left.length || rightIndex < right.length) <= 1;
}

function matchScore(query: string, candidate: RankedCandidate): number | null {
  const title = normalizeSearchText(candidate.result.title);
  const searchable = normalizeSearchText(candidate.searchText);
  if (title === query) return candidate.priority;
  if (title.startsWith(query)) return 6 + candidate.priority;
  if (title.includes(query)) return 12 + candidate.priority;
  if (searchable.includes(query)) return 20 + candidate.priority;

  const queryTokens = query.split(" ");
  const candidateWords = searchable.split(" ");
  const prefixMatch = queryTokens.every((token) =>
    candidateWords.some((word) => word.startsWith(token)),
  );
  if (prefixMatch) return 32 + candidate.priority;

  const fuzzyMatch = queryTokens.every((token) =>
    candidateWords.some((word) =>
      word.startsWith(token) || (token.length >= 4 && isWithinOneEdit(token, word)),
    ),
  );
  return fuzzyMatch ? 48 + candidate.priority : null;
}

function atlasSearchCandidates(): RankedCandidate[] {
  const data = getAtlasData();
  const mappedSurveyIds = new Set(
    data.lidarFootprints
      .filter((footprint) => footprint.provenance !== "context")
      .flatMap((footprint) => footprint.surveyIds),
  );
  const lidarGroups = new Map<string, typeof data.lidarSurveys>();
  data.lidarSurveys
    .filter((survey) => survey.archaeologyUsable && mappedSurveyIds.has(survey.id))
    .forEach((survey) => {
      const groupKey = /\s+line\s+L\d+$/i.test(survey.name) ? survey.paperId : survey.id;
      lidarGroups.set(groupKey, [...(lidarGroups.get(groupKey) ?? []), survey]);
    });
  const lidar = [...lidarGroups.entries()].map(([groupKey, surveys]): RankedCandidate => {
    const regions = [...new Set(surveys.map((survey) => survey.region))];
    const countries = [...new Set(surveys.map((survey) => survey.country))];
    const campaignNames = [...new Set(
      surveys.map((survey) => survey.name.replace(/\s+line\s+L\d+$/i, "")),
    )];
    const title = surveys.length === 1
      ? surveys[0].name
      : campaignNames.length === 1
        ? `${campaignNames[0]} · ${surveys.length} mapped zones`
        : `${surveys[0].sourceLabel} · ${surveys.length} mapped zones`;
    return {
      result: {
        id: `lidar:${groupKey}`,
        title,
        subtitle: `${Math.max(...surveys.map((survey) => survey.year))} · ${regions.join(" + ")} · ${countries.join(" + ")}`,
        category: "LiDAR surveys",
        target: { kind: "lidar", surveyIds: surveys.map((survey) => survey.id) },
      },
      searchText: surveys.flatMap((survey) => [
        survey.name,
        survey.region,
        survey.country,
        survey.sourceLabel,
        survey.kind,
        survey.description,
        ...survey.metrics,
      ]).join(" "),
      priority: 0,
    };
  });
  const ancientFeatures = data.ancientFeatureCells.map((cell): RankedCandidate => ({
    result: {
      id: `ancient-feature:${cell.id}`,
      title: cell.region,
      subtitle: `${cell.featureTypes.join(", ")} · ${cell.sourceLabel}`,
      category: "Ancient works",
      target: { kind: "ancient-feature", cellId: cell.id },
    },
    searchText: [
      cell.region,
      cell.sourceLabel,
      cell.contextNote,
      ...cell.featureTypes,
      ...cell.discoveryMethods,
    ].join(" "),
    priority: cell.id.startsWith("inventory:") ? 28 : 4,
  }));
  const knowledgeGraph = getVaultSearchCandidates().map((record): RankedCandidate => ({
    result: {
      id: `knowledge:${record.collectionSlug}:${record.slug}`,
      title: record.title,
      subtitle: record.subtitle,
      category: categoryLabels[record.collectionSlug] ?? record.collectionSlug,
      target: {
        kind: "knowledge-record",
        href: `/sources/${record.collectionSlug}/${encodeURIComponent(record.slug)}`,
      },
    },
    searchText: record.searchText,
    priority: ["lidar-scans", "investigations", "archaeological-sites", "papers"]
      .includes(record.collectionSlug) ? 8 : 14,
  }));
  return [...lidar, ...ancientFeatures, ...knowledgeGraph];
}

export function searchAtlas(queryValue: string, limit = 12): AtlasSearchResult[] {
  const query = normalizeSearchText(queryValue);
  if (query.length < 2) return [];

  const ranked = atlasSearchCandidates()
    .map((candidate) => ({ candidate, score: matchScore(query, candidate) }))
    .filter((entry): entry is { candidate: RankedCandidate; score: number } =>
      entry.score !== null,
    )
    .sort((left, right) =>
      left.score - right.score || left.candidate.result.title.localeCompare(right.candidate.result.title),
    );

  const categoryCounts = new Map<string, number>();
  const results: AtlasSearchResult[] = [];
  for (const { candidate } of ranked) {
    const count = categoryCounts.get(candidate.result.category) ?? 0;
    if (count >= 4) continue;
    categoryCounts.set(candidate.result.category, count + 1);
    results.push(candidate.result);
    if (results.length === limit) break;
  }
  return results;
}
