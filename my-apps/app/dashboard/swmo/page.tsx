"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
// ...existing code...
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import TruckLoader from "../../loading/TruckLoader";
import ReportsAnalytics from "../../generatereport/generatereport";
import BarangayConcernsAnalytics from "../../generatereport/barangayconcern";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  created_at?: string;
  date_created?: string;
  last_active?: string;
  barangay_id?: string;
}

type SidebarItemProps = {
  label: string;
  icon: string;
  selected?: boolean;
  onClick?: () => void;
  textClassName?: string;
  className?: string;
};

function SidebarItem({
  label,
  icon,
  selected,
  onClick,
  textClassName,
}: SidebarItemProps) {
  return (
    <Button
      variant={selected ? "default" : "ghost"}
      onClick={onClick}
      className={`flex gap-2 items-center w-full justify-start px-4 py-3 mb-2 text-left rounded-lg h-auto
        ${
          selected
            ? "bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold"
            : "text-slate-200 hover:bg-slate-900/60"
        }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span className={textClassName}>{label}</span>
    </Button>
  );
}

// helper to create a random temporary password.  the TA wants the system to
// provide the password and deliver it by SMS, so we generate one on the
// client side before calling Supabase and pass it along to the backend
// notifier.  length and character set can be adjusted as needed.
function generateTempPassword(length = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
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
}): React.JSX.Element {
  return (
    <div className="mb-4 space-y-2">
      <Label htmlFor={name} className="text-xs font-medium text-slate-300">
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
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  required = false,
  options,
  placeholder = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  required?: boolean;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  // Adapt shadcn Select's onValueChange to the expected onChange signature
  const handleValueChange = (newValue: string) => {
    const syntheticEvent = {
      target: {
        name,
        value: newValue,
      },
    } as ChangeEvent<HTMLSelectElement>;
    onChange(syntheticEvent);
  };

  return (
    <div className="mb-4 space-y-2">
      <Label htmlFor={name} className="text-xs font-medium text-slate-300">
        {label}
      </Label>
      <Select
        value={value || ""}
        onValueChange={handleValueChange}
        required={required}
      >
        <SelectTrigger id={name}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function AdminDashboard() {
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  // Sorting state for user list

  // ...existing code...
  const [initials, setInitials] = useState("");
  const router = useRouter();

  // User initials for avatar
  // ...existing code...
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

  // User Table Size and Expansion Controls
  const USER_TABLE_SIZES = [
    { font: "text-xs", row: "py-2" },
    { font: "text-sm", row: "py-2.5" },
    { font: "text-base", row: "py-3" },
    { font: "text-lg", row: "py-4" },
  ];
  const [userTableSizeIdx, setUserTableSizeIdx] = useState(1); // default medium
  const userTableSize = USER_TABLE_SIZES[userTableSizeIdx];
  const [isUserTableExpanded, setIsUserTableExpanded] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [statsVisible, setStatsVisible] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  // ...existing code...
  const [users, setUsers] = useState<User[]>([]);
  // Sorting state for user list
  const [userSortKey, setUserSortKey] = useState<
    "name" | "email" | "role" | "barangay"
  >("name");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc");
  const sortedUsers = React.useMemo(() => {
    const sorted = [...users];
    sorted.sort((a, b) => {
      let aValue = "";
      let bValue = "";
      switch (userSortKey) {
        case "name":
          aValue = `${a.first_name ?? ""} ${a.last_name ?? ""}`.toLowerCase();
          bValue = `${b.first_name ?? ""} ${b.last_name ?? ""}`.toLowerCase();
          break;
        case "email":
          aValue = a.email?.toLowerCase() ?? "";
          bValue = b.email?.toLowerCase() ?? "";
          break;
        case "role":
          aValue = a.role?.toLowerCase() ?? "";
          bValue = b.role?.toLowerCase() ?? "";
          break;
        case "barangay":
          aValue = a.barangay_id?.toString().toLowerCase() ?? "";
          bValue = b.barangay_id?.toString().toLowerCase() ?? "";
          break;
      }
      if (aValue < bValue) return userSortDir === "asc" ? -1 : 1;
      if (aValue > bValue) return userSortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [users, userSortKey, userSortDir]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

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

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "userAdmin"
    | "manageAccount"
    | "reports"
    | "manageUsers"
    | "incidentReports"
  >("dashboard");
  const [tabFadeIn, setTabFadeIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persistedTab = localStorage.getItem("swmo_active_tab");
    if (
      persistedTab === "dashboard" ||
      persistedTab === "userAdmin" ||
      persistedTab === "manageAccount" ||
      persistedTab === "reports" ||
      persistedTab === "manageUsers" ||
      persistedTab === "incidentReports"
    ) {
      setActiveTab(persistedTab);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("swmo_active_tab", activeTab);
    setTabFadeIn(false);
    const visibleTimeout = window.setTimeout(() => setTabFadeIn(true), 30);
    return () => window.clearTimeout(visibleTimeout);
  }, [activeTab]);

  const [hasLoadedManageAccount, setHasLoadedManageAccount] = useState(false);

  const [userForm, setUserForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    role: "",
    // password field is no longer filled by the administrator – we will
    // auto‑generate one when the form is submitted.
    password: "",
    barangay_id: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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

  // Manage Users State
  const [otherUsersList, setOtherUsersList] = useState<User[]>([]);
  const [loadingOtherUsers, setLoadingOtherUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserForm, setEditingUserForm] = useState<any>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [otherUsersError, setOtherUsersError] = useState<string | null>(null);
  const [otherUsersSuccess, setOtherUsersSuccess] = useState<string | null>(
    null,
  );
  const [userAccountsTab, setUserAccountsTab] = useState<
    "All Users" | "Residents" | "Staff" | "Admins"
  >("All Users");
  const [userAccountsSearch, setUserAccountsSearch] = useState("");
  const [userAccountsPage, setUserAccountsPage] = useState(1);
  const [userStatusFilter, setUserStatusFilter] = useState("all");
  const [userBarangayFilter, setUserBarangayFilter] = useState("all");
  const [showUserFilters, setShowUserFilters] = useState(false);

  // Incident Reports State
  const [incidentReports, setIncidentReports] = useState<any[]>([]);
  const [selectedBarangay, setSelectedBarangay] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<string>("All");
  const [reportSearch, setReportSearch] = useState("");
  const [reportPage, setReportPage] = useState(1);
  const [showReportFilters, setShowReportFilters] = useState(false);
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [createReportLoading, setCreateReportLoading] = useState(false);
  const [createReportError, setCreateReportError] = useState<string | null>(
    null,
  );
  const [createReportForm, setCreateReportForm] = useState({
    description: "",
    location: "",
    landmark: "",
    barangay_id: "",
    current_status: "Submitted",
  });
  const [historyModal, setHistoryModal] = useState<{
    title: string;
    entries: { time: string; status: string; remarks: string }[];
    message?: string;
  } | null>(null);

  const [activeReportOption, setActiveReportOption] = useState<
    "wasteCollection" | "barangayConcerns"
  >("wasteCollection");
  // when generating barangay concerns report TA requirement: select barangay first
  const [reportBarangayId, setReportBarangayId] = useState<string>("");
  const [wasteCollectionData, setWasteCollectionData] = useState<
    { month: string; tons: number }[]
  >([]);
  const [performanceData, setPerformanceData] = useState<
    { month: string; efficiency: number }[]
  >([]);
  const [barangayConcerns, setBarangayConcerns] = useState<any[]>([]);
  const [showResponse, setShowResponse] = useState<{
    [reportId: number]: boolean;
  }>({});
  const [responseDetails, setResponseDetails] = useState<{
    [reportId: number]: string;
  }>({});
  const [loadingReportData, setLoadingReportData] = useState(false);
  const [errorReportData, setErrorReportData] = useState<string | null>(null);

  const [barangayOptions, setBarangayOptions] = useState<
    { value: string; label: string }[]
  >([]);

  // Filtered Role Dropdown: disables TCEMO Head and Secretary if already have an account
  const singleAccountRoles = ["TCEMO Head", "Secretary"];
  const allRoles = [
    { value: "TCEMO Head", label: "TCEMO Head" },
    { value: "GCP", label: "GCP" },
    { value: "Secretary", label: "Secretary" },
    { value: "BWMC", label: "BWMC" },
  ];
  const takenSingleRoles = users
    .filter((user) => singleAccountRoles.includes(user.role))
    .map((user) => user.role);

  const filteredRoleOptions = [
    { value: "", label: "Select role..." },

    ...allRoles.filter(
      (role) =>
        !singleAccountRoles.includes(role.value) ||
        !takenSingleRoles.includes(role.value),
    ),
  ];

  const [counts, setCounts] = useState({
    gcps: 0,
    barangays: 0,
    incidentReports: 0,
  });

  useEffect(() => {
    async function fetchCounts() {
      let gcpCount = 0;
      let barangayCount = 0;
      let reportCount = 0;

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
        gcps: gcpCount,
        barangays: barangayCount,
        incidentReports: reportCount,
      });
    }

    fetchCounts();

    const channel = supabase
      .channel("swmo-counts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => fetchCounts(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => fetchCounts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const [dashboardCollectionRows, setDashboardCollectionRows] = useState<
    {
      routeId: string;
      barangay: string;
      schedule: string;
      status: string;
      truck: string;
    }[]
  >([]);
  const [dashboardReportCards, setDashboardReportCards] = useState<
    {
      status: string;
      time: string;
      title: string;
      description: string;
      barangay: string;
    }[]
  >([]);
  const [dashboardMetrics, setDashboardMetrics] = useState({
    todaysCompleted: 0,
    todaysTotal: 0,
    pendingReports: 0,
    delayedCollections: 0,
    missedCollections: 0,
    collectionTrend: "No data from yesterday",
    pendingTrend: "No new reports today",
    delayedTrend: "No delays today",
    missedTrend: "No missed collections today",
  });

  const collectionStatusClasses: Record<string, string> = {
    Ongoing: "bg-orange-100 text-orange-800",
    Scheduled: "bg-blue-100 text-blue-800",
    Delayed: "bg-yellow-100 text-yellow-800",
    Done: "bg-green-100 text-green-800",
  };

  const reportStatusClasses: Record<string, string> = {
    Submitted: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    Validated:
      "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
    Rejected: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    "Under Review": "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    Scheduled: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30",
    "Action Ongoing":
      "bg-orange-500/15 text-orange-300 border border-orange-500/30",
    Resolved: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  };

  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  const formatTimeRange = (start?: string | null, end?: string | null) => {
    const formatTime = (value?: string | null) => {
      if (!value) return "";
      const timeOnly = value.split("T")[1] ?? value;
      const date = new Date(`1970-01-01T${timeOnly}`);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    };

    const startText = formatTime(start);
    const endText = formatTime(end);
    if (!startText && !endText) return "TBD";
    if (startText && endText) return `${startText} - ${endText}`;
    return startText || endText;
  };

  const isStatusMatch = (value: string | null | undefined, target: string) =>
    (value ?? "").toLowerCase() === target.toLowerCase();

  const fetchDashboardData = useCallback(async () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const todayStr = formatDate(today);
    const yesterdayStr = formatDate(yesterday);

    try {
      const { data: collectionData, error: collectionError } = await supabase
        .from("collection_details")
        .select(
          `
          collectiondetails_id,
          collection_date,
          status,
          schedule_id,
          truck_id,
          collection_schedules (
            schedule_id,
            start_time,
            end_time,
            status,
            barangay:barangay_id ( barangay_name )
          ),
          garbage_trucks (
            truck_id,
            truck_code,
            plate_number
          )
        `,
        )
        .eq("collection_date", todayStr);

      if (collectionError) throw collectionError;

      const normalizedCollections = (collectionData ?? []).map((row: any) => {
        const schedule = row.collection_schedules;
        const barangayName = schedule?.barangay?.barangay_name ?? "Unknown";
        const startTime = schedule?.start_time ?? null;
        const endTime = schedule?.end_time ?? null;
        const truck = row.garbage_trucks;
        const truckLabel = truck?.truck_code
          ? `Truck ${truck.truck_code}`
          : truck?.plate_number
            ? `Truck ${truck.plate_number}`
            : row.truck_id
              ? `Truck #${row.truck_id}`
              : "Unassigned";

        return {
          routeId: row.schedule_id
            ? `RT-${String(row.schedule_id).padStart(3, "0")}`
            : `CD-${String(row.collectiondetails_id).padStart(3, "0")}`,
          barangay: barangayName,
          schedule: formatTimeRange(startTime, endTime),
          status: row.status || schedule?.status || "Scheduled",
          truck: truckLabel,
        };
      });

      setDashboardCollectionRows(normalizedCollections);

      const completedCount = normalizedCollections.filter(
        (row) =>
          isStatusMatch(row.status, "Completed") ||
          isStatusMatch(row.status, "Done") ||
          isStatusMatch(row.status, "Resolved"),
      ).length;

      const delayedCount = normalizedCollections.filter((row) =>
        isStatusMatch(row.status, "Delayed"),
      ).length;

      const missedCount = normalizedCollections.filter((row) =>
        isStatusMatch(row.status, "Missed"),
      ).length;

      const { data: yesterdayCollections } = await supabase
        .from("collection_details")
        .select("status")
        .eq("collection_date", yesterdayStr);
      const yesterdayCompleted = (yesterdayCollections ?? []).filter(
        (row: any) =>
          isStatusMatch(row.status, "Completed") ||
          isStatusMatch(row.status, "Done") ||
          isStatusMatch(row.status, "Resolved"),
      ).length;
      const collectionTrend =
        yesterdayCompleted > 0
          ? `${Math.round(
              ((completedCount - yesterdayCompleted) / yesterdayCompleted) *
                100,
            )}% from yesterday`
          : "No data from yesterday";

      const { data: recentReports, error: reportError } = await supabase
        .from("community_reports")
        .select(
          `report_id, description, location, landmark, current_status, date_submitted, barangay:barangay_id ( barangay_name )`,
        )
        .order("date_submitted", { ascending: false })
        .limit(3);

      if (reportError) throw reportError;

      const reportCards = (recentReports ?? []).map((report: any) => {
        const reportTitle = report.location || report.landmark || "Report";
        const reportDescription = report.description || "No details provided";
        const reportTime = report.date_submitted
          ? new Date(report.date_submitted).toLocaleString()
          : "Unknown time";
        return {
          status: report.current_status || "Submitted",
          time: reportTime,
          title: reportTitle,
          description: reportDescription,
          barangay: report.barangay?.barangay_name || "Unknown",
        };
      });

      setDashboardReportCards(reportCards);

      const pendingStatuses = [
        "Submitted",
        "Under Review",
        "Scheduled",
        "Action Ongoing",
      ];
      const { count: pendingCount } = await supabase
        .from("community_reports")
        .select("report_id", { count: "exact", head: true })
        .in("current_status", pendingStatuses);

      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      const { count: newTodayCount } = await supabase
        .from("community_reports")
        .select("report_id", { count: "exact", head: true })
        .gte("date_submitted", startOfDay.toISOString())
        .lte("date_submitted", endOfDay.toISOString());

      setDashboardMetrics({
        todaysCompleted: completedCount,
        todaysTotal: normalizedCollections.length,
        pendingReports: pendingCount ?? 0,
        delayedCollections: delayedCount,
        missedCollections: missedCount,
        collectionTrend,
        pendingTrend:
          (newTodayCount ?? 0) > 0
            ? `${newTodayCount} new today`
            : "No new reports today",
        delayedTrend:
          delayedCount > 0
            ? `${delayedCount} delayed today`
            : "No delays today",
        missedTrend:
          missedCount > 0
            ? `${missedCount} missed today`
            : "No missed collections today",
      });
    } catch (err) {
      console.error("Dashboard data fetch error", err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorUsers(null);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        // order alphabetically by first name then last name for display
        .order("first_name", { ascending: true })
        .order("last_name", { ascending: true });
      if (error) throw error;
      // drop residents entirely
      setUsers((data as User[]).filter((u) => u.role !== "Resident"));
    } catch (error) {
      setErrorUsers((error as Error).message);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel("swmo-users-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => fetchUsers(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  useEffect(() => {
    async function fetchBarangays() {
      try {
        const { data, error } = await supabase
          .from("barangay")
          .select("barangay_id, barangay_name");
        if (error) throw error;
        if (data) {
          setBarangayOptions(
            data.map((b: any) => ({
              value: String(b.barangay_id),
              label: b.barangay_name,
            })),
          );
        }
      } catch (err) {
        console.error("Failed to fetch barangays:", err);
      }
    }
    fetchBarangays();
  }, []);

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

  // Fetch other users (TCEMO, Secretary, BWMC, GCP)
  const fetchOtherUsers = useCallback(async () => {
    setLoadingOtherUsers(true);
    setOtherUsersError(null);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .in("role", ["TCEMO Head", "Secretary", "BWMC", "GCP"]);
      if (error) throw error;
      setOtherUsersList(data as User[]);
    } catch (error) {
      setOtherUsersError((error as Error).message);
    } finally {
      setLoadingOtherUsers(false);
    }
  }, []);

  // Fetch other users when manageUsers tab is active
  useEffect(() => {
    if (activeTab === "manageUsers") {
      fetchOtherUsers();
    }

    if (activeTab !== "manageUsers") return;

    const channel = supabase
      .channel("swmo-other-users-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => fetchOtherUsers(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, fetchOtherUsers]);

  useEffect(() => {
    if (activeTab === "manageUsers") {
      fetchUsers();
    }
  }, [activeTab, fetchUsers]);

  const userAccountsTabs = ["All Users", "Staff", "Admins"] as const;
  const staffRoles = [
    "BWMC",
    "GCP",
    "Driver",
    "Collector",
    "Staff",
    "Barangay Staff",
  ];
  const adminRoles = ["Admin", "TCEMO Head", "Secretary", "SWMO", "SWMO Head"];
  const userAccountsPerPage = 5;

  const barangayNameById = new Map(
    barangayOptions.map((b) => [String(b.value), b.label]),
  );

  const filteredUserAccounts = users.filter((user) => {
    if (userRoleFilter !== "all" && user.role !== userRoleFilter) return false;
    const role = user.role || "";
    if (userAccountsTab === "Staff" && !staffRoles.some((r) => r === role)) {
      return false;
    }
    if (userAccountsTab === "Admins" && !adminRoles.some((r) => r === role)) {
      return false;
    }

    if (userStatusFilter !== "all" && user.status !== userStatusFilter) {
      return false;
    }

    if (
      userBarangayFilter !== "all" &&
      String(user.barangay_id ?? "") !== userBarangayFilter
    ) {
      return false;
    }

    const search = userAccountsSearch.trim().toLowerCase();
    if (!search) return true;

    const barangayName = barangayNameById.get(String(user.barangay_id ?? ""));
    const haystack = [
      user.user_id,
      user.username,
      user.first_name,
      user.last_name,
      user.email,
      user.role,
      user.status,
      user.contact_number,
      barangayName,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .join(" ");

    return haystack.includes(search);
  });

  const totalUserPages = Math.max(
    1,
    Math.ceil(filteredUserAccounts.length / userAccountsPerPage),
  );
  const currentUserPage = Math.min(userAccountsPage, totalUserPages);
  const userStartIndex = (currentUserPage - 1) * userAccountsPerPage;
  const pagedUserAccounts = filteredUserAccounts.slice(
    userStartIndex,
    userStartIndex + userAccountsPerPage,
  );

  const visibleUserPages = (() => {
    const start = Math.max(1, currentUserPage - 1);
    const end = Math.min(totalUserPages, start + 2);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  })();

  useEffect(() => {
    setUserAccountsPage(1);
  }, [
    userAccountsTab,
    userAccountsSearch,
    userStatusFilter,
    userBarangayFilter,
  ]);

  // Fetch incident reports with filters
  const fetchIncidentReports = useCallback(async () => {
    setLoadingReports(true);
    setReportsError(null);
    try {
      let query = supabase.from("community_reports").select(`
          *,
          barangay:barangay_id (
            barangay_name
          )
        `);

      // Filter by barangay if not "all"
      if (selectedBarangay !== "all") {
        query = query.eq("barangay_id", selectedBarangay);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Sort the data
      let sortedData = data || [];
      switch (sortBy) {
        case "date_desc":
          sortedData.sort(
            (a, b) =>
              new Date(b.date_submitted).getTime() -
              new Date(a.date_submitted).getTime(),
          );
          break;
        case "date_asc":
          sortedData.sort(
            (a, b) =>
              new Date(a.date_submitted).getTime() -
              new Date(b.date_submitted).getTime(),
          );
          break;
        case "status":
          sortedData.sort((a, b) =>
            a.current_status.localeCompare(b.current_status),
          );
          break;
        case "barangay":
          sortedData.sort((a, b) =>
            (a.barangay?.barangay_name || "").localeCompare(
              b.barangay?.barangay_name || "",
            ),
          );
          break;
        default:
          break;
      }

      setIncidentReports(sortedData);
    } catch (error) {
      setReportsError((error as Error).message);
    } finally {
      setLoadingReports(false);
    }
  }, [selectedBarangay, sortBy]);

  const incidentStatusTabs = [
    "All",
    "Submitted",
    "Validated",
    "Rejected",
    "Resolved",
  ];
  const incidentStatusOptions = [
    "Submitted",
    "Validated",
    "Rejected",
    "Resolved",
    "Under Review",
    "Scheduled",
    "Action Ongoing",
  ];
  const reportsPerPage = 5;

  const normalizedSearch = reportSearch.trim().toLowerCase();
  const filteredIncidentReports = incidentReports.filter((report) => {
    const status = report.current_status || "";
    if (reportStatusFilter !== "All" && status !== reportStatusFilter) {
      return false;
    }

    if (!normalizedSearch) return true;

    const haystack = [
      report.report_id,
      report.description,
      report.location,
      report.landmark,
      report.barangay?.barangay_name,
      report.current_status,
    ]
      .filter(Boolean)
      .map((value) => String(value).toLowerCase())
      .join(" ");

    return haystack.includes(normalizedSearch);
  });

  const totalReportPages = Math.max(
    1,
    Math.ceil(filteredIncidentReports.length / reportsPerPage),
  );
  const currentReportPage = Math.min(reportPage, totalReportPages);
  const reportStartIndex = (currentReportPage - 1) * reportsPerPage;
  const pagedIncidentReports = filteredIncidentReports.slice(
    reportStartIndex,
    reportStartIndex + reportsPerPage,
  );

  const visibleReportPages = (() => {
    const start = Math.max(1, currentReportPage - 1);
    const end = Math.min(totalReportPages, start + 2);
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  })();

  const handleCreateReport = async (e: FormEvent) => {
    e.preventDefault();
    setCreateReportError(null);

    if (!createReportForm.description.trim() || !createReportForm.location) {
      setCreateReportError("Description and location are required.");
      return;
    }

    setCreateReportLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;
      const barangayId = createReportForm.barangay_id
        ? Number(createReportForm.barangay_id)
        : null;

      const { error } = await supabase.from("community_reports").insert({
        description: createReportForm.description.trim(),
        location: createReportForm.location.trim(),
        landmark: createReportForm.landmark.trim() || null,
        current_status: createReportForm.current_status,
        date_submitted: new Date().toISOString(),
        barangay_id: Number.isNaN(barangayId) ? null : barangayId,
        user_id: userId,
      });

      if (error) {
        setCreateReportError(error.message);
        return;
      }

      setCreateReportForm({
        description: "",
        location: "",
        landmark: "",
        barangay_id: "",
        current_status: "Submitted",
      });
      setShowCreateReportModal(false);
      fetchIncidentReports();
    } catch (err) {
      setCreateReportError((err as Error).message);
    } finally {
      setCreateReportLoading(false);
    }
  };

  const handleViewHistory = async (report: any) => {
    const reportId = report.report_id;
    const reportTitle = report.location || report.description || "Report";
    const { data, error } = await supabase
      .from("report_status_history")
      .select("status, remarks, timestamp")
      .eq("report_id", reportId)
      .order("timestamp", { ascending: false })
      .limit(5);

    if (error) {
      setHistoryModal({
        title: reportTitle,
        entries: [],
        message: "Unable to load history.",
      });
      return;
    }

    if (!data || data.length === 0) {
      setHistoryModal({
        title: reportTitle,
        entries: [],
        message: "No history records found.",
      });
      return;
    }

    const idRegex =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const mentionedIds = Array.from(
      new Set(
        data
          .map((row: any) => row.remarks || "")
          .flatMap((text: string) => text.match(idRegex) || [])
          .map((value: string) => value.toLowerCase()),
      ),
    );

    let userNameById = new Map<string, string>();
    if (mentionedIds.length > 0) {
      const { data: userRows } = await supabase
        .from("users")
        .select("user_id, first_name, last_name, username")
        .in("user_id", mentionedIds);

      (userRows || []).forEach((user: any) => {
        const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`
          .trim()
          .replace(/\s+/g, " ");
        const displayName = name || user.username || user.user_id;
        userNameById.set(String(user.user_id).toLowerCase(), displayName);
      });
    }

    const entries = data.map((row: any) => {
      const time = new Date(row.timestamp).toLocaleString();
      const remarkText = row.remarks
        ? row.remarks.replace(idRegex, (match: string) => {
            const replacement = userNameById.get(match.toLowerCase());
            return replacement || match;
          })
        : "";
      return {
        time,
        status: row.status || "Unknown",
        remarks: remarkText,
      };
    });

    setHistoryModal({
      title: reportTitle,
      entries,
    });
  };

  // Fetch incident reports when tab is active or filters change
  useEffect(() => {
    if (activeTab === "incidentReports") {
      fetchIncidentReports();
    }

    if (activeTab !== "incidentReports") return;

    const channel = supabase
      .channel("swmo-incidents-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => fetchIncidentReports(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "report_status_history" },
        () => fetchIncidentReports(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, fetchIncidentReports]);

  useEffect(() => {
    setReportPage(1);
  }, [reportStatusFilter, reportSearch, incidentReports.length]);

  useEffect(() => {
    if (activeTab === "dashboard") {
      fetchDashboardData();
    }

    if (activeTab !== "dashboard") return;

    const channel = supabase
      .channel("swmo-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_details" },
        () => fetchDashboardData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => fetchDashboardData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, fetchDashboardData]);

  const dashboardStats = [
    {
      label: "Today's Collection",
      value: `${dashboardMetrics.todaysCompleted}/${dashboardMetrics.todaysTotal}`,
      trend: dashboardMetrics.collectionTrend,
      trendClass:
        dashboardMetrics.todaysTotal > 0
          ? "text-emerald-300"
          : "text-slate-400",
      icon: "🚚",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-300",
    },
    {
      label: "Pending Reports",
      value: String(dashboardMetrics.pendingReports),
      trend: dashboardMetrics.pendingTrend,
      trendClass:
        dashboardMetrics.pendingReports > 0
          ? "text-amber-300"
          : "text-slate-400",
      icon: "🚩",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-300",
    },
    {
      label: "Delayed Collections",
      value: String(dashboardMetrics.delayedCollections),
      trend: dashboardMetrics.delayedTrend,
      trendClass:
        dashboardMetrics.delayedCollections > 0
          ? "text-rose-300"
          : "text-slate-400",
      icon: "⚠️",
      iconBg: "bg-rose-500/15",
      iconColor: "text-rose-300",
    },
    {
      label: "Missed Collections",
      value: String(dashboardMetrics.missedCollections),
      trend: dashboardMetrics.missedTrend,
      trendClass:
        dashboardMetrics.missedCollections > 0
          ? "text-red-300"
          : "text-slate-400",
      icon: "🛑",
      iconBg: "bg-red-500/15",
      iconColor: "text-red-300",
    },
  ];

  const handleLogout = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to logout?")
    ) {
      localStorage.removeItem("authToken");
      router.push("/");
    }
  };

  const nameRegex = /^[A-Za-z\s]+$/;

  const sanitizeNameField = (value: string) =>
    value.replace(/[^A-Za-z\s]/g, "");

  const handleUserFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    if (e.target.name === "first_name" || e.target.name === "last_name") {
      const safeValue = sanitizeNameField(e.target.value);
      setUserForm({ ...userForm, [e.target.name]: safeValue });
      return;
    }
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === "first_name" || e.target.name === "last_name") {
      setManageAccountForm({
        ...manageAccountForm,
        [e.target.name]: sanitizeNameField(e.target.value),
      });
      return;
    }

    setManageAccountForm({
      ...manageAccountForm,
      [e.target.name]: e.target.value,
    });
  };

  const validateUserForm = () => {
    if (
      !userForm.first_name.trim() ||
      !userForm.last_name.trim() ||
      !userForm.username.trim() ||
      !userForm.email.trim() ||
      !userForm.contact_number.trim() ||
      !userForm.role.trim()
    ) {
      return "All fields are required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userForm.email)) return "Invalid email format";
    if (
      !nameRegex.test(userForm.first_name) ||
      !nameRegex.test(userForm.last_name)
    )
      return "First name and last name can only contain letters and spaces";
    if (userForm.role === "BWMC" && !userForm.barangay_id)
      return "Barangay is required for BWMC role";
    // phone must start with 09 and exactly 11 digits
    const phoneRegex = /^09\d{9}$/;
    if (!phoneRegex.test(userForm.contact_number))
      return "Contact number must start with 09 and be 11 digits";
    return null;
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();

    const confirmed = window.confirm("Are you sure you want to add this user?");
    if (!confirmed) return;
    setFormError(null);
    setFormSuccess(null);
    const validationError = validateUserForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    // ensure email/username not already used
    const { data: existingUsers, error: queryError } = await supabase
      .from("users")
      .select("username, email")
      .or(`email.eq.${userForm.email},username.eq.${userForm.username}`);
    if (queryError) throw queryError;
    if (existingUsers && existingUsers.length > 0) {
      setFormError("A user with that email or username already exists.");
      return;
    }

    // create temporary password for new account
    const tempPassword = generateTempPassword(12);
    try {
      // call backend so we can use service role and skip email confirmation
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userForm.email,
          username: userForm.username,
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          contact_number: userForm.contact_number,
          role: userForm.role,
          barangay_id: userForm.barangay_id,
          tempPassword,
        }),
      });
      // read body once as text then parse
      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Server returned invalid JSON: ${text}`);
      }
      if (!res.ok || !payload.success) {
        // surface misconfiguration with guidance
        if (
          res.status === 500 &&
          payload.error?.includes("SUPABASE_SERVICE_ROLE_KEY")
        ) {
          setFormError(
            "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY missing. Add the service role key to your .env.local and restart.",
          );
          return;
        }
        throw new Error(payload.error || `Failed to create user: ${text}`);
      }
      const userId = payload.userId;
      // Wait for user to be available in Supabase before calling notification API
      let userFound = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        const { data: checkUser, error: checkError } = await supabase
          .from("users")
          .select("user_id")
          .eq("user_id", userId)
          .single();
        if (checkUser && !checkError) {
          userFound = true;
          break;
        }
        // Wait 200ms before next attempt
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!userFound) {
        setFormError(
          "User created, but could not verify user in database for notification.",
        );
        return;
      }
      // Call notification API to send SMS
      try {
        const notifRes = await fetch("/api/notifications/account-created/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            role: userForm.role,
            createdBy: "SWMO Head", // or dynamic if needed
            tempPassword,
          }),
        });
        const notifData = await notifRes.json();
        if (!notifRes.ok) {
          console.error("Notification API error:", notifData.error);
          setFormError(
            `User created, but notification failed: ${notifData.error}`,
          );
        } else {
          console.log("Notification sent:", notifData);
        }
      } catch (notifErr) {
        console.error("Notification API call failed:", notifErr);
        setFormError(`User created, but notification failed: ${notifErr}`);
      }
      setFormSuccess("User account created successfully!");
      setUserForm({
        username: "",
        first_name: "",
        last_name: "",
        email: "",
        contact_number: "",
        role: "",
        password: "",
        barangay_id: "",
      });
      fetchUsers();
    } catch (err) {
      setFormError(`Unexpected error: ${(err as Error).message}`);
    }
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

    if (
      !nameRegex.test(manageAccountForm.first_name) ||
      !nameRegex.test(manageAccountForm.last_name)
    ) {
      return "First and last names can only contain letters and spaces.";
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
    // validate contact starts with 09 and exactly 11 digits
    if (!/^09\d{9}$/.test(manageAccountForm.contact_number)) {
      return "Contact number must start with 09 and be 11 digits.";
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

  // Fetch other users (TCEMO, Secretary, BWMC, GCP)
  // Start editing a user
  const handleEditUser = (user: User) => {
    setIsViewOnly(false);
    setEditingUserId(user.user_id);
    setEditingUserForm({
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      contact_number: user.contact_number,
      password: "",
      confirm_password: "",
    });
    setShowEditUserModal(true);
    setOtherUsersError(null);
    setOtherUsersSuccess(null);
  };

  const handleViewUser = (user: User) => {
    setIsViewOnly(true);
    setEditingUserId(user.user_id);
    setEditingUserForm({
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      contact_number: user.contact_number,
      password: "",
      confirm_password: "",
    });
    setShowEditUserModal(true);
    setOtherUsersError(null);
    setOtherUsersSuccess(null);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingUserForm(null);
    setShowEditUserModal(false);
  };

  // Save user changes
  const handleSaveUserEdit = async (userId: string) => {
    if (!editingUserForm) return;

    // Validate
    if (
      !editingUserForm.first_name.trim() ||
      !editingUserForm.last_name.trim() ||
      !editingUserForm.email.trim() ||
      !editingUserForm.contact_number.trim()
    ) {
      setOtherUsersError("All fields are required.");
      return;
    }

    if (
      !nameRegex.test(editingUserForm.first_name) ||
      !nameRegex.test(editingUserForm.last_name)
    ) {
      setOtherUsersError(
        "First and last names can only contain letters and spaces.",
      );
      return;
    }

    // must start with 09 and be 11 digits
    if (!/^09\d{9}$/.test(editingUserForm.contact_number)) {
      setOtherUsersError("Contact number must start with 09 and be 11 digits.");
      return;
    }

    try {
      // Update user profile
      const { error: profileError } = await supabase
        .from("users")
        .update({
          username: editingUserForm.username,
          first_name: editingUserForm.first_name,
          last_name: editingUserForm.last_name,
          email: editingUserForm.email,
          contact_number: editingUserForm.contact_number,
        })
        .eq("user_id", userId);

      if (profileError) {
        setOtherUsersError(`Update failed: ${profileError.message}`);
        return;
      }

      setOtherUsersSuccess("User account updated successfully!");
      setEditingUserId(null);
      setEditingUserForm(null);
      setShowEditUserModal(false);
      fetchOtherUsers();
    } catch (err) {
      setOtherUsersError(`Unexpected error: ${(err as Error).message}`);
    }
  };

  // Archive user account
  const handleArchiveUser = async (userId: string, userName: string) => {
    if (
      !window.confirm(`Archive account for ${userName}? This cannot be undone.`)
    ) {
      return;
    }

    try {
      // Prevent archiving when the GCP has an active assignment this month.
      const now = new Date();
      const currentMonthStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const currentMonthEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      ).toISOString();

      const { data: scheduleAssignments, error: scheduleError } = await supabase
        .from("collection_schedules")
        .select("schedule_id")
        .eq("gcp_user_id", userId)
        .eq("status", "Active")
        .limit(1);

      if (scheduleError) {
        setOtherUsersError(`Archive check failed: ${scheduleError.message}`);
        return;
      }

      const { data: detailAssignments, error: detailError } = await supabase
        .from("collection_details")
        .select("collectiondetails_id")
        .eq("gcp_user_id", userId)
        .gte("collection_date", currentMonthStart)
        .lte("collection_date", currentMonthEnd)
        .limit(1);

      if (detailError) {
        setOtherUsersError(`Archive check failed: ${detailError.message}`);
        return;
      }

      if (
        (scheduleAssignments && scheduleAssignments.length > 0) ||
        (detailAssignments && detailAssignments.length > 0)
      ) {
        setOtherUsersError(
          `Cannot archive ${userName}. There is an active assignment for this month.`,
        );
        return;
      }

      const { error } = await supabase
        .from("users")
        .update({ status: "archived" })
        .eq("user_id", userId);

      if (error) {
        setOtherUsersError(`Archive failed: ${error.message}`);
        return;
      }

      setOtherUsersSuccess(`${userName} account archived successfully!`);
      fetchOtherUsers();
    } catch (err) {
      setOtherUsersError(`Unexpected error: ${(err as Error).message}`);
    }
  };

  // View report details
  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const fetchReportsData = useCallback(async () => {
    setLoadingReportData(true);
    setErrorReportData(null);
    try {
      const { data: collectionRows, error } = await supabase
        .from("collection_details")
        .select(
          "collection_date, waste_weight, departure_time, completion_time",
        );
      if (error) throw error;

      const monthMap: { [month: string]: number } = {};
      collectionRows.forEach((d: any) => {
        if (!d.collection_date || d.waste_weight == null) return;
        const month = new Date(d.collection_date).toLocaleString("default", {
          month: "short",
          year: "numeric",
        });
        monthMap[month] = (monthMap[month] || 0) + Number(d.waste_weight);
      });
      setWasteCollectionData(
        Object.entries(monthMap).map(([month, tons]) => ({ month, tons })),
      );

      const perfMap: { [month: string]: { total: number; fast: number } } = {};
      collectionRows.forEach((d: any) => {
        if (!d.collection_date || !d.departure_time || !d.completion_time)
          return;
        const month = new Date(d.collection_date).toLocaleString("default", {
          month: "short",
          year: "numeric",
        });
        const start = new Date(d.departure_time).getTime();
        const end = new Date(d.completion_time).getTime();
        const duration = (end - start) / 60000; // minutes
        perfMap[month] = perfMap[month] || { total: 0, fast: 0 };
        perfMap[month].total++;
        if (duration <= 60) perfMap[month].fast++;
      });
      setPerformanceData(
        Object.entries(perfMap).map(([month, val]) => ({
          month,
          efficiency: val.total ? Math.round((val.fast / val.total) * 100) : 0,
        })),
      );
    } catch (err) {
      setErrorReportData((err as Error).message);
    } finally {
      setLoadingReportData(false);
    }
  }, []);

  const fetchBarangayConcerns = useCallback(async () => {
    setLoadingReportData(true);
    setErrorReportData(null);
    try {
      const { data: concernsData, error } = await supabase
        .from("community_reports")
        .select(
          "report_id, barangay_id, description, current_status, date_submitted, resident_id",
        );
      if (error) throw error;
      const { data: barangays } = await supabase
        .from("barangay")
        .select("barangay_id, barangay_name");
      const barangayMap: { [id: number]: string } = {};
      barangays?.forEach((b: any) => {
        barangayMap[b.barangay_id] = b.barangay_name;
      });
      setBarangayConcerns(
        concernsData.map((r: any) => ({
          ...r,
          barangay_name: barangayMap[r.barangay_id] || "Unknown",
        })),
      );
    } catch (err) {
      setErrorReportData((err as Error).message);
    } finally {
      setLoadingReportData(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "reports") {
      if (activeReportOption === "wasteCollection") {
        fetchReportsData();
      } else {
        fetchBarangayConcerns();
      }
    }
  }, [activeTab, activeReportOption, fetchReportsData, fetchBarangayConcerns]);

  const handleShowResponse = async (report_id: number) => {
    setShowResponse((prev) => ({ ...prev, [report_id]: !prev[report_id] }));
    if (!responseDetails[report_id]) {
      const { data, error } = await supabase
        .from("report_status_history")
        .select("status, remarks, timestamp")
        .eq("report_id", report_id)
        .order("timestamp", { ascending: false })
        .limit(1);
      if (!error && data && data[0]) {
        setResponseDetails((prev) => ({
          ...prev,
          [report_id]: `Status: ${data[0].status}\nRemarks: ${
            data[0].remarks
          }\nTimestamp: ${new Date(data[0].timestamp).toLocaleString()}`,
        }));
      }
    }
  };

  // SWMO ManageAccountSection – copy of the TCEMO design
  // SWMO ManageAccountSection – make this card identical to TCEMO's inner card
  function ManageAccountSection({
    form,
    loading,
    error,
    success,
    onChange,
    onSubmit,
  }: {
    form: typeof manageAccountForm;
    loading: boolean;
    error: string | null;
    success: string | null;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: FormEvent) => void;
  }) {
    if (loading) return <TruckLoader />;

    return (
      <section className="max-w-5xl mx-auto rounded-lg bg-slate-900 border border-slate-800 px-6 py-6">
        <h2 className="text-lg font-bold mb-1 text-slate-100">
          Manage Account
        </h2>
        <p className="text-xs text-slate-400 mb-6">
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
          <div className="space-y-2">
            <Label
              htmlFor="username"
              className="text-xs font-medium text-slate-300"
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
              placeholder="Enter your username"
            />
          </div>

          {/* First / Last */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="first_name"
                className="text-xs font-medium text-slate-300"
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
                placeholder="Enter your first name"
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="last_name"
                className="text-xs font-medium text-slate-300"
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
                placeholder="Enter your last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="contact_number"
                className="text-xs font-medium text-slate-300"
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
                className="text-xs font-medium text-slate-300"
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
                placeholder="user@tagbilaran.gov.ph"
                className="cursor-not-allowed opacity-60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-xs font-medium text-slate-300"
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
              className="text-xs font-medium text-slate-300"
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

  const sidebarItems = [
    {
      label: "Dashboard",
      tab: "dashboard",
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
    },
    {
      label: "Manage Users",
      tab: "userAdmin",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <circle cx="7" cy="7" r="3" />
          <circle cx="13" cy="7" r="3" />
          <rect x="2" y="14" width="16" height="3" rx="1.5" />
        </svg>
      ),
    },
    {
      label: "User Accounts",
      tab: "manageUsers",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <rect x="4" y="6" width="12" height="10" rx="2" />
          <rect x="7" y="9" width="6" height="2" rx="1" />
        </svg>
      ),
    },
    {
      label: "Incident Reports",
      tab: "incidentReports",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <circle cx="10" cy="10" r="8" />
          <text x="10" y="15" textAnchor="middle" fontSize="10" fill="#fff">
            !
          </text>
        </svg>
      ),
    },
    {
      label: "Generate Report",
      tab: "reports",
      icon: (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-5 h-5"
        >
          <polyline points="3,17 8,12 13,15 17,7" />
          <circle cx="17" cy="7" r="1.5" />
        </svg>
      ),
    },
  ] as const;

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

      {/* Top navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-900/40 bg-slate-950/80 shadow-lg shadow-emerald-900/20 backdrop-blur-xl supports-[backdrop-filter]:bg-slate-950/60">
        <div className="flex items-center justify-between px-4 md:px-8 py-4 min-h-16">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg bg-slate-900/80 text-slate-100 hover:bg-slate-800 transition-colors ring-1 ring-white/10"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? "✖" : "☰"}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-lg flex-shrink-0 shadow-lg shadow-emerald-900/40">
                🚛
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold truncate">
                  Track-the-Truck
                </p>
                <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-100 truncate">
                  SWMO Dashboard
                </h1>
              </div>
            </div>
          </div>
          {/* Profile Dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-100 font-medium transition-colors ring-1 ring-white/10"
            >
              <span className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm shadow-lg overflow-hidden">
                {initials}
              </span>
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${profileDropdownOpen ? "rotate-180" : ""}`}
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
                <div className="absolute right-0 mt-2 w-48 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden z-50">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setActiveTab("manageAccount");
                        setProfileDropdownOpen(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <span>⚙️</span>
                      <span>Manage Account</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-800 transition-colors"
                    >
                      <span>🚪</span>
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

        {/* Sidebar */}
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
            className="flex-1 space-y-1 text-sm font-medium"
            aria-label="Main Navigation"
          >
            {[
              { label: "Dashboard", icon: "📊", tab: "dashboard" },
              { label: "Manage Users", icon: "👥", tab: "userAdmin" },
              { label: "User Accounts", icon: "📋", tab: "manageUsers" },
              { label: "Incident Reports", icon: "🚨", tab: "incidentReports" },
              { label: "Generate Report", icon: "📈", tab: "reports" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveTab(
                    item.tab as
                      | "dashboard"
                      | "userAdmin"
                      | "manageUsers"
                      | "incidentReports"
                      | "reports"
                      | "manageAccount",
                  );
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
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 sm:px-8 md:px-10 lg:px-12 py-12 space-y-12 relative z-10 md:ml-64 bg-slate-900/40">
          <div
            className={`transition-opacity duration-300 ease-in-out ${
              tabFadeIn ? "opacity-100" : "opacity-0"
            }`}
            key={activeTab}
          >
            {/* DASHBOARD */}
            {activeTab === "dashboard" && (
              <>
                <section className="space-y-8">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-semibold">
                        Dashboard
                      </p>
                      <h1 className="text-2xl font-bold text-slate-100 md:text-3xl">
                        Track-the-Truck Overview
                      </h1>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setStatsVisible(!statsVisible)}
                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-500/50"
                      >
                        {statsVisible ? "Hide Stats" : "Show Stats"}
                      </Button>
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-300 px-3 py-2 text-xs font-semibold">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </span>
                    </div>
                  </div>

                  {statsVisible && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                      {dashboardStats.map((card) => (
                        <div
                          key={card.label}
                          className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-slate-400 text-sm">
                                {card.label}
                              </p>
                              <h3 className="text-2xl font-bold text-slate-100">
                                {card.value}
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
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    {isUserTableExpanded ? (
                      <div className="lg:col-span-5">
                        {/* User list maximized: full width, hide map and reports */}
                        <div className="dashboard-section overflow-hidden bg-slate-950 border border-slate-800 max-h-[90vh]">
                          <div className="relative z-10">
                            <div className="flex items-center justify-between mb-6">
                              <h3 className="text-lg font-bold text-slate-100">
                                User List (Realtime)
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-emerald-600/20 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-600/40 font-medium">
                                  {users.length} users
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setIsUserTableExpanded(false)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-500 bg-slate-900 text-2xl font-bold text-emerald-300 hover:bg-emerald-500/10 transition ml-2 shadow-lg"
                                  aria-label="Minimize user list"
                                  title="Minimize user list"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="h-6 w-6"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M20 12H4"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {loadingUsers && <TruckLoader />}
                            {!loadingUsers && (
                              <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[70vh] bg-slate-950">
                                <table
                                  className={`min-w-full ${userTableSize.font}`}
                                >
                                  <thead className="bg-slate-800 text-slate-300 border-b border-slate-700 sticky top-0 z-10">
                                    <tr>
                                      <th
                                        className="px-4 py-3 text-left font-medium text-xs cursor-pointer select-none transition bg-slate-800 hover:bg-slate-700 group"
                                        title="Sort by Name"
                                        onClick={() => {
                                          setUserSortKey("name");
                                          setUserSortDir(
                                            userSortKey === "name" &&
                                              userSortDir === "asc"
                                              ? "desc"
                                              : "asc",
                                          );
                                        }}
                                      >
                                        <span className="inline-flex items-center gap-1">
                                          Name
                                          <span className="text-xs opacity-70 group-hover:opacity-100 transition">
                                            {userSortKey === "name"
                                              ? userSortDir === "asc"
                                                ? "▲"
                                                : "▼"
                                              : "▲▼"}
                                          </span>
                                        </span>
                                      </th>
                                      <th
                                        className="px-4 py-3 text-left font-medium text-xs hidden sm:table-cell cursor-pointer select-none transition bg-slate-800 hover:bg-slate-700 group"
                                        title="Sort by Email"
                                        onClick={() => {
                                          setUserSortKey("email");
                                          setUserSortDir(
                                            userSortKey === "email" &&
                                              userSortDir === "asc"
                                              ? "desc"
                                              : "asc",
                                          );
                                        }}
                                      >
                                        <span className="inline-flex items-center gap-1">
                                          Email
                                          <span className="text-xs opacity-70 group-hover:opacity-100 transition">
                                            {userSortKey === "email"
                                              ? userSortDir === "asc"
                                                ? "▲"
                                                : "▼"
                                              : "▲▼"}
                                          </span>
                                        </span>
                                      </th>
                                      <th
                                        className="px-4 py-3 text-left font-medium text-xs cursor-pointer select-none transition bg-slate-800 hover:bg-slate-700 group"
                                        title="Sort by Role"
                                        onClick={() => {
                                          setUserSortKey("role");
                                          setUserSortDir(
                                            userSortKey === "role" &&
                                              userSortDir === "asc"
                                              ? "desc"
                                              : "asc",
                                          );
                                        }}
                                      >
                                        <span className="inline-flex items-center gap-1">
                                          Role
                                          <span className="text-xs opacity-70 group-hover:opacity-100 transition">
                                            {userSortKey === "role"
                                              ? userSortDir === "asc"
                                                ? "▲"
                                                : "▼"
                                              : "▲▼"}
                                          </span>
                                        </span>
                                      </th>
                                      <th
                                        className="px-4 py-3 text-left font-medium text-xs hidden md:table-cell cursor-pointer select-none transition bg-slate-800 hover:bg-slate-700 group"
                                        title="Sort by Barangay"
                                        onClick={() => {
                                          setUserSortKey("barangay");
                                          setUserSortDir(
                                            userSortKey === "barangay" &&
                                              userSortDir === "asc"
                                              ? "desc"
                                              : "asc",
                                          );
                                        }}
                                      >
                                        <span className="inline-flex items-center gap-1">
                                          Barangay
                                          <span className="text-xs opacity-70 group-hover:opacity-100 transition">
                                            {userSortKey === "barangay"
                                              ? userSortDir === "asc"
                                                ? "▲"
                                                : "▼"
                                              : "▲▼"}
                                          </span>
                                        </span>
                                      </th>
                                      <th className="px-4 py-3 text-left font-medium text-xs">
                                        Actions
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedUsers.map((user) => (
                                      <tr
                                        key={
                                          user.id || user.user_id || user.email
                                        }
                                        className="border-t border-slate-800 hover:bg-slate-800 transition-colors"
                                      >
                                        <td
                                          className={`px-4 ${userTableSize.row} font-medium text-slate-200 ${userTableSize.font}`}
                                        >
                                          {user.first_name} {user.last_name}
                                          <div className="sm:hidden text-xs text-slate-400 font-normal">
                                            {user.email}
                                          </div>
                                        </td>
                                        <td
                                          className={`px-4 ${userTableSize.row} text-slate-300 hidden sm:table-cell ${userTableSize.font}`}
                                        >
                                          {user.email}
                                        </td>
                                        <td
                                          className={`px-4 ${userTableSize.row}`}
                                        >
                                          <span className="px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 text-xs font-medium">
                                            {user.role}
                                          </span>
                                        </td>
                                        <td
                                          className={`px-4 ${userTableSize.row} text-slate-400 hidden md:table-cell ${userTableSize.font}`}
                                        >
                                          {user.role === "BWMC"
                                            ? user.barangay_id
                                            : "-"}
                                        </td>
                                        <td
                                          className={`px-4 ${userTableSize.row} ${userTableSize.font}`}
                                        >
                                          {[
                                            "TCEMO Head",
                                            "Secretary",
                                            "BWMC",
                                            "GCP",
                                          ].includes(user.role) && (
                                            <button
                                              onClick={() =>
                                                handleArchiveUser(
                                                  String(
                                                    user.user_id ??
                                                      user.id ??
                                                      "",
                                                  ),
                                                  `${user.first_name} ${user.last_name}`,
                                                )
                                              }
                                              className="text-rose-300 hover:text-rose-200 text-xs"
                                            >
                                              Archive
                                            </button>
                                          )}
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
                    ) : (
                      <>
                        <div
                          className={`rounded-2xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 transition-all duration-300 ${
                            isMapExpanded ? "lg:col-span-5" : "lg:col-span-3"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-4">
                            <h2 className="text-xl font-bold text-slate-100">
                              Live Truck Tracking
                            </h2>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setIsMapExpanded(false)}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold transition ${
                                  isMapExpanded
                                    ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                                    : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                                }`}
                                aria-label="Minimize map"
                                title="Minimize"
                              >
                                _
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsMapExpanded(true)}
                                className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[10px] font-semibold transition ${
                                  isMapExpanded
                                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                                }`}
                                aria-label="Maximize map"
                                title="Maximize"
                              >
                                []
                              </button>
                            </div>
                          </div>
                          <div
                            className={`relative rounded-xl bg-slate-950/60 overflow-hidden border border-slate-800 transition-all duration-300 ${
                              isMapExpanded ? "h-[70vh]" : "h-[420px]"
                            }`}
                          >
                            <LeafletMap />
                          </div>
                        </div>

                        {!isMapExpanded && (
                          <div className="lg:col-span-2 rounded-2xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
                            <h2 className="text-xl font-bold text-slate-100 mb-4">
                              Recent Community Reports
                            </h2>
                            <div className="space-y-4">
                              {dashboardReportCards.length === 0 ? (
                                <div className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                                  No recent community reports.
                                </div>
                              ) : (
                                dashboardReportCards.map((report) => (
                                  <div
                                    key={`${report.title}-${report.time}`}
                                    className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition-shadow hover:shadow-lg hover:shadow-black/30"
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <span
                                        className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${
                                          reportStatusClasses[report.status] ??
                                          "bg-slate-800 text-slate-200"
                                        }`}
                                      >
                                        {report.status}
                                      </span>
                                      <span className="text-xs text-slate-400">
                                        {report.time}
                                      </span>
                                    </div>
                                    <h4 className="font-medium mb-1 text-slate-100">
                                      Title : {report.title}
                                    </h4>
                                    <p className="text-sm text-slate-300 mb-3">
                                      Description : {report.description}
                                    </p>
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium text-slate-300">
                                        Barangay : {report.barangay}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              </>
            )}
            {/* USER ADMIN */}
            {activeTab === "userAdmin" && (
              <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Add user */}
                <div className="dashboard-section overflow-hidden">
                  <div className="relative z-10">
                    <h2 className="text-lg font-bold mb-4 text-slate-100">
                      Add User
                    </h2>
                    <p className="text-xs text-slate-400 mb-6">
                      Create accounts for collectors, BWMC officers, and admins.
                    </p>
                    <form
                      onSubmit={handleAddUser}
                      className="space-y-4"
                      noValidate
                    >
                      {formError && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-red-300 text-xs">
                          {formError}
                        </div>
                      )}
                      {formSuccess && (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-emerald-300 text-xs">
                          {formSuccess}
                        </div>
                      )}

                      <SelectField
                        label="Role"
                        name="role"
                        value={userForm.role}
                        onChange={handleUserFormChange}
                        required
                        options={filteredRoleOptions.slice(1)}
                        placeholder={filteredRoleOptions[0].label}
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField
                          label="First Name"
                          name="first_name"
                          type="text"
                          value={userForm.first_name}
                          onChange={handleUserFormChange}
                          required
                          placeholder="e.g. Juan"
                        />
                        <InputField
                          label="Last Name"
                          name="last_name"
                          type="text"
                          value={userForm.last_name}
                          onChange={handleUserFormChange}
                          required
                          placeholder="e.g. Dela Cruz"
                        />
                      </div>

                      <InputField
                        label="Username"
                        name="username"
                        type="text"
                        value={userForm.username}
                        onChange={handleUserFormChange}
                        required
                        placeholder="e.g. collector01 or user@example.com"
                      />
                      <p className="text-xs text-slate-400 mt-1 mb-3">
                        This will be used for login.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col">
                          <InputField
                            label="Contact Number"
                            name="contact_number"
                            type="tel"
                            value={userForm.contact_number}
                            onChange={handleUserFormChange}
                            required
                            placeholder="09xx-xxx-xxxx"
                          />
                          {userForm.contact_number &&
                            !/^09\d{9}$/.test(userForm.contact_number) && (
                              <p className="text-xs text-red-400 mt-1">
                                Number must start with 09 and be 11 digits
                              </p>
                            )}
                        </div>
                        <InputField
                          label="Email"
                          name="email"
                          type="email"
                          value={userForm.email}
                          onChange={handleUserFormChange}
                          required
                          placeholder="name@example.com"
                        />
                      </div>

                      {userForm.role === "BWMC" && (
                        <SelectField
                          label="Barangay"
                          name="barangay_id"
                          value={userForm.barangay_id}
                          onChange={handleUserFormChange}
                          required
                          options={barangayOptions}
                          placeholder="Select barangay..."
                        />
                      )}

                      {/* password is autogenerated; no input required */}
                      <p className="text-xs text-slate-400">
                        A temporary password will be generated automatically and
                        sent to the new user via SMS. They will be prompted to
                        change it on first login.
                      </p>

                      <div className="flex justify-end pt-2">
                        <Button type="submit">＋ Add User</Button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* User list */}
                <div className="dashboard-section overflow-hidden max-h-[700px] relative">
                  <div className="z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold text-slate-100">
                          User List (Realtime)
                        </h3>
                        <Select
                          value={userRoleFilter}
                          onValueChange={(value: string) =>
                            setUserRoleFilter(value)
                          }
                        >
                          <SelectTrigger className="w-40 bg-slate-900 border-slate-700 text-slate-200">
                            <SelectValue placeholder="Filter by Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            <SelectItem value="BWMC">BWMC</SelectItem>
                            <SelectItem value="GCP">GCP</SelectItem>
                            <SelectItem value="Secretary">Secretary</SelectItem>
                            <SelectItem value="SWMO Head">SWMO Head</SelectItem>
                            <SelectItem value="TCEMO Head">
                              TCEMO Head
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <span className="text-xs bg-emerald-600/20 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-600/40 font-medium">
                        {users.length} users
                      </span>
                    </div>
                    {loadingUsers && <TruckLoader />}
                    {!loadingUsers && (
                      <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[575px] bg-slate-950">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-800 text-slate-300 border-b border-slate-700 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">
                                User ID
                              </th>
                              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">
                                Name
                              </th>
                              <th
                                className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider cursor-pointer select-none transition bg-slate-800 hover:bg-slate-700 group"
                                title="Sort by Role"
                                onClick={() => {
                                  setUserSortKey && setUserSortKey("role");
                                  setUserSortDir &&
                                    setUserSortDir(
                                      userSortKey === "role" &&
                                        userSortDir === "asc"
                                        ? "desc"
                                        : "asc",
                                    );
                                }}
                              >
                                <span className="inline-flex items-center gap-1">
                                  Role
                                  <span className="text-xs opacity-70 group-hover:opacity-100 transition">
                                    {userSortKey === "role"
                                      ? userSortDir === "asc"
                                        ? "▲"
                                        : "▼"
                                      : "▲▼"}
                                  </span>
                                </span>
                              </th>
                              <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wider">
                                Barangay
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(typeof sortedUsers !== "undefined"
                              ? sortedUsers.filter(
                                  (user) =>
                                    userRoleFilter === "all" ||
                                    user.role === userRoleFilter,
                                )
                              : users.filter(
                                  (user) =>
                                    userRoleFilter === "all" ||
                                    user.role === userRoleFilter,
                                )
                            ).map((user) => {
                              const initials =
                                `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();
                              return (
                                <tr
                                  key={user.id || user.user_id || user.email}
                                  className="border-t border-slate-800 hover:bg-slate-800 transition-colors"
                                >
                                  <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                                    {user.user_id
                                      ? `USR-${String(user.user_id).slice(0, 6).toUpperCase()}`
                                      : "-"}
                                  </td>
                                  <td className="px-4 py-3 flex items-center gap-3 text-slate-100 text-sm">
                                    <span className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm shadow-lg overflow-hidden">
                                      {initials || "U"}
                                    </span>
                                    <span>
                                      {user.first_name} {user.last_name}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 text-xs font-medium">
                                      {user.role}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-slate-400 text-sm">
                                    {user.role === "BWMC"
                                      ? user.barangay_id
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
            {/* MANAGE OTHER USERS */}
            {activeTab === "manageUsers" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-2xl font-bold text-slate-100">
                    User Accounts
                  </h2>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={userAccountsSearch}
                      onChange={(e) => setUserAccountsSearch(e.target.value)}
                      placeholder="Search users..."
                      className="w-full md:w-64"
                    />
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => setShowUserFilters(!showUserFilters)}
                      className="px-2 py-2 bg-emerald-500/10 text-emerald-300 px-3 py-2 text-xs font-semibold"
                      aria-label="Toggle filters"
                    >
                      ▼
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 shadow-xl shadow-black/40">
                  <div className="p-5 md:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap gap-2">
                        {userAccountsTabs.map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setUserAccountsTab(tab)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                              userAccountsTab === tab
                                ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                    </div>

                    {showUserFilters && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-400">
                            Role
                          </Label>
                          <Select
                            value={userRoleFilter}
                            onValueChange={(value: string) =>
                              setUserRoleFilter(value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Roles</SelectItem>
                              <SelectItem value="BWMC">BWMC</SelectItem>
                              <SelectItem value="GCP">GCP</SelectItem>
                              <SelectItem value="Driver">Driver</SelectItem>
                              <SelectItem value="Collector">
                                Collector
                              </SelectItem>
                              <SelectItem value="Staff">Staff</SelectItem>
                              <SelectItem value="Barangay Staff">
                                Barangay Staff
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-400">
                            Barangay
                          </Label>
                          <Select
                            value={userBarangayFilter}
                            onValueChange={(value: string) =>
                              setUserBarangayFilter(value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Barangays</SelectItem>
                              {barangayOptions.map((barangay) => (
                                <SelectItem
                                  key={barangay.value}
                                  value={String(barangay.value)}
                                >
                                  {barangay.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-400">
                            Status
                          </Label>
                          <Select
                            value={userStatusFilter}
                            onValueChange={(value: string) =>
                              setUserStatusFilter(value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Statuses</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="archived">archived</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {otherUsersError && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {otherUsersError}
                      </div>
                    )}

                    {otherUsersSuccess && (
                      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                        {otherUsersSuccess}
                      </div>
                    )}

                    {loadingOtherUsers && <TruckLoader />}

                    {!loadingOtherUsers &&
                      filteredUserAccounts.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
                          No users match the selected filters.
                        </div>
                      )}

                    {!loadingOtherUsers && filteredUserAccounts.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-800">
                          <thead className="bg-slate-950/60">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                User ID
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Name
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Role
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Barangay
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Last Active
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                            {pagedUserAccounts.map((user) => {
                              const initials = `${user.first_name?.[0] ?? ""}${
                                user.last_name?.[0] ?? ""
                              }`;
                              const barangayName = user.barangay_id
                                ? barangayNameById.get(String(user.barangay_id))
                                : null;
                              const lastActive =
                                user.last_active ||
                                user.created_at ||
                                user.date_created;
                              return (
                                <tr key={user.user_id}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                                    USR-
                                    {String(user.user_id)
                                      .slice(0, 6)
                                      .toUpperCase()}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                                    <div className="flex items-center gap-3">
                                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-white font-bold text-sm shadow-lg overflow-hidden">
                                        {initials || "U"}
                                      </span>
                                      <span>
                                        {user.first_name} {user.last_name}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                    {user.role}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                    {barangayName || "-"}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <span
                                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                        user.status === "archived"
                                          ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                                          : user.status === "pending"
                                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                            : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                      }`}
                                    >
                                      {user.status || "Active"}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                    {lastActive
                                      ? new Date(lastActive).toLocaleString()
                                      : "-"}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <button
                                      onClick={() => handleEditUser(user)}
                                      className="text-emerald-300 hover:text-emerald-200 mr-4"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleViewUser(user)}
                                      className="text-slate-300 hover:text-slate-100 mr-4"
                                    >
                                      View
                                    </button>
                                    {[
                                      "TCEMO Head",
                                      "Secretary",
                                      "BWMC",
                                      "GCP",
                                    ].includes(user.role) && (
                                      <button
                                        onClick={() =>
                                          handleArchiveUser(
                                            String(user.user_id ?? ""),
                                            `${user.first_name} ${user.last_name}`,
                                          )
                                        }
                                        className="text-rose-300 hover:text-rose-200 text-xs"
                                      >
                                        Archive
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!loadingOtherUsers && filteredUserAccounts.length > 0 && (
                      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-400">
                        <div>
                          Showing{" "}
                          {filteredUserAccounts.length ? userStartIndex + 1 : 0}{" "}
                          to{" "}
                          {Math.min(
                            userStartIndex + userAccountsPerPage,
                            filteredUserAccounts.length,
                          )}{" "}
                          of {filteredUserAccounts.length} results
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setUserAccountsPage((prev) =>
                                Math.max(1, prev - 1),
                              )
                            }
                            disabled={currentUserPage === 1}
                            className="rounded-lg bg-slate-800 px-3 py-1 text-sm text-slate-200 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          {visibleUserPages.map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setUserAccountsPage(page)}
                              className={`rounded-lg px-3 py-1 text-sm ${
                                page === currentUserPage
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-800 text-slate-200"
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setUserAccountsPage((prev) =>
                                Math.min(totalUserPages, prev + 1),
                              )
                            }
                            disabled={currentUserPage === totalUserPages}
                            className="rounded-lg bg-slate-800 px-3 py-1 text-sm text-slate-200 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* INCIDENT REPORTS */}
            {activeTab === "incidentReports" && (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-2xl font-bold text-slate-100">
                    Community Reports
                  </h2>
                </div>

                <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 shadow-xl shadow-black/40">
                  <div className="p-5 md:p-6 space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex flex-wrap gap-2">
                        {incidentStatusTabs.map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setReportStatusFilter(tab)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                              reportStatusFilter === tab
                                ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                            }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={reportSearch}
                          onChange={(e) => setReportSearch(e.target.value)}
                          placeholder="Search reports..."
                          className="w-full md:w-64"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowReportFilters(!showReportFilters)
                          }
                          className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700"
                          aria-label="Toggle filters"
                        >
                          ▼
                        </button>
                      </div>
                    </div>

                    {showReportFilters && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-400">
                            Barangay
                          </Label>
                          <Select
                            value={selectedBarangay}
                            onValueChange={(value: string) =>
                              setSelectedBarangay(value)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Barangays</SelectItem>
                              {barangayOptions.map((barangay) => (
                                <SelectItem
                                  key={barangay.value}
                                  value={barangay.value}
                                >
                                  {barangay.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-400">
                            Sort By
                          </Label>
                          <Select
                            value={sortBy}
                            onValueChange={(value: string) => setSortBy(value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="date_desc">
                                Date (Newest First)
                              </SelectItem>
                              <SelectItem value="date_asc">
                                Date (Oldest First)
                              </SelectItem>
                              <SelectItem value="status">Status</SelectItem>
                              <SelectItem value="barangay">Barangay</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {reportsError && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                        {reportsError}
                      </div>
                    )}

                    {loadingReports && <TruckLoader />}

                    {!loadingReports &&
                      filteredIncidentReports.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
                          No reports match the selected filters.
                        </div>
                      )}

                    {!loadingReports && filteredIncidentReports.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-800">
                          <thead className="bg-slate-950/60">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Report ID
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Type
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Location
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Status
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Date
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                            {pagedIncidentReports.map((report) => (
                              <tr key={report.report_id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                                  RP-{report.report_id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                  {report.description || "Untitled"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                  {report.location || "N/A"}
                                  {report.barangay?.barangay_name
                                    ? `, ${report.barangay.barangay_name}`
                                    : ""}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                                      reportStatusClasses[
                                        report.current_status
                                      ] ??
                                      "bg-slate-800 text-slate-200 border border-slate-700"
                                    }`}
                                  >
                                    {report.current_status || "Submitted"}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                                  {report.date_submitted
                                    ? new Date(
                                        report.date_submitted,
                                      ).toLocaleString()
                                    : "-"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <button
                                    onClick={() => handleViewReport(report)}
                                    className="text-emerald-300 hover:text-emerald-200 mr-4"
                                  >
                                    View
                                  </button>
                                  <button
                                    onClick={() => handleViewHistory(report)}
                                    className="text-slate-300 hover:text-slate-100"
                                  >
                                    History
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {!loadingReports && filteredIncidentReports.length > 0 && (
                      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-400">
                        <div>
                          Showing{" "}
                          {filteredIncidentReports.length
                            ? reportStartIndex + 1
                            : 0}{" "}
                          to{" "}
                          {Math.min(
                            reportStartIndex + reportsPerPage,
                            filteredIncidentReports.length,
                          )}{" "}
                          of {filteredIncidentReports.length} results
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setReportPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentReportPage === 1}
                            className="rounded-lg bg-slate-800 px-3 py-1 text-sm text-slate-200 disabled:opacity-50"
                          >
                            Previous
                          </button>
                          {visibleReportPages.map((page) => (
                            <button
                              key={page}
                              type="button"
                              onClick={() => setReportPage(page)}
                              className={`rounded-lg px-3 py-1 text-sm ${
                                page === currentReportPage
                                  ? "bg-emerald-600 text-white"
                                  : "bg-slate-800 text-slate-200"
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() =>
                              setReportPage((prev) =>
                                Math.min(totalReportPages, prev + 1),
                              )
                            }
                            disabled={currentReportPage === totalReportPages}
                            className="rounded-lg bg-slate-800 px-3 py-1 text-sm text-slate-200 disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {historyModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-100">
                            Report History
                          </h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Location : {historyModal.title}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setHistoryModal(null)}
                          className="text-slate-400 hover:text-slate-200"
                          aria-label="Close history"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="px-5 py-4">
                        {historyModal.entries.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-400">
                            {historyModal.message ||
                              "No history records found."}
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                            {historyModal.entries.map((entry, index) => (
                              <div
                                key={`${entry.time}-${index}`}
                                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-slate-400">
                                    {entry.time}
                                  </span>
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                      reportStatusClasses[entry.status] ??
                                      "bg-slate-800 text-slate-200 border border-slate-700"
                                    }`}
                                  >
                                    {entry.status}
                                  </span>
                                </div>
                                {entry.remarks && (
                                  <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">
                                    {entry.remarks}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end border-t border-slate-800 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => setHistoryModal(null)}
                          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Report Details Modal */}
                {showReportModal && selectedReport && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
                    onClick={() => setShowReportModal(false)}
                  >
                    <div
                      className="relative w-full max-w-3xl max-h-[75vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative z-10">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-slate-800 gap-3">
                          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-red-600/20 border border-red-600/30 flex-shrink-0">
                              <span className="text-lg sm:text-2xl">🚨</span>
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                                Incident Report Details
                              </h3>
                              <p className="text-xs text-slate-400 truncate">
                                ID: #
                                {String(selectedReport.report_id).slice(0, 12)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowReportModal(false)}
                            className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700 transition-colors flex-shrink-0 text-sm"
                          >
                            ✖️
                          </button>
                        </div>

                        {/* Report Information */}
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                              <p className="text-[10px] font-medium text-slate-400 mb-1 uppercase">
                                Status
                              </p>
                              <span
                                className={`inline-flex items-center gap-2 px-2 py-1 rounded-md text-xs font-medium ${
                                  selectedReport.current_status === "Resolved"
                                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                    : selectedReport.current_status ===
                                        "Ongoing"
                                      ? "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                                      : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                                }`}
                              >
                                {selectedReport.current_status || "Pending"}
                              </span>
                            </div>

                            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                              <p className="text-[10px] font-medium text-slate-400 mb-1 uppercase">
                                Barangay
                              </p>
                              <p className="text-xs text-slate-200">
                                {selectedReport.barangay?.barangay_name ||
                                  "Unknown"}
                              </p>
                            </div>

                            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                              <p className="text-[10px] font-medium text-slate-400 mb-1 uppercase">
                                Location
                              </p>
                              <p className="text-xs text-slate-200">
                                {selectedReport.location || "N/A"}
                              </p>
                            </div>

                            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                              <p className="text-[10px] font-medium text-slate-400 mb-1 uppercase">
                                Date Submitted
                              </p>
                              <p className="text-xs text-slate-200">
                                {new Date(
                                  selectedReport.date_submitted,
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>

                          {selectedReport.landmark && (
                            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                              <p className="text-[10px] font-medium text-slate-400 mb-2 uppercase">
                                Landmark
                              </p>
                              <p className="text-xs text-slate-200">
                                {selectedReport.landmark}
                              </p>
                            </div>
                          )}

                          {selectedReport.description && (
                            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                              <p className="text-[10px] font-medium text-slate-400 mb-2 uppercase">
                                Description
                              </p>
                              <p className="text-xs text-slate-200 whitespace-pre-wrap">
                                {selectedReport.description}
                              </p>
                            </div>
                          )}

                          {selectedReport.image_url && (
                            <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
                              <p className="text-[10px] font-medium text-slate-400 mb-2 uppercase">
                                Attached Image
                              </p>
                              <img
                                src={selectedReport.image_url}
                                alt="Report evidence"
                                className="w-full rounded-lg border border-slate-700"
                              />
                            </div>
                          )}
                        </div>

                        {/* Close Button */}
                        <div className="mt-6 pt-6 border-t border-slate-700/50">
                          <button
                            onClick={() => setShowReportModal(false)}
                            className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-medium text-slate-200 transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* REPORTS */}
            {activeTab === "reports" && (
              <section className="space-y-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-semibold">
                      Analytics
                    </p>
                    <h1 className="text-2xl font-bold text-slate-100 md:text-3xl">
                      Generate Reports
                    </h1>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    onClick={() => setActiveReportOption("wasteCollection")}
                    variant={
                      activeReportOption === "wasteCollection"
                        ? "default"
                        : "outline"
                    }
                    className={
                      activeReportOption === "wasteCollection"
                        ? ""
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-500/50"
                    }
                  >
                    📊 Waste Collection
                  </Button>
                  <Button
                    onClick={() => setActiveReportOption("barangayConcerns")}
                    variant={
                      activeReportOption === "barangayConcerns"
                        ? "default"
                        : "outline"
                    }
                    className={
                      activeReportOption === "barangayConcerns"
                        ? ""
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-500/50"
                    }
                  >
                    🚩 Barangay Concerns
                  </Button>
                </div>

                {activeReportOption === "wasteCollection" && (
                  <ReportsAnalytics />
                )}

                {activeReportOption === "barangayConcerns" && (
                  <>
                    {/* dropdown to choose barangay before showing chart */}
                    <div className="mb-4">
                      <Label className="text-xs font-semibold text-slate-100">
                        Select Barangay
                      </Label>
                      <select
                        className="mt-1 block w-full rounded-md bg-slate-900/80 border border-slate-700 text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={reportBarangayId}
                        onChange={(e) => setReportBarangayId(e.target.value)}
                      >
                        <option value="">-- choose barangay --</option>
                        {barangayOptions.map((b) => (
                          <option key={b.value} value={String(b.value)}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {reportBarangayId ? (
                      <BarangayConcernsAnalytics
                        barangayId={Number(reportBarangayId) || undefined}
                      />
                    ) : (
                      <p className="text-xs text-slate-400">
                        Please select a barangay to view the chart.
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            {activeTab === "manageAccount" && (
              <div className="dashboard-section max-w-2xl mx-auto">
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

            {/* Edit User Modal */}
            {showEditUserModal && editingUserForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
                <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  {/* Modal Header */}
                  <div className="sticky top-0 flex items-center justify-between bg-slate-950 border-b border-slate-800 p-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-emerald-600/20 flex items-center justify-center border border-emerald-600/30">
                        <span className="text-xl">✏️</span>
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-100">
                          {isViewOnly
                            ? "View User Account"
                            : "Edit User Account"}
                        </h2>
                        <p className="text-xs text-slate-400 mt-1">
                          {isViewOnly
                            ? "User details (read-only)"
                            : "Update user information"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleCancelEdit}
                      className="text-slate-400 hover:text-slate-100 transition-colors text-2xl leading-none"
                      aria-label="Close modal"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-4">
                    {/* Error/Success Messages */}
                    {otherUsersError && (
                      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                        {otherUsersError}
                      </div>
                    )}
                    {otherUsersSuccess && (
                      <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
                        {otherUsersSuccess}
                      </div>
                    )}

                    {/* Form Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-300">
                          First Name
                        </Label>
                        <Input
                          type="text"
                          value={editingUserForm.first_name}
                          onChange={(e) =>
                            setEditingUserForm({
                              ...editingUserForm,
                              first_name: sanitizeNameField(e.target.value),
                            })
                          }
                          disabled={isViewOnly}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-300">
                          Last Name
                        </Label>
                        <Input
                          type="text"
                          value={editingUserForm.last_name}
                          onChange={(e) =>
                            setEditingUserForm({
                              ...editingUserForm,
                              last_name: sanitizeNameField(e.target.value),
                            })
                          }
                          disabled={isViewOnly}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">
                        📧 Email Address (read-only)
                      </Label>
                      <Input
                        type="email"
                        value={editingUserForm.email}
                        readOnly
                        className="bg-slate-800 cursor-not-allowed"
                        onClick={() =>
                          /* no-op: email is not editable in this view */
                          null
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-300">
                        📱 Contact Number
                      </Label>
                      <Input
                        type="tel"
                        value={editingUserForm.contact_number}
                        onChange={(e) =>
                          setEditingUserForm({
                            ...editingUserForm,
                            contact_number: e.target.value,
                          })
                        }
                        disabled={isViewOnly}
                      />
                      {editingUserForm.contact_number &&
                        !/^09\d{9}$/.test(editingUserForm.contact_number) && (
                          <p className="text-xs text-red-400">
                            Number must start with 09 and be 11 digits
                          </p>
                        )}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 p-6 flex gap-3">
                    {!isViewOnly && (
                      <Button
                        onClick={() => handleSaveUserEdit(editingUserId || "")}
                        className="flex-1"
                      >
                        <span>💾</span>
                        Save Changes
                      </Button>
                    )}
                    <Button onClick={handleCancelEdit} className="flex-1">
                      <span>✖️</span>
                      {isViewOnly ? "Close" : "Cancel"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
