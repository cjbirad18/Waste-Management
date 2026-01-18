"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

function FeatureCard({ icon, title, desc }: FeatureCardProps) {
  return (
    <div className="group relative bg-gradient-to-br from-slate-800/90 to-gray-800/90 border border-green-800/40 backdrop-blur-xl rounded-3xl shadow-2xl shadow-green-900/20 p-8 flex flex-col items-center text-center h-full min-h-[220px] transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] hover:shadow-3xl hover:shadow-green-600/30 hover:border-green-600/60 text-slate-200 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 via-transparent to-emerald-500/8 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

      <div className="relative z-10 flex flex-col items-center space-y-4">
        <div className="relative p-4 bg-gradient-to-br from-green-900/80 to-emerald-900/80 rounded-2xl shadow-xl group-hover:scale-110 transition-all duration-500 border border-green-700/50">
          <span className="text-3xl drop-shadow-lg">{icon}</span>
        </div>
        <h3 className="font-bold text-xl bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent drop-shadow-sm">
          {title}
        </h3>
        <p className="text-base text-slate-300 leading-relaxed">{desc}</p>
      </div>
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
        .from("barangay")
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
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-900/80 text-slate-200 font-sans">
      {/* Dark subtle animated background */}
      <div className="fixed inset-0 opacity-40">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 animate-pulse" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-green-800/40 bg-slate-900/95 backdrop-blur-2xl shadow-xl shadow-green-900/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between md:gap-3">
          <div className="flex items-center gap-4">
            <div className="relative h-25 w-25 rounded-2xl ">
              <Image
                src="/logo.png"
                alt="Track-the-Truck logo"
                width={100}
                height={100}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-sm uppercase tracking-wide font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Track‑the‑Truck
              </p>
              <p className="text-xs text-emerald-400 font-medium">
                Tagbilaran City Waste Management and Community Reporting System
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold justify-center md:justify-start">
            {roleLinks.map((role) => (
              <a
                key={role.label}
                href={role.href}
                className="group relative whitespace-nowrap rounded-2xl border-2 border-green-800/50 bg-slate-800/80 px-5 py-2.5 text-slate-200 hover:border-green-500/70 hover:text-emerald-300 hover:bg-green-500/10 hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 backdrop-blur-xl shadow-md"
                title={role.desc}
              >
                <span className="relative z-10">{role.label}</span>
                <div className="absolute -inset-1 bg-green-500/15 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* Hero + Live Snapshot */}
      <section className="relative z-10 w-full">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 px-6 py-20 md:flex-row md:py-24 lg:gap-20">
          <div className="w-full space-y-6 md:w-1/2">
            <div className="inline-flex items-center rounded-2xl border border-green-800/50 bg-slate-800/90 px-6 py-3 text-sm font-semibold text-emerald-300 backdrop-blur-xl shadow-lg shadow-green-900/20">
              📊 Live Data · 🚛 Real-time Tracking · 🔔 Smart Alerts
            </div>
            <h2 className="text-5xl font-bold leading-tight bg-gradient-to-r from-slate-100 via-green-300 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl md:text-6xl">
              Smart Waste Collection
              <span className="block bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-extrabold">
                for Tagbilaran City
              </span>
            </h2>
            <p className="max-w-lg text-xl text-slate-300 leading-relaxed">
              Monitor garbage trucks in real-time, optimize collection routes,
              and respond instantly to community reports—all from one modern
              dashboard.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/login?role=swmo"
                className="group relative inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-green-600/90 to-emerald-600/90 px-8 py-4 text-lg font-bold text-slate-100 shadow-2xl shadow-green-500/30 hover:shadow-3xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl overflow-hidden"
              >
                <span>Admin Dashboard →</span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </a>
              <a
                href="/login?role=resident"
                className="inline-flex items-center justify-center rounded-xl border-2 border-emerald-500/60 bg-slate-800/90 px-8 py-4 text-lg font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400 backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/30"
              >
                Resident Portal
              </a>
            </div>
          </div>

          <div className="w-full md:w-1/2">
            <div className="relative group">
              <div className="w-full max-w-lg mx-auto rounded-3xl border border-green-800/50 bg-gradient-to-br from-slate-800/95 to-gray-800/95 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 to-emerald-500/8 rounded-3xl" />

                <h3 className="mb-8 flex items-center gap-3 text-xl font-bold text-emerald-400 relative z-10">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-md" />
                  Live System Status
                </h3>

                {loading || !counts ? (
                  <div className="flex flex-col items-center gap-6 text-center">
                    <div className="w-12 h-12 border-4 border-emerald-800/50 border-t-emerald-500 rounded-full animate-spin mx-auto shadow-lg" />
                    <p className="text-lg text-emerald-400 font-semibold">
                      Loading live data...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      <div className="group relative p-6 rounded-2xl bg-gradient-to-b from-slate-700/90 to-gray-700/90 border border-green-800/50 hover:bg-green-500/10 transition-all duration-300 backdrop-blur-xl">
                        <p className="text-sm text-emerald-400 uppercase tracking-wide font-semibold mb-2">
                          Active Trucks
                        </p>
                        <p className="text-4xl font-black text-green-400 drop-shadow-lg">
                          {counts.activeTrucks}
                        </p>
                      </div>
                      <div className="group relative p-6 rounded-2xl bg-gradient-to-b from-slate-700/90 to-gray-700/90 border border-emerald-800/50 hover:bg-emerald-500/10 transition-all duration-300 backdrop-blur-xl">
                        <p className="text-sm text-emerald-400 uppercase tracking-wide font-semibold mb-2">
                          Barangays Covered
                        </p>
                        <p className="text-4xl font-black text-emerald-400 drop-shadow-lg">
                          {counts.barangaysCovered}
                        </p>
                      </div>
                    </div>
                    <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-700/90 to-gray-700/90 border border-green-800/50 relative backdrop-blur-xl">
                      <p className="text-sm text-slate-400 uppercase tracking-wide font-semibold mb-4">
                        Today's Reports
                      </p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-orange-400 drop-shadow-md">
                            {counts.incidentReportsOpen}
                          </p>
                          <p className="text-xs text-orange-300 font-medium">
                            Open
                          </p>
                        </div>
                        <div className="w-px h-12 bg-emerald-500/50 mx-6" />
                        <div>
                          <p className="text-2xl font-bold text-emerald-400 drop-shadow-md">
                            {counts.incidentReportsResolved}
                          </p>
                          <p className="text-xs text-emerald-300 font-medium">
                            Resolved
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {!loading && counts && (
                  <p className="mt-6 text-sm text-emerald-400 text-center font-medium pt-4 border-t border-green-800/50 relative z-10">
                    Time{" "}
                    <span className="font-semibold text-emerald-300">
                      {now.toLocaleTimeString()}
                    </span>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Cards */}
      <section className="mx-auto max-w-7xl px-6 py-5 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent drop-shadow-2xl mb-4">
            Choose Your Role
          </h2>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Access your personalized dashboard for waste management operations
          </p>
        </div>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {roleLinks.map((role, index) => (
            <div
              key={role.label}
              className="group relative flex flex-col rounded-3xl border border-green-800/50 bg-gradient-to-br from-slate-800/90 to-gray-800/90 p-8 shadow-2xl shadow-green-900/20 backdrop-blur-xl hover:border-green-600/70 hover:shadow-3xl hover:shadow-green-600/40 hover:-translate-y-4 transition-all duration-500 overflow-hidden"
              style={{ animationDelay: `${index * 75}ms` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/8 to-emerald-500/8 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="relative z-10 flex flex-col items-center space-y-4 h-full justify-center">
                <div className="text-4xl group-hover:scale-110 transition-transform duration-500 drop-shadow-lg">
                  {getRoleIcon(role.label)}
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent drop-shadow-lg">
                  {role.label}
                </h3>
                <p className="text-sm text-slate-300 text-center leading-relaxed">
                  {role.desc}
                </p>
                <a
                  href={role.href}
                  className="mt-auto inline-flex items-center justify-center w-full rounded-2xl bg-gradient-to-r from-green-600/90 to-emerald-600/90 px-6 py-3 text-sm font-bold text-slate-100 shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-105 transition-all duration-300 backdrop-blur-xl"
                >
                  Login →
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 py-5 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl mb-6">
            Core Features
          </h2>
          <p className="max-w-3xl mx-auto text-xl text-slate-300">
            Modern tools built for efficient waste collection and community
            collaboration
          </p>
        </div>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon="🚚"
            title="Real-time Tracking"
            desc="Live GPS locations, route optimization, and collection coverage."
          />
          <FeatureCard
            icon="📱"
            title="Role-based Dashboards"
            desc="Custom interfaces for admins, collectors, and residents."
          />
          <FeatureCard
            icon="🔒"
            title="Secure Authentication"
            desc="Supabase auth with role-based access control."
          />
          <FeatureCard
            icon="📢"
            title="Community Reports"
            desc="Instant reporting for missed pickups and issues."
          />
        </div>
      </section>

      {/* Advanced Features */}
      <section className="mx-auto max-w-7xl px-6 py-24 relative z-10 bg-slate-800/50 backdrop-blur-2xl rounded-3xl border border-green-800/30 border-t-4 border-t-emerald-500/50">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-bold bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl mb-6">
            Advanced Tools
          </h2>
          <p className="max-w-3xl mx-auto text-xl text-slate-300">
            Smart features powered by geospatial data and real-time analytics
          </p>
        </div>
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon="🔔"
            title="Smart Notifications"
            desc="Alerts for delays, schedule changes, and priority issues."
          />
          <FeatureCard
            icon="🗺️"
            title="Interactive Maps"
            desc="Barangay zones, truck positions, and route visualization."
          />
          <FeatureCard
            icon="📊"
            title="Performance Analytics"
            desc="Collection efficiency, trends, and operational insights."
          />
          <FeatureCard
            icon="👥"
            title="Community Dashboard"
            desc="Resident feedback and barangay-level reporting."
          />
        </div>
      </section>
      <br />

      {/* Footer */}
      <footer className="bg-gradient-to-r from-slate-900 to-emerald-900/80 text-slate-200 border-t border-green-800/50 relative z-10">
        <div className="mx-auto max-w-7xl px-6 py-1">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row md:items-center">
            <div className="flex items-center gap-3 text-emerald-300">
              <Image
                src="/logo.png"
                alt="Track-the-Truck logo"
                width={100}
                height={100}
                className="object-contain"
                priority
              />
              <span>&copy; {new Date().getFullYear()} Track-the-Truck</span>
            </div>
            <p className="text-emerald-400/80 font-medium text-center md:text-right">
              Serving Tagbilaran City Waste Management Operations
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function getRoleIcon(role: string): string {
  const icons: Record<string, string> = {
    SWMO: "👑",
    TCEMO: "🏛️",
    BWMC: "🏘️",
    Secretary: "📋",
    GCP: "🚛",
    Resident: "👤",
  };
  return icons[role] || "👤";
}
