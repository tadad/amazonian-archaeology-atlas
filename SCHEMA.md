# Record Schema and Evidence Taxonomy

## Acre knowledge graph ontology

The curated Amazonian vault under `vault/` uses typed Markdown records for
`LiDAR Scans`, `Investigations`, `Expeditions`, `Route Locations`,
`Archaeological Sites`, `Periods`, `Cultures`, `Papers`, `Authors`, and
`Organizations`. Archaeological Sites are named entities linked to fieldwork;
Route Locations are separate public geographic or interpretive anchors for a
documented journey. Papers own canonical author links and bibliographic,
provenance, access, and extraction status. Backlinks supply reverse edges.

The older `topics/` discovery records documented below remain intact. They are
a broad machine-discovery layer, not a replacement ontology for the curated
Acre graph.

## Route-location coordinates

Route Locations use `location_visibility: public-reference`. A `landmark`
coordinate is a modern mapped community, confluence, or feature; it does not
make the associated sixteenth-century event exact. An `approximate` coordinate
is a best-fit historical area with at least 8 km display uncertainty. Neither
class permits publishing a protected archaeological-site coordinate. The
schematic river centerline in `_data/orellana-route.json` likewise represents a
modern navigation corridor, not camps, daily positions, or historical channels.
The `marker_role` field separates `research` anchors from `expedition` events.
Where a report and an archaeological study share one public anchor, the record
remains a research marker and carries the report in an Expedition event section.

Each file in `topics/` is a discovery record. YAML front matter makes the
collection easy to import into SQLite later while keeping every record readable
without special software.

## Core fields

| Field | Meaning |
| --- | --- |
| `id` | Stable Wikidata QID when available; otherwise a language-title key |
| `title` | Best available display title, preferring Spanish then Portuguese then English |
| `kind` | `site`, `culture`, `landscape`, `artifact`, `person`, `expedition`, `tradition`, `legend`, or `other` |
| `evidence` | Current evidence assessment from the vocabulary below |
| `review_status` | `machine-discovered`, `partially-reviewed`, or `reviewed` |
| `countries` | Geographic tags inferred from discovery paths and article text |
| `wikidata` | Wikidata entity URL, when present |
| `coordinates` | Article coordinates, when present; not necessarily a precise site boundary |
| `wikipedia` | Language-to-article URL mapping |
| `discovered_from` | Categories or searches that led to the record |
| `retrieved` | Date of the Wikipedia/API retrieval |

## Evidence labels

- `archaeologically-corroborated`: material remains have been documented by
  professional archaeology or a comparably strong institutional source.
- `historically-attested`: supported by contemporary or near-contemporary
  documentary evidence, without implying archaeological confirmation.
- `ethnohistorically-documented`: recorded in oral-history, Indigenous,
  colonial, or ethnographic sources; claims must be interpreted in context.
- `legendary`: principally a myth, oral tradition, folklore complex, or
  legendary place/person.
- `disputed`: a concrete historical or archaeological interpretation is
  actively contested or rests on weak/ambiguous evidence.
- `debunked-or-pseudoscientific`: rejected by relevant scholarship or built on
  fabricated/pseudoscientific evidence.
- `mixed`: a real, corroborated subject has distinct legendary or disputed
  claims attached to it.
- `unassessed`: included for breadth but not yet evaluated beyond discovery.

## Source levels

1. `primary`: manuscript, early printed account, field notes, excavation
   report, artifact catalogue, map, photograph, dataset, or direct oral-history
   record.
2. `strong-secondary`: peer-reviewed research, academic monograph, critical
   edition, or synthesis by a museum, heritage body, or archaeological agency.
3. `discovery-secondary`: Wikipedia and other useful overviews that lead to
   stronger sources.
4. `weak-or-popular`: news, tourism, unsourced retellings, and entertainment;
   cite only when needed to track reception or claim propagation.

“Primary” describes proximity, not truth. A conquistador's report is primary
evidence for what the conquistador wrote and for the colonial setting, but it
may distort Indigenous societies or repeat hearsay.

## LiDAR study and footprint layers

`_data/acre-lidar-surveys.json` stores study-level metadata: purpose,
resolution, point density, bibliographic source, archaeological usability, and
the extent of published archaeological review. Review status uses four values:

- `systematic`: the mapped acquisition was systematically analyzed for archaeology;
- `partial`: only a documented subset was analyzed, or an archive-to-screen crosswalk is incomplete;
- `ongoing`: acquired for archaeological work whose completed review is not yet published;
- `none-found`: targeted multilingual searches found no published archaeological review of the exact dataset.

`archaeology_review_fraction` records a published fraction only when it can be
calculated without inference. `archaeology_review_scope` states what was actually
reviewed, and `archaeology_review_url` links separate review evidence when the
acquisition source is not itself that evidence. The atlas combines `partial` and
`ongoing` into one control while retaining the distinction in study metadata.

`_data/amazon-lidar-footprints.json` separately stores the polygons drawn on the
atlas. A footprint can reference one or more studies, and one study can own many
disconnected footprint parts.

Every map polygon has one explicit provenance value:

- `released`: vector acquisition geometry from a public GIS or dataset;
- `published-map`: digitized from a georeferenced or gridded publication figure;
- `reconstructed`: inferred from published maps, areas, or corridor descriptions;
- `context`: named study geography only, not demonstrated acquisition coverage.

A released acquisition footprint describes scanned ground coverage. It is not
a literal aircraft GNSS/SBET trajectory, and it does not imply that the data
have been archaeologically screened. Rebuild the generated footprint layer with
`uv run --with pyshp --with pyproj --with shapely python
tools/build_amazon_lidar_footprints.py`.
