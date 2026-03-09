"use client";

import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  FormEvent,
} from "react";

import {
  startOfMonth,
  endOfMonth,
  addDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
} from "date-fns";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import TruckLoader from "../../loading/TruckLoader";
import SharedCalendar from "../../components/SharedCalendar";
import {
  getDelayedCollectionsForBarangay,
  DelayedCollection,
  getDelayStatusColor,
  isCollectionDelayed,
} from "@/lib/delayDetection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LeafletMap = dynamic(() => import("../../leafletmap"), { ssr: false });

interface Barangay {
  barangay_id: string;
  barangay_name: string;
}

interface Truck {
  truck_id: string;
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

interface ScheduleData {
  barangay_id: string;
  truck_id: string;
  gcp_user_id: string;
  plate_number: string;
  date: string;
}

interface SubmitReportSectionProps {
  barangays: Barangay[];
  onReportSubmit?: () => void;
}

type ResidentActiveTab =
  | "dashboard"
  | "schedule"
  | "submitIncidentReport"
  | "myReports"
  | "notifications"
  | "manageAccount";

type SidebarItem = {
  label: string;
  icon: string;
  tab: ResidentActiveTab;
};

function SidebarItem({
  label,
  icon,
  selected,
  onClick,
  badgeCount,
}: {
  label: string;
  icon: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  badgeCount?: number;
}) {
  const hasBadge = badgeCount && badgeCount > 0;

  return (
    <Button
      variant={selected ? "default" : "ghost"}
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-3 rounded-lg px-4 py-3 mb-2 text-left h-auto ${
        selected
          ? "bg-emerald-600 text-white hover:bg-emerald-700"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </span>

      {hasBadge && (
        <Badge
          variant="destructive"
          className="min-w-[1.5rem] px-2 py-0.5 text-[10px] font-bold"
        >
          {badgeCount}
        </Badge>
      )}
    </Button>
  );
}

interface Schedule {
  schedule_id: string;
  days: string;
}

function generatePatternDates(
  pattern: string,
  year: number,
  month: number,
): Date[] {
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

function ScheduleCalendar({ schedule }: { schedule: Schedule }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // normalize to midnight for date comparisons
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const patternDates: Date[] = generatePatternDates(schedule.days, year, month);

  const weeks: Date[][] = [];
  const start = startOfWeek(startOfMonth(new Date(year, month)), {
    weekStartsOn: 1,
  });
  const end = endOfWeek(endOfMonth(new Date(year, month)), {
    weekStartsOn: 1,
  });

  let currentWeekStart = start;
  while (currentWeekStart <= end) {
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(addDays(currentWeekStart, i));
    }
    weeks.push(weekDays);
    currentWeekStart = addWeeks(currentWeekStart, 1);
  }

  return (
    <div className="my-6">
      <div className="mb-2 mt-2 flex flex-col items-center">
        <span className="font-semibold text-xl bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow">
          {format(new Date(year, month), "LLLL yyyy")}
        </span>
        <span className="text-xs text-slate-400 mt-1">
          Today: {format(now, "EEEE, MMM d")}
        </span>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-6 justify-center max-w-[450px] mx-auto items-center">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-400/30" />
          <span className="text-slate-200 text-sm">Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-emerald-700/50 border border-emerald-500/30" />
          <span className="text-slate-200 text-sm">Completed</span>
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

      <div className="mt-4 calendar-grid text-md text-slate-200 select-none">
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
            const isPast = isCurrentMonth && day < todayMid;
            const dayText = isCurrentMonth ? format(day, "d") : "";

            let cellClass =
              "calendar-day h-10 w-10 flex flex-col items-center justify-center text-lg rounded border transition";
            if (!isCurrentMonth) {
              cellClass += " bg-slate-800/80 text-slate-500 border-slate-700";
            } else if (isToday) {
              cellClass +=
                " bg-red-500/25 text-red-300 font-bold border-red-400 shadow-md shadow-red-900/40";
            } else if (isScheduled && isPast) {
              cellClass +=
                " bg-emerald-700/50 text-slate-200 border border-emerald-500/30";
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

interface ResidentSchedulesFeatureProps {
  residentBarangayId: string;
  barangays: Barangay[];
}

interface ResidentScheduleRow {
  schedule_id: string;
  days: string;
  barangay?: Barangay | null;
  gcp_user?: {
    first_name: string;
    last_name: string;
  } | null;
  collection_details?:
    | {
        collectiondetails_id: string;
        truck?: {
          plate_number: string;
          truck_code: string;
        } | null;
        collection_date: string;
        status: string;
        gcp_assignment?: {
          user?: {
            first_name: string;
            last_name: string;
          } | null;
        } | null;
      }[]
    | null;
}

function ResidentSchedulesFeature({
  residentBarangayId,
  barangays,
}: ResidentSchedulesFeatureProps) {
  const [selectedBarangayId, setSelectedBarangayId] =
    useState<string>(residentBarangayId);

  useEffect(() => {
    setSelectedBarangayId(residentBarangayId);
  }, [residentBarangayId]);

  const [schedules, setSchedules] = useState<ResidentScheduleRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true);
      setError(null);

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
        .order("date_created", { ascending: false });

      if (error) {
        setError(error.message);
        setSchedules([]);
        setLoading(false);
        return;
      }

      const raw = (data ?? []) as unknown;
      const rows = raw as ResidentScheduleRow[];
      setSchedules(rows);
      setLoading(false);
    }

    fetchSchedules();

    // Realtime: auto-refresh when schedules or collection details change
    const channel = supabase
      .channel("resident-schedules-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_schedules" },
        () => fetchSchedules(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_details" },
        () => fetchSchedules(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const schedule = schedules.find(
    (s) => String(s.barangay?.barangay_id) === String(selectedBarangayId),
  );

  // Pagination state for collection details
  const [detailsPage, setDetailsPage] = useState(1);
  const detailsPageSize = 5;
  const collectionDetails = Array.isArray(schedule?.collection_details)
    ? schedule.collection_details
    : [];
  const detailsTotalPages = Math.ceil(
    collectionDetails.length / detailsPageSize,
  );
  const paginatedDetails = collectionDetails.slice(
    (detailsPage - 1) * detailsPageSize,
    detailsPage * detailsPageSize,
  );
  const startIndex = (detailsPage - 1) * detailsPageSize;
  const endIndex = startIndex + detailsPageSize;

  return (
    <section className="max-w-6xl mx-auto space-y-8">
      {/* Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Collection Schedules
            </h2>
          </div>
          <p className="text-slate-400 text-sm ml-13">
            Manage pickup schedules and truck assignments
          </p>
        </div>

        {/* Modern Selector */}
        <div className="w-full lg:w-80">
          <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
            Select Barangay
          </label>
          <div className="relative">
            <Select
              value={selectedBarangayId}
              onValueChange={(value: string) => setSelectedBarangayId(value)}
            >
              <SelectTrigger className="w-full bg-slate-900/80 border-slate-700/50 rounded-xl h-12 text-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all">
                <SelectValue placeholder="Choose a barangay..." />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 rounded-xl">
                {barangays.map((b) => (
                  <SelectItem
                    key={b.barangay_id}
                    value={b.barangay_id}
                    className="focus:bg-emerald-500/10 focus:text-emerald-400"
                  >
                    {b.barangay_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-900/50 rounded-3xl border border-slate-800/50 p-16 flex items-center justify-center">
          <TruckLoader />
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-400 flex items-center gap-3">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </div>
      ) : schedule ? (
        <div className="space-y-6">
          {/* Info Cards - Modern Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Barangay Card */}
            <div className="group relative bg-slate-900/40 rounded-2xl p-6 border border-slate-800/50 hover:border-emerald-500/30 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400/20 to-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <svg
                    className="w-7 h-7 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                    Barangay
                  </p>
                  <h3 className="text-xl font-semibold text-white">
                    {schedule.barangay?.barangay_name || "N/A"}
                  </h3>
                </div>
              </div>
            </div>

            {/* GCP Card */}
            <div className="group relative bg-slate-900/40 rounded-2xl p-6 border border-slate-800/50 hover:border-blue-500/30 transition-all duration-300 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400/20 to-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <svg
                    className="w-7 h-7 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                    Assigned Driver
                  </p>
                  <h3 className="text-xl font-semibold text-white">
                    {schedule.gcp_user
                      ? `${schedule.gcp_user.first_name} ${schedule.gcp_user.last_name}`
                      : "Not assigned"}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Section - Redesigned */}
          <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 overflow-hidden">
            {/* Calendar Header */}
            <div className="px-6 py-5 border-b border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    Collection Calendar
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pickup schedule for this month
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium border border-emerald-500/20">
                {schedule.days} Pattern
              </span>
            </div>

            {/* Calendar Content */}
            <div className="p-6">
              <div className="w-full overflow-x-auto">
                <div className="min-w-[320px]">
                  <SharedCalendar
                    year={new Date().getFullYear()}
                    month={new Date().getMonth()}
                    pattern={schedule.days as "MWF" | "TTH" | "" | null}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Collection Details - Modern Table */}
          {collectionDetails.length > 0 && (
            <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 overflow-hidden">
              {/* Table Header */}
              <div className="px-6 py-5 border-b border-slate-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      Collection History
                    </h3>
                    <p className="text-xs text-slate-500">
                      Recent pickup records
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs font-medium">
                  {collectionDetails.length} records
                </span>
              </div>

              {/* Modern Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-950/30">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Truck Details
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Collection Date
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Driver
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {paginatedDetails.map((detail) => (
                      <tr
                        key={detail.collectiondetails_id}
                        className="group hover:bg-slate-800/20 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600/50 group-hover:border-emerald-500/30 transition-colors">
                              <svg
                                className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                                />
                              </svg>
                            </div>
                            <div>
                              <p className="font-medium text-white">
                                {detail.truck?.plate_number || "N/A"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {detail.truck?.truck_code || "No code"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-300">
                            <svg
                              className="w-4 h-4 text-slate-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            {detail.collection_date
                              ? new Date(
                                  detail.collection_date,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`
                          inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border
                          ${
                            detail.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : detail.status === "Pending"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : detail.status === "In Progress"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                          }
                        `}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${detail.status === "Completed" ? "bg-emerald-400" : detail.status === "Pending" ? "bg-amber-400" : "bg-slate-400"}`}
                            />
                            {detail.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                              {detail.gcp_assignment?.user
                                ? detail.gcp_assignment.user.first_name[0]
                                : "?"}
                            </div>
                            <span className="text-slate-300 text-sm">
                              {detail.gcp_assignment?.user
                                ? `${detail.gcp_assignment.user.first_name} ${detail.gcp_assignment.user.last_name}`
                                : "Unassigned"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Modern Pagination */}
              {detailsTotalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm text-slate-500">
                    Showing{" "}
                    <span className="text-slate-300 font-medium">
                      {startIndex + 1}
                    </span>{" "}
                    to{" "}
                    <span className="text-slate-300 font-medium">
                      {Math.min(endIndex, collectionDetails.length)}
                    </span>{" "}
                    of{" "}
                    <span className="text-slate-300 font-medium">
                      {collectionDetails.length}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDetailsPage(detailsPage - 1)}
                      disabled={detailsPage === 1}
                      className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800 disabled:hover:text-slate-400 transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from(
                        { length: Math.min(5, detailsTotalPages) },
                        (_, i) => {
                          let pageNum;
                          if (detailsTotalPages <= 5) {
                            pageNum = i + 1;
                          } else if (detailsPage <= 3) {
                            pageNum = i + 1;
                          } else if (detailsPage >= detailsTotalPages - 2) {
                            pageNum = detailsTotalPages - 4 + i;
                          } else {
                            pageNum = detailsPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setDetailsPage(pageNum)}
                              className={`
                            w-10 h-10 rounded-xl text-sm font-medium transition-all
                            ${
                              detailsPage === pageNum
                                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white"
                            }
                          `}
                            >
                              {pageNum}
                            </button>
                          );
                        },
                      )}
                    </div>
                    <button
                      onClick={() => setDetailsPage(detailsPage + 1)}
                      disabled={detailsPage === detailsTotalPages}
                      className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800 disabled:hover:text-slate-400 transition-all"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {collectionDetails.length === 0 && (
            <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
                <svg
                  className="w-10 h-10 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-300 mb-2">
                No collection records
              </h3>
              <p className="text-slate-500 text-sm">
                There are no scheduled collections for this barangay yet.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 p-12 text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-10 h-10 text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-300 mb-2">
            No schedule found
          </h3>
          <p className="text-slate-500 text-sm">
            Select a different barangay to view their collection schedule.
          </p>
        </div>
      )}
    </section>
  );
}

const BUCKET = "incident-photos";

function SubmitReportSection({
  barangays,
  onReportSubmit,
}: SubmitReportSectionProps) {
  const [form, setForm] = useState({
    location: "",
    description: "",
    barangay_id: "",
    landmark: "",
    photoFile: null as File | null,
  });
  const [photoUrl, setPhotoUrl] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "environment",
  ); // back camera by default

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setFieldError("");
      // stop previous stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: { facingMode: cameraFacing }, // "user" or "environment"
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setFieldError("Cannot access camera");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === "user" ? "environment" : "user"));
    if (cameraActive) {
      startCamera(); // restart with new facing mode
    }
  };

  const capturePhoto = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // match canvas to video size
    const vw = videoRef.current.videoWidth || 320;
    const vh = videoRef.current.videoHeight || 240;
    canvasRef.current.width = vw;
    canvasRef.current.height = vh;

    ctx.drawImage(videoRef.current, 0, 0, vw, vh);

    // 1) create preview URL
    const dataUrl = canvasRef.current.toDataURL("image/jpeg");
    setPhotoUrl(dataUrl);

    // 2) also create a File for upload later
    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        console.error("capturePhoto: blob is null");
        return;
      }
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setForm((prev) => ({ ...prev, photoFile: file }));
    }, "image/jpeg");

    stopCamera();
  };

  // NEW: retake handler
  const handleRetakePhoto = () => {
    setPhotoUrl("");
    setForm((prev) => ({ ...prev, photoFile: null }));
    startCamera();
  };

  const uploadPhotoToSupabase = async (file: File): Promise<string> => {
    const fileName = `reports/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file, {
        contentType: "image/jpeg",
      });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

    if (uploadError) {
      setFieldError(`Photo upload failed: ${uploadError.message}`);
      return "";
    }

    return data?.publicUrl ?? "";
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldError("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldError("");

    if (
      !form.description.trim() ||
      !form.barangay_id ||
      !form.landmark.trim() ||
      !form.location.trim()
    ) {
      setFieldError("All fields except photo are required.");
      return;
    }

    // NEW: require a captured photo
    if (!form.photoFile) {
      setFieldError("Please capture a photo before submitting.");
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setFieldError("User not authenticated.");
        setLoading(false);
        return;
      }
      const userId = authData.user.id;

      const { data: reportData, error: reportError } = await supabase
        .from("community_reports")
        .insert({
          user_id: userId,
          location: form.location,
          description: form.description,
          landmark: form.landmark,
          barangay_id: form.barangay_id,
          current_status: "Submitted",
          date_submitted: new Date().toISOString(),
        })
        .select()
        .single();

      if (reportError || !reportData) {
        setFieldError("Report submission failed, check network/RLS!");
        setLoading(false);
        return;
      }

      let reporterName = authData.user.email || "Resident";
      try {
        const { data: profile } = await supabase
          .from("users")
          .select("first_name, last_name")
          .eq("user_id", userId)
          .single();

        const fullName =
          `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
        if (fullName) reporterName = fullName;
      } catch (profileError) {
        console.error("Failed to load reporter name", profileError);
      }

      try {
        await fetch("/api/notifications/incident-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportId: reportData.report_id,
            barangayId: form.barangay_id,
            location: form.location,
            reporterName,
          }),
        });
      } catch (notifyError) {
        console.error("Failed to notify BWMC about new report", notifyError);
      }

      // If you want to force photo requirement, uncomment:
      // if (!form.photoFile) {
      //   setFieldError("Please capture a photo.");
      //   setLoading(false);
      //   return;
      // }

      if (form.photoFile) {
        const url = await uploadPhotoToSupabase(form.photoFile);
        if (url) {
          const { error: photoError } = await supabase
            .from("community_reports")
            .update({ photo_path: url }) // new column
            .eq("report_id", reportData.report_id);

          if (photoError) {
            setFieldError(`Photo save failed, but report was submitted.`);
            setLoading(false);
            return;
          }

          setPhotoUrl(url);
        }
      }

      setForm({
        location: "",
        description: "",
        barangay_id: "",
        landmark: "",
        photoFile: null,
      });
      setPhotoUrl("");
      if (onReportSubmit) onReportSubmit();
    } catch (err) {
      console.error(err);
      setFieldError("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto">
      <div className="glass-panel rounded-2xl p-8 card-glow">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              Submit Incident Report
            </h2>
            <p className="text-slate-400 text-sm">
              All fields are required. Photo evidence mandatory.
            </p>
          </div>
        </div>

        {fieldError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {fieldError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Location Details */}
          <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800/50">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider">
                Location Details
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Location <span className="text-red-400">*</span>
                </label>
                <input
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  required
                  placeholder="Exact location/address"
                  type="text"
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Barangay <span className="text-red-400">*</span>
                </label>
                <Select
                  name="barangay_id"
                  value={form.barangay_id}
                  onValueChange={(value: string) =>
                    handleChange({
                      target: { name: "barangay_id", value },
                    } as ChangeEvent<HTMLSelectElement>)
                  }
                  required
                >
                  <SelectTrigger className="w-full bg-slate-900/50 border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:ring-emerald-500/50 focus:border-emerald-500/50">
                    <SelectValue placeholder="Select Barangay" />
                  </SelectTrigger>
                  <SelectContent>
                    {barangays.map((brgy) => (
                      <SelectItem
                        key={brgy.barangay_id}
                        value={brgy.barangay_id}
                      >
                        {brgy.barangay_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Landmark <span className="text-red-400">*</span>
              </label>
              <input
                name="landmark"
                value={form.landmark}
                onChange={handleChange}
                required
                placeholder="Nearby landmark"
                type="text"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
              />
            </div>
          </div>

          {/* Card 2: Incident Description */}
          <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800/50">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider">
                Incident Description
              </span>
            </div>

            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Describe what happened in detail..."
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all resize-none"
            />
          </div>

          {/* Card 3: Photo Evidence */}
          <div className="bg-slate-950/50 rounded-xl p-5 border border-slate-800/50">
            <div className="flex items-center gap-2 mb-4 text-emerald-400">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wider">
                Photo Evidence
              </span>
              <span className="text-xs text-red-400 ml-auto">*Required</span>
            </div>

            {!cameraActive && !photoUrl && (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={startCamera}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Start Camera
                </Button>
                <Button
                  type="button"
                  onClick={toggleCameraFacing}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:bg-slate-800"
                >
                  Use {cameraFacing === "user" ? "Back" : "Front"} Camera
                </Button>
              </div>
            )}

            {cameraActive && (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black/60">
                  <video
                    ref={videoRef}
                    autoPlay
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    <Button
                      type="button"
                      onClick={capturePhoto}
                      className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-6"
                    >
                      Capture
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    type="button"
                    onClick={toggleCameraFacing}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                  >
                    Switch Camera
                  </Button>
                  <Button
                    type="button"
                    onClick={stopCamera}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 text-slate-300"
                  >
                    Cancel
                  </Button>
                </div>
                <canvas
                  ref={canvasRef}
                  width={320}
                  height={240}
                  style={{ display: "none" }}
                />
              </div>
            )}

            {photoUrl && (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-slate-700 w-fit">
                  <img
                    src={photoUrl}
                    alt="Captured evidence"
                    className="w-full max-w-xs object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30">
                      Captured
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleRetakePhoto}
                  variant="outline"
                  size="sm"
                  className="border-slate-600 text-slate-300"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Retake Photo
                </Button>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading || !form.photoFile}
            className="w-full py-4 text-base font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Submitting...
              </span>
            ) : (
              "Submit Incident Report"
            )}
          </Button>
        </form>
      </div>
    </section>
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
          className="mb-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/50 text-xs text-red-200"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-3 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/50 text-xs text-emerald-200"
        >
          {success}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-3">
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
            disabled
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
  disabled = false,
}: {
  label: string;
  name: string;
  type: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="mb-4 space-y-2">
      <Label htmlFor={name} className="text-xs font-semibold text-slate-100">
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
        disabled={disabled}
        readOnly={disabled}
        className={
          disabled ? "text-xs cursor-not-allowed opacity-60" : "text-xs"
        }
      />
    </div>
  );
}

function useResidentTracking(
  onPosition?: (coords: { lat: number; lng: number }) => void,
) {
  useEffect(() => {
    let watchId: number | null = null;

    async function startTracking() {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) return;
      if (!("geolocation" in navigator)) return;

      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;

          // update UI immediately
          onPosition?.({ lat: latitude, lng: longitude });

          // still persist to Supabase
          await supabase.from("resident_live_location").upsert(
            {
              user_id: user.id,
              latitude,
              longitude,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        },
        (err) => console.error("Resident GPS error", err.code, err.message),
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
    };
  }, [onPosition]);
}

export default function ResidentDashboard() {
  useResidentTracking();

  const router = useRouter();

  // User initials for avatar
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
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportSuccessModalOpen, setReportSuccessModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState("");
  const [activeTab, setActiveTab] = useState<ResidentActiveTab>("dashboard");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [gps, setGps] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });

  useResidentTracking(setGps);

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
      const nameToUse =
        fullName || profile?.username || authData.user.email || "User";
      setDisplayName(nameToUse);
      // Compute initials
      let initials = "";
      if (fullName) {
        const parts = fullName.split(" ").filter(Boolean);
        initials = parts
          .map((p) => p[0])
          .join("")
          .toUpperCase();
      } else if (profile?.username) {
        initials = profile.username.slice(0, 2).toUpperCase();
      } else if (authData.user.email) {
        initials = authData.user.email.slice(0, 2).toUpperCase();
      } else {
        initials = "U";
      }
      setInitials(initials);
    }

    fetchDisplayName();
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

  // Schedule Form States
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    barangay_id: "",
    truck_id: "",
    gcp_user_id: "",
    plate_number: "",
    date: "",
  });

  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  const [residentBarangayId, setResidentBarangayId] = useState<string>("");

  // Map filter states
  const [showAllTrucks, setShowAllTrucks] = useState<boolean>(true);
  const [assignedTruckId, setAssignedTruckId] = useState<number | null>(null);

  // Reports and notifications state
  const [userReports, setUserReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [unreadReportCount, setUnreadReportCount] = useState<number>(0);

  // My Reports filter/sort states
  const [myReportsFilterTab, setMyReportsFilterTab] = useState<
    "all" | "Submitted" | "Ongoing" | "Resolved" | "Rejected"
  >("all");
  const [myReportsDateSort, setMyReportsDateSort] = useState<
    "newest" | "oldest"
  >("newest");
  const [myReportsSearch, setMyReportsSearch] = useState("");

  // Delayed collections state
  const [delayedCollections, setDelayedCollections] = useState<
    DelayedCollection[]
  >([]);
  const [loadingDelays, setLoadingDelays] = useState(false);

  // Fetch current user's barangay_id when the dashboard mounts
  useEffect(() => {
    async function fetchUserBarangayId() {
      try {
        const { data: authUserData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authUserData.user) return;

        const userId = authUserData.user.id;
        const { data, error } = await supabase
          .from("users")
          .select("barangay_id")
          .eq("user_id", userId)
          .single();

        if (error || !data) return;

        setResidentBarangayId(data.barangay_id || "");
      } catch (err) {
        setResidentBarangayId("");
      }
    }
    fetchUserBarangayId();
  }, []);

  // Fetch current user info for Manage Account
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

  // Fetch dropdown data when Input Schedule tab active
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [gcps, setGcps] = useState<GcpUser[]>([]);

  useEffect(() => {
    async function fetchDropdowns() {
      try {
        const [barangayResp, truckResp, gcpResp] = await Promise.all([
          supabase.from("barangay").select("barangay_id, barangay_name"),
          supabase.from("garbage_trucks").select("truck_id, plate_number"),
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
    fetchDropdowns();
  }, [activeTab]);

  // Auto fill plate number on truck selection
  useEffect(() => {
    if (scheduleData.truck_id) {
      const truck = trucks.find((t) => t.truck_id === scheduleData.truck_id);
      setScheduleData((prev) => ({
        ...prev,
        plate_number: truck ? truck.plate_number : "",
      }));
    } else {
      setScheduleData((prev) => ({ ...prev, plate_number: "" }));
    }
  }, [scheduleData.truck_id, trucks]);

  // Fetch assigned truck for resident's barangay
  useEffect(() => {
    async function fetchAssignedTruck() {
      if (!residentBarangayId) return;
      try {
        const { data, error } = await supabase
          .from("collection_schedules")
          .select("truck_id")
          .eq("barangay_id", residentBarangayId)
          .limit(1)
          .single();

        if (!error && data) {
          const nextTruckId =
            data.truck_id == null ? null : Number(data.truck_id);
          setAssignedTruckId(
            nextTruckId != null && !Number.isNaN(nextTruckId)
              ? nextTruckId
              : null,
          );
        } else {
          setAssignedTruckId(null);
        }
      } catch (err) {
        setAssignedTruckId(null);
      }
    }
    fetchAssignedTruck();
  }, [residentBarangayId]);

  useEffect(() => {
    if (!assignedTruckId) {
      setShowAllTrucks(true);
    }
  }, [assignedTruckId]);

  // Fetch user reports and unread count
  useEffect(() => {
    async function fetchUserReports() {
      try {
        setReportsLoading(true);
        setReportsError(null);

        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData?.user) {
          setReportsError("User not authenticated.");
          setReportsLoading(false);
          return;
        }

        const userId = authData.user.id;

        const { data, error } = await supabase
          .from("community_reports")
          .select(
            "report_id, description, current_status, date_submitted, barangay_id, location",
          )
          .eq("user_id", userId)
          .order("date_submitted", { ascending: false });

        if (error) {
          setReportsError("Failed to load reports.");
          setReportsLoading(false);
          return;
        }

        const reports = data || [];
        setUserReports(reports);

        const unread = reports.filter(
          (r) => r.current_status && r.current_status !== "Resolved",
        ).length;
        setUnreadReportCount(unread);
      } catch {
        setReportsError("Unexpected error loading reports.");
      } finally {
        setReportsLoading(false);
      }
    }

    fetchUserReports();

    // Realtime: auto-refresh reports when community_reports or report_status_history change
    const channel = supabase
      .channel("resident-reports-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => fetchUserReports(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_status_history" },
        () => fetchUserReports(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fetch delayed collections for resident's barangay
  useEffect(() => {
    async function fetchDelayedCollections() {
      if (!residentBarangayId) return;

      setLoadingDelays(true);
      try {
        const delayed = await getDelayedCollectionsForBarangay(
          Number(residentBarangayId),
        );
        setDelayedCollections(delayed);
      } catch (error) {
        console.error("Error fetching delayed collections:", error);
      } finally {
        setLoadingDelays(false);
      }
    }

    fetchDelayedCollections();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDelayedCollections, 5 * 60 * 1000);

    // Realtime: auto-refresh delayed collections when collection data changes
    const channel = supabase
      .channel("resident-delays-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_details" },
        () => fetchDelayedCollections(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_schedules" },
        () => fetchDelayedCollections(),
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [residentBarangayId]);

  // Form Handlers
  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setManageAccountForm({
      ...manageAccountForm,
      [e.target.name]: e.target.value,
    });
  };
  const handleScheduleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setScheduleData({
      ...scheduleData,
      [e.target.name]: e.target.value,
    });
    setScheduleError(null);
    setScheduleSuccess(null);
  };

  // Validations
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

  const validateScheduleForm = () => {
    const { barangay_id, truck_id, gcp_user_id, date, plate_number } =
      scheduleData;
    if (!barangay_id || !truck_id || !gcp_user_id || !date || !plate_number) {
      setScheduleError("All fields are required.");
      return false;
    }
    return true;
  };

  // Manage Account Submission
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

  // Handle Report Submit for Success Message
  const handleReportSubmit = () => {
    setReportSuccess("Report submitted successfully!");
    setReportSuccessModalOpen(true);
  };
  // Improved Logout handler
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
    icon: React.ReactNode;
    tab: ResidentActiveTab;
  }[] = [
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
      label: "Schedules",
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
      tab: "schedule",
    },
    {
      label: "Submit Incident Report",
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
      tab: "submitIncidentReport",
    },
    {
      label: "My Reports",
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
      tab: "myReports",
    },
    {
      label: "Notifications",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <path d="M10 2a6 6 0 016 6v4a6 6 0 01-12 0V8a6 6 0 016-6z" />
          <circle cx="10" cy="16" r="2" />
        </svg>
      ),
      tab: "notifications",
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
                  Residents Dashboard
                </h1>
              </div>
            </div>
          </div>
          {/* Profile Dropdown */}
          <div className="relative flex-shrink-0 flex items-center gap-2">
            {/* Notification Bell Icon */}
            <div className="relative group">
              <button
                className="relative p-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-100 ring-1 ring-white/10"
                aria-label="Notifications"
                onClick={() => {
                  setActiveTab("notifications");
                  setSidebarOpen(false);
                }}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadReportCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-slate-950">
                    {unreadReportCount}
                  </span>
                )}
              </button>
            </div>
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
                <div className="absolute right-0 mt-55 w-56 rounded-lg bg-slate-900 border border-slate-800 shadow-xl overflow-hidden z-50">
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

      <div className="flex flex-1 overflow-hidden pt-16">
        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar – Resident items */}
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
              { label: "Schedules", icon: "📝", tab: "schedule" },
              {
                label: "Submit Incident Report",
                icon: "🚚",
                tab: "submitIncidentReport",
              },
              { label: "My Reports", icon: "📅", tab: "myReports" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveTab(item.tab as ResidentActiveTab);
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

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-10 py-10 space-y-10 relative z-10 md:ml-64 bg-slate-900/40">
          {/* Success modal */}
          {reportSuccessModalOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center"
              onClick={() => setReportSuccessModalOpen(false)}
            >
              <div
                className="bg-slate-900/95 rounded-2xl shadow-2xl border border-emerald-700/60 max-w-sm w-full p-6 relative text-slate-100 backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setReportSuccessModalOpen(false)}
                  className="absolute top-1 right-2 text-2xl text-slate-500 hover:text-red-400 font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
                <h3 className="font-bold text-lg mb-3 text-emerald-300 text-center">
                  Incident Report Submitted
                </h3>
                <p className="text-slate-200 text-center">
                  {reportSuccess || "Your report was submitted successfully."}
                </p>
                <div className="mt-4 flex justify-center">
                  <Button
                    onClick={() => setReportSuccessModalOpen(false)}
                    className="h-auto"
                  >
                    OK
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard */}
          {activeTab === "dashboard" && (
            <>
              {/* Responsive metrics grid */}
              {/* Map + small stats layout */}
              <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)] gap-6">
                <div className="dashboard-section overflow-hidden">
                  <div className="dashboard-section-glow" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                        Collection Coverage Map
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-sm backdrop-blur-sm relative z-10">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                          Live vehicles
                        </span>
                        <div className="inline-flex items-center rounded-2xl border border-slate-700/60 bg-slate-900/60 p-1 shadow-md">
                          <button
                            type="button"
                            onClick={() => setShowAllTrucks(true)}
                            className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                              showAllTrucks
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/50"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            All trucks
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAllTrucks(false)}
                            className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                              !showAllTrucks
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/50"
                                : "text-slate-400 hover:text-slate-200"
                            } ${
                              assignedTruckId
                                ? ""
                                : "opacity-50 cursor-not-allowed"
                            }`}
                            disabled={!assignedTruckId}
                          >
                            Assigned truck
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 relative z-10">
                      <LeafletMap
                        residentGps={gps}
                        showAllTrucks={showAllTrucks}
                        assignedTruckId={assignedTruckId}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Delayed Collections Alert Banner */}
              {delayedCollections.length > 0 && (
                <section className="dashboard-section">
                  <div className="dashboard-section-glow" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent drop-shadow-lg">
                          ⚠️ Collection Delay Alert
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                          Your barangay collection is delayed
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {delayedCollections.map((delayed, idx) => {
                        const delayStatus = getDelayStatusColor(
                          delayed.delay_minutes,
                        );
                        return (
                          <div
                            key={`${delayed.schedule_id}-${idx}`}
                            className="rounded-xl border border-red-800/60 bg-gradient-to-br from-red-900/20 to-orange-900/20 p-5 shadow-lg"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                  <span
                                    className={`px-3 py-1 rounded-full text-xs font-bold ${delayStatus.bg} ${delayStatus.text} border ${delayStatus.text.replace("text-", "border-")}/30`}
                                  >
                                    {delayStatus.label}
                                  </span>
                                  <span className="text-slate-400 text-xs">
                                    Delay:{" "}
                                    <span className="text-red-400 font-semibold">
                                      {delayed.delay_minutes} min
                                    </span>
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <p className="text-slate-300">
                                    <span className="text-slate-500">
                                      Scheduled:
                                    </span>{" "}
                                    {delayed.scheduled_date} at{" "}
                                    {delayed.scheduled_time}
                                  </p>
                                  <p className="text-slate-300">
                                    <span className="text-slate-500">
                                      Status:
                                    </span>{" "}
                                    <span className="text-amber-400">
                                      {delayed.status}
                                    </span>
                                  </p>
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                  The collection truck is running behind
                                  schedule. Please keep your waste ready for
                                  pickup.
                                </p>
                              </div>
                              <div className="flex-shrink-0">
                                <div className="text-4xl">🚛</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {/* Submit Incident Report */}
          {activeTab === "submitIncidentReport" && (
            <SubmitReportSection
              barangays={barangays}
              onReportSubmit={handleReportSubmit}
            />
          )}

          {/* Manage Account */}
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

          {/* Schedules */}
          {activeTab === "schedule" && (
            <ResidentSchedulesFeature
              residentBarangayId={residentBarangayId}
              barangays={barangays}
            />
          )}

          {/* My Reports */}
          {activeTab === "myReports" &&
            (() => {
              // Filter by tab
              const tabFiltered =
                myReportsFilterTab === "all"
                  ? userReports
                  : userReports.filter(
                      (r) => r.current_status === myReportsFilterTab,
                    );

              // Filter by search
              const searchFiltered = tabFiltered.filter((r) => {
                const s = myReportsSearch.toLowerCase();
                if (!s) return true;
                return (
                  (r.location && r.location.toLowerCase().includes(s)) ||
                  (r.description && r.description.toLowerCase().includes(s)) ||
                  (r.report_id && String(r.report_id).includes(s))
                );
              });

              // Sort by date
              const sortedReports = [...searchFiltered].sort((a, b) => {
                const dateA = new Date(a.date_submitted).getTime();
                const dateB = new Date(b.date_submitted).getTime();
                return myReportsDateSort === "newest"
                  ? dateB - dateA
                  : dateA - dateB;
              });

              return (
                <section className="dashboard-section max-w-8xl mx-auto">
                  <div className="dashboard-section-glow" />
                  <h2 className="text-4xl font-bold text-emerald-300 mb-4">
                    My Recent Reports
                  </h2>

                  {/* Filter tabs + Sort dropdown + Search */}
                  {!reportsLoading &&
                    !reportsError &&
                    userReports.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        {/* Tab filters */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {(
                            [
                              "all",
                              "Submitted",
                              "Ongoing",
                              "Resolved",
                              "Rejected",
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab}
                              onClick={() => setMyReportsFilterTab(tab)}
                              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                                myReportsFilterTab === tab
                                  ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/40"
                                  : "bg-slate-800/60 text-slate-400 border-slate-700/50 hover:bg-slate-700/60 hover:text-slate-200"
                              }`}
                            >
                              {tab === "all" ? "All" : tab}
                            </button>
                          ))}
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Date sort dropdown */}
                          <select
                            value={myReportsDateSort}
                            onChange={(e) =>
                              setMyReportsDateSort(
                                e.target.value as "newest" | "oldest",
                              )
                            }
                            className="rounded-lg bg-slate-900/80 border border-green-800/50 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 appearance-none cursor-pointer"
                          >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                          </select>

                          {/* Search */}
                          <input
                            type="text"
                            placeholder="Search reports..."
                            value={myReportsSearch}
                            onChange={(e) => setMyReportsSearch(e.target.value)}
                            className="rounded-lg bg-slate-900/80 border border-green-800/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500 w-48"
                          />
                        </div>
                      </div>
                    )}

                  {reportsLoading && <TruckLoader />}
                  {reportsError && (
                    <p className="text-red-300 mb-2">{reportsError}</p>
                  )}
                  {!reportsLoading &&
                    !reportsError &&
                    userReports.length === 0 && (
                      <p className="text-slate-300">
                        You have not submitted any reports yet.
                      </p>
                    )}
                  {!reportsLoading &&
                    !reportsError &&
                    userReports.length > 0 && (
                      <div className="overflow-x-auto rounded-2xl border border-emerald-800/30 bg-slate-900/70 shadow-lg">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-slate-900/80">
                              <th className="px-4 py-3 text-left text-slate-400 font-semibold">
                                Report ID
                              </th>
                              <th className="px-4 py-3 text-left text-slate-400 font-semibold">
                                Location
                              </th>
                              <th className="px-4 py-3 text-left text-slate-400 font-semibold">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-slate-400 font-semibold">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left text-slate-400 font-semibold">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedReports.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={5}
                                  className="px-4 py-6 text-center text-slate-400"
                                >
                                  No reports match your filters.
                                </td>
                              </tr>
                            ) : (
                              sortedReports.map((report) => (
                                <tr
                                  key={report.report_id}
                                  className="text-md border-b border-emerald-800/20 hover:bg-slate-800/60 transition-colors"
                                >
                                  <td className="px-4 py-2 font-bold text-emerald-200">
                                    RP-{report.report_id}
                                  </td>
                                  <td className="px-4 py-2 text-slate-200 max-w-[160px] truncate">
                                    {report.location || "N/A"}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                                        report.current_status === "Resolved"
                                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                          : report.current_status ===
                                                "Ongoing" ||
                                              report.current_status ===
                                                "In Progress"
                                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                            : report.current_status ===
                                                "Rejected"
                                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                                              : "bg-slate-500/30 text-slate-200 border-slate-500/60"
                                      }`}
                                    >
                                      {report.current_status || "Unknown"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-slate-300 whitespace-nowrap">
                                    {report.date_submitted
                                      ? new Date(
                                          report.date_submitted,
                                        ).toLocaleString()
                                      : "N/A"}
                                  </td>
                                  <td className="px-4 py-2">
                                    <button
                                      onClick={() => {
                                        setSelectedMessage(report.description);
                                        setModalOpen(true);
                                      }}
                                      className="text-emerald-400 hover:underline mr-3"
                                    >
                                      View
                                    </button>
                                    <button
                                      className="text-slate-400 hover:underline"
                                      // TODO: Implement history modal if needed
                                    >
                                      History
                                    </button>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}

                  {modalOpen && (
                    <div
                      className="pt-50 fixed inset-0 backdrop-blur-sm z-50 flex justify-center items-center"
                      onClick={() => setModalOpen(false)}
                      onKeyDown={(e) =>
                        e.key === "Escape" && setModalOpen(false)
                      }
                      tabIndex={-1}
                      role="presentation"
                    >
                      <div
                        className="relative max-w-lg w-full text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-2xl border border-emerald-700/60 bg-gradient-to-b from-slate-900/95 to-slate-800/90 transform transition-all duration-200 ease-out"
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="report-message-title"
                      >
                        {/* Title bar */}
                        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-3 border-b border-emerald-700/70">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-600/10 text-emerald-300 border border-emerald-700/30">
                              💬
                            </span>
                            <h3
                              id="report-message-title"
                              className="ml-1 text-sm font-semibold tracking-wide text-slate-100"
                            >
                              Report Message
                            </h3>
                          </div>

                          <button
                            onClick={() => setModalOpen(false)}
                            className="text-sm font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                            aria-label="Close dialog"
                          >
                            ✕
                          </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                          <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-3">
                            MESSAGE
                          </p>
                          <div className="rounded-lg bg-slate-900/80 border border-slate-700/70 px-4 py-3">
                            <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                              {selectedMessage || "No message available."}
                            </p>
                          </div>

                          <div className="mt-5 flex justify-end">
                            <button
                              onClick={() => setModalOpen(false)}
                              className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500 transition-colors"
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              );
            })()}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <section className="dashboard-section max-w-8xl mx-auto">
              <div className="dashboard-section-glow" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">
                    Notifications
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Your report status updates
                  </p>
                </div>
              </div>

              {reportsLoading && <TruckLoader />}
              {reportsError && (
                <p className="text-red-300 mb-2">{reportsError}</p>
              )}
              {!reportsLoading && !reportsError && userReports.length === 0 && (
                <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 p-12 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-slate-800/50 flex items-center justify-center mx-auto mb-6">
                    <svg
                      className="w-10 h-10 text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">
                    No notifications yet
                  </h3>
                  <p className="text-slate-500 text-sm">
                    Submit an incident report and you'll see status updates
                    here.
                  </p>
                </div>
              )}
              {!reportsLoading && !reportsError && userReports.length > 0 && (
                <div className="space-y-3">
                  {userReports.map((report) => (
                    <div
                      key={report.report_id}
                      className="group relative bg-slate-900/40 rounded-2xl p-5 border border-slate-800/50 hover:border-emerald-500/20 transition-all duration-300"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center border ${
                              report.current_status === "Resolved"
                                ? "bg-emerald-500/10 border-emerald-500/20"
                                : report.current_status === "Ongoing" ||
                                    report.current_status === "In Progress"
                                  ? "bg-amber-500/10 border-amber-500/20"
                                  : report.current_status === "Rejected"
                                    ? "bg-red-500/10 border-red-500/20"
                                    : "bg-slate-800/50 border-slate-700/50"
                            }`}
                          >
                            <svg
                              className={`w-5 h-5 ${
                                report.current_status === "Resolved"
                                  ? "text-emerald-400"
                                  : report.current_status === "Ongoing" ||
                                      report.current_status === "In Progress"
                                    ? "text-amber-400"
                                    : report.current_status === "Rejected"
                                      ? "text-red-400"
                                      : "text-slate-400"
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              {report.current_status === "Resolved" ? (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              ) : report.current_status === "Rejected" ? (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              ) : (
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              )}
                            </svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">
                              {report.description}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Report RP-{report.report_id} •{" "}
                              {report.date_submitted
                                ? new Date(
                                    report.date_submitted,
                                  ).toLocaleString()
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
                            report.current_status === "Resolved"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : report.current_status === "Ongoing" ||
                                  report.current_status === "In Progress"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : report.current_status === "Rejected"
                                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                                  : "bg-slate-500/10 text-slate-300 border-slate-500/20"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              report.current_status === "Resolved"
                                ? "bg-emerald-400"
                                : report.current_status === "Ongoing" ||
                                    report.current_status === "In Progress"
                                  ? "bg-amber-400"
                                  : report.current_status === "Rejected"
                                    ? "bg-red-400"
                                    : "bg-slate-400"
                            }`}
                          />
                          {report.current_status || "Submitted"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
