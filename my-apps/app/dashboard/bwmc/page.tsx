"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import TruckLoader from "../../loading/TruckLoader";
import { sendSMS } from "@/lib/sms";
import {
  startOfMonth,
  endOfMonth,
  addDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
} from "date-fns";
import Image from "next/image";

import BarangayConcernsAnalytics from "../../generatereport/barangayconcern";

const LeafletMap = dynamic(() => import("../../leafletmap"), { ssr: false });

interface User {
  id: number | null | undefined;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  role: string;
  status: string;
}

interface CommunityReport {
  report_id: string;
  location: string;
  description: string;
  landmark: string;
  date_submitted: string;
  // add other fields as needed from your DB schema
}

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

type UserWithBarangay = User & {
  barangay?: { barangay_id: number; barangay_name: string } | null;
};

// Erase after testing SMS functionality

function SidebarItem({
  label,
  icon,
  badge,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  badge?: number;
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
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="ml-auto bg-red-600 text-white rounded-full px-2 py-0.5 text-xs font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

// View Reports Section Component

export default function BWMCdashboard() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statsVisible, setStatsVisible] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<User[]>([]);
  const [approvedAccounts, setApprovedAccounts] = useState<User[]>([]);
  const [rejectedAccounts, setRejectedAccounts] = useState<User[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingProcessed, setLoadingProcessed] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rejectAccountModalOpen, setRejectAccountModalOpen] = useState(false);
  const [rejectAccountReason, setRejectAccountReason] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // BWMC user with barangay
  const [currentUser, setCurrentUser] = useState<UserWithBarangay | null>(null);

  const [sortOption, setSortOption] = useState<
    "latest" | "oldest" | "status" | "ongoing" | "needs" | "resolved"
  >("latest");

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "viewReports"
    | "schedules"
    | "pendingAccounts"
    | "processedAccounts"
    | "reports"
    | "generateReports"
    | "manageAccount"
  >("dashboard");

  // Manage Account form and states
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

  // ---------- LOAD CURRENT BWMC USER WITH BARANGAY ----------
  useEffect(() => {
    async function fetchCurrentUserForBarangay() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select(
          `
        user_id,
        username,
        first_name,
        last_name,
        email,
        contact_number,
        role,
        status,
        barangay:barangay_id (
          barangay_id,
          barangay_name
        )
      `,
        )
        .eq("user_id", session.user.id)
        .single<UserWithBarangay>(); // <-- generic here

      if (error || !data) return;

      setCurrentUser(data); // <-- no cast needed
    }

    fetchCurrentUserForBarangay();
  }, []);

  // ---------------------------------------------------------

  // Cogon (or whatever barangay the BWMC is) will appear here
  const defaultBarangayId = currentUser?.barangay?.barangay_id ?? null;

  // Fetch pending resident requests
  const fetchPendingRequests = useCallback(async () => {
    if (!currentUser?.barangay?.barangay_id) return;

    setLoadingPending(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "Resident")
      .eq("status", "pending")
      .eq("barangay_id", currentUser.barangay.barangay_id); // filter by barangay

    if (!error) setPendingRequests(data || []);
    setLoadingPending(false);
  }, [currentUser?.barangay?.barangay_id]);

  // Fetch processed accounts separated by approved and rejected
  const fetchProcessedAccounts = useCallback(async () => {
    if (!currentUser?.barangay?.barangay_id) return;

    setLoadingProcessed(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "Resident")
      .eq("barangay_id", currentUser.barangay.barangay_id) // filter by barangay
      .in("status", ["approved", "rejected"]);

    if (!error && data) {
      setApprovedAccounts(data.filter((u) => u.status === "approved"));
      setRejectedAccounts(data.filter((u) => u.status === "rejected"));
    }
    setLoadingProcessed(false);
  }, [currentUser?.barangay?.barangay_id]);

  // Fetch all users for dashboard context
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorUsers(null);
    try {
      const { data, error } = await supabase.from("users").select("*");
      if (error) throw error;
      setUsers(data as User[]);
    } catch (error) {
      setErrorUsers((error as Error).message);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (currentUser?.barangay?.barangay_id) {
      fetchPendingRequests();
      fetchProcessedAccounts();
    }
  }, [
    currentUser?.barangay?.barangay_id,
    fetchPendingRequests,
    fetchProcessedAccounts,
  ]);

  // Approve or Reject handler
  const handleApproveReject = async (
    userId: string,
    newStatus: "approved" | "rejected",
    reason?: string,
  ) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({
          status: newStatus,
          reject_reason: newStatus === "rejected" ? reason || null : null,
        })
        .eq("user_id", userId);

      if (error) {
        alert(`Failed to update account: ${error.message}`);
        return;
      }

      setPendingRequests((prev) => prev.filter((u) => u.user_id !== userId));

      const { data: updatedUser } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!updatedUser) return;

      if (newStatus === "approved") {
        setApprovedAccounts((prev) => [...prev, updatedUser as User]);
      } else {
        setRejectedAccounts((prev) => [...prev, updatedUser as User]);
      }

      // Send notification to resident
      if (updatedUser.contact_number) {
        await fetch("/api/notifications/registration-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            status: newStatus,
            reason: newStatus === "rejected" ? reason : undefined,
          }),
        });
      }
    } catch (err) {
      console.error(err);
      alert("Unexpected error while updating account.");
    }
  };

  // Manage Account logic
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

  const handleLogout = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to logout?")
    ) {
      localStorage.removeItem("authToken");
      router.push("/");
    }
  };

  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setManageAccountForm({
      ...manageAccountForm,
      [e.target.name]: e.target.value,
    });
  };

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
      return "Contact number must be 11 digits.";
    }
    return null;
  };

  const handleManageAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const confirmed = window.confirm(
      "Are you sure you want to update your account details?",
    );
    if (!confirmed) return;

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
      fetchUsers();
    } catch (err) {
      setManageAccountError(`Unexpected error: ${(err as Error).message}`);
    }
  };

  type Schedule = {
    schedule_id: string;
    days: string;
    start_time: string | null;
    end_time: string | null;
    status: string | null;
    barangay?: {
      barangay_id: number;
      barangay_name: string;
    } | null;
  };

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

    const patternDates = generatePatternDates(schedule.days, year, month);

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
      <div className="my-1">
        <div className="mb-2 mt-2 flex justify-center">
          <span className="font-semibold text-xl">
            {format(new Date(year, month), "LLLL yyyy")}
          </span>
        </div>
        <div className="mt-6 flex flex-row gap-6 justify-center max-w-[450px] mx-auto">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-green-600 border border-green-600"></div>
            <span className="text-white text-sm">Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-red-100 border border-red-400"></div>
            <span className="text-white text-sm">Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-white border border-green-300"></div>
            <span className="text-white text-sm">No schedule</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-gray-50 border border-gray-100"></div>
            <span className="text-white text-sm">Other month</span>
          </div>
        </div>

        <br />

        <div className="calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="calendar-weekday">
              {d}
            </div>
          ))}
          {weeks.map((weekDays, weekIdx) =>
            weekDays.map((day, dayIdx) => {
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
                "calendar-day h-10 w-10 flex flex-col items-center justify-center text-lg rounded border transition";
              if (!isCurrentMonth) {
                cellClass += " bg-gray-50 text-gray-300 border-gray-400";
              } else if (isToday) {
                cellClass +=
                  " bg-red-200 text-red-700 font-bold border-red-400";
              } else if (isScheduled) {
                cellClass +=
                  " bg-green-600 text-black font-bold border-green-600";
              } else {
                cellClass += " bg-white border-green-300 text-black font-bold";
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

  function BWMCCollectionSchedulesFeature({
    defaultBarangayId,
  }: {
    defaultBarangayId: number | string | null;
  }) {
    const [barangays, setBarangays] = useState<
      { barangay_id: number | string; barangay_name: string }[]
    >([]);
    const [selectedBarangayId, setSelectedBarangayId] = useState<string>(
      defaultBarangayId ? String(defaultBarangayId) : "",
    );
    const [schedules, setSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // keep in sync with BWMC barangay
    useEffect(() => {
      if (defaultBarangayId) {
        setSelectedBarangayId(String(defaultBarangayId));
      }
    }, [defaultBarangayId]);

    // load barangays
    useEffect(() => {
      async function fetchBarangays() {
        try {
          const { data, error } = await supabase
            .from("barangay")
            .select("barangay_id, barangay_name")
            .order("barangay_name", { ascending: true });

          if (error) throw error;
          const list = data || [];
          setBarangays(list);

          // only fallback to first barangay if we truly have no default
          if (!defaultBarangayId && !selectedBarangayId && list.length > 0) {
            setSelectedBarangayId(String(list[0].barangay_id));
          }
        } catch (err: any) {
          setError(err.message || "Failed to load barangays.");
        }
      }
      fetchBarangays();
      // include selectedBarangayId so fallback only runs when still empty
    }, [defaultBarangayId, selectedBarangayId]);

    // load schedules
    useEffect(() => {
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
            .order("date_created", { ascending: false });

          if (error) throw error;
          setSchedules(data || []);
        } catch (err: any) {
          setError(err.message || "Failed to load schedules.");
        } finally {
          setLoading(false);
        }
      }
      fetchSchedules();
    }, []);

    const orderedSchedules = [...schedules].sort((a, b) => {
      const aIsBarangay = !!a.barangay?.barangay_id;
      const bIsBarangay = !!b.barangay?.barangay_id;
      if (aIsBarangay === bIsBarangay) return 0;
      return aIsBarangay ? -1 : 1;
    });

    const activeSchedule = orderedSchedules.find(
      (s) => String(s.barangay?.barangay_id) === String(selectedBarangayId),
    );

    return (
      <section className="w-full max-w-5xl mx-auto mt-6 md:mt-10 rounded-3xl border border-emerald-800/60 bg-slate-900/90 shadow-2xl shadow-emerald-900/40 px-4 py-5 md:p-8 backdrop-blur-xl space-y-5">
        {/* Top row: text + select */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <p className="text-xs md:text-sm text-slate-300">
            View barangay collection schedules assigned to GCPs.
          </p>

          <div className="w-full md:w-64">
            <label
              htmlFor="bwmc-barangay-select"
              className="block text-[11px] font-semibold uppercase tracking-wide text-emerald-300 mb-1"
            >
              Barangay
            </label>
            <select
              id="bwmc-barangay-select"
              value={selectedBarangayId}
              onChange={(e) => setSelectedBarangayId(e.target.value)}
              className="block w-full rounded-lg bg-slate-900/80 border border-emerald-700/60 px-3 py-2 text-sm text-slate-100
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                     appearance-none"
            >
              {barangays.map((b) => (
                <option key={b.barangay_id} value={b.barangay_id}>
                  {b.barangay_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-emerald-800/60 bg-slate-900/80 p-6 flex justify-center">
            <TruckLoader />
          </div>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-red-700/70 bg-red-900/40 p-4 text-xs md:text-sm text-red-100">
            Error: {error}
          </div>
        ) : activeSchedule ? (
          <div className="mt-2 space-y-4">
            {/* Schedule header + calendar */}
            <div className="rounded-2xl border border-emerald-800/60 bg-slate-900/80 p-4 md:p-5 shadow-lg shadow-emerald-900/40">
              <h3 className="font-semibold text-base md:text-lg text-emerald-300 mb-1">
                Barangay:{" "}
                <span className="text-slate-100">
                  {activeSchedule.barangay?.barangay_name || "N/A"}
                </span>
              </h3>
              <p className="text-xs md:text-sm text-slate-300">
                Days:{" "}
                <span className="font-medium text-emerald-200">
                  {activeSchedule.days || "N/A"}
                </span>
              </p>
              <p className="text-xs md:text-sm text-slate-300 mt-1">
                Assigned GCP:{" "}
                <span className="font-medium text-slate-100">
                  {activeSchedule.gcp_user
                    ? `${activeSchedule.gcp_user.first_name} ${activeSchedule.gcp_user.last_name}`
                    : "None"}
                </span>
              </p>

              <div className="mt-4 rounded-xl border border-emerald-800/60 bg-slate-900/80 p-2 md:p-3">
                {/* Allow horizontal scroll for the calendar on very small screens */}
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[280px]">
                    <ScheduleCalendar schedule={activeSchedule} />
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming collections list */}
            {Array.isArray(activeSchedule.collection_details) &&
            activeSchedule.collection_details.length > 0 ? (
              <div className="rounded-2xl border border-emerald-800/60 bg-slate-900/80 p-4 md:p-5 shadow-lg shadow-emerald-900/40">
                <h4 className="text-xs md:text-sm font-semibold text-emerald-300 mb-3">
                  Upcoming Collections
                </h4>
                <ul className="space-y-3 text-xs md:text-sm text-slate-200">
                  {activeSchedule.collection_details.map((detail: any) => (
                    <li
                      key={detail.collectiondetails_id}
                      className="border border-slate-700/70 rounded-xl px-3 py-2 bg-slate-900/80 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div>
                          <span className="font-semibold text-slate-100">
                            Truck:
                          </span>{" "}
                          {detail.truck?.plate_number ||
                            detail.truck?.truck_code ||
                            "N/A"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-100">
                            Collection Date:
                          </span>{" "}
                          {detail.collection_date
                            ? new Date(
                                detail.collection_date,
                              ).toLocaleDateString()
                            : "N/A"}
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        <span className="font-semibold text-slate-100">
                          Status:
                        </span>{" "}
                        {detail.status || "N/A"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs md:text-sm text-slate-400">
                No collection details for this barangay.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs md:text-sm text-slate-400">
            No schedule found for this barangay.
          </p>
        )}
      </section>
    );
  }

  function ViewReportsSection() {
    const [reports, setReports] = useState<any[]>([]);
    const [barangayName, setBarangayName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [descModalOpen, setDescModalOpen] = useState(false);
    const [descText, setDescText] = useState("");

    const [selectedReport, setSelectedReport] = useState<any | null>(null);
    const [responseType, setResponseType] = useState<
      "NEED_ACTION" | "ONGOING" | null
    >(null);
    const [responseRemarks, setResponseRemarks] = useState("");

    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectRemarks, setRejectRemarks] = useState("");

    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [actionRemarks, setActionRemarks] = useState("");

    const [viewRemarkModalOpen, setViewRemarkModalOpen] = useState(false);
    const [viewRemarkText, setViewRemarkText] = useState("");
    const [viewRemarkTitle, setViewRemarkTitle] = useState("Remarks");
    const [selectedDescReport, setSelectedDescReport] = useState<
      (typeof reports)[0] | null
    >(null);

    useEffect(() => {
      const fetchReports = async () => {
        setLoading(true);
        setError("");

        const { data: authUser } = await supabase.auth.getUser();
        if (!authUser?.user) {
          setError("User not authenticated.");
          setLoading(false);
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("barangay_id")
          .eq("user_id", authUser.user.id)
          .single();

        if (userError || !userData?.barangay_id) {
          setError("Cannot determine user barangay.");
          setLoading(false);
          return;
        }

        const { data: barangayData } = await supabase
          .from("barangay")
          .select("barangay_name")
          .eq("barangay_id", userData.barangay_id)
          .single();

        if (barangayData?.barangay_name) {
          setBarangayName(barangayData.barangay_name);
        }

        const { data, error: reportError } = await supabase
          .from("community_reports")
          .select("*")
          .eq("barangay_id", userData.barangay_id)
          .order("date_submitted", { ascending: false });

        if (!reportError && data) {
          const withLocalRemarks = data.map((r: any) => ({
            ...r,
            latest_remarks: r.latest_remarks ?? null,
          }));
          setReports(withLocalRemarks);
        }

        setLoading(false);
      };

      fetchReports();
    }, []);

    const getCurrentUserId = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return null;
      return data.user.id;
    };

    const handleOpenResponse = (report: any) => {
      setSelectedReport(report);
      setResponseType(null);
      setResponseRemarks("");
      setRejectModalOpen(false);
      setActionModalOpen(false);
    };

    const handleSubmitResponse = async () => {
      if (!selectedReport || !responseType) return;

      // responseType must match what you set in the radios, e.g. "NEED_ACTION" | "ONGOING"
      const newStatus =
        responseType === "NEED_ACTION" ? "Needs Action" : "Ongoing";

      const userId = await getCurrentUserId();
      if (!userId) {
        alert("User not authenticated.");
        return;
      }

      const { error: updateError } = await supabase
        .from("community_reports")
        .update({ current_status: newStatus })
        .eq("report_id", selectedReport.report_id);

      const { error: historyError } = await supabase
        .from("report_status_history")
        .insert({
          report_id: selectedReport.report_id,
          updated_by: userId,
          status: newStatus,
          remarks: responseRemarks,
          timestamp: new Date().toISOString(),
        });

      if (updateError || historyError) {
        alert(
          `Update error (response): ${
            updateError?.message || historyError?.message || "Unknown error"
          }`,
        );
        return;
      }

      // --- SMS to the resident who reported ---
      // make sure selectedReport has userid / user_id of the reporter in your query
      const { data: reporter, error: reporterError } = await supabase
        .from("users")
        .select("contact_number")
        .eq("user_id", selectedReport.user_id) // or selectedReport.userid depending on your column
        .single();

      if (!reporterError && reporter?.contact_number) {
        const msg = `Your report for ${selectedReport.location} is now ${newStatus}.`;

        await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: reporter.contact_number,
            message: msg,
          }),
        });
      }

      if (newStatus === "Needs Action") {
        const { data: secretaries, error: secretaryError } = await supabase
          .from("users")
          .select("user_id, contact_number")
          .eq("role", "Secretary")
          .not("contact_number", "is", null);

        if (!secretaryError && secretaries?.length) {
          const secretaryMessage = `Incident report #${selectedReport.report_id} requires your action. Location: ${selectedReport.location}. ${responseRemarks ? `\n\nRemarks: ${responseRemarks}. ` : ""}\n\nTrack the Truck`;

          await Promise.all(
            secretaries.map((secretary) =>
              fetch("/api/send-sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: secretary.contact_number,
                  message: secretaryMessage,
                  userId: secretary.user_id,
                  notificationType: "incident_needs_action",
                }),
              }),
            ),
          );
        }
      }

      setReports((prev) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? {
                ...r,
                current_status: newStatus,
                latest_remarks: responseRemarks,
              }
            : r,
        ),
      );

      setSelectedReport(null);
      setResponseType(null);
      setResponseRemarks("");
    };

    const handleOpenReject = (report: any) => {
      setSelectedReport(report);
      setRejectRemarks("");
      setRejectModalOpen(true);
      setActionModalOpen(false);
    };

    const handleSubmitReject = async () => {
      if (!selectedReport) return;

      const userId = await getCurrentUserId();
      if (!userId) {
        alert("User not authenticated.");
        return;
      }

      const newStatus = "Rejected";

      const { error: updateError } = await supabase
        .from("community_reports")
        .update({ current_status: newStatus })
        .eq("report_id", selectedReport.report_id);

      const { error: historyError } = await supabase
        .from("report_status_history")
        .insert({
          report_id: selectedReport.report_id,
          updated_by: userId,
          status: newStatus,
          remarks: rejectRemarks,
          timestamp: new Date().toISOString(),
        });

      if (updateError || historyError) {
        alert(
          `Update error (reject): ${
            updateError?.message || historyError?.message || "Unknown error"
          }`,
        );
        return;
      }

      // Notify resident via SMS with BWMC remarks
      if (selectedReport.user_id) {
        try {
          await fetch("/api/notifications/incident-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reportId: selectedReport.report_id,
              userId: selectedReport.user_id,
              status: "rejected",
              reason: rejectRemarks || undefined,
            }),
          });
        } catch (notifyError) {
          console.error(
            "Failed to notify resident about rejection",
            notifyError,
          );
        }
      }

      setReports((prev: any[]) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? { ...r, current_status: newStatus, latest_remarks: rejectRemarks }
            : r,
        ),
      );

      setSelectedReport(null);
      setRejectModalOpen(false);
      setRejectRemarks("");
    };

    const handleOpenActionReport = (report: any) => {
      setSelectedReport(report);
      setActionRemarks("");
      setActionModalOpen(true);
      setRejectModalOpen(false);
    };

    const handleSubmitActionReport = async () => {
      if (!selectedReport) return;

      const userId = await getCurrentUserId();
      if (!userId) {
        alert("User not authenticated.");
        return;
      }

      const newStatus = "Resolved";

      const { error: updateError } = await supabase
        .from("community_reports")
        .update({ current_status: newStatus })
        .eq("report_id", selectedReport.report_id);

      const { error: historyError } = await supabase
        .from("report_status_history")
        .insert({
          report_id: selectedReport.report_id,
          updated_by: userId,
          status: newStatus,
          remarks: actionRemarks,
          timestamp: new Date().toISOString(),
        });

      if (updateError || historyError) {
        alert(
          `Update error (action): ${
            updateError?.message || historyError?.message || "Unknown error"
          }`,
        );
        return;
      }

      setReports((prev: any[]) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? { ...r, current_status: newStatus, latest_remarks: actionRemarks }
            : r,
        ),
      );

      setSelectedReport(null);
      setActionModalOpen(false);
      setActionRemarks("");
    };

    const sortedReports = useMemo(() => {
      let filtered = [...reports];

      if (sortOption === "ongoing") {
        filtered = reports.filter((r) => r.current_status === "Ongoing");
      } else if (sortOption === "needs") {
        filtered = reports.filter((r) => r.current_status === "Needs Action");
      } else if (sortOption === "resolved") {
        filtered = reports.filter((r) => r.current_status === "Resolved");
      }

      if (
        sortOption === "latest" ||
        sortOption === "ongoing" ||
        sortOption === "needs" ||
        sortOption === "resolved"
      ) {
        return filtered.sort(
          (a, b) =>
            new Date(b.date_submitted).getTime() -
            new Date(a.date_submitted).getTime(),
        );
      }

      if (sortOption === "oldest") {
        return filtered.sort(
          (a, b) =>
            new Date(a.date_submitted).getTime() -
            new Date(b.date_submitted).getTime(),
        );
      }

      if (sortOption === "status") {
        const order: Record<string, number> = {
          "Needs Action": 1,
          Ongoing: 2,
          Resolved: 3,
          Rejected: 4,
          Submitted: 5,
        };

        return filtered.sort((a, b) => {
          const aRank = order[a.current_status] ?? 99;
          const bRank = order[b.current_status] ?? 99;
          if (aRank !== bRank) return aRank - bRank;
          return (
            new Date(b.date_submitted).getTime() -
            new Date(a.date_submitted).getTime()
          );
        });
      }

      return filtered;
    }, [reports, sortOption]);

    if (loading) {
      return (
        <section>
          <TruckLoader />
        </section>
      );
    }

    if (error) return <div className="text-red-700">{error}</div>;

    return (
      <section className="max-w-6xl mx-auto mt-10 space-y-5">
        {/* Header + stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent drop-shadow-2xl">
              Incident Reports ({barangayName || "Your Barangay"})
            </h2>
            <p className="text-base md:text-lg text-slate-300">
              Monitor reported incidents and coordinate actions with BWMC and
              SWMO.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-2xl bg-slate-800/80 text-slate-200 border border-emerald-700/50 shadow-md backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="font-medium">Total:</span>
              <span className="font-bold text-base text-emerald-300">
                {reports.length}
              </span>
            </span>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-2xl bg-slate-800/80 text-blue-200 border border-blue-700/60 shadow-md backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              <span className="font-medium">Ongoing:</span>
              <span className="font-bold text-base text-blue-300">
                {reports.filter((r) => r.current_status === "Ongoing").length}
              </span>
            </span>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-2xl bg-slate-800/80 text-amber-200 border border-amber-700/60 shadow-md backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              <span className="font-medium">Needs action:</span>
              <span className="font-bold text-base text-amber-300">
                {
                  reports.filter((r) => r.current_status === "Needs Action")
                    .length
                }
              </span>
            </span>

            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-2xl bg-slate-800/80 text-emerald-200 border border-emerald-700/60 shadow-md backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="font-medium">Resolved:</span>
              <span className="font-bold text-base text-emerald-300">
                {reports.filter((r) => r.current_status === "Resolved").length}
              </span>
            </span>
          </div>
        </div>

        {/* List wrapper */}
        <div className="space-y-4">
          {/* Filter and Sort Bar */}
          <div className="flex items-center justify-between px-5 py-3 rounded-2xl bg-gradient-to-r from-slate-800/80 to-slate-800/50 border border-emerald-800/30 backdrop-blur-xl">
            <span className="text-sm font-semibold text-slate-300">
              Sort by:
            </span>

            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900/60 border border-emerald-600/40 px-3 py-1.5 shadow-sm">
              <span className="text-emerald-400 text-sm">⇅</span>
              <select
                value={sortOption}
                onChange={(e) =>
                  setSortOption(
                    e.target.value as
                      | "latest"
                      | "oldest"
                      | "status"
                      | "ongoing"
                      | "needs"
                      | "resolved",
                  )
                }
                className="text-xs bg-transparent border-none text-slate-100 focus:outline-none focus:ring-0 cursor-pointer"
              >
                <option className="bg-slate-900" value="latest">
                  Most recent
                </option>
                <option className="bg-slate-900" value="oldest">
                  Oldest first
                </option>
                <option className="bg-slate-900" value="status">
                  Status (grouped)
                </option>
                <option className="bg-slate-900" value="ongoing">
                  Ongoing only
                </option>
                <option className="bg-slate-900" value="needs">
                  Needs action only
                </option>
                <option className="bg-slate-900" value="resolved">
                  Resolved only
                </option>
              </select>
            </div>
          </div>

          {sortedReports.length === 0 ? (
            <div className="relative px-6 py-12 text-center rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-slate-700/50">
              <p className="text-slate-400 text-sm">
                📭 No reports found for this barangay.
              </p>
            </div>
          ) : (
            <div className="grid gap-2.5">
              {sortedReports.map((report) => {
                const statusConfig = {
                  "Needs Action": {
                    bg: "bg-amber-500/10",
                    border: "border-amber-500/40",
                    text: "text-amber-300",
                    badgeBg: "bg-amber-500/20",
                    icon: "⚠️",
                  },
                  Ongoing: {
                    bg: "bg-blue-500/10",
                    border: "border-blue-500/40",
                    text: "text-blue-300",
                    badgeBg: "bg-blue-500/20",
                    icon: "🔄",
                  },
                  Rejected: {
                    bg: "bg-red-500/10",
                    border: "border-red-500/40",
                    text: "text-red-300",
                    badgeBg: "bg-red-500/20",
                    icon: "❌",
                  },
                  Resolved: {
                    bg: "bg-emerald-500/10",
                    border: "border-emerald-500/40",
                    text: "text-emerald-300",
                    badgeBg: "bg-emerald-500/20",
                    icon: "✅",
                  },
                  Submitted: {
                    bg: "bg-slate-800/50",
                    border: "border-slate-700/50",
                    text: "text-slate-300",
                    badgeBg: "bg-slate-700/40",
                    icon: "📋",
                  },
                };

                const config =
                  statusConfig[
                    report.current_status as keyof typeof statusConfig
                  ] || statusConfig.Submitted;

                return (
                  <div
                    key={report.report_id}
                    className={`group relative rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-md ${config.bg} ${config.border} backdrop-blur-xl`}
                  >
                    <div className="relative p-3">
                      {/* Header Row: Location, Date, Status */}
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-50 truncate">
                            {report.location}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(report.date_submitted).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-md text-[10px] font-semibold flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${config.text} ${config.badgeBg}`}
                        >
                          <span className="text-xs">{config.icon}</span>
                          <span>{report.current_status || "Submitted"}</span>
                        </span>
                      </div>

                      {/* Content Row: Landmark & Description */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                        <div className="px-2 py-1.5 rounded-md bg-slate-900/30 border border-slate-700/40">
                          <span className="text-[10px] text-slate-400">
                            📍{" "}
                          </span>
                          <span className="text-[10px] font-medium text-slate-200">
                            {report.landmark || (
                              <span className="text-slate-500 italic">
                                No landmark
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="px-2 py-1.5 rounded-md bg-slate-900/20 border border-slate-700/30">
                          <p className="text-[10px] text-slate-300 line-clamp-1">
                            {report.description || "No description"}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons - Compact Row */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            console.log("REPORT CLICKED:", report);
                            setSelectedDescReport(report);
                            setDescText(report.description);
                            setDescModalOpen(true);
                          }}
                          className="px-2 py-1 rounded-md text-[15px] font-medium bg-slate-700/40 hover:bg-slate-700/60 text-slate-200 border border-slate-600/30 transition-all duration-150"
                        >
                          View
                        </button>

                        {report.current_status === "Needs Action" ||
                        report.current_status === "Ongoing" ||
                        report.current_status === "Rejected" ||
                        report.current_status === "Resolved" ? (
                          <button
                            onClick={() => {
                              setViewRemarkTitle(
                                report.current_status === "Rejected"
                                  ? "Reject Remark"
                                  : "Response Remark",
                              );
                              setViewRemarkText(
                                report.latest_remarks || "No remarks provided.",
                              );
                              setViewRemarkModalOpen(true);
                            }}
                            className="px-2 py-1 text-[15px] font-medium rounded-md bg-blue-600/70 hover:bg-blue-600/80 text-slate-50 border border-blue-500/40 transition-all duration-150"
                          >
                            📝 Remark
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleOpenResponse(report)}
                              className="px-2 py-1 text-[15px] font-medium rounded-md bg-emerald-600/70 hover:bg-emerald-600/80 text-slate-50 border border-emerald-500/40 transition-all duration-150"
                            >
                              Response
                            </button>
                            <button
                              onClick={() => handleOpenReject(report)}
                              className="px-2 py-1 text-[15px] font-medium rounded-md bg-red-600/70 hover:bg-red-600/80 text-slate-50 border border-red-500/40 transition-all duration-150"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Description modal */}
        {descModalOpen && selectedDescReport && (
          <div
            className="pt-10 fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setDescModalOpen(false);
              setSelectedDescReport(null);
            }}
            onKeyDown={(e) =>
              e.key === "Escape" &&
              (setDescModalOpen(false), setSelectedDescReport(null))
            }
            tabIndex={-1}
            role="presentation"
          >
            <div
              className="relative w-full max-w-lg rounded-2xl bg-slate-900/95 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)] border border-slate-700/80 transform transition-all duration-150"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="desc-modal-title"
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-3 border-b border-slate-700/80">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-600/10 text-emerald-300 border border-emerald-700/30">
                    📷
                  </span>
                  <h3
                    id="desc-modal-title"
                    className="ml-1 text-sm font-semibold tracking-wide text-slate-200"
                  >
                    Report Description
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setDescModalOpen(false);
                    setSelectedDescReport(null);
                  }}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  aria-label="Close description dialog"
                >
                  ✕
                </button>
              </div>

              {/* Content area */}
              <div className="p-6 space-y-4">
                {/* Photo container */}
                <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-3 flex items-center justify-center min-h-[160px]">
                  {selectedDescReport?.photo_path ? (
                    <img
                      src={selectedDescReport.photo_path}
                      alt="Incident photo"
                      className="max-h-72 max-w-full rounded-lg object-contain shadow-lg shadow-slate-900/70"
                    />
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      No photo was attached to this report.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80">
                    DETAILS
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Detailed information provided by the resident.
                  </p>
                </div>

                <div className="h-px w-full bg-slate-700/70" />

                {/* Scrollable text */}
                <div className="max-h-60 overflow-y-auto pr-1 custom-scroll rounded-lg bg-slate-900/80 border border-slate-700/70 px-3 py-2">
                  <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">
                    {descText}
                  </p>
                </div>

                {/* Footer / status bar */}
                <div className="flex items-center justify-between text-[11px] text-slate-400"></div>
              </div>
            </div>
          </div>
        )}

        {/* Response modal */}
        {selectedReport && !rejectModalOpen && !actionModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedReport(null)}
            onKeyDown={(e) => e.key === "Escape" && setSelectedReport(null)}
            tabIndex={-1}
            role="presentation"
          >
            <div
              className="relative w-full max-w-lg text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-2xl border border-slate-700/80 bg-slate-900/95 transform transition-all duration-150"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="response-dialog-title"
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-3 border-b border-slate-700/80">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-600/10 text-emerald-300 border border-emerald-700/30">
                    🛠️
                  </span>
                  <h3
                    id="response-dialog-title"
                    className="ml-1 text-sm font-semibold tracking-wide text-slate-200"
                  >
                    Response • {selectedReport.location}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  aria-label="Close response dialog"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-1">
                  ACTION
                </p>
                <p className="text-sm mb-3 text-slate-200">
                  Choose how this incident will be handled.
                </p>

                {/* Options */}
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border ${
                      responseType === "NEED_ACTION"
                        ? "bg-amber-900/10 border-amber-500/60 ring-1 ring-amber-400/20"
                        : "bg-slate-800/60 border-slate-700/70 hover:bg-slate-800/70"
                    }`}
                  >
                    <input
                      className="mt-1 text-emerald-500 focus:ring-emerald-500"
                      type="radio"
                      name="responseType"
                      value="NEED_ACTION"
                      checked={responseType === "NEED_ACTION"}
                      onChange={() => setResponseType("NEED_ACTION")}
                    />
                    <div>
                      <div className="font-semibold text-slate-100">
                        Need action by SWMO
                      </div>
                      <div className="text-xs text-slate-400">
                        Escalate this report to SWMO for direct intervention.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border ${
                      responseType === "ONGOING"
                        ? "bg-sky-900/10 border-sky-500/60 ring-1 ring-sky-400/20"
                        : "bg-slate-800/60 border-slate-700/70 hover:bg-slate-800/70"
                    }`}
                  >
                    <input
                      className="mt-1 text-emerald-500 focus:ring-emerald-500"
                      type="radio"
                      name="responseType"
                      value="ONGOING"
                      checked={responseType === "ONGOING"}
                      onChange={() => setResponseType("ONGOING")}
                    />
                    <div>
                      <div className="font-semibold text-slate-100">
                        BWMC can resolve (Ongoing)
                      </div>
                      <div className="text-xs text-slate-400">
                        Mark as in-progress under your barangay's handling.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Remarks */}
                <label className="block text-sm font-semibold mb-1 text-slate-200">
                  Remarks
                </label>
                <textarea
                  className="w-full border border-slate-700 rounded-xl px-2.5 py-2 text-sm mb-4 text-slate-100 bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  rows={3}
                  value={responseRemarks}
                  onChange={(e) => setResponseRemarks(e.target.value)}
                  placeholder="Add details about your response..."
                  required
                />

                {/* Footer / buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 text-slate-200 bg-slate-900/60 hover:bg-slate-800/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitResponse}
                    disabled={!responseType}
                    aria-disabled={!responseType}
                    className={`px-4 py-1.5 text-sm rounded-lg text-slate-50 border shadow-sm transition-colors ${
                      responseType
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-500/80 shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500"
                        : "bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed opacity-60"
                    }`}
                  >
                    Submit response
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject modal */}
        {rejectModalOpen && selectedReport && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setRejectModalOpen(false);
              setSelectedReport(null);
            }}
            onKeyDown={(e) =>
              e.key === "Escape" &&
              (setRejectModalOpen(false), setSelectedReport(null))
            }
            tabIndex={-1}
            role="presentation"
          >
            <div
              className="relative w-full max-w-lg text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-2xl border border-red-700/80 bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-dialog-title"
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-3 border-b border-red-700/70">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-red-600/10 text-red-300 border border-red-700/30">
                    🚫
                  </span>
                  <h3
                    id="reject-dialog-title"
                    className="ml-1 text-sm font-semibold tracking-wide text-slate-100"
                  >
                    Reject Report • {selectedReport.location}
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setSelectedReport(null);
                  }}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  aria-label="Close reject dialog"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400/80 mb-1">
                  REJECTION REASON
                </p>
                <p className="text-sm mb-3 text-slate-200">
                  Please provide a clear explanation for rejecting this
                  incident.
                </p>

                <textarea
                  className="w-full border border-slate-700 rounded-xl px-2.5 py-2 text-sm mb-4 text-slate-100 bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={3}
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="Reason for rejection..."
                  required
                />

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                  <button
                    onClick={() => {
                      setRejectModalOpen(false);
                      setSelectedReport(null);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 text-slate-200 bg-slate-900/60 hover:bg-slate-800/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitReject}
                    className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-slate-50 border border-red-500/80 shadow-sm shadow-red-700/60 hover:from-red-500 hover:to-rose-500 transition-colors"
                  >
                    Submit rejection
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Report modal */}
        {actionModalOpen && selectedReport && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setActionModalOpen(false);
              setSelectedReport(null);
            }}
          >
            <div
              className="relative w-full max-w-md text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-emerald-700/70 bg-slate-900/95"
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
                    Action Report • {selectedReport.location}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setActionModalOpen(false);
                    setSelectedReport(null);
                  }}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-1">
                  ACTION DETAILS
                </p>
                <p className="text-sm mb-3 text-slate-200">
                  Describe the actions taken by the BWMC to resolve this
                  incident.
                </p>

                <textarea
                  className="w-full border border-slate-700 rounded-xl px-2.5 py-2 text-sm mb-4 text-slate-100 bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  rows={3}
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  placeholder="Details of the action taken..."
                  required
                />

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                  <button
                    onClick={() => {
                      setActionModalOpen(false);
                      setSelectedReport(null);
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 text-slate-200 bg-slate-900/60 hover:bg-slate-800/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitActionReport}
                    className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500 transition-colors"
                  >
                    Submit action
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View remark modal */}
        {viewRemarkModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setViewRemarkModalOpen(false)}
          >
            <div
              className="relative w-full max-w-md text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-emerald-700/70 bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-2 border-b border-emerald-700/70">
                <div className="flex items-center gap-2">
                  <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
                    {viewRemarkTitle}
                  </span>
                </div>

                <button
                  onClick={() => setViewRemarkModalOpen(false)}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-2">
                  REMARK
                </p>

                <div className="max-h-60 overflow-y-auto pr-1 rounded-lg bg-slate-900/80 border border-slate-700/70 px-3 py-2">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {viewRemarkText}
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setViewRemarkModalOpen(false)}
                    className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500 transition-colors"
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
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative">
      {/* Top navigation (same as SWMO, BWMC text) */}
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
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-emerald-600/20 border border-emerald-600/30 text-lg flex-shrink-0">
                🗑️
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold truncate">
                  Track-the-Truck
                </p>
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-100 truncate">
                  BWMC Dashboard
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
              <span className="hidden sm:inline text-xs sm:text-sm">BWMC</span>
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
                      BWMC Officer
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

        {/* Sidebar – same sizing as SWMO, BWMC items */}
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
              { label: "Pending Accounts", icon: "⏳", tab: "pendingAccounts" },
              {
                label: "Processed Accounts",
                icon: "✅",
                tab: "processedAccounts",
              },
              { label: "View Reports", icon: "📈", tab: "viewReports" },
              { label: "Schedules", icon: "📅", tab: "schedules" },
              { label: "Generate Reports", icon: "📊", tab: "generateReports" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveTab(
                    item.tab as
                      | "dashboard"
                      | "pendingAccounts"
                      | "processedAccounts"
                      | "viewReports"
                      | "schedules"
                      | "generateReports"
                      | "manageAccount",
                  );
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                  activeTab === item.tab
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}

            <div className="pt-6 mt-6 border-t border-green-800/40"></div>
          </nav>
        </aside>

        {/* Main content – same paddings, structure as SWMO */}
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
                    <div className="flex items-center justify-between mb-6">
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
                    <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 h-[500px] md:h-[600px] relative z-10">
                      <LeafletMap />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeTab === "pendingAccounts" && (
            <section className="my-8 space-y-4 px-2 md:px-10">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">
                    Pending Resident Accounts
                  </h2>
                  <p className="text-sm md:text-base text-slate-300">
                    Review and approve or reject new resident registrations.
                  </p>
                </div>
              </div>

              {loadingPending ? (
                <div className="rounded-3xl border border-emerald-800/60 bg-slate-900/80 shadow-2xl shadow-emerald-900/40 backdrop-blur-xl p-6">
                  <TruckLoader />
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="mt-4 p-6 rounded-3xl border border-slate-700/80 bg-slate-900/80 text-center text-slate-300 shadow-xl shadow-slate-900/40">
                  No pending accounts.
                </div>
              ) : (
                <div className="rounded-3xl border border-emerald-800/60 bg-slate-900/90 shadow-2xl shadow-emerald-900/40 backdrop-blur-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-emerald-700/60 bg-slate-900/95 flex items-center justify-between">
                    <span className="text-emerald-200 font-semibold text-lg">
                      Pending Accounts
                    </span>
                    <span className="text-sm text-emerald-300">
                      Total {pendingRequests.length}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-emerald-900/80 text-emerald-100">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">
                            Name
                          </th>
                          <th className="px-3 py-2 text-left font-semibold">
                            Email
                          </th>
                          <th className="px-3 py-2 text-left font-semibold">
                            Contact
                          </th>
                          <th className="px-3 py-2 text-left font-semibold">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRequests.map((user, idx) => (
                          <tr
                            key={user.user_id}
                            className={
                              idx % 2 === 0
                                ? "bg-slate-900/80"
                                : "bg-slate-800/80"
                            }
                          >
                            <td className="px-3 py-2 text-slate-100">
                              {user.first_name} {user.last_name}
                            </td>
                            <td className="px-3 py-2 text-slate-200">
                              {user.email}
                            </td>
                            <td className="px-3 py-2 text-slate-200">
                              {user.contact_number}
                            </td>
                            <td className="px-3 py-2 text-slate-100">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    const confirmed = window.confirm(
                                      "Are you sure you want to APPROVE this account?",
                                    );
                                    if (!confirmed) return;
                                    handleApproveReject(
                                      user.user_id,
                                      "approved",
                                    );
                                  }}
                                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 text-xs font-semibold shadow-md shadow-emerald-600/40 hover:from-emerald-500 hover:to-teal-500"
                                >
                                  Approve
                                </button>

                                <button
                                  onClick={() => {
                                    const confirmed = window.confirm(
                                      "Are you sure you want to REJECT this account?",
                                    );
                                    if (!confirmed) return;
                                    setSelectedUserId(user.user_id);
                                    setRejectAccountReason("");
                                    setRejectAccountModalOpen(true);
                                  }}
                                  className="px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-slate-50 text-xs font-semibold shadow-md shadow-red-600/40 hover:from-red-500 hover:to-rose-500"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {rejectAccountModalOpen && selectedUserId && (
                <div
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center"
                  onClick={() => setRejectAccountModalOpen(false)}
                >
                  <div
                    className="relative max-w-md w-full text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-red-700/80 bg-slate-900/95"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Title bar */}
                    <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-2 border-b border-red-700/70">
                      <div className="flex items-center gap-2">
                        <span className="flex gap-1">
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500/90 shadow-sm shadow-red-900" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-sm shadow-amber-900" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 shadow-sm shadow-emerald-900" />
                        </span>
                        <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
                          Reject Resident Account
                        </span>
                      </div>

                      <button
                        onClick={() => setRejectAccountModalOpen(false)}
                        className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                        aria-label="Close"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <p className="text-xs uppercase tracking-[0.18em] text-red-400/80 mb-1">
                        REJECTION REASON
                      </p>
                      <p className="text-sm mb-3 text-slate-200">
                        Please provide a clear explanation for rejecting this
                        resident&apos;s account request.
                      </p>

                      <textarea
                        className="w-full border border-slate-700 rounded-xl px-2.5 py-2 text-sm mb-4 text-slate-100 bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                        rows={3}
                        value={rejectAccountReason}
                        onChange={(e) => setRejectAccountReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        required
                      />

                      {/* Footer */}
                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                        <button
                          onClick={() => setRejectAccountModalOpen(false)}
                          className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 text-slate-200 bg-slate-900/60 hover:bg-slate-800/80 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={async () => {
                            if (!selectedUserId) return;
                            if (!rejectAccountReason.trim()) {
                              alert("Please enter a reason for rejection.");
                              return;
                            }
                            await handleApproveReject(
                              selectedUserId,
                              "rejected",
                              rejectAccountReason.trim(),
                            );
                            setRejectAccountModalOpen(false);
                            setSelectedUserId(null);
                            setRejectAccountReason("");
                          }}
                          className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-slate-50 border border-red-500/80 shadow-sm shadow-red-700/60 hover:from-red-500 hover:to-rose-500 transition-colors"
                        >
                          Submit rejection
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "viewReports" && <ViewReportsSection />}

          {activeTab === "processedAccounts" && (
            <section className="my-6 space-y-4 px-2 md:px-10">
              {/* Header Section */}
              <div className="group relative rounded-2xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-4 sm:p-5 shadow-xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

                <div className="relative z-10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent">
                        Processed Resident Accounts
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Review residents whose registrations have already been
                        approved or rejected.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {loadingProcessed ? (
                <div className="rounded-3xl border border-emerald-800/60 bg-slate-900/80 shadow-2xl shadow-emerald-900/40 backdrop-blur-xl p-8">
                  <TruckLoader />
                </div>
              ) : (
                <>
                  {/* Summary Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="group relative rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 backdrop-blur-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden">
                      <div className="absolute inset-0 bg-emerald-500/10 opacity-0 group-hover:opacity-50 transition-opacity blur-xl" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-slate-300">
                            Total Approved
                          </h3>
                          <span className="text-lg">✅</span>
                        </div>
                        <p className="text-emerald-400 text-2xl font-bold">
                          {approvedAccounts.length}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Active residents
                        </p>
                      </div>
                    </div>

                    <div className="group relative rounded-xl bg-red-500/10 border border-red-500/30 p-4 backdrop-blur-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden">
                      <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-50 transition-opacity blur-xl" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-slate-300">
                            Total Rejected
                          </h3>
                          <span className="text-lg">❌</span>
                        </div>
                        <p className="text-red-400 text-2xl font-bold">
                          {rejectedAccounts.length}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Declined</p>
                      </div>
                    </div>

                    <div className="group relative rounded-xl bg-blue-500/10 border border-blue-500/30 p-4 backdrop-blur-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden">
                      <div className="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-50 transition-opacity blur-xl" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-slate-300">
                            Total Processed
                          </h3>
                          <span className="text-lg">📊</span>
                        </div>
                        <p className="text-blue-400 text-2xl font-bold">
                          {approvedAccounts.length + rejectedAccounts.length}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Applications
                        </p>
                      </div>
                    </div>

                    <div className="group relative rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-4 backdrop-blur-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 overflow-hidden">
                      <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-50 transition-opacity blur-xl" />
                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-slate-300">
                            Approval Rate
                          </h3>
                          <span className="text-lg">📈</span>
                        </div>
                        <p className="text-cyan-400 text-2xl font-bold">
                          {approvedAccounts.length + rejectedAccounts.length > 0
                            ? Math.round(
                                (approvedAccounts.length /
                                  (approvedAccounts.length +
                                    rejectedAccounts.length)) *
                                  100,
                              )
                            : 0}
                          %
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Success rate
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Approved Accounts */}
                    <div className="group relative rounded-2xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 overflow-hidden shadow-xl shadow-emerald-900/30 backdrop-blur-2xl flex flex-col">
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between px-5 py-2 bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border-b border-emerald-800/50 flex-shrink-0">
                          <div>
                            <h3 className="text-base font-bold text-emerald-300">
                              ✅ Approved Accounts
                            </h3>
                            <p className="text-xs text-emerald-200/70">
                              Active registrations
                            </p>
                          </div>
                          <span className="px-3 py-1 rounded-lg bg-emerald-600/30 border border-emerald-500/50 text-emerald-200 font-bold text-xs">
                            {approvedAccounts.length}
                          </span>
                        </div>

                        {approvedAccounts.length === 0 ? (
                          <div className="px-5 py-8 text-center flex-1 flex items-center justify-center">
                            <p className="text-sm text-slate-400">
                              📭 No approved accounts yet.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-y-auto flex-1 max-h-96">
                            <table className="min-w-full text-xs md:text-sm">
                              <thead className="sticky top-0 z-10">
                                <tr className="bg-emerald-900/30 text-emerald-200 border-b border-emerald-800/40">
                                  <th className="px-4 py-2 text-left font-bold text-xs uppercase tracking-wide">
                                    Name
                                  </th>
                                  <th className="px-4 py-2 text-left font-bold text-xs uppercase tracking-wide">
                                    Email
                                  </th>
                                  <th className="px-4 py-2 text-left font-bold text-xs uppercase tracking-wide">
                                    Contact
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-800/30">
                                {approvedAccounts.map((user) => (
                                  <tr
                                    key={user.user_id}
                                    className="bg-slate-900/40 hover:bg-emerald-500/15 transition-colors duration-200 border-b border-emerald-800/20"
                                  >
                                    <td className="px-4 py-2 align-middle">
                                      <span className="font-semibold text-emerald-100">
                                        {user.first_name} {user.last_name}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-300 align-middle">
                                      {user.email}
                                    </td>
                                    <td className="px-4 py-2 text-slate-300 align-middle">
                                      {user.contact_number}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rejected Accounts */}
                    <div className="group relative rounded-2xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-red-800/50 overflow-hidden shadow-xl shadow-red-900/30 backdrop-blur-2xl flex flex-col">
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between px-5 py-2 bg-gradient-to-r from-red-900/40 to-rose-900/40 border-b border-red-800/50 flex-shrink-0">
                          <div>
                            <h3 className="text-base font-bold text-red-300">
                              ❌ Rejected Accounts
                            </h3>
                            <p className="text-xs text-red-200/70">
                              Declined registrations
                            </p>
                          </div>
                          <span className="px-3 py-1 rounded-lg bg-red-600/30 border border-red-500/50 text-red-200 font-bold text-xs">
                            {rejectedAccounts.length}
                          </span>
                        </div>

                        {rejectedAccounts.length === 0 ? (
                          <div className="px-5 py-8 text-center flex-1 flex items-center justify-center">
                            <p className="text-sm text-slate-400">
                              📭 No rejected accounts yet.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-y-auto flex-1 max-h-96">
                            <table className="min-w-full text-xs md:text-sm">
                              <thead className="sticky top-0 z-10">
                                <tr className="bg-red-900/30 text-red-200 border-b border-red-800/40">
                                  <th className="px-4 py-2 text-left font-bold text-xs uppercase tracking-wide">
                                    Name
                                  </th>
                                  <th className="px-4 py-2 text-left font-bold text-xs uppercase tracking-wide">
                                    Email
                                  </th>
                                  <th className="px-4 py-2 text-left font-bold text-xs uppercase tracking-wide">
                                    Contact
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-red-800/30">
                                {rejectedAccounts.map((user) => (
                                  <tr
                                    key={user.user_id}
                                    className="bg-slate-900/40 hover:bg-red-500/15 transition-colors duration-200 border-b border-red-800/20"
                                  >
                                    <td className="px-4 py-2 align-middle">
                                      <span className="font-semibold text-red-100">
                                        {user.first_name} {user.last_name}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-slate-300 align-middle">
                                      {user.email}
                                    </td>
                                    <td className="px-4 py-2 text-slate-300 align-middle">
                                      {user.contact_number}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === "schedules" && (
            <section className="my-6">
              <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent ">
                Collection Schedules
              </h2>
              <BWMCCollectionSchedulesFeature
                defaultBarangayId={defaultBarangayId}
              />
            </section>
          )}

          {activeTab === "generateReports" &&
            currentUser?.barangay?.barangay_id && (
              <BarangayConcernsAnalytics
                barangayId={currentUser.barangay.barangay_id}
              />
            )}

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
        </main>
      </div>
    </div>
  );
}

type ManageAccountSectionProps = {
  form: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    contact_number: string;
    password: string;
    confirm_password: string;
  };
  loading: boolean;
  error: string | null;
  success: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent) => void;
};

function ManageAccountSection(props: ManageAccountSectionProps) {
  const { form, loading, error, success, onChange, onSubmit } = props;

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
      <label
        htmlFor={name}
        className="block mb-1 text-sm font-semibold text-slate-100"
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
        className="w-full px-3 py-2 rounded-lg border border-slate-700
                   bg-slate-900/80 text-slate-100 placeholder:text-slate-400
                   focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        autoComplete="off"
      />
    </div>
  );
}
