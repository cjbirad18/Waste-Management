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

// Generate all collection dates for the given pattern, year and month
function generatePatternDates(
  pattern: string | null,
  year: number,
  month: number
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
        setSchedules(data || []);
      }
    }
    fetchSchedules();
  }, []);

  // Filter out barangays already scheduled
  const scheduledBarangayIds = schedules.map((s) => s.barangay_id);
  const availableBarangays = barangays.filter(
    (b) => !scheduledBarangayIds.includes(b.barangay_id)
  );

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // If the user changes GCP selection
    if (name === "gcp_user_id") {
      // Count existing assignments for that GCP
      const gcpAssignedCount = schedules.filter(
        (s) => s.gcp_user_id === value
      ).length;

      // Show confirmation window if assigned >= 2
      if (gcpAssignedCount >= 2) {
        const confirmed = window.confirm(
          "This GCP is already assigned twice. Do you want to continue?"
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
      "Do you want to continue saving the schedule?"
    );
    if (!proceedSave) return;

    // Count how many schedules the selected GCP already has
    console.log(
      "schedules:",
      schedules,
      "selected GCP ID:",
      schedule.gcp_user_id
    );

    const gcpAssignedCount = schedules.filter(
      (s) => s.gcp_user_id === schedule.gcp_user_id
    ).length;

    if (gcpAssignedCount >= 2) {
      const confirmed = window.confirm(
        "This GCP is already assigned twice. Do you want to continue?"
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
          "Failed to save schedule: " + (insertError?.message ?? "Unknown")
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
        .select("barangay_id, gcp_user_id, schedule_pattern, start_time")
        .eq("status", "Active");
      if (!refreshError) setSchedules(refreshedSchedules || []);
    } catch (err) {
      setError("Unexpected error: " + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 items-stretch">
      {/* Schedule Input Form */}
      <form
        onSubmit={handleSubmit}
        className="flex-1 bg-white shadow rounded-xl p-6 space-y-4 h-full"
        style={{ maxWidth: 450 }}
      >
        <h2 className="text-3xl font-bold text-green-600 mb-2">
          Input Schedule
        </h2>

        <div>
          <label className="font-semibold block mb-1 text-black">
            Barangay
          </label>
          <select
            name="barangay_id"
            value={schedule.barangay_id}
            onChange={handleChange}
            className="w-full p-2 border rounded text-black"
            required
          >
            <option value="">Select Barangay</option>
            {availableBarangays.map((b) => (
              <option key={b.barangay_id} value={b.barangay_id}>
                {b.barangay_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold block mb-1 text-black">Truck</label>
          <select
            name="truck_code"
            value={schedule.truck_code}
            onChange={handleChange}
            className="w-full p-2 border rounded text-black"
            required
          >
            <option value="">Select Truck</option>
            {trucks.map((t) => (
              <option key={t.truck_id} value={t.truck_code}>
                {t.truck_code}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold block mb-1 text-black">GCP</label>
          <select
            name="gcp_user_id"
            value={schedule.gcp_user_id}
            onChange={handleChange}
            className="w-full p-2 border rounded text-black"
            required
          >
            <option value="">Select GCP</option>
            {gcps.map((g) => (
              <option key={g.user_id} value={g.user_id}>
                {g.first_name} {g.last_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="font-semibold block mb-1 text-black">
            Schedule Pattern
          </label>
          <select
            name="schedule_pattern"
            value={schedule.schedule_pattern}
            onChange={handleChange}
            className="w-full p-2 border rounded text-black"
            required
          >
            <option value="">Select Pattern</option>
            <option value="MWF">Monday-Wednesday-Friday (MWF)</option>
            <option value="TTH">Tuesday-Thursday (TTH)</option>
          </select>
        </div>

        <div>
          <label className="font-semibold block mb-1 text-black">
            Time (for display/preview only)
          </label>
          <input
            type="time"
            name="start_time"
            value={schedule.start_time}
            onChange={handleChange}
            className="w-full p-2 border rounded bg-white text-black"
            required
          />
        </div>

        {error && (
          <div className="text-red-700 bg-red-100 rounded p-2">{error}</div>
        )}
        {success && (
          <div className="text-green-600 bg-green-100 rounded p-2">
            {success}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold "
          >
            Save Schedule
          </button>
        </div>
      </form>

      {/* Calendar View */}
      <div className="flex-1 h-full bg-white shadow rounded-xl p-6 overflow-auto min-w-[350px]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-green-600 text-3xl">Scheduled Days</h3>
          <div className="flex gap-2">
            <button
              className="text-lg text-black"
              onClick={handleMonthPrev}
              title="Show previous 2 months"
            >
              &lt;
            </button>
            <button
              className="text-lg text-black"
              onClick={handleMonthNext}
              title="Show next 2 months"
            >
              &gt;
            </button>
          </div>
        </div>

        {monthsToShow.map(({ year, month }) => {
          // Find schedules with this month and year for pattern and starttime display
          // We'll just use current form.schedule pattern for demo, but better display real scheduled days per barangay if needed
          const patternDates = generatePatternDates(
            schedule.schedule_pattern,
            year,
            month
          );

          const weeks: Date[][] = [];
          {
            const start = startOfWeek(startOfMonth(new Date(year, month)), {
              weekStartsOn: 1,
            });
            const end = endOfWeek(endOfMonth(new Date(year, month)), {
              weekStartsOn: 1,
            });
            let currentWeekStart = start;
            while (currentWeekStart <= end) {
              const weekDays = [];
              for (let i = 0; i < 7; i++) {
                weekDays.push(addDays(currentWeekStart, i));
              }
              weeks.push(weekDays);
              currentWeekStart = addWeeks(currentWeekStart, 1);
            }
          }

          return (
            <div key={`${year}-${month}`} className="mb-6 ">
              <div className="mb-2 mt-2 flex justify-center">
                <span className="font-semibold text-xl text-black">
                  {format(new Date(year, month), "LLLL yyyy")}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-md text-gray-800 select-none min-w-[350px]">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} className="font-semibold py-1">
                    {d}
                  </div>
                ))}
                {weeks.map((weekDays, weekIdx) =>
                  weekDays.map((day) => {
                    const isScheduled = patternDates.some(
                      (d) => d.toDateString() === day.toDateString()
                    );
                    const dayText =
                      day.getMonth() === month ? format(day, "d") : "";
                    const isCurrentMonth = day.getMonth() === month;
                    const isSatOrSun =
                      isCurrentMonth &&
                      (day.getDay() === 6 || day.getDay() === 0);
                    return (
                      <div
                        key={day.toISOString() + weekIdx}
                        className={`
                          h-10.5 w-10.5 px-0 py-0 rounded cursor-default flex flex-col items-center justify-center
                          text-sm font-bold
                          ${
                            isScheduled && isCurrentMonth
                              ? "bg-green-600 text-black font-bold"
                              : ""
                          }
                          ${!isCurrentMonth ? "text-gray-300" : ""}
                          border
                          ${
                            weekIdx % 2 === 0
                              ? "border-green-300"
                              : "border-green-600"
                          }
                        `}
                        title={
                          isScheduled && isCurrentMonth
                            ? `Scheduled: ${format(
                                day,
                                "EEE, MMM d, yyyy"
                              )} at ${schedule.start_time}`
                            : isSatOrSun && isCurrentMonth
                            ? "No working day"
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
        })}
      </div>
    </div>
  );
}

function SchedulesSidebarItem({ barangays }) {
  const [selectedBarangay, setSelectedBarangay] = useState("");
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editScheduleId, setEditScheduleId] = useState(null);
  const [editPattern, setEditPattern] = useState("");

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
  `
          )
          .eq("barangay_id", selectedBarangay)
          .order("date_created", { ascending: false });
        if (error) throw error;
        setSchedules(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchSchedules();
  }, [selectedBarangay]);

  // Remove schedule
  const handleDelete = async (schedule_id) => {
    if (
      !window.confirm(
        "Are you sure? This will permanently delete the schedule."
      )
    )
      return;
    try {
      const { error } = await supabase
        .from("collection_schedules")
        .delete()
        .eq("schedule_id", schedule_id);
      if (error) throw error;
      setSchedules((s) => s.filter((sc) => sc.schedule_id !== schedule_id));
    } catch (err) {
      alert("Failed to delete schedule.");
    }
  };

  // Begin editing
  const handleEdit = (schedule) => {
    setEditScheduleId(schedule.schedule_id);
    setEditPattern(schedule.days);
  };

  // Save edit
  const handleSaveEdit = async (schedule_id) => {
    try {
      const { error } = await supabase
        .from("collection_schedules")
        .update({ days: editPattern })
        .eq("schedule_id", schedule_id);
      if (error) throw error;
      setSchedules((s) =>
        s.map((sc) =>
          sc.schedule_id === schedule_id ? { ...sc, days: editPattern } : sc
        )
      );
      setEditScheduleId(null);
    } catch (err) {
      alert("Failed to update schedule.");
    }
  };

  const renderCalendar = (schedule) => {
    const weeks = [];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = startOfWeek(startOfMonth(new Date(year, month)), {
      weekStartsOn: 1,
    });
    const end = endOfWeek(endOfMonth(new Date(year, month)), {
      weekStartsOn: 1,
    });
    const patternDates = generatePatternDates(schedule.days, year, month);
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
      <div className="my-4">
        <div className="flex justify-center mb-2">
          <span className="font-semibold text-md">
            {format(new Date(year, month), "LLLL yyyy")}
          </span>
        </div>
        <div className=" grid grid-cols-7 gap-3 min-w-[350px]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="font-semibold py-1 text-center text-gray-800"
            >
              {d}
            </div>
          ))}
          {weeks.map((weekDays, weekIdx) =>
            weekDays.map((day, dayIdx) => {
              const isScheduled = patternDates.some(
                (d) => d.toDateString() === day.toDateString()
              );
              const dayText = day.getMonth() === month ? format(day, "d") : "";
              const isCurrentMonth = day.getMonth() === month;
              return (
                <div
                  key={day.toISOString() + weekIdx}
                  className={[
                    "h-12 w-12 flex flex-col items-center justify-center text-md rounded border",
                    isScheduled && isCurrentMonth
                      ? "bg-green-600 text-black font-bold border-green-600"
                      : "",
                    !isScheduled && isCurrentMonth
                      ? "bg-white border-green-300 text-black font-bold"
                      : "",
                    !isCurrentMonth
                      ? "bg-gray-50 text-gray-300 border-gray-100"
                      : "",
                  ].join(" ")}
                  title={
                    isScheduled && isCurrentMonth
                      ? `Scheduled: ${format(day, "EEE, MMM d, yyyy")}`
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
  };

  return (
    <div>
      <select
        className="w-full p-2 mb-4 border rounded text-black"
        value={selectedBarangay}
        onChange={(e) => setSelectedBarangay(e.target.value)}
      >
        <option value="">Select Barangay</option>
        {barangays.map((b) => (
          <option key={b.barangay_id} value={b.barangay_id}>
            {b.barangay_name}
          </option>
        ))}
      </select>

      {loading && <div className="text-gray-600">Loading schedules...</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {selectedBarangay && schedules.length === 0 && !loading ? (
        <div className="text-gray-500">No schedules found.</div>
      ) : (
        schedules.map((schedule) => (
          <div
            key={schedule.schedule_id}
            className="mb-6 p-4 rounded shadow bg-white"
          >
            <div className="text-2xl flex justify-between items-center mb-2">
              <div>
                <div className="font-bold">
                  {schedule.barangay?.barangay_name}
                </div>
                <div className="text-xl text-black">
                  Pattern: {schedule.days}
                </div>
                <div className="text-xl text-black">
                  Assigned GCP:{" "}
                  {schedule.gcp_user
                    ? `${schedule.gcp_user.first_name} ${schedule.gcp_user.last_name}`
                    : "None"}
                </div>
              </div>
              <div>
                {editScheduleId === schedule.schedule_id ? (
                  <>
                    <input
                      value={editPattern}
                      onChange={(e) => setEditPattern(e.target.value)}
                      className="border rounded p-1 mr-2"
                    />
                    <button
                      className="px-2 py-1 bg-green-600 text-white rounded mr-2"
                      onClick={() => handleSaveEdit(schedule.schedule_id)}
                    >
                      Save
                    </button>
                    <button
                      className="px-2 py-1 bg-gray-400 text-white rounded"
                      onClick={() => setEditScheduleId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="px-2 py-1 bg-green-600 text-white rounded mr-2"
                      onClick={() => handleEdit(schedule)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-2 py-1 bg-red-600 text-white rounded"
                      onClick={() => handleDelete(schedule.schedule_id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>

            {renderCalendar(schedule)}
          </div>
        ))
      )}
    </div>
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
    <section className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8 mt-1">
      <h2 className="text-3xl font-bold mb-6 text-green-600">Manage Account</h2>
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
          "Failed to update report status."
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
    <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8 mt-8">
      <h2 className="text-2xl font-bold mb-4 text-green-700">
        Passed Incident Reports (for Secretary)
      </h2>

      {reports.length === 0 ? (
        <div className="text-black">
          No passed incident reports at the moment.
        </div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-green-50">
              <th className="p-2 text-left">Location</th>
              <th className="p-2 text-left">Landmark</th>
              <th className="p-2 text-left">Date Submitted</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.report_id} className="border-t align-middle h-16">
                <td className="p-2">{report.location}</td>
                <td className="p-2">{report.landmark}</td>
                <td className="p-2">
                  {new Date(report.date_submitted).toLocaleString()}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => handleOpenAssign(report)}
                    className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                  >
                    Assign GCP & Task
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Assign GCP & Task modal */}
      {assignModalOpen && selectedReport && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center"
          onClick={() => setAssignModalOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setAssignModalOpen(false)}
              className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
              aria-label="Close"
            >
              ×
            </button>
            <h3 className="font-bold text-lg mb-3 text-green-700">
              Assign GCP & Task
            </h3>
            <p className="text-sm mb-2">
              Location:{" "}
              <span className="font-semibold">{selectedReport.location}</span>
            </p>

            <label className="block text-sm font-semibold mb-1">
              Select GCP
            </label>
            <select
              value={selectedGcpId}
              onChange={(e) => setSelectedGcpId(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm mb-3"
            >
              <option value="">-- Choose GCP --</option>
              {gcpUsers.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.first_name} {u.last_name}
                </option>
              ))}
            </select>

            <label className="block text-sm font-semibold mb-1">
              Task details
            </label>
            <textarea
              className="w-full border rounded px-2 py-1 text-sm mb-3"
              rows={3}
              value={taskDetails}
              onChange={(e) => setTaskDetails(e.target.value)}
              placeholder="Describe what the GCP should do..."
            />

            {assignError && (
              <p className="text-xs text-red-600 mb-2">{assignError}</p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAssignModalOpen(false)}
                className="px-3 py-1 text-sm rounded border border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitAssign}
                className="px-4 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
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
  `
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
    <section className="max-w-5xl mx-auto bg-white rounded-xl shadow p-8">
      <h2 className="text-3xl font-bold mb-4 text-green-600">GCP Responses</h2>
      {rows.length === 0 ? (
        <div className="text-gray-500">No responses yet.</div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-green-300">
              <th className="p-2 text-left text-black">Date</th>
              <th className="p-2 text-left text-black">GCP</th>
              <th className="p-2 text-left text-black">Location / Barangay</th>
              <th className="p-2 text-left text-black">Response</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.gcp_assignment_id} className="border-t align-top">
                <td className="p-2 text-black">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="p-2 text-black">
                  {row.user
                    ? `${row.user.first_name} ${row.user.last_name}`
                    : "Unknown"}
                </td>
                <td className="p-2 text-black">
                  {row.report
                    ? `${row.report.location} (${row.report.landmark})`
                    : row.collectiondetails?.schedule?.barangay?.barangayname ??
                      "N/A"}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => handleOpenModal(row)}
                    className="px-3 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700"
                  >
                    View response
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modalOpen && selectedRow && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={handleCloseModal}
        >
          <div
            className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute top-2 right-3 text-2xl text-gray-500 hover:text-red-600 font-bold"
              aria-label="Close"
            >
              ×
            </button>

            <h3 className="font-bold text-lg mb-3 text-green-700">
              GCP Response
            </h3>

            <p className="text-sm mb-1">
              <span className="font-semibold">GCP: </span>
              {selectedRow.user
                ? `${selectedRow.user.first_name} ${selectedRow.user.last_name}`
                : "Unknown"}
            </p>

            <p className="text-sm mb-1">
              <span className="font-semibold">Location: </span>
              {selectedRow.report
                ? `${selectedRow.report.location} (${selectedRow.report.landmark})`
                : selectedRow.collectiondetails?.schedule?.barangay
                    ?.barangay_name ?? "N/A"}
            </p>

            <p className="text-xs text-gray-500 mb-3">
              {selectedRow.created_at
                ? new Date(selectedRow.created_at).toLocaleString()
                : ""}
            </p>

            <div className="mb-3">
              <p className="font-semibold text-sm mb-1">Task details</p>
              <p className="text-sm whitespace-pre-wrap border rounded p-2 bg-gray-50">
                {selectedRow.task_details || "—"}
              </p>
            </div>

            <div>
              <p className="font-semibold text-sm mb-1">GCP response</p>
              <p className="text-sm whitespace-pre-wrap border rounded p-2 bg-gray-50">
                {selectedRow.gcp_response || "No response yet"}
              </p>
            </div>
          </div>
        </div>
      )}
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
          "truck_id, plate_number, capacity, status, truck_code, gcp_user_id"
        );
      if (error) setError(error.message);
      else setTrucks(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
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
    <section className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6 space-y-6">
      <h2 className="text-3xl font-bold text-green-600">Garbage Trucks</h2>

      {/* Add Truck form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-black mb-1">
              Plate number
            </label>
            <input
              name="plate_number"
              value={form.plate_number}
              onChange={handleChange}
              className="w-full border rounded p-2 text-black"
              placeholder="e.g. NCA1234"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-1">
              Capacity (tons)
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              name="capacity"
              value={form.capacity}
              onChange={handleChange}
              className="w-full border rounded p-2 text-black"
              placeholder="e.g. 6.50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-1">
              Status
            </label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="w-full border rounded p-2 text-black"
            >
              <option value="Available">Available</option>
              <option value="Under maintenance">Under maintenance</option>
              <option value="Retired">Retired</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-black mb-1">
              Truck code
            </label>
            <input
              name="truck_code"
              value={form.truck_code}
              onChange={handleChange}
              className="w-full border rounded p-2 text-black"
              placeholder="e.g. Bool_NCA1234"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-semibold text-black mb-1">
              Assigned GCP (optional)
            </label>
            <select
              name="gcp_user_id"
              value={form.gcp_user_id}
              onChange={handleChange}
              className="w-full border rounded p-2 text-black"
            >
              <option value="">No default GCP</option>
              {gcps.map((g) => (
                <option key={g.user_id} value={g.user_id}>
                  {g.first_name} {g.last_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="text-red-700 bg-red-100 rounded p-2">{error}</div>
        )}
        {success && (
          <div className="text-green-700 bg-green-100 rounded p-2">
            {success}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold"
          >
            Add Truck
          </button>
        </div>
      </form>

      {/* Existing trucks list */}
      <div>
        <h3 className="text-xl font-semibold mb-2 text-black">
          Existing trucks
        </h3>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : trucks.length === 0 ? (
          <p className="text-gray-500 text-sm">No trucks added yet.</p>
        ) : (
          <div className="space-y-2">
            {trucks.map((t) => (
              <div
                key={t.truck_id}
                className="flex justify-between items-center border rounded px-3 py-2 text-sm bg-gray-50"
              >
                <div>
                  <div className="font-semibold text-black">
                    {t.truck_code} ({t.plate_number})
                  </div>
                  <div className="text-gray-600">
                    Capacity: {t.capacity} tons · Status: {t.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function SecretaryDashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "manageAccount"
    | "inputSchedule"
    | "schedules"
    | "passedIncidents"
    | "gcpResponses"
    | "garbageTrucks"
  >("dashboard");

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
    }
  );
  const [manageAccountLoading, setManageAccountLoading] = useState(true);
  const [manageAccountError, setManageAccountError] = useState<string | null>(
    null
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
          "Failed to load reference data: " + (err as Error).message
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
        user_id: "",
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

  return (
    <div className="flex bg-gray-50 min-h-screen">
      {/* sidebar toggle and sidebar same as your existing code, plus Passed Incidents item */}
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
            Secretary Dashboard
          </h1>
          <p className="text-xs font-semibold text-gray-600 leading-snug">
            SWMO/TCEMO
          </p>
        </div>
        <nav
          className="flex-1 mt-6 text-sm font-semibold text-gray-700 space-y-1"
          aria-label="Main Navigation"
        >
          {" "}
          <SidebarItem
            label="Dashboard"
            icon="📊"
            selected={activeTab === "dashboard"}
            onClick={() => {
              setActiveTab("dashboard");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Input Schedule"
            icon="📝"
            selected={activeTab === "inputSchedule"}
            onClick={() => {
              setActiveTab("inputSchedule");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Garbage Trucks"
            icon="🚚"
            selected={activeTab === "garbageTrucks"}
            onClick={() => {
              setActiveTab("garbageTrucks");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Schedules"
            icon="📅"
            selected={activeTab === "schedules"}
            onClick={() => {
              setActiveTab("schedules");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Passed Incidents"
            icon="🚨"
            selected={activeTab === "passedIncidents"}
            onClick={() => {
              setActiveTab("passedIncidents");
              setSidebarOpen(false);
            }}
          />
          {/* NEW: GCP responses */}
          <SidebarItem
            label="GCP Responses"
            icon="💬"
            selected={activeTab === "gcpResponses"}
            onClick={() => {
              setActiveTab("gcpResponses");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Manage Account"
            icon="👤"
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

      {/* Main content */}
      <main className="flex-1 p-6 md:p-8 transition-all duration-300 md:ml-64 overflow-auto">
        {activeTab === "dashboard" && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {summaryCards.map((card, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl shadow p-6 flex flex-col items-center ${card.bg}`}
                  role="region"
                  aria-label={card.label}
                >
                  <div className="text-4xl mb-3" aria-hidden="true">
                    {card.icon}
                  </div>
                  <div className={`text-3xl font-bold ${card.color}`}>
                    {card.count}
                  </div>
                  <div className="text-black mt-1">{card.label}</div>
                </div>
              ))}
            </div>
            <br />
            <section aria-label="Map of collection area and vehicles">
              <LeafletMap />
            </section>
          </>
        )}

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

        {activeTab === "inputSchedule" && (
          <ScheduleFormWithCalendar
            barangays={barangays}
            trucks={trucks}
            gcps={gcps}
            onSave={handleScheduleSubmit}
          />
        )}
        {activeTab === "garbageTrucks" && <GarbageTrucksSection gcps={gcps} />}

        {activeTab === "schedules" && (
          <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8">
            <h2 className="text-3xl font-bold mb-4 text-green-600 ">
              Schedules Overview
            </h2>
            <SchedulesSidebarItem barangays={barangays} />
          </section>
        )}

        {/* NEW: Passed Incidents tab – secretary feature */}
        {activeTab === "passedIncidents" && <SecretaryReportsSection />}

        {activeTab === "gcpResponses" && <SecretaryGcpResponsesSection />}
      </main>
    </div>
  );
}
