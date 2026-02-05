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
  LineChart,
  Line,
  Legend,
} from "recharts";
import TruckLoader from "../loading/TruckLoader";

type ReportsAnalyticsProps = {
  barangayId?: number | null;
};

type WasteCollectionPoint = { month: string; tons: number };
type PerformancePoint = { month: string; efficiency: number };

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
    new Date().getMonth(),
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
          { tons: number; collected: number; total: number }
        > = {};

        for (const row of data ?? []) {
          const date = row.collection_date as string | null;
          if (!date) continue;

          const d = new Date(date);
          if (Number.isNaN(d.getTime())) continue;

          // Filter by selected month if in monthly view
          if (timePeriod === "monthly" && d.getMonth() !== selectedMonth) {
            continue;
          }

          const periodKey = getDateKey(d);

          if (!byPeriod[periodKey]) {
            byPeriod[periodKey] = { tons: 0, collected: 0, total: 0 };
          }

          const weight = Number(row.waste_weight) || 0;
          byPeriod[periodKey].tons += weight;

          byPeriod[periodKey].total += 1;
          if (row.status === "Done") {
            byPeriod[periodKey].collected += 1;
          }
        }

        const periodKeys = Object.keys(byPeriod).sort();

        const wasteData: WasteCollectionPoint[] = periodKeys.map((key) => ({
          month: key,
          tons: Number(byPeriod[key].tons.toFixed(2)),
        }));

        const perfData: PerformancePoint[] = periodKeys.map((key) => {
          const { collected, total } = byPeriod[key];
          const eff = total === 0 ? 0 : (collected / total) * 100;
          return {
            month: key,
            efficiency: Number(eff.toFixed(1)),
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
  }, [activeReportOption, barangayId, timePeriod, selectedMonth]);

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
          if (timePeriod === "monthly" && d.getMonth() !== selectedMonth) {
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

        const periodKeys = Object.keys(byPeriod).sort();

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
  }, [activeReportOption, barangayId, timePeriod, selectedMonth]);

  const handleDownloadPDF = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

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
    <section className="print-report-page space-y-6">
      <div className="print-only print-brand">Track the Truck</div>
      {/* Header Section */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-700/60 p-6 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="print-report-title text-2xl sm:text-3xl font-semibold text-emerald-200">
                Reports &amp; Analytics
              </h2>
              <p className="print-report-subtitle text-sm text-slate-400 mt-2">
                Visualize waste collection trends and barangay concerns.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDownloadPDF}
              className="no-print inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-500/50 transition-colors"
            >
              📄 PDF Report
            </button>
          </div>

          {/* Controls */}
          <div className="no-print grid grid-cols-1 lg:grid-cols-[1fr_auto] items-start gap-4">
            <div className="flex flex-wrap items-center gap-3">
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
                <button
                  onClick={() => setActiveReportOption("barangayConcerns")}
                  className={`px-3.5 py-2 rounded-md font-semibold transition-colors ${
                    activeReportOption === "barangayConcerns"
                      ? "bg-emerald-600/80 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  📍 Barangay Concerns
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Waste Collection Chart */}
                <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-6 sm:p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-green-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

                  <div className="relative z-10">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-emerald-300">
                        Monthly Waste Collected
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Waste collection metrics in tons
                      </p>
                    </div>

                    <div className="h-80 bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={wasteCollectionData}
                          margin={{ top: 20, right: 30, bottom: 60, left: 50 }}
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
                                stopColor="#2563eb"
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="1"
                                stopColor="#1d4ed8"
                                stopOpacity={0.6}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#334155"
                            opacity={0.3}
                          />
                          <XAxis
                            dataKey="month"
                            stroke="#cbd5e1"
                            tick={{
                              fill: "#cbd5e1",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />
                          <YAxis
                            stroke="#cbd5e1"
                            tick={{ fill: "#cbd5e1", fontSize: 12 }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              borderColor: "#10b981",
                              borderRadius: "12px",
                              color: "#e5e7eb",
                              fontSize: 12,
                              padding: "12px",
                              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                            }}
                            cursor={{ fill: "rgba(16, 185, 129, 0.1)" }}
                          />
                          <Bar
                            dataKey="tons"
                            fill="url(#wasteGrad)"
                            radius={[8, 8, 0, 0]}
                            name="Waste (tons)"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Efficiency Chart */}
                <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-6 sm:p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

                  <div className="relative z-10">
                    <div className="mb-6">
                      <h3 className="text-xl font-bold text-cyan-300">
                        Collection Efficiency
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        Completion rate percentage per month
                      </p>
                    </div>

                    <div className="h-80 bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={performanceData}
                          margin={{ top: 20, right: 30, bottom: 60, left: 50 }}
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
                                stopOpacity={0.8}
                              />
                              <stop
                                offset="1"
                                stopColor="#0891b2"
                                stopOpacity={0.4}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#334155"
                            opacity={0.3}
                          />
                          <XAxis
                            dataKey="month"
                            stroke="#cbd5e1"
                            tick={{
                              fill: "#cbd5e1",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          />
                          <YAxis
                            stroke="#cbd5e1"
                            tick={{ fill: "#cbd5e1", fontSize: 12 }}
                            domain={[0, 100]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1e293b",
                              borderColor: "#06b6d4",
                              borderRadius: "12px",
                              color: "#e5e7eb",
                              fontSize: 12,
                              padding: "12px",
                              boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
                            }}
                            cursor={{ fill: "rgba(6, 182, 212, 0.1)" }}
                          />
                          <Line
                            type="monotone"
                            dataKey="efficiency"
                            stroke="#06b6d4"
                            strokeWidth={3}
                            dot={{
                              r: 5,
                              strokeWidth: 2,
                              stroke: "#1e293b",
                              fill: "#06b6d4",
                            }}
                            activeDot={{ r: 7 }}
                            name="Efficiency (%)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
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
            <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[480px] bg-slate-950">
              <TruckLoader />
            </div>
          ) : errorReportData ? (
            <div className="border border-red-300 rounded-lg bg-red-50 p-6 sm:p-8 text-red-700">
              <p className="text-center font-semibold">⚠️ {errorReportData}</p>
            </div>
          ) : concernStats.length === 0 ? (
            <div className="border border-gray-300 rounded-lg bg-slate-950 p-8 text-gray-600 text-center">
              <p className="text-lg font-semibold mb-2 text-white/80">
                📭 No Data Available
              </p>
              <p className="text-sm text-white/80">
                No barangay concerns found for the selected scope.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {concernStatCards.map((card, idx) => (
                  <div
                    key={idx}
                    className={`border-2 ${card.borderColor} ${card.bgColor} rounded-lg p-6 transition-all duration-300`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700">
                        {card.label}
                      </h3>
                      <span className="text-2xl">{card.icon}</span>
                    </div>
                    <p className={`${card.color} text-3xl font-bold`}>
                      {card.value}
                    </p>
                    {card.label === "Resolved" && totalConcerns > 0 && (
                      <p className="text-xs text-gray-600 mt-2">
                        {resolutionRate}% resolution rate
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="border border-gray-300 rounded-lg bg-white p-6 sm:p-8">
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Monthly Barangay Concerns
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Status breakdown by month
                  </p>
                </div>

                <div className="h-96 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={concernStats}
                      margin={{ top: 20, right: 30, bottom: 60, left: 50 }}
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
                            stopOpacity={0.8}
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
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="1"
                            stopColor="#1d4ed8"
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
                            stopOpacity={0.8}
                          />
                          <stop
                            offset="1"
                            stopColor="#047857"
                            stopOpacity={0.6}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#e5e7eb"
                        opacity={0.5}
                      />
                      <XAxis
                        dataKey="month"
                        stroke="#6b7280"
                        tick={{
                          fill: "#6b7280",
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      />
                      <YAxis
                        stroke="#6b7280"
                        tick={{ fill: "#6b7280", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderColor: "#d1d5db",
                          borderRadius: "8px",
                          color: "#1f2937",
                          fontSize: 12,
                          padding: "12px",
                          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                        }}
                        cursor={{ fill: "rgba(37, 99, 235, 0.1)" }}
                      />
                      <Legend
                        verticalAlign="top"
                        align="right"
                        wrapperStyle={{
                          color: "#6b7280",
                          fontSize: 12,
                          fontWeight: 600,
                          paddingBottom: "20px",
                        }}
                      />
                      <Bar
                        dataKey="needsAction"
                        stackId="a"
                        fill="url(#needsActionGrad)"
                        name="Needs Action"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="ongoing"
                        stackId="a"
                        fill="url(#ongoingGrad)"
                        name="Ongoing"
                        radius={[8, 8, 0, 0]}
                      />
                      <Bar
                        dataKey="resolved"
                        stackId="a"
                        fill="url(#resolvedGrad)"
                        name="Resolved"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
