"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  type CircleMarker as LeafletCircleMarker,
  divIcon,
  type DivIcon,
  type Polygon as LeafletPolygon,
} from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Rectangle,
  ScaleControl,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  type AtlasAncientFeatureCell,
  type AtlasLidarFootprint,
  type AtlasLidarGeometryProvenance,
  type AtlasLidarReviewClass,
  type AtlasPlace,
  type AtlasLidarSurvey,
  type LocationStatus,
  lidarReviewClassForSurveys,
  locationStatusFor,
} from "@/lib/atlas-types";

type ExcavationMapProps = {
  digs: AtlasPlace[];
  ancientFeatureCells: readonly AtlasAncientFeatureCell[];
  lidarSurveys: readonly AtlasLidarSurvey[];
  lidarFootprints: readonly AtlasLidarFootprint[];
  showAncientFeatures: boolean;
  showLidar: boolean;
  selected: AtlasPlace | null;
  selectedLidarFootprintIds: readonly string[];
  selectedAncientFeatureId: string | null;
  focusBounds: [[number, number], [number, number]] | null;
  onSelect: (dig: AtlasPlace) => void;
  onSelectLidar: (surveys: AtlasLidarSurvey[], footprints: AtlasLidarFootprint[]) => void;
  onSelectAncientFeature: (cell: AtlasAncientFeatureCell) => void;
};

const lidarStyles: Record<
  AtlasLidarReviewClass,
  { color: string; opacity: number; weight: number }
> = {
  reviewed: { color: "#176d73", opacity: 0.88, weight: 2.2 },
  partial: { color: "#ad7927", opacity: 0.86, weight: 2 },
  unreviewed: { color: "#62666a", opacity: 0.8, weight: 1.8 },
};

const lidarProvenanceStyles: Record<
  AtlasLidarGeometryProvenance,
  { dashArray?: string; fillOpacity: number }
> = {
  released: { fillOpacity: 0.09 },
  "published-map": { dashArray: "7 5", fillOpacity: 0.05 },
  reconstructed: { dashArray: "7 5", fillOpacity: 0.05 },
  context: { dashArray: "1 7", fillOpacity: 0 },
};

const lidarLayerOrder: Record<AtlasLidarReviewClass, number> = {
  unreviewed: 0,
  partial: 1,
  reviewed: 2,
};

const lidarProvenanceOrder: Record<AtlasLidarGeometryProvenance, number> = {
  context: 0,
  reconstructed: 1,
  "published-map": 2,
  released: 3,
};

const osmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function makeIcon(status: LocationStatus, selected: boolean, count = 1): DivIcon {
  return divIcon({
    className: "dig-marker-wrap",
    html: `<span class="dig-marker location-${status}${selected ? " is-selected" : ""}"><span></span>${count > 1 ? `<b class="marker-count" aria-label="${count} records">${count}</b>` : ""}</span>`,
    iconSize: selected ? [34, 34] : [26, 26],
    iconAnchor: selected ? [17, 17] : [13, 13],
  });
}

function MapViewport({
  selected,
  focusBounds,
}: {
  selected: AtlasPlace | null;
  focusBounds: [[number, number], [number, number]] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selected) return;
    const targetZoom = selected.uncertaintyKm >= 40 ? 7 : selected.uncertaintyKm >= 20 ? 8 : 9;
    map.flyTo([selected.lat, selected.lon], targetZoom, {
      duration: 0.75,
    });
  }, [map, selected]);

  useEffect(() => {
    if (!focusBounds) return;
    map.fitBounds(focusBounds, {
      animate: true,
      duration: 0.75,
      maxZoom: 12,
      padding: [32, 32],
    });
  }, [focusBounds, map]);
  return null;
}

function polygonContainsPoint(
  point: [number, number],
  polygon: readonly [number, number][],
): boolean {
  const [pointLat, pointLon] = point;
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [lat, lon] = polygon[index];
    const [previousLat, previousLon] = polygon[previous];
    const crossesLatitude = (lat > pointLat) !== (previousLat > pointLat);
    const crossingLongitude =
      ((previousLon - lon) * (pointLat - lat)) / (previousLat - lat) + lon;

    if (crossesLatitude && pointLon < crossingLongitude) inside = !inside;
  }

  return inside;
}

function polygonCenter(polygon: readonly [number, number][]): [number, number] {
  const [latitudeTotal, longitudeTotal] = polygon.reduce(
    ([latitude, longitude], [nextLatitude, nextLongitude]) => [
      latitude + nextLatitude,
      longitude + nextLongitude,
    ],
    [0, 0],
  );
  return [latitudeTotal / polygon.length, longitudeTotal / polygon.length];
}

function lidarSelectionAtPoint(
  selectedFootprint: AtlasLidarFootprint,
  allFootprints: readonly AtlasLidarFootprint[],
  allSurveys: readonly AtlasLidarSurvey[],
  point: [number, number],
): { surveys: AtlasLidarSurvey[]; footprints: AtlasLidarFootprint[] } {
  const footprints = allFootprints.filter(
    (candidate) =>
      candidate.id === selectedFootprint.id || polygonContainsPoint(point, candidate.positions),
  );
  const surveyIds = new Set(footprints.flatMap((footprint) => footprint.surveyIds));
  return {
    footprints,
    surveys: allSurveys.filter((survey) => surveyIds.has(survey.id)),
  };
}

function SelectableLidarPolygon({
  footprint,
  surveys,
  allFootprints,
  allSurveys,
  selected,
  onSelect,
}: {
  footprint: AtlasLidarFootprint;
  surveys: readonly AtlasLidarSurvey[];
  allFootprints: readonly AtlasLidarFootprint[];
  allSurveys: readonly AtlasLidarSurvey[];
  selected: boolean;
  onSelect: (surveys: AtlasLidarSurvey[], footprints: AtlasLidarFootprint[]) => void;
}) {
  const layerRef = useRef<LeafletPolygon | null>(null);
  const primarySurvey = surveys[0];
  const review = lidarReviewClassForSurveys(surveys);
  const style = lidarStyles[review];
  const provenanceStyle = lidarProvenanceStyles[footprint.provenance];

  useEffect(() => {
    const element = layerRef.current?.getElement();
    if (!element) return;

    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    element.setAttribute(
      "aria-label",
      `${primarySurvey.year} ${primarySurvey.name}, ${primarySurvey.region}, ${primarySurvey.country}. ${review} archaeological review. ${footprint.provenance} acquisition geometry. Open LiDAR study details.`,
    );
    element.setAttribute("aria-pressed", String(selected));

    function selectWithKeyboard(event: Event) {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const selection = lidarSelectionAtPoint(
        footprint,
        allFootprints,
        allSurveys,
        polygonCenter(footprint.positions),
      );
      onSelect(selection.surveys, selection.footprints);
    }

    element.addEventListener("keydown", selectWithKeyboard);
    return () => element.removeEventListener("keydown", selectWithKeyboard);
  }, [allFootprints, allSurveys, footprint, onSelect, primarySurvey, review, selected]);

  function selectAtPoint(point: [number, number]) {
    const selection = lidarSelectionAtPoint(footprint, allFootprints, allSurveys, point);
    onSelect(selection.surveys, selection.footprints);
  }

  return (
    <Polygon
      ref={layerRef}
      positions={footprint.positions}
      eventHandlers={{
        click: (event) => selectAtPoint([event.latlng.lat, event.latlng.lng]),
      }}
      pathOptions={{
        className: `lidar-footprint lidar-review-${review} lidar-provenance-${footprint.provenance}`,
        color: style.color,
        dashArray: provenanceStyle.dashArray,
        fillColor: style.color,
        fillOpacity:
          selected && provenanceStyle.fillOpacity > 0
            ? Math.max(provenanceStyle.fillOpacity, 0.16)
            : provenanceStyle.fillOpacity,
        opacity: selected ? 1 : style.opacity,
        weight: selected ? style.weight + 1.2 : style.weight,
      }}
    />
  );
}

function SelectableAncientFeatureRectangle({
  cell,
  selected,
  zoom,
  onSelect,
}: {
  cell: AtlasAncientFeatureCell;
  selected: boolean;
  zoom: number;
  onSelect: (cell: AtlasAncientFeatureCell) => void;
}) {
  const hitTargetRef = useRef<LeafletCircleMarker | null>(null);
  const center: [number, number] = [
    (cell.bounds[0][0] + cell.bounds[1][0]) / 2,
    (cell.bounds[0][1] + cell.bounds[1][1]) / 2,
  ];
  const showLocator = zoom < 9 || selected;
  const locatorRadius = selected ? 6 : 3.5;

  useEffect(() => {
    const element = hitTargetRef.current?.getElement();
    if (!element) return;

    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "button");
    element.setAttribute(
      "aria-label",
      `${cell.region}. Ancient human-made features: ${cell.featureTypes.join(", ")}. Open evidence details.`,
    );
    element.setAttribute("aria-pressed", String(selected));

    function selectWithKeyboard(event: Event) {
      if (!(event instanceof KeyboardEvent)) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      onSelect(cell);
    }

    element.addEventListener("keydown", selectWithKeyboard);
    return () => element.removeEventListener("keydown", selectWithKeyboard);
  }, [cell, onSelect, selected]);

  return (
    <>
      <Rectangle
        bounds={cell.bounds}
        interactive={false}
        pathOptions={{
          className: "ancient-feature-evidence-cell",
          color: "#9f4b2f",
          fillColor: "#b85332",
          fillOpacity: selected ? 0.34 : 0.18,
          opacity: selected ? 0.95 : 0.5,
          weight: selected ? 2.4 : 1,
        }}
      />
      <CircleMarker
        ref={hitTargetRef}
        center={center}
        radius={showLocator ? locatorRadius : 7}
        eventHandlers={{ click: () => onSelect(cell) }}
        pathOptions={{
          className: `ancient-feature-hit-target${showLocator ? " ancient-feature-overview-locator" : ""}${selected ? " is-selected" : ""}`,
          color: selected ? "#fffaf2" : "transparent",
          fillColor: "#b83f29",
          fillOpacity: showLocator ? (selected ? 1 : 0.58) : 0,
          opacity: selected ? 1 : 0,
          weight: selected ? 2.2 : 0,
        }}
      />
    </>
  );
}

function AncientFeatureLayer({
  cells,
  selectedId,
  onSelect,
}: {
  cells: readonly AtlasAncientFeatureCell[];
  selectedId: string | null;
  onSelect: (cell: AtlasAncientFeatureCell) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  return cells.map((cell) => (
    <SelectableAncientFeatureRectangle
      key={cell.id}
      cell={cell}
      selected={cell.id === selectedId}
      zoom={zoom}
      onSelect={onSelect}
    />
  ));
}

export default function ExcavationMap({
  digs,
  ancientFeatureCells,
  lidarSurveys,
  lidarFootprints,
  showAncientFeatures,
  showLidar,
  selected,
  selectedLidarFootprintIds,
  selectedAncientFeatureId,
  focusBounds,
  onSelect,
  onSelectLidar,
  onSelectAncientFeature,
}: ExcavationMapProps) {
  const markerGroups = useMemo(() => {
    const groups = new Map<string, AtlasPlace[]>();

    for (const dig of digs) {
      const key = `${dig.lat}:${dig.lon}`;
      const group = groups.get(key);
      if (group) group.push(dig);
      else groups.set(key, [dig]);
    }

    return [...groups.values()];
  }, [digs]);
  const surveyById = useMemo(
    () => new Map(lidarSurveys.map((survey) => [survey.id, survey])),
    [lidarSurveys],
  );
  const orderedLidarFootprints = useMemo(
    () => [...lidarFootprints].sort((left, right) => {
      const provenanceDifference =
        lidarProvenanceOrder[left.provenance] - lidarProvenanceOrder[right.provenance];
      if (provenanceDifference) return provenanceDifference;
      const leftSurveys = left.surveyIds
        .map((id) => surveyById.get(id))
        .filter((survey): survey is AtlasLidarSurvey => Boolean(survey));
      const rightSurveys = right.surveyIds
        .map((id) => surveyById.get(id))
        .filter((survey): survey is AtlasLidarSurvey => Boolean(survey));
      return lidarLayerOrder[lidarReviewClassForSurveys(leftSurveys)] -
        lidarLayerOrder[lidarReviewClassForSurveys(rightSurveys)];
    }),
    [lidarFootprints, surveyById],
  );
  return (
    <>
      <MapContainer
        className="leaflet-atlas"
        center={[-4.8, -63.5]}
        zoom={4}
        minZoom={3}
        maxZoom={15}
        maxBounds={[
          [-21.0, -84.0],
          [12.0, -42.0],
        ]}
        zoomControl={false}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png"
          attribution={`${osmAttribution} &copy; <a href="https://carto.com/attributions">CARTO</a>`}
          className="basemap-positron"
          opacity={0.82}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}@2x.png"
          attribution=""
          className="basemap-positron-labels"
          opacity={0.56}
        />
        <ZoomControl position="bottomright" />
        <ScaleControl position="bottomleft" imperial={false} />
        <MapViewport selected={selected} focusBounds={focusBounds} />
        {showLidar
          ? orderedLidarFootprints.map((footprint) => {
              const surveys = footprint.surveyIds
                .map((id) => surveyById.get(id))
                .filter((survey): survey is AtlasLidarSurvey => Boolean(survey));
              if (!surveys.length) return null;
              return (
              <SelectableLidarPolygon
                key={footprint.id}
                footprint={footprint}
                surveys={surveys}
                allFootprints={lidarFootprints}
                allSurveys={lidarSurveys}
                selected={selectedLidarFootprintIds.includes(footprint.id)}
                onSelect={onSelectLidar}
              />
              );
            })
          : null}
        {showAncientFeatures ? (
          <AncientFeatureLayer
            cells={ancientFeatureCells}
            selectedId={selectedAncientFeatureId}
            onSelect={onSelectAncientFeature}
          />
        ) : null}
        {digs.map((dig) => (
          <Circle
            key={`uncertainty:${dig.id}`}
            center={[dig.lat, dig.lon]}
            radius={dig.uncertaintyKm * 1000}
            interactive={false}
            pathOptions={{
              color: dig.id === selected?.id ? "#9f4b2f" : "#8b6e55",
              fillColor: dig.id === selected?.id ? "#c76b48" : "#b89b7e",
              fillOpacity: dig.id === selected?.id ? 0.13 : 0.035,
              opacity: dig.id === selected?.id ? 0.7 : 0.22,
              weight: dig.id === selected?.id ? 2 : 1,
            }}
          />
        ))}
        {markerGroups.map((colocatedDigs) => {
          const selectedIndex = colocatedDigs.findIndex((dig) => dig.id === selected?.id);
          const isSelected = selectedIndex >= 0;
          const activeDig = isSelected ? colocatedDigs[selectedIndex] : colocatedDigs[0];
          const hasAlternates = colocatedDigs.length > 1;
          const locationStatus = locationStatusFor(activeDig.coordinateMethod);
          const markerIcon = makeIcon(locationStatus, isSelected, colocatedDigs.length);

          function selectNextDig() {
            if (!hasAlternates || selectedIndex < 0) {
              onSelect(activeDig);
              return;
            }
            onSelect(colocatedDigs[(selectedIndex + 1) % colocatedDigs.length]);
          }

          return (
            <Marker
              key={colocatedDigs.map((dig) => dig.id).join(":")}
              position={[activeDig.lat, activeDig.lon]}
              icon={markerIcon}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{ click: selectNextDig }}
            />
          );
        })}
      </MapContainer>
      <div className="lidar-review-key" aria-label="Archaeological review legend">
        <strong>Archaeological review</strong>
        <span>
          <i className="lidar-review-line review-reviewed" aria-hidden="true" />
          Systematic review completed
        </span>
        <span>
          <i className="lidar-review-line review-partial" aria-hidden="true" />
          Partial or ongoing review
        </span>
        <span>
          <i className="lidar-review-line review-unreviewed" aria-hidden="true" />
          No published review found
        </span>
        <strong className="survey-coverage-heading">Footprint source</strong>
        <span>
          <i className="survey-coverage-swatch provenance-released" aria-hidden="true" />
          Released acquisition GIS
        </span>
        <span>
          <i className="survey-coverage-swatch provenance-derived" aria-hidden="true" />
          Reconstructed from source
        </span>
      </div>
    </>
  );
}
