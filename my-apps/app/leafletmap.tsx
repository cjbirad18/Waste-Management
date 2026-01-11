"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import type { GeoJSON as GeoJSONType, Feature, Point } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";

const mapCenter: [number, number] = [9.6556, 123.8521];

const barangayHallIcon = L.icon({
  iconUrl: "/town-hall.png",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

const truckIcon = L.icon({
  iconUrl: "/truck.png",
  iconSize: [80, 90],
  iconAnchor: [25, 30],
  popupAnchor: [0, -16],
});

// HTML-based blinking shadow dot
const truckShadowIcon = L.divIcon({
  className: "",
  html: '<div class="truck-shadow-dot"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// Color per barangay
const getBarangayColor = (name?: string) => {
  switch (name) {
    case "Bool":
      return "#ff6961";
    case "Booy":
      return "#77dd77";
    case "Cabawan":
      return "#fdfd96";
    case "Cogon":
      return "#84b6f4";
    case "Dampas":
      return "#fdcae1";
    case "Dao":
      return "#ffb347";
    case "Manga":
      return "#cfcfc4";
    case "Mansasa":
      return "#b39eb5";
    case "Poblacion I":
      return "#03c4a1";
    case "Poblacion II":
      return "#ffde7d";
    case "Poblacion III":
      return "#ff9aa2";
    case "San Isidro":
      return "#a0e7e5";
    case "Taloto":
      return "#b4f8c8";
    case "Tiptip":
      return "#fbe7c6";
    case "Ubujan":
      return "#cdb4db";
    default:
      return "#cccccc";
  }
};

const barangayNames = [
  "Bool",
  "Booy",
  "Cabawan",
  "Cogon",
  "Dampas",
  "Dao",
  "Manga",
  "Mansasa",
  "Poblacion I",
  "Poblacion II",
  "Poblacion III",
  "San Isidro",
  "Taloto",
  "Tiptip",
  "Ubujan",
];

type TruckRow = {
  id?: string;
  truck_id: number;
  latitude: number | null;
  longitude: number | null;
  updated_at: string | null;
};

type TruckAnimState = {
  from: [number, number];
  to: [number, number];
  startTime: number;
  duration: number;
};

export default function LeafletMap() {
  const [geojson, setGeojson] = useState<GeoJSONType | null>(null);
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const animStatesRef = useRef<Record<number, TruckAnimState>>({});
  const frameRef = useRef<number | null>(null);

  // map theme: "day" | "night"
  const [theme, setTheme] = useState<"day" | "night">("night");

  const dayTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const nightTileUrl =
    "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png";

  // Load barangay GeoJSON
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/data/barangays.geojson", { cache: "no-store" });
      const data = (await res.json()) as GeoJSONType;
      setGeojson(data);
    };
    load();
  }, []);

  // Load and subscribe to live truck locations
  useEffect(() => {
    async function loadTrucks() {
      const { data, error } = await supabase
        .from("truck_live_location")
        .select("id, truck_id, latitude, longitude, updated_at");

      if (!error && data) {
        setTrucks(data as TruckRow[]);
      }
    }

    loadTrucks();

    const channel = supabase
      .channel("truck_live_location_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "truck_live_location" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as TruckRow | undefined;
            if (oldRow?.truck_id != null) {
              setTrucks((prev) =>
                prev.filter((t) => t.truck_id !== oldRow.truck_id)
              );
              delete animStatesRef.current[oldRow.truck_id];
            }
            return;
          }

          const row = payload.new as TruckRow;
          if (row.latitude == null || row.longitude == null) return;

          setTrucks((prev) => {
            const next = [...prev];
            const idx = next.findIndex((t) => t.truck_id === row.truck_id);
            if (idx === -1) {
              next.push(row);
            } else {
              next[idx] = { ...next[idx], ...row };
            }
            return next;
          });

          const s = animStatesRef.current[row.truck_id];
          const from: [number, number] = s
            ? s.to
            : [row.latitude, row.longitude];
          const to: [number, number] = [row.latitude, row.longitude];

          const dist = Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
          const duration = dist > 0.01 ? 0 : 1500;

          animStatesRef.current[row.truck_id] = {
            from,
            to,
            startTime: performance.now(),
            duration: duration || 1500,
          };
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const now = performance.now();
      const animStates = animStatesRef.current;

      setTrucks((prev) =>
        prev.map((t) => {
          const s = animStates[t.truck_id];
          if (!s || t.latitude == null || t.longitude == null) return t;

          const { from, to, startTime, duration } = s;
          if (duration <= 0) {
            return { ...t, latitude: to[0], longitude: to[1] };
          }

          const p = Math.min((now - startTime) / duration, 1);
          const lat = from[0] + (to[0] - from[0]) * p;
          const lng = from[1] + (to[1] - from[1]) * p;

          return { ...t, latitude: lat, longitude: lng };
        })
      );

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <div className="w-full mx-auto my-6">
      {/* Header row with theme toggle */}
      <div className="mb-1 flex items-center justify-between gap-1 px-6">
        <h3 className="text-sm font-semibold text-emerald-200">
          Collection Map
        </h3>
        <button
          type="button"
          onClick={() => setTheme((prev) => (prev === "day" ? "night" : "day"))}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-700/70 bg-slate-900/90 px-3 py-1 text-xs font-semibold text-emerald-200 shadow-md shadow-emerald-900/40 hover:bg-emerald-600/20 transition"
        >
          <span className="text-base">{theme === "day" ? "🌙" : "☀️"}</span>
          <span>{theme === "day" ? "Night mode" : "Day mode"}</span>
        </button>
      </div>

      {/* Map card – full width, fixed height */}
      <div className="mx-1 rounded-3xl border border-emerald-800/50 shadow-xl shadow-emerald-900/30 overflow-hidden bg-slate-800/80 backdrop-blur">
        <div className="w-full h-[460px]">
          <MapContainer center={mapCenter} zoom={13} className="w-full h-full">
            <TileLayer
              attribution={
                theme === "day"
                  ? "© OpenStreetMap contributors"
                  : "© OpenStreetMap contributors, © CARTO"
              }
              url={theme === "day" ? dayTileUrl : nightTileUrl}
            />

            {geojson && (
              <GeoJSON
                data={geojson}
                style={(feature?: Feature) => {
                  if (!feature) return {};
                  const name3 = (feature.properties as any)?.NAME_3;
                  const fillColor = getBarangayColor(name3);

                  if (feature.geometry.type === "Polygon") {
                    return {
                      color: "#555",
                      weight: 1.2,
                      fillColor,
                      fillOpacity: theme === "day" ? 0.5 : 0.4,
                    };
                  }
                  return {};
                }}
                pointToLayer={(feature: Feature<Point>, latlng) =>
                  L.marker(latlng, { icon: barangayHallIcon })
                }
                onEachFeature={(feature, layer) => {
                  const props: any = feature.properties || {};
                  const name3 = props.NAME_3;
                  const name = name3 || props.name;

                  if (feature.geometry.type === "Polygon" && name3) {
                    const center = (layer as any).getBounds().getCenter();
                    layer.bindTooltip(name3, {
                      permanent: true,
                      direction: "center",
                      className: "barangay-label",
                    });
                    (layer as any).openTooltip(center);
                  }

                  if (name && feature.geometry.type === "Polygon") {
                    layer.bindPopup(String(name));
                  }
                }}
              />
            )}

            {trucks.map((t) => {
              if (t.latitude == null || t.longitude == null) return null;
              const pos: [number, number] = [t.latitude, t.longitude];
              const key = t.id ?? `truck-${t.truck_id}`;

              return (
                <React.Fragment key={key}>
                  <Marker
                    position={pos}
                    icon={truckShadowIcon}
                    interactive={false}
                  />
                  <Marker position={pos} icon={truckIcon}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold">{`Truck ${t.truck_id}`}</div>
                        {t.updated_at && (
                          <div className="text-xs text-gray-600">
                            Last update:{" "}
                            {new Date(t.updated_at).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs px-6 pb-2">
        {barangayNames.map((bgy) => (
          <div
            key={bgy}
            className="flex items-center gap-1 px-2 py-1 rounded-xl border border-slate-700 bg-slate-900/90 text-slate-100 shadow-sm shadow-slate-900/60"
          >
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 2,
                backgroundColor: getBarangayColor(bgy),
                border: "1px solid #111",
              }}
            />
            <span>{bgy}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
