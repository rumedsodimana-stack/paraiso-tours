"use client";

import { useEffect, useRef } from "react";
import type { TourRoutePoint } from "@/lib/tour-route-points";

// Leaflet is a client-only library — import inside useEffect to avoid SSR.
// We render into a plain div via the Leaflet JS API (simpler than react-leaflet
// wrapper for a read-only view and keeps bundle small).

export function TourMap({ points }: { points: TourRoutePoint[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (points.length === 0) return;

    let cleanup: (() => void) | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      // Leaflet's default icon paths break under bundlers. Rebind to CDN.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      // Inject Leaflet CSS once
      if (typeof document !== "undefined" && !document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!containerRef.current) return;
      // Prevent double-initialization on fast refresh
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((containerRef.current as any)._leaflet_id) return;

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const latLngs: [number, number][] = points.map((p) => [p.lat, p.lng]);

      points.forEach((p, i) => {
        const marker = L.marker([p.lat, p.lng]).addTo(map);
        const popup = [
          `<div style="font-weight:600;color:#11272b">${escape(p.name)}</div>`,
          p.dayLabel ? `<div style="font-size:11px;color:#8a9ba1">${escape(p.dayLabel)}</div>` : "",
          p.nights ? `<div style="font-size:11px;color:#5e7279">${p.nights} night${p.nights === 1 ? "" : "s"}</div>` : "",
          p.accommodation ? `<div style="font-size:11px;color:#5e7279">${escape(p.accommodation)}</div>` : "",
        ]
          .filter(Boolean)
          .join("");
        marker.bindPopup(popup);
        marker.bindTooltip(`${i + 1}. ${escape(p.name)}`, {
          permanent: false,
          direction: "top",
        });
      });

      if (latLngs.length >= 2) {
        L.polyline(latLngs, {
          color: "#12343b",
          weight: 3,
          opacity: 0.7,
          dashArray: "6 6",
        }).addTo(map);
      }

      if (latLngs.length === 1) {
        map.setView(latLngs[0], 9);
      } else {
        map.fitBounds(L.latLngBounds(latLngs), { padding: [32, 32] });
      }

      cleanup = () => {
        map.remove();
      };
    })();

    return () => {
      cleanup?.();
    };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#e0e4dd] bg-[#faf6ef] px-4 py-8 text-center text-sm text-[#5e7279]">
        No mappable destinations could be inferred for this booking.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[360px] w-full overflow-hidden rounded-2xl border border-[#e0e4dd] bg-[#eef4f4] print:hidden"
    />
  );
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}
