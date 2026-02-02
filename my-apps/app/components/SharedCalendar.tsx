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
    <div className="mb-8">
      <div className="mb-4 flex justify-center">
        <span className="text-xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
          {format(new Date(year, month), "LLLL yyyy")}
        </span>
      </div>

      <div className="calendar-grid">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}

        {weeks.map((weekDays, weekIdx) =>
          weekDays.map((day) => {
            const isScheduled = patternDates.some(
              (pd) => pd.toDateString() === day.toDateString(),
            );
            const dayText = day.getMonth() === month ? format(day, "d") : "";
            const isCurrentMonth = day.getMonth() === month;
            const isSatOrSun =
              isCurrentMonth && (day.getDay() === 6 || day.getDay() === 0);

            return (
              <div
                key={day.toISOString() + weekIdx}
                className={`calendar-day h-14 w-14 rounded-2xl cursor-default flex flex-col items-center justify-center mx-auto transition-all duration-300 group text-sm font-bold border-2 ${
                  isScheduled && isCurrentMonth
                    ? "calendar-day--scheduled"
                    : isSatOrSun && isCurrentMonth
                      ? "calendar-day--weekend"
                      : !isCurrentMonth
                        ? "calendar-day--other"
                        : "calendar-day--normal"
                }`}
                title={
                  isScheduled && isCurrentMonth
                    ? `Scheduled: ${format(day, "EEE, MMM d, yyyy")} at ${startTime ?? ""}`
                    : isSatOrSun && isCurrentMonth
                      ? "No working day"
                      : ""
                }
              >
                <span>{dayText}</span>
                {isScheduled && isCurrentMonth && (
                  <div className="w-2 h-2 bg-emerald-300 rounded-full mt-1 animate-pulse" />
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
