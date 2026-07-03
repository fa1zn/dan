"use client";

import { useEffect, useRef } from "react";

/**
 * Visual territory map. Plots the area's dealers (pipeline vs not-yet-contacted) as numbered
 * pins in the route order Dan already computed, and drops a live "you are here" dot from the
 * rep's device location so the map moves as they drive. Leaflet + OpenStreetMap tiles, loaded
 * from CDN so the worktree needs no extra package.
 */

export interface MapPinData {
  id: number;
  name: string;
  oem: string | null;
  lat: number | null;
  lng: number | null;
  inPipeline: boolean;
  order: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L?: any;
  }
}

function ensureLeaflet(): Promise<Window["L"]> {
  return new Promise((resolve) => {
    if (window.L) return resolve(window.L);
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      return;
    }
    const s = document.createElement("script");
    s.id = "leaflet-js";
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve(window.L);
    document.body.appendChild(s);
  });
}

export interface MapAppointment {
  title: string | null;
  time: string; // preformatted, e.g. "10:30 AM"
  lat: number;
  lng: number;
}

export function TerritoryMap({ pins, appointments = [] }: { pins: MapPinData[]; appointments?: MapAppointment[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const geo = pins.filter((p) => p.lat != null && p.lng != null);
    if (!ref.current || geo.length === 0) return;
    let cancelled = false;
    let watchId: number | undefined;

    ensureLeaflet().then((L) => {
      if (cancelled || !ref.current) return;
      if (mapRef.current) mapRef.current.remove();
      const map = L.map(ref.current, { scrollWheelZoom: false });
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const latlngs: [number, number][] = [];
      for (const p of geo) {
        const color = p.inPipeline ? "#c06a45" : "#9aa0a6";
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:9999px;background:${color};color:#fff;font-size:11px;font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.35)">${p.order}</span>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([p.lat, p.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${p.name}</strong>${p.oem ? `<br>${p.oem}` : ""}<br><a href="/accounts/${p.id}">Open</a>`);
        latlngs.push([p.lat as number, p.lng as number]);
      }
      // Today's appointments from the connected calendar, plotted as a calendar pin.
      for (const ap of appointments) {
        const icon = L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:#7c3aed;color:#fff;font-size:12px;box-shadow:0 1px 3px rgba(0,0,0,.4)">📅</span>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        L.marker([ap.lat, ap.lng], { icon })
          .addTo(map)
          .bindPopup(`<strong>${ap.time}</strong>${ap.title ? `<br>${ap.title}` : ""}`);
        latlngs.push([ap.lat, ap.lng]);
      }

      map.fitBounds(latlngs, { padding: [30, 30] });

      // Live rep location, so the map tracks the drive.
      if ("geolocation" in navigator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let here: any = null;
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const ll: [number, number] = [pos.coords.latitude, pos.coords.longitude];
            if (!here) {
              here = L.circleMarker(ll, { radius: 7, color: "#2563eb", fillColor: "#2563eb", fillOpacity: 1, weight: 2 })
                .addTo(map)
                .bindPopup("You are here");
            } else {
              here.setLatLng(ll);
            }
          },
          () => {},
          { enableHighAccuracy: true },
        );
      }
    });

    return () => {
      cancelled = true;
      if (watchId != null && "geolocation" in navigator) navigator.geolocation.clearWatch(watchId);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pins]);

  const geoCount = pins.filter((p) => p.lat != null && p.lng != null).length;
  if (geoCount === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        No map coordinates for this area yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={ref} className="h-[420px] w-full overflow-hidden rounded-xl border" />
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#c06a45" }} /> In your pipeline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#9aa0a6" }} /> Not yet contacted
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#2563eb" }} /> You
        </span>
        {appointments.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: "#7c3aed" }} /> Appointment
          </span>
        )}
      </div>
    </div>
  );
}
