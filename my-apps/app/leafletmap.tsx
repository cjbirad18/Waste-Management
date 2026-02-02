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
  iconSize: [85, 95],
  iconAnchor: [27, 32],
  popupAnchor: [0, -18],
  shadowUrl: undefined,
});

const truckShadowIcon = L.divIcon({
  className: "",
  html: '<div class="truck-shadow-dot"></div>',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const residentIcon = L.divIcon({
  className: "",
  html: `
    <div class="resident-pulse-wrapper">
      <div class="resident-pulse-ring pulse-1"></div>
      <div class="resident-pulse-ring pulse-2"></div>
      <div class="resident-pulse-dot">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" fill="white"/>
          <path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6" fill="white" opacity="0.95"/>
        </svg>
      </div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -16],
});

const getBarangayColor = (name?: string) => {
  switch (name) {
    case "Bool":
      return "#ef4444";
    case "Booy":
      return "#10b981";
    case "Cabawan":
      return "#eab308";
    case "Cogon":
      return "#3b82f6";
    case "Dampas":
      return "#ec4899";
    case "Dao":
      return "#f97316";
    case "Manga":
      return "#8b5cf6";
    case "Mansasa":
      return "#06b6d4";
    case "Poblacion I":
      return "#14b8a6";
    case "Poblacion II":
      return "#f59e0b";
    case "Poblacion III":
      return "#f43f5e";
    case "San Isidro":
      return "#06b6d4";
    case "Taloto":
      return "#84cc16";
    case "Tiptip":
      return "#fbbf24";
    case "Ubujan":
      return "#a78bfa";
    default:
      return "#9ca3af";
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
    <div className="w-full flex flex-col gap-3">
      {/* Enhanced Header with Theme Toggle */}

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 md:p-1">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 md:h-10 md:w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/80 to-teal-600/80 text-lg shadow-lg shadow-emerald-500/30">
            🗺️
          </div>
          <div>
            <h3 className="text-base md:text-xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent">
              Collection Coverage Map
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time vehicle tracking &amp; service coverage
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Live Indicator */}
          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-600/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 shadow-md shadow-emerald-500/20">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>Live Tracking Active</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === "day" ? "night" : "day")}
            className="group/theme inline-flex items-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/60 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:bg-slate-800/80 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <span className="text-base group-hover/theme:scale-110 transition-transform">
              {theme === "day" ? "🌙" : "☀️"}
            </span>
            <span className="hidden sm:inline capitalize">{theme} Mode</span>
          </button>
        </div>
      </div>
      <div className="px-2 md:px-6 z-[1000] relative">
        <div className="group relative rounded-2xl md:rounded-3xl bg-gradient-to-r from-slate-800/95 via-slate-800/90 to-gray-800/95 border border-emerald-700/50 overflow-hidden shadow-lg shadow-emerald-900/20 backdrop-blur-2xl">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
        </div>
      </div>

      {/* MOBILE ETA */}
      {role === "Resident" && (
        <div className="px-2 md:hidden">
          <div className="relative rounded-xl border border-emerald-600/50 bg-gradient-to-br from-slate-900/95 to-slate-900/90 px-3 py-2.5 text-emerald-50 shadow-xl shadow-emerald-900/60 backdrop-blur-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-teal-500/5 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border border-emerald-400/40">
                  <span className="text-xs">⏱️</span>
                </div>
                <div>
                  <p className="text-xs font-bold tracking-wide text-emerald-300 uppercase">
                    Arrival Time
                  </p>
                  <p className="text-[10px] text-emerald-200/60">
                    Next collection vehicle
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-slate-800/50 border border-emerald-600/30 p-2 mb-2">
                {etaMinutes == null ? (
                  <p className="text-[10px] text-emerald-100/70">
                    📡 Locating nearest truck...
                  </p>
                ) : (
                  <div>
                    <p className="text-2xl leading-none font-black text-emerald-300 mb-0.5">
                      {etaMinutes}
                      <span className="text-[10px] font-semibold text-emerald-200/70 ml-1.5">
                        min{etaMinutes === 1 ? "" : "s"}
                      </span>
                    </p>
                    <p className="text-[10px] text-emerald-100/60">
                      Estimated arrival time
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[9px] text-emerald-300/50 border-t border-emerald-700/30 pt-1.5">
                ℹ️ Based on live GPS data and 15–20 km/h average speed
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Map card */}
      <div className="mx-1 rounded-2xl md:rounded-3xl border border-emerald-800/50 shadow-xl shadow-emerald-900/40 overflow-hidden bg-slate-900/95 backdrop-blur relative">
        {/* DESKTOP/TABLET ETA */}
        {role === "Resident" && (
          <div
            className="
            pointer-events-none absolute top-4 z-[500]
            hidden md:block
            left-4
          "
          >
            <div className="pointer-events-auto relative max-w-[240px] rounded-xl border border-emerald-600/50 bg-gradient-to-br from-slate-900/95 to-slate-900/90 px-3.5 py-3 text-emerald-50 shadow-xl shadow-emerald-900/60 backdrop-blur-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-teal-500/5 pointer-events-none" />
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border border-emerald-400/40">
                    <span className="text-sm">⏱️</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold tracking-wide text-emerald-300 uppercase">
                      Arrival Time
                    </p>
                    <p className="text-[10px] text-emerald-200/60">
                      Next collection vehicle
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800/50 border border-emerald-600/30 p-2.5 mb-2.5">
                  {etaMinutes == null ? (
                    <p className="text-xs text-emerald-100/70">
                      📡 Locating nearest truck...
                    </p>
                  ) : (
                    <div>
                      <p className="text-3xl leading-none font-black text-emerald-300 mb-1">
                        {etaMinutes}
                        <span className="text-[10px] font-semibold text-emerald-200/70 ml-1.5">
                          min{etaMinutes === 1 ? "" : "s"}
                        </span>
                      </p>
                      <p className="text-[10px] text-emerald-100/60">
                        Estimated arrival time
                      </p>
                    </div>
                  )}
                </div>

                <p className="text-[9px] text-emerald-300/50 border-t border-emerald-700/30 pt-2">
                  ℹ️ Based on live GPS data and 15–20 km/h average speed
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Map fills the whole container */}
        <div className="w-full h-[50vh] min-h-[280px] sm:h-[56vh] md:h-[62vh] lg:h-[68vh] xl:h-[72vh] max-h-[740px] relative">
          <MapContainer
            center={currentCenter}
            zoom={13}
            className="w-full h-full rounded-2xl"
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
