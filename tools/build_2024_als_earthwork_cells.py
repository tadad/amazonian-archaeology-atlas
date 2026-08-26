#!/usr/bin/env python3
"""Build generalized evidence cells for the 2024 Acre–Amazonas ALS results.

Pärssinen et al. publish 406 earthwork coordinates in Supplementary Table 2;
coordinates for another 26 detections in contemporary Indigenous territories
are deliberately omitted. This builder downloads the official supplementary
DOCX, verifies it, and emits only occupied 0.01-degree cells. It does not copy
site names or exact source coordinates into the atlas.
"""

from __future__ import annotations

import hashlib
import io
import json
import math
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_data" / "2024-acre-amazonas-als-earthworks.json"
SOURCE_URL = (
    "https://media.springernature.com/original/springer-static/esm/"
    "art%3A10.1038%2Fs41586-026-10835-7/MediaObjects/"
    "41586_2026_10835_MOESM1_ESM.docx"
)
SOURCE_SHA256 = "64f30da7098d861e80295b52f0e3ba4f8e4763907c485b6b339666b4d0c8955c"
ARTICLE_URL = "https://www.nature.com/articles/s41586-026-10835-7"
GRID_DEGREES = 0.01
WORD_NAMESPACE = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{WORD_NAMESPACE}}}"


def cell_text(cell: ET.Element) -> str:
    return "".join(text.text or "" for text in cell.iter(f"{W}t")).strip()


def supplementary_rows(document: bytes) -> list[list[str]]:
    with zipfile.ZipFile(io.BytesIO(document)) as archive:
        root = ET.fromstring(archive.read("word/document.xml"))

    tables = root.findall(f".//{W}tbl")
    if len(tables) != 1:
        raise ValueError(f"Expected one supplementary table; found {len(tables)}")
    rows = [
        [cell_text(cell) for cell in row.findall(f"{W}tc")]
        for row in tables[0].findall(f"{W}tr")
    ]
    expected_header = ["No", "oS", "oW", "Name in our data", "Aquiry", "Size (ha)", "Accuracy"]
    if not rows or rows[0] != expected_header:
        raise ValueError(f"Unexpected Supplementary Table 2 header: {rows[0] if rows else None}")
    return rows[1:]


def main() -> None:
    with urllib.request.urlopen(SOURCE_URL) as response:
        source = response.read()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError("Supplementary DOCX checksum does not match the verified Nature file")

    rows = supplementary_rows(source)
    if len(rows) != 406:
        raise ValueError(f"Expected 406 public ALS detections; parsed {len(rows)}")

    cells: dict[tuple[int, int], Counter[str]] = {}
    for index, row in enumerate(rows, 1):
        if len(row) != 7:
            raise ValueError(f"Unexpected column count on supplementary row {index}")
        try:
            latitude = float(row[1].replace("−", "-"))
            longitude = float(row[2].replace("−", "-"))
        except ValueError as error:
            raise ValueError(f"Invalid coordinate on supplementary row {index}") from error
        aquiry = row[4].lower()
        if aquiry not in {"y", "n"}:
            raise ValueError(f"Unexpected Aquiry classification on supplementary row {index}: {row[4]}")

        key = (math.floor(latitude / GRID_DEGREES), math.floor(longitude / GRID_DEGREES))
        counts = cells.setdefault(key, Counter())
        counts["records"] += 1
        counts["aquiry" if aquiry == "y" else "other"] += 1
        if row[0].startswith("*"):
            counts["partial"] += 1

    output_cells = []
    for (latitude_bin, longitude_bin), counts in sorted(cells.items()):
        south = round(latitude_bin * GRID_DEGREES, 6)
        west = round(longitude_bin * GRID_DEGREES, 6)
        feature_types = []
        if counts["aquiry"]:
            feature_types.append("Aquiry geometric earthworks")
        if counts["other"]:
            feature_types.append("other ancient earthwork structures")
        output_cells.append(
            {
                "id": f"{latitude_bin}:{longitude_bin}",
                "bounds": [
                    [south, west],
                    [round(south + GRID_DEGREES, 6), round(west + GRID_DEGREES, 6)],
                ],
                "record_count": counts["records"],
                "aquiry_record_count": counts["aquiry"],
                "other_record_count": counts["other"],
                "partial_record_count": counts["partial"],
                "feature_types": feature_types,
            }
        )

    payload = {
        "schema_version": 1,
        "title": "Generalized public earthwork detections from the 2024 Acre–Amazonas ALS campaign",
        "grid_degrees": GRID_DEGREES,
        "campaign_records": 432,
        "public_coordinate_records": 406,
        "withheld_indigenous_territory_records": 26,
        "aquiry_records": sum(cell["aquiry_record_count"] for cell in output_cells),
        "other_records": sum(cell["other_record_count"] for cell in output_cells),
        "displayed_cells": len(output_cells),
        "source_id": "2026-parssinen-et-al-over-20000-earthworks",
        "source_label": "Pärssinen et al. 2026",
        "source_url": ARTICLE_URL,
        "coordinate_policy": (
            "The 406 coordinates published in Supplementary Table 2 are generalized to occupied "
            "0.01-degree cells. Site names and exact coordinates are not reproduced. The 26 campaign "
            "detections whose coordinates the authors omit because they are in contemporary Indigenous "
            "territories remain unmapped."
        ),
        "cells": output_cells,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                key: payload[key]
                for key in (
                    "campaign_records",
                    "public_coordinate_records",
                    "withheld_indigenous_territory_records",
                    "displayed_cells",
                )
            }
        )
    )


if __name__ == "__main__":
    main()
