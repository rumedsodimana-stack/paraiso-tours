"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Compass, MapPinned, Route, ZoomIn } from "lucide-react";
import type { PlannerDestinationId } from "@/lib/route-planner";

type JourneyMapDestination = {
  id: PlannerDestinationId;
  name: string;
  shortName: string;
  region: string;
  coordinates: [number, number];
  isAirport: boolean;
  isPreview: boolean;
  isInRoute: boolean;
  isAddable: boolean;
  routeOrder: number | null;
};

type JourneyMapSegment = {
  id: string;
  coordinates: [number, number][];
};

type JourneyMapProps = {
  destinations: JourneyMapDestination[];
  routeSegments: JourneyMapSegment[];
  suggestionSegments: JourneyMapSegment[];
  previewDestinationId: PlannerDestinationId;
  previewDestinationName: string;
  previewDestinationRegion: string;
  currentAnchorName: string;
  totalStops: number;
  totalNights: number;
  onSelectDestination: (destinationId: PlannerDestinationId) => void;
};

type LineCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      id: string;
    };
    geometry: {
      type: "LineString";
      coordinates: [number, number][];
    };
  }>;
};

const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [
  [79.25, 5.55],
  [82.35, 10.15],
];

const BASE_MAP_STYLE: import("maplibre-gl").StyleSpecification = {
  version: 8,
  sources: {
    "osm-raster-tiles": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster-tiles",
    },
  ],
};

function buildLineCollection(segments: JourneyMapSegment[]): LineCollection {
  return {
    type: "FeatureCollection",
    features: segments.map((segment) => ({
      type: "Feature",
      properties: {
        id: segment.id,
      },
      geometry: {
        type: "LineString",
        coordinates: segment.coordinates,
      },
    })),
  };
}

export function JourneyMap({
  destinations,
  routeSegments,
  suggestionSegments,
  previewDestinationId,
  previewDestinationName,
  previewDestinationRegion,
  currentAnchorName,
  totalStops,
  totalNights,
  onSelectDestination,
}: JourneyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const markerRefs = useRef<import("maplibre-gl").Marker[]>([]);
  const mapModuleRef = useRef<typeof import("maplibre-gl") | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const handleSelectDestination = useEffectEvent(onSelectDestination);

  useEffect(() => {
    let disposed = false;

    async function loadMap() {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      const maplibregl = await import("maplibre-gl");
      if (disposed || !containerRef.current) {
        return;
      }

      mapModuleRef.current = maplibregl;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASE_MAP_STYLE,
        center: [80.7, 7.65],
        zoom: 7.1,
        minZoom: 6.5,
        maxZoom: 11.5,
        maxBounds: SRI_LANKA_BOUNDS,
        dragRotate: false,
        pitchWithRotate: false,
      });
      mapRef.current = map;

      map.addControl(
        new maplibregl.NavigationControl({
          showCompass: false,
          visualizePitch: false,
        }),
        "top-right"
      );
      map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");

      map.on("load", () => {
        if (disposed) {
          return;
        }

        map.addSource("journey-route-source", {
          type: "geojson",
          data: buildLineCollection([]),
        });
        map.addSource("journey-suggestion-source", {
          type: "geojson",
          data: buildLineCollection([]),
        });

        map.addLayer({
          id: "journey-suggestion-layer",
          type: "line",
          source: "journey-suggestion-source",
          paint: {
            "line-color": "#c89c64",
            "line-width": 3,
            "line-opacity": 0.72,
            "line-dasharray": [2, 2],
          },
        });

        map.addLayer({
          id: "journey-route-shadow-layer",
          type: "line",
          source: "journey-route-source",
          paint: {
            "line-color": "#f4e4c4",
            "line-width": 8,
            "line-opacity": 0.48,
          },
        });

        map.addLayer({
          id: "journey-route-layer",
          type: "line",
          source: "journey-route-source",
          paint: {
            "line-color": "#12343b",
            "line-width": 5,
            "line-opacity": 0.96,
          },
        });

        map.fitBounds(SRI_LANKA_BOUNDS, {
          duration: 0,
          padding: { top: 28, right: 28, bottom: 28, left: 28 },
        });

        setMapReady(true);
      });
    }

    void loadMap();

    return () => {
      disposed = true;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current) {
      return;
    }

    const routeSource = mapRef.current.getSource("journey-route-source") as
      | { setData: (data: unknown) => void }
      | undefined;
    const suggestionSource = mapRef.current.getSource("journey-suggestion-source") as
      | { setData: (data: unknown) => void }
      | undefined;

    routeSource?.setData(buildLineCollection(routeSegments));
    suggestionSource?.setData(buildLineCollection(suggestionSegments));
    mapRef.current.resize();
  }, [mapReady, routeSegments, suggestionSegments]);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !mapModuleRef.current) {
      return;
    }

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    for (const destination of destinations) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "journey-map-marker";
      button.dataset.state = destination.isAirport
        ? "airport"
        : destination.isPreview
          ? "preview"
          : destination.isInRoute
            ? "route"
            : destination.isAddable
              ? "suggested"
              : "browse";
      button.setAttribute("aria-label", destination.name);
      button.title = destination.name;

      if (destination.isAddable && !destination.isPreview) {
        const pulse = document.createElement("span");
        pulse.className = "journey-map-marker__pulse";
        button.appendChild(pulse);
      }

      const dot = document.createElement("span");
      dot.className = "journey-map-marker__dot";
      dot.textContent = destination.isAirport
        ? "A"
        : destination.routeOrder
          ? String(destination.routeOrder)
          : destination.isAddable
            ? "+"
            : "";
      button.appendChild(dot);

      if (destination.isPreview || destination.isAddable) {
        const label = document.createElement("span");
        label.className = "journey-map-marker__label";
        label.textContent = destination.shortName;
        button.appendChild(label);
      }

      button.addEventListener("click", () => handleSelectDestination(destination.id));

      const marker = new mapModuleRef.current.Marker({
        element: button,
        anchor: "center",
      })
        .setLngLat(destination.coordinates)
        .addTo(mapRef.current);

      markerRefs.current.push(marker);
    }

    mapRef.current.resize();
  }, [destinations, mapReady]);

  const previewDestination = destinations.find(
    (destination) => destination.id === previewDestinationId
  );

  return (
    <div className="relative overflow-hidden rounded-[1.8rem] border border-[#d8c4a8] bg-[#e6efe9]">
      <div
        ref={containerRef}
        className="journey-map-shell h-[30rem] w-full sm:h-[36rem] xl:h-[42rem]"
      />

      <div className="pointer-events-none absolute inset-x-4 top-4 flex flex-col gap-3 sm:inset-x-5 sm:top-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="pointer-events-auto max-w-sm rounded-[1.35rem] border border-white/55 bg-white/88 px-4 py-4 shadow-[0_18px_44px_-28px_rgba(18,52,59,0.6)] backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#8c6a38]">
                Selected on map
              </p>
              <h3 className="mt-2 text-lg font-semibold text-stone-900">
                {previewDestinationName}
              </h3>
              <p className="mt-1 text-sm text-stone-600">{previewDestinationRegion}</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#12343b] text-[#f6ead6]">
              <MapPinned className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600">
            Click any marker to inspect it, then use the builder steps to shape the trip.
          </p>
        </div>

        <div className="pointer-events-auto flex flex-wrap gap-3 lg:max-w-xs lg:justify-end">
          <div className="rounded-[1.1rem] border border-white/55 bg-white/88 px-4 py-3 shadow-[0_18px_44px_-28px_rgba(18,52,59,0.6)] backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8c6a38]">
              Route anchor
            </p>
            <p className="mt-2 font-semibold text-stone-900">{currentAnchorName}</p>
          </div>
          <div className="rounded-[1.1rem] border border-white/55 bg-white/88 px-4 py-3 shadow-[0_18px_44px_-28px_rgba(18,52,59,0.6)] backdrop-blur-md">
            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8c6a38]">
              Trip shape
            </p>
            <p className="mt-2 font-semibold text-stone-900">
              {totalStops} stop{totalStops === 1 ? "" : "s"} · {totalNights} nights
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex flex-col gap-3 sm:inset-x-5 sm:bottom-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="pointer-events-auto inline-flex flex-wrap gap-2 rounded-[1.2rem] border border-white/55 bg-white/88 px-3 py-3 shadow-[0_18px_44px_-28px_rgba(18,52,59,0.6)] backdrop-blur-md">
          {[
            { label: "Preview", state: "preview" },
            { label: "In route", state: "route" },
            { label: "Comfortable next", state: "suggested" },
            { label: "Browse", state: "browse" },
          ].map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-2 rounded-full bg-[#f8f4ed] px-3 py-1.5 text-xs font-medium text-stone-700"
            >
              <span className="journey-map-legend" data-state={item.state} />
              {item.label}
            </span>
          ))}
        </div>

        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-[1.1rem] border border-white/55 bg-white/88 px-4 py-3 text-sm text-stone-600 shadow-[0_18px_44px_-28px_rgba(18,52,59,0.6)] backdrop-blur-md">
          <ZoomIn className="h-4 w-4 text-[#12343b]" />
          Drag, zoom, and tap markers for a cleaner island view.
        </div>
      </div>

      {previewDestination ? (
        <div className="pointer-events-none absolute left-1/2 top-4 hidden -translate-x-1/2 xl:block">
          <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#ead8bc] bg-[#fff8ea]/92 px-4 py-2 text-sm font-medium text-stone-800 shadow-[0_18px_44px_-28px_rgba(18,52,59,0.55)] backdrop-blur-md">
            <Route className="h-4 w-4 text-[#12343b]" />
            {previewDestination.shortName}
            <span className="text-stone-400">·</span>
            <Compass className="h-4 w-4 text-[#8c6a38]" />
            {previewDestination.region}
          </div>
        </div>
      ) : null}
    </div>
  );
}
