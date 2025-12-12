"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

function FeatureCard({ icon, title, desc }: FeatureCardProps) {
  return (
    <div className="bg-white/80 backdrop-blur border border-white/40 rounded-2xl shadow-md p-6 flex flex-col items-center text-center h-full min-h-[190px] transition-transform hover:-translate-y-1 hover:shadow-lg">
      <span className="text-4xl mb-3">{icon}</span>
      <h3 className="font-semibold mb-1 text-gray-900">{title}</h3>
      <p className="text-sm text-gray-700">{desc}</p>
    </div>
  );
}

type DashboardCounts = {
  residents: number;
  gcps: number;
  barangays: number;
  incidentReportsOpen: number;
  incidentReportsResolved: number;
  activeTrucks: number;
  barangaysCovered: number;
};

function useDashboardCountsInPage() {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCounts() {
      setLoading(true);

      let residents = 0;
      let gcps = 0;
      let barangays = 0;
      let incidentOpen = 0;
      let incidentResolved = 0;
      let activeTrucks = 0;
      let barangaysCovered = 0;

      const resResident = await supabase
        .from("users")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "Resident");
      residents = resResident.error ? 0 : resResident.count || 0;

      const resGcp = await supabase
        .from("users")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "GCP");
      gcps = resGcp.error ? 0 : resGcp.count || 0;

      const resBarangay = await supabase
        .from("users")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "BWMC");
      barangays = resBarangay.error ? 0 : resBarangay.count || 0;

      const resReportsOpen = await supabase
        .from("community_reports")
        .select("report_id", { count: "exact", head: true })
        .eq("current_status", "Open");
      incidentOpen = resReportsOpen.error ? 0 : resReportsOpen.count || 0;

      const resReportsResolved = await supabase
        .from("community_reports")
        .select("report_id", { count: "exact", head: true })
        .eq("current_status", "Resolved");
      incidentResolved = resReportsResolved.error
        ? 0
        : resReportsResolved.count || 0;

      const resTrucks = await supabase
        .from("trucks")
        .select("id", { count: "exact", head: true })
        .eq("status", "Active");
      activeTrucks = resTrucks.error ? 0 : resTrucks.count || 0;

      const resZones = await supabase
        .from("barangay") // table shown in your screenshot
        .select("*", { count: "exact", head: true });

      barangaysCovered = resZones.error ? 0 : resZones.count || 0;

      setCounts({
        residents,
        gcps,
        barangays,
        incidentReportsOpen: incidentOpen,
        incidentReportsResolved: incidentResolved,
        activeTrucks,
        barangaysCovered,
      });
      setLoading(false);
    }

    fetchCounts();
  }, []);

  return { counts, loading };
}

export default function LandingPage() {
  const { counts, loading } = useDashboardCountsInPage();

  const roleLinks = [
    {
      label: "SWMO",
      desc: "Head of the Solid Waste Management Office",
      href: "/login?role=swmo",
    },
    {
      label: "TCEMO",
      desc: "Head of the City Environmental Management Office",
      href: "/login?role=tcemo",
    },
    {
      label: "BWMC",
      desc: "Barangay Waste Management Committee",
      href: "/login?role=bwmc",
    },
    {
      label: "Secretary",
      desc: "Secretary for TCEMO and SWMO",
      href: "/login?role=secretary",
    },
    {
      label: "GCP",
      desc: "Garbage Collection Personnel",
      href: "/login?role=gcp",
    },
    {
      label: "Resident",
      desc: "Tagbilaran City residents",
      href: "/login?role=resident",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-green-50 via-white to-slate-100 font-sans text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-emerald-100">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Logo" className="w-10 h-10" />
            <div>
              <h1 className="text-xl font-extrabold text-emerald-700 tracking-tight">
                Track‑the‑Truck
              </h1>
              <p className="text-xs text-gray-500">
                Smart Waste & Community Monitoring
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar text-sm font-medium">
            {roleLinks.map((role) => (
              <a
                key={role.label}
                href={role.href}
                className="px-3 py-1.5 rounded-full whitespace-nowrap border border-transparent text-gray-700 hover:text-emerald-700 hover:border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100 transition"
                title={role.desc}
              >
                {role.label}
              </a>
            ))}
          </nav>
        </div>
      </header>
      {/* Hero + Live Snapshot */}
      <section className="relative w-full">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url("/hero-bg.jpg")' }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-green-700/80 via-emerald-400/70 to-slate-600/80"
          aria-hidden="true"
        />
        <div className="relative max-w-7xl mx-auto px-4 py-12 md:py-20 flex flex-col md:flex-row items-center gap-10">
          <div className="w-full md:w-1/2 text-white space-y-4">
            <p className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-300/60">
              Live monitoring · Route optimization · Community reports
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Modern waste collection
              <span className="block text-emerald-300">
                for Tagbilaran City
              </span>
            </h2>
            <p className="text-sm sm:text-base text-black max-w-xl">
              Track garbage trucks in real time, manage collection teams, and
              respond faster to resident reports—all in a single dashboard.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/login?role=swmo"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold shadow-md shadow-emerald-900/30 transition"
              >
                Login as Admin
              </a>
              <a
                href="/login?role=resident"
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-emerald-300/80 text-sm font-semibold text-emerald-50 hover:bg-emerald-700/40 transition"
              >
                Login as Resident
              </a>
            </div>
          </div>

          <div className="w-full md:w-1/2 flex justify-center">
            <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-xl text-emerald-50">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <span className="text-lg">📊 Live Snapshot</span>
              </h3>
              {loading || !counts ? (
                <p className="text-sm text-emerald-100">Loading latest data…</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-xs text-emerald-100">Active trucks</p>
                      <p className="text-2xl font-bold">
                        {counts.activeTrucks}
                      </p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3">
                      <p className="text-xs text-emerald-100">
                        Barangays covered
                      </p>
                      <p className="text-2xl font-bold">
                        {counts.barangaysCovered}
                      </p>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 col-span-2">
                      <p className="text-xs text-emerald-100">
                        Community reports (today)
                      </p>
                      <p className="text-xl font-semibold">
                        {counts.incidentReportsOpen} open ·{" "}
                        {counts.incidentReportsResolved} resolved
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-emerald-100/80">
                    Data shown is live from your Track‑the‑Truck database.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
      {/* Role Cards */}
      <section className="max-w-7xl mx-auto px-4 mt-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Choose your role
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
          {roleLinks.map((role) => (
            <div
              key={role.label}
              className="bg-white rounded-2xl border border-emerald-50 shadow-sm p-4 flex flex-col min-h-[170px] hover:shadow-md hover:-translate-y-0.5 transition"
            >
              <h3 className="font-semibold mb-1 text-gray-900">{role.label}</h3>
              <p className="mb-4 text-xs text-gray-600 flex-1">{role.desc}</p>
              <a
                href={role.href}
                className="mt-auto inline-flex justify-center items-center px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition"
              >
                Click to log in
              </a>
            </div>
          ))}
        </div>
      </section>
      {/* Core Features */}
      <section className="max-w-7xl mx-auto px-4 mt-12">
        <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
          Features of our system
        </h2>
        <p className="text-center text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
          Built for city administrators, barangay officials, collection crews,
          and residents to work together on cleaner streets.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <FeatureCard
            icon="🚚"
            title="Garbage Monitoring"
            desc="Real-time view of truck locations, active routes, and coverage."
          />
          <FeatureCard
            icon="📱"
            title="User-friendly Dashboards"
            desc="Role‑based dashboards tuned for admins, crews, and residents."
          />
          <FeatureCard
            icon="🛡️"
            title="Secure Access"
            desc="Supabase‑backed auth, role‑based permissions, and audit trails."
          />
          <FeatureCard
            icon="📢"
            title="Issue Reporting"
            desc="Residents can report missed pickups, overflowing bins, and more."
          />
        </div>
      </section>
      {/* Advanced Features */}
      <section className="max-w-7xl mx-auto px-4 mt-12 mb-10">
        <h2 className="text-3xl font-bold text-center mb-3 text-gray-900">
          Advanced capabilities
        </h2>
        <p className="text-center text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
          Go beyond basic tracking with alerts, analytics, and geofenced
          barangay zones powered by your GeoJSON data.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <FeatureCard
            icon="🔔"
            title="Smart Notifications"
            desc="Alerts for delays, out‑of‑zone trucks, and missed schedules."
          />
          <FeatureCard
            icon="🗺️"
            title="Live Truck Map"
            desc="Leaflet‑powered map with barangay polygons and hall markers."
          />
          <FeatureCard
            icon="📊"
            title="Analytics Dashboard"
            desc="Track collection efficiency, incident patterns, and trends."
          />
          <FeatureCard
            icon="🤝"
            title="Community Insights"
            desc="Summaries of resident reports per barangay and time period."
          />
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-emerald-700 text-emerald-100 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm">
          <p>
            &copy; {new Date().getFullYear()} Track‑the‑Truck. All rights
            reserved.
          </p>
          <p className="text-emerald-200">
            Built for Tagbilaran City waste collection and monitoring.
          </p>
        </div>
      </footer>
    </div>
  );
}
