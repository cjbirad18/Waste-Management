"use client";

import React from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  addDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
} from "date-fns";

type SharedCalendarProps = {
  year: number;
  month: number; // 0-based
  pattern?: "MWF" | "TTH" | "" | null;
  startTime?: string;
};

const PATTERN_MAP: Record<string, number[]> = {
  MWF: [1, 3, 5],
  TTH: [2, 4],
};

export default function SharedCalendar({
  year,
  month,
  pattern,
  startTime,
}: SharedCalendarProps) {
  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const validDays = pattern ? (PATTERN_MAP[pattern] ?? []) : [];

  const patternDates: Date[] = [];
  let d = startOfMonth(new Date(year, month));
  const end = endOfMonth(d);
  while (d <= end) {
    if (validDays.includes(d.getDay())) {
      patternDates.push(new Date(d));
    }
    d = addDays(d, 1);
  }

  const weeks: Date[][] = [];
  const start = startOfWeek(startOfMonth(new Date(year, month)), {
    weekStartsOn: 1,
  });
  const finish = endOfWeek(endOfMonth(new Date(year, month)), {
    weekStartsOn: 1,
  });
  let currentWeekStart = start;
  while (currentWeekStart <= finish) {
    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(addDays(currentWeekStart, i));
    }
    weeks.push(weekDays);
    currentWeekStart = addWeeks(currentWeekStart, 1);
  }

  return (
    <div className="mb-4 relative">
      {/* Month Header with decorative elements */}
      <div className="mb-3 flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-500/30" />
          <div className="relative">
            <span className="relative z-10 text-sm font-bold bg-gradient-to-r from-slate-100 via-emerald-200 to-slate-100 bg-clip-text text-transparent tracking-wide">
              {format(new Date(year, month), "LLLL yyyy")}
            </span>
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
          </div>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-emerald-500/30" />
        </div>
        <span className="text-xs text-slate-400">Today: {format(now, "EEEE, MMM d")}</span>
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
                (pd) => pd.toDateString() === day.toDateString(),
              );
              const isCurrentMonth = day.getMonth() === month;
              const dayText = isCurrentMonth ? format(day, "d") : "";
              const isSatOrSun =
                isCurrentMonth && (day.getDay() === 6 || day.getDay() === 0);
              const isToday =
                day.getDate() === now.getDate() &&
                day.getMonth() === now.getMonth() &&
                day.getFullYear() === now.getFullYear();
              const isPast = isCurrentMonth && day < todayMid;

              // Dynamic classes based on state
              let cellClasses =
                "relative h-10 rounded-lg flex flex-col items-center justify-center text-md font-medium transition-all duration-200 ";
              let content = null;

              if (!isCurrentMonth) {
                // Other month days
                cellClasses +=
                  "text-slate-600/50 bg-transparent hover:bg-slate-800/20";
              } else if (isToday) {
                // current day regardless of schedule
                cellClasses +=
                  "bg-red-600 text-white shadow-md shadow-red-900/50 border border-red-400 font-bold ring-2 ring-red-400/50";
                content = <span className="font-bold text-sm">{dayText}</span>;
              } else if (isScheduled && isPast) {
                // completed collection
                cellClasses +=
                  "bg-emerald-700/50 text-slate-200 border border-emerald-500/30";
                content = <span className="font-medium text-sm">{dayText}</span>;
              } else if (isScheduled) {
                // upcoming scheduled
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
                    isScheduled && isCurrentMonth
                      ? `Scheduled: ${format(day, "EEE, MMM d, yyyy")} at ${startTime ?? ""}`
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
          <span className="text-slate-400">Upcoming</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-700/50 border border-emerald-500/30" />
          <span className="text-slate-400">Completed</span>
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
