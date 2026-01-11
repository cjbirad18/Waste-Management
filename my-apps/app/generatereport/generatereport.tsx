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
} from "recharts";
import TruckLoader from "../loading/TruckLoader"; // adjust path if needed

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
    []
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
            `
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

  return (
    <section className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
              Reports &amp; Analytics
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Visualize waste collection trends and barangay concerns.
            </p>
          </div>
          <div className="inline-flex rounded-2xl bg-slate-900/90 border border-green-800/50 p-1 text-sm backdrop-blur-sm shadow-lg">
            <button
              onClick={() => setActiveReportOption("wasteCollection")}
              className={`group/seg px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                activeReportOption === "wasteCollection"
                  ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-lg shadow-green-500/30"
                  : "text-emerald-300 hover:bg-green-500/10 hover:shadow-md hover:shadow-green-500/20"
              }`}
            >
              Waste Collection
            </button>
            <button
              onClick={() => setActiveReportOption("barangayConcerns")}
              className={`group/seg px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                activeReportOption === "barangayConcerns"
                  ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-lg shadow-green-500/30"
                  : "text-emerald-300 hover:bg-green-500/10 hover:shadow-md hover:shadow-green-500/20"
              }`}
            >
              Barangay Concerns
            </button>
          </div>
        </div>

        {/* Waste Collection Tab */}
        {activeReportOption === "wasteCollection" && (
          <>
            {loadingReportData ? (
              <TruckLoader />
            ) : errorReportData ? (
              <div className="rounded-2xl bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/40 p-6 text-red-200 text-center text-sm backdrop-blur-xl shadow-lg">
                {errorReportData}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="group relative rounded-2xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 border border-green-800/50 p-6 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                  <h3 className="text-lg font-bold mb-4 relative z-10 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent">
                    Monthly waste collected (tons)
                  </h3>
                  <div className="h-80 relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={wasteCollectionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#1e293b",
                            color: "#e2e8f0",
                            fontSize: 12,
                          }}
                        />
                        <Bar
                          dataKey="tons"
                          fill="#10b981"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="group relative rounded-2xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 border border-green-800/50 p-6 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                  <h3 className="text-lg font-bold mb-4 relative z-10 bg-gradient-to-r from-slate-100 to-sky-300 bg-clip-text text-transparent">
                    Collection efficiency (%)
                  </h3>
                  <div className="h-80 relative z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            borderColor: "#1e293b",
                            color: "#e2e8f0",
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="efficiency"
                          stroke="#0ea5e9"
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            strokeWidth: 2,
                            stroke: "#0f172a",
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Barangay Concerns Tab */}
        {activeReportOption === "barangayConcerns" && (
          <>
            {loadingReportData ? (
              <TruckLoader />
            ) : errorReportData ? (
              <div className="rounded-2xl bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/40 p-6 text-red-200 text-center text-sm backdrop-blur-xl shadow-lg">
                {errorReportData}
              </div>
            ) : concernStats.length === 0 ? (
              <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 text-slate-300 text-sm">
                No barangay concerns found for the selected scope.
              </div>
            ) : (
              <div className="group relative rounded-2xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 border border-green-800/50 p-6 backdrop-blur-xl shadow-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                <h3 className="text-lg font-bold mb-4 relative z-10 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent">
                  Monthly barangay concerns
                </h3>
                <div className="h-80 relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={concernStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="month" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          borderColor: "#1e293b",
                          color: "#e2e8f0",
                          fontSize: 12,
                        }}
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
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
