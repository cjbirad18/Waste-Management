"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import TruckLoader from "../loading/TruckLoader";
import { WasteCollectionPDFDownload } from "./WasteCollectionPDF";
import { BarangayConcernsPDFDownload } from "./BarangayConcernsPDF";

type ReportsAnalyticsProps = {
  barangayId?: number | null;
};

type WasteCollectionPoint = { month: string; tons: number };
type PerformancePoint = {
  month: string;
  efficiency: number;
  scheduled: number;
  done: number;
  missed: number;
  delayed: number;
  totalWaste: number;
};

type ConcernStatsPoint = {
  month: string;
  total: number;
  needsAction: number;
  ongoing: number;
  resolved: number;
};

type StatCard = {
  label: string;
  value: number | string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
};

export default function ReportsAnalytics({
  barangayId,
}: ReportsAnalyticsProps) {
  const [activeReportOption, setActiveReportOption] = useState<
    "wasteCollection" | "barangayConcerns"
  >("wasteCollection");

  const [timePeriod, setTimePeriod] = useState<"daily" | "weekly" | "monthly">(
    "monthly",
  );

  const [selectedMonth, setSelectedMonth] = useState<number>(
    -1, // -1 shows all months by default
  );

  const [wasteCollectionData, setWasteCollectionData] = useState<
    WasteCollectionPoint[]
  >([]);

  const [performanceData, setPerformanceData] = useState<PerformancePoint[]>(
    [],
  );

  const [concernStats, setConcernStats] = useState<ConcernStatsPoint[]>([]);

  const [loadingReportData, setLoadingReportData] = useState(true);
  const [errorReportData, setErrorReportData] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshTick((prev) => prev + 1);
      setLastRefreshedAt(new Date().toISOString());
    }, 10000); // refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Load waste collection analytics
  useEffect(() => {
    if (activeReportOption !== "wasteCollection") return;

    const loadReportsAnalytics = async () => {
      try {
        setLoadingReportData(true);
        setErrorReportData(null);

        let query = supabase.from("collection_details").select(
          `
              collection_date,
              waste_weight,
              status,
              collection_schedules!inner ( barangay_id )
            `,
        );

        if (barangayId) {
          query = query.eq("collection_schedules.barangay_id", barangayId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const getDateKey = (date: Date): string => {
          if (timePeriod === "daily") {
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          } else if (timePeriod === "weekly") {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(
              date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1),
            );
            return `Week of ${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          } else {
            return date.toLocaleString("en-US", { month: "short" });
          }
        };

        const byPeriod: Record<
          string,
          {
            tons: number;
            done: number;
            missed: number;
            delayed: number;
            total: number;
          }
        > = {};

        for (const row of data ?? []) {
          const date = row.collection_date as string | null;
          if (!date) continue;

          const d = new Date(date);
          if (Number.isNaN(d.getTime())) continue;

          // Filter by selected month if in monthly view
          if (
            timePeriod === "monthly" &&
            selectedMonth >= 0 &&
            d.getMonth() !== selectedMonth
          ) {
            continue;
          }

          const periodKey = getDateKey(d);

          if (!byPeriod[periodKey]) {
            byPeriod[periodKey] = {
              tons: 0,
              done: 0,
              missed: 0,
              delayed: 0,
              total: 0,
            };
          }

          const weight = Number(row.waste_weight) || 0;
          byPeriod[periodKey].tons += weight;

          const status = (row.status ?? "").toString().trim().toLowerCase();
          byPeriod[periodKey].total += 1;
          if (status === "done") {
            byPeriod[periodKey].done += 1;
          } else if (status === "missed") {
            byPeriod[periodKey].missed += 1;
          } else if (status === "delayed") {
            byPeriod[periodKey].delayed += 1;
          }
        }

        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        if (timePeriod === "monthly" && selectedMonth === -1) {
          monthNames.forEach((month) => {
            if (!byPeriod[month]) {
              byPeriod[month] = {
                tons: 0,
                done: 0,
                missed: 0,
                delayed: 0,
                total: 0,
              };
            }
          });
        }

        if (timePeriod === "weekly" && selectedMonth === -1) {
          const now = new Date();
          const monthIndex = now.getMonth();
          const year = now.getFullYear();
          const firstDay = new Date(year, monthIndex, 1);
          const lastDay = new Date(year, monthIndex + 1, 0);

          const getWeekStart = (date: Date) => {
            const d = new Date(date);
            const day = d.getDay();
            d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
            return d;
          };

          let weekStart = getWeekStart(firstDay);
          while (weekStart <= lastDay) {
            const weekKey = `Week of ${weekStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}`;
            if (!byPeriod[weekKey]) {
              byPeriod[weekKey] = {
                tons: 0,
                done: 0,
                missed: 0,
                delayed: 0,
                total: 0,
              };
            }
            weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          }
        }

        const periodKeys = Object.keys(byPeriod).sort((a, b) => {
          const weekPrefix = "Week of ";
          if (a.startsWith(weekPrefix) && b.startsWith(weekPrefix)) {
            const aDate = new Date(a.replace(weekPrefix, ""));
            const bDate = new Date(b.replace(weekPrefix, ""));
            return aDate.getTime() - bDate.getTime();
          }

          const aIndex = monthNames.indexOf(a);
          const bIndex = monthNames.indexOf(b);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          return a.localeCompare(b);
        });

        const wasteData: WasteCollectionPoint[] = periodKeys.map((key) => ({
          month: key,
          tons: Number(byPeriod[key].tons.toFixed(2)),
        }));

        const perfData: PerformancePoint[] = periodKeys.map((key) => {
          const { done, missed, delayed, total, tons } = byPeriod[key];
          const eff = total === 0 ? 0 : (done / total) * 100;
          return {
            month: key,
            efficiency: Number(eff.toFixed(1)),
            scheduled: total,
            done,
            missed,
            delayed,
            totalWaste: Number(tons.toFixed(2)),
          };
        });

        setWasteCollectionData(wasteData);
        setPerformanceData(perfData);
      } catch (err: any) {
        console.error(err);
        setErrorReportData(err.message ?? "Failed to load report data.");
      } finally {
        setLoadingReportData(false);
      }
    };

    loadReportsAnalytics();
  }, [activeReportOption, barangayId, timePeriod, selectedMonth, refreshTick]);

  // Load barangay concerns analytics
  useEffect(() => {
    if (activeReportOption !== "barangayConcerns") return;

    const loadBarangayConcerns = async () => {
      try {
        setLoadingReportData(true);
        setErrorReportData(null);

        let query = supabase
          .from("community_reports")
          .select("date_submitted, current_status, barangay_id");

        if (barangayId) {
          query = query.eq("barangay_id", barangayId);
        }

        const { data, error } = await query;

        if (error) throw error;

        const getDateKey = (date: Date): string => {
          if (timePeriod === "daily") {
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          } else if (timePeriod === "weekly") {
            const startOfWeek = new Date(date);
            startOfWeek.setDate(
              date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1),
            );
            return `Week of ${startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
          } else {
            return date.toLocaleString("en-US", { month: "short" });
          }
        };

        const byPeriod: Record<
          string,
          {
            total: number;
            needsAction: number;
            ongoing: number;
            resolved: number;
          }
        > = {};

        for (const row of data ?? []) {
          const date = row.date_submitted as string | null;
          if (!date) continue;

          const d = new Date(date);
          if (Number.isNaN(d.getTime())) continue;

          // Filter by selected month if in monthly view
          if (
            timePeriod === "monthly" &&
            selectedMonth >= 0 &&
            d.getMonth() !== selectedMonth
          ) {
            continue;
          }

          const periodKey = getDateKey(d);

          if (!byPeriod[periodKey]) {
            byPeriod[periodKey] = {
              total: 0,
              needsAction: 0,
              ongoing: 0,
              resolved: 0,
            };
          }

          byPeriod[periodKey].total += 1;

          switch (row.current_status) {
            case "Needs Action":
              byPeriod[periodKey].needsAction += 1;
              break;
            case "Ongoing":
              byPeriod[periodKey].ongoing += 1;
              break;
            case "Resolved":
              byPeriod[periodKey].resolved += 1;
              break;
            default:
              break;
          }
        }

        const monthNames = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        if (timePeriod === "monthly" && selectedMonth === -1) {
          monthNames.forEach((month) => {
            if (!byPeriod[month]) {
              byPeriod[month] = {
                total: 0,
                needsAction: 0,
                ongoing: 0,
                resolved: 0,
              };
            }
          });
        }

        if (timePeriod === "weekly" && selectedMonth === -1) {
          const now = new Date();
          const monthIndex = now.getMonth();
          const year = now.getFullYear();
          const firstDay = new Date(year, monthIndex, 1);
          const lastDay = new Date(year, monthIndex + 1, 0);

          const getWeekStart = (date: Date) => {
            const d = new Date(date);
            const day = d.getDay();
            d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
            return d;
          };

          let weekStart = getWeekStart(firstDay);
          while (weekStart <= lastDay) {
            const weekKey = `Week of ${weekStart.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}`;
            if (!byPeriod[weekKey]) {
              byPeriod[weekKey] = {
                total: 0,
                needsAction: 0,
                ongoing: 0,
                resolved: 0,
              };
            }
            weekStart = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          }
        }

        const periodKeys = Object.keys(byPeriod).sort((a, b) => {
          const weekPrefix = "Week of ";
          if (a.startsWith(weekPrefix) && b.startsWith(weekPrefix)) {
            const aDate = new Date(a.replace(weekPrefix, ""));
            const bDate = new Date(b.replace(weekPrefix, ""));
            return aDate.getTime() - bDate.getTime();
          }

          const aIndex = monthNames.indexOf(a);
          const bIndex = monthNames.indexOf(b);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          return a.localeCompare(b);
        });

        const stats: ConcernStatsPoint[] = periodKeys.map((key) => ({
          month: key,
          total: byPeriod[key].total,
          needsAction: byPeriod[key].needsAction,
          ongoing: byPeriod[key].ongoing,
          resolved: byPeriod[key].resolved,
        }));

        setConcernStats(stats);
      } catch (err: any) {
        console.error(err);
        setErrorReportData(err.message ?? "Failed to load concerns data.");
      } finally {
        setLoadingReportData(false);
      }
    };

    loadBarangayConcerns();
  }, [activeReportOption, barangayId, timePeriod, selectedMonth, refreshTick]);

  // Calculate waste collection stats
  const totalWaste = wasteCollectionData.reduce(
    (sum, item) => sum + item.tons,
    0,
  );
  const avgWaste =
    wasteCollectionData.length > 0
      ? (totalWaste / wasteCollectionData.length).toFixed(2)
      : "0";
  const maxWaste =
    wasteCollectionData.length > 0
      ? Math.max(...wasteCollectionData.map((item) => item.tons)).toFixed(2)
      : "0";

  // Calculate efficiency stats
  const avgEfficiency =
    performanceData.length > 0
      ? (
          performanceData.reduce((sum, item) => sum + item.efficiency, 0) /
          performanceData.length
        ).toFixed(1)
      : "0";

  // Calculate concern stats
  const totalConcerns = concernStats.reduce((sum, item) => sum + item.total, 0);
  const totalNeedsAction = concernStats.reduce(
    (sum, item) => sum + item.needsAction,
    0,
  );
  const totalOngoing = concernStats.reduce(
    (sum, item) => sum + item.ongoing,
    0,
  );
  const totalResolved = concernStats.reduce(
    (sum, item) => sum + item.resolved,
    0,
  );
  const resolutionRate =
    totalConcerns > 0 ? Math.round((totalResolved / totalConcerns) * 100) : 0;

  const wasteStatCards: StatCard[] = [
    {
      label: "Total Waste Collected",
      value: `${totalWaste.toFixed(2)} tons`,
      icon: "🗑️",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
    {
      label: "Average Per Month",
      value: `${avgWaste} tons`,
      icon: "📊",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    {
      label: "Peak Month",
      value: `${maxWaste} tons`,
      icon: "📈",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
    },
    {
      label: "Avg Efficiency",
      value: `${avgEfficiency}%`,
      icon: "⚡",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
    },
  ];

  const concernStatCards: StatCard[] = [
    {
      label: "Total Reports",
      value: totalConcerns,
      icon: "📋",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    {
      label: "Needs Action",
      value: totalNeedsAction,
      icon: "⚠️",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
    },
    {
      label: "Ongoing",
      value: totalOngoing,
      icon: "🔄",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
    },
    {
      label: "Resolved",
      value: totalResolved,
      icon: "✅",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
  ];

  return (
    <section className="print-report-page space-y-8 px-1 py-8 xl:px-1">
      <div className="print-only print-brand">Track the Truck</div>
      {/* Header Section */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-8 sm:p-10">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="print-report-title text-2xl sm:text-3xl font-semibold text-emerald-200">
                Reports &amp; Analytics
              </h2>
              <p className="print-report-subtitle text-sm text-slate-400 mt-2">
                Visualize waste collection trends and barangay concerns.
              </p>
            </div>

            <div className="no-print">
              {activeReportOption === "wasteCollection" ? (
                <WasteCollectionPDFDownload
                  wasteData={wasteCollectionData}
                  performanceData={performanceData}
                  timePeriod={timePeriod}
                  barangayName={
                    barangayId ? `Barangay ${barangayId}` : undefined
                  }
                />
              ) : (
                <BarangayConcernsPDFDownload
                  concernData={concernStats}
                  barangayName={
                    barangayId ? `Barangay ${barangayId}` : undefined
                  }
                  viewMode="Monthly"
                />
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="no-print grid grid-cols-1 lg:grid-cols-[1fr_auto] items-start gap-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex rounded-lg bg-slate-950/60 border border-slate-700/60 p-1 text-sm">
                <button
                  onClick={() => setActiveReportOption("wasteCollection")}
                  className={`px-3.5 py-2 rounded-md font-semibold transition-colors ${
                    activeReportOption === "wasteCollection"
                      ? "bg-emerald-600/80 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  🗑️ Waste Collection
                </button>
              </div>

              <div className="inline-flex rounded-lg bg-slate-950/60 border border-slate-700/60 p-1 text-sm">
                <button
                  onClick={() => setTimePeriod("daily")}
                  className={`px-3.5 py-2 rounded-md font-semibold transition-colors ${
                    timePeriod === "daily"
                      ? "bg-blue-600/80 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  📅 Daily
                </button>
                <button
                  onClick={() => setTimePeriod("weekly")}
                  className={`px-3.5 py-2 rounded-md font-semibold transition-colors ${
                    timePeriod === "weekly"
                      ? "bg-blue-600/80 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  📊 Weekly
                </button>
                <button
                  onClick={() => setTimePeriod("monthly")}
                  className={`px-3.5 py-2 rounded-md font-semibold transition-colors ${
                    timePeriod === "monthly"
                      ? "bg-blue-600/80 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  📈 Monthly
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {timePeriod === "monthly" && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3.5 py-2 text-sm font-semibold rounded-lg bg-slate-950/60 border border-slate-700/60 text-slate-200 transition-colors focus:outline-none focus:border-emerald-500/80 cursor-pointer"
                >
                  <option value={-1}>All Months</option>
                  <option value="0">January</option>
                  <option value="1">February</option>
                  <option value="2">March</option>
                  <option value="3">April</option>
                  <option value="4">May</option>
                  <option value="5">June</option>
                  <option value="6">July</option>
                  <option value="7">August</option>
                  <option value="8">September</option>
                  <option value="9">October</option>
                  <option value="10">November</option>
                  <option value="11">December</option>
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Waste Collection Section */}
      {activeReportOption === "wasteCollection" && (
        <>
          {loadingReportData ? (
            <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[480px] bg-slate-950">
              <TruckLoader />
            </div>
          ) : errorReportData ? (
            <div className="border border-red-300 rounded-lg bg-red-50 p-6 sm:p-8 text-red-700">
              <p className="text-center font-semibold">⚠️ {errorReportData}</p>
            </div>
          ) : (
            <>
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {wasteStatCards.map((card, idx) => (
                  <div
                    key={idx}
                    className={`group relative rounded-2xl ${card.bgColor} border ${card.borderColor} p-6 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden`}
                  >
                    <div
                      className={`absolute inset-0 ${card.bgColor} opacity-0 group-hover:opacity-50 transition-opacity blur-xl`}
                    />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-300">
                          {card.label}
                        </h3>
                        <span className="text-2xl">{card.icon}</span>
                      </div>
                      <p className={`${card.color} text-3xl font-bold`}>
                        {card.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Waste Collection Chart */}
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl shadow-xl backdrop-blur-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-slate-700/50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-100">
                          Monthly Waste Collected
                        </h3>
                        <p className="text-xs text-emerald-400/70 font-medium uppercase tracking-wider mt-0.5">
                          Tons per month
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="h-72 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                      {wasteCollectionData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                          No waste data for selected period.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={wasteCollectionData}
                            margin={{
                              top: 10,
                              right: 20,
                              bottom: 40,
                              left: 40,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id="wasteGrad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0"
                                  stopColor="#10b981"
                                  stopOpacity={0.9}
                                />
                                <stop
                                  offset="1"
                                  stopColor="#059669"
                                  stopOpacity={0.6}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#334155"
                              opacity={0.2}
                            />
                            <XAxis
                              dataKey="month"
                              stroke="#64748b"
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              axisLine={{ stroke: "#334155" }}
                            />
                            <YAxis
                              stroke="#64748b"
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              axisLine={{ stroke: "#334155" }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                borderColor: "#10b981",
                                borderRadius: "8px",
                                color: "#e2e8f0",
                                fontSize: "12px",
                                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                              }}
                              cursor={{ fill: "rgba(16, 185, 129, 0.1)" }}
                            />
                            <Bar
                              dataKey="tons"
                              fill="url(#wasteGrad)"
                              radius={[6, 6, 0, 0]}
                              name="Waste (tons)"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>

                {/* Efficiency Chart */}
                <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl shadow-xl backdrop-blur-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-cyan-600/20 to-blue-600/20 border-b border-slate-700/50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="ml-auto grid w-full grid-cols-1 gap-2 text-xs text-slate-100 sm:grid-cols-2 xl:grid-cols-3">
                        {[
                          {
                            label: "Scheduled",
                            value: performanceData.reduce(
                              (sum, p) => sum + p.scheduled,
                              0,
                            ),
                            style:
                              "bg-cyan-500/10 text-cyan-200 border-cyan-500/30",
                          },
                          {
                            label: "Done",
                            value: performanceData.reduce(
                              (sum, p) => sum + p.done,
                              0,
                            ),
                            style:
                              "bg-emerald-500/10 text-emerald-200 border-emerald-500/30",
                          },
                          {
                            label: "Missed",
                            value: performanceData.reduce(
                              (sum, p) => sum + p.missed,
                              0,
                            ),
                            style:
                              "bg-rose-500/10 text-rose-200 border-rose-500/30",
                          },
                          {
                            label: "Delayed",
                            value: performanceData.reduce(
                              (sum, p) => sum + p.delayed,
                              0,
                            ),
                            style:
                              "bg-amber-500/10 text-amber-200 border-amber-500/30",
                          },
                          {
                            label: "Total Waste (t)",
                            value: performanceData
                              .reduce((sum, p) => sum + p.totalWaste, 0)
                              .toFixed(2),
                            style:
                              "bg-sky-500/10 text-sky-200 border-sky-500/30",
                          },
                          {
                            label: "Avg Efficiency",
                            value:
                              performanceData.length > 0
                                ? (
                                    performanceData.reduce(
                                      (sum, p) => sum + p.efficiency,
                                      0,
                                    ) / performanceData.length
                                  ).toFixed(1) + "%"
                                : "0%",
                            style:
                              "bg-violet-500/10 text-violet-200 border-violet-500/30",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className={`rounded-lg border px-2 py-1.5 ${item.style}`}
                          >
                            <div className="text-[10px] tracking-wide uppercase text-slate-300">
                              {item.label}
                            </div>
                            <div className="mt-0.5 text-sm font-bold text-white">
                              {item.value}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-cyan-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-100">
                          Collection Efficiency
                        </h3>
                        <p className="text-xs text-cyan-400/70 font-medium uppercase tracking-wider mt-0.5">
                          Completion rate %
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="h-72 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                      {performanceData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                          No efficiency data for selected period.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={performanceData}
                            margin={{
                              top: 10,
                              right: 20,
                              bottom: 40,
                              left: 40,
                            }}
                          >
                            <defs>
                              <linearGradient
                                id="effGrad"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="0"
                                  stopColor="#06b6d4"
                                  stopOpacity={0.9}
                                />
                                <stop
                                  offset="1"
                                  stopColor="#0891b2"
                                  stopOpacity={0.6}
                                />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#334155"
                              opacity={0.2}
                            />
                            <XAxis
                              dataKey="month"
                              stroke="#64748b"
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              axisLine={{ stroke: "#334155" }}
                            />
                            <YAxis
                              yAxisId="left"
                              stroke="#64748b"
                              tick={{ fill: "#94a3b8", fontSize: 11 }}
                              axisLine={{ stroke: "#334155" }}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              stroke="#38bdf8"
                              tick={{ fill: "#38bdf8", fontSize: 11 }}
                              domain={[0, 100]}
                              axisLine={{ stroke: "#334155" }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                borderColor: "#06b6d4",
                                borderRadius: "8px",
                                color: "#e2e8f0",
                                fontSize: "12px",
                                boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                              }}
                              cursor={{ fill: "rgba(6, 182, 212, 0.1)" }}
                            />
                            <Bar
                              dataKey="scheduled"
                              yAxisId="left"
                              fill="#38bdf8"
                              radius={[6, 6, 0, 0]}
                              name="Scheduled"
                            />
                            <Bar
                              dataKey="done"
                              yAxisId="left"
                              fill="#34d399"
                              radius={[6, 6, 0, 0]}
                              name="Done"
                            />
                            <Bar
                              dataKey="efficiency"
                              yAxisId="right"
                              fill="url(#effGrad)"
                              radius={[6, 6, 0, 0]}
                              name="Efficiency (%)"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Barangay Concerns Section */}
      {activeReportOption === "barangayConcerns" && (
        <>
          {loadingReportData ? (
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-8 backdrop-blur-xl">
              <TruckLoader />
            </div>
          ) : errorReportData ? (
            <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-6">
              <svg
                className="w-6 h-6 text-red-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="text-sm font-medium text-red-200">
                {errorReportData}
              </span>
            </div>
          ) : concernStats.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/60 border border-slate-700/50 rounded-2xl border-dashed">
              <svg
                className="w-16 h-16 mx-auto text-slate-600 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p className="text-base font-semibold text-slate-300 mb-1">
                No Data Available
              </p>
              <p className="text-sm text-slate-500">
                No barangay concerns found for the selected scope.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {concernStatCards.map((card, idx) => (
                  <div
                    key={idx}
                    className={`bg-slate-900/60 border rounded-xl p-5 backdrop-blur-xl transition-all duration-200 hover:border-opacity-70 ${
                      card.label === "Needs Action"
                        ? "border-amber-500/30 hover:border-amber-500/50"
                        : card.label === "Ongoing"
                          ? "border-blue-500/30 hover:border-blue-500/50"
                          : card.label === "Resolved"
                            ? "border-emerald-500/30 hover:border-emerald-500/50"
                            : "border-slate-500/30 hover:border-slate-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {card.label}
                      </span>
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          card.label === "Needs Action"
                            ? "bg-amber-500/10 text-amber-400"
                            : card.label === "Ongoing"
                              ? "bg-blue-500/10 text-blue-400"
                              : card.label === "Resolved"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          {card.label === "Needs Action" && (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          )}
                          {card.label === "Ongoing" && (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m15.356 2H20M20 20v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H20"
                            />
                          )}
                          {card.label === "Resolved" && (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          )}
                          {card.label === "Total Reports" && (
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                          )}
                        </svg>
                      </div>
                    </div>
                    <p
                      className={`text-3xl font-bold ${
                        card.label === "Needs Action"
                          ? "text-amber-400"
                          : card.label === "Ongoing"
                            ? "text-blue-400"
                            : card.label === "Resolved"
                              ? "text-emerald-400"
                              : "text-slate-200"
                      }`}
                    >
                      {card.value}
                    </p>
                    {card.label === "Resolved" && totalConcerns > 0 && (
                      <p className="text-xs text-slate-500 mt-2">
                        {resolutionRate}% resolution rate
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl shadow-xl backdrop-blur-xl overflow-hidden">
                <div className="bg-gradient-to-r from-amber-600/20 via-blue-600/20 to-emerald-600/20 border-b border-slate-700/50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-700/50 border border-slate-600/50 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-slate-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">
                        Monthly Barangay Concerns
                      </h3>
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mt-0.5">
                        Status breakdown by month
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <div className="h-80 bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={concernStats}
                        margin={{ top: 10, right: 20, bottom: 40, left: 40 }}
                      >
                        <defs>
                          <linearGradient
                            id="needsActionGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0"
                              stopColor="#f59e0b"
                              stopOpacity={0.9}
                            />
                            <stop
                              offset="1"
                              stopColor="#d97706"
                              stopOpacity={0.6}
                            />
                          </linearGradient>
                          <linearGradient
                            id="ongoingGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0"
                              stopColor="#3b82f6"
                              stopOpacity={0.9}
                            />
                            <stop
                              offset="1"
                              stopColor="#2563eb"
                              stopOpacity={0.6}
                            />
                          </linearGradient>
                          <linearGradient
                            id="resolvedGrad"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0"
                              stopColor="#10b981"
                              stopOpacity={0.9}
                            />
                            <stop
                              offset="1"
                              stopColor="#059669"
                              stopOpacity={0.6}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#334155"
                          opacity={0.2}
                        />
                        <XAxis
                          dataKey="month"
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          axisLine={{ stroke: "#334155" }}
                        />
                        <YAxis
                          stroke="#64748b"
                          tick={{ fill: "#94a3b8", fontSize: 11 }}
                          axisLine={{ stroke: "#334155" }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#334155",
                            borderRadius: "8px",
                            color: "#e2e8f0",
                            fontSize: "12px",
                            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                          }}
                          cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
                        />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          wrapperStyle={{
                            color: "#94a3b8",
                            fontSize: "11px",
                            paddingBottom: "15px",
                          }}
                        />
                        <Bar
                          dataKey="needsAction"
                          fill="url(#needsActionGrad)"
                          name="Needs Action"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="ongoing"
                          fill="url(#ongoingGrad)"
                          name="Ongoing"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="resolved"
                          fill="url(#resolvedGrad)"
                          name="Resolved"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
