"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface RoutePoint {
  name: string;
  shortName: string;
  coordinates: [number, number]; // [lng, lat]
  dayNumbers: number[];
  isAirport?: boolean;
}

interface ReviewMapProps {
  points: RoutePoint[];
}

const SRI_LANKA_CENTER: [number, number] = [80.7, 7.85];
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function ReviewMap({ points }: ReviewMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [TILE_URL],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: SRI_LANKA_CENTER,
      zoom: 7,
      attributionControl: false,
      interactive: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      if (points.length === 0) return;

      // Draw route line
      if (points.length >= 2) {
        const coords = points.map((p) => p.coordinates);
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        });

        // Route shadow
        map.addLayer({
          id: "route-shadow",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#12343b",
            "line-width": 6,
            "line-opacity": 0.15,
            "line-blur": 4,
          },
        });

        // Route line
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#12343b",
            "line-width": 3,
            "line-opacity": 0.8,
          },
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
        });

        // Route dots
        map.addLayer({
          id: "route-dots",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#efd5aa",
            "line-width": 1.5,
            "line-dasharray": [0, 2],
            "line-opacity": 0.6,
          },
        });
      }

      // Add markers
      for (const point of points) {
        const el = document.createElement("div");
        el.style.cssText = `
          display:flex; align-items:center; justify-content:center;
          width:${point.isAirport ? "28px" : "32px"};
          height:${point.isAirport ? "28px" : "32px"};
          border-radius:${point.isAirport ? "50%" : "10px"};
          background:${point.isAirport ? "#0f5965" : "#12343b"};
          color:#f7ead7; font-size:11px; font-weight:700;
          border:2px solid #f7ead7;
          box-shadow:0 2px 8px rgba(18,52,59,0.4);
          cursor:default;
        `;
        el.textContent = point.isAirport ? "✈" : point.dayNumbers.join(",");

        const popup = new maplibregl.Popup({
          offset: 16,
          closeButton: false,
          className: "review-map-popup",
        }).setHTML(`
          <div style="padding:6px 10px;font-family:system-ui,sans-serif;">
            <div style="font-weight:700;font-size:13px;color:#12343b;">${point.name}</div>
            <div style="font-size:11px;color:#666;margin-top:2px;">
              ${point.isAirport ? "Arrival / Departure" : `Day${point.dayNumbers.length > 1 ? "s" : ""} ${point.dayNumbers.join(", ")}`}
            </div>
          </div>
        `);

        new maplibregl.Marker({ element: el })
          .setLngLat(point.coordinates)
          .setPopup(popup)
          .addTo(map);
      }

      // Fit bounds
      if (points.length >= 2) {
        const bounds = new maplibregl.LngLatBounds();
        for (const p of points) bounds.extend(p.coordinates);
        map.fitBounds(bounds, { padding: 50, maxZoom: 10 });
      } else if (points.length === 1) {
        map.flyTo({ center: points[0].coordinates, zoom: 9 });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  return (
    <div
      ref={containerRef}
      className="h-[280px] w-full overflow-hidden rounded-xl border border-[#ddc8b0] sm:h-[340px]"
    />
  );
}
