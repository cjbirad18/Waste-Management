"use client";

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
import TruckLoader from "../../loading/TruckLoader";
import SharedCalendar from "../../components/SharedCalendar";
import { start } from "repl";

const LeafletMap = dynamic(() => import("../../leafletmap"), { ssr: false });

const PATTERN_MAP = {
  MWF: [1, 3, 5],
  TTH: [2, 4],
};

interface Barangay {
  barangay_id: string;
  barangay_name: string;
}

interface Truck {
  truck_id: string;
  truck_code: string;
  plate_number: string;
}

interface GcpUser {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface ManageAccountForm {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  password: string;
  confirm_password: string;
}

interface ScheduleFormState {
  barangay_id: string;
  truck_code: string;
  gcp_user_id: string;
  schedule_pattern: "MWF" | "TTH" | "";
  start_time: string; // locked time like "07:00"
}

type SecretaryActiveTab =
  | "dashboard"
  | "inputSchedule"
  | "garbageTrucks"
  | "schedules"
  | "passedIncidents"
  | "gcpResponses"
  | "manageAccount";

type SidebarItem = {
  label: string;
  icon: string;
  tab: SecretaryActiveTab;
};

// Sidebar navigation item
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
      className={`flex gap-2 items-center w-full px-4 py-3 mb-2 text-left rounded-lg transition-colors ${
        selected
          ? "bg-emerald-600 text-white font-medium"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
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

// Generate all collection dates for the given pattern, year and month
function generatePatternDates(
  pattern: string | null,
  year: number,
  month: number,
) {
  if (!pattern) return [];
  const validDays =
    pattern === "MWF" ? [1, 3, 5] : pattern === "TTH" ? [2, 4] : [];
  let dates: Date[] = [];
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

type ScheduleFormWithCalendarProps = {
  barangays: Barangay[];
  trucks: Truck[];
  gcps: GcpUser[];
};

type ScheduleRecord = {
  schedule_id: string;
  barangay_id: string;
  gcp_user_id: string;
  days: string;
  start_time: string;
};

// Schedule Input form with calendar visualization

function ScheduleFormWithCalendar({
  barangays,
  trucks,
  gcps,
}: ScheduleFormWithCalendarProps) {
  // Calendar months logic - show exactly 2 consecutive months
  const now = new Date();
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [startMonth, setStartMonth] = useState(now.getMonth());

  function getMonthOffset(baseYear: number, baseMonth: number, offset: number) {
    let month = baseMonth + offset;
    let year = baseYear;
    if (month > 11) {
      year += Math.floor(month / 12);
      month = month % 12;
    } else if (month < 0) {
      year += Math.floor(month / 12); // negative years handled
      month = ((month % 12) + 12) % 12;
      if (month > baseMonth) year--;
    }
    return { year, month };
  }

  const monthsToShow = [
    getMonthOffset(startYear, startMonth, 0),
    getMonthOffset(startYear, startMonth, 1),
  ];

  const handleMonthNext = () => {
    const { year, month } = getMonthOffset(startYear, startMonth, 2);
    setStartYear(year);
    setStartMonth(month);
  };

  const handleMonthPrev = () => {
    const { year, month } = getMonthOffset(startYear, startMonth, -2);
    setStartYear(year);
    setStartMonth(month);
  };

  const [schedules, setSchedules] = useState<ScheduleRecord[]>([]);

  const [schedule, setSchedule] = useState<ScheduleFormState>({
    barangay_id: "",
    truck_code: "",
    gcp_user_id: "",
    schedule_pattern: "",
    start_time: "05:00",
  });

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch active schedules to filter barangays and count GCP assignment
  useEffect(() => {
    async function fetchSchedules() {
      const { data, error } = await supabase
        .from("collection_schedules")
        .select("barangay_id, gcp_user_id, days, start_time")
        .eq("status", "Active");
      if (error) {
        setError("Failed to load schedules: " + error.message);
      } else {
        setSchedules((data as ScheduleRecord[]) || []);
      }
    }
    fetchSchedules();
  }, []);

  // Filter out barangays already scheduled
  const scheduledBarangayIds = schedules.map((s) => s.barangay_id);
  const availableBarangays = barangays.filter(
    (b) => !scheduledBarangayIds.includes(b.barangay_id),
  );

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    // If the user changes GCP selection
    if (name === "gcp_user_id") {
      // Count existing assignments for that GCP
      const gcpAssignedCount = schedules.filter(
        (s) => s.gcp_user_id === value,
      ).length;

      // Show confirmation window if assigned >= 2
      if (gcpAssignedCount >= 2) {
        const confirmed = window.confirm(
          "This GCP is already assigned twice. Do you want to continue?",
        );
        if (!confirmed) {
          // If not confirmed, reset the field and return early
          setSchedule((prev) => ({
            ...prev,
            gcp_user_id: "",
          }));
          return;
        }
      }
    }

    // Update state as usual
    setSchedule((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
    setSuccess(null);
  };

  const validateForm = () => {
    if (
      !schedule.barangay_id ||
      !schedule.truck_code ||
      !schedule.gcp_user_id ||
      !schedule.schedule_pattern
    ) {
      setError("All fields are required.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setError(null);
    setSuccess(null);

    // Confirm user intent to save schedule
    const proceedSave = window.confirm(
      "Do you want to continue saving the schedule?",
    );
    if (!proceedSave) return;

    // Count how many schedules the selected GCP already has
    console.log(
      "schedules:",
      schedules,
      "selected GCP ID:",
      schedule.gcp_user_id,
    );

    const gcpAssignedCount = schedules.filter(
      (s) => s.gcp_user_id === schedule.gcp_user_id,
    ).length;

    if (gcpAssignedCount >= 2) {
      const confirmed = window.confirm(
        "This GCP is already assigned twice. Do you want to continue?",
      );
      if (!confirmed) return;
    }

    try {
      const { data: authUser } = await supabase.auth.getUser();
      const user_id = authUser?.user?.id;

      const { data, error: insertError } = await supabase
        .from("collection_schedules")
        .insert([
          {
            barangay_id: schedule.barangay_id,
            gcp_user_id: schedule.gcp_user_id,
            status: "Active",
            days: schedule.schedule_pattern,
            start_time: schedule.start_time,
            created_by: user_id,
          },
        ])
        .select()
        .single();

      if (insertError || !data) {
        setError(
          "Failed to save schedule: " + (insertError?.message ?? "Unknown"),
        );
        setSuccess(null);
        return;
      }

      setSuccess("Schedule successfully created");
      setSchedule({
        barangay_id: "",
        truck_code: "",
        gcp_user_id: "",
        schedule_pattern: "",
        start_time: "05:00",
      });

      // Refresh schedules for updated available barangays and calendar
      const { data: refreshedSchedules, error: refreshError } = await supabase
        .from("collection_schedules")
        .select("barangay_id, gcp_user_id, days, start_time")
        .eq("status", "Active");

      if (!refreshError) {
        setSchedules((refreshedSchedules as ScheduleRecord[]) ?? []);
      }
    } catch (err) {
      setError("Unexpected error: " + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 items-stretch min-h-[600px]">
      {/* Schedule Input Form */}
      <form
        onSubmit={handleSubmit}
        className="group relative flex-1 rounded-3xl bg-gradient-to-br from-slate-900/95 to-slate-900/95 border border-emerald-800/20 p-8 backdrop-blur-md transition-all duration-400 overflow-hidden shadow-inner"
        style={{ maxWidth: 450 }}
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-black bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
            Create Schedules
          </h2>

          {/* Barangay */}
          <div>
            <label
              htmlFor="barangay_id"
              className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3"
            >
              Barangay
            </label>
            <div className="relative">
              <select
                id="barangay_id"
                name="barangay_id"
                value={schedule.barangay_id}
                onChange={handleChange}
                className="w-full rounded-2xl bg-slate-900/80 border border-emerald-800/20 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-shadow duration-200 backdrop-blur-md shadow-sm appearance-none pr-12"
                required
              >
                <option value="">Select Barangay</option>
                {availableBarangays.map((b) => (
                  <option key={b.barangay_id} value={b.barangay_id}>
                    {b.barangay_name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-70"
                >
                  <path
                    d="M6 8l4 4 4-4"
                    stroke="#86efac"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Truck */}
          <div>
            <label
              htmlFor="truck_code"
              className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3"
            >
              Truck
            </label>
            <div className="relative">
              <select
                id="truck_code"
                name="truck_code"
                value={schedule.truck_code}
                onChange={handleChange}
                className="w-full rounded-2xl bg-slate-900/80 border border-emerald-800/20 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-shadow duration-200 backdrop-blur-md shadow-sm appearance-none pr-12"
                required
              >
                <option value="">Select Truck</option>
                {trucks.map((t) => (
                  <option key={t.truck_id} value={t.truck_code}>
                    {t.truck_code}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-70"
                >
                  <path
                    d="M6 8l4 4 4-4"
                    stroke="#86efac"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* GCP */}
          <div>
            <label
              htmlFor="gcp_user_id"
              className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3"
            >
              GCP
            </label>
            <div className="relative">
              <select
                id="gcp_user_id"
                name="gcp_user_id"
                value={schedule.gcp_user_id}
                onChange={handleChange}
                className="w-full rounded-2xl bg-slate-900/80 border border-emerald-800/20 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-shadow duration-200 backdrop-blur-md shadow-sm appearance-none pr-12"
                required
              >
                <option value="">Select GCP</option>
                {gcps.map((g) => (
                  <option key={g.user_id} value={g.user_id}>
                    {g.first_name} {g.last_name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-70"
                >
                  <path
                    d="M6 8l4 4 4-4"
                    stroke="#86efac"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Schedule Pattern */}
          <div>
            <label
              htmlFor="schedule_pattern"
              className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3"
            >
              Schedule Pattern
            </label>
            <div className="relative">
              <select
                id="schedule_pattern"
                name="schedule_pattern"
                value={schedule.schedule_pattern}
                onChange={handleChange}
                className="w-full rounded-2xl bg-slate-900/80 border border-emerald-800/20 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-shadow duration-200 backdrop-blur-md shadow-sm appearance-none pr-12"
                required
              >
                <option value="">Select Pattern</option>
                <option value="MWF">Monday-Wednesday-Friday (MWF)</option>
                <option value="TTH">Tuesday-Thursday (TTH)</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-70"
                >
                  <path
                    d="M6 8l4 4 4-4"
                    stroke="#86efac"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Time */}
          <div>
            <label
              htmlFor="start_time"
              className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
            >
              Time (for display/preview only)
            </label>
            <div className="relative">
              <input
                id="start_time"
                type="time"
                name="start_time"
                value={schedule.start_time}
                onChange={handleChange}
                className="w-full rounded-2xl bg-slate-900/80 border border-emerald-800/20 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-shadow duration-200 backdrop-blur-md shadow-sm pr-12"
                required
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="opacity-70"
                >
                  <path
                    d="M12 7v5l3 3"
                    stroke="#86efac"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="#86efac"
                    strokeWidth="1.2"
                    opacity="0.3"
                  />
                </svg>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-500/40 p-4 text-orange-200 backdrop-blur-xl shadow-lg">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/40 p-4 text-emerald-200 backdrop-blur-xl shadow-lg flex items-center gap-3">
              <div className="w-5 h-5 bg-emerald-500 rounded-full animate-ping" />
              {success}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-green-800/30">
            <button
              type="submit"
              className="group relative inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 text-lg font-black text-slate-100 shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl border border-emerald-500/40 rounded-2xl overflow-hidden"
            >
              <span className="relative z-10 tracking-wide uppercase">
                Save Schedule
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </div>
      </form>

      {/* Calendar View */}
      <div className="group relative flex-1 rounded-3xl bg-slate-900/95 border border-slate-800/30 shadow-md p-8 backdrop-blur-sm transition-all duration-300 overflow-hidden min-w-[350px]">
        {/* Subtle glow effect (reduced) */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/3 via-transparent to-emerald-500/3 opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-3xl font-black bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl">
              Scheduled Days
            </h3>
            <div className="flex gap-3">
              <button
                className="group relative p-3 rounded-2xl bg-slate-700/50 border border-green-800/50 text-slate-200 hover:bg-green-500/20 hover:border-green-600/70 hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 backdrop-blur-xl shadow-md hover:scale-105"
                onClick={handleMonthPrev}
                title="Show previous 2 months"
              >
                <span className="text-xl">&lt;</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl blur-sm" />
              </button>
              <button
                className="group relative p-3 rounded-2xl bg-slate-700/50 border border-green-800/50 text-slate-200 hover:bg-green-500/20 hover:border-green-600/70 hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 backdrop-blur-xl shadow-md hover:scale-105"
                onClick={handleMonthNext}
                title="Show next 2 months"
              >
                <span className="text-xl">&gt;</span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl blur-sm" />
              </button>
            </div>
          </div>

          <div className="overflow-auto max-h-[500px]">
            {monthsToShow.map(({ year, month }) => (
              <SharedCalendar
                key={`${year}-${month}`}
                year={year}
                month={month}
                pattern={schedule.schedule_pattern}
                startTime={schedule.start_time}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SchedulesSidebarItemProps {
  barangays: Barangay[];
}

type SidebarSchedule = {
  schedule_id: string;
  days: string;
  start_time: string;
  barangay?: {
    barangay_name: string;
    barangay_id: string;
  };
};

type CalendarSchedule = {
  days: string;
  start_time: string;
};

function SchedulesSidebarItem({ barangays }: SchedulesSidebarItemProps) {
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [editPattern, setEditPattern] = useState("");
  const [schedules, setSchedules] = useState<SidebarSchedule[]>([]);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [archivedSchedules, setArchivedSchedules] = useState<any[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);

  useEffect(() => {
    if (!selectedBarangay) {
      setSchedules([]);
      return;
    }

    async function fetchSchedules() {
      setLoading(true);
      setError(null);
      try {
        const { data, error } = await supabase
          .from("collection_schedules")
          .select(
            `
    schedule_id,
    barangay:barangay_id (
      barangay_name,
      barangay_id
    ),
    days,
    date_created,
    gcp_user:gcp_user_id (
      first_name,
      last_name
    ),
    collection_details:collection_details (
      collectiondetails_id,
      truck:truck_id (
        plate_number,
        truck_code
      ),
      collection_date,
      status
    )
  `,
          )
          .eq("barangay_id", selectedBarangay)
          .order("date_created", { ascending: false });
        if (error) throw error;
        setSchedules((data as any[]) || []);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    }

    fetchSchedules();
  }, [selectedBarangay]);

  const fetchArchivedSchedules = async () => {
    setArchivedLoading(true);
    try {
      const res = await supabase
        .from("collection_schedules")
        .select(
          `schedule_id, days, start_time, date_created, barangay:barangay_id ( barangay_id, barangay_name ), gcp_user:gcp_user_id ( user_id, first_name, last_name )`,
        )
        .eq("status", "Archived")
        .order("date_created", { ascending: false });

      if ((res as any).error) {
        const err = (res as any).error;
        console.error("Supabase error loading archived schedules:", err);
        setArchivedSchedules([]);
        throw new Error(err.message || JSON.stringify(err));
      }

      const data = (res as any).data || [];
      setArchivedSchedules(data as any[]);
    } catch (err) {
      try {
        console.error(
          "Failed to load archived schedules:",
          err,
          JSON.stringify(err),
        );
      } catch (_e) {
        console.error(
          "Failed to load archived schedules (unserializable):",
          err,
        );
      }
      const msg = err instanceof Error ? err.message : String(err);
      alert("Failed to load archived schedules: " + msg);
    } finally {
      setArchivedLoading(false);
    }
  };

  // Archive schedule instead of deleting
  const handleArchive = async (schedule_id: string) => {
    if (
      !window.confirm(
        "Archive this schedule? It will be hidden from active lists but kept in the system.",
      )
    )
      return;
    try {
      const { error } = await supabase
        .from("collection_schedules")
        .update({ status: "Archived" })
        .eq("schedule_id", schedule_id);
      if (error) throw error;
      setSchedules((s) =>
        s.filter((sc: any) => sc.schedule_id !== schedule_id),
      );
    } catch (err) {
      alert("Failed to archive schedule.");
    }
  };

  // Begin editing
  const handleEdit = (schedule: any) => {
    setEditScheduleId(schedule.schedule_id as string);
    setEditPattern(schedule.days as string);
  };

  // Save edit
  const handleSaveEdit = async (schedule_id: string) => {
    try {
      const { error } = await supabase
        .from("collection_schedules")
        .update({ days: editPattern })
        .eq("schedule_id", schedule_id);

      if (error) throw error;

      setSchedules((s) =>
        s.map((sc: any) =>
          sc.schedule_id === schedule_id ? { ...sc, days: editPattern } : sc,
        ),
      );
      setEditScheduleId(null);
    } catch (err) {
      alert("Failed to update schedule.");
    }
  };

  function renderCalendar(schedule: CalendarSchedule) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    return (
      <div className="my-4">
        <div className="flex justify-center mb-2">
          <span className="font-semibold text-md">
            {format(new Date(year, month), "LLLL yyyy")}
          </span>
        </div>
        <div className="min-w-[280px]">
          <SharedCalendar
            year={year}
            month={month}
            pattern={schedule.days as any}
            startTime={schedule.start_time}
          />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4 h-fit max-h-[92vh]">
        {/* Compact Barangay Select */}
        <div>
          <label
            htmlFor="barangay_select"
            className="block text-slate-100 font-bold uppercase tracking-wider text-xs mb-1.5 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text"
          >
            Barangay
          </label>
          <select
            id="barangay_select"
            className="block w-full rounded-lg bg-slate-900/80 border border-green-800/50 px-3 py-2 text-sm text-slate-200 
                   focus:outline-none focus:ring focus:ring-emerald-500/50 focus:border-emerald-500 
                   appearance-none pr-8"
            value={selectedBarangay}
            onChange={(e) => setSelectedBarangay(e.target.value)}
            required
          >
            <option value="">Select Barangay</option>
            {barangays.map((b) => (
              <option key={b.barangay_id} value={b.barangay_id}>
                {b.barangay_name}
              </option>
            ))}
          </select>
        </div>

        {/* Loading/Error - Minimal */}
        {loading && (
          <div className="flex items-center justify-center py-4 rounded-lg bg-slate-900/50 border border-green-800/50 text-xs text-slate-400">
            <span className="animate-spin mr-2">📅</span>Loading...
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/50 p-2.5 text-orange-200 text-xs flex items-center gap-1.5">
            ⚠️ {error}
          </div>
        )}

        {/* No schedules - Minimal */}
        {selectedBarangay && schedules.length === 0 && !loading && (
          <div className="text-center py-6 rounded-lg bg-slate-900/50 border border-green-800/50 text-slate-400 text-xs">
            <div className="text-xl mb-1 opacity-50">📅</div>
            No schedules
          </div>
        )}

        {/* Full Month Calendar container */}
        <div className="max-h-[75vh] overflow-y-auto rounded-xl bg-gradient-to-br from-slate-800/90 to-gray-800/90 border border-green-800/50 shadow-xl backdrop-blur-xl">
          <div className="flex items-center justify-end p-3 border-b border-green-800/20">
            <button
              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700/60 text-slate-100 rounded-2xl border border-green-800/40 hover:bg-slate-700/80 transition"
              onClick={() => {
                setArchivedOpen(true);
                fetchArchivedSchedules();
              }}
              title="View archived schedules"
            >
              Archived
              <span className="text-xs text-slate-300">
                ({archivedSchedules.length})
              </span>
            </button>
          </div>
          {schedules.map((schedule, index) => (
            <div
              key={schedule.schedule_id}
              className={`p-4 border-b border-green-800/30 last:border-b-0 ${
                index > 0 ? "pt-0 mt-0" : ""
              }`}
            >
              {/* Compact Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2 pb-2 border-b border-green-800/20">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-100 truncate">
                    {schedule.barangay?.barangay_name}
                  </div>
                  <div className="text-xs text-emerald-400 break-words">
                    {schedule.days}
                  </div>
                </div>

                {/* Action Buttons – wrap on small screens */}
                <div className="flex flex-wrap justify-end gap-2">
                  {editScheduleId === schedule.schedule_id ? (
                    <>
                      <input
                        value={editPattern}
                        onChange={(e) => setEditPattern(e.target.value)}
                        className="w-full xs:w-24 sm:w-28 h-8 rounded-lg bg-slate-900/80 border border-slate-600/50 px-2 py-1 text-xs text-slate-200 placeholder-slate-500 
                               focus:outline-none focus:ring-1 focus:ring-emerald-400/50 focus:border-emerald-500/70 
                               transition-all backdrop-blur-sm shadow-sm"
                        placeholder="Pattern"
                      />
                      <button
                        className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded-lg shadow-md 
                               hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center whitespace-nowrap"
                        onClick={() => handleSaveEdit(schedule.schedule_id)}
                      >
                        Save
                      </button>
                      <button
                        className="h-8 px-3 bg-slate-600 hover:bg-slate-700 text-xs font-bold text-white rounded-lg shadow-md 
                               hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center whitespace-nowrap"
                        onClick={() => setEditScheduleId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white rounded-lg shadow-md 
                               hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center whitespace-nowrap"
                        onClick={() => handleEdit(schedule)}
                      >
                        Edit
                      </button>
                      <button
                        className="h-8 px-3 bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white rounded-lg shadow-md 
                               hover:shadow-lg hover:scale-[1.02] transition-all duration-200 flex items-center justify-center whitespace-nowrap"
                        onClick={() => handleArchive(schedule.schedule_id)}
                      >
                        Archive
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Full Calendar */}
              <div className="w-full overflow-x-auto">
                <div className="min-w-[280px]">{renderCalendar(schedule)}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Show more - Minimal */}
        {schedules.length > 2 && (
          <div className="text-center py-2 text-xs text-slate-400 border-t border-green-800/50 rounded-lg bg-slate-900/50">
            +{schedules.length - 2} more
          </div>
        )}
      </div>

      {/* Archived schedules modal */}
      {archivedOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setArchivedOpen(false)}
        >
          <div
            className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl bg-slate-900/98 border border-emerald-700/40 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-100">
                Archived Schedules
              </h3>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded-2xl bg-slate-700/60 text-slate-200"
                  onClick={() => {
                    fetchArchivedSchedules();
                  }}
                >
                  Refresh
                </button>
                <button
                  className="px-3 py-1 rounded-2xl bg-red-600 text-white"
                  onClick={() => setArchivedOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            {archivedLoading ? (
              <div className="py-6 text-center text-slate-300">Loading...</div>
            ) : archivedSchedules.length === 0 ? (
              <div className="py-6 text-center text-slate-400">
                No archived schedules.
              </div>
            ) : (
              <div className="space-y-3">
                {archivedSchedules.map((a) => (
                  <div
                    key={a.schedule_id}
                    className="p-3 rounded-lg bg-slate-800/80 border border-green-800/30 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-100">
                        {a.barangay?.barangay_name ?? "(No barangay)"}
                      </div>
                      <div className="text-xs text-slate-300">
                        {a.days} • {a.start_time}
                      </div>
                      <div className="text-xs text-slate-400">
                        {new Date(a.date_created).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ManageAccountSection({
  form,
  loading,
  error,
  success,
  onChange,
  onSubmit,
}: {
  form: ManageAccountForm;
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
          <label
            htmlFor="username"
            className="block text-xs font-semibold text-slate-100 mb-1"
          >
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={form.username}
            onChange={onChange}
            required
            className="w-full rounded-md bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter your username"
          />
        </div>

        {/* First / Last */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="first_name"
              className="block text-xs font-semibold text-slate-100 mb-1"
            >
              First Name
            </label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              value={form.first_name}
              onChange={onChange}
              required
              className="w-full rounded-md bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your first name"
            />
          </div>
          <div>
            <label
              htmlFor="last_name"
              className="block text-xs font-semibold text-slate-100 mb-1"
            >
              Last Name
            </label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              value={form.last_name}
              onChange={onChange}
              required
              className="w-full rounded-md bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Enter your last name"
            />
          </div>
        </div>

        {/* Contact / Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="contact_number"
              className="block text-xs font-semibold text-slate-100 mb-1"
            >
              Contact Number
            </label>
            <input
              id="contact_number"
              name="contact_number"
              type="tel"
              value={form.contact_number}
              onChange={onChange}
              required
              className="w-full rounded-md bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="09123456789"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-semibold text-slate-100 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              required
              className="w-full rounded-md bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="user@tagbilaran.gov.ph"
            />
          </div>
        </div>

        {/* Passwords */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-100 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            className="w-full rounded-md bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Leave blank to keep current password"
          />
        </div>

        <div>
          <label
            htmlFor="confirm_password"
            className="block text-xs font-semibold text-slate-100 mb-1"
          >
            Confirm Password
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            value={form.confirm_password}
            onChange={onChange}
            className="w-full rounded-md bg-slate-950/80 border border-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Confirm your new password"
          />
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
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

function SecretaryReportsSection() {
  const [reports, setReports] = useState<any[]>([]);
  const [gcpUsers, setGcpUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [selectedGcpId, setSelectedGcpId] = useState("");
  const [taskDetails, setTaskDetails] = useState("");
  const [assignError, setAssignError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");

      // 1) ensure secretary is logged in
      const { data: authUser, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authUser?.user) {
        setError("User not authenticated.");
        setLoading(false);
        return;
      }

      // 2) all passed incidents (status Needs Action)
      const { data: reportData, error: reportError } = await supabase
        .from("community_reports")
        .select("*")
        .eq("current_status", "Needs Action")
        .order("date_submitted", { ascending: false });

      if (reportError) {
        console.error("SECRETARY REPORT ERROR:", reportError);
        setError("Failed to load passed incident reports for the secretary.");
        setLoading(false);
        return;
      }

      setReports(reportData || []);

      // 3) all GCP users city‑wide
      const { data: gcpData, error: gcpError } = await supabase
        .from("users")
        .select("user_id, first_name, last_name")
        .eq("role", "GCP");

      if (!gcpError) {
        setGcpUsers(gcpData || []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const handleOpenAssign = (report: any) => {
    setSelectedReport(report);
    setSelectedGcpId("");
    setTaskDetails("");
    setAssignError("");
    setAssignModalOpen(true);
  };

  const handleSubmitAssign = async () => {
    if (!selectedReport) return;

    if (!selectedGcpId.trim() || !taskDetails.trim()) {
      setAssignError("Please select a GCP and provide task details.");
      return;
    }

    const { data: authUser, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser?.user) {
      setAssignError("User not authenticated.");
      return;
    }

    const secretaryId = authUser.user.id;
    const reportId = selectedReport.report_id;

    // 1) create assignment for chosen GCP (now uses report_id + task_details)
    const { error: assignErrorDb } = await supabase
      .from("gcp_assignment")
      .insert({
        report_id: reportId,
        user_id: selectedGcpId,
        task_details: taskDetails,
      });

    if (assignErrorDb) {
      setAssignError(assignErrorDb.message);
      return;
    }

    // 2) update report status to Ongoing
    const newStatus = "Ongoing";

    const { error: updateError } = await supabase
      .from("community_reports")
      .update({ current_status: newStatus })
      .eq("report_id", reportId);

    // 3) log in report_status_history
    const { error: historyError } = await supabase
      .from("report_status_history")
      .insert({
        report_id: reportId,
        updated_by: secretaryId,
        status: newStatus,
        remarks: `Assigned to GCP (${selectedGcpId}) - Task: ${taskDetails}`,
        timestamp: new Date().toISOString(),
      });

    if (updateError || historyError) {
      setAssignError(
        updateError?.message ||
          historyError?.message ||
          "Failed to update report status.",
      );
      return;
    }

    // 4) remove from Needs Action list in UI
    setReports((prev) => prev.filter((r) => r.report_id !== reportId));

    setAssignModalOpen(false);
    setSelectedReport(null);
    setSelectedGcpId("");
    setTaskDetails("");
    setAssignError("");
  };

  if (loading) return <TruckLoader />;
  if (error) return <div className="text-red-700">{error}</div>;

  return (
    <>
      {/* Main card with passed incidents */}
      <section className="group relative h-190 max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

        <div className="relative z-500">
          <h2 className="text-2xl font-black mb-6 bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
            Passed Incident Reports
          </h2>

          {/* Empty state */}
          {reports.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-green-800/50 backdrop-blur-xl text-slate-400">
              <div className="text-5xl mb-4 opacity-50">🚨</div>
              <p className="text-lg font-semibold">
                No passed incident reports
              </p>
              <p className="text-sm mt-1">at the moment.</p>
            </div>
          ) : (
            /* Scrollable Table */
            <div className="max-h-70 overflow-y-auto rounded-2xl border border-green-800/50 bg-slate-900/50 backdrop-blur-xl shadow-inner pr-2 scrollbar-thin scrollbar-thumb-emerald-500/50 scrollbar-track-slate-900/50">
              <table className="w-full text-md">
                <thead className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 sticky top-0 z-10 border-b border-green-800/50">
                  <tr>
                    <th className="p-4 text-left font-bold text-slate-200">
                      Location
                    </th>
                    <th className="p-4 text-left font-bold text-slate-200">
                      Landmark
                    </th>
                    <th className="p-4 text-left font-bold text-slate-200">
                      Date Submitted
                    </th>
                    <th className="p-4 text-left font-bold text-slate-200">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-800/30">
                  {reports.map((report) => (
                    <tr
                      key={report.report_id}
                      className="hover:bg-slate-800/60 transition-all duration-200 group/item"
                    >
                      <td className="p-4 text-slate-300 font-medium">
                        {report.location}
                      </td>
                      <td className="p-4 text-slate-400">{report.landmark}</td>
                      <td className="p-4 text-slate-400">
                        {new Date(report.date_submitted).toLocaleString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => handleOpenAssign(report)}
                          className="group relative inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 text-sm font-bold text-slate-100 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl border border-emerald-500/40 rounded-xl overflow-hidden whitespace-nowrap"
                        >
                          <span className="relative z-10 uppercase tracking-wide">
                            Assign GCP &amp; Task
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Full-screen modal (fixed design) */}
      {assignModalOpen && selectedReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setAssignModalOpen(false)} // close on backdrop
        >
          <div
            className="group relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-emerald-700/60 bg-gradient-to-br from-slate-900/98 to-slate-800/98 p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()} // keep clicks inside
          >
            {/* Soft glow */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-500/8 via-transparent to-teal-500/8 opacity-0 blur-xl transition-opacity group-hover:opacity-100" />

            <div className="relative z-10">
              {/* Top row: title + close */}
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-emerald-300/80 uppercase">
                    Incident Task Assignment
                  </p>
                  <h3 className="mt-1 text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-xl">
                    Assign GCP &amp; Task
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="group/close relative flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-600/60 bg-slate-900/90 text-sm font-bold text-slate-200 shadow-lg backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-red-500/70 hover:bg-red-600/90 hover:text-white hover:shadow-red-500/40"
                >
                  <span className="relative z-10">✕</span>
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-white/25 to-transparent opacity-0 blur-sm transition-opacity group-hover/close:opacity-100" />
                </button>
              </div>

              {/* Context pill */}
              <div className="mb-4 rounded-2xl border border-emerald-700/50 bg-slate-900/80 px-4 py-3 text-xs text-slate-200 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/70 text-[13px]">
                    📍
                  </span>
                  <div>
                    <p className="font-semibold text-emerald-200 text-[11px] uppercase tracking-wide">
                      Location
                    </p>
                    <p className="text-[13px] text-slate-100">
                      {selectedReport.location}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-px w-full bg-slate-700/70 md:mt-0 md:h-8 md:w-px" />
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-400/70 text-[13px]">
                    🏷️
                  </span>
                  <div>
                    <p className="font-semibold text-emerald-200 text-[11px] uppercase tracking-wide">
                      Landmark
                    </p>
                    <p className="text-[13px] text-slate-100">
                      {selectedReport.landmark}
                    </p>
                  </div>
                </div>
              </div>

              {/* GCP Select */}
              <div className="mb-4">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                  Select GCP
                </label>
                <div className="relative">
                  <select
                    value={selectedGcpId}
                    onChange={(e) => setSelectedGcpId(e.target.value)}
                    className="w-full rounded-xl bg-slate-950/80 border border-emerald-700/60 px-4 py-3 text-sm text-slate-100 
                         focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 
                         transition-all duration-300 backdrop-blur-xl shadow-md hover:shadow-emerald-500/25 
                         appearance-none pr-10 [&:invalid]:text-slate-400"
                  >
                    <option value="">-- Choose GCP --</option>
                    {gcpUsers.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.first_name} {u.last_name}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-emerald-300/80 text-xs">
                    ▼
                  </span>
                </div>
              </div>

              {/* Task details */}
              <div className="mb-6">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">
                  Task Details
                </label>
                <textarea
                  rows={3}
                  value={taskDetails}
                  onChange={(e) => setTaskDetails(e.target.value)}
                  placeholder="Describe what the GCP should do..."
                  className="w-full rounded-xl bg-slate-950/80 border border-emerald-700/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 resize-vertical 
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 
                       transition-all duration-300 backdrop-blur-xl shadow-md hover:shadow-emerald-500/25"
                />
              </div>

              {assignError && (
                <div className="mb-4 rounded-xl border border-orange-500/60 bg-gradient-to-r from-orange-500/20 to-red-500/25 p-3 text-xs text-orange-100 backdrop-blur-xl shadow-md">
                  {assignError}
                </div>
              )}

              {/* Bottom actions */}
              <div className="flex flex-col gap-3 border-t border-emerald-800/40 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="relative inline-flex items-center justify-center rounded-xl border border-slate-500/60 bg-slate-800/90 px-6 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-100 shadow-md backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:bg-slate-700/95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAssign}
                  className="relative inline-flex items-center justify-center rounded-xl border border-emerald-500/60 bg-gradient-to-r from-emerald-600/95 to-teal-500/95 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-50 shadow-lg shadow-emerald-500/40 backdrop-blur-xl transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-emerald-400/60"
                >
                  Assign Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SecretaryGcpResponsesSection() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleOpenModal = (row: any) => {
    setSelectedRow(row);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRow(null);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("gcp_assignment")
        .select(
          `
    gcp_assignment_id,
    created_at,
    task_details,
    gcp_response,
    report:report_id (
      report_id,
      location,
      landmark
    ),
    user:user_id (
      user_id,
      first_name,
      last_name
    ),
    collectiondetails:collectiondetails_id (
      collectiondetails_id,
      collection_date,
      truck:truck_id (
        truck_id,
        plate_number,
        truck_code
      ),
      schedule:schedule_id (
        schedule_id,
        barangay:barangay_id (
          barangay_id,
          barangay_name
        )
      )
    )
  `,
        )
        .order("created_at", { ascending: false });

      if (error) {
        setError("Failed to load GCP responses.");
      } else {
        setRows(data || []);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) return <TruckLoader />;
  if (error) return <div className="text-red-700">{error}</div>;

  return (
    <section className="group relative h-150 max-w-9xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

      <div className="relative z-10">
        <h2 className="text-3xl font-black mb-6 bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
          GCP Responses
        </h2>

        {/* Empty state */}
        {rows.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-green-800/50 backdrop-blur-xl text-slate-400">
            <div className="text-5xl mb-6 opacity-50">💬</div>
            <p className="text-xl font-semibold">No responses yet</p>
          </div>
        ) : (
          /* Scrollable Table */
          <div className="max-h-96 overflow-y-auto rounded-2xl border border-green-800/50 bg-slate-900/50 backdrop-blur-xl shadow-inner pr-3 scrollbar-thin scrollbar-thumb-emerald-500/50 scrollbar-track-slate-900/50 scrollbar-thumb-rounded">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 sticky top-0 z-10 border-b border-green-800/50">
                <tr>
                  <th className="p-4 text-left font-black text-slate-200 tracking-wide">
                    Date
                  </th>
                  <th className="p-4 text-left font-black text-slate-200 tracking-wide">
                    GCP
                  </th>
                  <th className="p-4 text-left font-black text-slate-200 tracking-wide">
                    Location / Barangay
                  </th>
                  <th className="p-4 text-left font-black text-slate-200 tracking-wide">
                    Response
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-800/30">
                {rows.map((row) => (
                  <tr
                    key={row.gcp_assignment_id}
                    className="hover:bg-slate-800/60 transition-all duration-200 group/item cursor-pointer"
                  >
                    <td className="p-4 text-slate-300 font-medium">
                      {new Date(row.created_at).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-4 text-slate-200 font-semibold max-w-[150px] truncate">
                      {row.user
                        ? `${row.user.first_name} ${row.user.last_name}`
                        : "Unknown"}
                    </td>
                    <td className="p-4 text-slate-300 max-w-[200px] truncate">
                      {row.report
                        ? `${row.report.location} (${row.report.landmark})`
                        : (row.collectiondetails?.schedule?.barangay
                            ?.barangayname ?? "N/A")}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleOpenModal(row)}
                        className="group relative inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 text-xs font-bold text-slate-100 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl border border-emerald-500/40 rounded-xl overflow-hidden whitespace-nowrap"
                      >
                        <span className="relative z-10 uppercase tracking-wide">
                          View Response
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Dark Modal */}
        {modalOpen && selectedRow && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div
              className="group relative bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 rounded-2xl shadow-2xl shadow-green-900/30 backdrop-blur-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl rounded-2xl" />

              <div className="relative z-10">
                {/* Close button */}
                <button
                  onClick={handleCloseModal}
                  className="group absolute -top-4 -right-4 w-12 h-12 bg-slate-900/90 border-2 border-slate-600/50 rounded-2xl shadow-xl hover:bg-red-600/90 hover:border-red-500/70 hover:shadow-2xl hover:shadow-red-500/40 hover:scale-110 transition-all duration-300 backdrop-blur-xl flex items-center justify-center text-slate-300 hover:text-white font-bold text-2xl"
                >
                  <span className="relative z-10">✕</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl blur-sm" />
                </button>

                <h3 className="font-black text-2xl mb-6 bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
                  GCP Response
                </h3>

                {/* Response Details */}
                <div className="space-y-5 mb-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                      <span className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                        GCP
                      </span>
                    </div>
                    <div className="text-lg font-semibold text-slate-200">
                      {selectedRow.user
                        ? `${selectedRow.user.first_name} ${selectedRow.user.last_name}`
                        : "Unknown"}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></span>
                      <span className="text-sm font-bold text-blue-300 uppercase tracking-wider">
                        Location
                      </span>
                    </div>
                    <div className="text-lg font-semibold text-slate-200">
                      {selectedRow.report
                        ? `${selectedRow.report.location} (${selectedRow.report.landmark})`
                        : (selectedRow.collectiondetails?.schedule?.barangay
                            ?.barangay_name ?? "N/A")}
                    </div>
                  </div>

                  <div className="text-sm text-slate-400">
                    <span className="font-bold text-slate-300">Date: </span>
                    {selectedRow.created_at
                      ? new Date(selectedRow.created_at).toLocaleString(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )
                      : ""}
                  </div>
                </div>

                {/* Task Details */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-2 h-2 bg-orange-400 rounded-full animate-ping"></span>
                    <span className="text-sm font-bold text-orange-300 uppercase tracking-wider">
                      Task Details
                    </span>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-gray-900/80 border border-orange-500/30 p-5 backdrop-blur-xl shadow-lg text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedRow.task_details || "—"}
                  </div>
                </div>

                {/* GCP Response */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping"></span>
                    <span className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                      GCP Response
                    </span>
                  </div>
                  <div className="rounded-2xl bg-gradient-to-br from-emerald-900/50 to-teal-900/50 border border-emerald-500/40 p-5 backdrop-blur-xl shadow-xl shadow-emerald-500/20 text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {selectedRow.gcp_response || "No response yet"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

type GarbageTrucksSectionProps = {
  gcps: { user_id: string; first_name: string; last_name: string }[];
};

function GarbageTrucksSection({ gcps }: GarbageTrucksSectionProps) {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    plate_number: "",
    capacity: "",
    status: "Available",
    truck_code: "",
    gcp_user_id: "",
  });

  // load existing trucks
  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("garbage_trucks")
        .select(
          "truck_id, plate_number, capacity, status, truck_code, gcp_user_id",
        );
      if (error) setError(error.message);
      else setTrucks(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.plate_number || !form.capacity || !form.truck_code) {
      setError("Plate number, capacity, and truck code are required.");
      return;
    }

    const { data, error } = await supabase
      .from("garbage_trucks")
      .insert({
        plate_number: form.plate_number.trim(),
        capacity: Number(form.capacity),
        status: form.status,
        truck_code: form.truck_code.trim(),
        gcp_user_id: form.gcp_user_id || null,
      })
      .select()
      .single();

    if (error || !data) {
      setError(error?.message || "Failed to add truck.");
      return;
    }

    setTrucks((prev) => [...prev, data]);
    setSuccess("Truck added successfully.");
    setForm({
      plate_number: "",
      capacity: "",
      status: "Available",
      truck_code: "",
      gcp_user_id: "",
    });
  };

  return (
    <section className="group relative max-w-2xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 space-y-6 h-fit">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

      <div className="relative z-10">
        <h2 className="text-2xl font-black mb-6 bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
          Garbage Trucks
        </h2>

        {/* Compact Add Truck form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Plate number */}
            <div>
              <label
                htmlFor="plate_number"
                className="block text-slate-100 font-bold uppercase tracking-wider text-xs mb-2 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
              >
                Plate Number
              </label>
              <input
                id="plate_number"
                name="plate_number"
                value={form.plate_number}
                onChange={handleChange}
                className="w-full rounded-xl bg-slate-900/80 border border-green-800/50 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-md hover:shadow-emerald-500/20"
                placeholder="NCA1234"
                required
              />
            </div>

            {/* Capacity */}
            <div>
              <label
                htmlFor="capacity"
                className="block text-slate-100 font-bold uppercase tracking-wider text-xs mb-2 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
              >
                Capacity
              </label>
              <input
                id="capacity"
                type="number"
                min="0"
                step="0.25"
                name="capacity"
                value={form.capacity}
                onChange={handleChange}
                className="w-full rounded-xl bg-slate-900/80 border border-green-800/50 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-md hover:shadow-emerald-500/20"
                placeholder="6.50"
                required
              />
            </div>

            {/* Status */}
            <div>
              <label
                htmlFor="status"
                className="block text-slate-100 font-bold uppercase tracking-wider text-xs mb-2 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
              >
                Status
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full rounded-xl bg-slate-900/80 border border-green-800/50 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-md hover:shadow-emerald-500/20 appearance-none bg-no-repeat pr-8"
              >
                <option value="Available">Available</option>
                <option value="Under maintenance">Under maintenance</option>
                <option value="Retired">Retired</option>
              </select>
            </div>

            {/* Truck code */}
            <div>
              <label
                htmlFor="truck_code"
                className="block text-slate-100 font-bold uppercase tracking-wider text-xs mb-2 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
              >
                Truck Code
              </label>
              <input
                id="truck_code"
                name="truck_code"
                value={form.truck_code}
                onChange={handleChange}
                className="w-full rounded-xl bg-slate-900/80 border border-green-800/50 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-md hover:shadow-emerald-500/20"
                placeholder="Bool_NCA1234"
                required
              />
            </div>
          </div>

          {/* GCP - Full width */}
          <div>
            <label
              htmlFor="gcp_user_id"
              className="block text-slate-100 font-bold uppercase tracking-wider text-xs mb-2 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
            >
              Assigned GCP (optional)
            </label>
            <select
              id="gcp_user_id"
              name="gcp_user_id"
              value={form.gcp_user_id}
              onChange={handleChange}
              className="w-full rounded-xl bg-slate-900/80 border border-green-800/50 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-md hover:shadow-emerald-500/20 appearance-none bg-no-repeat pr-8"
            >
              <option value="">No default GCP</option>
              {gcps.map((g) => (
                <option key={g.user_id} value={g.user_id}>
                  {g.first_name} {g.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Compact error/success */}
          {error && (
            <div className="rounded-xl bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-500/40 p-3 text-orange-200 text-sm backdrop-blur-xl shadow-lg animate-pulse">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/40 p-3 text-emerald-200 text-sm backdrop-blur-xl shadow-lg flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded-full animate-ping" />
              {success}
            </div>
          )}

          {/* Compact button */}
          <div className="flex justify-end pt-2 border-t border-green-800/30">
            <button
              type="submit"
              className="group relative inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 text-sm font-black text-slate-100 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl border border-emerald-500/40 rounded-2xl overflow-hidden"
            >
              <span className="relative z-10 uppercase tracking-wide">
                ＋ Add Truck
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </div>
        </form>

        {/* ✅ SCROLLABLE Truck List */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold mb-4 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
            Existing Trucks
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-slate-400">
              <span className="text-lg animate-spin mr-2">🚛</span>
              Loading...
            </div>
          ) : trucks.length === 0 ? (
            <div className="text-center py-6 text-slate-400">
              <div className="text-3xl mb-2 opacity-50">🚛</div>
              <p className="text-sm">No trucks added yet</p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-green-800/50 bg-slate-900/50 backdrop-blur-xl shadow-inner pr-2 scrollbar-thin scrollbar-thumb-emerald-500/50 scrollbar-track-slate-900/50 scrollbar-thumb-rounded">
              {trucks.map((t) => (
                <div
                  key={t.truck_id}
                  className="group flex items-center gap-3 p-3 first:pt-4 last:pb-4 rounded-xl border border-green-800/30 hover:bg-slate-800/60 hover:border-green-600/50 transition-all duration-300 backdrop-blur-xl hover:shadow-md mb-2 last:mb-0"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800/50 to-gray-800/50 flex items-center justify-center shadow-md group-hover:scale-105 transition-all">
                    <span className="text-lg">🚛</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-100 truncate">
                      {t.truck_code}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      ({t.plate_number})
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-emerald-400">
                      {t.capacity} tons
                    </div>
                    <span
                      className={`ml-2 inline-flex px-2 py-1 rounded-full text-xs font-bold ${
                        t.status === "Available"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : t.status === "Under maintenance"
                            ? "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                            : "bg-slate-500/20 text-slate-300 border border-slate-500/40"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function SecretaryDashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statsVisible, setStatsVisible] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SecretaryActiveTab>("dashboard");

  useEffect(() => {
    async function fetchBarangays() {
      try {
        const { data, error } = await supabase
          .from("barangay")
          .select("barangay_id, barangay_name");
        if (error) throw error;
        setBarangays(data || []);
      } catch (err) {
        setScheduleError("Failed to load barangays: " + (err as Error).message);
      }
    }
    fetchBarangays();
  }, []);

  // Manage Account States
  const [manageAccountForm, setManageAccountForm] = useState<ManageAccountForm>(
    {
      username: "",
      first_name: "",
      last_name: "",
      email: "",
      contact_number: "",
      password: "",
      confirm_password: "",
    },
  );
  const [manageAccountLoading, setManageAccountLoading] = useState(true);
  const [manageAccountError, setManageAccountError] = useState<string | null>(
    null,
  );
  const [manageAccountSuccess, setManageAccountSuccess] = useState<
    string | null
  >(null);
  const [hasLoadedManageAccount, setHasLoadedManageAccount] = useState(false);

  // Schedule States
  const [schedule, setSchedule] = useState<ScheduleFormState>({
    barangay_id: "",
    truck_code: "",
    gcp_user_id: "",
    schedule_pattern: "",
    start_time: "05:00",
  });
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  // Dropdown options
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [gcps, setGcps] = useState<GcpUser[]>([]);

  const [counts, setCounts] = useState({
    residents: 0,
    gcps: 0,
    barangays: 0,
    incidentReports: 0,
  });

  useEffect(() => {
    async function fetchCounts() {
      let residentCount = 0;
      let gcpCount = 0;
      let barangayCount = 0;
      let reportCount = 0;

      // Residents: users WHERE role = 'Resident'
      try {
        const { count, error } = await supabase
          .from("users")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "Resident");
        if (error) {
          console.error("Resident count fetch error:", error);
        } else {
          residentCount = count || 0;
        }
      } catch (err) {
        console.error("Unexpected error fetching Resident count:", err);
      }

      // GCPs: users WHERE role = 'GCP'
      try {
        const { count, error } = await supabase
          .from("users")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "GCP");
        if (error) {
          console.error("GCP count fetch error:", error);
        } else {
          gcpCount = count || 0;
        }
      } catch (err) {
        console.error("Unexpected error fetching GCP count:", err);
      }

      // Barangays: all rows in barangay table
      try {
        const { count, error } = await supabase
          .from("users")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "BWMC");
        if (error) {
          console.error("Barangay count fetch error:", error);
        } else {
          barangayCount = count || 0;
        }
      } catch (err) {
        console.error("Unexpected error fetching Barangay count:", err);
      }

      // Incident Reports: all rows in community_reports
      try {
        const { count, error } = await supabase
          .from("community_reports")
          .select("report_id", { count: "exact", head: true });
        if (error) {
          console.error("Incident Reports count fetch error:", error);
        } else {
          reportCount = count || 0;
        }
      } catch (err) {
        console.error("Unexpected error fetching Incident Reports count:", err);
      }

      setCounts({
        residents: residentCount,
        gcps: gcpCount,
        barangays: barangayCount,
        incidentReports: reportCount,
      });
    }

    fetchCounts();
  }, []);

  const summaryCards = [
    {
      label: "Residents Registered",
      icon: "👤",
      bg: "bg-blue-50",
      color: "text-blue-700",
      count: counts.residents,
    },
    {
      label: "GCP Registered",
      icon: "🛠️",
      bg: "bg-yellow-50",
      color: "text-yellow-700",
      count: counts.gcps,
    },
    {
      label: "Barangays Registered",
      icon: "🌏",
      bg: "bg-orange-50",
      color: "text-orange-700",
      count: counts.barangays,
    },
    {
      label: "Incident Reports",
      icon: "🗑️",
      bg: "bg-green-50",
      color: "text-green-700",
      count: counts.incidentReports,
    },
  ];

  // Fetch current user info to populate Manage Account form
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
    if (activeTab !== "manageAccount") setHasLoadedManageAccount(false);
  }, [activeTab]);

  // Fetch dropdown data once inputSchedule tab is active
  useEffect(() => {
    async function fetchDropdownData() {
      try {
        const [barangayResp, truckResp, gcpResp] = await Promise.all([
          supabase.from("barangay").select("barangay_id, barangay_name"),
          supabase
            .from("garbage_trucks")
            .select("truck_id, truck_code, plate_number"),
          supabase
            .from("users")
            .select("user_id, first_name, last_name")
            .eq("role", "GCP"),
        ]);
        if (barangayResp.error) throw barangayResp.error;
        if (truckResp.error) throw truckResp.error;
        if (gcpResp.error) throw gcpResp.error;
        setBarangays(barangayResp.data || []);
        setTrucks(truckResp.data || []);
        setGcps(gcpResp.data || []);
      } catch (err) {
        setScheduleError(
          "Failed to load reference data: " + (err as Error).message,
        );
      }
    }
    if (activeTab === "inputSchedule") {
      fetchDropdownData();
    }
  }, [activeTab]);

  // Handlers for Schedule form inputs
  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setManageAccountForm({
      ...manageAccountForm,
      [e.target.name]: e.target.value,
    });
  };

  // Form validation for Manage Account
  const validateManageAccountForm = () => {
    if (
      !manageAccountForm.first_name.trim() ||
      !manageAccountForm.last_name.trim() ||
      !manageAccountForm.username.trim() ||
      !manageAccountForm.email.trim() ||
      !manageAccountForm.contact_number.trim()
    ) {
      return "All fields except password are required.";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manageAccountForm.email)) {
      return "Invalid email format.";
    }
    if (
      manageAccountForm.password.length > 0 &&
      manageAccountForm.password.length < 6
    ) {
      return "Password must be at least 6 characters.";
    }
    if (manageAccountForm.password !== manageAccountForm.confirm_password) {
      return "Passwords do not match.";
    }
    if (manageAccountForm.contact_number.length !== 11) {
      return "Contact number must be exactly 11 digits.";
    }
    return null;
  };

  // Form validation for Schedule form
  const validateScheduleForm = () => {
    const { barangay_id, truck_code, gcp_user_id, schedule_pattern } = schedule;
    if (!barangay_id || !truck_code || !gcp_user_id || !schedule_pattern) {
      setScheduleError("All fields are required.");
      return false;
    }
    return true;
  };

  // Manage Account form submission
  const handleManageAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to update your account?"))
      return;

    setManageAccountError(null);
    setManageAccountSuccess(null);
    const error = validateManageAccountForm();
    if (error) {
      setManageAccountError(error);
      return;
    }
    try {
      const { data: authUserData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authUserData?.user) {
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
    } catch (err) {
      setManageAccountError(`Unexpected error: ${(err as Error).message}`);
    }
  };

  // Schedule form submission
  const handleScheduleSubmit = async (scheduleData: ScheduleFormState) => {
    if (
      !scheduleData.barangay_id ||
      !scheduleData.truck_code ||
      !scheduleData.gcp_user_id ||
      !scheduleData.schedule_pattern
    ) {
      setScheduleError("All fields are required.");
      return;
    }

    const { data: authUser, error } = await supabase.auth.getUser();
    const user_id = authUser?.user?.id;

    try {
      // 1. Create collection_schedules row
      const { data: scheduleRow, error: scheduleError } = await supabase
        .from("collection_schedules")
        .insert([
          {
            barangay_id: scheduleData.barangay_id,
            days: scheduleData.schedule_pattern,
            start_time: scheduleData.start_time,
            gcp_user_id: scheduleData.gcp_user_id,
            created_by: user_id,
          },
        ])
        .select()
        .single();

      if (scheduleError || !scheduleRow) throw scheduleError;

      // 2. Create collection_details row
      const { data: detail, error: detailError } = await supabase
        .from("collection_details")
        .insert([
          {
            schedule_id: scheduleRow.schedule_id,
            truck_id: scheduleData.truck_code,
            status: "scheduled",
          },
        ])
        .select()
        .single();
      if (detailError || !detail) throw detailError;

      // 3. Assign the GCP in gcp_assignment
      const { error: assignError } = await supabase
        .from("gcp_assignment")
        .insert([
          {
            collectiondetails_id: detail.collectiondetails_id,
            user_id: scheduleData.gcp_user_id,
          },
        ]);
      if (assignError) throw assignError;

      setScheduleSuccess("Schedule successfully created");
      setSchedule({
        barangay_id: "",
        truck_code: "",
        gcp_user_id: "",
        schedule_pattern: "",
        start_time: "05:00",
      });
      setScheduleError(null);
    } catch (err) {
      setScheduleError(`Failed to save schedule: ${(err as Error).message}`);
      setScheduleSuccess(null);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert(`Logout error: ${error.message}`);
        return;
      }
      router.push("/");
    }
  };

  const sidebarItems: {
    label: string;
    icon: string;
    tab: SecretaryActiveTab;
  }[] = [
    { label: "Dashboard", icon: "📊", tab: "dashboard" },
    { label: "Create Schedules", icon: "📝", tab: "inputSchedule" },
    { label: "Garbage Trucks", icon: "🚚", tab: "garbageTrucks" },
    { label: "View Schedules", icon: "📅", tab: "schedules" },
    { label: "Passed Incidents", icon: "🚨", tab: "passedIncidents" },
    { label: "GCP Responses", icon: "💬", tab: "gcpResponses" },
    { label: "Manage Account", icon: "👤", tab: "manageAccount" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative">
      {/* Top navigation (same as SWMO) */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between px-2 sm:px-4 md:px-8 py-3 sm:py-4 min-h-16">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors flex-shrink-0"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? "✖" : "☰"}
            </button>
            <button
              onClick={() => {
                setActiveTab("dashboard");
                setSidebarOpen(false);
              }}
              className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800/80 text-emerald-300 hover:bg-emerald-600/10 flex-shrink-0"
              aria-label="Go to Dashboard"
            >
              📊
            </button>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-emerald-600/20 border border-emerald-600/30 text-lg flex-shrink-0">
                🚛
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold truncate">
                  Track-the-Truck
                </p>
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-100 truncate">
                  Secretary Dashboard
                </h1>
              </div>
            </div>
          </div>
          {/* Profile Dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline text-xs sm:text-sm">
                Secretary
              </span>
              <svg
                className={`w-3 h-3 sm:w-4 sm:h-4 text-slate-300 transition-transform duration-300 flex-shrink-0 ${profileDropdownOpen ? "rotate-180" : ""}`}
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
            </button>
            {profileDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 rounded-lg bg-slate-900 border border-slate-800 shadow-xl overflow-hidden z-50">
                  <div className="p-3 border-b border-slate-800">
                    <p className="text-xs text-slate-400 font-medium">
                      Secretary
                    </p>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setActiveTab("manageAccount");
                        setProfileDropdownOpen(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <span className="text-lg">⚙️</span>
                      <span>Manage Account</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-slate-800 transition-colors"
                    >
                      <span className="text-lg">🚪</span>
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
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

        {/* Sidebar – Secretary items */}
        <aside
          className={`
          fixed z-40 left-0 top-16 bottom-0 w-72 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }
          md:fixed md:translate-x-0 md:top-20 md:left-0 md:bottom-0 md:w-64
            bg-slate-950 border-r border-slate-800
            flex flex-col py-6 px-4 transition-all duration-300
        `}
        >
          <nav
            className="flex-1 space-y-2 text-sm font-semibold text-slate-200"
            aria-label="Main Navigation"
          >
            {[
              { label: "Dashboard", icon: "📊", tab: "dashboard" },
              { label: "Create Schedules", icon: "📝", tab: "inputSchedule" },
              { label: "Garbage Trucks", icon: "🚚", tab: "garbageTrucks" },
              { label: "View Schedules", icon: "📅", tab: "schedules" },
              { label: "Passed Incidents", icon: "🚨", tab: "passedIncidents" },
              { label: "GCP Responses", icon: "💬", tab: "gcpResponses" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveTab(item.tab as SecretaryActiveTab);
                  if (item.tab !== "dashboard") setSidebarOpen(false);
                }}
                className={`group relative w-full flex items-center gap-3 rounded-2xl border ${
                  activeTab === item.tab
                    ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-xl shadow-green-500/30 border-green-500/50"
                    : "border-green-800/50 bg-slate-800/80 text-emerald-300 hover:border-green-600/70 hover:bg-green-500/10 hover:shadow-lg hover:shadow-green-500/25"
                } px-4 py-3 text-left transition-all duration-300 backdrop-blur-xl shadow-md hover:scale-[1.02] ${
                  activeTab === item.tab ? "!text-emerald-100" : ""
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-bold">{item.label}</span>
                {activeTab === item.tab && (
                  <div className="absolute right-3 w-2 h-6 bg-gradient-to-b from-emerald-400 to-teal-400 rounded-full animate-pulse" />
                )}
              </button>
            ))}

            <div className="pt-6 mt-6 border-t border-slate-800"></div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 py-8 space-y-8 relative z-10 md:ml-64 bg-slate-900/50">
          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <>
              {/* Collapsible Stats Section */}
              <div
                className={`transition-all duration-500 ease-in-out overflow-hidden ${
                  statsVisible
                    ? "max-h-[500px] opacity-100 mb-8"
                    : "max-h-0 opacity-0 mb-0"
                }`}
              >
                <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
                  {summaryCards.map((card, idx) => (
                    <div
                      key={idx}
                      className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 shadow-lg shadow-green-900/20 p-3.5 sm:p-4 backdrop-blur-2xl hover:shadow-xl hover:shadow-green-600/30 transition-all duration-300 hover:border-green-600/70"
                      role="region"
                      aria-label={card.label}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/6 via-transparent to-teal-500/6 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 flex items-center justify-center text-lg border border-green-800/50 shadow">
                              {card.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] uppercase tracking-wide text-emerald-400 font-semibold truncate">
                                {card.label}
                              </p>
                              <p className="text-xl sm:text-2xl font-black bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent leading-none">
                                {card.count}
                              </p>
                            </div>
                          </div>
                          <div className="hidden sm:inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                            Auto
                          </div>
                        </div>

                        <div className="mt-2.5">
                          <div className="h-1.5 w-full rounded-full bg-slate-900/90 overflow-hidden border border-green-800/50">
                            <div className="h-full w-[70%] bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow" />
                          </div>
                          <p className="mt-1.5 text-[9px] text-slate-400">
                            Auto-updated from collection data
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              </div>

              {/* Map Section with Toggle Button */}
              <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)] gap-6">
                <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                        Collection Coverage Map
                      </h2>
                      <div className="flex items-center gap-3">
                        {/* Stats Toggle Button */}
                        <button
                          onClick={() => setStatsVisible(!statsVisible)}
                          className="group/btn inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 text-emerald-300 border border-emerald-500/30 font-semibold text-xs backdrop-blur-sm hover:bg-emerald-500/20 hover:border-emerald-400/50 transition-all duration-300 relative z-10"
                          title={
                            statsVisible ? "Hide Statistics" : "Show Statistics"
                          }
                        >
                          <span className="text-sm">
                            {statsVisible ? "📊" : "📈"}
                          </span>
                          <span className="hidden sm:inline">
                            {statsVisible ? "Hide Stats" : "Show Stats"}
                          </span>
                        </button>
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-sm backdrop-blur-sm relative z-10">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                          Live vehicles
                        </span>
                      </div>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 h-[340px] sm:h-[420px] md:h-[520px] lg:h-[600px] relative z-10">
                      <LeafletMap />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Manage Account */}
          {activeTab === "manageAccount" && (
            <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 max-w-2xl mx-auto">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
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

          {/* Create Schedules */}
          {activeTab === "inputSchedule" && (
            <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <ScheduleFormWithCalendar
                  barangays={barangays}
                  trucks={trucks}
                  gcps={gcps}
                />
              </div>
            </div>
          )}

          {/* Garbage Trucks */}
          {activeTab === "garbageTrucks" && (
            <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <GarbageTrucksSection gcps={gcps} />
              </div>
            </div>
          )}

          {/* Schedules */}
          {activeTab === "schedules" && (
            <div className="group relative max-w-6xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-8 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-2xl">
                  Schedules Overview
                </h2>
                <SchedulesSidebarItem barangays={barangays} />
              </div>
            </div>
          )}

          {/* Passed Incidents */}
          {activeTab === "passedIncidents" && (
            <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <SecretaryReportsSection />
              </div>
            </div>
          )}

          {/* GCP Responses */}
          {activeTab === "gcpResponses" && (
            <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <SecretaryGcpResponsesSection />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
