<span className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-white font-bold text-lg shadow-lg overflow-hidden">
  {initials}
</span>;
("use client");

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const LeafletMap = dynamic(() => import("../../leafletmap"), { ssr: false });
import TruckLoader from "../../loading/TruckLoader";

type SecretaryActiveTab =
  | "dashboard"
  | "userAdmin"
  | "viewSchedule"
  | "assignedTasks"
  | "manageAccount";

const summaryCards = [
  {
    label: "Collection Office Accounts",
    icon: "👤",
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-300",
    trend: "Active",
    trendClass: "text-emerald-400",
    count: 12,
  },
  {
    label: "Active Garbage Trucks",
    icon: "🚚",
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-300",
    trend: "Active",
    trendClass: "text-emerald-400",
    count: 5,
  },
  {
    label: "Daily Collections",
    icon: "📈",
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-300",
    trend: "Active",
    trendClass: "text-emerald-400",
    count: 8,
  },
  {
    label: "Incident Reports",
    icon: "🗑️",
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-300",
    trend: "Active",
    trendClass: "text-emerald-400",
    count: 3,
  },
];

// ---- Components ----

function useTruckTracking() {
  useEffect(() => {
    let watchId: number | null = null;
    let trackedTruckId: number | null = null;

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
      trackedTruckId = truck.truck_id ?? null;

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
            },
          );
        },
        (err) => {
          console.error("GPS error", err.code, err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30000,
        },
      );
    }

    startTracking();

    return () => {
      if (watchId !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (trackedTruckId) {
        void supabase
          .from("truck_live_location")
          .delete()
          .eq("truck_id", trackedTruckId);
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
    <Button
      type="button"
      onClick={onClick}
      variant="ghost"
      className={`w-full justify-start gap-3 rounded-lg px-4 py-3 mb-2 text-left transition-colors h-auto ${
        selected
          ? "bg-emerald-600 text-white hover:bg-emerald-600"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span className="font-medium">{label}</span>
    </Button>
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

      <div className="mt-6 flex flex-col sm:flex-row gap-6 justify-center max-w-[450px] mx-auto items-center">
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

      <div className="mt-6 calendar-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}

        {weeks.map((weekDays, weekIdx) =>
          weekDays.map((day) => {
            const isScheduled = patternDates.some(
              (d) => d.toDateString() === day.toDateString(),
            );
            const isCurrentMonth = day.getMonth() === month;
            const isToday =
              day.getDate() === now.getDate() &&
              day.getMonth() === now.getMonth() &&
              day.getFullYear() === now.getFullYear();
            const dayText = isCurrentMonth ? format(day, "d") : "";

            let cellClass =
              "calendar-day h-10 w-10 flex flex-col items-center justify-center text-xs rounded border transition";
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
          }),
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
          `,
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
    <section className="dashboard-section max-w-4xl mx-auto overflow-hidden">
      <div className="dashboard-section-glow" />
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
    null,
  );
  const [responseText, setResponseText] = useState("");
  const [responseSaving, setResponseSaving] = useState(false);
  const [responseError, setResponseError] = useState<string | null>(null);

  const [wasteModalOpen, setWasteModalOpen] = useState(false);
  const [wasteWeight, setWasteWeight] = useState("");
  const [collectionDate, setCollectionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [wasteSaving, setWasteSaving] = useState(false);
  const [wasteError, setWasteError] = useState<string | null>(null);
  const [wasteSuccess, setWasteSuccess] = useState<string | null>(null);

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
          `,
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

  const handleOpenWasteModal = () => {
    setWasteWeight("");
    setCollectionDate(new Date().toISOString().slice(0, 10));
    setWasteError(null);
    setWasteSuccess(null);
    setWasteModalOpen(true);
  };

  const handleSubmitWaste = async () => {
    const weightValue = Number(wasteWeight);
    if (!wasteWeight.trim() || Number.isNaN(weightValue) || weightValue <= 0) {
      setWasteError("Please enter a valid waste weight.");
      return;
    }

    setWasteSaving(true);
    setWasteError(null);
    setWasteSuccess(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Not authenticated");

      const { data: truck, error: truckErr } = await supabase
        .from("garbage_trucks")
        .select("truck_id, truck_code")
        .eq("gcp_user_id", authData.user.id)
        .single();
      if (truckErr || !truck?.truck_id) {
        throw new Error("No truck assigned to this account.");
      }

      const { data: schedule, error: scheduleErr } = await supabase
        .from("collection_schedules")
        .select(
          `
          schedule_id,
          barangay:barangay_id (
            barangay_name
          )
        `,
        )
        .eq("gcp_user_id", authData.user.id)
        .order("date_created", { ascending: false })
        .limit(1)
        .single();
      if (scheduleErr || !schedule?.schedule_id) {
        throw new Error("No schedule found for this account.");
      }

      const { error: insertError } = await supabase
        .from("collection_details")
        .insert({
          schedule_id: schedule.schedule_id,
          truck_id: truck.truck_id,
          collection_date: collectionDate,
          waste_weight: weightValue,
        });

      if (insertError) throw insertError;

      try {
        const { data: secretaries, error: secretaryError } = await supabase
          .from("users")
          .select("user_id, contact_number")
          .eq("role", "Secretary")
          .not("contact_number", "is", null);

        if (!secretaryError && secretaries?.length) {
          const barangayName =
            (schedule.barangay as unknown as { barangay_name: string } | null)
              ?.barangay_name || "Unknown";
          const truckCode = truck.truck_code || "Unassigned";
          const message = `Waste collected recorded. Barangay: ${barangayName}. Truck: ${truckCode}. Date: ${collectionDate}. Weight: ${weightValue} kg. - Track the Truck`;

          await Promise.all(
            secretaries.map((secretary) =>
              fetch("/api/send-sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: secretary.contact_number,
                  message,
                  userId: secretary.user_id,
                  notificationType: "waste_collected",
                }),
              }),
            ),
          );
        }
      } catch (notifyError) {
        console.error(
          "Failed to notify secretaries about waste collected",
          notifyError,
        );
      }

      setWasteSuccess("Waste collection recorded successfully.");
      setWasteModalOpen(false);
    } catch (err: any) {
      setWasteError(err.message || "Failed to record waste collection.");
    } finally {
      setWasteSaving(false);
    }
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

      try {
        const reportId = responseAssignment.report?.report_id;

        if (reportId) {
          const { data: reportDetails, error: reportDetailsError } =
            await supabase
              .from("community_reports")
              .select("report_id, location, barangay_id, user_id")
              .eq("report_id", reportId)
              .single();

          if (!reportDetailsError && reportDetails) {
            if (reportDetails.user_id) {
              await fetch("/api/notifications/incident-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  reportId: reportDetails.report_id,
                  userId: reportDetails.user_id,
                  status: "resolved",
                  actionTaken: responseText.trim() || undefined,
                }),
              });
            }

            if (reportDetails.barangay_id) {
              const { data: bwmc, error: bwmcError } = await supabase
                .from("users")
                .select("user_id, contact_number")
                .eq("role", "BWMC")
                .eq("barangay_id", reportDetails.barangay_id)
                .maybeSingle();

              if (!bwmcError && bwmc?.contact_number) {
                const bwmcMessage = `Incident report #${reportDetails.report_id} resolved by GCP. Location: ${reportDetails.location}. ${responseText.trim() ? `Action taken: ${responseText.trim()}. ` : ""}Track the Truck`;

                await fetch("/api/send-sms", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    to: bwmc.contact_number,
                    message: bwmcMessage,
                    userId: bwmc.user_id,
                    notificationType: "incident_resolved",
                  }),
                });
              }
            }

            const { data: secretaries, error: secretaryError } = await supabase
              .from("users")
              .select("user_id, contact_number")
              .eq("role", "Secretary")
              .not("contact_number", "is", null);

            if (!secretaryError && secretaries?.length) {
              const secretaryMessage = `Incident report #${reportDetails.report_id} resolved by GCP. Location: ${reportDetails.location}. ${responseText.trim() ? `Action taken: ${responseText.trim()}. ` : ""}Track the Truck`;

              await Promise.all(
                secretaries.map((secretary) =>
                  fetch("/api/send-sms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      to: secretary.contact_number,
                      message: secretaryMessage,
                      userId: secretary.user_id,
                      notificationType: "incident_resolved",
                    }),
                  }),
                ),
              );
            }
          }
        }
      } catch (notifyError) {
        console.error("Failed to send resolution notifications", notifyError);
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
            : t,
        ),
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
      <Card className="max-w-4xl mx-auto mt-8">
        <CardContent className="p-8">
          <TruckLoader />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="max-w-4xl mx-auto mt-8">
        <CardContent className="p-8">
          <p className="text-red-600">Error loading assigned tasks: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="dashboard-section max-w-4xl mx-auto">
      <div className="dashboard-section-glow" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
            Assigned Incident Tasks
          </h2>
          <Button
            type="button"
            className="h-auto"
            onClick={handleOpenWasteModal}
          >
            Record Waste Collected
          </Button>
        </div>

        {wasteSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
            {wasteSuccess}
          </div>
        )}

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
                  <Badge className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold">
                    Status: {t.report?.current_status || "N/A"}
                  </Badge>
                </div>

                <p className="text-sm text-slate-300 mb-1">
                  <span className="font-semibold text-slate-100">
                    Landmark:
                  </span>{" "}
                  {t.report?.landmark || "N/A"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-auto"
                    onClick={() => setActiveIncident(t.report)}
                    disabled={!t.report?.description}
                  >
                    View Incident Description
                  </Button>

                  <Button
                    type="button"
                    variant="secondary"
                    className="h-auto"
                    onClick={() => setActiveTask(t)}
                    disabled={!t.task_details}
                  >
                    View Task from Secretary
                  </Button>

                  {t.gcp_response ? (
                    <Badge className="px-4 py-1 text-xs sm:text-sm rounded-2xl font-semibold bg-slate-800 text-slate-300 border border-slate-600">
                      Already responded
                    </Badge>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-auto"
                      onClick={() => handleOpenResponse(t)}
                    >
                      Add Response
                    </Button>
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
        {responseAssignment && (
          <Dialog
            open={responseModalOpen}
            onOpenChange={(open: boolean) => {
              setResponseModalOpen(open);
              if (!open) setResponseAssignment(null);
            }}
          >
            <DialogContent className="max-w-md bg-slate-900/95 text-slate-100 border-emerald-700/70">
              <DialogHeader>
                <DialogTitle className="text-slate-100">
                  Add Response
                </DialogTitle>
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80">
                  Incident
                </p>
              </DialogHeader>

              <p className="text-sm text-slate-200">
                <span className="font-semibold text-slate-100">Location:</span>{" "}
                {responseAssignment.report?.location || "N/A"}
              </p>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-100">
                  Your response
                </Label>
                <Textarea
                  rows={4}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="bg-slate-900/80 text-slate-100"
                />
              </div>

              {responseError && (
                <p className="text-xs text-red-300">{responseError}</p>
              )}

              <DialogFooter className="sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setResponseModalOpen(false)}
                  disabled={responseSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmitResponse}
                  disabled={responseSaving}
                  className="h-auto"
                >
                  {responseSaving ? "Saving..." : "Submit response"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={wasteModalOpen} onOpenChange={setWasteModalOpen}>
          <DialogContent className="max-w-md bg-slate-900/95 text-slate-100 border-emerald-700/70">
            <DialogHeader>
              <DialogTitle className="text-slate-100">
                Record Waste Collected
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-100">
                  Collection date
                </Label>
                <Input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="bg-slate-900/80 text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-100">
                  Waste weight collected (kg)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wasteWeight}
                  onChange={(e) => setWasteWeight(e.target.value)}
                  placeholder="e.g. 120.5"
                  className="bg-slate-900/80 text-slate-100"
                />
              </div>
            </div>

            {wasteError && <p className="text-xs text-red-300">{wasteError}</p>}

            <DialogFooter className="sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setWasteModalOpen(false)}
                disabled={wasteSaving}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmitWaste}
                disabled={wasteSaving}
                className="h-auto"
              >
                {wasteSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Incident description modal */}
        <Dialog
          open={!!activeIncident}
          onOpenChange={(open: boolean) => !open && setActiveIncident(null)}
        >
          <DialogContent className="max-w-md bg-slate-900/95 text-slate-100 border-emerald-700/70">
            <DialogHeader>
              <DialogTitle className="text-slate-100">
                Incident Description
              </DialogTitle>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80">
                Details
              </p>
            </DialogHeader>

            <div className="max-h-60 overflow-y-auto rounded-lg bg-slate-900/80 border border-slate-700/70 px-3 py-2">
              <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                {activeIncident?.description}
              </p>
            </div>

            <DialogFooter className="sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveIncident(null)}
                className="h-auto"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Task from secretary modal */}
        <Dialog
          open={!!activeTask}
          onOpenChange={(open: boolean) => !open && setActiveTask(null)}
        >
          <DialogContent className="max-w-lg bg-slate-900/95 text-slate-100 border-emerald-700/70">
            <DialogHeader>
              <DialogTitle className="text-slate-100">
                Task from Secretary
              </DialogTitle>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80">
                Task Details
              </p>
            </DialogHeader>

            <div className="rounded-lg bg-slate-900/80 border border-slate-700/70 px-3 py-2">
              <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                {activeTask?.task_details}
              </p>
            </div>

            <DialogFooter className="sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setActiveTask(null)}
                className="h-auto"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
// ---- Main Page Component ----

export default function GCPDashboard() {
  const router = useRouter();
  useTruckTracking();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statsVisible, setStatsVisible] = useState(true);
  const [displayName, setDisplayName] = useState("User");
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "userAdmin"
    | "viewSchedule"
    | "assignedTasks"
    | "manageAccount"
  >("dashboard");

  useEffect(() => {
    async function fetchDisplayName() {
      const { data: authData, error } = await supabase.auth.getUser();
      if (error || !authData?.user) return;

      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, username")
        .eq("user_id", authData.user.id)
        .single();

      const fullName =
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
      setDisplayName(
        fullName || profile?.username || authData.user.email || "User",
      );
    }

    fetchDisplayName();
  }, []);

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
    null,
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
      "Are you sure you want to update your account details?",
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
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-emerald-950/70 text-slate-100/90 flex flex-col relative overflow-hidden antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-48 left-1/4 h-[520px] w-[520px] rounded-full bg-emerald-500/12 blur-[130px]" />
        <div className="absolute top-24 -right-40 h-[420px] w-[420px] rounded-full bg-sky-500/12 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[360px] w-[360px] rounded-full bg-amber-400/10 blur-[110px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.7),transparent_60%)]" />
      </div>
      {/* Top navigation (SWMO style) */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-900/40 bg-slate-950/80 shadow-lg shadow-emerald-900/20 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/60">
        <div className="flex items-center justify-between px-2 sm:px-4 md:px-8 py-3 sm:py-4 min-h-16">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            {/* Mobile hamburger */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-slate-900/80 text-slate-100 hover:bg-slate-800 transition-colors flex-shrink-0 ring-1 ring-white/10"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? "✖" : "☰"}
            </Button>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-lg flex-shrink-0 shadow-lg shadow-emerald-900/40">
                🚚
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold truncate">
                  Track-the-Truck
                </p>
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-100 truncate">
                  GCP Dashboard
                </h1>
              </div>
            </div>
          </div>
          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-100 font-medium transition-colors whitespace-nowrap ring-1 ring-white/10"
              >
                <svg
                  className="w-3 h-3 sm:w-4 sm:h-4 text-slate-300 transition-transform duration-300 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-slate-900 border border-slate-800 text-slate-200"
            >
              <DropdownMenuLabel className="text-slate-400">
                {displayName}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem
                onClick={() => {
                  setActiveTab("manageAccount");
                  setSidebarOpen(false);
                }}
                className="gap-2"
              >
                <span className="text-lg">⚙️</span>
                <span>Manage Account</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="gap-2 text-red-400 focus:text-red-300"
              >
                <span className="text-lg">🚪</span>
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Shell layout */}
      <div className="flex flex-1 overflow-hidden pt-16">
        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar (SWMO layout, using SidebarItem) */}
        <aside
          className={`
          fixed z-40 left-0 top-16 bottom-0 w-72 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }
          md:fixed md:translate-x-0 md:top-20 md:left-0 md:bottom-0 md:w-64
          bg-slate-950/90 border-r border-emerald-900/30 shadow-2xl shadow-black/30 backdrop-blur-xl
          flex flex-col py-6 px-4 transition-all duration-300
        `}
        >
          <nav
            className="flex-1 space-y-2 text-sm font-semibold text-slate-200"
            aria-label="Main Navigation"
          >
            <SidebarItem
              label="Dashboard"
              icon="🏠"
              selected={activeTab === "dashboard"}
              onClick={() => {
                setActiveTab("dashboard");
                /* keep sidebar open on small screens when Dashboard selected */
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

            <div className="pt-6 mt-6 border-t border-slate-800"></div>
          </nav>
        </aside>

        {/* Main content (unchanged components) */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-10 py-10 space-y-10 relative z-10 md:ml-64 bg-slate-900/40">
          {activeTab === "dashboard" && (
            <>
              <section className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-emerald-400/90 font-semibold">
                      Dashboard
                    </p>
                    <h1 className="text-2xl font-semibold text-slate-50 md:text-3xl tracking-tight">
                      Track-the-Truck Overview
                    </h1>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStatsVisible(!statsVisible)}
                      className="h-auto border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-500/50"
                    >
                      {statsVisible ? "Hide Stats" : "Show Stats"}
                    </Button>
                    <Badge className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-300 px-3 py-2 text-xs font-semibold border border-emerald-500/40 shadow-sm shadow-emerald-900/30">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </Badge>
                  </div>
                </div>

                {statsVisible && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {summaryCards.map((card) => (
                      <Card
                        key={card.label}
                        className="dashboard-card"
                        role="region"
                        aria-label={card.label}
                      >
                        <CardContent className="relative p-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-slate-400 text-sm">
                                {card.label}
                              </p>
                              <CardTitle className="text-3xl font-semibold text-slate-50 tracking-tight">
                                {card.count}
                              </CardTitle>
                              <p className={`text-sm ${card.trendClass}`}>
                                {card.trend}
                              </p>
                            </div>
                            <div
                              className={`${card.iconBg} ${card.iconColor} p-3 rounded-full text-xl ring-1 ring-white/10 shadow-lg shadow-emerald-900/30`}
                            >
                              {card.icon}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="relative bg-slate-900/70 border border-emerald-900/40 rounded-2xl p-6 overflow-hidden shadow-2xl shadow-emerald-900/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-sky-500/5 opacity-70 pointer-events-none" />
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-100">
                      Live Truck Tracking
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-2 rounded-lg bg-emerald-600/20 text-emerald-300 text-sm font-medium border border-emerald-500/30">
                        🟢 Live
                      </span>
                    </div>
                  </div>
                  <div className="relative rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950 h-[340px] sm:h-[420px] md:h-[520px] lg:h-[600px] ring-1 ring-emerald-500/10">
                    <LeafletMap />
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === "viewSchedule" && <GCPScheduleSection />}

          {activeTab === "assignedTasks" && <GCPAssignedTasksSection />}

          {activeTab === "manageAccount" && (
            <div className="dashboard-section max-w-2xl mx-auto">
              <div className="dashboard-section-glow" />
              <div className="relative z-10">
                <ManageAccountSection
                  form={manageAccountForm}
                  loading={manageAccountLoading}
                  error={manageAccountError}
                  success={manageAccountSuccess}
                  onChange={handleManageAccountFormChange}
                  onSubmit={handleManageAccountSubmit}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );

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
      <section className="max-w-5xl mx-auto rounded-3xl bg-slate-900/95 border border-slate-800 px-10 py-8 shadow-2xl">
        <h2 className="text-3xl font-bold mb-1 text-emerald-400">
          Manage Account
        </h2>
        <p className="text-[11px] text-slate-400 mb-6">
          Update your profile details and sign-in credentials.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg bg-red-500/10 border border-red-500/50 px-4 py-2 text-xs text-red-200"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/50 px-4 py-2 text-xs text-emerald-200"
          >
            {success}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {/* Username */}
          <div>
            <Label
              htmlFor="username"
              className="block text-xs font-semibold text-slate-100 mb-1"
            >
              Username
            </Label>
            <Input
              id="username"
              name="username"
              type="text"
              value={form.username}
              onChange={onChange}
              required
              className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
              placeholder="Enter your username"
            />
          </div>

          {/* First / Last */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label
                htmlFor="first_name"
                className="block text-xs font-semibold text-slate-100 mb-1"
              >
                First Name
              </Label>
              <Input
                id="first_name"
                name="first_name"
                type="text"
                value={form.first_name}
                onChange={onChange}
                required
                className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <Label
                htmlFor="last_name"
                className="block text-xs font-semibold text-slate-100 mb-1"
              >
                Last Name
              </Label>
              <Input
                id="last_name"
                name="last_name"
                type="text"
                value={form.last_name}
                onChange={onChange}
                required
                className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
                placeholder="Enter your last name"
              />
            </div>
          </div>

          {/* Contact / Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label
                htmlFor="contact_number"
                className="block text-xs font-semibold text-slate-100 mb-1"
              >
                Contact Number
              </Label>
              <Input
                id="contact_number"
                name="contact_number"
                type="tel"
                value={form.contact_number}
                onChange={onChange}
                required
                className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
                placeholder="09123456789"
              />
            </div>
            <div>
              <Label
                htmlFor="email"
                className="block text-xs font-semibold text-slate-100 mb-1"
              >
                Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={onChange}
                required
                className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
                placeholder="user@tagbilaran.gov.ph"
              />
            </div>
          </div>

          {/* Passwords */}
          <div>
            <Label
              htmlFor="password"
              className="block text-xs font-semibold text-slate-100 mb-1"
            >
              Password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
              placeholder="Leave blank to keep current password"
            />
          </div>

          <div>
            <Label
              htmlFor="confirm_password"
              className="block text-xs font-semibold text-slate-100 mb-1"
            >
              Confirm Password
            </Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              value={form.confirm_password}
              onChange={onChange}
              className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500"
              placeholder="Confirm your new password"
            />
          </div>

          <div className="flex justify-end pt-3">
            <Button type="submit" className="h-auto">
              Update Account
            </Button>
          </div>
        </form>
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
        <Label
          htmlFor={name}
          className="block mb-1 text-xs font-semibold text-slate-100"
        >
          {label}
        </Label>
        <Input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          className="bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-400 focus-visible:ring-emerald-500"
        />
      </div>
    );
  }
}
