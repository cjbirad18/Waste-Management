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
      className={`flex gap-2 items-center w-full px-4 py-3 mb-2 text-left rounded transition ${
        selected
          ? "bg-blue-100 text-blue-700 font-semibold"
          : "hover:bg-gray-100 text-gray-600"
      }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
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
  schedule_id: any;
  barangay: { barangay_name: any; barangay_id: any }[]; // or your real types
  days: string;
  date_created: any;
  start_time: any;
  end_time: any;
  status: any;
};

const [schedules, setSchedules] = useState<Schedule[]>([]);

function ScheduleCalendar({ schedule }: { schedule: Schedule }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

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
        <span className="font-semibold text-lg">
          {format(new Date(year, month), "LLLL yyyy")}
        </span>
      </div>
      <div className="mt-6 flex flex-row gap-6 justify-center max-w-[450px] mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-green-600 border border-green-600"></div>
          <span className="text-gray-800 text-sm">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-red-100 border border-red-400"></div>
          <span className="text-gray-800 text-sm">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-white border border-green-300"></div>
          <span className="text-gray-800 text-sm">No schedule</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-gray-50 border border-gray-100"></div>
          <span className="text-black text-sm">Other month</span>
        </div>
      </div>

      <br />

      <div className="grid grid-cols-7 gap-2 min-w-[350px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="font-semibold py-1 text-center text-gray-800">
            {d}
          </div>
        ))}
        {weeks.map((weekDays, weekIdx) =>
          weekDays.map((day, dayIdx) => {
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
              cellClass += " bg-gray-50 text-gray-300 border-gray-100";
            } else if (isToday) {
              cellClass += " bg-red-100 text-red-700 font-bold border-red-400";
            } else if (isScheduled) {
              cellClass +=
                " bg-green-600 text-white font-bold border-green-600";
            } else {
              cellClass += " bg-white border-green-300 text-green-700";
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
        setSchedules((data as Schedule[]) || []);
      } catch (err: any) {
        setError(err.message ?? "Failed to load schedules.");
      } finally {
        setMainLoading(false);
      }
    }
    fetchGCPSchedules();
  }, []);

  return (
    <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8">
      <h2 className="text-2xl font-bold text-green-600 mb-4">
        My Assigned Schedule
      </h2>
      {mainLoading ? (
        <TruckLoader />
      ) : error ? (
        <p className="text-red-600">Error: {error}</p>
      ) : !schedules.length ? (
        <p className="text-gray-500">No assigned schedule found.</p>
      ) : (
        schedules.map((schedule) => (
          <div key={schedule.schedule_id} className="mb-8">
            <h3 className="font-semibold text-lg mb-2">
              Barangay: {schedule.barangay?.barangay_name || "N/A"}
            </h3>
            <div>
              <strong>Days/Pattern:</strong> {schedule.days}
            </div>
            <div>
              <strong>Start Time:</strong> {schedule.start_time || "N/A"}
            </div>
            <ScheduleCalendar schedule={schedule} />
          </div>
        ))
      )}
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
    <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8 mt-8">
      <h2 className="text-2xl font-bold text-green-600 mb-4">
        Assigned Incident Tasks
      </h2>

      {tasks.length === 0 ? (
        <p className="text-gray-600">You have no assigned incident tasks.</p>
      ) : (
        <div className="space-y-4">
          {tasks.map((t: any) => (
            <div
              key={t.gcp_assignment_id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-lg">
                  Location: {t.report?.location || "N/A"}
                </h3>
                <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200">
                  Status: {t.report?.current_status || "N/A"}
                </span>
              </div>

              <p className="text-sm text-gray-700 mb-1">
                <strong>Landmark:</strong> {t.report?.landmark || "N/A"}
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="px-4 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded font-semibold disabled:bg-gray-300"
                  onClick={() => setActiveIncident(t.report)}
                  disabled={!t.report?.description}
                >
                  View Incident Description
                </button>

                <button
                  type="button"
                  className="px-4 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold disabled:bg-gray-300"
                  onClick={() => setActiveTask(t)}
                  disabled={!t.task_details}
                >
                  View Task from Secretary
                </button>

                {t.gcp_response ? (
                  <span className="px-4 py-1 text-sm rounded font-semibold bg-gray-100 text-gray-600">
                    Already responded
                  </span>
                ) : (
                  <button
                    type="button"
                    className="px-4 py-1 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold"
                    onClick={() => handleOpenResponse(t)}
                  >
                    Add Response
                  </button>
                )}
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Assigned at:{" "}
                {t.created_at ? new Date(t.created_at).toLocaleString() : "N/A"}
              </p>

              {t.gcp_response && (
                <p className="text-xs text-gray-600 mt-1 whitespace-pre-line">
                  <strong>Your response:</strong> {t.gcp_response}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Response modal */}
      {responseModalOpen && responseAssignment && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setResponseModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setResponseModalOpen(false)}
              className="absolute top-2 right-3 text-2xl text-gray-500 hover:text-red-600 font-bold"
              aria-label="Close"
            >
              ×
            </button>

            <h3 className="font-bold text-lg mb-3 text-green-700">
              Add Response
            </h3>

            <p className="text-sm mb-2">
              <span className="font-semibold">Location: </span>
              {responseAssignment.report?.location || "N/A"}
            </p>

            <label className="block text-sm font-semibold mb-1">
              Your response
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm mb-3"
              rows={4}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
            />

            {responseError && (
              <p className="text-xs text-red-600 mb-2">{responseError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResponseModalOpen(false)}
                className="px-4 py-1 text-sm rounded border border-gray-300"
                disabled={responseSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitResponse}
                className="px-4 py-1 text-sm rounded bg-purple-600 text-white hover:bg-purple-700 disabled:bg-gray-400"
                disabled={responseSaving}
              >
                {responseSaving ? "Saving..." : "Submit Response"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incident description modal */}
      {activeIncident && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setActiveIncident(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-green-700">
                Incident Description
              </h3>
              <button
                className="text-xl text-gray-500 hover:text-red-600"
                onClick={() => setActiveIncident(null)}
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-line">
              {activeIncident.description}
            </p>
          </div>
        </div>
      )}

      {/* Task from secretary modal */}
      {activeTask && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setActiveTask(null)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-green-700">
                Task from Secretary
              </h3>
              <button
                className="text-xl text-gray-500 hover:text-red-600"
                onClick={() => setActiveTask(null)}
              >
                ×
              </button>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-line">
              {activeTask.task_details}
            </p>
          </div>
        </div>
      )}

      {/* Response form modal */}
      {responseModalOpen && responseAssignment && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setResponseModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-bold text-green-700">
                GCP Incident Response
              </h3>
              <button
                className="text-xl text-gray-500 hover:text-red-600"
                onClick={() => setResponseModalOpen(false)}
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-700 mb-2">
              <strong>Location:</strong>{" "}
              {responseAssignment.report?.location || "N/A"}
            </p>

            <label className="block text-sm font-semibold mb-1">
              Response / action taken
            </label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm mb-3"
              rows={4}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder="Describe what you did to respond to this incident..."
            />

            {responseError && (
              <p className="text-xs text-red-600 mb-2">{responseError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1 text-sm rounded border border-gray-300"
                onClick={() => setResponseModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-4 py-1 text-sm rounded bg-green-600 text-white hover:bg-purple-700 disabled:bg-gray-400"
                onClick={handleSubmitResponse}
                disabled={responseSaving}
              >
                {responseSaving ? "Saving..." : "Save Response"}
              </button>
            </div>
          </div>
        </div>
      )}
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
    <div className="flex bg-gray-50 min-h-screen">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-[70] p-2 bg-white shadow rounded"
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        {sidebarOpen ? "✖" : "☰"}
      </button>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-opacity-30 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`bg-white/95 backdrop-blur border-r border-emerald-100 shadow-lg flex flex-col pt-6 px-5 md:px-4 fixed top-0 left-0 h-full transition-all duration-300 z-50 ${
          sidebarOpen
            ? "w-4/5 max-w-xs opacity-100"
            : "w-0 opacity-0 overflow-hidden"
        } md:w-64 md:max-w-none md:opacity-100 md:overflow-visible`}
      >
        <div>
          <h1 className="text-xl font-extrabold text-emerald-700 mb-1 tracking-tight">
            GCP Dashboard
          </h1>
          <p className="text-xs font-semibold text-gray-600 leading-snug">
            Garbage Collection Personnel
          </p>
        </div>
        <nav
          className="flex-1 mt-6 text-sm font-semibold text-gray-700 space-y-1"
          aria-label="Main Navigation"
        >
          {" "}
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
          {/* NEW: Assigned Tasks from secretary */}
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
            className="mt-8 mb-4 px-6 py-2 text-red-600 flex items-center gap-2 hover:bg-red-100 rounded"
          >
            Logout
          </button>
        </nav>
      </aside>
      <main className="flex-1 p-6 md:p-8 transition-all duration-300 md:ml-64">
        {activeTab === "dashboard" && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {summaryCards.map((sc, i) => (
                <div
                  key={i}
                  className={`rounded-xl shadow flex flex-col items-center py-6 ${sc.bg}`}
                  role="region"
                  aria-label={sc.label}
                >
                  <span className="text-4xl mb-2" aria-hidden="true">
                    {sc.icon}
                  </span>
                  <span className={`text-xl font-bold ${sc.color}`}>
                    {sc.count}
                  </span>
                  <span className="text-gray-600 text-sm">{sc.label}</span>
                </div>
              ))}
            </section>
            <section aria-label="Map of collection area and vehicles">
              <LeafletMap />
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
    <section className="max-w-lg mx-auto bg-white rounded-xl shadow p-8">
      <h2 className="text-2xl font-bold mb-6 text-green-600">Manage Account</h2>
      {error && (
        <div
          role="alert"
          className="mb-4 px-4 py-2 rounded bg-red-100 text-red-700"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="mb-4 px-4 py-2 rounded bg-green-100 text-green-700"
        >
          {success}
        </div>
      )}
      <form onSubmit={onSubmit} noValidate>
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
        <div className="flex justify-end mt-6">
          <button
            type="submit"
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold"
          >
            Update Account
          </button>
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
      <label htmlFor={name} className="block mb-1 font-semibold text-gray-900">
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
        className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />
    </div>
  );
}
