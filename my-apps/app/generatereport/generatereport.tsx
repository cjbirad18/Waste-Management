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

        const byMonth: Record<
          string,
          { tons: number; collected: number; total: number }
        > = {};

        for (const row of data ?? []) {
          const date = row.collection_date as string | null;
          if (!date) continue;

          const d = new Date(date);
          if (Number.isNaN(d.getTime())) continue;

          const monthKey = d.toLocaleString("en-US", { month: "short" });

          if (!byMonth[monthKey]) {
            byMonth[monthKey] = { tons: 0, collected: 0, total: 0 };
          }

          const weight = Number(row.waste_weight) || 0;
          byMonth[monthKey].tons += weight;

          byMonth[monthKey].total += 1;
          if (row.status === "Done") {
            byMonth[monthKey].collected += 1;
          }
        }

        const orderedMonths = [
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

        const wasteData: WasteCollectionPoint[] = orderedMonths
          .filter((m) => byMonth[m])
          .map((m) => ({
            month: m,
            tons: Number(byMonth[m].tons.toFixed(2)),
          }));

        const perfData: PerformancePoint[] = orderedMonths
          .filter((m) => byMonth[m])
          .map((m) => {
            const { collected, total } = byMonth[m];
            const eff = total === 0 ? 0 : (collected / total) * 100;
            return {
              month: m,
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
  }, [activeReportOption, barangayId]);

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

        const byMonth: Record<
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

          const monthKey = d.toLocaleString("en-US", { month: "short" });

          if (!byMonth[monthKey]) {
            byMonth[monthKey] = {
              total: 0,
              needsAction: 0,
              ongoing: 0,
              resolved: 0,
            };
          }

          byMonth[monthKey].total += 1;

          switch (row.current_status) {
            case "Needs Action":
              byMonth[monthKey].needsAction += 1;
              break;
            case "Ongoing":
              byMonth[monthKey].ongoing += 1;
              break;
            case "Resolved":
              byMonth[monthKey].resolved += 1;
              break;
            default:
              break;
          }
        }

        const orderedMonths = [
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

        const stats: ConcernStatsPoint[] = orderedMonths
          .filter((m) => byMonth[m])
          .map((m) => ({
            month: m,
            total: byMonth[m].total,
            needsAction: byMonth[m].needsAction,
            ongoing: byMonth[m].ongoing,
            resolved: byMonth[m].resolved,
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
  }, [activeReportOption, barangayId]);

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
      {/* Header Section */}
      <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-6 sm:p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="print-report-title text-3xl font-bold bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                Reports &amp; Analytics
              </h2>
              <p className="print-report-subtitle text-sm text-slate-400 mt-2">
                Visualize waste collection trends and barangay concerns.
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto no-print">
              <div className="inline-flex rounded-2xl bg-slate-900/90 border border-emerald-800/50 p-1 text-sm backdrop-blur-sm shadow-lg">
                <button
                  onClick={() => setActiveReportOption("wasteCollection")}
                  className={`px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                    activeReportOption === "wasteCollection"
                      ? "bg-gradient-to-r from-emerald-600/80 to-teal-600/80 text-white shadow-lg shadow-emerald-500/30"
                      : "text-emerald-300 hover:text-emerald-200"
                  }`}
                >
                  🗑️ Waste Collection
                </button>
                <button
                  onClick={() => setActiveReportOption("barangayConcerns")}
                  className={`px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                    activeReportOption === "barangayConcerns"
                      ? "bg-gradient-to-r from-emerald-600/80 to-teal-600/80 text-white shadow-lg shadow-emerald-500/30"
                      : "text-emerald-300 hover:text-emerald-200"
                  }`}
                >
                  📍 Barangay Concerns
                </button>
              </div>

              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-4 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-500/50 shadow-md shadow-emerald-600/40 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/50 hover:scale-105"
              >
                📄 PDF Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Waste Collection Section */}
      {activeReportOption === "wasteCollection" && (
        <>
          {loadingReportData ? (
            <div className="rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl">
              <TruckLoader />
            </div>
          ) : errorReportData ? (
            <div className="rounded-3xl bg-red-900/20 border border-red-500/40 p-6 sm:p-8 text-red-200 shadow-lg backdrop-blur-xl">
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
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

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
                                stopColor="#10b981"
                                stopOpacity={0.8}
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
            <div className="rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl">
              <TruckLoader />
            </div>
          ) : errorReportData ? (
            <div className="rounded-3xl bg-red-900/20 border border-red-500/40 p-6 sm:p-8 text-red-200 shadow-lg backdrop-blur-xl">
              <p className="text-center font-semibold">⚠️ {errorReportData}</p>
            </div>
          ) : concernStats.length === 0 ? (
            <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-8 text-slate-300 text-center backdrop-blur-xl">
              <p className="text-lg font-semibold mb-2">📭 No Data Available</p>
              <p className="text-sm">
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
                      {card.label === "Resolved" && totalConcerns > 0 && (
                        <p className="text-xs text-slate-400 mt-2">
                          {resolutionRate}% resolution rate
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-6 sm:p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

                <div className="relative z-10">
                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-emerald-300">
                      Monthly Barangay Concerns
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Status breakdown by month
                    </p>
                  </div>

                  <div className="h-96 bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
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
                              stopColor="#fbbf24"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="1"
                              stopColor="#f59e0b"
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
                              stopColor="#38bdf8"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="1"
                              stopColor="#0284c7"
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
                              stopColor="#22c55e"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="1"
                              stopColor="#16a34a"
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
                        <Legend
                          verticalAlign="top"
                          align="right"
                          wrapperStyle={{
                            color: "#cbd5e1",
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
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
