"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  localizedGeneratedLabel,
  localizedRecordSubtitle,
  type Dictionary,
} from "@/i18n";
import type { AtlasSearchResult } from "@/lib/atlas-types";

export function AtlasSearchBox({
  onSelect,
  messages,
}: {
  onSelect: (result: AtlasSearchResult) => void;
  messages: Dictionary;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AtlasSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const resultGroups = useMemo(() => {
    const groups = new Map<string, Array<{ result: AtlasSearchResult; index: number }>>();
    results.forEach((result, index) => {
      groups.set(result.category, [...(groups.get(result.category) ?? []), { result, index }]);
    });
    return [...groups.entries()];
  }, [results]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/atlas-search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Atlas search failed with ${response.status}`);
        const payload = await response.json() as { results: AtlasSearchResult[] };
        setResults(payload.results);
        setActiveIndex(0);
        setOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResults([]);
          setOpen(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 140);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function select(result: AtlasSearchResult) {
    setOpen(false);
    onSelect(result);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || !results.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(results[activeIndex]);
    }
  }

  return (
    <div className="panel-search">
      <label htmlFor="atlas-search">{messages.search.label}</label>
      <div className="search-field">
        <span aria-hidden="true">⌕</span>
        <input
          id="atlas-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (query.trim().length >= 2) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          placeholder={messages.search.placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="atlas-search-results"
          aria-activedescendant={
            open && results[activeIndex] ? `atlas-search-result-${activeIndex}` : undefined
          }
        />
      </div>
      {open ? (
        <div className="atlas-search-results" id="atlas-search-results" role="listbox">
          {loading ? <p className="atlas-search-status">{messages.search.searching}</p> : null}
          {!loading && !results.length ? (
            <p className="atlas-search-status">{messages.search.noResults}</p>
          ) : null}
          {!loading
            ? resultGroups.map(([category, groupedResults]) => (
                <section className="atlas-search-group" key={category}>
                  <h3>{(messages.search.categories as Record<string, string>)[category] ?? category}</h3>
                  {groupedResults.map(({ result, index }) => (
                    <button
                      id={`atlas-search-result-${index}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(result)}
                      key={result.id}
                    >
                      <strong>{localizedGeneratedLabel(messages, result.title)}</strong>
                      <span>{localizedRecordSubtitle(messages, result.subtitle)}</span>
                    </button>
                  ))}
                </section>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
