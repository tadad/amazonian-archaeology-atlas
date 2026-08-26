# Deferred PDF OCR

The following image-only books do not yet have Markdown derivatives:

- `1542-carvajal-descubrimiento-rio-amazonas-1894-edition.pdf` - 538 pages
- `1879-tres-relaciones-antiguedades-peruanas.pdf` - 387 pages

Both PDFs have effectively no embedded text layer. Local Marker 2.0 OCR was
stopped on 2026-08-06 because the original block-by-block run expanded into
more than 108,000 inference tasks, and the corrected forced full-page pass was
then deferred rather than continuing to occupy the machine. The PDFs
themselves remain intact under `sources/documents/`.

Resume both later from the workspace root with:

```bash
ARCHAEOLOGY_INCLUDE_DEFERRED=1 python3 tools/corpus.py pdf andes-amazon
```

The script skips the sixteen completed derivatives and runs forced full-page
OCR only for these two pending scans. For a faster future option, use a capable
GPU machine or a trusted batch OCR service, then rebuild this index with:

```bash
python3 tools/corpus.py index andes-amazon
```
