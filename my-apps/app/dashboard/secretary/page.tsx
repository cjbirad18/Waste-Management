"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { createPortal } from "react-dom";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  icon: React.ReactNode;
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
    <Button
      variant={selected ? "default" : "ghost"}
      onClick={onClick}
      className={`flex gap-2 items-center w-full justify-start px-4 py-3 mb-2 text-left rounded-lg ${
        selected
          ? "bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </Button>
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

  // Add initials state and effect
  const [initials, setInitials] = useState("");
  useEffect(() => {
    async function fetchInitials() {
      const { data: authData, error } = await supabase.auth.getUser();
      if (error || !authData?.user) return;
      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name, username")
        .eq("user_id", authData.user.id)
        .single();
      const fullName =
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
      let computedInitials = "";
      if (fullName) {
        const parts = fullName.split(" ").filter(Boolean);
        computedInitials = parts
          .map((p) => p[0])
          .join("")
          .toUpperCase();
      } else if (profile?.username) {
        computedInitials = profile.username.slice(0, 2).toUpperCase();
      } else if (authData.user.email) {
        computedInitials = authData.user.email.slice(0, 2).toUpperCase();
      } else {
        computedInitials = "U";
      }
      setInitials(computedInitials);
    }
    fetchInitials();
  }, []);

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

    const channel = supabase
      .channel("secretary-schedule-form-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_schedules" },
        () => {
          fetchSchedules();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      // Call GCP SMS notification API
      try {
        const notifRes = await fetch("/api/notifications/gcp-schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            gcp_user_id: schedule.gcp_user_id,
            barangay_id: schedule.barangay_id,
            schedule_pattern: schedule.schedule_pattern,
            start_time: schedule.start_time,
            truck_code: schedule.truck_code,
            created_by: user_id,
          }),
        });
        const notifData = await notifRes.json();
        if (!notifRes.ok) {
          console.error("GCP notification failed:", notifData.error);
        } else {
          console.log("GCP notification sent:", notifData);
        }
      } catch (apiErr) {
        console.error("Failed to notify GCP via SMS API", apiErr);
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
    <div className="flex flex-col lg:flex-row gap-6 items-stretch min-h-[700px] p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/30">
      {/* Schedule Input Form - Glassmorphism Card */}
      <form
        onSubmit={handleSubmit}
        className="group relative flex-1 rounded-[2rem] bg-slate-900/40 border border-emerald-500/10 p-8 backdrop-blur-2xl transition-all duration-500 overflow-hidden shadow-2xl shadow-black/40 hover:shadow-emerald-900/20 hover:border-emerald-500/20"
        style={{ maxWidth: 420 }}
      >
        {/* Animated background gradient */}
        <div className="absolute -inset-[100%] bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.08),transparent_50%)] animate-pulse-slow pointer-events-none" />

        {/* Top accent line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-60" />

        <div className="relative z-10 space-y-7">
          {/* Header with icon */}
          <div className="flex items-center gap-4 pb-6 border-b border-emerald-500/10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <svg
                className="w-6 h-6 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                Schedule Builder
              </h2>
              <p className="text-xs text-emerald-400/60 font-medium uppercase tracking-widest mt-0.5">
                Waste Collection System
              </p>
            </div>
          </div>

          {/* Barangay - Floating Label Style */}
          <div className="space-y-2">
            <label
              htmlFor="barangay_id"
              className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider ml-1"
            >
              Barangay Zone
            </label>
            <div className="relative group/input">
              <select
                id="barangay_id"
                name="barangay_id"
                value={schedule.barangay_id}
                onChange={handleChange}
                className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-800/70"
                required
              >
                <option value="" className="bg-slate-900 text-slate-400">
                  Select Barangay
                </option>
                {availableBarangays.map((b) => (
                  <option
                    key={b.barangay_id}
                    value={b.barangay_id}
                    className="bg-slate-900"
                  >
                    {b.barangay_name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <svg
                  className="w-4 h-4 text-emerald-500/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5 pointer-events-none" />
            </div>
          </div>

          {/* Truck & GCP - Side by Side Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label
                htmlFor="truck_code"
                className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider ml-1"
              >
                Truck Unit
              </label>
              <div className="relative group/input">
                <select
                  id="truck_code"
                  name="truck_code"
                  value={schedule.truck_code}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 px-3 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-800/70"
                  required
                >
                  <option value="" className="bg-slate-900">
                    Select
                  </option>
                  {trucks.map((t) => (
                    <option
                      key={t.truck_id}
                      value={t.truck_code}
                      className="bg-slate-900"
                    >
                      {t.truck_code}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-emerald-500/70"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="gcp_user_id"
                className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider ml-1"
              >
                GCP Officer
              </label>
              <div className="relative group/input">
                <select
                  id="gcp_user_id"
                  name="gcp_user_id"
                  value={schedule.gcp_user_id}
                  onChange={handleChange}
                  className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 px-3 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-800/70"
                  required
                >
                  <option value="" className="bg-slate-900">
                    Select
                  </option>
                  {gcps.map((g) => (
                    <option
                      key={g.user_id}
                      value={g.user_id}
                      className="bg-slate-900"
                    >
                      {g.first_name} {g.last_name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-emerald-500/70"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Pattern - Segmented Control Alternative */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider ml-1">
              Collection Pattern
            </label>
            <div className="relative">
              <select
                id="schedule_pattern"
                name="schedule_pattern"
                value={schedule.schedule_pattern}
                onChange={handleChange}
                className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all duration-300 appearance-none cursor-pointer hover:bg-slate-800/70"
                required
              >
                <option value="" className="bg-slate-900">
                  Select Pattern
                </option>
                <option value="MWF" className="bg-slate-900">
                  Mon-Wed-Fri (MWF)
                </option>
                <option value="TTH" className="bg-slate-900">
                  Tue-Thu (TTH)
                </option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <svg
                  className="w-4 h-4 text-emerald-500/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Time - Modern Time Input */}
          <div className="space-y-2">
            <label
              htmlFor="start_time"
              className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider ml-1"
            >
              Departure Time
            </label>
            <div className="relative group/input">
              <input
                id="start_time"
                type="time"
                name="start_time"
                value={schedule.start_time}
                onChange={handleChange}
                className="w-full rounded-xl bg-slate-800/50 border border-slate-700/50 px-4 py-3.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all duration-300 hover:bg-slate-800/70 [color-scheme:dark]"
                required
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                <svg
                  className="w-4 h-4 text-emerald-500/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Alerts - Redesigned Toast Style */}
          <div className="space-y-3">
            {error && (
              <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4 backdrop-blur-sm">
                <svg
                  className="w-5 h-5 text-red-400 mt-0.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-red-200/90 leading-relaxed">
                  {error}
                </span>
              </div>
            )}
            {success && (
              <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4 backdrop-blur-sm">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <span className="text-sm text-emerald-200/90 leading-relaxed">
                  {success}
                </span>
              </div>
            )}
          </div>

          {/* Submit Button - Gradient Glow */}
          <div className="pt-4">
            <button
              type="submit"
              className="group/btn relative w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-sm font-bold text-white rounded-xl shadow-lg shadow-emerald-900/50 hover:shadow-emerald-500/25 hover:shadow-xl transition-all duration-300 overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Save Schedule
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-white/20 to-emerald-400/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            </button>
          </div>
        </div>
      </form>

      {/* Calendar View - Immersive Display */}
      <div className="group relative flex-1 rounded-[2rem] bg-slate-900/40 border border-slate-700/20 shadow-2xl shadow-black/40 p-8 backdrop-blur-2xl transition-all duration-500 overflow-hidden min-w-[350px] max-h-[700px] hover:border-emerald-500/10">
        {/* Subtle grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-20 h-20 border-l-2 border-t-2 border-emerald-500/20 rounded-tl-[2rem] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-20 h-20 border-r-2 border-b-2 border-emerald-500/20 rounded-br-[2rem] pointer-events-none" />

        <div className="relative z-10 h-full flex flex-col">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-700/30">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-600/10 border border-emerald-500/20 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-100">
                  Collection Calendar
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  View scheduled collection days
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="group/btn p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all duration-300"
                onClick={handleMonthPrev}
                title="Previous months"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <button
                className="group/btn p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all duration-300"
                onClick={handleMonthNext}
                title="Next months"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Calendar Content */}
          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-emerald-500/20 scrollbar-track-transparent">
            {monthsToShow.map(({ year, month }) => (
              <div key={`${year}-${month}`} className="relative">
                <SharedCalendar
                  year={year}
                  month={month}
                  pattern={schedule.schedule_pattern}
                  startTime={schedule.start_time}
                />
              </div>
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
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

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

    const channel = supabase
      .channel("secretary-schedules-sidebar-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_schedules" },
        () => {
          fetchSchedules();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_details" },
        () => {
          fetchSchedules();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBarangay]);

  const fetchArchivedSchedules = async () => {
    setArchivedLoading(true);
    try {
      const res = await supabase
        .from("collection_schedules")
        .select(
          `schedule_id, days, start_time, date_created, barangay:barangay_id ( barang_id, barangay_name ), gcp_user:gcp_user_id ( user_id, first_name, last_name )`,
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
  const handleArchive = async (schedule: any) => {
    if (
      !window.confirm(
        "Archive this schedule? It will be hidden from active lists but kept in the system. Residents will be notified.",
      )
    )
      return;
    try {
      const { error } = await supabase
        .from("collection_schedules")
        .update({ status: "Archived" })
        .eq("schedule_id", schedule.schedule_id);
      if (error) throw error;

      // Notify residents and GCP of schedule archival
      const notificationRes = await fetch(
        "/api/notifications/schedule-update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleId: schedule.schedule_id,
            barangayId: schedule.barangay.barangay_id,
            updateType: "archived",
            scheduleDate: schedule.date_created,
          }),
        },
      );

      const notificationData = await notificationRes.json();
      if (notificationData.success) {
        console.log(
          `Notifications sent to ${notificationData.notificationsSent} recipients`,
        );
      }

      setSchedules((s) =>
        s.filter((sc: any) => sc.schedule_id !== schedule.schedule_id),
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
  const handleSaveEdit = async (schedule: any) => {
    if (isSavingSchedule) return; // Prevent multiple clicks

    setIsSavingSchedule(true);
    try {
      const { error } = await supabase
        .from("collection_schedules")
        .update({ days: editPattern })
        .eq("schedule_id", schedule.schedule_id);

      if (error) throw error;

      // Notify residents and GCP of schedule update
      const notificationRes = await fetch(
        "/api/notifications/schedule-update",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleId: schedule.schedule_id,
            barangayId: schedule.barangay.barangay_id,
            updateType: "updated",
            scheduleDate: schedule.date_created,
            scheduleTime: schedule.start_time,
            oldPattern: schedule.days,
            newPattern: editPattern,
          }),
        },
      );

      const notificationData = await notificationRes.json();
      console.log("Notification response:", notificationData);
      if (notificationData.success) {
        console.log(
          `Update notifications sent to ${notificationData.notificationsSent} recipients:`,
          notificationData.recipients,
        );
        if (notificationData.notificationsSent === 0) {
          alert("Schedule updated, but no residents found in this barangay.");
        } else {
          alert(
            `Schedule updated! Notifications sent to ${notificationData.notificationsSent} residents.`,
          );
        }
      } else {
        console.error("Notification API error:", notificationData.error);
        alert(
          "Schedule updated, but failed to send notifications: " +
            notificationData.error,
        );
      }

      setSchedules((s) =>
        s.map((sc: any) =>
          sc.schedule_id === schedule.schedule_id
            ? { ...sc, days: editPattern }
            : sc,
        ),
      );
      setEditScheduleId(null);
    } catch (err) {
      console.error("Error updating schedule:", err);
      alert(
        "Failed to update schedule: " +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setIsSavingSchedule(false);
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
                      <select
                        value={editPattern}
                        onChange={(e) => setEditPattern(e.target.value)}
                        className="w-full xs:w-32 sm:w-40 h-8 rounded-lg bg-slate-900/80 border border-slate-600/50 px-2 py-1 text-xs text-slate-200
                               focus:outline-none focus:ring-1 focus:ring-emerald-400/50 focus:border-emerald-500/70 
                               transition-all backdrop-blur-sm shadow-sm cursor-pointer"
                      >
                        <option value="">Select Pattern</option>
                        <option value="MWF">
                          Monday, Wednesday, Friday (MWF)
                        </option>
                        <option value="TTH">Tuesday, Thursday (TTH)</option>
                      </select>
                      <button
                        disabled={isSavingSchedule}
                        className={`h-8 px-3 text-xs font-bold text-white rounded-lg shadow-md transition-all duration-200 flex items-center justify-center whitespace-nowrap ${
                          isSavingSchedule
                            ? "bg-slate-500 cursor-not-allowed opacity-60"
                            : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-lg hover:scale-[1.02]"
                        }`}
                        onClick={() => handleSaveEdit(schedule)}
                      >
                        {isSavingSchedule ? "Saving..." : "Save"}
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
                        onClick={() => handleArchive(schedule)}
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
          <div className="space-y-2">
            <Label
              htmlFor="contact_number"
              className="text-xs font-semibold text-slate-100"
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
              placeholder="09123456789"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="email"
              className="text-xs font-semibold text-slate-100"
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
              placeholder="user@tagbilaran.gov.ph"
            />
          </div>
        </div>

        {/* Passwords */}
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-xs font-semibold text-slate-100"
          >
            Password
          </Label>
          <Input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={onChange}
            placeholder="Leave blank to keep current password"
          />
        </div>

        <div className="space-y-2">
          <Label
            htmlFor="confirm_password"
            className="text-xs font-semibold text-slate-100"
          >
            Confirm Password
          </Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            value={form.confirm_password}
            onChange={onChange}
            placeholder="Confirm your new password"
          />
        </div>

        <div className="flex justify-end pt-3">
          <Button type="submit">Update Account</Button>
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

  // Search & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

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

    const channel = supabase
      .channel("secretary-reports-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => {
          fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gcp_assignment" },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

    try {
      await fetch("/api/notifications/incident-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: reportId,
          gcpId: selectedGcpId,
          location: selectedReport.location,
          description: selectedReport.description || "",
        }),
      });
    } catch (notifyError) {
      console.error("Failed to notify GCP about assignment", notifyError);
    }

    // 4) remove from Needs Action list in UI
    setReports((prev) => prev.filter((r) => r.report_id !== reportId));

    setAssignModalOpen(false);
    setSelectedReport(null);
    setSelectedGcpId("");
    setTaskDetails("");
    setAssignError("");
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    const search = searchTerm.toLowerCase();
    return (
      !search ||
      (r.location && r.location.toLowerCase().includes(search)) ||
      (r.landmark && r.landmark.toLowerCase().includes(search)) ||
      (r.report_id && String(r.report_id).toLowerCase().includes(search))
    );
  });

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(filteredReports.length / itemsPerPage),
  );
  const safePage = Math.min(currentPage, totalPages);
  const paginatedReports = filteredReports.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage,
  );
  const showingFrom =
    filteredReports.length === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const showingTo = Math.min(safePage * itemsPerPage, filteredReports.length);

  if (loading) return <TruckLoader />;
  if (error) return <div className="text-red-700">{error}</div>;

  return (
    <>
      {/* Main card with passed incidents */}
      <section className="dashboard-section max-w-6xl mx-auto rounded-3xl bg-slate-900/95 border border-slate-800 px-10 py-8 shadow-2xl">
        <div className="dashboard-section-glow" />

        <div className="relative z-5000">
          <h2 className="text-2xl font-black mb-6 bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
            Passed Incident Reports
          </h2>

          {/* Search bar */}
          <div className="flex items-center justify-end mb-4 gap-3">
            <div className="relative w-full max-w-xs">
              <input
                type="text"
                placeholder="Search reports..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg bg-slate-900/80 border border-green-800/50 pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Empty state */}
          {filteredReports.length === 0 ? (
            <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-green-800/50 backdrop-blur-xl text-slate-400">
              <div className="text-5xl mb-4 opacity-50">🚨</div>
              <p className="text-lg font-semibold">
                {searchTerm
                  ? "No matching reports"
                  : "No passed incident reports"}
              </p>
              <p className="text-sm mt-1">
                {searchTerm ? "Try a different search." : "at the moment."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-green-800/50 bg-slate-900/50 backdrop-blur-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 border-b border-green-800/50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Report ID
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Location
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Landmark
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Date Submitted
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-800/20">
                  {paginatedReports.map((report) => (
                    <tr
                      key={report.report_id}
                      className="hover:bg-slate-800/50 transition-colors duration-150"
                    >
                      <td className="px-5 py-4 text-emerald-400 font-bold whitespace-nowrap">
                        RP-{report.report_id}
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {report.location}
                      </td>
                      <td className="px-5 py-4 text-slate-400">
                        {report.landmark || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Needs Action
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                        {new Date(report.date_submitted).toLocaleString(
                          "en-US",
                          {
                            month: "numeric",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          },
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => handleOpenAssign(report)}
                          className="text-emerald-400 hover:text-emerald-300 font-semibold text-sm transition-colors"
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-green-800/30 bg-slate-900/60">
                <span className="text-xs text-slate-500">
                  Showing {showingFrom} to {showingTo} of{" "}
                  {filteredReports.length} results
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          page === safePage
                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={safePage === totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Full-screen modal (fixed design) — rendered via portal */}
      {assignModalOpen &&
        selectedReport &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setAssignModalOpen(false)}
          >
            <div
              className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-slate-700/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-100">
                        Assign GCP Task
                      </h3>
                      <p className="text-xs text-emerald-400/70 font-medium uppercase tracking-wider mt-0.5">
                        Incident Assignment
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(false)}
                    className="w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-200 flex items-center justify-center"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">
                        Location
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-200">
                      {selectedReport.location}
                    </p>
                  </div>

                  <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                    <div className="flex items-center gap-2 mb-2">
                      <svg
                        className="w-4 h-4 text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                      </svg>
                      <span className="text-xs font-semibold text-blue-400/80 uppercase tracking-wider">
                        Landmark
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-200">
                      {selectedReport.landmark}
                    </p>
                  </div>
                </div>

                {/* GCP Select */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">
                    Select GCP Officer
                  </Label>
                  <Select
                    value={selectedGcpId}
                    onValueChange={(value: string) => setSelectedGcpId(value)}
                  >
                    <SelectTrigger className="w-full rounded-lg bg-slate-800/50 border-slate-700/50 text-slate-200 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 h-11">
                      <SelectValue placeholder="Choose GCP officer..." />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700/50">
                      {gcpUsers.map((u) => (
                        <SelectItem
                          key={u.user_id}
                          value={u.user_id}
                          className="text-slate-200 focus:bg-emerald-500/20 focus:text-emerald-200"
                        >
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Task Details */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">
                    Task Instructions
                  </Label>
                  <Textarea
                    rows={4}
                    value={taskDetails}
                    onChange={(e) => setTaskDetails(e.target.value)}
                    placeholder="Describe the task requirements and any specific instructions for the GCP officer..."
                    className="rounded-lg bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-none min-h-[100px]"
                  />
                </div>

                {/* Error Message */}
                {assignError && (
                  <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                    <svg
                      className="w-5 h-5 text-red-400 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-sm text-red-200/90">
                      {assignError}
                    </span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-slate-800/30 border-t border-slate-700/50 px-6 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-sm font-medium text-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitAssign}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white rounded-lg shadow-lg shadow-emerald-900/30 transition-all duration-200 hover:shadow-emerald-500/25 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Assign Task
                </button>
              </div>
            </div>
          </div>,
          document.body,
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

  // Search & Pagination
  const [gcpSearchTerm, setGcpSearchTerm] = useState("");
  const [gcpCurrentPage, setGcpCurrentPage] = useState(1);
  const gcpItemsPerPage = 5;

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

    const channel = supabase
      .channel("secretary-gcp-responses-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gcp_assignment" },
        () => {
          fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => {
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtered rows
  const filteredRows = rows.filter((r) => {
    const search = gcpSearchTerm.toLowerCase();
    if (!search) return true;
    const gcpName = r.user ? `${r.user.first_name} ${r.user.last_name}` : "";
    const location = r.report
      ? `${r.report.location} ${r.report.landmark}`
      : (r.collectiondetails?.schedule?.barangay?.barangay_name ?? "");
    const response = r.gcp_response || "";
    const task = r.task_details || "";
    return (
      gcpName.toLowerCase().includes(search) ||
      location.toLowerCase().includes(search) ||
      response.toLowerCase().includes(search) ||
      task.toLowerCase().includes(search)
    );
  });

  // Pagination
  const gcpTotalPages = Math.max(
    1,
    Math.ceil(filteredRows.length / gcpItemsPerPage),
  );
  const gcpSafePage = Math.min(gcpCurrentPage, gcpTotalPages);
  const paginatedRows = filteredRows.slice(
    (gcpSafePage - 1) * gcpItemsPerPage,
    gcpSafePage * gcpItemsPerPage,
  );
  const gcpShowingFrom =
    filteredRows.length === 0 ? 0 : (gcpSafePage - 1) * gcpItemsPerPage + 1;
  const gcpShowingTo = Math.min(
    gcpSafePage * gcpItemsPerPage,
    filteredRows.length,
  );

  if (loading) return <TruckLoader />;
  if (error) return <div className="text-red-700">{error}</div>;

  return (
    <section className="dashboard-section max-w-6xl mx-auto overflow-hidden">
      <div className="dashboard-section-glow" />

      <div className="relative z-10">
        <h2 className="text-2xl font-black mb-6 bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
          GCP Responses
        </h2>

        {/* Search bar */}
        <div className="flex items-center justify-end mb-4 gap-3">
          <div className="relative w-full max-w-xs">
            <input
              type="text"
              placeholder="Search responses..."
              value={gcpSearchTerm}
              onChange={(e) => {
                setGcpSearchTerm(e.target.value);
                setGcpCurrentPage(1);
              }}
              className="w-full rounded-lg bg-slate-900/80 border border-green-800/50 pl-9 pr-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Empty state */}
        {filteredRows.length === 0 ? (
          <div className="text-center py-12 rounded-2xl bg-slate-900/50 border border-green-800/50 backdrop-blur-xl text-slate-400">
            <div className="text-5xl mb-4 opacity-50">💬</div>
            <p className="text-lg font-semibold">
              {gcpSearchTerm ? "No matching responses" : "No responses yet"}
            </p>
            {gcpSearchTerm && (
              <p className="text-sm mt-1">Try a different search.</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-green-800/50 bg-slate-900/50 backdrop-blur-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 border-b border-green-800/50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Date
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    GCP
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Location / Barangay
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Response
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-green-800/20">
                {paginatedRows.map((row) => (
                  <tr
                    key={row.gcp_assignment_id}
                    className="hover:bg-slate-800/50 transition-colors duration-150"
                  >
                    <td className="px-5 py-4 text-slate-400 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString("en-US", {
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>
                    <td className="px-5 py-4 text-slate-200 font-semibold">
                      {row.user
                        ? `${row.user.first_name} ${row.user.last_name}`
                        : "Unknown"}
                    </td>
                    <td className="px-5 py-4 text-slate-300 max-w-[200px] truncate">
                      {row.report
                        ? `${row.report.location} (${row.report.landmark})`
                        : (row.collectiondetails?.schedule?.barangay
                            ?.barangayname ?? "N/A")}
                    </td>
                    <td className="px-5 py-4">
                      {row.gcp_response ? (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Responded
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleOpenModal(row)}
                        className="text-emerald-400 hover:text-emerald-300 font-semibold text-sm transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-green-800/30 bg-slate-900/60">
              <span className="text-xs text-slate-500">
                Showing {gcpShowingFrom} to {gcpShowingTo} of{" "}
                {filteredRows.length} results
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setGcpCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={gcpSafePage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {Array.from({ length: gcpTotalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      onClick={() => setGcpCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                        page === gcpSafePage
                          ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/30"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                    >
                      {page}
                    </button>
                  ),
                )}
                <button
                  onClick={() =>
                    setGcpCurrentPage((p) => Math.min(gcpTotalPages, p + 1))
                  }
                  disabled={gcpSafePage === gcpTotalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dark Modal — rendered via portal */}
        {modalOpen &&
          selectedRow &&
          createPortal(
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
              <div
                className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header with gradient */}
                <div className="relative bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-slate-700/50 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-100">
                          GCP Response
                        </h3>
                        <p className="text-xs text-emerald-400/70 font-medium uppercase tracking-wider mt-0.5">
                          Task Communication Log
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleCloseModal}
                      className="w-8 h-8 rounded-lg bg-slate-800/50 border border-slate-600/50 text-slate-400 hover:text-white hover:bg-red-500/20 hover:border-red-500/50 transition-all duration-200 flex items-center justify-center"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          className="w-4 h-4 text-emerald-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        <span className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">
                          GCP Officer
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-200">
                        {selectedRow.user
                          ? `${selectedRow.user.first_name} ${selectedRow.user.last_name}`
                          : "Unknown"}
                      </p>
                    </div>

                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                      <div className="flex items-center gap-2 mb-2">
                        <svg
                          className="w-4 h-4 text-blue-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span className="text-xs font-semibold text-blue-400/80 uppercase tracking-wider">
                          Location
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-200">
                        {selectedRow.report
                          ? `${selectedRow.report.location} (${selectedRow.report.landmark})`
                          : (selectedRow.collectiondetails?.schedule?.barangay
                              ?.barangay_name ?? "N/A")}
                      </p>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/20 rounded-lg px-3 py-2 border border-slate-700/20 w-fit">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>
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
                    </span>
                  </div>

                  {/* Two Column Layout for Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Task Details */}
                    <div className="bg-slate-800/20 rounded-xl border border-slate-700/30 overflow-hidden">
                      <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700/30">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-orange-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                          </svg>
                          <span className="text-xs font-semibold text-orange-400/80 uppercase tracking-wider">
                            Task Details
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {selectedRow.task_details || "—"}
                        </p>
                      </div>
                    </div>

                    {/* GCP Response */}
                    <div className="bg-emerald-900/10 rounded-xl border border-emerald-500/20 overflow-hidden">
                      <div className="bg-emerald-900/20 px-4 py-3 border-b border-emerald-500/20">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-4 h-4 text-emerald-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                            />
                          </svg>
                          <span className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">
                            GCP Response
                          </span>
                        </div>
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {selectedRow.gcp_response || "No response yet"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="bg-slate-800/30 border-t border-slate-700/50 px-6 py-4 flex justify-end">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-sm font-medium text-slate-200 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>,
            document.body,
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(trucks.length / itemsPerPage));

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

    const channel = supabase
      .channel("secretary-trucks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "garbage_trucks" },
        () => {
          load();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
    <section className="max-w-4xl mx-auto space-y-6 p-6">
      <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl shadow-xl backdrop-blur-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-slate-700/50 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">
                Garbage Trucks
              </h2>
              <p className="text-xs text-emerald-400/70 font-medium uppercase tracking-wider mt-0.5">
                Fleet Management
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Add Truck Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Plate number */}
              <div className="space-y-1.5">
                <label
                  htmlFor="plate_number"
                  className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider"
                >
                  Plate Number
                </label>
                <input
                  id="plate_number"
                  name="plate_number"
                  value={form.plate_number}
                  onChange={handleChange}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                  placeholder="NCA1234"
                  required
                />
              </div>

              {/* Capacity */}
              <div className="space-y-1.5">
                <label
                  htmlFor="capacity"
                  className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider"
                >
                  Capacity (tons)
                </label>
                <input
                  id="capacity"
                  type="number"
                  min="0"
                  step="0.25"
                  name="capacity"
                  value={form.capacity}
                  onChange={handleChange}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                  placeholder="6.50"
                  required
                />
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <label
                  htmlFor="status"
                  className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider"
                >
                  Status
                </label>
                <div className="relative">
                  <select
                    id="status"
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="Available" className="bg-slate-900">
                      Available
                    </option>
                    <option value="Under maintenance" className="bg-slate-900">
                      Under Maintenance
                    </option>
                    <option value="Retired" className="bg-slate-900">
                      Retired
                    </option>
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/70 pointer-events-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>

              {/* Truck code */}
              <div className="space-y-1.5">
                <label
                  htmlFor="truck_code"
                  className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider"
                >
                  Truck Code
                </label>
                <input
                  id="truck_code"
                  name="truck_code"
                  value={form.truck_code}
                  onChange={handleChange}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                  placeholder="Bool_NCA1234"
                  required
                />
              </div>

              {/* GCP Selection */}
              <div className="space-y-1.5 sm:col-span-2">
                <label
                  htmlFor="gcp_user_id"
                  className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider"
                >
                  Assign GCP
                </label>
                <div className="relative">
                  <select
                    id="gcp_user_id"
                    name="gcp_user_id"
                    value={form.gcp_user_id}
                    onChange={handleChange}
                    className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors appearance-none cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">
                      Select GCP
                    </option>
                    {gcps.map((gcp) => (
                      <option
                        key={gcp.user_id}
                        value={gcp.user_id}
                        className="bg-slate-900"
                      >
                        {gcp.first_name} {gcp.last_name}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/70 pointer-events-none"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center gap-3 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                <svg
                  className="w-5 h-5 text-red-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-red-200/90">{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <span className="text-sm text-emerald-200/90">{success}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold text-white rounded-lg shadow-lg shadow-emerald-900/30 transition-all duration-200 hover:shadow-emerald-500/25"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Truck
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="h-px bg-slate-700/30" />

          {/* Truck List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Existing Trucks
                <span className="text-xs font-normal text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
                  {trucks.length}
                </span>
              </h3>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <svg
                  className="w-6 h-6 animate-spin mr-2 text-emerald-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-sm">Loading trucks...</span>
              </div>
            ) : trucks.length === 0 ? (
              <div className="text-center py-8 bg-slate-800/20 rounded-xl border border-slate-700/30 border-dashed">
                <svg
                  className="w-12 h-12 mx-auto text-slate-600 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                <p className="text-sm text-slate-400">No trucks added yet</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3">
                  {trucks
                    .slice(
                      (currentPage - 1) * itemsPerPage,
                      currentPage * itemsPerPage,
                    )
                    .map((t) => (
                      <div
                        key={t.truck_id}
                        className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30 hover:border-emerald-500/30 hover:bg-slate-800/50 transition-all duration-200 group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center group-hover:border-emerald-500/30 transition-colors">
                          <svg
                            className="w-6 h-6 text-slate-400 group-hover:text-emerald-400 transition-colors"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                            />
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-100 truncate">
                              {t.truck_code}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({t.plate_number})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <svg
                                className="w-3.5 h-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                                />
                              </svg>
                              {t.capacity} tons
                            </span>
                            {t.gcp && (
                              <span className="flex items-center gap-1 text-emerald-400/70">
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                {t.gcp.first_name} {t.gcp.last_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border ${
                            t.status === "Available"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : t.status === "Under maintenance"
                                ? "bg-orange-500/10 text-orange-400 border-orange-500/30"
                                : "bg-slate-500/10 text-slate-400 border-slate-500/30"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                    ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-700/30">
                    <div className="text-xs text-slate-500">
                      Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                      {Math.min(currentPage * itemsPerPage, trucks.length)} of{" "}
                      {trucks.length} trucks
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1,
                        ).map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                              currentPage === page
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-800/50 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
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
  const [displayName, setDisplayName] = useState("User");
  const [activeTab, setActiveTab] = useState<SecretaryActiveTab>("dashboard");
  const [initials, setInitials] = useState("");

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

      // Compute initials
      if (fullName) {
        const parts = fullName.split(" ").filter(Boolean);
        setInitials(
          parts
            .map((p) => p[0])
            .join("")
            .toUpperCase(),
        );
      } else if (profile?.username) {
        setInitials(profile.username.slice(0, 2).toUpperCase());
      } else if (authData.user.email) {
        setInitials(authData.user.email.slice(0, 2).toUpperCase());
      } else {
        setInitials("U");
      }
    }

    fetchDisplayName();
  }, []);

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
    trucks: 0,
    schedules: 0,
    gcpResponses: 0,
  });

  useEffect(() => {
    async function fetchCounts() {
      let truckCount = 0;
      let scheduleCount = 0;
      let gcpResponseCount = 0;

      // Trucks: count from garbage_trucks table
      try {
        const { count, error } = await supabase
          .from("garbage_trucks")
          .select("truck_id", { count: "exact", head: true });
        if (error) {
          console.error("Truck count fetch error:", error);
        } else {
          truckCount = count || 0;
        }
      } catch (err) {
        console.error("Unexpected error fetching Truck count:", err);
      }

      // GCP Responses: count from gcpresponses table
      try {
        const { count, error } = await supabase
          .from("gcpresponses")
          .select("response_id", { count: "exact", head: true });
        if (error) {
          console.error("GCP Response count fetch error:", error);
        } else {
          gcpResponseCount = count || 0;
        }
      } catch (err) {
        console.error("Unexpected error fetching GCP Response count:", err);
      }

      // Schedules: count from collection_schedules table
      try {
        const { count, error } = await supabase
          .from("collection_schedules")
          .select("schedule_id", { count: "exact", head: true });
        if (error) {
          console.error("Schedule count fetch error:", error);
        } else {
          scheduleCount = count || 0;
        }
      } catch (err) {
        console.error("Unexpected error fetching Schedule count:", err);
      }

      setCounts({
        trucks: truckCount,
        schedules: scheduleCount,
        gcpResponses: gcpResponseCount,
      });
    }

    fetchCounts();

    const channel = supabase
      .channel("secretary-counts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "garbage_trucks" },
        () => fetchCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_schedules" },
        () => fetchCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gcpresponses" },
        () => fetchCounts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const summaryCards = [
    {
      label: "Trucks Registered",
      icon: "🚛",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-300",
      trend: "Active",
      trendClass: "text-emerald-400",
      count: counts.trucks,
    },
    {
      label: "Schedules Created",
      icon: "📅",
      iconBg: "bg-sky-500/15",
      iconColor: "text-sky-300",
      trend: "Active",
      trendClass: "text-emerald-400",
      count: counts.schedules,
    },
    {
      label: "GCP Responses",
      icon: "📋",
      iconBg: "bg-indigo-500/15",
      iconColor: "text-indigo-300",
      trend: "Active",
      trendClass: "text-emerald-400",
      count: counts.gcpResponses,
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

      // 2.1 Update the assigned truck to set its gcp_user_id
      await supabase
        .from("garbage_trucks")
        .update({ gcp_user_id: scheduleData.gcp_user_id })
        .eq("truck_code", scheduleData.truck_code);

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

      // 4. Send SMS notification to assigned GCP
      // Fetch GCP user info for phone number
      const { data: gcpUser, error: gcpUserError } = await supabase
        .from("users")
        .select("contact_number,first_name")
        .eq("user_id", scheduleData.gcp_user_id)
        .single();
      if (gcpUserError) {
        console.error(
          "Failed to fetch GCP user for SMS notification:",
          gcpUserError,
        );
      }
      if (gcpUser && gcpUser.contact_number) {
        const message = `Hi ${gcpUser.first_name}, you have been assigned as GCP and have a new schedule. Please check your dashboard for details.`;
        const { error: smsError } = await supabase
          .from("sms_notifications")
          .insert({
            user_id: scheduleData.gcp_user_id,
            notification_type: "assignment",
            message,
            phone_number: gcpUser.contact_number,
            status: "pending",
            sent_at: new Date().toISOString(),
          });
        if (smsError) {
          console.error("Failed to insert SMS notification:", smsError);
        } else {
          console.log(
            "SMS notification inserted for GCP:",
            gcpUser.contact_number,
          );
        }
      } else {
        console.warn(
          "No contact number found for GCP user:",
          scheduleData.gcp_user_id,
        );
      }

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

  const sidebarItems: SidebarItem[] = [
    {
      label: "Dashboard",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <rect x="3" y="10" width="3" height="7" />
          <rect x="8.5" y="7" width="3" height="10" />
          <rect x="14" y="4" width="3" height="13" />
        </svg>
      ),
      tab: "dashboard",
    },
    {
      label: "Create Schedules",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <rect x="4" y="4" width="12" height="12" rx="2" />
          <line x1="6" y1="8" x2="14" y2="8" />
          <line x1="6" y1="12" x2="14" y2="12" />
        </svg>
      ),
      tab: "inputSchedule",
    },
    {
      label: "Garbage Trucks",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <rect x="2" y="10" width="12" height="6" rx="2" />
          <circle cx="6" cy="16" r="2" />
          <circle cx="14" cy="16" r="2" />
        </svg>
      ),
      tab: "garbageTrucks",
    },
    {
      label: "View Schedules",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <rect x="3" y="5" width="14" height="12" rx="2" />
          <line x1="7" y1="9" x2="13" y2="9" />
          <line x1="7" y1="13" x2="13" y2="13" />
        </svg>
      ),
      tab: "schedules",
    },
    {
      label: "Passed Incidents",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <polygon points="10,2 2,18 18,18" />
        </svg>
      ),
      tab: "passedIncidents",
    },
    {
      label: "GCP Responses",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <rect x="4" y="4" width="12" height="12" rx="2" />
          <circle cx="10" cy="10" r="3" />
        </svg>
      ),
      tab: "gcpResponses",
    },
    {
      label: "Manage Account",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <circle cx="10" cy="8" r="4" />
          <rect x="4" y="14" width="12" height="4" rx="2" />
        </svg>
      ),
      tab: "manageAccount",
    },
  ];

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
      {/* Top navigation (same as SWMO) */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-900/40 bg-slate-950/80 shadow-lg shadow-emerald-900/20 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/60">
        <div className="flex items-center justify-between px-2 sm:px-4 md:px-8 py-3 sm:py-4 min-h-16">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-slate-900/80 text-slate-100 hover:bg-slate-800 transition-colors flex-shrink-0 ring-1 ring-white/10"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? "✖" : "☰"}
            </button>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-lg flex-shrink-0 shadow-lg shadow-emerald-900/40">
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
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-100 font-medium transition-colors whitespace-nowrap ring-1 ring-white/10"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm shadow-lg overflow-hidden">
                {initials}
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
                      {displayName}
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
          fixed z-40 left-0 top-16 bottom-0 w-64 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }
          md:fixed md:translate-x-0 md:top-16 md:left-0 md:bottom-0 md:w-64
          bg-slate-950/90 border-r border-emerald-900/30 shadow-2xl shadow-black/30 backdrop-blur-xl
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
                className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                  activeTab === item.tab
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            <div className="pt-6 mt-6 border-t border-slate-800"></div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-10 py-10 space-y-10 relative z-10 md:ml-64 bg-slate-900/40">
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
                <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {summaryCards.map((card, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40"
                      role="region"
                      aria-label={card.label}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-sm">{card.label}</p>
                          <h3 className="text-2xl font-bold text-slate-100">
                            {card.count}
                          </h3>
                          <p className={`text-sm ${card.trendClass}`}>
                            {card.trend}
                          </p>
                        </div>
                        <div
                          className={`${card.iconBg} ${card.iconColor} p-3 rounded-full text-xl`}
                        >
                          {card.icon}
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              </div>

              {/* Map Section with Toggle Button */}
              <section>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-100">
                      Collection Coverage Map
                    </h2>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setStatsVisible(!statsVisible)}
                        variant="outline"
                        className="h-auto border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-500/50"
                        title={
                          statsVisible ? "Hide Statistics" : "Show Statistics"
                        }
                      >
                        {statsVisible ? "📊 Hide Stats" : "📈 Show Stats"}
                      </Button>
                      <span className="px-3 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm font-medium">
                        🟢 Live
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 h-[340px] sm:h-[420px] md:h-[520px] lg:h-[600px]">
                    <LeafletMap />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Manage Account */}
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

          {/* Create Schedules */}
          {activeTab === "inputSchedule" && (
            <div className="dashboard-section overflow-hidden">
              <div className="dashboard-section-glow" />
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
            <div className="dashboard-section overflow-hidden">
              <div className="dashboard-section-glow" />
              <div className="relative z-10">
                <GarbageTrucksSection gcps={gcps} />
              </div>
            </div>
          )}

          {/* Schedules */}
          {activeTab === "schedules" && (
            <div className="dashboard-section max-w-6xl mx-auto overflow-hidden">
              <div className="dashboard-section-glow" />
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
            <div className="dashboard-section overflow-hidden">
              <div className="dashboard-section-glow" />
              <div className="relative z-10">
                <SecretaryReportsSection />
              </div>
            </div>
          )}

          {/* GCP Responses */}
          {activeTab === "gcpResponses" && (
            <div className="dashboard-section overflow-hidden">
              <div className="dashboard-section-glow" />
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
