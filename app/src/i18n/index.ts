import en from "@/i18n/dictionaries/en.json";
import pt from "@/i18n/dictionaries/pt-BR.json";
import type { Locale } from "@/i18n/config";

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  pt,
};

type ControlledReplacement = { candidate: string; translation: string };

const controlledReplacementCache = new WeakMap<Dictionary, ControlledReplacement[]>();

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export function formatMessage(
  message: string,
  values: Record<string, string | number>,
): string {
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

export function dictionaryValue(
  values: Record<string, string>,
  key: string,
  fallback = key.replaceAll("-", " "),
): string {
  return values[key] ?? fallback;
}

export function localizedRecordTitle(
  messages: Dictionary,
  collectionSlug: string,
  recordSlug: string,
  fallback: string,
): string {
  if (collectionSlug === "periods") {
    return (messages.periods as Record<string, string>)[recordSlug] ?? fallback;
  }
  if (collectionSlug === "cultures") {
    return (messages.cultures as Record<string, string>)[recordSlug] ?? fallback;
  }
  return fallback;
}

export function localizedRecordSubtitle(messages: Dictionary, subtitle: string): string {
  return subtitle
    .split(" · ")
    .map((part) => localizedControlledText(messages, part))
    .join(" · ");
}

export function localizedControlledText(messages: Dictionary, value: string): string {
  let replacements = controlledReplacementCache.get(messages);
  if (!replacements) {
    const controlledSections = [
      "controlledValues",
      "periods",
      "cultures",
      "siteKinds",
      "featureTypes",
      "discoveryMethods",
    ] as const;
    replacements = controlledSections
      .flatMap((section) => {
        const sourceEntries = en[section] as Record<string, string>;
        const translatedEntries = messages[section] as Record<string, string>;
        return Object.entries(sourceEntries).flatMap(([id, source]) =>
          [...new Set([id, id.replaceAll("-", " "), source])].map((candidate) => ({
            candidate,
            translation: translatedEntries[id] ?? source,
          })),
        );
      })
      .sort((left, right) => right.candidate.length - left.candidate.length);
    controlledReplacementCache.set(messages, replacements);
  }

  const exact = replacements.find(({ candidate }) => candidate === value);
  if (exact) return exact.translation;

  return replacements.reduce(
    (translated, { candidate, translation }) =>
      translated.replaceAll(candidate, translation),
    value,
  );
}

export function localizedGeneratedLabel(messages: Dictionary, value: string): string {
  return value
    .replaceAll(en.atlas.earthworkInventoryCell, messages.atlas.earthworkInventoryCell)
    .replaceAll(en.atlas.alsDetections2024, messages.atlas.alsDetections2024)
    .replace(/(\d+) mapped zones/g, (_match, count: string) =>
      formatMessage(messages.search.mappedZones, { count }),
    );
}
