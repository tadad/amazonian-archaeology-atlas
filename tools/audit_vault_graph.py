#!/usr/bin/env python3
"""Audit connected components and unresolved typed links in the Acre vault."""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COLLECTIONS = (
    "LiDAR Scans",
    "Investigations",
    "Archaeological Sites",
    "Periods",
    "Cultures",
    "Papers",
    "Authors",
    "Organizations",
)
WIKILINK = re.compile(r"!?\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]")


def canonical(value: str) -> str:
    target = value.strip().replace("\\", "/")
    return target[:-3] if target.casefold().endswith(".md") else target


def audit(vault: Path) -> dict[str, object]:
    files = sorted(path for collection in COLLECTIONS for path in (vault / collection).glob("*.md"))
    relative = {path: path.relative_to(vault).with_suffix("").as_posix() for path in files}
    by_path = {name.casefold(): path for path, name in relative.items()}
    by_basename: dict[str, list[Path]] = defaultdict(list)
    for path, name in relative.items():
        by_basename[Path(name).name.casefold()].append(path)

    adjacency = {path: set() for path in files}
    unresolved: set[tuple[str, str]] = set()
    typed_prefixes = tuple(f"{collection.casefold()}/" for collection in COLLECTIONS)
    for source in files:
        for raw in WIKILINK.findall(source.read_text(encoding="utf-8")):
            target = canonical(raw)
            destination = by_path.get(target.casefold())
            if destination is None and "/" not in target:
                candidates = by_basename.get(Path(target).name.casefold(), [])
                if len(candidates) == 1:
                    destination = candidates[0]
            if destination is not None:
                adjacency[source].add(destination)
                adjacency[destination].add(source)
            elif target.casefold().startswith(typed_prefixes):
                unresolved.add((relative[source], target))

    components: list[list[str]] = []
    visited: set[Path] = set()
    for start in files:
        if start in visited:
            continue
        pending = [start]
        visited.add(start)
        component: list[str] = []
        while pending:
            current = pending.pop()
            component.append(relative[current])
            for destination in adjacency[current]:
                if destination not in visited:
                    visited.add(destination)
                    pending.append(destination)
        components.append(sorted(component))
    components.sort(key=lambda component: (-len(component), component[0]))
    edge_count = sum(len(destinations) for destinations in adjacency.values()) // 2
    return {
        "node_count": len(files),
        "edge_count": edge_count,
        "component_count": len(components),
        "component_sizes": [len(component) for component in components],
        "components": components,
        "unresolved_typed_links": [list(item) for item in sorted(unresolved)],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vault", type=Path, default=ROOT / "vault")
    parser.add_argument("--max-size", type=int, default=10)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    result = audit(args.vault)
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return
    sizes = Counter(result["component_sizes"])
    distribution = ", ".join(f"{size}x{count}" for size, count in sorted(sizes.items(), reverse=True))
    print(f"nodes={result['node_count']} edges={result['edge_count']} components={result['component_count']}")
    print(f"component_sizes={distribution}")
    for index, component in enumerate(result["components"], start=1):
        if len(component) <= args.max_size:
            print(f"\ncomponent={index} size={len(component)}")
            for node in component:
                print(f"  {node}")
    if result["unresolved_typed_links"]:
        print("\nunresolved_typed_links:")
        for source, target in result["unresolved_typed_links"]:
            print(f"  {source} -> {target}")


if __name__ == "__main__":
    main()
