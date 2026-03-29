"use client";

import React, {
  useState,
  useEffect,
  useRef,
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
    <div className="mb-4 relative">
      {/* Month Header with decorative elements */}
      <div className="mb-3 flex items-center justify-center gap-3">
        <div className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-500/30" />
        <div className="relative">
          <span className="relative z-10 text-sm font-bold bg-gradient-to-r from-slate-100 via-emerald-200 to-slate-100 bg-clip-text text-transparent tracking-wide">
            {format(new Date(year, month), "LLLL yyyy")}
          </span>
          <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        </div>
        <div className="h-px w-8 bg-gradient-to-l from-transparent to-emerald-500/30" />
      </div>

      {/* Calendar Container */}
      <div className="bg-slate-800/20 rounded-xl border border-slate-700/30 p-2 backdrop-blur-sm">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, idx) => (
            <div
              key={d}
              className={`text-center text-[15px] font-semibold uppercase tracking-wider py-1 rounded-md ${
                idx >= 5
                  ? "text-emerald-400/60 bg-emerald-500/5"
                  : "text-slate-400 bg-slate-800/30"
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0.5">
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
              const isSatOrSun =
                isCurrentMonth && (day.getDay() === 6 || day.getDay() === 0);

              // use midnight for comparisons so that time of day doesn't matter
              const todayMid = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
              );
              const isPast = isCurrentMonth && day < todayMid;
              const isFuture = isCurrentMonth && day > todayMid;

              let cellClasses =
                "relative h-10 rounded-lg flex flex-col items-center justify-center text-md font-medium transition-all duration-200 ";
              let content = null;

              if (!isCurrentMonth) {
                cellClasses +=
                  "text-slate-600/50 bg-transparent hover:bg-slate-800/20";
              } else if (isToday && isScheduled) {
                // Today AND scheduled - special combined highlight
                cellClasses +=
                  "bg-red-600 text-white shadow-md shadow-red-900/50 border border-red-400 cursor-pointer ring-2 ring-red-400/50";
                content = (
                  <>
                    <span className="relative z-10 font-bold text-sm">
                      {dayText}
                    </span>
                    <div className="absolute bottom-1 flex gap-0.5">
                      <div className="w-1 h-1 bg-red-200 rounded-full animate-pulse" />
                      <div className="w-1 h-1 bg-emerald-300/50 rounded-full animate-pulse delay-75" />
                    </div>
                  </>
                );
              } else if (isToday) {
                // Today only
                cellClasses +=
                  "bg-red-600 text-white shadow-md shadow-red-900/50 border border-red-400 font-bold ring-2 ring-red-400/50";
                content = <span className="font-bold text-sm">{dayText}</span>;
              } else if (isScheduled && isPast) {
                // Past scheduled days – mark as completed
                cellClasses +=
                  "bg-emerald-700/50 text-slate-200 border border-emerald-500/30";
                content = (
                  <span className="font-medium text-sm">{dayText}</span>
                );
              } else if (isScheduled) {
                // Scheduled days - Premium highlight
                cellClasses +=
                  "bg-gradient-to-br from-emerald-600/90 to-teal-700/90 text-white shadow-md shadow-emerald-900/40 border border-emerald-400/30 cursor-pointer";
                content = (
                  <>
                    <span className="relative z-10 font-bold text-sm">
                      {dayText}
                    </span>
                    <div className="absolute bottom-1 flex gap-0.5">
                      <div className="w-1 h-1 bg-emerald-200 rounded-full animate-pulse" />
                      <div className="w-1 h-1 bg-emerald-300/50 rounded-full animate-pulse delay-75" />
                    </div>
                  </>
                );
              } else if (isSatOrSun) {
                // Weekend non-scheduled
                cellClasses +=
                  "bg-slate-800/40 text-emerald-400/40 border border-emerald-500/10";
                content = <span className="font-medium">{dayText}</span>;
              } else {
                // Normal weekdays
                cellClasses +=
                  "bg-slate-800/30 text-slate-300 hover:bg-slate-700/50 hover:text-emerald-200 border border-transparent hover:border-emerald-500/20";
                content = <span className="font-medium">{dayText}</span>;
              }

              return (
                <div
                  key={day.toISOString() + weekIdx}
                  className={cellClasses}
                  title={
                    isToday && isScheduled && isCurrentMonth
                      ? `Today - Scheduled: ${format(day, "EEE, MMM d, yyyy")} at ${schedule.start_time ?? ""}`
                      : isScheduled && isCurrentMonth
                        ? `Scheduled: ${format(day, "EEE, MMM d, yyyy")} at ${schedule.start_time ?? ""}`
                        : isToday
                          ? "Today"
                          : isSatOrSun && isCurrentMonth
                            ? "Weekend - No collection"
                            : isCurrentMonth
                              ? `Available: ${format(day, "EEE, MMM d")}`
                              : ""
                  }
                >
                  {content || <span>{dayText}</span>}

                  {/* Subtle day indicator for scheduled days */}
                  {isScheduled && isCurrentMonth && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900 shadow-sm" />
                  )}

                  {/* Today indicator dot */}
                  {isToday && !isScheduled && isCurrentMonth && (
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-400 rounded-full border border-slate-900 shadow-sm" />
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-center gap-4 text-[10px]">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-400/30" />
          <span className="text-slate-400">Upcoming Collection</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-700/50 border border-emerald-500/30" />
          <span className="text-slate-400">Completed Collection</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-600 border border-red-400" />
          <span className="text-slate-400">Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-800/40 border border-emerald-500/10" />
          <span className="text-slate-400">Weekend</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-slate-800/30" />
          <span className="text-slate-400">Weekday</span>
        </div>
      </div>
    </div>
  );
}

// ---- Delay Reason Options ----
const DELAY_REASONS = [
  "Vehicle Breakdown",
  "Heavy Traffic",
  "Bad Weather / Flooding",
  "Route Obstruction",
  "Fuel Issue",
  "Manpower Shortage",
  "Tire Puncture",
  "Other",
] as const;

const ESTIMATED_DELAYS = [
  "15 minutes",
  "30 minutes",
  "1 hour",
  "2+ hours",
] as const;

// ---- Delay Detection Helper ----
function isTodayScheduled(pattern: string): boolean {
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon, ...
  if (pattern === "MWF") return [1, 3, 5].includes(dayOfWeek);
  if (pattern === "TTH") return [2, 4].includes(dayOfWeek);
  return false;
}

function isCollectionPastStartTime(startTime: string | null): boolean {
  if (!startTime) return false;
  const now = new Date();
  const [h, m] = startTime.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  // Consider delayed if 15+ minutes past start time
  return now.getTime() - scheduled.getTime() > 15 * 60 * 1000;
}

function isCollectionMissed(startTime: string | null): boolean {
  if (!startTime) return false;
  const now = new Date();
  const [h, m] = startTime.split(":").map(Number);
  const scheduled = new Date();
  scheduled.setHours(h, m, 0, 0);
  // Consider missed if 60+ minutes past start time
  return now.getTime() - scheduled.getTime() > 60 * 60 * 1000;
}

function formatTime12(time: string | null): string {
  if (!time) return "N/A";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ---- Collection Delay Monitor Component ----
function CollectionDelayMonitor({
  schedules,
  manualOpenSchedule,
  manualMissedSchedule,
  onManualHandled,
  onManualMissedHandled,
}: {
  schedules: Schedule[];
  manualOpenSchedule?: Schedule | null;
  manualMissedSchedule?: Schedule | null;
  onManualHandled?: () => void;
  onManualMissedHandled?: () => void;
}) {
  const [delayModalOpen, setDelayModalOpen] = useState(false);
  const [missedModalOpen, setMissedModalOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [delayPending, setDelayPending] = useState(false);
  const [missedPending, setMissedPending] = useState(false);

  const STORAGE_KEY_DELAY_PENDING = "gcp_delay_pending";
  const STORAGE_KEY_MISSED_PENDING = "gcp_missed_pending";
  const STORAGE_KEY_DONE_PENDING = "gcp_done_pending";

  const [delayReason, setDelayReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [submittedReason, setSubmittedReason] = useState<string | null>(null);
  const [delayNotes, setDelayNotes] = useState("");
  const [estimatedDelay, setEstimatedDelay] = useState("");
  const [delaySaving, setDelaySaving] = useState(false);
  const [delayError, setDelayError] = useState<string | null>(null);
  const [delaySuccess, setDelaySuccess] = useState<string | null>(null);
  const [delaySubmitted, setDelaySubmitted] = useState(false);
  const [delayedSchedule, setDelayedSchedule] = useState<Schedule | null>(null);

  const [missedReason, setMissedReason] = useState("");
  const [missedNotes, setMissedNotes] = useState("");
  const [missedSaving, setMissedSaving] = useState(false);
  const [missedError, setMissedError] = useState<string | null>(null);
  const [missedSuccess, setMissedSuccess] = useState<string | null>(null);
  const [missedSubmitted, setMissedSubmitted] = useState(false);
  const [missedSchedule, setMissedSchedule] = useState<Schedule | null>(null);
  const [missedSuppressedUntil, setMissedSuppressedUntil] = useState<
    number | null
  >(null);
  const MISSED_SUPPRESSION_KEY = "gcp_missed_suppressed";

  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [donePending, setDonePending] = useState(false);
  const [doneSubmitted, setDoneSubmitted] = useState(false);
  const [doneSchedule, setDoneSchedule] = useState<Schedule | null>(null);
  const [doneDate, setDoneDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [doneWeight, setDoneWeight] = useState("");
  const [doneGarbageType, setDoneGarbageType] = useState("");
  const [doneSaving, setDoneSaving] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);
  const [doneSuccess, setDoneSuccess] = useState<string | null>(null);

  const [gcpUserId, setGcpUserId] = useState<string | null>(null);
  const getStorageKey = (base: string) =>
    gcpUserId ? `${base}_${gcpUserId}` : base;

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoShown = useRef(false);
  const initialCheckDone = useRef(false);

  // Detect delayed schedules
  const checkForDelays = useCallback(async () => {
    if (delaySubmitted) return; // Already submitted a reason today
    if (!gcpUserId) return;

    const today = new Date().toISOString().slice(0, 10);
    const scheduleIds = schedules.map((s) => s.schedule_id);

    if (!scheduleIds.length) return;

    const { data: details, error } = await supabase
      .from("collection_details")
      .select("schedule_id, status")
      .in("schedule_id", scheduleIds)
      .eq("collection_date", today);

    if (error || !details?.length) {
      setDelayedSchedule(null);
      setDelayPending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_DELAY_PENDING), "false");
      setDelayModalOpen(false);
      return;
    }

    const delayedScheduleId = details.find(
      (d) => d.status === "Delayed",
    )?.schedule_id;

    if (!delayedScheduleId) {
      setDelayedSchedule(null);
      setDelayPending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_DELAY_PENDING), "false");
      setDelayModalOpen(false);
      return;
    }

    const foundSchedule = schedules.find(
      (s) => s.schedule_id === delayedScheduleId,
    );
    if (!foundSchedule) {
      setDelayedSchedule(null);
      setDelayPending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_DELAY_PENDING), "false");
      setDelayModalOpen(false);
      return;
    }

    setDelayedSchedule(foundSchedule);
    if (!minimized) {
      setDelayPending(true);
      localStorage.setItem(getStorageKey(STORAGE_KEY_DELAY_PENDING), "true");
      setDelayModalOpen(true);
    }
  }, [schedules, delaySubmitted, minimized, gcpUserId]);

  // Detect missed schedules
  const checkForMisses = useCallback(async () => {
    if (missedSubmitted) return;
    if (!gcpUserId) return;

    const now = Date.now();
    if (missedSuppressedUntil && now < missedSuppressedUntil) return;
    if (missedSuppressedUntil && now >= missedSuppressedUntil) {
      setMissedSuppressedUntil(null);
      localStorage.removeItem(getStorageKey(MISSED_SUPPRESSION_KEY));
    }

    const today = new Date().toISOString().slice(0, 10);
    const scheduleIds = schedules.map((s) => s.schedule_id);
    if (!scheduleIds.length) return;

    const { data: details, error } = await supabase
      .from("collection_details")
      .select("schedule_id, status")
      .in("schedule_id", scheduleIds)
      .eq("collection_date", today);

    if (error || !details?.length) {
      setMissedSchedule(null);
      setMissedPending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_MISSED_PENDING), "false");
      setMissedModalOpen(false);
      return;
    }

    const missedSchedule = details.find((d) => d.status === "Missed");
    if (!missedSchedule) {
      setMissedSchedule(null);
      setMissedPending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_MISSED_PENDING), "false");
      setMissedModalOpen(false);
      return;
    }

    const foundSchedule = schedules.find(
      (s) => s.schedule_id === missedSchedule.schedule_id,
    );
    if (!foundSchedule) {
      setMissedSchedule(null);
      setMissedPending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_MISSED_PENDING), "false");
      setMissedModalOpen(false);
      return;
    }

    setMissedSchedule(foundSchedule);
    setMissedPending(true);
    localStorage.setItem(getStorageKey(STORAGE_KEY_MISSED_PENDING), "true");
    setMissedModalOpen(true);
  }, [schedules, missedSubmitted, gcpUserId, missedSuppressedUntil]);

  // Detect completed (Done) schedules
  const checkForDone = useCallback(async () => {
    if (doneSubmitted) return;

    const today = new Date().toISOString().slice(0, 10);

    if (!gcpUserId || !schedules.length) return;

    const scheduleIds = schedules.map((s) => s.schedule_id);
    const { data: doneRows, error: doneErr } = await supabase
      .from("collection_details")
      .select("schedule_id")
      .in("schedule_id", scheduleIds)
      .eq("collection_date", today)
      .eq("status", "Done")
      .limit(1)
      .maybeSingle();

    if (doneErr || !doneRows?.schedule_id) {
      setDoneSchedule(null);
      setDonePending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_DONE_PENDING), "false");
      setDoneModalOpen(false);
      return;
    }

    const foundSchedule = schedules.find(
      (s) => s.schedule_id === doneRows.schedule_id,
    );
    if (!foundSchedule) {
      setDoneSchedule(null);
      setDonePending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_DONE_PENDING), "false");
      setDoneModalOpen(false);
      return;
    }

    setDoneSchedule(foundSchedule);
    setDonePending(true);
    localStorage.setItem(getStorageKey(STORAGE_KEY_DONE_PENDING), "true");
    setDoneModalOpen(true);
  }, [schedules, doneSubmitted, gcpUserId]);

  // Initial check + 10-minute re-popup interval
  useEffect(() => {
    async function initialize() {
      if (typeof window === "undefined") return;

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const userId = !authErr && authData?.user ? authData.user.id : null;
      setGcpUserId(userId);

      if (!userId) return;

      // cleanup older global keys when we switch users, to avoid cross-user leakage
      window.localStorage.removeItem(STORAGE_KEY_DELAY_PENDING);
      window.localStorage.removeItem(STORAGE_KEY_MISSED_PENDING);
      window.localStorage.removeItem(STORAGE_KEY_DONE_PENDING);

      const pendingDelay = window.localStorage.getItem(
        getStorageKey(STORAGE_KEY_DELAY_PENDING),
      );
      const pendingMissed = window.localStorage.getItem(
        getStorageKey(STORAGE_KEY_MISSED_PENDING),
      );
      const pendingDone = window.localStorage.getItem(
        getStorageKey(STORAGE_KEY_DONE_PENDING),
      );

      // immediately re-check after user is known
      if (userId) {
        await checkForMisses();
        await checkForDelays();
        await checkForDone();
      }

      setDelayPending(pendingDelay === "true");
      setMissedPending(pendingMissed === "true");
      setDonePending(pendingDone === "true");

      if (pendingDelay === "true" && !delaySubmitted) {
        setDelayModalOpen(true);
      }
      if (pendingMissed === "true" && !missedSubmitted) {
        setMissedModalOpen(true);
      }
      if (pendingDone === "true" && !doneSubmitted) {
        setDoneModalOpen(true);
      }

      initialCheckDone.current = true;
    }

    initialize();

    const timeout = setTimeout(() => {
      if (
        !hasAutoShown.current &&
        !delaySubmitted &&
        !missedSubmitted &&
        !doneSubmitted
      ) {
        checkForMisses();
        checkForDelays();
        checkForDone();
        hasAutoShown.current = true;
      }
    }, 3000);

    intervalRef.current = setInterval(
      () => {
        if (!delaySubmitted && !missedSubmitted && !doneSubmitted) {
          checkForMisses();
          checkForDelays();
          checkForDone();
        }
      },
      10 * 60 * 1000,
    );

    const reopenInterval = setInterval(
      () => {
        if (!delaySubmitted && delayPending && !delayModalOpen) {
          setDelayModalOpen(true);
        }
        if (!missedSubmitted && !missedModalOpen) {
          const now = Date.now();
          if (!missedSuppressedUntil || now >= missedSuppressedUntil) {
            if (missedPending) {
              setMissedModalOpen(true);
            }
          }
        }
        if (!doneSubmitted && donePending && !doneModalOpen) {
          setDoneModalOpen(true);
        }
      },
      2 * 60 * 1000,
    );

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearInterval(reopenInterval);
    };
  }, [
    schedules,
    delaySubmitted,
    missedSubmitted,
    doneSubmitted,
    delayPending,
    missedPending,
    donePending,
    delayModalOpen,
    missedModalOpen,
    doneModalOpen,
    checkForDelays,
    checkForMisses,
    checkForDone,
  ]);

  // Clear interval once submitted
  useEffect(() => {
    if (delaySubmitted && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [delaySubmitted]);

  // Manual open from parent (Report Delay / Missed button on card)
  useEffect(() => {
    if (manualOpenSchedule) {
      setDelayedSchedule(manualOpenSchedule);
      setMinimized(false);
      setDelayModalOpen(true);
      onManualHandled?.();
    }
    if (manualMissedSchedule) {
      setMissedSchedule(manualMissedSchedule);
      setMinimized(false);
      setMissedModalOpen(true);
      onManualMissedHandled?.();
    }
  }, [
    manualOpenSchedule,
    manualMissedSchedule,
    onManualHandled,
    onManualMissedHandled,
  ]);

  const handleMinimize = () => {
    setMinimized(true);
    setDelayModalOpen(false);
  };

  const handleOpenFromMinimized = () => {
    setMinimized(false);
    setDelayModalOpen(true);
  };

  const handleSubmitDelay = async () => {
    if (!delayReason) {
      setDelayError("Please select a delay reason.");
      return;
    }
    if (delayReason === "Custom reason" && !customReason.trim()) {
      setDelayError("Please provide your custom reason.");
      return;
    }

    setDelaySaving(true);
    setDelayError(null);
    setDelaySuccess(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Not authenticated");

      // Get GCP's name for notification
      const { data: profile } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("user_id", authData.user.id)
        .single();
      const gcpName = profile
        ? `${profile.first_name} ${profile.last_name}`.trim()
        : "Unknown";

      // Save delay info to collection_details
      if (delayedSchedule) {
        const today = new Date().toISOString().slice(0, 10);

        // Check if there's an existing collection_details for today
        const { data: existing } = await supabase
          .from("collection_details")
          .select("collectiondetails_id")
          .eq("schedule_id", delayedSchedule.schedule_id)
          .eq("collection_date", today)
          .maybeSingle();

        // Determine main reason (use custom text if provided)
        const mainReason =
          delayReason === "Custom reason" ? customReason.trim() : delayReason;
        // Build a combined delay_reason string with all info (include estimated delay only if provided)
        const combinedReason = `${mainReason}${estimatedDelay ? ` | Est. delay: ${estimatedDelay}` : ""}${delayNotes.trim() ? ` | Notes: ${delayNotes.trim()}` : ""}`;

        if (existing?.collectiondetails_id) {
          // Update existing record
          await supabase
            .from("collection_details")
            .update({
              delay_reason: combinedReason,
              status: "Delayed",
            })
            .eq("collectiondetails_id", existing.collectiondetails_id);
        } else {
          // Get truck
          const { data: truck } = await supabase
            .from("garbage_trucks")
            .select("truck_id")
            .eq("gcp_user_id", authData.user.id)
            .single();

          // Insert new record with delay info
          await supabase.from("collection_details").insert({
            schedule_id: delayedSchedule.schedule_id,
            truck_id: truck?.truck_id || null,
            collection_date: today,
            delay_reason: combinedReason,
            status: "Delayed",
          });
        }

        // Send SMS notifications to Secretary, BWMC, and Residents
        try {
          await fetch("/api/notifications/collection-delay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scheduleId: delayedSchedule.schedule_id,
              barangayId: delayedSchedule.barangay?.barangay_id,
              barangayName:
                delayedSchedule.barangay?.barangay_name || "Unknown",
              delayReason: mainReason,
              delayNotes: delayNotes.trim() || undefined,
              estimatedDelay: estimatedDelay || undefined,
              gcpName,
            }),
          });
        } catch (notifyErr) {
          console.error("Failed to send delay notifications:", notifyErr);
        }
        // remember submitted reason for display
        setSubmittedReason(mainReason);
      }

      setDelaySuccess("Delay reason submitted successfully.");
      setDelaySubmitted(true);
      setDelayPending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_DELAY_PENDING), "false");
      setTimeout(() => {
        setDelayModalOpen(false);
        setDelaySuccess(null);
      }, 2000);
    } catch (err: any) {
      setDelayError(err.message || "Failed to submit delay reason.");
    } finally {
      setDelaySaving(false);
    }
  };

  const handleSubmitMissed = async () => {
    if (!missedReason.trim()) {
      setMissedError("Please provide a reason for missed collection.");
      return;
    }

    setMissedSaving(true);
    setMissedError(null);
    setMissedSuccess(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Not authenticated");

      const today = new Date().toISOString().slice(0, 10);
      if (!missedSchedule)
        throw new Error("No schedule selected for missed report");

      const combinedReason = `${missedReason.trim()}${missedNotes.trim() ? ` | Notes: ${missedNotes.trim()}` : ""}`;

      const { data: existing } = await supabase
        .from("collection_details")
        .select("collectiondetails_id")
        .eq("schedule_id", missedSchedule.schedule_id)
        .eq("collection_date", today)
        .maybeSingle();

      if (existing?.collectiondetails_id) {
        await supabase
          .from("collection_details")
          .update({
            delay_reason: combinedReason,
            status: "Missed",
          })
          .eq("collectiondetails_id", existing.collectiondetails_id);
      } else {
        const { data: truck } = await supabase
          .from("garbage_trucks")
          .select("truck_id")
          .eq("gcp_user_id", authData.user.id)
          .single();

        await supabase.from("collection_details").insert({
          schedule_id: missedSchedule.schedule_id,
          truck_id: truck?.truck_id || null,
          collection_date: today,
          delay_reason: combinedReason,
          status: "Missed",
        });
      }

      try {
        await fetch("/api/notifications/collection-missed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scheduleId: missedSchedule.schedule_id,
            barangayId: missedSchedule.barangay?.barangay_id,
            barangayName: missedSchedule.barangay?.barangay_name,
          }),
        });
      } catch (notifyErr) {
        console.error(
          "Failed to send missed collection notifications:",
          notifyErr,
        );
      }

      setMissedSuccess("Missed collection reported successfully.");
      setMissedSubmitted(true);
      setMissedPending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_MISSED_PENDING), "false");
      setTimeout(() => {
        setMissedModalOpen(false);
        setMissedSuccess(null);
      }, 2000);
    } catch (err: any) {
      setMissedError(
        err.message || "Failed to submit missed collection report.",
      );
    } finally {
      setMissedSaving(false);
    }
  };

  const handleSubmitDone = async () => {
    if (!doneDate) {
      setDoneError("Please provide the completion date.");
      return;
    }
    const weight = Number(doneWeight);
    if (!doneWeight || Number.isNaN(weight) || weight <= 0) {
      setDoneError("Please provide a valid waste weight.");
      return;
    }

    if (!doneGarbageType) {
      setDoneError("Please select a garbage type.");
      return;
    }

    setDoneSaving(true);
    setDoneError(null);
    setDoneSuccess(null);

    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Not authenticated");

      const today = new Date().toISOString().slice(0, 10);
      if (!doneSchedule)
        throw new Error("No schedule selected for done report");

      const { data: existing } = await supabase
        .from("collection_details")
        .select("collectiondetails_id")
        .eq("schedule_id", doneSchedule.schedule_id)
        .eq("collection_date", today)
        .maybeSingle();

      if (existing?.collectiondetails_id) {
        const completionTime = new Date().toTimeString().slice(0, 8); // HH:MM:SS as TIME type

        const { data: updateData, error: updateError } = await supabase
          .from("collection_details")
          .update({
            status: "Done",
            completion_time: completionTime,
            waste_weight: weight,
            garbage_type: doneGarbageType,
          })
          .eq("collectiondetails_id", existing.collectiondetails_id)
          .select()
          .maybeSingle();

        if (updateError) {
          console.error("handleSubmitDone update error", updateError);
          throw new Error(
            updateError.message || "Failed to update collection_details.",
          );
        }

        console.log("handleSubmitDone updated collection_details", updateData);
      } else {
        const { data: truck } = await supabase
          .from("garbage_trucks")
          .select("truck_id")
          .eq("gcp_user_id", authData.user.id)
          .single();

        const completionTime = new Date().toTimeString().slice(0, 8); // HH:MM:SS as TIME type

        const { data: insertData, error: insertError } = await supabase
          .from("collection_details")
          .insert({
            schedule_id: doneSchedule.schedule_id,
            truck_id: truck?.truck_id || null,
            collection_date: today,
            status: "Done",
            completion_time: completionTime,
            waste_weight: weight,
            garbage_type: doneGarbageType,
          })
          .select()
          .maybeSingle();

        if (insertError) {
          console.error("handleSubmitDone insert error", insertError);
          throw new Error(
            insertError.message || "Failed to insert collection_details.",
          );
        }

        console.log("handleSubmitDone inserted collection_details", insertData);
      }

      setDoneSuccess("Done collection reported successfully.");
      setDoneSubmitted(true);
      setDonePending(false);
      localStorage.setItem(getStorageKey(STORAGE_KEY_DONE_PENDING), "false");
      setTimeout(() => {
        setDoneModalOpen(false);
        setDoneSuccess(null);
      }, 2000);
    } catch (err: any) {
      setDoneError(err.message || "Failed to submit done collection report.");
    } finally {
      setDoneSaving(false);
    }
  };

  return (
    <>
      {/* Minimized floating indicator - pulse to remind GCP */}
      {minimized && !delaySubmitted && delayedSchedule && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <button
            type="button"
            onClick={handleOpenFromMinimized}
            className="flex items-center gap-2 rounded-full bg-slate-900 hover:bg-amber-500 text-white px-5 py-3 shadow-2xl shadow-amber-900/50 border border-amber-400/50 transition-all"
          >
            <span className="text-xl">⚠️</span>
            <span className="text-sm font-semibold">Report Delay</span>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-200" />
            </span>
          </button>
        </div>
      )}

      {/* Delay Submitted badge */}
      {delaySubmitted && delayedSchedule && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-200 flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Delay reported for{" "}
            <strong>{delayedSchedule.barangay?.barangay_name || "N/A"}</strong>:{" "}
            {submittedReason || delayReason} (est. {estimatedDelay})
          </span>
        </div>
      )}

      {/* Missed Submitted badge */}
      {missedSubmitted && missedSchedule && (
        <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-200 flex items-center gap-2">
          <span>🛑</span>
          <span>
            Missed collection reported for{" "}
            <strong>{missedSchedule.barangay?.barangay_name || "N/A"}</strong>.
          </span>
        </div>
      )}

      {/* Done Submitted badge */}
      {doneSubmitted && doneSchedule && (
        <div className="mb-4 rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2 text-xs text-blue-200 flex items-center gap-2">
          <span>✅</span>
          <span>
            Done collection reported for{" "}
            <strong>{doneSchedule.barangay?.barangay_name || "N/A"}</strong>.
          </span>
        </div>
      )}

      {/* Delay Modal */}
      <Dialog
        open={delayModalOpen}
        onOpenChange={(open: boolean) => {
          if (!open && !delaySubmitted) {
            // Allow close, but mark pending so it can reopen later
            setDelayModalOpen(false);
            setDelayPending(true);
            localStorage.setItem(
              getStorageKey(STORAGE_KEY_DELAY_PENDING),
              "true",
            );
          } else {
            setDelayModalOpen(open);
            if (open) {
              setDelayPending(true);
              localStorage.setItem(
                getStorageKey(STORAGE_KEY_DELAY_PENDING),
                "true",
              );
            }
          }
        }}
      >
        <DialogContent className="max-w-md bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-emerald-500/20 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-100">
                  Collection Delay Report
                </DialogTitle>
                <p className="text-xs text-emerald-400/70 font-medium uppercase tracking-wider mt-1">
                  Delay Notification
                </p>
              </div>
            </div>

            <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <p className="text-sm text-emerald-200/90">
                Your collection for{" "}
                <strong className="text-emerald-100">
                  {delayedSchedule?.barangay?.barangay_name || "N/A"}
                </strong>{" "}
                scheduled at{" "}
                <strong className="text-emerald-100">
                  {formatTime12(delayedSchedule?.start_time || null)}
                </strong>{" "}
                appears to be delayed.
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5">
            {/* Delay Reason */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-emerald-400/80 uppercase tracking-wider">
                Reason for delay <span className="text-red-400">*</span>
              </Label>
              <div className="relative">
                <select
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors appearance-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900">
                    Select a reason...
                  </option>
                  {DELAY_REASONS.map((reason) => (
                    <option
                      key={reason}
                      value={reason}
                      className="bg-slate-900"
                    >
                      {reason}
                    </option>
                  ))}
                  <option value="Custom reason" className="bg-slate-900">
                    Custom reason
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

              {delayReason === "Custom reason" && (
                <Input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  className="mt-2 rounded-lg bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  placeholder="Type your reason here..."
                  maxLength={100}
                />
              )}
            </div>

            {/* Messages */}
            {delayError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                <svg
                  className="w-4 h-4 text-red-400 shrink-0"
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
                <span className="text-xs text-red-200/90">{delayError}</span>
              </div>
            )}

            {delaySuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <span className="text-xs text-emerald-200/90">
                  {delaySuccess}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-slate-800/30 border-t border-slate-700/50 px-5 py-4 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDelayModalOpen(false);
                setDelayPending(true);
                localStorage.setItem(
                  getStorageKey(STORAGE_KEY_DELAY_PENDING),
                  "true",
                );
              }}
              disabled={delaySaving}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 text-sm"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSubmitDelay}
              disabled={delaySaving}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-lg shadow-emerald-900/30 transition-all duration-200 hover:shadow-emerald-500/25 disabled:opacity-50"
            >
              {delaySaving ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M4 7l3 9m-3 9l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    />
                  </svg>
                  Submitting...
                </span>
              ) : (
                "Submit Report"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Missed Modal */}
      <Dialog
        open={missedModalOpen}
        onOpenChange={(open: boolean) => {
          if (!open && !missedSubmitted) {
            // Allow close, but suppress for 2 minutes before reopening.
            const suppressUntil = Date.now() + 2 * 60 * 1000;
            setMissedModalOpen(false);
            setMissedPending(false);
            setMissedSuppressedUntil(suppressUntil);
            localStorage.setItem(
              getStorageKey(MISSED_SUPPRESSION_KEY),
              suppressUntil.toString(),
            );
            localStorage.setItem(
              getStorageKey(STORAGE_KEY_MISSED_PENDING),
              "false",
            );
          } else {
            setMissedModalOpen(open);
            if (open) {
              setMissedPending(true);
              setMissedSuppressedUntil(null);
              localStorage.removeItem(getStorageKey(MISSED_SUPPRESSION_KEY));
              localStorage.setItem(
                getStorageKey(STORAGE_KEY_MISSED_PENDING),
                "true",
              );
            }
          }
        }}
      >
        <DialogContent className="max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-rose-600/20 to-pink-600/20 border-b border-rose-500/20 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                <span className="text-2xl">🛑</span>
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-100">
                  Missed Collection Report
                </DialogTitle>
                <p className="text-xs text-rose-400/70 font-medium uppercase tracking-wider mt-1">
                  Missed Collection Notification
                </p>
              </div>
            </div>

            <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
              <p className="text-sm text-rose-200/90">
                Your collection for{" "}
                <strong className="text-rose-100">
                  {missedSchedule?.barangay?.barangay_name || "N/A"}
                </strong>{" "}
                scheduled at{" "}
                <strong className="text-rose-100">
                  {formatTime12(missedSchedule?.start_time || null)}
                </strong>{" "}
                is now marked as <strong>Missed</strong>.
              </p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-rose-400/80 uppercase tracking-wider">
                Reason for missed collection{" "}
                <span className="text-red-400">*</span>
              </Label>
              <Input
                type="text"
                value={missedReason}
                onChange={(e) => setMissedReason(e.target.value)}
                className="rounded-lg bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30"
                placeholder="Type your reason here..."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-rose-400/80 uppercase tracking-wider">
                Additional notes (optional)
              </Label>
              <Textarea
                value={missedNotes}
                onChange={(e) => setMissedNotes(e.target.value)}
                className="min-h-[80px] rounded-lg bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30"
                placeholder="Add comments for end users or operations"
              />
            </div>

            {missedError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200">
                <span>❗</span>
                <span>{missedError}</span>
              </div>
            )}

            {missedSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-200">
                <span>✅</span>
                <span>{missedSuccess}</span>
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 border-t border-slate-700/50 px-5 py-4 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMissedModalOpen(false);
                setMissedPending(true);
                localStorage.setItem(
                  getStorageKey(STORAGE_KEY_MISSED_PENDING),
                  "true",
                );
              }}
              disabled={missedSaving}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 text-sm"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSubmitMissed}
              disabled={missedSaving}
              className="bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-lg shadow-rose-900/30 transition-all duration-200 hover:shadow-rose-500/25 disabled:opacity-50"
            >
              {missedSaving ? (
                <span className="flex items-center gap-2">Submitting...</span>
              ) : (
                "Submit Missed Report"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Done Modal */}
      <Dialog
        open={doneModalOpen}
        onOpenChange={(open: boolean) => {
          if (!open && !doneSubmitted) {
            setDoneModalOpen(false);
            setDonePending(true);
            localStorage.setItem(
              getStorageKey(STORAGE_KEY_DONE_PENDING),
              "true",
            );
          } else {
            setDoneModalOpen(open);
            if (open) {
              setDonePending(true);
              localStorage.setItem(
                getStorageKey(STORAGE_KEY_DONE_PENDING),
                "true",
              );
            }
          }
        }}
      >
        <DialogContent className="max-w-md bg-slate-900 border border-blue-500/30 rounded-2xl shadow-2xl p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600/20 to-sky-600/20 border-b border-blue-500/20 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-100">
                  Done Collection Report
                </DialogTitle>
                <p className="text-xs text-blue-400/70 font-medium uppercase tracking-wider mt-1">
                  Done Collection Notification
                </p>
              </div>
            </div>

            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-200/90">
                Your collection for{" "}
                <strong className="text-blue-100">
                  {doneSchedule?.barangay?.barangay_name || "N/A"}
                </strong>{" "}
                scheduled at{" "}
                <strong className="text-blue-100">
                  {formatTime12(doneSchedule?.start_time || null)}
                </strong>{" "}
                is now marked as <strong>Done</strong>.
              </p>
            </div>
          </div>

          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-blue-400/80 uppercase tracking-wider">
                Collection date <span className="text-red-400">*</span>
              </Label>
              <Input
                type="date"
                value={doneDate}
                onChange={(e) => setDoneDate(e.target.value)}
                className="rounded-lg bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-blue-400/80 uppercase tracking-wider">
                Waste weight (kg) <span className="text-red-400">*</span>
              </Label>
              <Input
                type="number"
                value={doneWeight}
                onChange={(e) => setDoneWeight(e.target.value)}
                className="rounded-lg bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder:text-slate-500 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                placeholder="Enter waste weight"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold text-blue-400/80 uppercase tracking-wider">
                Garbage type <span className="text-red-400">*</span>
              </Label>
              <select
                value={doneGarbageType}
                onChange={(e) => setDoneGarbageType(e.target.value)}
                className="w-full rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-200 px-3 py-2 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
              >
                <option value="">Select garbage type</option>
                <option value="biodegradable">Biodegradable</option>
                <option value="recyclable">Recyclable</option>
                <option value="residual">Residual</option>
              </select>
            </div>

            {doneError && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-200">
                <span>❗</span>
                <span>{doneError}</span>
              </div>
            )}
            {doneSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-200">
                <span>✅</span>
                <span>{doneSuccess}</span>
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 border-t border-slate-700/50 px-5 py-4 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDoneModalOpen(false);
                setDonePending(true);
                localStorage.setItem(
                  getStorageKey(STORAGE_KEY_DONE_PENDING),
                  "true",
                );
              }}
              disabled={doneSaving}
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 text-sm"
            >
              Close
            </Button>
            <Button
              type="button"
              onClick={handleSubmitDone}
              disabled={doneSaving}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-lg shadow-blue-900/30 transition-all duration-200 hover:shadow-blue-500/25 disabled:opacity-50"
            >
              {doneSaving ? "Submitting..." : "Submit Done Report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Schedules Viewer for GCP
function GCPCollectionMonitor() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collectionStatusBySchedule, setCollectionStatusBySchedule] = useState<
    Record<string, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchSchedules() {
      setLoading(true);
      try {
        const { data: authData, error: authErr } =
          await supabase.auth.getUser();
        if (authErr || !authData?.user) throw new Error("Not authenticated");
        const userId = authData.user.id;

        const { data, error: scheduleErr } = await supabase
          .from("collection_schedules")
          .select(
            `schedule_id, barangay:barangay_id (barangay_name, barangay_id), days, start_time, end_time, status`,
          )
          .eq("gcp_user_id", userId);

        if (scheduleErr) throw scheduleErr;

        if (isMounted) {
          const normalized = (data ?? []).map((row: any) => ({
            ...row,
            barangay:
              row?.barangay && Array.isArray(row.barangay)
                ? row.barangay[0] || null
                : row?.barangay || null,
          }));
          setSchedules(normalized as Schedule[]);

          const scheduleIds = (normalized as Schedule[]).map(
            (schedule) => schedule.schedule_id,
          );

          if (scheduleIds.length) {
            const { data: details } = await supabase
              .from("collection_details")
              .select("schedule_id, status, gcp_user_id")
              .in("schedule_id", scheduleIds)
              .eq("collection_date", new Date().toISOString().slice(0, 10));

            if (details) {
              const statusMap: Record<string, string> = {};
              details.forEach((d: any) => {
                if (d.status && d.schedule_id) {
                  statusMap[d.schedule_id] = d.status;
                }
              });
              setCollectionStatusBySchedule(statusMap);
            }
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSchedules();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <CollectionDelayMonitor schedules={schedules} />
      {loading && <div className="sr-only">Loading schedule monitor</div>}
      {error && (
        <div className="sr-only">Collection monitor error: {error}</div>
      )}
    </>
  );
}

function GCPScheduleSection() {
  const [mainLoading, setMainLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [collectionStatusBySchedule, setCollectionStatusBySchedule] = useState<
    Record<string, string>
  >({});
  const [manualDelaySchedule, setManualDelaySchedule] =
    useState<Schedule | null>(null);
  const [manualMissedSchedule, setManualMissedSchedule] =
    useState<Schedule | null>(null);

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
        const normalized = (data ?? []).map((row: any) => ({
          ...row,
          barangay:
            row?.barangay && Array.isArray(row.barangay)
              ? row.barangay[0] || null
              : row?.barangay || null,
        }));
        setSchedules(normalized as Schedule[]);

        if (normalized.length) {
          const scheduleIds = (normalized as Schedule[]).map(
            (schedule) => schedule.schedule_id,
          );

          const today = new Date().toISOString().slice(0, 10);
          const { data: details, error: detailErr } = await supabase
            .from("collection_details")
            .select("schedule_id, status")
            .in("schedule_id", scheduleIds)
            .eq("collection_date", today)
            .eq("gcp_user_id", userId);

          if (!detailErr && details) {
            const statusMap = (details as any[]).reduce(
              (acc, row) => ({ ...acc, [row.schedule_id]: row.status }),
              {} as Record<string, string>,
            );
            setCollectionStatusBySchedule(statusMap);
          }
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setMainLoading(false);
      }
    }

    fetchGCPSchedules();

    // Realtime: auto-refresh when collection_schedules or collection_details changes
    const channel = supabase
      .channel("gcp-schedules-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_schedules" },
        () => fetchGCPSchedules(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_details" },
        () => fetchGCPSchedules(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <section className="dashboard-section max-w-4xl mx-auto overflow-hidden">
      <div className="dashboard-section-glow" />
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
          My Assigned Schedule
        </h2>

        {/* Delay Monitor - auto-pops when collection is delayed */}
        {!mainLoading && schedules.length > 0 && (
          <CollectionDelayMonitor
            schedules={schedules}
            manualOpenSchedule={manualDelaySchedule}
            manualMissedSchedule={manualMissedSchedule}
            onManualHandled={() => setManualDelaySchedule(null)}
            onManualMissedHandled={() => setManualMissedSchedule(null)}
          />
        )}

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
              <div className="flex items-center justify-between mb-2 gap-3">
                <h3 className="font-semibold text-lg text-slate-100">
                  Barangay: {schedule.barangay?.barangay_name || "N/A"}
                </h3>
                {isTodayScheduled(schedule.days) && (
                  <div className="flex gap-2">
                    {collectionStatusBySchedule[schedule.schedule_id] ===
                    "Delayed" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setManualDelaySchedule(schedule)}
                        className="h-auto text-xs px-3 py-1.5 border-amber-600/50 text-amber-400 hover:bg-amber-600/20 hover:text-amber-300"
                      >
                        ⚠️ Report Delay
                      </Button>
                    ) : null}

                    {collectionStatusBySchedule[schedule.schedule_id] ===
                    "Missed" ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setManualMissedSchedule(schedule)}
                        className="h-auto text-xs px-3 py-1.5 border-red-600/50 text-red-400 hover:bg-red-600/20 hover:text-red-300"
                      >
                        🛑 Report Missed
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
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
  const [truckCapacity, setTruckCapacity] = useState<number | null>(null);
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

    // Realtime: auto-refresh when gcp_assignment or community_reports changes
    const channel = supabase
      .channel("gcp-tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "gcp_assignment" },
        () => fetchTasks(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => fetchTasks(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenResponse = (assignment: any) => {
    setResponseAssignment(assignment);
    setResponseText(assignment.gcp_response || "");
    setResponseError(null);
    setResponseModalOpen(true);
  };

  const handleOpenWasteModal = async () => {
    setWasteWeight("");
    setCollectionDate(new Date().toISOString().slice(0, 10));
    setWasteError(null);
    setWasteSuccess(null);
    // Fetch truck capacity for display and check for today's record
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Not authenticated");
      const { data: truck, error: truckErr } = await supabase
        .from("garbage_trucks")
        .select("capacity, truck_id")
        .eq("gcp_user_id", authData.user.id)
        .single();
      setTruckCapacity(truck?.capacity ?? null);
      // Check for existing record for today
      const today = new Date().toISOString().slice(0, 10);
      const { data: existing, error: existingErr } = await supabase
        .from("collection_details")
        .select("collectiondetails_id")
        .eq("truck_id", truck?.truck_id)
        .eq("collection_date", today)
        .maybeSingle();
      if (existing) {
        window.alert("You have already recorded waste collected for today.");
        return;
      }
    } catch {
      setTruckCapacity(null);
    }
    setWasteModalOpen(true);
  };

  const handleSubmitWaste = async () => {
    setWasteSaving(true);
    setWasteError(null);
    try {
      const weightValue = parseFloat(wasteWeight);
      if (isNaN(weightValue) || weightValue <= 0) {
        setWasteError("Please enter a valid waste weight.");
        setWasteSaving(false);
        return;
      }
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) throw new Error("Not authenticated");

      const { data: truck, error: truckErr } = await supabase
        .from("garbage_trucks")
        .select("truck_id, truck_code, capacity")
        .eq("gcp_user_id", authData.user.id)
        .single();
      if (truckErr || !truck?.truck_id) {
        throw new Error("No truck assigned to this account.");
      }

      // Validate weight does not exceed truck capacity
      if (truck.capacity && weightValue > truck.capacity) {
        setWasteError(
          `Weight exceeds truck capacity (${truck.capacity} kg). Please enter a lower value.`,
        );
        setWasteSaving(false);
        return;
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

      // Check for existing record for this truck and date
      const { data: existing, error: existingErr } = await supabase
        .from("collection_details")
        .select("collectiondetails_id")
        .eq("truck_id", truck.truck_id)
        .eq("collection_date", collectionDate)
        .maybeSingle();
      if (existing) {
        setWasteError("You can only record waste collected once per day.");
        setWasteSaving(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("collection_details")
        .insert({
          schedule_id: schedule.schedule_id,
          truck_id: truck.truck_id,
          collection_date: collectionDate,
          waste_weight: weightValue,
          status: "Ongoing",
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
                  Waste weight collected (tons)
                </Label>
                {truckCapacity !== null && (
                  <div className="text-xs text-emerald-300 mb-1">
                    Max truck capacity: <b>{truckCapacity} tons</b>
                  </div>
                )}
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={wasteWeight}
                  onChange={(e) => setWasteWeight(e.target.value)}
                  placeholder={
                    truckCapacity !== null
                      ? `Max: ${truckCapacity}`
                      : "e.g. 120.5"
                  }
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
  const [initials, setInitials] = useState("");
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "userAdmin"
    | "viewSchedule"
    | "assignedTasks"
    | "manageAccount"
  >("dashboard");
  const [tabFadeIn, setTabFadeIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTab = localStorage.getItem("gcp_active_tab");
    if (
      storedTab === "dashboard" ||
      storedTab === "userAdmin" ||
      storedTab === "viewSchedule" ||
      storedTab === "assignedTasks" ||
      storedTab === "manageAccount"
    ) {
      setActiveTab(storedTab);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("gcp_active_tab", activeTab);
    setTabFadeIn(false);
    const timeoutId = window.setTimeout(() => setTabFadeIn(true), 40);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab]);

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

      const name = fullName || profile?.username || authData.user.email || "";
      const parts = name.trim().split(/\s+/);
      setInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : name.slice(0, 2).toUpperCase(),
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
                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm shadow-lg overflow-hidden">
                  {initials}
                </span>
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
          <div
            className={`transition-opacity duration-300 ease-in-out ${
              tabFadeIn ? "opacity-100" : "opacity-0"
            }`}
            key={activeTab}
          >
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

            <GCPCollectionMonitor />

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
          </div>
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
                disabled
                readOnly
                className="bg-slate-950/80 border-slate-800 text-slate-100 placeholder:text-slate-500 focus-visible:ring-emerald-500 cursor-not-allowed opacity-60"
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
