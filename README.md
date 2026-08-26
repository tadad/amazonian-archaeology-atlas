# Amazonian and Andean Archaeology Research Corpus

This is a broad-discovery, multilingual research corpus about archaeology,
ethnohistory, oral traditions, legendary places, and disputed claims in the
Amazonian and Andean parts of South America. Its center of gravity is Peru,
Bolivia, Brazil, Ecuador, Colombia, Venezuela, the Guianas, and Inca-connected
southern Andean/Patagonian material. Rio de la Plata material is out of scope
unless it has a direct connection to those regions.

The corpus begins with Wikipedia in English, Spanish, and Portuguese, then
follows citations toward primary sources and strong secondary scholarship.
Wikipedia is a discovery map, not the final authority.

## Start here

- [Acre web atlas](app/README.md): interactive map, field index, paper library,
  and graph wiki backed directly by the Acre vault
- [Acre knowledge graph](vault/Home.md): El Salvador-compatible six-entity
  ontology populated with Acre papers, places, periods, cultures, authors, and
  organizations
- [Acre research library](vault/Library.md): bibliography-first inventory with
  explicit restricted-local-PDF, open-access, publisher-only, report, and lead
  statuses
- [Corpus index](INDEX.md): generated inventory and country/topic views
- [Field guide](FIELD-GUIDE.md): curated orientation to the strongest and most
  important leads
- [Schema and evidence labels](SCHEMA.md): how records should be interpreted
- [Downloaded and linked sources](sources/INDEX.md): primary and strong
  secondary material
- [Searchable PDF derivatives](sources/markdown/INDEX.md): local Markdown OCR
  and layout conversions for agent reading and full-text search
- [`topics/`](topics/): one Markdown record per deduplicated subject

## Important cautions

- `unassessed` means discovered, not verified.
- `legendary` describes the nature of a tradition; it does not mean the
  tradition is culturally unimportant or that every attached historical claim
  is false.
- Colonial chronicles are primary sources for what their authors recorded, but
  not automatically reliable eyewitness proof of pre-Columbian events.
- Archaeological corroboration is granular. A real site can accumulate later
  legendary claims that remain unsupported.
- Indigenous names, communities, and oral traditions deserve attribution and
  contextual reading; colonial spellings and outsider categories are retained
  only when needed for source discovery.

## Maintenance

Run shared commands from the workspace root:

```bash
python3 tools/corpus.py discover andes-amazon
python3 tools/corpus.py manifest andes-amazon
python3 tools/corpus.py validate andes-amazon
python3 tools/corpus.py pdf andes-amazon
```

The converter uses Marker 2.0.0 locally in resumable fast mode. It preserves
page separators, recovers layout from usable embedded text, and sends PDFs with
almost no text layer through forced multilingual full-page OCR. Generated text
is a search aid; verify quotations and exact spellings against the source PDF.

The discovery command regenerates machine-discovered records,
`_data/manifest.json`, and `INDEX.md`. Manually curated source records and the
field guide are separate so they are not overwritten.

Build and audit the Acre graph from the workspace root:

```bash
python3 andes-amazon/tools/build_acre_graph.py
python3 andes-amazon/tools/audit_vault_graph.py --max-size 10
```

The graph builder owns the initial Acre records. Exact archaeological
coordinates are withheld or generalized. Paper records distinguish discovery
from acquisition and review; `bibliographic-verified` does not mean that the
full text has been read.

Run the web atlas locally:

```bash
cd andes-amazon/app
npm install
npm run dev
```
