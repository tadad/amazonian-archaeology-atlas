from __future__ import annotations

import importlib.util
import json
import math
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def frontmatter_value(record: Path, key: str) -> str:
    prefix = f"{key}:"
    for line in record.read_text(encoding="utf-8").splitlines():
        if line.startswith(prefix):
            return line.removeprefix(prefix).strip().strip('"')
    return ""


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class AcreGraphTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.builder = load_module("build_acre_graph", ROOT / "tools" / "build_acre_graph.py")
        cls.audit_module = load_module("audit_vault_graph", ROOT / "tools" / "audit_vault_graph.py")

    def test_registry_ids_resolve(self) -> None:
        self.builder.validate()

    def test_manifest_matches_generated_counts(self) -> None:
        manifest = json.loads((ROOT / "_data" / "acre-graph-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["counts"]["papers"], len(list((ROOT / "vault" / "Papers").glob("*.md"))))
        self.assertEqual(manifest["counts"]["places"], len(list((ROOT / "vault" / "Places").glob("*.md"))))

    def test_graph_has_no_unresolved_typed_links(self) -> None:
        result = self.audit_module.audit(ROOT / "vault")
        self.assertEqual([], result["unresolved_typed_links"])
        self.assertEqual(1, result["component_count"])

    def test_aquiry_is_marked_as_interpretive(self) -> None:
        note = (ROOT / "vault" / "Cultures" / "aquiry-interpretive-model.md").read_text(encoding="utf-8")
        self.assertIn("not as a demonstrated single ethnicity", note)

    def test_place_schema_matches_el_salvador_coordinate_contract(self) -> None:
        required = {
            "coordinate_precision_label:",
            "coordinate_precision_short_label:",
            "coordinate_precision_description:",
        }
        template = (ROOT / "vault" / "Templates" / "Place.md").read_text(encoding="utf-8")
        record = (ROOT / "vault" / "Places" / "acre-geoglyph-landscape.md").read_text(encoding="utf-8")
        for field in required:
            self.assertIn(field, template)
            self.assertIn(field, record)

    def test_culture_bibliographies_are_explicitly_scoped(self) -> None:
        mound = (ROOT / "vault" / "Cultures" / "acre-mound-village-tradition.md").read_text(encoding="utf-8")
        self.assertIn("2021-iriarte-et-al-mound-village-chronology", mound)
        self.assertNotIn("1988-dias-carvalho-estruturas-terra-acre", mound)

    def test_restricted_source_pdfs_are_not_linked_from_vault(self) -> None:
        paper = (ROOT / "vault" / "Papers" / "2017-watling-impact-geoglyph-builders.md").read_text(encoding="utf-8")
        self.assertIn('access_status: "local-pdf-restricted"', paper)
        self.assertIn("\npdf:\n", paper)
        self.assertNotIn("Attachments/PDFs", paper)

    def test_public_coordinates_require_generalized_public_policy(self) -> None:
        for record in (ROOT / "vault" / "Places").glob("*.md"):
            latitude = frontmatter_value(record, "latitude")
            longitude = frontmatter_value(record, "longitude")
            has_coordinate = bool(latitude or longitude)
            approved = (
                frontmatter_value(record, "coordinate_precision") == "regional-centroid"
                and frontmatter_value(record, "location_visibility") == "public-generalized"
            )

            if has_coordinate:
                self.assertTrue(approved, record)
            if approved:
                float(latitude)
                float(longitude)
            else:
                self.assertEqual("withheld", frontmatter_value(record, "location_visibility"), record)

    def test_all_curated_places_have_coarse_public_map_placements(self) -> None:
        records = list((ROOT / "vault" / "Places").glob("*.md"))
        self.assertEqual(24, len(records))
        for record in records:
            self.assertEqual("regional-centroid", frontmatter_value(record, "coordinate_precision"), record)
            self.assertEqual("public-generalized", frontmatter_value(record, "location_visibility"), record)
            self.assertGreaterEqual(float(frontmatter_value(record, "coordinate_uncertainty_km")), 8, record)

    def test_atlas_markers_require_site_specific_fieldwork(self) -> None:
        expected = {
            "boa-esperanca-mound-village",
            "caboquinho",
            "dos-circulos-iv",
            "dos-circulos-v",
            "espinhara",
            "fazenda-atlantica",
            "jaco-sa",
            "quinaua",
            "sol-de-campinas",
            "tequinho",
            "tocantins-mound-village",
            "tres-vertentes",
            "vila-pia-earthworks",
        }
        mapped = {
            record.stem
            for record in (ROOT / "vault" / "Places").glob("*.md")
            if frontmatter_value(record, "atlas") == "true"
        }

        self.assertEqual(expected, mapped)
        for place_id in mapped:
            record = ROOT / "vault" / "Places" / f"{place_id}.md"
            self.assertTrue(frontmatter_value(record, "atlas_basis"), record)

    def test_lidar_papers_and_protected_discovery_cluster_are_in_graph(self) -> None:
        for paper_id in (
            "2017-khan-aragao-iriarte-uav-lidar-system",
            "2023-peripato-et-al-hidden-earthworks",
        ):
            self.assertTrue((ROOT / "vault" / "Papers" / f"{paper_id}.md").is_file())

        cluster = (ROOT / "vault" / "Places" / "ace-01-10-lidar-discoveries.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("2023-peripato-et-al-hidden-earthworks", cluster)
        self.assertIn('coordinate_uncertainty_km: 35', cluster)
        self.assertIn("one protected research cluster", cluster)

    def test_public_lidar_layer_separates_studies_from_footprints(self) -> None:
        layer = json.loads((ROOT / "_data" / "acre-lidar-surveys.json").read_text(encoding="utf-8"))
        self.assertEqual(4, layer["schema_version"])
        paper_ids = {survey["paper_id"] for survey in layer["surveys"]}
        acquisition_purposes = {survey["acquisition_purpose"] for survey in layer["surveys"]}
        review_statuses = {survey["archaeology_review_status"] for survey in layer["surveys"]}
        coverage_modes = {survey["coverage_mode"] for survey in layer["surveys"]}
        countries = {survey["country"] for survey in layer["surveys"]}
        self.assertIn("2017-khan-aragao-iriarte-uav-lidar-system", paper_ids)
        self.assertIn("2023-peripato-et-al-hidden-earthworks", paper_ids)
        self.assertFalse(any(survey["kind"] == "low-evidence" for survey in layer["surveys"]))
        self.assertEqual({"archaeology", "other"}, acquisition_purposes)
        self.assertEqual(
            {"systematic", "partial", "ongoing", "none-found"}, review_statuses
        )
        self.assertEqual({"continuous", "corridor", "distributed", "context"}, coverage_modes)
        usable = [survey for survey in layer["surveys"] if survey["archaeology_usable"]]
        self.assertEqual(35, len(usable))
        self.assertEqual(
            {"archaeology": 22, "other": 13},
            {
                purpose: sum(survey["acquisition_purpose"] == purpose for survey in usable)
                for purpose in acquisition_purposes
            },
        )
        self.assertEqual(
            {"systematic": 23, "partial": 4, "ongoing": 6, "none-found": 2},
            {
                status: sum(survey["archaeology_review_status"] == status for survey in usable)
                for status in review_statuses
            },
        )
        self.assertTrue(
            {"Brazil", "Bolivia", "Colombia", "Ecuador", "French Guiana", "Guyana", "Peru"}
            <= countries
        )

        footprint_layer = json.loads(
            (ROOT / "_data" / "amazon-lidar-footprints.json").read_text(encoding="utf-8")
        )
        self.assertEqual(1, footprint_layer["schema_version"])
        self.assertEqual(
            {"released": 1091, "published-map": 55, "reconstructed": 15, "context": 3},
            footprint_layer["provenance_counts"],
        )
        self.assertEqual(1164, len(footprint_layer["footprints"]))
        survey_ids = {survey["id"] for survey in layer["surveys"]}
        footprint_ids = set()
        for footprint in footprint_layer["footprints"]:
            self.assertNotIn(footprint["id"], footprint_ids)
            footprint_ids.add(footprint["id"])
            self.assertGreaterEqual(len(footprint["positions"]), 3)
            self.assertTrue(set(footprint["survey_ids"]) <= survey_ids)
            self.assertIn(
                footprint["provenance"],
                {"released", "published-map", "reconstructed", "context"},
            )
            self.assertTrue(footprint["source_label"])
            self.assertTrue(
                footprint["source_url"] is None
                or footprint["source_url"].startswith("https://")
            )
            self.assertTrue(footprint["note"])

        self.assertEqual(
            1002,
            sum(footprint["id"].startswith("eba:") for footprint in footprint_layer["footprints"]),
        )
        self.assertEqual(
            10,
            sum(footprint["id"].startswith("tapajos:") for footprint in footprint_layer["footprints"]),
        )
        self.assertEqual(
            79,
            sum(footprint["id"].startswith("onf-guyane:") for footprint in footprint_layer["footprints"]),
        )
        self.assertEqual(
            32,
            sum(footprint["id"].startswith("colombia-carbon:") for footprint in footprint_layer["footprints"]),
        )
        self.assertIn("never protected archaeological-site coordinates", layer["coordinate_policy"])
        for survey in layer["surveys"]:
            self.assertGreaterEqual(len(survey["positions"]), 3)
            self.assertNotIn("latitude", survey)
            self.assertNotIn("longitude", survey)
            self.assertTrue(survey["region"])
            self.assertTrue(survey["source_label"])
            self.assertTrue(survey["footprint_note"])
            self.assertIn(
                survey["coverage_mode"],
                {"continuous", "corridor", "distributed", "context"},
            )
            self.assertTrue(
                survey["source_url"] is None or survey["source_url"].startswith("https://")
            )
            self.assertTrue(
                survey["terrain_resolution_m"] is None
                or survey["terrain_resolution_m"] > 0
            )
            self.assertTrue(
                survey["point_density_m2"] is None or survey["point_density_m2"] > 0
            )
            self.assertTrue(survey["resolution_basis"])
            self.assertIsInstance(survey["archaeology_usable"], bool)
            self.assertTrue(survey["archaeology_review_scope"])
            self.assertTrue(
                survey["archaeology_review_fraction"] is None
                or 0 <= survey["archaeology_review_fraction"] <= 1
            )
            self.assertTrue(
                survey["archaeology_review_url"] is None
                or survey["archaeology_review_url"].startswith("https://")
            )

        by_id = {survey["id"]: survey for survey in layer["surveys"]}
        self.assertEqual(0.5, by_id["2022-casarabe-llanos-de-mojos"]["terrain_resolution_m"])
        self.assertEqual(1, by_id["2024-upano-valley"]["terrain_resolution_m"])
        self.assertEqual(
            0.5,
            by_id["2026-acre-amazonas-als-line-01"]["terrain_resolution_m"],
        )
        self.assertEqual(
            31.2,
            by_id["2026-acre-amazonas-als-line-01"]["point_density_m2"],
        )
        self.assertEqual(1, by_id["2009-madre-de-dios-ecological-als"]["terrain_resolution_m"])
        self.assertEqual(1, by_id["2016-2018-eba-brazil-transects"]["terrain_resolution_m"])
        self.assertEqual(4, by_id["2016-2018-eba-brazil-transects"]["point_density_m2"])
        self.assertEqual("other", by_id["2009-madre-de-dios-ecological-als"]["acquisition_purpose"])
        self.assertEqual("archaeology", by_id["2022-casarabe-llanos-de-mojos"]["acquisition_purpose"])
        self.assertTrue(by_id["2023-ace-discoveries"]["archaeology_usable"])
        self.assertFalse(by_id["2017-uav-lidar-prototype"]["archaeology_usable"])
        self.assertFalse(by_id["2022-guyana-base-mapping"]["archaeology_usable"])
        self.assertFalse(by_id["2024-la-lindosa-terrestrial-lidar"]["archaeology_usable"])
        self.assertNotIn("2021-eba-public-lidar-archive", by_id)
        self.assertIsNone(by_id["2020-kuelap-drone-lidar"]["terrain_resolution_m"])
        self.assertEqual(2000, by_id["2020-kuelap-drone-lidar"]["point_density_m2"])
        self.assertEqual("distributed", by_id["2022-casarabe-llanos-de-mojos"]["coverage_mode"])
        self.assertEqual("context", by_id["2024-upano-valley"]["coverage_mode"])
        self.assertEqual("distributed", by_id["2009-madre-de-dios-ecological-als"]["coverage_mode"])
        self.assertTrue(
            all(
                by_id[f"2026-acre-amazonas-als-line-{index:02d}"]["coverage_mode"]
                == "corridor"
                for index in range(1, 11)
            )
        )

    def test_digitized_lidar_footprints_match_source_reported_areas(self) -> None:
        footprints = json.loads(
            (ROOT / "_data" / "amazon-lidar-footprints.json").read_text(encoding="utf-8")
        )["footprints"]

        def area_km2(positions):
            latitude_origin = math.radians(
                sum(point[0] for point in positions) / len(positions)
            )
            semi_major_km = 6378.137
            eccentricity_squared = 0.00669437999014
            denominator = math.sqrt(
                1 - eccentricity_squared * math.sin(latitude_origin) ** 2
            )
            prime_vertical_radius = semi_major_km / denominator
            meridional_radius = (
                semi_major_km
                * (1 - eccentricity_squared)
                / denominator**3
            )
            projected = [
                (
                    prime_vertical_radius
                    * math.radians(longitude)
                    * math.cos(latitude_origin),
                    meridional_radius * math.radians(latitude),
                )
                for latitude, longitude in positions
            ]
            return abs(
                sum(
                    x1 * y2 - x2 * y1
                    for (x1, y1), (x2, y2) in zip(projected, projected[1:] + projected[:1])
                )
            ) / 2

        def group_area(prefix):
            return sum(
                area_km2(footprint["positions"])
                for footprint in footprints
                if footprint["id"].startswith(prefix)
            )

        self.assertAlmostEqual(65.61, group_area("mound-villages:"), delta=0.1)
        self.assertAlmostEqual(204, group_area("casarabe:"), delta=0.2)
        self.assertAlmostEqual(600, group_area("upano:"), delta=0.5)
        self.assertAlmostEqual(4656.22 * 32 / 38, group_area("colombia-carbon:"), delta=1)
        self.assertAlmostEqual(1254.21, group_area("madre-de-dios:"), delta=1)

        by_id = {footprint["id"]: footprint for footprint in footprints}
        expected_amazonia_revelada = {
            "curated:2026-amazonia-revelada-acre-001": 52.05,
            "curated:2026-amazonia-revelada-acre-003": 25.91,
            "curated:2026-amazonia-revelada-acre-004": 24.28,
            "curated:2026-amazonia-revelada-acre-005": 25.78,
            "curated:2026-amazonia-revelada-terra-do-meio-005-006": 84.56,
        }
        for footprint_id, expected_area in expected_amazonia_revelada.items():
            self.assertAlmostEqual(
                expected_area,
                area_km2(by_id[footprint_id]["positions"]),
                delta=0.1,
            )

        crowned_mountain_footprints = {
            footprint["id"]
            for footprint in footprints
            if "2024-nouragues-crowned-mountains" in footprint["survey_ids"]
        }
        self.assertEqual(
            {"onf-guyane:21:0", "onf-guyane:33:0"},
            crowned_mountain_footprints,
        )

    def test_2024_als_corridors_use_source_line_ids_and_cover_l08_detection(self) -> None:
        surveys = json.loads(
            (ROOT / "_data" / "acre-lidar-surveys.json").read_text(encoding="utf-8")
        )["surveys"]
        by_id = {survey["id"]: survey for survey in surveys}
        expected_ids = {
            f"2026-acre-amazonas-als-line-{line:02d}" for line in range(1, 11)
        }
        self.assertTrue(expected_ids <= set(by_id))
        self.assertFalse(
            any(survey_id.startswith("2026-acre-amazonas-als-parallel-") for survey_id in by_id)
        )

        def point_in_polygon(point, polygon):
            latitude, longitude = point
            inside = False
            for index, current in enumerate(polygon):
                previous = polygon[index - 1]
                current_latitude, current_longitude = current
                previous_latitude, previous_longitude = previous
                if (current_latitude > latitude) != (previous_latitude > latitude):
                    crossing_longitude = (
                        (previous_longitude - current_longitude)
                        * (latitude - current_latitude)
                        / (previous_latitude - current_latitude)
                        + current_longitude
                    )
                    if longitude < crossing_longitude:
                        inside = not inside
            return inside

        self.assertTrue(
            point_in_polygon(
                (-7.845, -66.795),
                by_id["2026-acre-amazonas-als-line-08"]["positions"],
            )
        )

        footprints = json.loads(
            (ROOT / "_data" / "amazon-lidar-footprints.json").read_text(encoding="utf-8")
        )["footprints"]
        footprint_ids = {footprint["id"] for footprint in footprints}
        self.assertTrue({f"curated:{survey_id}" for survey_id in expected_ids} <= footprint_ids)

    def test_pan_amazon_ancient_feature_layer_is_binary_and_generalized(self) -> None:
        layer = json.loads(
            (ROOT / "_data" / "amazon-ancient-feature-evidence.json").read_text(encoding="utf-8")
        )
        self.assertIn("not exact sites", layer["coordinate_policy"])
        self.assertIn("Rock art, stone architecture, and modern infrastructure are excluded", layer["coordinate_policy"])
        self.assertEqual(44, len(layer["cells"]))
        ids = {cell["id"] for cell in layer["cells"]}
        self.assertTrue(
            {
                "upper-xingu-earthworks",
                "casarabe-cotoca",
                "casarabe-landivar",
                "upano-sangay",
                "french-guiana-nouragues",
            }
            <= ids
        )
        self.assertTrue(
            {
                "calcoene-megalithic-circle",
                "monte-alegre-rock-art",
                "la-lindosa-cerro-azul-montoya",
                "la-lindosa-limoncillos",
                "kuelap-monumental-complex",
            }.isdisjoint(ids)
        )
        for cell in layer["cells"]:
            self.assertTrue(
                {"id", "bounds", "source_id", "feature_types", "discovery_methods"}
                <= set(cell)
            )
            self.assertEqual(2, len(cell["bounds"]))
            self.assertTrue(cell["feature_types"])
            self.assertTrue(cell["discovery_methods"])
            south_west, north_east = cell["bounds"]
            self.assertIn(round(north_east[0] - south_west[0], 6), {0.01, 0.02})
            self.assertIn(round(north_east[1] - south_west[1], 6), {0.01, 0.02})

        by_id = {cell["id"]: cell for cell in layer["cells"]}
        self.assertIn("Fig. 1", by_id["upano-sangay"]["context_note"])
        self.assertEqual(
            [[-14.99, -64.6], [-14.98, -64.59]],
            by_id["casarabe-cotoca"]["bounds"],
        )
        self.assertEqual(
            [[-15.21, -64.47], [-15.2, -64.46]],
            by_id["casarabe-landivar"]["bounds"],
        )
        self.assertEqual(
            [[-11.87, -53.68], [-11.86, -53.67]],
            by_id["upper-xingu-earthworks"]["bounds"],
        )
        self.assertEqual(
            [[0.06, -52.86], [0.07, -52.85]],
            by_id["amapa-jari-earthworks"]["bounds"],
        )
        self.assertEqual(
            [[0.88, -51.6], [0.89, -51.59]],
            by_id["amapa-ferreira-gomes-earthworks"]["bounds"],
        )
        self.assertEqual(
            [[2.91, -51.68], [2.92, -51.67]],
            by_id["amapa-oiapoque-earthworks"]["bounds"],
        )
        self.assertEqual(
            [[-3.26, -58.02], [-3.25, -58.01]],
            by_id["boa-vista-do-ramos-earthworks"]["bounds"],
        )
        self.assertTrue(
            {
                "upper-purus-amazonas",
                "amazonia-revelada-middle-guapore",
                "amazonia-revelada-terra-do-meio",
                "amazonia-revelada-marajo",
            }.isdisjoint(ids)
        )

    def test_archaeological_review_classes_are_independent_map_controls(self) -> None:
        explorer = (ROOT / "app" / "src" / "components" / "atlas-explorer.tsx").read_text(
            encoding="utf-8"
        )
        map_component = (
            ROOT / "app" / "src" / "components" / "excavation-map.tsx"
        ).read_text(encoding="utf-8")
        self.assertIn("type AtlasLidarReviewClass", explorer)
        self.assertIn('label: "Reviewed"', explorer)
        self.assertIn('label: "Partial"', explorer)
        self.assertIn('label: "No review"', explorer)
        self.assertNotIn('type="range"', explorer)
        self.assertNotIn("lidarResolutionClasses", explorer)
        self.assertNotIn("LiDAR coverage</span>", explorer)
        self.assertNotIn("purpose-filter", explorer)
        self.assertNotIn("Filter archaeological sites", explorer)
        self.assertNotIn("LiDAR evidence", explorer)
        self.assertNotIn("lidar-legend", map_component)
        self.assertIn("Archaeological review legend", map_component)
        self.assertIn("Systematic review completed", map_component)
        self.assertIn("Partial or ongoing review", map_component)
        self.assertIn("No published review found", map_component)
        self.assertIn("Footprint source", map_component)
        self.assertIn("Released acquisition GIS", map_component)
        self.assertIn("Reconstructed from source", map_component)
        self.assertNotIn("Digitized published map", map_component)
        self.assertNotIn("Context only · not coverage", map_component)
        self.assertIn('reviewed: { color: "#176d73"', map_component)
        self.assertIn('partial: { color: "#ad7927"', map_component)
        self.assertIn('unreviewed: { color: "#62666a"', map_component)
        self.assertIn('footprint.provenance !== "context"', explorer)
        self.assertIn("<span>Earthworks</span>", explorer)
        self.assertNotIn("<span>Ancient works</span>", explorer)

    def test_earthworks_keep_a_visible_locator_at_overview_zoom(self) -> None:
        map_component = (
            ROOT / "app" / "src" / "components" / "excavation-map.tsx"
        ).read_text(encoding="utf-8")
        basemap_styles = (ROOT / "app" / "src" / "app" / "basemap.css").read_text(
            encoding="utf-8"
        )
        self.assertIn("zoom < 9 || selected", map_component)
        self.assertIn("ancient-feature-overview-locator", map_component)
        self.assertIn('fillOpacity: showLocator ? (selected ? 1 : 0.58)', map_component)
        self.assertIn('color: selected ? "#fffaf2" : "transparent"', map_component)
        self.assertIn(".ancient-feature-overview-locator", basemap_styles)
        self.assertIn(".ancient-feature-hit-target:focus-visible", basemap_styles)

    def test_lidar_sidebar_uses_minimal_structured_display(self) -> None:
        explorer = (ROOT / "app" / "src" / "components" / "atlas-explorer.tsx").read_text(
            encoding="utf-8"
        )
        self.assertIn('className="research-data"', explorer)
        self.assertIn("<dt>Review status</dt>", explorer)
        self.assertIn("<dt>Reviewed share</dt>", explorer)
        self.assertIn("<dt>Review scope</dt>", explorer)
        self.assertIn("<dt>Purpose</dt>", explorer)
        self.assertIn("<dt>Terrain grid</dt>", explorer)
        self.assertIn("<dt>Footprint source</dt>", explorer)
        self.assertIn("Relevant links", explorer)
        self.assertNotIn("Selected acquisition", explorer)
        self.assertNotIn("Acquisition geometry with source provenance", explorer)
        self.assertNotIn("representative.resolutionBasis", explorer)
        self.assertNotIn("survey.footprintNote", explorer)
        self.assertNotIn('className="lidar-study-metrics"', explorer)

    def test_northern_and_central_research_zones_are_in_graph(self) -> None:
        expected = {
            "bujari-porto-acre-earthwork-corridor": "Bujari-Porto Acre",
            "sena-madureira-iaco-geoglyph-zone": "Sena Madureira-Iaco",
            "manoel-urbano-upper-purus-frontier": "Manoel Urbano-Upper Purus",
        }
        for place_id, label in expected.items():
            record = (ROOT / "vault" / "Places" / f"{place_id}.md").read_text(encoding="utf-8")
            self.assertIn(label, record)
            self.assertIn("2026-parssinen-et-al-over-20000-earthworks", record)
            self.assertIn('coordinate_precision: "regional-centroid"', record)
            self.assertIn('location_visibility: "public-generalized"', record)

    def test_public_amazon_inventory_layer_is_complete_and_generalized(self) -> None:
        inventory = json.loads(
            (ROOT / "_data" / "amazon-earthwork-inventory.json").read_text(encoding="utf-8")
        )
        self.assertEqual(961, inventory["peripato_records"])
        self.assertEqual(1279, inventory["kalliola_records"])
        self.assertEqual(756, inventory["peripato_cells"])
        self.assertEqual(940, inventory["kalliola_cells"])
        self.assertEqual(429, inventory["overlapping_cells"])
        self.assertEqual(1267, inventory["displayed_cells"])
        self.assertEqual(1267, len(inventory["cells"]))
        self.assertEqual(0.01, inventory["grid_degrees"])
        for cell in inventory["cells"]:
            self.assertEqual(
                {
                    "id",
                    "bounds",
                    "peripato_records",
                    "kalliola_records",
                    "source_id",
                    "source_label",
                    "source_url",
                },
                set(cell),
            )
            self.assertGreater(cell["peripato_records"] + cell["kalliola_records"], 0)
            south_west, north_east = cell["bounds"]
            self.assertAlmostEqual(0.01, north_east[0] - south_west[0])
            self.assertAlmostEqual(0.01, north_east[1] - south_west[1])


if __name__ == "__main__":
    unittest.main()
