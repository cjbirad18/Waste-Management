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
    <section className="print-report-page space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* Header Section */}
      <div className="border border-gray-300 rounded-lg bg-slate-950/60 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="print-report-title text-3xl font-bold text-white/80">
              {title}
            </h2>
            <p className="print-report-subtitle text-sm text-white/80 mt-2">
              {subtitle}
            </p>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto no-print">
            {/* View Mode Toggle */}
            <div className="flex gap-1 bg-slate-950/60 rounded-lg p-1 border border-gray-900">
              <button
                onClick={() => setViewMode("monthly")}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-300 ${
                  viewMode === "monthly"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-900"
                }`}
              >
                📅 Monthly
              </button>
              <button
                onClick={() => setViewMode("yearly")}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-300 ${
                  viewMode === "yearly"
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
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
                className="rounded-lg bg-gray-900 border border-gray-300 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-gray-400 transition-all"
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
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 transition-all duration-300"
            >
              📄 PDF Report
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="border border-gray-300 rounded-lg bg-white p-8">
          <TruckLoader />
        </div>
      ) : errorMsg ? (
        <div className="border border-red-300 rounded-lg bg-red-50 p-6 sm:p-8 text-red-700">
          <p className="text-center font-semibold ">⚠️ {errorMsg}</p>
        </div>
      ) : !stats.length && viewMode === "monthly" ? (
        <div className="border border-gray-300 rounded-lg bg-slate-950/60 p-8 text-gray-600 text-center">
          <p className="text-lg font-semibold mb-2 text-white/80">
            📭 No Data Available
          </p>
          <p className="text-sm text-white/80">
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
                    {resolution}% resolution rate
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Chart Section */}
          <div className="border border-gray-300 rounded-lg bg-slate-950/60 p-6 sm:p-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white/80">
                {viewMode === "monthly"
                  ? `${selectedMonth} Report`
                  : "Yearly Overview"}
              </h3>
              <p className="text-sm text-white/80 mt-1">
                {viewMode === "monthly"
                  ? `Status breakdown for ${selectedMonth}`
                  : `Aggregated data for all months`}
              </p>
            </div>

            {viewMode === "monthly" && stats.length > 0 ? (
              <div className="h-96 bg-gray-50 rounded-lg p-4 border border-gray-200">
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
            ) : viewMode === "yearly" ? (
              <div className="h-96 bg-slate-950/60 rounded-lg p-4 border border-gray-200">
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
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
