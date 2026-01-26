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
  statusFilter?: ConcernStatus[]; // optional subset of statuses to include
};

type ConcernStatsPoint = {
  month: string;
  total: number;
  needsAction: number;
  ongoing: number;
  resolved: number;
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

  const availableMonths = MONTHS.filter((m) =>
    allStats.some((s) => s.month === m),
  );

  return (
    <section
      className="
        print-report-page
        group relative rounded-3xl
        bg-gradient-to-br from-slate-800/95 to-gray-800/95
        border border-green-800/50 p-6
        shadow-2xl shadow-green-900/30
        backdrop-blur-2xl overflow-hidden
      "
    >
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="print-report-title text-2xl font-semibold text-emerald-300">
              {title}
            </h2>
            <p className="print-report-subtitle text-sm text-slate-400 mt-1">
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-sm">
              <label className="block text-slate-300 mb-1">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-lg bg-slate-900/80 border border-slate-600 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-emerald-600 text-white border border-emerald-500 shadow-md shadow-emerald-600/40"
            >
              Print / Save as PDF
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <TruckLoader />
        ) : errorMsg ? (
          <div className="rounded-2xl bg-red-900/40 border border-red-500/60 p-6 text-red-100 text-center text-sm shadow-lg">
            {errorMsg}
          </div>
        ) : !stats.length ? (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 text-slate-300 text-sm">
            No barangay concerns found for {selectedMonth}.
          </div>
        ) : (
          <div className="h-80 relative z-10 bg-slate-900/80 rounded-2xl p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats}
                margin={{ top: 16, right: 16, bottom: 32, left: 32 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                <XAxis
                  dataKey="month"
                  stroke="#e5e7eb"
                  tick={{ fill: "#e5e7eb", fontSize: 12 }}
                />
                <YAxis
                  stroke="#e5e7eb"
                  tick={{ fill: "#e5e7eb", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#111827",
                    borderColor: "#4b5563",
                    color: "#e5e7eb",
                    fontSize: 12,
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ color: "#e5e7eb", fontSize: 12 }}
                />
                <Bar
                  dataKey="needsAction"
                  stackId="a"
                  fill="#fbbf24"
                  name="Needs Action"
                />
                <Bar
                  dataKey="ongoing"
                  stackId="a"
                  fill="#38bdf8"
                  name="Ongoing"
                />
                <Bar
                  dataKey="resolved"
                  stackId="a"
                  fill="#22c55e"
                  name="Resolved"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
