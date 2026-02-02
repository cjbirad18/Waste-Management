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

type ConcernStatus = "Needs Action" | "Ongoing" | "Resolved" | string;

type Props = {
  barangayId?: number | null;
  title?: string;
  subtitle?: string;
  statusFilter?: ConcernStatus[];
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
  value: number;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
};

const MONTHS = [
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

export default function BarangayConcernsAnalytics({
  barangayId,
  title = "Barangay Concerns Analytics",
  subtitle = "Monthly incident reports by status from community_reports.",
  statusFilter,
}: Props) {
  const [allStats, setAllStats] = useState<ConcernStatsPoint[]>([]);
  const [stats, setStats] = useState<ConcernStatsPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return now.toLocaleString("en-US", { month: "short" });
  });
  const [viewMode, setViewMode] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    const loadBarangayConcerns = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

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

          const status = row.current_status as ConcernStatus;

          if (statusFilter && !statusFilter.includes(status)) {
            continue;
          }

          byMonth[monthKey].total += 1;

          switch (status) {
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

        const statsArr: ConcernStatsPoint[] = MONTHS.filter(
          (m) => byMonth[m],
        ).map((m) => ({
          month: m,
          total: byMonth[m].total,
          needsAction: byMonth[m].needsAction,
          ongoing: byMonth[m].ongoing,
          resolved: byMonth[m].resolved,
        }));

        setAllStats(statsArr);

        let defaultMonth = selectedMonth;
        const hasCurrent = statsArr.some((s) => s.month === defaultMonth);
        if (!hasCurrent && statsArr.length > 0) {
          defaultMonth = statsArr[statsArr.length - 1].month;
          setSelectedMonth(defaultMonth);
        }

        const filtered =
          statsArr.filter((s) => s.month === defaultMonth) ??
          (statsArr.length > 0 ? [statsArr[statsArr.length - 1]] : []);
        setStats(filtered);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message ?? "Failed to load concerns data.");
      } finally {
        setLoading(false);
      }
    };

    loadBarangayConcerns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barangayId, statusFilter]);

  useEffect(() => {
    if (!allStats.length) return;
    const filtered = allStats.filter((s) => s.month === selectedMonth);
    setStats(filtered.length ? filtered : []);
  }, [selectedMonth, allStats]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleDownloadPDF = () => {
    handlePrint();
  };

  const availableMonths = MONTHS.filter((m) =>
    allStats.some((s) => s.month === m),
  );

  // Calculate summary statistics
  const currentData = stats.length > 0 ? stats[0] : null;
  const totalConcerns = currentData?.total || 0;
  const needsActionCount = currentData?.needsAction || 0;
  const ongoingCount = currentData?.ongoing || 0;
  const resolvedCount = currentData?.resolved || 0;

  // Calculate yearly totals
  const yearlyTotals = allStats.reduce(
    (acc, item) => {
      acc.total += item.total;
      acc.needsAction += item.needsAction;
      acc.ongoing += item.ongoing;
      acc.resolved += item.resolved;
      return acc;
    },
    { total: 0, needsAction: 0, ongoing: 0, resolved: 0 },
  );

  const statCards: StatCard[] = [
    {
      label: "Total Reports",
      value: viewMode === "monthly" ? totalConcerns : yearlyTotals.total,
      icon: "📋",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    {
      label: "Needs Action",
      value:
        viewMode === "monthly" ? needsActionCount : yearlyTotals.needsAction,
      icon: "⚠️",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
    },
    {
      label: "Ongoing",
      value: viewMode === "monthly" ? ongoingCount : yearlyTotals.ongoing,
      icon: "🔄",
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/10",
      borderColor: "border-cyan-500/30",
    },
    {
      label: "Resolved",
      value: viewMode === "monthly" ? resolvedCount : yearlyTotals.resolved,
      icon: "✅",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
  ];

  const resolution =
    viewMode === "monthly" && totalConcerns > 0
      ? Math.round((resolvedCount / totalConcerns) * 100)
      : viewMode === "yearly" && yearlyTotals.total > 0
        ? Math.round((yearlyTotals.resolved / yearlyTotals.total) * 100)
        : 0;

  return (
    <section className="print-report-page space-y-6">
      {/* Header Section */}
      <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-6 sm:p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="print-report-title text-3xl font-bold bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                {title}
              </h2>
              <p className="print-report-subtitle text-sm text-slate-400 mt-2">
                {subtitle}
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto no-print">
              {/* View Mode Toggle */}
              <div className="flex gap-1 bg-slate-900/60 rounded-xl p-1 border border-slate-700/50">
                <button
                  onClick={() => setViewMode("monthly")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    viewMode === "monthly"
                      ? "bg-emerald-600/80 text-white shadow-lg shadow-emerald-500/30"
                      : "text-slate-300 hover:text-slate-100"
                  }`}
                >
                  📅 Monthly
                </button>
                <button
                  onClick={() => setViewMode("yearly")}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                    viewMode === "yearly"
                      ? "bg-emerald-600/80 text-white shadow-lg shadow-emerald-500/30"
                      : "text-slate-300 hover:text-slate-100"
                  }`}
                >
                  📊 Yearly
                </button>
              </div>

              {/* Month Selector */}
              {viewMode === "monthly" && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-lg bg-slate-900/80 border border-emerald-500/40 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 hover:border-emerald-400/60 transition-all"
                >
                  {availableMonths.length === 0 ? (
                    <option value={selectedMonth}>{selectedMonth}</option>
                  ) : (
                    availableMonths.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  )}
                </select>
              )}

              <button
                type="button"
                onClick={handleDownloadPDF}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-500/50 shadow-md shadow-emerald-600/40 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/50 hover:scale-105"
              >
                📄 PDF Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl">
          <TruckLoader />
        </div>
      ) : errorMsg ? (
        <div className="rounded-3xl bg-red-900/20 border border-red-500/40 p-6 sm:p-8 text-red-200 shadow-lg backdrop-blur-xl">
          <p className="text-center font-semibold">⚠️ {errorMsg}</p>
        </div>
      ) : !stats.length && viewMode === "monthly" ? (
        <div className="rounded-3xl border border-slate-700/60 bg-slate-900/70 p-8 text-slate-300 text-center backdrop-blur-xl">
          <p className="text-lg font-semibold mb-2">📭 No Data Available</p>
          <p className="text-sm">
            No barangay concerns found for {selectedMonth}.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card, idx) => (
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
                      {resolution}% resolution rate
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Chart Section */}
          <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-6 sm:p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

            <div className="relative z-10">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-emerald-300">
                  {viewMode === "monthly"
                    ? `${selectedMonth} Report`
                    : "Yearly Overview"}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {viewMode === "monthly"
                    ? `Status breakdown for ${selectedMonth}`
                    : `Aggregated data for all months`}
                </p>
              </div>

              {viewMode === "monthly" && stats.length > 0 ? (
                <div className="h-96 bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats}
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
              ) : viewMode === "yearly" ? (
                <div className="h-96 bg-slate-900/60 rounded-2xl p-4 border border-slate-700/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={allStats}
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
              ) : null}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
