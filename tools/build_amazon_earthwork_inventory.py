#!/usr/bin/env python3
"""Build a generalized Pan-Amazon inventory of documented earthworks.

The two source datasets publish archaeological coordinates. This builder emits
only occupied 0.01-degree cells and source-specific record counts; it never
writes site names or source coordinates into the app's data layer.

Requires ``pyreadr`` to decode the Peripato et al. RDS file. The source archive
is downloaded from the authors' Zenodo record into a temporary directory.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import re
import subprocess
import tempfile
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

try:
    import pyreadr
except ImportError as error:  # pragma: no cover - dependency guidance
    raise SystemExit("Install pyreadr before rebuilding the Amazon earthwork layer") from error


ROOT = Path(__file__).resolve().parents[1]
KALLIOLA_PDF = ROOT / "sources" / "documents" / "2024-kalliola-earthworks-coordinate-list.pdf"
OUTPUT = ROOT / "_data" / "amazon-earthwork-inventory.json"
PERIPATO_ARCHIVE_URL = (
    "https://zenodo.org/api/records/10214943/files/"
    "Vperipato/ade2541-v1.0.0.zip/content"
)
PERIPATO_RDS_SUFFIX = "Database/Earthworks.rds"
PERIPATO_ARCHIVE_MD5 = "0c0496f4a445062a9977e19519a97b8f"
GRID_DEGREES = 0.01

KALLIOLA_ROW = re.compile(
    r"^\s*(?P<line>\d+)\s+.+?\s+(?P<longitude>-6\d\.\d+)\s+"
    r"(?P<latitude>-(?:8|9|10|11|12)\.\d+)\s*$"
)


def grid_cell(longitude: float, latitude: float) -> tuple[int, int]:
    return math.floor(latitude / GRID_DEGREES), math.floor(longitude / GRID_DEGREES)


def kalliola_counts() -> Counter[tuple[int, int]]:
    result = subprocess.run(
        ["pdftotext", "-layout", str(KALLIOLA_PDF), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    points: list[tuple[float, float]] = []
    line_numbers: set[int] = set()
    for line in result.stdout.splitlines():
        match = KALLIOLA_ROW.match(line)
        if not match:
            continue
        line_numbers.add(int(match.group("line")))
        points.append((float(match.group("longitude")), float(match.group("latitude"))))
    if len(points) != 1279 or line_numbers != set(range(1, 1280)):
        raise ValueError(f"Expected the complete 1,279-row Kalliola inventory; parsed {len(points)}")
    return Counter(grid_cell(longitude, latitude) for longitude, latitude in points)


def peripato_counts() -> Counter[tuple[int, int]]:
    with urllib.request.urlopen(PERIPATO_ARCHIVE_URL) as response:
        archive_bytes = response.read()
    if hashlib.md5(archive_bytes).hexdigest() != PERIPATO_ARCHIVE_MD5:
        raise ValueError("Peripato archive checksum does not match the published Zenodo record")
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive, tempfile.TemporaryDirectory() as temp:
        member = next(name for name in archive.namelist() if name.endswith(PERIPATO_RDS_SUFFIX))
        rds_path = Path(archive.extract(member, temp))
        frames = pyreadr.read_r(str(rds_path))
    frame = next(iter(frames.values()))
    if len(frame) != 961 or set(frame.columns) != {"Longitude", "Latitude", "Database"}:
        raise ValueError("Unexpected Peripato earthwork inventory shape")
    return Counter(grid_cell(row.Longitude, row.Latitude) for row in frame.itertuples())


def source_metadata(peripato_records: int, kalliola_records: int) -> tuple[str, str, str]:
    if peripato_records and kalliola_records:
        return (
            "2023-peripato-2024-kalliola-earthwork-inventories",
            "Peripato 2023 + Kalliola 2024 inventories",
            "https://zenodo.org/records/10214943",
        )
    if peripato_records:
        return (
            "2023-peripato-earthwork-inventory-dataset",
            "Peripato et al. 2023 earthwork inventory",
            "https://zenodo.org/records/10214943",
        )
    return (
        "2024-kalliola-earthwork-inventory-dataset",
        "Kalliola et al. 2024 earthwork inventory",
        "https://doi.org/10.23729/da98421d-d65d-4045-bc93-344a0837cc93",
    )


def main() -> None:
    kalliola = kalliola_counts()
    peripato = peripato_counts()
    cells = []
    for latitude_bin, longitude_bin in sorted(kalliola.keys() | peripato.keys()):
        south = round(latitude_bin * GRID_DEGREES, 6)
        west = round(longitude_bin * GRID_DEGREES, 6)
        peripato_records = peripato[(latitude_bin, longitude_bin)]
        kalliola_records = kalliola[(latitude_bin, longitude_bin)]
        source_id, source_label, source_url = source_metadata(peripato_records, kalliola_records)
        cells.append(
            {
                "id": f"{latitude_bin}:{longitude_bin}",
                "bounds": [[south, west], [round(south + GRID_DEGREES, 6), round(west + GRID_DEGREES, 6)]],
                "peripato_records": peripato_records,
                "kalliola_records": kalliola_records,
                "source_id": source_id,
                "source_label": source_label,
                "source_url": source_url,
            }
        )

    payload = {
        "schema_version": 1,
        "title": "Generalized cells from published Amazon earthwork inventories",
        "grid_degrees": GRID_DEGREES,
        "peripato_records": sum(peripato.values()),
        "kalliola_records": sum(kalliola.values()),
        "peripato_cells": len(peripato),
        "kalliola_cells": len(kalliola),
        "overlapping_cells": len(peripato.keys() & kalliola.keys()),
        "displayed_cells": len(cells),
        "cells": cells,
        "privacy_note": "Public source coordinates are generalized to occupied 0.01-degree cells (roughly 1.1 km north-south); site names and exact access points are not reproduced. This scale remains coarser than the 500 m record-merging radius documented by Peripato et al.",
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: payload[key] for key in ("peripato_records", "kalliola_records", "displayed_cells")}))


if __name__ == "__main__":
    main()
