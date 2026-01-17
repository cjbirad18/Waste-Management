"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
} from "date-fns";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";

const LeafletMap = dynamic(() => import("../../leafletmap"), { ssr: false });
import TruckLoader from "../../loading/TruckLoader";

const summaryCards = [
  {
    label: "Collection Office Accounts",
    icon: "👤",
    bg: "bg-blue-50",
    color: "text-blue-700",
    count: 12,
  },
  {
    label: "Active Garbage Trucks",
    icon: "🚚",
    bg: "bg-yellow-50",
    color: "text-yellow-700",
    count: 5,
  },
  {
    label: "Daily Collections",
    icon: "📈",
    bg: "bg-orange-50",
    color: "text-orange-700",
    count: 8,
  },
  {
    label: "Incident Reports",
    icon: "🗑️",
    bg: "bg-green-50",
    color: "text-green-700",
    count: 3,
  },
];

// ---- Components ----

function useTruckTracking() {
  useEffect(() => {
    let watchId: number | null = null;

    async function startTracking() {
      console.log("startTracking called");
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      console.log("auth", { user, authErr });
      if (authErr || !user) return;

      const { data: truck, error: truckErr } = await supabase
        .from("garbage_trucks")
        .select("truck_id, gcp_user_id")
        .eq("gcp_user_id", user.id)
        .single();
      console.log("truck", { truck, truckErr });
      if (truckErr || !truck) return;

      if (!("geolocation" in navigator)) {
        console.log("geolocation not available");
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          console.log("GPS update", { latitude, longitude });

          await supabase.from("truck_live_location").upsert(
            {
              truck_id: truck.truck_id,
              latitude,
              longitude,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "truck_id", // <--- add this option
            }
          );
        },
        (err) => {
          console.error("GPS error", err.code, err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30000,
        }
      );
    }

    startTracking();

    return () => {
      if (watchId !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);
}

function SidebarItem({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-300 backdrop-blur-xl shadow-md hover:scale-[1.02] ${
        selected
          ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-xl shadow-green-500/30 border-green-500/50"
          : "border-green-800/50 bg-slate-800/80 text-emerald-300 hover:border-green-600/70 hover:bg-green-500/10 hover:shadow-lg hover:shadow-green-500/25"
      }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span className="font-bold">{label}</span>
      {selected && (
        <div className="absolute right-3 w-2 h-6 bg-gradient-to-b from-emerald-400 to-teal-400 rounded-full animate-pulse" />
      )}
    </button>
  );
}

function generatePatternDates(pattern: string, year: number, month: number) {
  if (!pattern) return [];

  const validDays =
    pattern === "MWF" ? [1, 3, 5] : pattern === "TTH" ? [2, 4] : [];

  const dates: Date[] = [];
  let date = startOfMonth(new Date(year, month));
  const end = endOfMonth(date);

  while (date <= end) {
    if (validDays.includes(date.getDay())) {
      dates.push(new Date(date));
    }
    date = addDays(date, 1);
  }

  return dates;
}

type Schedule = {
  schedule_id: string;
  days: string;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  barangay?: {
    barangay_name: string;
    barangay_id: string;
  } | null;
};

function ScheduleCalendar({ schedule }: { schedule: Schedule }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const patternDates = generatePatternDates(schedule.days, year, month);

  // Weeks/Cells
  const weeks = [];
  const start = startOfWeek(startOfMonth(new Date(year, month)), {
    weekStartsOn: 1,
  });
  const end = endOfWeek(endOfMonth(new Date(year, month)), { weekStartsOn: 1 });
  let currentWeekStart = start;
  while (currentWeekStart <= end) {
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(addDays(currentWeekStart, i));
    }
    weeks.push(weekDays);
    currentWeekStart = addWeeks(currentWeekStart, 1);
  }

  return (
    <div className="my-6">
      <div className="flex justify-center mb-2">
        <span className="font-semibold text-lg bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow">
          {format(new Date(year, month), "LLLL yyyy")}
        </span>
      </div>

      <div className="mt-6 flex flex-row gap-6 justify-center max-w-[450px] mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-emerald-600 border border-emerald-500" />
          <span className="text-slate-200 text-sm">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-red-500/30 border border-red-400" />
          <span className="text-slate-200 text-sm">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-slate-900/80 border border-emerald-500/40" />
          <span className="text-slate-200 text-sm">No schedule</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-slate-800/80 border border-slate-700" />
          <span className="text-slate-300 text-sm">Other month</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 gap-2 min-w-[350px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="font-semibold py-1 text-center text-slate-200 text-xs uppercase tracking-wide"
          >
            {d}
          </div>
        ))}

        {weeks.map((weekDays, weekIdx) =>
          weekDays.map((day) => {
            const isScheduled = patternDates.some(
              (d) => d.toDateString() === day.toDateString()
            );
            const isCurrentMonth = day.getMonth() === month;
            const isToday =
              day.getDate() === now.getDate() &&
              day.getMonth() === now.getMonth() &&
              day.getFullYear() === now.getFullYear();
            const dayText = isCurrentMonth ? format(day, "d") : "";

            let cellClass =
              "h-10 w-10 flex flex-col items-center justify-center text-xs rounded border transition";
            if (!isCurrentMonth) {
              cellClass += " bg-slate-800/80 text-slate-500 border-slate-700";
            } else if (isToday) {
              cellClass +=
                " bg-red-500/20 text-red-300 font-bold border-red-400 shadow-md shadow-red-900/40";
            } else if (isScheduled) {
              cellClass +=
                " bg-emerald-600 text-white font-bold border-emerald-500 shadow-md shadow-emerald-900/50";
            } else {
              cellClass +=
                " bg-slate-900/80 border-emerald-500/40 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/10";
            }

            return (
              <div
                key={day.toISOString() + weekIdx}
                className={cellClass}
                title={
                  isScheduled && isCurrentMonth
                    ? `Scheduled: ${format(day, "EEE, MMM d, yyyy")}`
                    : isToday
                    ? "Today"
                    : ""
                }
              >
                <span>{dayText}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Schedules Viewer for GCP
function GCPScheduleSection() {
  const [mainLoading, setMainLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    async function fetchGCPSchedules() {
      setMainLoading(true);
      setError(null);

      try {
        const { data: authData, error: authErr } =
          await supabase.auth.getUser();
        if (authErr || !authData?.user) throw new Error("Not authenticated");
        const userId = authData.user.id;

        const { data, error } = await supabase
          .from("collection_schedules")
          .select(
            `
            schedule_id,
            barangay:barangay_id (barangay_name, barangay_id),
            days,
            date_created,
            start_time,
            end_time,
            status
          `
          )
          .eq("gcp_user_id", userId);

        if (error) throw error;

        // normalize first, then cast
        const rows = (data ?? []) as unknown as Schedule[];
        setSchedules(rows);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setMainLoading(false);
      }
    }

    fetchGCPSchedules();
  }, []);

  return (
    <section className="group relative max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 md:p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
          My Assigned Schedule
        </h2>

        {mainLoading ? (
          <TruckLoader />
        ) : error ? (
          <p className="text-red-300">Error: {error}</p>
        ) : !schedules.length ? (
          <p className="text-slate-300">No assigned schedule found.</p>
        ) : (
          schedules.map((schedule) => (
            <div
              key={schedule.schedule_id}
              className="mb-8 rounded-2xl border border-green-800/40 bg-slate-900/70 p-4 shadow-inner shadow-green-900/30"
            >
              <h3 className="font-semibold text-lg mb-2 text-slate-100">
                Barangay: {schedule.barangay?.barangay_name || "N/A"}
              </h3>
              <div className="text-slate-200 text-sm mb-1">
                <span className="font-semibold text-emerald-300">
                  Days/Pattern:
                </span>{" "}
                {schedule.days}
              </div>
              <div className="text-slate-200 text-sm mb-3">
                <span className="font-semibold text-emerald-300">
                  Start Time:
                </span>{" "}
                {schedule.start_time || "N/A"}
              </div>
              <ScheduleCalendar schedule={schedule} />
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function GCPAssignedTasksSection() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeIncident, setActiveIncident] = useState<any | null>(null);
  const [activeTask, setActiveTask] = useState<any | null>(null);

  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [responseAssignment, setResponseAssignment] = useState<any | null>(
    null
  );
  const [responseText, setResponseText] = useState("");
  const [responseSaving, setResponseSaving] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: authData, error: authErr } =
          await supabase.auth.getUser();
        if (authErr || !authData?.user) throw new Error("Not authenticated");
        const userId = authData.user.id;

        const { data, error } = await supabase
          .from("gcp_assignment")
          .select(
            `
            gcp_assignment_id,
            task_details,
            gcp_response,
            report_id,
            created_at,
            report:report_id (
              report_id,
              description,
              location,
              landmark,
              current_status,
              date_submitted
            )
          `
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        setTasks(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  const handleOpenResponse = (assignment: any) => {
    setResponseAssignment(assignment);
    setResponseText(assignment.gcp_response || "");
    setResponseError(null);
    setResponseModalOpen(true);
  };

  const handleSubmitResponse = async () => {
    if (!responseAssignment) return;
    if (!responseText.trim()) {
      setResponseError("Please enter your response.");
      return;
    }

    setResponseSaving(true);
    setResponseError(null);

    try {
      // 1) Save response in gcp_assignment
      const { error: assignError } = await supabase
        .from("gcp_assignment")
        .update({ gcp_response: responseText.trim() })
        .eq("gcp_assignment_id", responseAssignment.gcp_assignment_id);

      if (assignError) throw assignError;

      // 2) Mark related community report as Resolved
      if (responseAssignment.report?.report_id) {
        const { error: reportError } = await supabase
          .from("community_reports")
          .update({ current_status: "Resolved" })
          .eq("report_id", responseAssignment.report.report_id);

        if (reportError) throw reportError;
      }

      // 3) Update local tasks so UI shows response + new status
      setTasks((prev) =>
        prev.map((t) =>
          t.gcp_assignment_id === responseAssignment.gcp_assignment_id
            ? {
                ...t,
                gcp_response: responseText.trim(),
                report: t.report
                  ? { ...t.report, current_status: "Resolved" }
                  : t.report,
              }
            : t
        )
      );

      setResponseModalOpen(false);
    } catch (err: any) {
      setResponseError(err.message || "Failed to save response.");
    } finally {
      setResponseSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8 mt-8">
        <TruckLoader />
      </section>
    );
  }

  if (error) {
    return (
      <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8 mt-8">
        <p className="text-red-600">Error loading assigned tasks: {error}</p>
      </section>
    );
  }

  return (
    <section className="group relative max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 md:p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
          Assigned Incident Tasks
        </h2>

        {tasks.length === 0 ? (
          <p className="text-slate-300">You have no assigned incident tasks.</p>
        ) : (
          <div className="space-y-4">
            {tasks.map((t: any) => (
              <div
                key={t.gcp_assignment_id}
                className="border border-green-800/40 rounded-2xl p-4 bg-slate-900/70 shadow-inner shadow-green-900/30"
              >
                <div className="flex justify-between items-center mb-2 gap-3">
                  <h3 className="font-semibold text-lg text-slate-100">
                    Location: {t.report?.location || "N/A"}
                  </h3>
                  <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold">
                    Status: {t.report?.current_status || "N/A"}
                  </span>
                </div>

                <p className="text-sm text-slate-300 mb-1">
                  <span className="font-semibold text-slate-100">
                    Landmark:
                  </span>{" "}
                  {t.report?.landmark || "N/A"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="px-4 py-1 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-slate-50 rounded-2xl font-semibold disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
                    onClick={() => setActiveIncident(t.report)}
                    disabled={!t.report?.description}
                  >
                    View Incident Description
                  </button>

                  <button
                    type="button"
                    className="px-4 py-1 text-xs sm:text-sm bg-sky-600 hover:bg-sky-500 text-slate-50 rounded-2xl font-semibold disabled:bg-slate-600 disabled:text-slate-400 transition-colors"
                    onClick={() => setActiveTask(t)}
                    disabled={!t.task_details}
                  >
                    View Task from Secretary
                  </button>

                  {t.gcp_response ? (
                    <span className="px-4 py-1 text-xs sm:text-sm rounded-2xl font-semibold bg-slate-800 text-slate-300 border border-slate-600">
                      Already responded
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="px-4 py-1 text-xs sm:text-sm bg-purple-600 hover:bg-purple-500 text-slate-50 rounded-2xl font-semibold transition-colors"
                      onClick={() => handleOpenResponse(t)}
                    >
                      Add Response
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-2">
                  Assigned at:{" "}
                  {t.created_at
                    ? new Date(t.created_at).toLocaleString()
                    : "N/A"}
                </p>

                {t.gcp_response && (
                  <p className="text-[11px] text-slate-200 mt-1 whitespace-pre-line">
                    <span className="font-semibold text-emerald-300">
                      Your response:
                    </span>{" "}
                    {t.gcp_response}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Response modal */}
        {responseModalOpen && responseAssignment && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={() => setResponseModalOpen(false)}
          >
            <div
              className="relative max-w-md w-full text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-emerald-700/70 bg-slate-900/95 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-2 border-b border-emerald-700/70">
                <div className="flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-sm shadow-emerald-900" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-sm shadow-amber-900" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400/80 shadow-sm shadow-slate-900" />
                  </span>
                  <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
                    Add Response •{" "}
                    {responseAssignment.report?.location || "Unknown"}
                  </span>
                </div>

                <button
                  onClick={() => setResponseModalOpen(false)}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-1">
                  INCIDENT
                </p>
                <p className="text-sm mb-3 text-slate-200">
                  <span className="font-semibold text-slate-100">
                    Location:{" "}
                  </span>
                  {responseAssignment.report?.location || "N/A"}
                </p>

                <label className="block text-xs font-semibold mb-1 text-slate-100">
                  Your response
                </label>
                <textarea
                  className="w-full border border-slate-700 rounded-lg px-3 py-2 text-sm mb-3 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none"
                  rows={4}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                />

                {responseError && (
                  <p className="text-xs text-red-300 mb-2">{responseError}</p>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                  <button
                    type="button"
                    onClick={() => setResponseModalOpen(false)}
                    className="px-4 py-1 text-sm rounded-lg border border-slate-600 text-slate-200 bg-slate-900/60 hover:bg-slate-800/80 disabled:opacity-60 transition-colors"
                    disabled={responseSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitResponse}
                    className="px-4 py-1 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500 disabled:bg-slate-600 disabled:text-slate-300 disabled:border-slate-500 transition-colors"
                    disabled={responseSaving}
                  >
                    {responseSaving ? "Saving..." : "Submit response"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Incident description modal */}
        {activeIncident && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={() => setActiveIncident(null)}
          >
            <div
              className="relative max-w-md w-full text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-emerald-700/70 bg-slate-900/95 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-2 border-b border-emerald-700/70">
                <div className="flex items-center gap-2">
                  <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
                    Incident Description
                  </span>
                </div>

                <button
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                  onClick={() => setActiveIncident(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-2">
                  DETAILS
                </p>
                <div className="max-h-60 overflow-y-auto pr-1 rounded-lg bg-slate-900/80 border border-slate-700/70 px-3 py-2">
                  <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                    {activeIncident.description}
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setActiveIncident(null)}
                    className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task from secretary modal */}
        {activeTask && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm overflow-y-auto"
            onClick={() => setActiveTask(null)}
          >
            <div
              className="relative max-w-lg w-[90vw] md:w-[32rem] my-8 text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-emerald-700/70 bg-slate-900/95 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-2 border-b border-emerald-700/70">
                <div className="flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-sm shadow-emerald-900" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-sm shadow-amber-900" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400/80 shadow-sm shadow-slate-900" />
                  </span>
                  <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
                    Task from Secretary
                  </span>
                </div>

                <button
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                  onClick={() => setActiveTask(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-2">
                  TASK DETAILS
                </p>
                <div className="rounded-lg bg-slate-900/80 border border-slate-700/70 px-3 py-2">
                  <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                    {activeTask.task_details}
                  </p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setActiveTask(null)}
                    className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Response form modal (detailed) */}
        {responseModalOpen && responseAssignment && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm"
            onClick={() => setResponseModalOpen(false)}
          >
            <div
              className="bg-slate-900/95 rounded-2xl shadow-2xl border border-green-800/60 max-w-md w-full p-6 text-slate-100 backdrop-blur-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-emerald-300">
                  GCP Incident Response
                </h3>
                <button
                  className="text-xl text-slate-500 hover:text-red-400"
                  onClick={() => setResponseModalOpen(false)}
                >
                  ×
                </button>
              </div>

              <p className="text-sm text-slate-300 mb-2">
                <span className="font-semibold text-slate-100">Location:</span>{" "}
                {responseAssignment.report?.location || "N/A"}
              </p>

              <label className="block text-xs font-semibold mb-1 text-slate-100">
                Response / action taken
              </label>
              <textarea
                className="w-full border border-slate-700 rounded-lg px-2 py-1 text-sm mb-3 bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                rows={4}
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Describe what you did to respond to this incident..."
              />

              {responseError && (
                <p className="text-xs text-red-300 mb-2">{responseError}</p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1 text-sm rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800/80"
                  onClick={() => setResponseModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-1 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-500 disabled:text-slate-300"
                  onClick={handleSubmitResponse}
                  disabled={responseSaving}
                >
                  {responseSaving ? "Saving..." : "Save Response"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
// ---- Main Page Component ----

export default function GCPDashboard() {
  const router = useRouter();
  useTruckTracking();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "userAdmin"
    | "viewSchedule"
    | "assignedTasks"
    | "manageAccount"
  >("dashboard");

  // Manage Account State
  const [hasLoadedManageAccount, setHasLoadedManageAccount] = useState(false);
  const [manageAccountForm, setManageAccountForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    password: "",
    confirm_password: "",
  });
  const [manageAccountLoading, setManageAccountLoading] = useState(true);
  const [manageAccountError, setManageAccountError] = useState<string | null>(
    null
  );
  const [manageAccountSuccess, setManageAccountSuccess] = useState<
    string | null
  >(null);

  // Manage Account updater
  useEffect(() => {
    if (activeTab === "manageAccount" && !hasLoadedManageAccount) {
      async function fetchCurrentUser() {
        setManageAccountLoading(true);
        setManageAccountError(null);
        const { data: authUserData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authUserData.user) {
          setManageAccountError("Failed to authenticate user.");
          setManageAccountLoading(false);
          return;
        }
        const userId = authUserData.user.id;
        const { data, error } = await supabase
          .from("users")
          .select("username, first_name, last_name, email, contact_number")
          .eq("user_id", userId)
          .single();
        if (error || !data) {
          setManageAccountError("Failed to load user profile.");
          setManageAccountLoading(false);
          return;
        }
        setManageAccountForm({
          username: data.username || "",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          contact_number: data.contact_number || "",
          password: "",
          confirm_password: "",
        });
        setManageAccountLoading(false);
        setHasLoadedManageAccount(true);
      }
      fetchCurrentUser();
    }
  }, [activeTab, hasLoadedManageAccount]);

  useEffect(() => {
    if (activeTab !== "manageAccount") {
      setHasLoadedManageAccount(false);
    }
  }, [activeTab]);

  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setManageAccountForm({
      ...manageAccountForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleManageAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const confirmed = window.confirm(
      "Are you sure you want to update your account details?"
    );
    if (!confirmed) return;
    setManageAccountError(null);
    setManageAccountSuccess(null);
    try {
      const { data: authUserData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authUserData.user) {
        setManageAccountError("User not authenticated.");
        return;
      }
      const userId = authUserData.user.id;
      if (manageAccountForm.email !== authUserData.user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: manageAccountForm.email.trim(),
        });
        if (emailError) {
          setManageAccountError(`Email update failed: ${emailError.message}`);
          return;
        }
      }
      if (manageAccountForm.password.length >= 6) {
        const { error: pwdError } = await supabase.auth.updateUser({
          password: manageAccountForm.password,
        });
        if (pwdError) {
          setManageAccountError(`Password update failed: ${pwdError.message}`);
          return;
        }
      }
      const { error: profileError } = await supabase
        .from("users")
        .update({
          username: manageAccountForm.username,
          first_name: manageAccountForm.first_name,
          last_name: manageAccountForm.last_name,
          email: manageAccountForm.email,
          contact_number: manageAccountForm.contact_number,
        })
        .eq("user_id", userId);
      if (profileError) {
        setManageAccountError(`Profile update failed: ${profileError.message}`);
        return;
      }
      setManageAccountSuccess("Account updated successfully!");
      setManageAccountForm((prev) => ({
        ...prev,
        password: "",
        confirm_password: "",
      }));
    } catch (err: any) {
      setManageAccountError(`Unexpected error: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to logout?")
    ) {
      // Get current user
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;

      if (userId) {
        // Find this GCP's truck
        const { data: truck } = await supabase
          .from("garbage_trucks")
          .select("truck_id, gcp_user_id")
          .eq("gcp_user_id", userId)
          .single();

        if (truck?.truck_id) {
          // Remove its live location row
          await supabase
            .from("truck_live_location")
            .delete()
            .eq("truck_id", truck.truck_id);
        }
      }

      // Now log out
      await supabase.auth.signOut();
      localStorage.removeItem("authToken");
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-900/80 text-slate-200 flex flex-col relative overflow-hidden">
      {/* Subtle animated overlay */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 animate-pulse" />
      </div>

      <div className="flex flex-1 relative">
        {/* Mobile menu button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden fixed top-4 left-4 z-[70] inline-flex items-center justify-center h-12 w-12 rounded-2xl border-2 border-green-800/50 bg-slate-800/90 text-emerald-300 hover:border-green-600/70 hover:bg-green-500/10 hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 backdrop-blur-xl shadow-md"
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? "✖" : "☰"}
        </button>

        {/* Mobile overlay when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <aside
          className={`bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-2xl border-r border-green-800/40 shadow-2xl shadow-green-900/20 flex flex-col pt-6 px-5 md:px-4 fixed top-0 left-0 h-full transition-all duration-300 z-50 ${
            sidebarOpen
              ? "w-4/5 max-w-xs opacity-100"
              : "w-0 opacity-0 overflow-hidden"
          } md:w-64 md:max-w-none md:opacity-100 md:overflow-visible`}
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/90 to-emerald-600/90 text-2xl shadow-2xl shadow-green-500/30">
              🚚
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-bold">
                Track-the-Truck
              </p>
              <h1 className="text-lg font-extrabold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent tracking-tight drop-shadow-lg">
                GCP Dashboard
              </h1>
              <p className="text-[11px] font-semibold text-slate-400 leading-snug">
                Garbage Collection Personnel
              </p>
            </div>
          </div>

          <nav
            className="flex-1 mt-4 text-sm font-semibold text-slate-200 space-y-2"
            aria-label="Main Navigation"
          >
            <SidebarItem
              label="Dashboard"
              icon="🏠"
              selected={activeTab === "dashboard"}
              onClick={() => {
                setActiveTab("dashboard");
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              label="View Schedule"
              icon="📅"
              selected={activeTab === "viewSchedule"}
              onClick={() => {
                setActiveTab("viewSchedule");
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              label="Assigned Tasks"
              icon="✅"
              selected={activeTab === "assignedTasks"}
              onClick={() => {
                setActiveTab("assignedTasks");
                setSidebarOpen(false);
              }}
            />
            <SidebarItem
              label="Manage Account"
              icon="🛠️"
              selected={activeTab === "manageAccount"}
              onClick={() => {
                setActiveTab("manageAccount");
                setSidebarOpen(false);
              }}
            />

            <button
              onClick={handleLogout}
              className="mt-8 mb-4 px-6 py-2 text-red-50 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600/90 to-orange-600/90 border border-red-500/40 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl shadow-lg text-sm font-bold"
            >
              ⎋ Logout
            </button>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 md:p-8 transition-all duration-300 md:ml-64 space-y-8">
          {activeTab === "dashboard" && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {summaryCards.map((sc, i) => (
                  <div
                    key={i}
                    className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 shadow-2xl shadow-green-900/30 p-6 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 hover:-translate-y-1 transition-all duration-500 hover:border-green-600/70 flex flex-col items-center"
                    role="region"
                    aria-label={sc.label}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
                    <span
                      className="text-4xl mb-3 relative z-10"
                      aria-hidden="true"
                    >
                      {sc.icon}
                    </span>
                    <span className="text-2xl font-black bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-lg relative z-10">
                      {sc.count}
                    </span>
                    <span className="text-xs uppercase tracking-wide text-emerald-300 font-semibold mt-1 relative z-10">
                      {sc.label}
                    </span>
                    <div className="w-full mt-4 relative z-10">
                      <div className="h-2 w-full rounded-full bg-slate-900/90 overflow-hidden border border-green-800/50">
                        <div className="h-full w-3/4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-lg" />
                      </div>
                      <p className="mt-3 text-[11px] text-slate-400 text-center">
                        Auto-updated from collection data
                      </p>
                    </div>
                  </div>
                ))}
              </section>

              <section
                aria-label="Map of collection area and vehicles"
                className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                      Collection Coverage Map
                    </h2>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-sm backdrop-blur-sm">
                      <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                      Live vehicles
                    </span>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 h-[500px] md:h-[600px]">
                    <LeafletMap />
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === "viewSchedule" && <GCPScheduleSection />}

          {activeTab === "assignedTasks" && <GCPAssignedTasksSection />}

          {activeTab === "manageAccount" && (
            <ManageAccountSection
              form={manageAccountForm}
              loading={manageAccountLoading}
              error={manageAccountError}
              success={manageAccountSuccess}
              onChange={handleManageAccountFormChange}
              onSubmit={handleManageAccountSubmit}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ---- ManageAccountSection + InputField ----
function ManageAccountSection({
  form,
  loading,
  error,
  success,
  onChange,
  onSubmit,
}: {
  form: typeof ManageAccountSection.prototype.form;
  loading: boolean;
  error: string | null;
  success: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
}) {
  if (loading) return <TruckLoader />;

  return (
    <section className="max-w-2xl mx-auto rounded-2xl bg-slate-900/90 border border-slate-800/70 p-6 md:p-8 shadow-xl backdrop-blur-sm">
      <h2 className="text-2xl font-bold mb-2 text-emerald-400">
        Manage Account
      </h2>
      <p className="text-[11px] text-slate-400 mb-4">
        Update your profile details and sign-in credentials.
      </p>

      {error && (
        <div
          role="alert"
          className="px-4 py-2 mb-3 rounded-lg bg-red-500/10 border border-red-500/50 text-xs text-red-200"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="px-4 py-2 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/50 text-xs text-emerald-200"
        >
          {success}
        </div>
      )}

      {!loading && (
        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          {/* make all labels white via utility */}
          <div className="label:text-slate-100 label:text-xs label:font-semibold space-y-3">
            <InputField
              label="First Name"
              name="first_name"
              type="text"
              value={form.first_name}
              onChange={onChange}
              required
            />
            <InputField
              label="Last Name"
              name="last_name"
              type="text"
              value={form.last_name}
              onChange={onChange}
              required
            />
            <InputField
              label="Username"
              name="username"
              type="text"
              value={form.username}
              onChange={onChange}
              required
            />
            <InputField
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              required
            />
            <InputField
              label="Contact Number"
              name="contact_number"
              type="tel"
              value={form.contact_number}
              onChange={onChange}
              required
            />
            <InputField
              label="New Password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              placeholder="Leave blank to keep current password"
            />
            <InputField
              label="Confirm New Password"
              name="confirm_password"
              type="password"
              value={form.confirm_password}
              onChange={onChange}
              placeholder="Confirm your new password"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
            >
              Update Account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function InputField({
  label,
  name,
  type,
  value,
  onChange,
  required = false,
  placeholder = "",
}: {
  label: string;
  name: string;
  type: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={name}
        className="block mb-1 text-xs font-semibold text-slate-100"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg bg-slate-900/90 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      />
    </div>
  );
}
