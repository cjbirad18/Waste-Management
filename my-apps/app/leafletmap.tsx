"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from "react-leaflet";
import type { GeoJSON as GeoJSONType, Feature, Point } from "geojson";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Fix Leaflet's default icon path for marker and shadow
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabaseClient";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon } from "@turf/helpers";
import { useMap } from "react-leaflet";
import {
  MapPin,
  Truck,
  Clock,
  AlertCircle,
  Sun,
  Moon,
  Crosshair,
  Map as MapIcon,
  Activity,
} from "lucide-react";

const mapCenter: [number, number] = [9.6556, 123.8521];

const createBarangayIcon = () =>
  new L.Icon({
    iconUrl: markerIcon as unknown as string,
    shadowUrl: markerShadow as unknown as string,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

const createTruckIcon = (isActive: boolean) =>
  L.divIcon({
    className: "custom-truck-icon",
    html: `
    <div style="width:80px;height:80px;position:relative;display:flex;align-items:center;justify-content:center;">
      <div class="bg-emerald-500/30 rounded-full animate-ping ${isActive ? "block" : "hidden"}" style="position:absolute;inset:0;"></div>
      <img src="/truck.png" alt="Truck" style="width:70px;height:70px;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.4));position:relative;" />
    </div>
  `,
    iconSize: [90, 90],
    iconAnchor: [45, 45],
    popupAnchor: [0, -45],
  });

const createResidentIcon = () =>
  L.divIcon({
    className: "custom-resident-icon",
    html: `
    <div class="relative">
      <div class="absolute -inset-4 bg-blue-500/20 rounded-full animate-pulse"></div>
      <div class="absolute -inset-2 bg-blue-500/30 rounded-full animate-ping"></div>
      <div class="relative bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-full shadow-xl border-2 border-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="none">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
        </svg>
      </div>
    </div>
  `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });

// Modern color palette with better contrast
const getBarangayColor = (name?: string): string => {
  const colors: Record<string, string> = {
    Bool: "#f87171", // Red-400
    Booy: "#34d399", // Emerald-400
    Cabawan: "#fbbf24", // Amber-400
    Cogon: "#60a5fa", // Blue-400
    Dampas: "#f472b6", // Pink-400
    Dao: "#fb923c", // Orange-400
    Manga: "#a78bfa", // Violet-400
    Mansasa: "#22d3ee", // Cyan-400
    "Poblacion I": "#2dd4bf", // Teal-400
    "Poblacion II": "#fbbf24", // Amber-400
    "Poblacion III": "#fb7185", // Rose-400
    "San Isidro": "#22d3ee", // Cyan-400
    Taloto: "#a3e635", // Lime-400
    Tiptip: "#facc15", // Yellow-400
    Ubujan: "#c084fc", // Purple-400
  };
  return colors[name || ""] || "#9ca3af";
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

const assignedByTruck: Record<number, number> = { 1: 4 };
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

// Utility functions
const haversineKm = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const computeEtaMinutes = (distanceKm: number, speedKmh: number): number => {
  if (speedKmh <= 0) return Infinity;
  return Math.round((distanceKm / speedKmh) * 60);
};

// Components
function RecenterOnGps({
  gps,
  autoCenter,
}: {
  gps: { lat: number; lng: number };
  autoCenter: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (
      autoCenter &&
      gps &&
      typeof gps.lat === "number" &&
      typeof gps.lng === "number"
    ) {
      map.flyTo([gps.lat, gps.lng], map.getZoom(), {
        duration: 1.5,
        easeLinearity: 0.25,
      });
    }
  }, [gps, autoCenter, map]);

  return null;
}

interface LeafletMapProps {
  residentGps?: { lat: number | null; lng: number | null };
  showAllTrucks?: boolean;
  assignedTruckId?: number | null;
}

// Modern Badge Component
const StatusBadge = ({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "warning" | "success" | "info";
}) => {
  const variants = {
    default: "bg-slate-800/80 text-slate-300 border-slate-700/50",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${variants[variant]}`}
    >
      {children}
    </span>
  );
};

// Modern Card Component
const InfoCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-xl shadow-black/30 ${className}`}
  >
    {children}
  </div>
);

function LeafletMap({
  residentGps,
  showAllTrucks = true,
  assignedTruckId,
}: LeafletMapProps) {
  const [geojson, setGeojson] = useState<GeoJSONType | null>(null);
  const [trucks, setTrucks] = useState<TruckRow[]>([]);
  const animStatesRef = useRef<Record<number, TruckAnimState>>({});
  const frameRef = useRef<number | null>(null);

  const [nameToId, setNameToId] = useState<Record<string, number>>({});
  const [theme, setTheme] = useState<"day" | "night">("night");
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  const [role, setRole] = useState<AppRole>(null);
  const [autoCenter, setAutoCenter] = useState(true);
  const [gcpTruckId, setGcpTruckId] = useState<number | null>(null);
  const [gcpAssignedBarangayId, setGcpAssignedBarangayId] = useState<
    number | null
  >(null);
  const [gcpAssignedBarangayName, setGcpAssignedBarangayName] = useState<
    string | null
  >(null);
  const [gcpLocationWarning, setGcpLocationWarning] = useState<string | null>(
    null,
  );
  const [residentLocation, setResidentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const tileUrls = {
    day: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    night: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  };

  // Data loading
  useEffect(() => {
    const loadData = async () => {
      try {
        const [geoRes, barangayRes] = await Promise.all([
          fetch("/data/barangays.geojson", { cache: "no-store" }),
          supabase.from("barangay").select("barangay_id, barangay_name"),
        ]);

        const geoData = await geoRes.json();
        setGeojson(geoData);

        if (!barangayRes.error && barangayRes.data) {
          const map: Record<string, number> = {};
          barangayRes.data.forEach(
            (b: any) => (map[b.barangay_name] = b.barangay_id),
          );
          setNameToId(map);
        }
      } catch (error) {
        console.error("Failed to load map data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // User authentication
  useEffect(() => {
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) return;

      const rawRole = (profile.role || "").toLowerCase();
      let normalizedRole: AppRole = null;

      if (rawRole.includes("gcp")) normalizedRole = "GCP";
      else if (rawRole.includes("resident")) normalizedRole = "Resident";
      else if (rawRole.includes("swmo")) normalizedRole = "SWMO";
      else if (rawRole.includes("tcemo")) normalizedRole = "TCEMO";
      else if (rawRole.includes("bwmc")) normalizedRole = "BWMC";
      else if (rawRole.includes("secretary")) normalizedRole = "Secretary";

      setRole(normalizedRole);

      if (normalizedRole === "Resident") {
        const { data: live } = await supabase
          .from("resident_live_location")
          .select("latitude, longitude")
          .eq("user_id", user.id)
          .maybeSingle();

        if (live)
          setResidentLocation({ lat: live.latitude, lng: live.longitude });
      }
    };
    loadUser();
  }, []);

  // GCP assignment loading
  useEffect(() => {
    if (role !== "GCP") return;

    const loadAssignment = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Query for truck assigned to GCP user
      // Get truck assigned to GCP user
      // Correct Supabase query for truck assigned to GCP user
      // Query for truck assigned to GCP user (no typos)
      const { data: truck, error: truckErr } = await supabase
        .from("garbage_trucks")
        .select("truck_id,gcp_user_id,plate_number,capacity,status,truck_code")
        .eq("gcp_user_id", user.id)
        .single();

      // Query for latest collection schedule assigned to GCP user (no typos)
      const { data: schedule, error: schedErr } = await supabase
        .from("collection_schedules")
        .select(
          "schedule_id,barangay_id,date_created,start_time,end_time,days,status,created_by,gcp_user_id",
        )
        .eq("gcp_user_id", user.id)
        .in("status", ["pending", "ongoing", "active"])
        .order("date_created", { ascending: false })
        .limit(1)
        .single();

      if (truck && truck.truck_id) setGcpTruckId(truck.truck_id);
      if (schedule && schedule.barangay_id) {
        setGcpAssignedBarangayId(Number(schedule.barangay_id));
        // Lookup barangay name from barangay_id
        const { data: barangay } = await supabase
          .from("barangay")
          .select("barangay_name")
          .eq("barangay_id", schedule.barangay_id)
          .maybeSingle();
        setGcpAssignedBarangayName(barangay?.barangay_name ?? null);
      }
    };
    loadAssignment();
  }, [role]);

  // Sync resident GPS
  useEffect(() => {
    if (
      residentGps?.lat != null &&
      residentGps?.lng != null &&
      role === "Resident"
    ) {
      setResidentLocation({ lat: residentGps.lat, lng: residentGps.lng });
    }
  }, [residentGps, role]);

  // Filter visible trucks
  const visibleTrucks = showAllTrucks
    ? trucks
    : assignedTruckId != null
      ? trucks.filter((t) => t.truck_id === assignedTruckId)
      : [];

  // ETA calculation
  useEffect(() => {
    if (
      role !== "Resident" ||
      !residentLocation ||
      visibleTrucks.length === 0
    ) {
      setEtaMinutes(null);
      return;
    }

    let bestDist: number | null = null;
    visibleTrucks.forEach((t) => {
      if (t.latitude == null || t.longitude == null) return;
      const d = haversineKm(
        residentLocation.lat,
        residentLocation.lng,
        t.latitude,
        t.longitude,
      );
      if (bestDist === null || d < bestDist) bestDist = d;
    });

    setEtaMinutes(bestDist !== null ? computeEtaMinutes(bestDist, 17.5) : null);
  }, [role, residentLocation, visibleTrucks]);

  // Location logic handlers
  const getBarangayFromPoint = useCallback(
    ([lat, lng]: [number, number], gj: GeoJSONType | null): string | null => {
      if (!gj) return null;
      const features = (gj as any).features as Feature[] | undefined;
      if (!features) return null;

      for (const f of features) {
        if (f.geometry?.type !== "Polygon") continue;
        const props: any = f.properties ?? {};
        const name = props.NAME_3 ?? props.name;
        if (!name) continue;

        try {
          const poly = polygon((f.geometry as any).coordinates);
          if (booleanPointInPolygon(point([lng, lat]), poly)) return name;
        } catch (e) {
          continue;
        }
      }
      return null;
    },
    [],
  );

  const handleTruckLocationLogic = useCallback(
    async (row: TruckRow) => {
      if (!geojson || row.latitude == null || row.longitude == null) return;

      const assignedBarangayId = assignedByTruck[row.truck_id];
      const effectiveId =
        role === "GCP" && gcpTruckId === row.truck_id
          ? (gcpAssignedBarangayId ?? assignedBarangayId)
          : assignedBarangayId;

      if (!effectiveId) return;

      const barangayName = getBarangayFromPoint(
        [row.latitude, row.longitude],
        geojson,
      );
      if (!barangayName) return;

      const currentBarangayId = nameToId[barangayName];
      if (!currentBarangayId) return;

      const isInside = currentBarangayId === effectiveId;
      const state = (truckStates[row.truck_id] ??= { inside: false });

      if (role === "GCP" && gcpTruckId === row.truck_id) {
        setGcpLocationWarning(
          isInside
            ? null
            : `You are outside ${gcpAssignedBarangayName || "your assigned barangay"}`,
        );
      }

      if (isInside && !state.inside) {
        state.inside = true;
        if (state.leaveTimeout) {
          clearTimeout(state.leaveTimeout);
          state.leaveTimeout = null;
        }
        // Trigger collection start
        const { data } = await supabase
          .from("collection_schedules")
          .select("schedule_id, start_time")
          .eq("barangay_id", effectiveId)
          .eq("status", "pending")
          .order("date_created", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data && !data.start_time) {
          await supabase
            .from("collection_schedules")
            .update({ start_time: new Date().toISOString(), status: "ongoing" })
            .eq("schedule_id", data.schedule_id);

          // Call backend API to notify residents in this barangay
          try {
            await fetch("/api/notifications/truck-arrival", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ barangayId: effectiveId }),
            });
            console.log(
              "Triggered resident notification for barangay:",
              effectiveId,
            );
          } catch (err) {
            console.error("Failed to trigger resident notification API:", err);
          }
        }
      } else if (!isInside && state.inside && !state.leaveTimeout) {
        state.leaveTimeout = window.setTimeout(
          async () => {
            state.inside = false;
            state.leaveTimeout = null;
            const { data } = await supabase
              .from("collection_schedules")
              .select("schedule_id, end_time")
              .eq("barangay_id", effectiveId)
              .eq("status", "ongoing")
              .order("date_created", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (data && !data.end_time) {
              await supabase
                .from("collection_schedules")
                .update({
                  end_time: new Date().toISOString(),
                  status: "completed",
                })
                .eq("schedule_id", data.schedule_id);
            }
          },
          20 * 60 * 1000,
        );
      }
    },
    [
      geojson,
      nameToId,
      role,
      gcpTruckId,
      gcpAssignedBarangayId,
      gcpAssignedBarangayName,
      getBarangayFromPoint,
    ],
  );

  // Truck subscription
  useEffect(() => {
    const loadTrucks = async () => {
      const { data } = await supabase.from("truck_live_location").select("*");
      if (data) {
        setTrucks(data);
        data.forEach((row: TruckRow) => {
          if (row.truck_id) lastSeenAt[row.truck_id] = Date.now();
        });
      }
    };
    loadTrucks();

    const channel = supabase
      .channel("truck_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "truck_live_location" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as TruckRow;
            if (old?.truck_id) {
              setTrucks((prev) =>
                prev.filter((t) => t.truck_id !== old.truck_id),
              );
              delete animStatesRef.current[old.truck_id];
              delete lastSeenAt[old.truck_id];
            }
            return;
          }

          const row = payload.new as TruckRow;
          if (row.latitude == null || row.longitude == null) return;

          lastSeenAt[row.truck_id] = Date.now();

          setTrucks((prev) => {
            const idx = prev.findIndex((t) => t.truck_id === row.truck_id);
            if (idx === -1) return [...prev, row];
            const next = [...prev];
            next[idx] = { ...next[idx], ...row };
            return next;
          });

          const s = animStatesRef.current[row.truck_id];
          const from: [number, number] = s
            ? s.to
            : [row.latitude, row.longitude];
          const to: [number, number] = [row.latitude, row.longitude];
          const dist = Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);

          animStatesRef.current[row.truck_id] = {
            from,
            to,
            startTime: performance.now(),
            duration: dist > 0.01 ? 0 : 1500,
          };

          await handleTruckLocationLogic(row);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [handleTruckLocationLogic]);

  // Animation loop
  // Animation loop
  useEffect(() => {
    const animate = () => {
      const now = performance.now();
      const cutoff = Date.now() - 5 * 60 * 1000;
      let hasChanges = false;

      // Only run animation if there are active animations
      const activeAnimations = Object.keys(animStatesRef.current).length;
      if (activeAnimations === 0 && trucks.length === 0) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      setTrucks((prev) => {
        const next = prev
          .filter((t) => {
            const last = lastSeenAt[t.truck_id];
            return last == null || last >= cutoff;
          })
          .map((t) => {
            const s = animStatesRef.current[t.truck_id];
            if (!s || t.latitude == null || t.longitude == null) return t;

            const { from, to, startTime, duration } = s;

            // Animation complete - clean up and set final position
            if (duration <= 0 || now >= startTime + duration) {
              delete animStatesRef.current[t.truck_id];
              if (t.latitude === to[0] && t.longitude === to[1]) return t;
              hasChanges = true;
              return { ...t, latitude: to[0], longitude: to[1] };
            }

            const p = Math.min((now - startTime) / duration, 1);
            const easeP = 1 - Math.pow(1 - p, 3);

            const newLat = from[0] + (to[0] - from[0]) * easeP;
            const newLng = from[1] + (to[1] - from[1]) * easeP;

            // Skip tiny changes to prevent excessive re-renders
            const latDiff = Math.abs(t.latitude - newLat);
            const lngDiff = Math.abs(t.longitude - newLng);
            if (latDiff < 0.00001 && lngDiff < 0.00001) return t;

            hasChanges = true;
            return {
              ...t,
              latitude: newLat,
              longitude: newLng,
            };
          });

        // Return prev reference if no changes (React will skip re-render)
        if (!hasChanges) return prev;
        return next;
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []); // Keep empty dependency array

  // Theme toggle based on time
  useEffect(() => {
    const updateTheme = () => {
      const hour = new Date().getHours();
      setTheme(hour >= 6 && hour < 18 ? "day" : "night");
    };
    updateTheme();
    const id = setInterval(updateTheme, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const currentCenter: [number, number] =
    residentGps?.lat != null && residentGps?.lng != null
      ? [residentGps.lat, residentGps.lng]
      : mapCenter;

  if (isLoading) {
    return (
      <div className="w-full h-[50vh] flex items-center justify-center bg-slate-900/50 rounded-3xl border border-slate-800/50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-400 font-medium">
            Loading map...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4 p-4">
      {/* Modern Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          {role === "GCP" && gcpLocationWarning && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-sm font-medium shadow-sm">
              <AlertCircle size={16} />
              <span>{gcpLocationWarning}</span>
            </div>
          )}

          {role === "Resident" && (
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-700/50">
              <button
                onClick={() => setAutoCenter(true)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 
  ${
    autoCenter
      ? "bg-emerald-600/20 text-emerald-400 shadow-sm border border-emerald-500/30"
      : "text-slate-400 hover:text-emerald-300"
  }
`}
              >
                <Crosshair size={16} />
                <span className="hidden sm:inline">Follow Me</span>
              </button>
              <button
                onClick={() => setAutoCenter(false)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
  ${
    !autoCenter
      ? "bg-blue-600/20 text-blue-400 shadow-sm border border-blue-500/30"
      : "text-slate-400 hover:text-emerald-300"
  }
`}
              >
                <MapIcon size={16} />
                <span className="hidden sm:inline">Browse</span>
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge variant="success">
            <Activity size={14} className="animate-pulse" />
            <span>Live Tracking</span>
          </StatusBadge>

          <button
            onClick={() => setTheme((t) => (t === "day" ? "night" : "day"))}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-700/50 rounded-full text-sm font-medium text-slate-300 hover:text-emerald-400 hover:border-emerald-500/30 transition-all shadow-sm"
          >
            {theme === "day" ? <Moon size={16} /> : <Sun size={16} />}
            <span className="capitalize">{theme}</span>
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/30 border border-slate-700/50">
        {/* ETA Card - Desktop */}
        {role === "Resident" && (
          <div className="absolute top-4 left-4 z-[500] hidden md:block ">
            <InfoCard className="p-4 min-w-[300px]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <Clock size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Arrival Time
                  </h3>
                  <p className="text-md text-slate-400">Next collection</p>
                </div>
              </div>

              <div className="rounded-xl p-3 mb-4 bg-slate-800/80 border border-slate-700/30">
                {etaMinutes == null ? (
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-4 h-4 border-2 rounded-full animate-spin border-slate-600 border-t-emerald-400" />
                    <span className="text-[17px]">Locating trucks...</span>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-emerald-400">
                        {etaMinutes}
                      </span>
                      <span className="text-sm font-medium text-slate-400">
                        min{etaMinutes !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Estimated arrival
                    </p>
                  </div>
                )}
              </div>

              <p className="text-[13px] text-slate-500 leading-relaxed">
                Based on live GPS data • 15-20 km/h avg speed
              </p>
            </InfoCard>
          </div>
        )}

        {/* Mobile ETA */}
        {role === "Resident" && (
          <div className="md:hidden absolute top-4 left-4 right-4 z-[500]">
            <InfoCard className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <Clock size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Arrival
                    </h3>
                    {etaMinutes != null && (
                      <p className="text-lg font-bold text-emerald-400">
                        {etaMinutes} min
                      </p>
                    )}
                  </div>
                </div>
                {etaMinutes == null && (
                  <div className="w-5 h-5 border-2 border-slate-700 border-t-emerald-400 rounded-full animate-spin" />
                )}
              </div>
            </InfoCard>
          </div>
        )}

        {/* Map */}
        <div className="w-full h-[60vh] min-h-[400px] relative bg-slate-900">
          <MapContainer
            center={currentCenter}
            zoom={14}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url={tileUrls[theme]}
              subdomains="abcd"
              maxZoom={20}
            />

            <RecenterOnGps gps={residentGps as any} autoCenter={autoCenter} />

            {/* Barangay Polygons */}
            {geojson && (
              <GeoJSON
                data={geojson}
                pointToLayer={(feature, latlng) =>
                  L.marker(latlng, { icon: createBarangayIcon() })
                }
                style={(feature?: Feature) => {
                  if (!feature || feature.geometry.type !== "Polygon")
                    return {};
                  const name = (feature.properties as any)?.NAME_3;
                  return {
                    color: theme === "day" ? "#475569" : "#64748b",
                    weight: 2,
                    opacity: 0.8,
                    fillColor: getBarangayColor(name),
                    fillOpacity: theme === "day" ? 0.35 : 0.25,
                  };
                }}
                onEachFeature={(feature, layer) => {
                  const props: any = feature.properties || {};
                  const name = props.NAME_3;

                  if (feature.geometry.type === "Polygon" && name) {
                    layer.bindTooltip(name, {
                      permanent: true,
                      direction: "center",
                      className: "custom-tooltip",
                      opacity: 0.9,
                    });
                  }

                  layer.on({
                    mouseover: (e) => {
                      if (typeof e.target.setStyle === "function") {
                        e.target.setStyle({
                          weight: 3,
                          fillOpacity: theme === "day" ? 0.5 : 0.4,
                        });
                      }
                    },
                    mouseout: (e) => {
                      if (typeof e.target.setStyle === "function") {
                        e.target.setStyle({
                          weight: 2,
                          fillOpacity: theme === "day" ? 0.35 : 0.25,
                        });
                      }
                    },
                  });
                }}
              />
            )}

            {/* Trucks */}
            {visibleTrucks.map((t, idx) => {
              if (t.latitude == null || t.longitude == null) {
                console.warn(`Truck ${t.truck_id} missing location:`, t);
                return null;
              }
              const pos: [number, number] = [t.latitude, t.longitude];
              const isRecent = Boolean(
                t.updated_at &&
                Date.now() - new Date(t.updated_at).getTime() < 60000,
              );
              console.log(`Rendering truck marker`, {
                idx,
                truck_id: t.truck_id,
                pos,
                isRecent,
                updated_at: t.updated_at,
              });

              return (
                <Marker
                  key={t.id ?? `truck-${t.truck_id}`}
                  position={pos}
                  icon={createTruckIcon(isRecent)}
                >
                  <Popup className="custom-popup">
                    <div className="p-2 min-w-[150px]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-emerald-100 rounded-lg">
                          <Truck size={16} className="text-emerald-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900">
                            Truck {t.truck_id}
                          </h4>
                          <StatusBadge
                            variant={isRecent ? "success" : "warning"}
                          >
                            {isRecent ? "Active" : "Idle"}
                          </StatusBadge>
                        </div>
                      </div>
                      {t.updated_at && (
                        <p className="text-xs text-slate-500">
                          Updated{" "}
                          {new Date(t.updated_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Resident Location */}
            {role === "Resident" && residentLocation && (
              <Marker
                position={[residentLocation.lat, residentLocation.lng]}
                icon={createResidentIcon()}
              >
                <Popup className="custom-popup">
                  <div className="flex items-center gap-2 p-1">
                    <MapPin size={16} className="text-blue-500" />
                    <span className="font-medium text-slate-900">
                      Your Location
                    </span>
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 px-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Active Truck</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Your Location</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-400/50" />
          <span>Barangay Area</span>
        </div>
      </div>

      <style jsx global>{`
        .custom-tooltip {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border: none;
          border-radius: 8px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #1e293b;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .custom-popup .leaflet-popup-content-wrapper {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .custom-popup .leaflet-popup-tip {
          background: rgba(255, 255, 255, 0.98);
        }
        .leaflet-container {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}

export default LeafletMap;
