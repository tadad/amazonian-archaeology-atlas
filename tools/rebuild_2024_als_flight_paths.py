#!/usr/bin/env python3
"""Rebuild the 2024 Acre–Amazonas ALS corridors from the official supplement.

Pärssinen et al. identify each public LiDAR detection with an ``L01``–``L10``
line and an ordered scan-segment number.  Those identifiers provide much
stronger geographic control than tracing the small overview figure by eye.

The output remains a reconstruction, not aircraft GNSS: L01–L06 are linear
fits extended over the paper's 223 approximately 2-km scan segments, and
L07–L10 combine ordered public detections with endpoints visible in Extended
Data Fig. 1.  Each centreline is rendered as the paper's reported 1-km swath.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import statistics
import urllib.request
from collections import defaultdict
from pathlib import Path

from build_2024_als_earthwork_cells import (
    SOURCE_SHA256,
    SOURCE_URL,
    supplementary_rows,
)


ROOT = Path(__file__).resolve().parents[1]
SURVEYS_PATH = ROOT / "_data" / "acre-lidar-surveys.json"
FOOTPRINTS_PATH = ROOT / "_data" / "amazon-lidar-footprints.json"
LINE_PATTERN = re.compile(r"^Lid24_L(?P<line>\d{2})_(?P<segment>\d+)")
SYSTEMATIC_LAST_SEGMENT = 223
SWATH_HALF_WIDTH_KM = 0.5

OLD_IDS = {
    1: "2026-acre-amazonas-als-parallel-6",
    2: "2026-acre-amazonas-als-parallel-5",
    3: "2026-acre-amazonas-als-parallel-4",
    4: "2026-acre-amazonas-als-parallel-3",
    5: "2026-acre-amazonas-als-parallel-2",
    6: "2026-acre-amazonas-als-parallel-1",
    7: "2026-acre-amazonas-als-labrea-carauari",
    8: "2026-acre-amazonas-als-purus-jurua",
    9: "2026-acre-amazonas-als-carauari-boca",
    10: "2026-acre-amazonas-als-boca-rio-branco",
}

REGIONS = {
    **{line: "Rio Branco–Lábrea systematic transect" for line in range(1, 7)},
    7: "Carauari–Lábrea route",
    8: "Manoel Urbano–Lábrea route",
    9: "Carauari–Boca do Acre–Rio Branco route",
    10: "Manoel Urbano–Rio Branco route",
}

DESCRIPTIONS = {
    **{
        line: "One of six parallel systematic ALS lines between the Rio Branco and Lábrea regions."
        for line in range(1, 7)
    },
    7: "The source-numbered route between Carauari and the Lábrea region.",
    8: "The source-numbered route from west of Manoel Urbano toward Lábrea.",
    9: "The source-numbered route from Carauari through Boca do Acre toward Rio Branco.",
    10: "The source-numbered southwestern route between the Manoel Urbano and Rio Branco regions.",
}


def line_id(line: int) -> str:
    return f"2026-acre-amazonas-als-line-{line:02d}"


def mean_points_by_segment(
    rows: list[list[str]],
) -> tuple[dict[int, list[tuple[int, float, float]]], dict[int, list[tuple[float, float]]]]:
    grouped: dict[int, dict[int, list[tuple[float, float]]]] = defaultdict(
        lambda: defaultdict(list)
    )
    raw: dict[int, list[tuple[float, float]]] = defaultdict(list)
    for row in rows:
        match = LINE_PATTERN.match(row[3])
        if not match:
            continue
        line = int(match.group("line"))
        segment = int(match.group("segment"))
        point = (
            float(row[1].replace("−", "-")),
            float(row[2].replace("−", "-")),
        )
        grouped[line][segment].append(point)
        raw[line].append(point)

    means = {
        line: [
            (
                segment,
                statistics.mean(point[0] for point in points),
                statistics.mean(point[1] for point in points),
            )
            for segment, points in sorted(segments.items())
        ]
        for line, segments in grouped.items()
    }
    if set(means) != set(range(1, 11)) or sum(map(len, raw.values())) != 370:
        raise ValueError("Expected 370 public Lid24 detections assigned across L01–L10")
    return means, raw


def linear_point(
    points: list[tuple[int, float, float]], segment: int
) -> tuple[float, float]:
    numbers = [point[0] for point in points]
    mean_number = statistics.mean(numbers)

    def fit(value_index: int) -> float:
        values = [point[value_index] for point in points]
        mean_value = statistics.mean(values)
        slope = sum(
            (number - mean_number) * (value - mean_value)
            for number, value in zip(numbers, values)
        ) / sum((number - mean_number) ** 2 for number in numbers)
        return mean_value + slope * (segment - mean_number)

    return fit(1), fit(2)


def centrelines(
    means: dict[int, list[tuple[int, float, float]]],
) -> dict[int, list[tuple[float, float]]]:
    lines = {
        line: [
            linear_point(means[line], 1),
            linear_point(means[line], SYSTEMATIC_LAST_SEGMENT),
        ]
        for line in range(1, 7)
    }

    # The small published route map supplies the unsampled city endpoints.
    # Intermediate vertices remain tied directly to ordered public detections.
    lines[7] = [(-4.881, -66.900), *[(lat, lon) for _, lat, lon in means[7]]]
    lines[8] = [
        linear_point(means[8], 1),
        *[(lat, lon) for _, lat, lon in means[8]],
        (-7.255, -64.795),
    ]
    lines[9] = [*[(lat, lon) for _, lat, lon in means[9]], (-9.974, -67.824)]
    lines[10] = [
        linear_point(means[10], 1),
        *[(lat, lon) for _, lat, lon in means[10]],
    ]
    return lines


def local_xy(point: tuple[float, float], latitude: float) -> tuple[float, float]:
    return (
        point[1] * 111.32 * math.cos(math.radians(latitude)),
        point[0] * 110.574,
    )


def latlon(point: tuple[float, float], latitude: float) -> list[float]:
    return [
        round(point[1] / 110.574, 6),
        round(point[0] / (111.32 * math.cos(math.radians(latitude))), 6),
    ]


def corridor_polygon(centreline: list[tuple[float, float]]) -> list[list[float]]:
    latitude = statistics.mean(point[0] for point in centreline)
    points = [local_xy(point, latitude) for point in centreline]
    left: list[tuple[float, float]] = []
    right: list[tuple[float, float]] = []
    for index, (x, y) in enumerate(points):
        previous = points[max(0, index - 1)]
        following = points[min(len(points) - 1, index + 1)]
        dx, dy = following[0] - previous[0], following[1] - previous[1]
        length = math.hypot(dx, dy)
        if length == 0:
            raise ValueError("Repeated centreline point")
        normal_x, normal_y = -dy / length, dx / length
        left.append(
            (
                x + normal_x * SWATH_HALF_WIDTH_KM,
                y + normal_y * SWATH_HALF_WIDTH_KM,
            )
        )
        right.append(
            (
                x - normal_x * SWATH_HALF_WIDTH_KM,
                y - normal_y * SWATH_HALF_WIDTH_KM,
            )
        )
    return [latlon(point, latitude) for point in [*left, *reversed(right)]]


def distance_to_segment_km(
    point: tuple[float, float],
    start: tuple[float, float],
    end: tuple[float, float],
) -> float:
    latitude = point[0]
    point_x, point_y = local_xy(point, latitude)
    start_x, start_y = local_xy(start, latitude)
    end_x, end_y = local_xy(end, latitude)
    delta_x, delta_y = end_x - start_x, end_y - start_y
    fraction = max(
        0.0,
        min(
            1.0,
            ((point_x - start_x) * delta_x + (point_y - start_y) * delta_y)
            / (delta_x * delta_x + delta_y * delta_y),
        ),
    )
    return math.hypot(
        point_x - (start_x + fraction * delta_x),
        point_y - (start_y + fraction * delta_y),
    )


def validate_source_fit(
    lines: dict[int, list[tuple[float, float]]],
    raw: dict[int, list[tuple[float, float]]],
) -> dict[int, float]:
    maximum_offsets: dict[int, float] = {}
    for line, points in raw.items():
        segments = list(zip(lines[line], lines[line][1:]))
        maximum_offsets[line] = max(
            min(distance_to_segment_km(point, start, end) for start, end in segments)
            for point in points
        )
        if maximum_offsets[line] > 1:
            raise ValueError(
                f"L{line:02d} reconstruction misses a published detection by "
                f"{maximum_offsets[line]:.2f} km"
            )
    return maximum_offsets


def main() -> None:
    with urllib.request.urlopen(SOURCE_URL) as response:
        source = response.read()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        raise ValueError("Supplementary DOCX checksum does not match the verified Nature file")

    means, raw = mean_points_by_segment(supplementary_rows(source))
    lines = centrelines(means)
    maximum_offsets = validate_source_fit(lines, raw)
    polygons = {line: corridor_polygon(points) for line, points in lines.items()}

    survey_document = json.loads(SURVEYS_PATH.read_text(encoding="utf-8"))
    surveys = survey_document["surveys"]
    footprint_document = json.loads(FOOTPRINTS_PATH.read_text(encoding="utf-8"))
    footprints = footprint_document["footprints"]

    for line in range(1, 11):
        current_ids = {OLD_IDS[line], line_id(line)}
        matches = [survey for survey in surveys if survey["id"] in current_ids]
        if len(matches) != 1:
            raise ValueError(f"Expected exactly one survey record for L{line:02d}")
        survey = matches[0]
        old_id = survey["id"]
        survey.update(
            {
                "id": line_id(line),
                "name": f"2024 Acre–Amazonas ALS line L{line:02d}",
                "region": REGIONS[line],
                "footprint_note": (
                    "Source-derived 1-km corridor reconstructed from Pärssinen et al. 2026 "
                    "Supplementary Table 2 line identifiers and Extended Data Fig. 1; not a "
                    "released aircraft GNSS track."
                ),
                "positions": polygons[line],
                "description": DESCRIPTIONS[line],
            }
        )

        footprint_matches = [
            footprint
            for footprint in footprints
            if footprint["id"] in {f"curated:{old_id}", f"curated:{line_id(line)}"}
        ]
        if len(footprint_matches) != 1:
            raise ValueError(f"Expected exactly one footprint record for L{line:02d}")
        footprint = footprint_matches[0]
        footprint.update(
            {
                "id": f"curated:{line_id(line)}",
                "survey_ids": [line_id(line)],
                "positions": polygons[line],
                "note": survey["footprint_note"],
            }
        )

    rebuilt_survey_ids = {line_id(line) for line in range(1, 11)}
    first_survey_index = min(
        index for index, survey in enumerate(surveys) if survey["id"] in rebuilt_survey_ids
    )
    rebuilt_surveys = sorted(
        (survey for survey in surveys if survey["id"] in rebuilt_survey_ids),
        key=lambda survey: survey["id"],
    )
    surveys[:] = [survey for survey in surveys if survey["id"] not in rebuilt_survey_ids]
    surveys[first_survey_index:first_survey_index] = rebuilt_surveys

    rebuilt_footprint_ids = {f"curated:{identifier}" for identifier in rebuilt_survey_ids}
    first_footprint_index = min(
        index
        for index, footprint in enumerate(footprints)
        if footprint["id"] in rebuilt_footprint_ids
    )
    rebuilt_footprints = sorted(
        (footprint for footprint in footprints if footprint["id"] in rebuilt_footprint_ids),
        key=lambda footprint: footprint["id"],
    )
    footprints[:] = [
        footprint for footprint in footprints if footprint["id"] not in rebuilt_footprint_ids
    ]
    footprints[first_footprint_index:first_footprint_index] = rebuilt_footprints

    SURVEYS_PATH.write_text(
        json.dumps(survey_document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    FOOTPRINTS_PATH.write_text(
        json.dumps(footprint_document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                f"L{line:02d}": {
                    "public_detections": len(raw[line]),
                    "max_source_offset_km": round(maximum_offsets[line], 3),
                }
                for line in range(1, 11)
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
