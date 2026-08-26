# Acre Earthworks Atlas

A vault-driven atlas for the Acre archaeology knowledge graph. The map shows
only deliberately generalized research-area placements. Records whose public
locations are withheld remain fully searchable in the wiki catalogue, paper
catalogue, and graph backlinks.

The interface intentionally reuses the El Salvador atlas component structure
and styles; only the corpus, labels, map extent, and Acre coordinate policy are
different.

The application reads the six shared ontology collections directly from
`../vault`: Places, Periods, Cultures, Papers, Authors, and Organizations. New
records appear on the next build without app-specific route changes.

## Run it

```bash
cd andes-amazon/app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The basemap uses OpenStreetMap and requires an internet connection. Source
buttons open canonical publisher or repository pages. Restricted local PDFs
are preserved outside the navigable vault because source articles may contain
exact archaeological coordinates.
