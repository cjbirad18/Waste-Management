"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";
import TruckLoader from "@/app/loading/TruckLoader";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  isDark: boolean;
}

function FeatureCard({ icon, title, desc, isDark }: FeatureCardProps) {
  return (
    <div
      className={`group relative rounded-2xl shadow-lg p-8 flex flex-col items-center text-center h-full transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
        isDark
          ? "bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800"
          : "bg-white border border-gray-200 hover:border-emerald-400 hover:shadow-emerald-100"
      }`}
    >
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300"
        style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)"
            : "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)",
        }}
      >
        <span className="text-4xl">{icon}</span>
      </div>
      <div className="space-y-3">
        <h3
          className={`font-bold text-xl group-hover:text-emerald-600 transition-colors ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          {title}
        </h3>
        <p
          className={`text-sm leading-relaxed ${
            isDark ? "text-slate-400" : "text-gray-600"
          }`}
        >
          {desc}
        </p>
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
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

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
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-300 ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-gray-900 to-slate-900 text-slate-200"
          : "bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900"
      }`}
    >
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div
          className={`absolute inset-0 ${
            isDark
              ? "bg-gradient-to-br from-emerald-500/5 to-green-500/5"
              : "bg-gradient-to-br from-emerald-500/3 to-green-500/3"
          }`}
        />
      </div>

      {/* Header */}
      <header
        className={`sticky top-0 z-50 backdrop-blur-xl transition-colors duration-300 ${
          isDark
            ? "bg-slate-900/95 border-b border-slate-800 shadow-xl shadow-black/20"
            : "bg-white/95 border-b border-gray-200 shadow-lg"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div
              className={`relative h-14 w-14 rounded-xl overflow-hidden ring-2 transition-all ${
                isDark ? "ring-emerald-500/30" : "ring-emerald-500/20"
              }`}
            >
              <Image
                src="/logo.png"
                alt="Track-the-Truck logo"
                width={56}
                height={56}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-transparent">
                Track-the-Truck
              </h1>
              <p
                className={`text-xs font-medium ${
                  isDark ? "text-slate-400" : "text-gray-500"
                }`}
              >
                Tagbilaran City Waste Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-3 rounded-xl transition-all duration-300 ${
                isDark
                  ? "bg-slate-800 hover:bg-slate-700 text-yellow-400 border border-slate-700"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
              }`}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDark ? (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            <nav className="hidden lg:flex items-center gap-2">
              {roleLinks.slice(0, 3).map((role) => (
                <a
                  key={role.label}
                  href={role.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isDark
                      ? "text-slate-300 hover:text-emerald-400 hover:bg-slate-800"
                      : "text-gray-600 hover:text-emerald-600 hover:bg-emerald-50"
                  }`}
                  title={role.desc}
                >
                  {role.label}
                </a>
              ))}
              <a
                href="/login"
                className="ml-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-all"
              >
                Sign In
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-20 lg:py-28 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
            {/* Left: Content */}
            <div className="flex-1 text-center lg:text-left space-y-8">
              {/* Badge */}
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                  isDark
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-emerald-50 border border-emerald-200"
                }`}
              >
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span
                  className={`text-sm font-semibold ${
                    isDark ? "text-emerald-400" : "text-emerald-700"
                  }`}
                >
                  Live System Active
                </span>
              </div>

              {/* Heading */}
              <h1 className="text-5xl lg:text-7xl font-extrabold leading-tight">
                <span className={isDark ? "text-white" : "text-gray-900"}>
                  Smart Waste
                </span>
                <br />
                <span className="bg-gradient-to-r from-emerald-500 to-green-600 bg-clip-text text-transparent">
                  Management
                </span>
              </h1>

              {/* Description */}
              <p
                className={`text-lg lg:text-xl max-w-2xl mx-auto lg:mx-0 leading-relaxed ${
                  isDark ? "text-slate-400" : "text-gray-600"
                }`}
              >
                Real-time garbage collection monitoring, intelligent route
                optimization, and instant community reporting for Tagbilaran
                City.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2">
                <a
                  href="/login?role=swmo"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-semibold text-lg hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
                >
                  Get Started
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </a>
                <a
                  href="/login?role=resident"
                  className={`inline-flex items-center justify-center px-8 py-4 rounded-xl font-semibold text-lg transition-all ${
                    isDark
                      ? "border-2 border-slate-700 bg-slate-800/50 text-slate-200 hover:border-emerald-500/50 hover:bg-slate-800"
                      : "border-2 border-gray-300 bg-white text-gray-700 hover:border-emerald-500 hover:text-emerald-600"
                  }`}
                >
                  Resident Portal
                </a>
              </div>

              {/* Stats */}
              {!loading && counts && (
                <div
                  className={`flex flex-wrap gap-8 justify-center lg:justify-start pt-8 border-t transition-colors ${
                    isDark ? "border-slate-800" : "border-gray-200"
                  }`}
                >
                  <div>
                    <p className="text-4xl font-bold bg-gradient-to-r from-emerald-500 to-green-500 bg-clip-text text-transparent">
                      {counts.activeTrucks}
                    </p>
                    <p
                      className={`text-sm font-medium mt-1 ${
                        isDark ? "text-slate-500" : "text-gray-500"
                      }`}
                    >
                      Active Trucks
                    </p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold bg-gradient-to-r from-green-500 to-teal-500 bg-clip-text text-transparent">
                      {counts.barangaysCovered}
                    </p>
                    <p
                      className={`text-sm font-medium mt-1 ${
                        isDark ? "text-slate-500" : "text-gray-500"
                      }`}
                    >
                      Barangays
                    </p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold bg-gradient-to-r from-teal-500 to-cyan-500 bg-clip-text text-transparent">
                      {counts.residents + counts.gcps + counts.barangays}
                    </p>
                    <p
                      className={`text-sm font-medium mt-1 ${
                        isDark ? "text-slate-500" : "text-gray-500"
                      }`}
                    >
                      Active Users
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Live Status Card */}
            <div className="flex-1 w-full">
              <div className="max-w-xl mx-auto lg:mx-0">
                <div
                  className={`rounded-2xl shadow-xl p-8 backdrop-blur-sm transition-colors ${
                    isDark
                      ? "bg-slate-800/80 border border-slate-700"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></span>
                      <h3
                        className={`text-lg font-bold ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        Live Status
                      </h3>
                    </div>
                    {!loading && counts && (
                      <span
                        className={`text-xs font-mono ${
                          isDark ? "text-slate-500" : "text-gray-400"
                        }`}
                      >
                        {now.toLocaleTimeString()}
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  {loading || !counts ? (
                    <TruckLoader />
                  ) : (
                    <div className="space-y-6">
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div
                          className={`p-6 rounded-xl transition-colors ${
                            isDark
                              ? "bg-slate-700/50 border border-slate-600 hover:bg-slate-700"
                              : "bg-emerald-50 border border-emerald-100 hover:bg-emerald-100"
                          }`}
                        >
                          <p
                            className={`text-xs uppercase tracking-wider font-bold mb-2 ${
                              isDark ? "text-emerald-400" : "text-emerald-700"
                            }`}
                          >
                            Trucks
                          </p>
                          <p
                            className={`text-4xl font-bold ${
                              isDark ? "text-white" : "text-emerald-600"
                            }`}
                          >
                            {counts.activeTrucks}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isDark ? "text-slate-500" : "text-gray-500"
                            }`}
                          >
                            Active Now
                          </p>
                        </div>
                        <div
                          className={`p-6 rounded-xl transition-colors ${
                            isDark
                              ? "bg-slate-700/50 border border-slate-600 hover:bg-slate-700"
                              : "bg-green-50 border border-green-100 hover:bg-green-100"
                          }`}
                        >
                          <p
                            className={`text-xs uppercase tracking-wider font-bold mb-2 ${
                              isDark ? "text-green-400" : "text-green-700"
                            }`}
                          >
                            Coverage
                          </p>
                          <p
                            className={`text-4xl font-bold ${
                              isDark ? "text-white" : "text-green-600"
                            }`}
                          >
                            {counts.barangaysCovered}
                          </p>
                          <p
                            className={`text-xs mt-1 ${
                              isDark ? "text-slate-500" : "text-gray-500"
                            }`}
                          >
                            Barangays
                          </p>
                        </div>
                      </div>

                      {/* Reports */}
                      <div
                        className={`p-6 rounded-xl transition-colors ${
                          isDark
                            ? "bg-slate-700/30 border border-slate-600"
                            : "bg-gray-50 border border-gray-200"
                        }`}
                      >
                        <p
                          className={`text-xs uppercase tracking-wider font-bold mb-4 ${
                            isDark ? "text-slate-400" : "text-gray-600"
                          }`}
                        >
                          Community Reports
                        </p>
                        <div className="flex items-center justify-around">
                          <div className="text-center">
                            <div
                              className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-2 ${
                                isDark
                                  ? "bg-orange-500/10 border-2 border-orange-500/30"
                                  : "bg-orange-50 border-2 border-orange-200"
                              }`}
                            >
                              <p
                                className={`text-2xl font-bold ${
                                  isDark ? "text-orange-400" : "text-orange-600"
                                }`}
                              >
                                {counts.incidentReportsOpen}
                              </p>
                            </div>
                            <p
                              className={`text-xs font-medium ${
                                isDark ? "text-slate-400" : "text-gray-600"
                              }`}
                            >
                              Open
                            </p>
                          </div>
                          <div
                            className={`h-12 w-px ${
                              isDark ? "bg-slate-600" : "bg-gray-300"
                            }`}
                          />
                          <div className="text-center">
                            <div
                              className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-2 ${
                                isDark
                                  ? "bg-emerald-500/10 border-2 border-emerald-500/30"
                                  : "bg-emerald-50 border-2 border-emerald-200"
                              }`}
                            >
                              <p
                                className={`text-2xl font-bold ${
                                  isDark
                                    ? "text-emerald-400"
                                    : "text-emerald-600"
                                }`}
                              >
                                {counts.incidentReportsResolved}
                              </p>
                            </div>
                            <p
                              className={`text-xs font-medium ${
                                isDark ? "text-slate-400" : "text-gray-600"
                              }`}
                            >
                              Resolved
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role Cards */}
      <section
        className={`relative z-10 py-20 px-6 transition-colors ${
          isDark ? "bg-slate-900/50" : "bg-gray-50"
        }`}
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 transition-colors ${
                isDark
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}
            >
              Quick Access
            </span>
            <h2
              className={`text-4xl md:text-5xl font-bold mb-4 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Choose Your Role
            </h2>
            <p
              className={`text-lg max-w-2xl mx-auto ${
                isDark ? "text-slate-400" : "text-gray-600"
              }`}
            >
              Secure portal access for all waste management stakeholders
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {roleLinks.map((role, index) => (
              <a
                key={role.label}
                href={role.href}
                className={`group rounded-xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl ${
                  isDark
                    ? "bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800"
                    : "bg-white border border-gray-200 hover:border-emerald-400 hover:shadow-emerald-100"
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="text-4xl transform group-hover:scale-110 transition-transform">
                    {getRoleIcon(role.label)}
                  </div>
                  <div>
                    <h3
                      className={`text-base font-bold mb-1 transition-colors group-hover:text-emerald-600 ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {role.label}
                    </h3>
                    <p
                      className={`text-xs ${
                        isDark ? "text-slate-500" : "text-gray-500"
                      }`}
                    >
                      {role.desc}
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 transition-colors ${
                isDark
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-700"
              }`}
            >
              Platform Features
            </span>
            <h2
              className={`text-4xl md:text-5xl font-bold mb-4 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Everything You Need
            </h2>
            <p
              className={`text-lg max-w-2xl mx-auto ${
                isDark ? "text-slate-400" : "text-gray-600"
              }`}
            >
              Comprehensive tools for modern waste management
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon="🚚"
              title="Real-time Tracking"
              desc="Live GPS monitoring with route optimization and coverage analytics."
              isDark={isDark}
            />
            <FeatureCard
              icon="📱"
              title="Role-based Access"
              desc="Customized dashboards for admins, collectors, and residents."
              isDark={isDark}
            />
            <FeatureCard
              icon="🔒"
              title="Secure Platform"
              desc="Enterprise-grade authentication with role-based permissions."
              isDark={isDark}
            />
            <FeatureCard
              icon="📢"
              title="Community Reports"
              desc="Instant incident reporting with photo uploads and tracking."
              isDark={isDark}
            />
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section
        className={`relative z-10 py-20 px-6 transition-colors ${
          isDark ? "bg-slate-900/50" : "bg-emerald-50/50"
        }`}
      >
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <span
              className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mb-4 transition-colors ${
                isDark
                  ? "bg-green-500/10 border border-green-500/30 text-green-400"
                  : "bg-green-50 border border-green-200 text-green-700"
              }`}
            >
              Advanced Capabilities
            </span>
            <h2
              className={`text-4xl md:text-5xl font-bold mb-4 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Smart Solutions
            </h2>
            <p
              className={`text-lg max-w-2xl mx-auto ${
                isDark ? "text-slate-400" : "text-gray-600"
              }`}
            >
              AI-powered insights and geospatial intelligence
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon="🔔"
              title="Smart Alerts"
              desc="Automated notifications for delays, changes, and priority incidents."
              isDark={isDark}
            />
            <FeatureCard
              icon="🗺️"
              title="Interactive Maps"
              desc="Real-time visualization of zones, vehicles, and routes."
              isDark={isDark}
            />
            <FeatureCard
              icon="📊"
              title="Analytics Dashboard"
              desc="Performance metrics, trends, and operational insights."
              isDark={isDark}
            />
            <FeatureCard
              icon="👥"
              title="Community Hub"
              desc="Resident engagement with feedback and coordination tools."
              isDark={isDark}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className={`relative z-10 mt-20 transition-colors ${
          isDark
            ? "bg-slate-900 border-t border-slate-800"
            : "bg-gray-900 border-t border-gray-800"
        }`}
      >
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 rounded-lg overflow-hidden shadow-md">
                <Image
                  src="/logo.png"
                  alt="Track-the-Truck logo"
                  width={48}
                  height={48}
                  className="object-cover"
                  priority
                />
              </div>
              <div>
                <p className="text-base font-bold text-white">
                  Track-the-Truck
                </p>
                <p className="text-sm text-gray-400">
                  &copy; {new Date().getFullYear()} All rights reserved
                </p>
              </div>
            </div>

            <div className="text-center md:text-right">
              <p className="text-gray-300 font-medium">
                Serving Tagbilaran City
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Smart Waste Management System
              </p>
            </div>
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
