#!/usr/bin/env python3
"""Build the atlas LiDAR footprint layer from released GIS and published maps.

Run with:
  uv run --with pyshp --with pyproj --with shapely \
    python tools/build_amazon_lidar_footprints.py

The output separates acquisition geometry from study metadata. Released GIS is
kept distinct from figure digitization, inferred corridors, and context-only
regions so the atlas never implies more positional certainty than the source.
"""

from __future__ import annotations

import json
import tempfile
import urllib.request
import zipfile
from math import atan2
from pathlib import Path
from xml.etree import ElementTree as ET

import shapefile
from pyproj import CRS, Transformer
from shapely import affinity
from shapely.geometry import Point, Polygon, shape
from shapely.ops import transform


ROOT = Path(__file__).resolve().parents[1]
SURVEYS_PATH = ROOT / "_data" / "acre-lidar-surveys.json"
OUTPUT_PATH = ROOT / "_data" / "amazon-lidar-footprints.json"

EBA_URL = "https://zenodo.org/records/4968706/files/L3A_transects_v20210616.zip"
EBA_SOURCE = "https://zenodo.org/records/4968706"
TAPAJOS_URL = (
    "https://data.ornldaac.earthdata.nasa.gov/public/global_vegetation/"
    "Forested_Areas_Para_Brazil/comp/TAP_A_footprints.kmz"
)
TAPAJOS_SOURCE = "https://doi.org/10.3334/ORNLDAAC/1514"
GUIANA_WFS = (
    "https://datacarto.geoguyane.fr/wfs/e96c1df8-34e4-4b55-a21d-2ecb7d780751"
    "?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms%3Alidar_synthese_onf973"
)
GUIANA_SOURCE = (
    "https://catalogue.geoguyane.fr/geosource/"
    "panierDownloadFrontalParametrage?LAYERIDTS=92260"
)

COLOMBIA_PIXELS = [
    [[849.1,207.4],[826.3,199.0],[827.5,195.6],[850.4,204.0]],
    [[862.9,238.5],[858.9,214.2],[862.4,213.6],[866.5,237.9]],
    [[842.1,242.9],[839.3,240.6],[855.1,221.2],[857.9,223.6]],
    [[776.9,251.8],[773.5,250.3],[783.7,227.4],[787.0,228.9]],
    [[937.8,279.3],[934.2,278.9],[936.8,249.7],[940.5,250.0]],
    [[783.5,292.5],[781.0,290.0],[798.0,273.0],[800.5,275.5]],
    [[818.5,302.5],[815.0,301.8],[819.7,278.3],[823.2,279.0]],
    [[887.3,332.7],[876.7,308.6],[880.0,307.1],[890.6,331.3]],
    [[976.2,317.7],[952.6,310.2],[953.6,306.9],[977.2,314.4]],
    [[761.0,343.1],[759.8,318.0],[763.6,317.8],[764.8,343.0]],
    [[912.4,348.8],[911.0,346.0],[939.0,332.0],[940.4,334.8]],
    [[847.5,361.2],[844.6,360.0],[853.8,336.9],[856.8,338.1]],
    [[881.5,367.2],[878.9,365.1],[895.1,345.3],[897.7,347.4]],
    [[944.5,381.5],[935.3,353.9],[938.6,352.8],[947.8,380.4]],
    [[759.8,373.6],[758.4,370.8],[780.0,360.0],[781.4,362.8]],
    [[838.5,406.8],[818.5,390.6],[820.7,387.9],[840.7,404.1]],
    [[926.0,398.0],[897.0,398.0],[897.0,393.0],[926.0,393.0]],
    [[935.0,416.9],[932.0,415.5],[942.7,392.4],[945.6,393.8]],
    [[1028.4,438.2],[1026.1,413.2],[1029.4,412.9],[1031.6,437.9]],
    [[966.8,443.6],[963.5,442.5],[971.9,417.3],[975.2,418.4]],
    [[860.9,438.1],[859.5,435.0],[884.1,424.1],[885.5,427.2]],
    [[771.1,451.4],[767.6,451.0],[770.7,426.7],[774.1,427.1]],
    [[1098.9,443.1],[1068.9,441.8],[1069.0,438.3],[1099.1,439.6]],
    [[978.3,467.3],[975.5,465.1],[991.8,444.1],[994.7,446.3]],
    [[897.1,456.4],[896.1,453.0],[922.8,445.3],[923.8,448.8]],
    [[1096.0,472.3],[1068.0,471.1],[1068.1,468.0],[1096.1,469.2]],
    [[1046.8,505.6],[1043.5,504.5],[1051.7,479.9],[1055.0,481.0]],
    [[859.5,491.3],[858.8,488.0],[884.6,482.4],[885.4,485.7]],
    [[1120.4,537.2],[1119.3,533.9],[1162.7,520.0],[1163.7,523.3]],
    [[1057.2,570.4],[1055.4,567.2],[1083.1,551.4],[1084.9,554.6]],
    [[1049.0,591.4],[1046.7,588.6],[1066.4,572.1],[1068.7,574.9]],
    [[1078.1,614.9],[1075.4,612.6],[1099.4,584.6],[1102.1,586.9]],
]

MADRE_DE_DIOS_PIXELS = [
    [[332.8,154.1],[282.0,95.9],[292.3,86.9],[343.0,145.1]],
    [[385.3,153.9],[383.4,144.0],[426.4,135.7],[428.3,145.6]],
    [[250.9,143.9],[160.2,130.1],[162.3,116.2],[253.0,130.0]],
    [[220.6,267.8],[219.8,253.8],[300.6,249.2],[301.4,263.2]],
    [[389.2,388.0],[384.0,379.9],[476.0,321.7],[481.2,329.9]],
    [[273.5,420.7],[256.5,348.0],[269.8,344.9],[286.8,417.6]],
    [[231.4,455.0],[229.5,401.2],[339.3,397.1],[341.3,451.0]],
    [[329.0,429.0],[320.0,429.0],[320.0,414.0],[329.0,414.0]],
    [[456.5,479.2],[382.0,461.6],[385.2,447.8],[459.8,465.3]],
    [[492.6,503.5],[443.6,415.2],[457.0,407.8],[506.0,496.1]],
    [[406.8,571.9],[396.3,562.7],[449.7,501.9],[460.2,511.1]],
    [[533.0,563.0],[499.0,563.0],[499.0,523.0],[533.0,523.0]],
    [[540.1,516.7],[537.1,510.0],[608.7,477.9],[611.7,484.5]],
]

MADRE_DE_DIOS_AREAS_KM2 = [
    124.82,
    31.31,
    132.40,
    132.15,
    97.94,
    88.86,
    86.39,
    187.88,
    89.56,
    30.32,
    80.92,
    128.83,
    42.83,
]

AMAZONIA_REVELADA_AREAS_KM2 = {
    "2026-amazonia-revelada-acre-001": 52.05,
    "2026-amazonia-revelada-acre-003": 25.91,
    "2026-amazonia-revelada-acre-004": 24.28,
    "2026-amazonia-revelada-acre-005": 25.78,
    "2026-amazonia-revelada-terra-do-meio-005-006": 84.56,
}


def download(url: str, destination: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": "Amazon-Archaeology-Atlas/1.0"})
    with urllib.request.urlopen(request) as response, destination.open("wb") as output:
        output.write(response.read())


def latlon_ring(geometry: Polygon, digits: int = 5) -> list[list[float]]:
    return [[round(y, digits), round(x, digits)] for x, y in list(geometry.exterior.coords)[:-1]]


def projected_polygon(positions: list[list[float]]) -> tuple[Polygon, Transformer, Transformer]:
    latitude = sum(point[0] for point in positions) / len(positions)
    longitude = sum(point[1] for point in positions) / len(positions)
    local = CRS.from_proj4(
        f"+proj=laea +lat_0={latitude} +lon_0={longitude} +datum=WGS84 +units=m +no_defs"
    )
    forward = Transformer.from_crs(4326, local, always_xy=True)
    inverse = Transformer.from_crs(local, 4326, always_xy=True)
    polygon = transform(forward.transform, Polygon([(lon, lat) for lat, lon in positions]))
    return polygon, forward, inverse


def area_km2(positions: list[list[float]]) -> float:
    polygon, _, _ = projected_polygon(positions)
    return polygon.area / 1_000_000


def normalize_area(
    positions: list[list[float]], target_km2: float, *, preserve_centerline: bool = False
) -> list[list[float]]:
    """Match reported area without moving a digitized footprint's center."""
    polygon, _, inverse = projected_polygon(positions)
    if polygon.area <= 0:
        raise ValueError("Cannot normalize a zero-area footprint")
    area_factor = target_km2 * 1_000_000 / polygon.area

    if preserve_centerline:
        corners = list(polygon.exterior.coords)
        edges = [
            (corners[index + 1][0] - corners[index][0], corners[index + 1][1] - corners[index][1])
            for index in range(len(corners) - 1)
        ]
        longest = max(edges, key=lambda edge: edge[0] ** 2 + edge[1] ** 2)
        angle = atan2(longest[1], longest[0])
        rotated = affinity.rotate(polygon, -angle, origin="centroid", use_radians=True)
        normalized = affinity.rotate(
            affinity.scale(rotated, xfact=1, yfact=area_factor, origin="centroid"),
            angle,
            origin="centroid",
            use_radians=True,
        )
    else:
        factor = area_factor**0.5
        normalized = affinity.scale(polygon, xfact=factor, yfact=factor, origin="centroid")

    return latlon_ring(transform(inverse.transform, normalized), 6)


def record(
    identifier: str,
    survey_ids: list[str],
    positions: list[list[float]],
    provenance: str,
    source_label: str,
    source_url: str | None,
    note: str,
) -> dict[str, object]:
    return {
        "id": identifier,
        "survey_ids": survey_ids,
        "positions": positions,
        "provenance": provenance,
        "source_label": source_label,
        "source_url": source_url,
        "note": note,
    }


def eba_footprints(work: Path) -> list[dict[str, object]]:
    archive = work / "eba.zip"
    download(EBA_URL, archive)
    with zipfile.ZipFile(archive) as zipped:
        zipped.extractall(work / "eba")
    shp = next((work / "eba").glob("*.shp"))
    reader = shapefile.Reader(str(shp))
    source_crs = CRS.from_wkt(shp.with_suffix(".prj").read_text())
    to_wgs84 = Transformer.from_crs(source_crs, 4326, always_xy=True).transform
    footprints: list[dict[str, object]] = []

    for item in reader.iterShapeRecords():
        attributes = item.record.as_dict()
        projected = shape(item.shape.__geo_interface__).simplify(25, preserve_topology=True)
        geometries = list(projected.geoms) if projected.geom_type == "MultiPolygon" else [projected]
        for part_index, polygon in enumerate(geometries):
            geographic = transform(to_wgs84, polygon)
            footprints.append(
                record(
                    f"eba:{attributes['transect']}:{part_index}",
                    ["2016-2018-eba-brazil-transects"],
                    latlon_ring(geographic),
                    "released",
                    "EBA L3A transect archive",
                    EBA_SOURCE,
                    "Released polygon part from one of 901 EBA L3A acquisition records; this is scanned ground coverage, not an aircraft GPS trajectory.",
                )
            )
    return footprints


def tapajos_footprints(work: Path) -> list[dict[str, object]]:
    archive = work / "tapajos.kmz"
    download(TAPAJOS_URL, archive)
    with zipfile.ZipFile(archive) as zipped:
        root = ET.fromstring(zipped.read(zipped.namelist()[0]))
    namespace = {"kml": "http://www.opengis.net/kml/2.2"}
    footprints: list[dict[str, object]] = []
    for index, placemark in enumerate(root.findall(".//kml:Placemark", namespace), start=1):
        values = {
            node.attrib.get("name", ""): node.text or ""
            for node in placemark.findall(".//kml:SimpleData", namespace)
        }
        coordinates = placemark.findtext(".//kml:coordinates", namespaces=namespace)
        if not coordinates:
            continue
        points = [(float(item.split(",")[0]), float(item.split(",")[1])) for item in coordinates.split()]
        polygon = Polygon(points).simplify(0.00002, preserve_topology=True)
        footprints.append(
            record(
                f"tapajos:{values.get('LAS') or index}",
                ["2018-tapajos-national-forest"],
                latlon_ring(polygon, 6),
                "released",
                "ORNL DAAC TAP_A footprint archive",
                TAPAJOS_SOURCE,
                "Released LiDAR tile footprint from TAP_A_footprints.kmz.",
            )
        )
    return footprints


def guiana_footprints(work: Path) -> list[dict[str, object]]:
    source = work / "guiana.gml"
    download(GUIANA_WFS, source)
    root = ET.parse(source).getroot()
    namespace = {
        "wfs": "http://www.opengis.net/wfs/2.0",
        "gml": "http://www.opengis.net/gml/3.2",
    }
    to_wgs84 = Transformer.from_crs(2972, 4326, always_xy=True).transform
    footprints: list[dict[str, object]] = []
    for member in root.findall(".//wfs:member", namespace):
        feature = list(member)[0]
        feature_id = feature.attrib.get("{http://www.opengis.net/gml/3.2}id", "unknown")
        for part_index, position_list in enumerate(
            feature.findall(".//gml:exterior//gml:posList", namespace)
        ):
            ordinates = [float(value) for value in (position_list.text or "").split()]
            projected = Polygon(
                [(ordinates[index], ordinates[index + 1]) for index in range(0, len(ordinates), 2)]
            ).simplify(25, preserve_topology=True)
            geographic = transform(to_wgs84, projected)
            survey_ids = ["onf-guyane-acquisition-archive"]
            published_study_sites = [
                Point(-52.0863977, 4.0572038),  # MC87
                Point(-52.6713032, 4.0790943),  # Nouragues
            ]
            if any(geographic.covers(site) for site in published_study_sites):
                survey_ids.append("2024-nouragues-crowned-mountains")
            footprints.append(
                record(
                    f"onf-guyane:{feature_id.rsplit('.', 1)[-1]}:{part_index}",
                    survey_ids,
                    latlon_ring(geographic),
                    "released",
                    "GéoGuyane ONF LiDAR acquisition synthesis",
                    GUIANA_SOURCE,
                    "Released ONF acquisition extent from the public GéoGuyane WFS; this is a ground footprint, not a flight trajectory.",
                )
            )
    return footprints


def pixel_polygons(
    polygons: list[list[list[float]]],
    x_bounds: tuple[float, float, float, float],
    y_bounds: tuple[float, float, float, float],
) -> list[list[list[float]]]:
    x0, lon0, x1, lon1 = x_bounds
    y0, lat0, y1, lat1 = y_bounds
    return [
        [
            [
                round(lat0 + (y - y0) * (lat1 - lat0) / (y1 - y0), 5),
                round(lon0 + (x - x0) * (lon1 - lon0) / (x1 - x0), 5),
            ]
            for x, y in polygon
        ]
        for polygon in polygons
    ]


def published_map_footprints() -> list[dict[str, object]]:
    footprints: list[dict[str, object]] = []

    # Figure 2 in Iriarte et al. 2020 has graticules at 15-minute intervals.
    mound_pixels = [
        [[892,285],[917,272],[953,367],[926,379]],
        [[476,684],[515,684],[515,730],[476,730]],
        [[491,685],[535,644],[544,651],[502,698]],
    ]
    mound_polygons = pixel_polygons(
        mound_pixels,
        (410, -67.75, 1080, -67.0),
        (292, -9.75, 965, -10.5),
    )
    mound_names = ["Dona Maria", "Estrela do Norte", "Dois Círculos"]
    mound_areas = [42.9, 9.81, 12.9]
    for index, (name, polygon, target_area) in enumerate(
        zip(mound_names, mound_polygons, mound_areas), start=1
    ):
        polygon = normalize_area(polygon, target_area, preserve_centerline=True)
        footprints.append(
            record(
                f"mound-villages:{index}",
                ["2020-mound-village-transects"],
                polygon,
                "published-map",
                "Iriarte et al. 2020, fig. 2",
                "https://doi.org/10.5334/jcaa.45",
                f"{name} acquisition polygon digitized from the published graticule map and normalized to the paper's reported {target_area:g} km² mission area; no flight-centerline file was released.",
            )
        )

    # Grey scan blocks A-F in Prümers et al. 2022 figure 1, georeferenced by its UTM grid.
    casarabe_pixels = [
        [[595,146],[640,146],[640,164],[595,164]],
        [[621,182],[635,182],[635,231],[621,231]],
        [[603,440],[660,440],[660,501],[603,501]],
        [[711,514],[740,514],[740,534],[711,534]],
        [[548,571],[663,571],[663,611],[548,611]],
        [[725,748],[748,748],[748,791],[725,791]],
    ]
    to_wgs84 = Transformer.from_crs(32720, 4326, always_xy=True)
    casarabe_polygons = []
    for pixel_polygon in casarabe_pixels:
        utm = [
            (
                300000 + (x - 434) * 50000 / (790 - 434),
                8400000 - (y - 189) * 50000 / (548 - 189),
            )
            for x, y in pixel_polygon
        ]
        casarabe_polygons.append(
            [[round(lat, 5), round(lon, 5)] for lon, lat in map(to_wgs84.transform, *zip(*utm))]
        )
    casarabe_area_factor = 204 / sum(area_km2(polygon) for polygon in casarabe_polygons)
    for index, polygon in enumerate(casarabe_polygons):
        polygon = normalize_area(polygon, area_km2(polygon) * casarabe_area_factor)
        footprints.append(
            record(
                f"casarabe:{chr(65 + index)}",
                ["2022-casarabe-llanos-de-mojos"],
                polygon,
                "published-map",
                "Prümers et al. 2022, fig. 1",
                "https://www.nature.com/articles/s41586-022-04780-4",
                f"Scan block {chr(65 + index)} digitized against the published UTM grid; the six blocks are normalized together to the paper's reported 204 km² coverage.",
            )
        )

    upano = [
        [-1.98,-78.22],[-1.98,-78.06],[-2.06,-78.04],[-2.06,-78.01],
        [-2.18,-78.01],[-2.18,-78.03],[-2.35,-78.03],[-2.35,-78.16],
        [-2.30,-78.18],[-2.30,-78.21],[-2.20,-78.21],[-2.20,-78.19],
        [-2.11,-78.19],[-2.11,-78.22],
    ]
    upano = normalize_area(upano, 600)
    footprints.append(
        record(
            "upano:published-600-km2-boundary",
            ["2024-upano-valley"],
            upano,
            "published-map",
            "Rostain et al. 2024, fig. 1",
            "https://archimer.ifremer.fr/doc/00872/98412/118237.pdf",
            "The irregular acquisition boundary was reconstructed from the published regional map and normalized to the reported 600 km² survey area; it is not an aircraft trajectory.",
        )
    )

    colombia = pixel_polygons(
        COLOMBIA_PIXELS,
        (707, -75.0, 1198, -65.5),
        (156, 4.2, 644, -4.8),
    )
    colombia_subset_target = 4656.22 * len(colombia) / 38
    colombia_area_factor = colombia_subset_target / sum(
        area_km2(polygon) for polygon in colombia
    )
    for index, polygon in enumerate(colombia, start=1):
        polygon = normalize_area(
            polygon,
            area_km2(polygon) * colombia_area_factor,
            preserve_centerline=True,
        )
        footprints.append(
            record(
                f"colombia-carbon:{index:02d}",
                ["2011-colombia-ecological-als"],
                polygon,
                "published-map",
                "Asner et al. 2012, fig. 1",
                "https://bg.copernicus.org/articles/9/2683/2012/",
                "One of 32 unobscured flight blocks digitized from the published overview. Strip centerlines follow the map; cross-track widths are normalized proportionally to the paper's 465,622 ha total for 38 blocks. Six blocks cannot be resolved independently in the figure.",
            )
        )

    madre = pixel_polygons(
        MADRE_DE_DIOS_PIXELS,
        (0, -72.3, 683, -67.0),
        (0, -9.4, 795, -13.8),
    )
    for index, (polygon, target_area) in enumerate(
        zip(madre, MADRE_DE_DIOS_AREAS_KM2), start=1
    ):
        polygon = normalize_area(
            polygon,
            target_area,
            preserve_centerline=index not in {8, 12},
        )
        footprints.append(
            record(
                f"madre-de-dios:{index:02d}",
                ["2009-madre-de-dios-ecological-als"],
                polygon,
                "published-map",
                "Marvin et al. 2013, fig. 1",
                "https://doi.org/10.1371/journal.pone.0060875",
                f"One of 13 2009 CAO blocks digitized from the published regional figure and normalized to block {index}'s {target_area:g} km² area in Table 1; it is a documented subset of the broader archive.",
            )
        )

    return footprints


def contextual_footprints(surveys: list[dict[str, object]]) -> list[dict[str, object]]:
    provenance_by_id = {
        **{
            survey["id"]: "reconstructed"
            for survey in surveys
            if str(survey["id"]).startswith("2026-acre-amazonas-als-")
        },
        "2026-amazonia-revelada-acre-001": "reconstructed",
        "2026-amazonia-revelada-acre-003": "reconstructed",
        "2026-amazonia-revelada-acre-004": "reconstructed",
        "2026-amazonia-revelada-acre-005": "reconstructed",
        "2026-amazonia-revelada-terra-do-meio-005-006": "reconstructed",
        "2024-amazonia-revelada-guapore": "context",
        "2019-rio-abiseo-gran-pajaten": "context",
        "2020-kuelap-drone-lidar": "context",
    }
    footprints: list[dict[str, object]] = []
    for survey in surveys:
        identifier = str(survey["id"])
        provenance = provenance_by_id.get(identifier)
        if not provenance:
            continue
        source_url = survey.get("source_url")
        positions = survey["positions"]
        target_area = AMAZONIA_REVELADA_AREAS_KM2.get(identifier)
        if target_area is not None:
            positions = normalize_area(positions, target_area)
        footprints.append(
            record(
                f"curated:{identifier}",
                [identifier],
                positions,
                provenance,
                str(survey["source_label"]),
                str(source_url) if source_url else None,
                str(survey["footprint_note"]),
            )
        )
    return footprints


def validate(footprints: list[dict[str, object]], survey_ids: set[str]) -> None:
    ids: set[str] = set()
    allowed = {"released", "published-map", "reconstructed", "context"}
    for footprint in footprints:
        identifier = str(footprint["id"])
        if identifier in ids:
            raise ValueError(f"Duplicate footprint id: {identifier}")
        ids.add(identifier)
        if footprint["provenance"] not in allowed:
            raise ValueError(f"Invalid provenance on {identifier}")
        if not set(footprint["survey_ids"]).issubset(survey_ids):
            raise ValueError(f"Unknown survey id on {identifier}: {footprint['survey_ids']}")
        positions = footprint["positions"]
        if not isinstance(positions, list) or len(positions) < 3:
            raise ValueError(f"Invalid polygon on {identifier}")
        for latitude, longitude in positions:
            if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
                raise ValueError(f"Out-of-range coordinate on {identifier}")


def main() -> None:
    survey_document = json.loads(SURVEYS_PATH.read_text())
    surveys = survey_document["surveys"]
    survey_ids = {str(survey["id"]) for survey in surveys}
    with tempfile.TemporaryDirectory(prefix="amazon-lidar-footprints-") as temporary:
        work = Path(temporary)
        footprints = [
            *eba_footprints(work),
            *tapajos_footprints(work),
            *guiana_footprints(work),
            *published_map_footprints(),
            *contextual_footprints(surveys),
        ]
    validate(footprints, survey_ids)
    provenance_counts = {
        provenance: sum(footprint["provenance"] == provenance for footprint in footprints)
        for provenance in ["released", "published-map", "reconstructed", "context"]
    }
    output = {
        "schema_version": 1,
        "coordinate_policy": (
            "Polygons map public acquisition geography, never protected archaeological-site coordinates. "
            "Released GIS, published-map digitization, inferred reconstruction, and contextual geography "
            "remain visibly distinct. No polygon is presented as a literal aircraft GNSS trajectory."
        ),
        "provenance_counts": provenance_counts,
        "footprints": footprints,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(footprints):,} footprints to {OUTPUT_PATH}")
    print(json.dumps(provenance_counts, indent=2))


if __name__ == "__main__":
    main()
