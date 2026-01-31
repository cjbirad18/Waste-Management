"use client";

import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import type { GeoJSON as GeoJSONType, Feature, Point } from "geojson";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import { useMap } from "react-leaflet";

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

const truckShadowIcon = L.divIcon({
  className: "",
  html: '<div class="truck-shadow-dot"></div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const residentIcon = L.divIcon({
  className: "",
  html: `
    <div class="resident-pulse-wrapper">
      <div class="resident-pulse-ring"></div>
      <div class="resident-pulse-dot"></div>
    </div>
  `,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
  popupAnchor: [0, -13],
});

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

type TruckState = {
  inside: boolean;
  leaveTimeout?: number | null;
};

const assignedByTruck: Record<number, number> = {
  1: 4,
};

const truckStates: Record<number, TruckState> = {};
const lastSeenAt: Record<number, number> = {};

type AppRole =
  | "GCP"
  | "Resident"
  | "SWMO"
  | "TCEMO"
  | "BWMC"
  | "Secretary"
  | null;

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type ResidentGps = { lat: number | null; lng: number | null };

interface LeafletMapProps {
  residentGps?: ResidentGps;
}

function computeEtaMinutes(distanceKm: number, speedKmh: number): number {
  if (speedKmh <= 0) return Infinity;
  const hours = distanceKm / speedKmh;
  return Math.round(hours * 60);
}

function RecenterOnGps({ gps }: { gps: ResidentGps }) {
  const map = useMap();

  useEffect(() => {
    if (gps.lat != null && gps.lng != null) {
      map.setView([gps.lat, gps.lng], map.getZoom());
    }
  }, [gps.lat, gps.lng, map]);

  return null;
}

function LeafletMap({ residentGps }: LeafletMapProps) {
  const [geojson, setGeojson] = useState<GeoJSONType | null>(null);
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const animStatesRef = useRef<Record<number, TruckAnimState>>({});
  const frameRef = useRef<number | null>(null);

  const [nameToId, setNameToId] = useState<Record<string, number>>({});
  const [theme, setTheme] = useState<"day" | "night">("night");
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const [role, setRole] = useState<AppRole>(null);

  const [residentLocation, setResidentLocation] = useState<{
    lat: number;
    lng: number;
    address?: string | null;
  } | null>(null);

  const dayTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const nightTileUrl =
    "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png";

  // Load barangay polygons
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/data/barangays.geojson", { cache: "no-store" });
      const data = (await res.json()) as GeoJSONType;
      setGeojson(data);
    };
    load();
  }, []);

  // Load barangay name->id map
  useEffect(() => {
    const loadBarangays = async () => {
      const { data, error } = await supabase
        .from("barangay")
        .select("barangay_id, barangay_name");
      if (error || !data) return;
      const map: Record<string, number> = {};
      data.forEach((b: any) => {
        map[b.barangay_name] = b.barangay_id;
      });
      setNameToId(map);
    };
    loadBarangays();
  }, []);

  // Load logged-in user role + initial resident location from DB
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileErr } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileErr || !profile) return;

      // Normalize role value from DB (case-insensitive) into our AppRole union.
      // Accept variants like "SWMO Head", "TCEMO Head", and other labels that
      // contain the canonical role name.
      const rawRole = (profile.role || "").toString().toLowerCase().trim();
      let normalizedRole: AppRole | null = null;

      if (rawRole.includes("gcp")) normalizedRole = "GCP";
      else if (rawRole.includes("resident")) normalizedRole = "Resident";
      else if (rawRole.includes("swmo")) normalizedRole = "SWMO";
      else if (rawRole.includes("tcemo")) normalizedRole = "TCEMO";
      else if (rawRole.includes("bwmc")) normalizedRole = "BWMC";
      else if (rawRole.includes("secretary")) normalizedRole = "Secretary";

      setRole(normalizedRole);
      if (profile.role !== "Resident") return;

      const { data: live, error: liveErr } = await supabase
        .from("resident_live_location")
        .select("latitude, longitude, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (liveErr || !live) return;

      setResidentLocation({
        lat: live.latitude,
        lng: live.longitude,
      });
    };

    loadUser();
  }, []);

  // Sync residentLocation with live GPS prop (so it moves without refresh)
  useEffect(() => {
    if (
      residentGps &&
      residentGps.lat != null &&
      residentGps.lng != null &&
      role === "Resident"
    ) {
      setResidentLocation({
        lat: residentGps.lat,
        lng: residentGps.lng,
      });
    }
  }, [residentGps?.lat, residentGps?.lng, role]);

  // ETA calculation for residents
  useEffect(() => {
    if (role !== "Resident" || !residentLocation || trucks.length === 0) {
      setEtaMinutes(null);
      return;
    }

    const speedKmh = 17.5;
    let bestDist: number | null = null;

    trucks.forEach((t) => {
      if (t.latitude == null || t.longitude == null) return;

      const d = haversineKm(
        residentLocation.lat,
        residentLocation.lng,
        t.latitude,
        t.longitude,
      );

      if (bestDist === null || d < bestDist) {
        bestDist = d;
      }
    });

    if (bestDist === null) {
      setEtaMinutes(null);
      return;
    }

    const eta = computeEtaMinutes(bestDist, speedKmh);
    setEtaMinutes(eta);
  }, [role, residentLocation, trucks]);

  const getBarangayFromPoint = (
    [lat, lng]: [number, number],
    gj: GeoJSONType | null,
  ): string | null => {
    if (!gj) return null;

    const features = (gj as any).features as Feature[] | undefined;
    if (!features || !Array.isArray(features)) return null;

    for (const f of features) {
      if (!f.geometry || f.geometry.type !== "Polygon") continue;

      const props: any = f.properties ?? {};
      const name: string | undefined = props.NAME_3 ?? props.name;
      if (!name) continue;

      const poly = polygon((f.geometry as any).coordinates);
      const p = point([lng, lat]);

      if (booleanPointInPolygon(p, poly)) return name;
    }

    return null;
  };

  const startCollectionIfNeeded = async (barangay_id: number) => {
    const { data, error } = await supabase
      .from("collection_schedules")
      .select("schedule_id, start_time, status")
      .eq("barangay_id", barangay_id)
      .eq("status", "pending")
      .order("date_created", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;
    if (data.start_time) return;

    await supabase
      .from("collection_schedules")
      .update({
        start_time: new Date().toISOString(),
        status: "ongoing",
      })
      .eq("schedule_id", data.schedule_id);
  };

  const endCollectionIfNeeded = async (barangay_id: number) => {
    const { data, error } = await supabase
      .from("collection_schedules")
      .select("schedule_id, end_time, status")
      .eq("barangay_id", barangay_id)
      .eq("status", "ongoing")
      .order("date_created", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;
    if (data.end_time) return;

    await supabase
      .from("collection_schedules")
      .update({
        end_time: new Date().toISOString(),
        status: "completed",
      })
      .eq("schedule_id", data.schedule_id);
  };

  const handleTruckLocationLogic = async (row: TruckRow) => {
    if (!geojson) return;
    if (row.latitude == null || row.longitude == null) return;

    const assignedBarangayId = assignedByTruck[row.truck_id];
    if (!assignedBarangayId) return;

    const barangayName = getBarangayFromPoint(
      [row.latitude, row.longitude],
      geojson,
    );
    if (!barangayName) return;

    const currentBarangayId = nameToId[barangayName];
    if (!currentBarangayId) return;

    const isInsideAssigned = currentBarangayId === assignedBarangayId;
    const state = (truckStates[row.truck_id] ??= { inside: false });

    if (isInsideAssigned && !state.inside) {
      state.inside = true;
      if (state.leaveTimeout) {
        clearTimeout(state.leaveTimeout);
        state.leaveTimeout = null;
      }
      await startCollectionIfNeeded(assignedBarangayId);
      return;
    }

    if (!isInsideAssigned && state.inside && !state.leaveTimeout) {
      state.leaveTimeout = window.setTimeout(
        async () => {
          state.inside = false;
          state.leaveTimeout = null;
          await endCollectionIfNeeded(assignedBarangayId);
        },
        20 * 60 * 1000,
      );
    }
  };

  // Load trucks and subscribe to live updates
  useEffect(() => {
    async function loadTrucks() {
      const { data, error } = await supabase
        .from("truck_live_location")
        .select("id, truck_id, latitude, longitude, updated_at");

      if (!error && data) {
        setTrucks(data as TruckRow[]);
        (data as TruckRow[]).forEach((row) => {
          if (row.truck_id != null) {
            lastSeenAt[row.truck_id] = Date.now();
          }
        });
      }
    }

    loadTrucks();

    const channel = supabase
      .channel("truck_live_location_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "truck_live_location" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const oldRow = payload.old as TruckRow | undefined;
            if (oldRow?.truck_id != null) {
              setTrucks((prev) =>
                prev.filter((t) => t.truck_id !== oldRow.truck_id),
              );
              delete animStatesRef.current[oldRow.truck_id];
              delete lastSeenAt[oldRow.truck_id];
            }
            return;
          }

          const row = payload.new as TruckRow;
          if (row.latitude == null || row.longitude == null) return;

          lastSeenAt[row.truck_id] = Date.now();

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

          await handleTruckLocationLogic(row);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [geojson, nameToId]);

  // Truck animation loop
  useEffect(() => {
    const animate = () => {
      const now = performance.now();
      const animStates = animStatesRef.current;
      const cutoff = Date.now() - 5 * 60 * 1000;

      setTrucks((prev) =>
        prev
          .filter((t) => {
            const last = lastSeenAt[t.truck_id];
            return last == null || last >= cutoff;
          })
          .map((t) => {
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
          }),
      );

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  // Day/night theme switcher
  useEffect(() => {
    const updateThemeFromTime = () => {
      const hour = new Date().getHours();
      if (hour >= 6 && hour < 18) {
        setTheme("day");
      } else {
        setTheme("night");
      }
    };

    updateThemeFromTime();
    const id = setInterval(updateThemeFromTime, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Map center: follow resident if we have live GPS, else default
  const currentCenter: [number, number] =
    residentGps && residentGps.lat != null && residentGps.lng != null
      ? [residentGps.lat, residentGps.lng]
      : mapCenter;

  return (
    <div className="w-full mx-auto my-6">
      {/* Header row with theme toggle */}
      <div className="mb-1 flex items-center justify-between gap-1 px-4 md:px-6 z-[1000] relative">
        <h3 className="text-sm font-semibold text-emerald-200">
          Collection Map
        </h3>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-700/70 bg-slate-900/90 px-3 py-1 text-xs font-semibold text-emerald-200 shadow-md shadow-emerald-900/40">
          <span className="text-base">{theme === "day" ? "🌙" : "☀️"}</span>
          <span>{theme === "day" ? "Day mode" : "Night mode"}</span>
        </div>
      </div>

      {/* MOBILE ETA */}
      {role === "Resident" && (
        <div className="mb-2 px-3 md:hidden">
          <div className="relative w-full rounded-2xl border border-emerald-700/60 bg-slate-900/95 px-4 py-3 text-xs text-emerald-50 shadow-xl shadow-emerald-900/50 backdrop-blur-xl">
            <div className="absolute inset-x-0 -top-[1px] h-[2px] bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400" />

            <div className="mb-1 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/60">
                <span className="text-[13px]">⏱️</span>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-emerald-200 uppercase">
                  Truck ETA
                </p>
                <p className="text-[10px] text-emerald-300/70">
                  Nearest truck to your location
                </p>
              </div>
            </div>

            <div className="mt-1">
              {etaMinutes == null ? (
                <p className="text-[11px] text-emerald-100/80">
                  Live truck data is not available yet. Please wait while we
                  locate the nearest collection vehicle.
                </p>
              ) : (
                <>
                  <p className="text-[24px] leading-none font-bold text-emerald-300">
                    {etaMinutes}
                    <span className="ml-1 text-[11px] font-semibold text-emerald-200/80">
                      min{etaMinutes === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-emerald-100/80">
                    Estimated arrival of the nearest garbage truck at your
                    current location, assuming normal traffic conditions.
                  </p>
                </>
              )}
            </div>

            <div className="mt-2 border-t border-emerald-700/40 pt-1.5">
              <p className="text-[10px] text-emerald-300/60">
                Times are estimates based on live GPS and an average speed of
                15–20 km/h.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Map card */}
      <div className="mx-1 rounded-3xl border border-emerald-800/50 shadow-xl shadow-emerald-900/30 overflow-hidden bg-slate-800/80 backdrop-blur relative">
        {/* DESKTOP/TABLET ETA */}
        {role === "Resident" && (
          <div
            className="
            pointer-events-none absolute top-4 z-[500]
            hidden md:block
            left-6
          "
          >
            <div className="pointer-events-auto relative max-w-xs rounded-2xl border border-emerald-700/60 bg-slate-900/95 px-4 py-3 text-xs text-emerald-50 shadow-2xl shadow-emerald-900/50 backdrop-blur-xl">
              <div className="absolute inset-x-0 -top-[1px] h-[2px] bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400" />

              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/60">
                  <span className="text-[13px]">⏱️</span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-emerald-200 uppercase">
                    Truck ETA
                  </p>
                  <p className="text-[10px] text-emerald-300/70">
                    Nearest truck to your location
                  </p>
                </div>
              </div>

              <div className="mt-1">
                {etaMinutes == null ? (
                  <p className="text-[11px] text-emerald-100/80">
                    Live truck data is not available yet. Please wait while we
                    locate the nearest collection vehicle.
                  </p>
                ) : (
                  <>
                    <p className="text-[26px] leading-none font-bold text-emerald-300">
                      {etaMinutes}
                      <span className="ml-1 text-[11px] font-semibold text-emerald-200/80">
                        min{etaMinutes === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-emerald-100/80">
                      Estimated arrival of the nearest garbage truck at your
                      current location, assuming normal traffic conditions.
                    </p>
                  </>
                )}
              </div>

              <div className="mt-2 border-t border-emerald-700/40 pt-1.5">
                <p className="text-[10px] text-emerald-300/60">
                  Times are estimates based on live GPS and an average speed of
                  15–20 km/h.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Map fills the whole container */}
        <div className="w-full h-[420px] sm:h-[520px] md:h-[620px]">
          <MapContainer
            center={currentCenter}
            zoom={13}
            className="w-full h-full"
          >
            <TileLayer
              attribution={
                theme === "day"
                  ? "© OpenStreetMap contributors"
                  : "© OpenStreetMap contributors, © CARTO"
              }
              url={theme === "day" ? dayTileUrl : nightTileUrl}
            />

            {/* Recenter map when live GPS changes */}
            {residentGps && <RecenterOnGps gps={residentGps} />}

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

            {/* Trucks — show to all users */}
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

            {/* Resident sees only their own location */}
            {role === "Resident" && residentLocation && (
              <Marker
                position={[residentLocation.lat, residentLocation.lng]}
                icon={residentIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold">Your location</div>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default LeafletMap;
