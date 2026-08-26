import "server-only";

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type VaultRecordSummary = {
  collectionSlug: string;
  slug: string;
  title: string;
  type: string;
  subtitle: string;
};

export type VaultCollection = {
  directory: string;
  slug: string;
  name: string;
  type: string;
  records: VaultRecordSummary[];
};

export type VaultRecord = VaultRecordSummary & {
  body: string;
  properties: Record<string, unknown>;
  backlinks: VaultRecordSummary[];
};

export type VaultSearchCandidate = VaultRecordSummary & {
  searchText: string;
};

type IndexedRecord = VaultRecordSummary & {
  filename: string;
  properties: Record<string, unknown>;
  outgoingTargets: string[];
};

type VaultCatalogue = {
  collections: VaultCollection[];
  collectionsBySlug: Map<string, VaultCollection>;
  collectionSlugsByDirectory: Map<string, string>;
  recordsByKey: Map<string, IndexedRecord>;
  backlinksByKey: Map<string, VaultRecordSummary[]>;
};

const preferredCollectionOrder = [
  "places",
  "periods",
  "cultures",
  "papers",
  "authors",
  "organizations",
];
const ignoredDirectories = new Set(["Attachments", "Templates", "Views"]);
const ignoredSearchProperties = new Set([
  "latitude",
  "longitude",
  "local_pdf",
  "source_url",
  "pdf_sha256",
]);
const collator = new Intl.Collator("pt", { sensitivity: "base", numeric: true });
let catalogueCache: VaultCatalogue | undefined;

function vaultRoot(): string {
  const candidates = [path.resolve(process.cwd(), "..", "vault"), path.resolve(process.cwd(), "vault")];
  const match = candidates.find((candidate) => fs.existsSync(path.join(candidate, "Home.md")));
  if (!match) throw new Error(`Could not locate the Obsidian vault from ${process.cwd()}`);
  return match;
}

function routeSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function markdownFiles(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(directory, entry.name));
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function vaultLinkLabel(value: string): string {
  const match = value.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
  if (!match) return value;
  return match[2] || path.basename(match[1].split("#", 1)[0]);
}

function recordSubtitle(type: string, data: Record<string, unknown>): string {
  const parts: string[] = [];
  const year = data.publication_year ?? data.latest_study_year;
  const kind = data.place_kind ?? data.author_kind ?? data.organization_kind ?? data.work_type;
  if (typeof year === "number" || typeof year === "string") parts.push(String(year));
  if (typeof kind === "string" && kind) parts.push(kind.replaceAll("-", " "));

  const linked = [
    ...stringList(data.authors),
    ...stringList(data.organizations),
    ...stringList(data.periods),
    ...stringList(data.cultures),
  ]
    .slice(0, 2)
    .map(vaultLinkLabel);
  if (linked.length) parts.push(linked.join(", "));
  return parts.join(" · ") || type;
}

function recordKey(collectionSlug: string, recordSlug: string): string {
  return `${collectionSlug}/${recordSlug}`;
}

function targetKey(target: string, directorySlugs: Map<string, string>): string | null {
  const [recordPath] = target.split("#", 1);
  const slash = recordPath.indexOf("/");
  if (slash < 1) return null;
  const directory = recordPath.slice(0, slash);
  const recordSlug = recordPath.slice(slash + 1);
  const collectionSlug = directorySlugs.get(directory.toLocaleLowerCase());
  return collectionSlug && recordSlug ? recordKey(collectionSlug, recordSlug) : null;
}

function loadCatalogue(): VaultCatalogue {
  if (catalogueCache) return catalogueCache;

  const root = vaultRoot();
  const directories = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !ignoredDirectories.has(entry.name));
  const collectionSlugsByDirectory = new Map(
    directories.map((entry) => [entry.name.toLocaleLowerCase(), routeSlug(entry.name)]),
  );
  const indexedCollections: Array<{ directory: string; slug: string; records: IndexedRecord[] }> = [];

  for (const directory of directories) {
    const collectionSlug = routeSlug(directory.name);
    const records = markdownFiles(path.join(root, directory.name)).flatMap((filename): IndexedRecord[] => {
      const parsed = matter(fs.readFileSync(filename, "utf8"));
      const type = typeof parsed.data.type === "string" ? parsed.data.type : "";
      if (!type) return [];
      const slug = path.basename(filename, ".md");
      const title = String(parsed.data.name || parsed.data.title || slug);
      const serialized = `${JSON.stringify(parsed.data)}\n${parsed.content}`;
      return [{
        collectionSlug,
        slug,
        title,
        type,
        subtitle: recordSubtitle(type, parsed.data),
        filename,
        properties: parsed.data,
        outgoingTargets: Array.from(
          serialized.matchAll(/\[\[([^|\]]+)(?:\|[^\]]+)?\]\]/g),
          (match) => match[1],
        ),
      }];
    });
    if (records.length) indexedCollections.push({ directory: directory.name, slug: collectionSlug, records });
  }

  const recordsByKey = new Map<string, IndexedRecord>();
  for (const collection of indexedCollections) {
    for (const record of collection.records) recordsByKey.set(recordKey(collection.slug, record.slug), record);
  }

  const backlinksByKey = new Map<string, VaultRecordSummary[]>();
  for (const collection of indexedCollections) {
    for (const record of collection.records) {
      const source = summary(record);
      const seen = new Set<string>();
      for (const target of record.outgoingTargets) {
        const key = targetKey(target, collectionSlugsByDirectory);
        if (!key || !recordsByKey.has(key) || seen.has(key)) continue;
        seen.add(key);
        backlinksByKey.set(key, [...(backlinksByKey.get(key) || []), source]);
      }
    }
  }

  const collections = indexedCollections
    .map(({ directory, slug, records }): VaultCollection => ({
      directory,
      slug,
      name: directory,
      type: records[0].type,
      records: records
        .sort((left, right) => {
          const leftOrder = Number(left.properties.sort_order);
          const rightOrder = Number(right.properties.sort_order);
          if (Number.isFinite(leftOrder) || Number.isFinite(rightOrder)) {
            return (Number.isFinite(leftOrder) ? leftOrder : Number.MAX_SAFE_INTEGER) -
              (Number.isFinite(rightOrder) ? rightOrder : Number.MAX_SAFE_INTEGER);
          }
          const leftName = String(left.properties.sort_name || left.title);
          const rightName = String(right.properties.sort_name || right.title);
          return collator.compare(leftName, rightName);
        })
        .map(summary),
    }))
    .sort((left, right) => {
      const leftIndex = preferredCollectionOrder.indexOf(left.slug);
      const rightIndex = preferredCollectionOrder.indexOf(right.slug);
      const leftOrder = leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex;
      const rightOrder = rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex;
      return leftOrder - rightOrder || collator.compare(left.name, right.name);
    });

  catalogueCache = {
    collections,
    collectionsBySlug: new Map(collections.map((collection) => [collection.slug, collection])),
    collectionSlugsByDirectory,
    recordsByKey,
    backlinksByKey,
  };
  return catalogueCache;
}

function summary(record: IndexedRecord): VaultRecordSummary {
  return {
    collectionSlug: record.collectionSlug,
    slug: record.slug,
    title: record.title,
    type: record.type,
    subtitle: record.subtitle,
  };
}

function stripLeadingTitle(markdown: string): string {
  return markdown.replace(/^\s*# [^\n]+\n+/, "").trimStart();
}

export function vaultMarkdownForWeb(markdown: string): string {
  return markdown.replace(
    /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, label: string | undefined) => {
      const linked = vaultWebLink(`[[${target}${label ? `|${label}` : ""}]]`);
      return linked ? `[${linked.label}](${linked.href})` : label || path.basename(target.split("#", 1)[0]);
    },
  );
}

export function vaultWebLink(value: string): { href: string; label: string } | null {
  const match = value.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/);
  if (!match) return null;
  const [recordPath, heading] = match[1].split("#", 2);
  const catalogue = loadCatalogue();
  const key = targetKey(match[1], catalogue.collectionSlugsByDirectory);
  const record = key ? catalogue.recordsByKey.get(key) : undefined;
  if (!record) return null;
  const anchor = heading?.match(/^Page (\d+)$/)?.[1];
  return {
    href: `/sources/${record.collectionSlug}/${encodeURIComponent(record.slug)}${anchor ? `#page-${anchor}` : ""}`,
    label: match[2] || path.basename(recordPath),
  };
}

export function getVaultCollections(): VaultCollection[] {
  return loadCatalogue().collections;
}

export function getVaultSearchCandidates(): VaultSearchCandidate[] {
  return [...loadCatalogue().recordsByKey.values()].map((record) => {
    const propertyTerms = Object.entries(record.properties).flatMap(([key, value]) => {
      if (ignoredSearchProperties.has(key) || key.startsWith("coordinate_")) return [];
      if (typeof value === "string" || typeof value === "number") {
        return [vaultLinkLabel(String(value))];
      }
      if (Array.isArray(value)) {
        return value
          .filter((item): item is string | number =>
            typeof item === "string" || typeof item === "number",
          )
          .map((item) => vaultLinkLabel(String(item)));
      }
      return [];
    });
    const relationshipTerms = record.outgoingTargets.map((target) =>
      path.basename(target.split("#", 1)[0]),
    );
    return {
      ...summary(record),
      searchText: [record.title, record.subtitle, record.slug, ...propertyTerms, ...relationshipTerms]
        .join(" "),
    };
  });
}

export function getVaultCollection(slug: string): VaultCollection | undefined {
  return loadCatalogue().collectionsBySlug.get(slug);
}

export function getVaultRecord(collectionSlug: string, slug: string): VaultRecord | undefined {
  const catalogue = loadCatalogue();
  const indexed = catalogue.recordsByKey.get(recordKey(collectionSlug, slug));
  if (!indexed) return undefined;
  const parsed = matter(fs.readFileSync(indexed.filename, "utf8"));
  return {
    ...summary(indexed),
    properties: indexed.properties,
    body: vaultMarkdownForWeb(stripLeadingTitle(parsed.content)),
    backlinks: catalogue.backlinksByKey.get(recordKey(collectionSlug, slug)) || [],
  };
}
