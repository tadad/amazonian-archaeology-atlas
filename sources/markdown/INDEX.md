# Searchable PDF Derivatives

16 of 18 PDFs have local Markdown derivatives. Marker 2.0.0 generates them locally: PDFs with usable embedded text use fast layout conversion, while image-only scans use forced multilingual full-page OCR.

These files support agent reading and full-text search. They are not critical editions or authoritative transcriptions. Check quotations, names, dates, diacritics, and page references against the linked PDF.

Page separators use Marker's zero-based PDF page index, such as `{19}------------------------------------------------` for PDF page 20.

Long-running image-only scans may be listed in [`DEFERRED.md`](DEFERRED.md).

Regenerate or resume this collection from the workspace root:

```bash
python3 tools/corpus.py pdf andes-amazon
```

| Source PDF | Pages | Searchable derivative | Status |
| --- | ---: | --- | --- |
| [1542-carvajal-descubrimiento-rio-amazonas-1894-edition.pdf](../documents/1542-carvajal-descubrimiento-rio-amazonas-1894-edition.pdf) | 538 | - | [deferred OCR](DEFERRED.md) |
| [1553-cieza-cronica-del-peru-1922-edition.pdf](../documents/1553-cieza-cronica-del-peru-1922-edition.pdf) | 412 | [Markdown](1553-cieza-cronica-del-peru-1922-edition/1553-cieza-cronica-del-peru-1922-edition.md) | complete (130,177 words) |
| [1572-sarmiento-history-of-the-incas-1907-edition.pdf](../documents/1572-sarmiento-history-of-the-incas-1907-edition.pdf) | 456 | [Markdown](1572-sarmiento-history-of-the-incas-1907-edition/1572-sarmiento-history-of-the-incas-1907-edition.md) | complete (150,921 words) |
| [1641-acuna-nuevo-descubrimiento-gran-rio-amazonas.pdf](../documents/1641-acuna-nuevo-descubrimiento-gran-rio-amazonas.pdf) | 118 | [Markdown](1641-acuna-nuevo-descubrimiento-gran-rio-amazonas/1641-acuna-nuevo-descubrimiento-gran-rio-amazonas.md) | complete (29,810 words) |
| [1873-markham-narratives-rites-laws-incas.pdf](../documents/1873-markham-narratives-rites-laws-incas.pdf) | 254 | [Markdown](1873-markham-narratives-rites-laws-incas/1873-markham-narratives-rites-laws-incas.md) | complete (69,927 words) |
| [1876-barbosa-rodrigues-antiguidades-amazonas-vol-2.pdf](../documents/1876-barbosa-rodrigues-antiguidades-amazonas-vol-2.pdf) | 171 | [Markdown](1876-barbosa-rodrigues-antiguidades-amazonas-vol-2/1876-barbosa-rodrigues-antiguidades-amazonas-vol-2.md) | complete (38,843 words) |
| [1879-tres-relaciones-antiguedades-peruanas.pdf](../documents/1879-tres-relaciones-antiguedades-peruanas.pdf) | 387 | - | [deferred OCR](DEFERRED.md) |
| [1880-acosta-natural-moral-history-vol-1.pdf](../documents/1880-acosta-natural-moral-history-vol-1.pdf) | 364 | [Markdown](1880-acosta-natural-moral-history-vol-1/1880-acosta-natural-moral-history-vol-1.md) | complete (115,442 words) |
| [1880-acosta-natural-moral-history-vol-2.pdf](../documents/1880-acosta-natural-moral-history-vol-2.pdf) | 298 | [Markdown](1880-acosta-natural-moral-history-vol-2/1880-acosta-natural-moral-history-vol-2.md) | complete (94,978 words) |
| [1880-cieza-segunda-parte-cronica-del-peru.pdf](../documents/1880-cieza-segunda-parte-cronica-del-peru.pdf) | 484 | [Markdown](1880-cieza-segunda-parte-cronica-del-peru/1880-cieza-segunda-parte-cronica-del-peru.md) | complete (114,706 words) |
| [1891-xerez-estete-verdadera-relacion-conquista-peru.pdf](../documents/1891-xerez-estete-verdadera-relacion-conquista-peru.pdf) | 186 | [Markdown](1891-xerez-estete-verdadera-relacion-conquista-peru/1891-xerez-estete-verdadera-relacion-conquista-peru.md) | complete (34,300 words) |
| [1912-church-aborigines-of-south-america.pdf](../documents/1912-church-aborigines-of-south-america.pdf) | 352 | [Markdown](1912-church-aborigines-of-south-america/1912-church-aborigines-of-south-america.md) | complete (79,731 words) |
| [1921-nordenskiold-copper-bronze-ages-south-america.pdf](../documents/1921-nordenskiold-copper-bronze-ages-south-america.pdf) | 218 | [Markdown](1921-nordenskiold-copper-bronze-ages-south-america/1921-nordenskiold-copper-bronze-ages-south-america.md) | complete (43,186 words) |
| [1966-arguedas-dioses-hombres-huarochiri.pdf](../documents/1966-arguedas-dioses-hombres-huarochiri.pdf) | 27 | [Markdown](1966-arguedas-dioses-hombres-huarochiri/1966-arguedas-dioses-hombres-huarochiri.md) | complete (7,874 words) |
| [2017-watling-acre-geoglyph-builders.pdf](../documents/2017-watling-acre-geoglyph-builders.pdf) | 43 | [Markdown](2017-watling-acre-geoglyph-builders/2017-watling-acre-geoglyph-builders.md) | complete (9,853 words) |
| [2018-desouza-southern-amazon-earth-builders.pdf](../documents/2018-desouza-southern-amazon-earth-builders.pdf) | 10 | [Markdown](2018-desouza-southern-amazon-earth-builders/2018-desouza-southern-amazon-earth-builders.md) | complete (8,159 words) |
| [2022-prumers-casarabe-low-density-urbanism.pdf](../documents/2022-prumers-casarabe-low-density-urbanism.pdf) | 17 | [Markdown](2022-prumers-casarabe-low-density-urbanism/2022-prumers-casarabe-low-density-urbanism.md) | complete (5,475 words) |
| [2024-rostain-upano-garden-urbanism-supplement.pdf](../documents/2024-rostain-upano-garden-urbanism-supplement.pdf) | 20 | [Markdown](2024-rostain-upano-garden-urbanism-supplement/2024-rostain-upano-garden-urbanism-supplement.md) | complete (6,444 words) |
