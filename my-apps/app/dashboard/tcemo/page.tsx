"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";

// utility used by several dashboards for creating temporary passwords
function generateTempPassword(length = 12) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import ReportsAnalytics from "../../generatereport/generatereport";
import BarangayConcernsAnalytics from "../../generatereport/barangayconcern";
import TruckLoader from "../../loading/TruckLoader";
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

type ReportOption = "wasteCollection" | "barangayConcerns";

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
        autoComplete="off"
        disabled={disabled}
        readOnly={disabled}
        className={disabled ? "cursor-not-allowed opacity-60" : undefined}
      />
    </div>
  );
}

export default function TcemoDashboard() {
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

  // SWMO Head Management
  const [swmoHeads, setSwmoHeads] = useState<User[]>([]);
  const [loadingSWMOHeads, setLoadingSWMOHeads] = useState(false);
  const [swmoPage, setSwmoPage] = useState(1);
  const swmoPageSize = 5; // Show 5 per page
  const swmoTotalPages = Math.ceil(swmoHeads.length / swmoPageSize);
  const swmoHeadsPage = swmoHeads.slice(
    (swmoPage - 1) * swmoPageSize,
    swmoPage * swmoPageSize,
  );

  const fetchSWMOHeads = useCallback(async () => {
    setLoadingSWMOHeads(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("role", "SWMO Head");
      if (error) throw error;
      setSwmoHeads(data || []);
    } catch {
      setSwmoHeads([]);
    } finally {
      setLoadingSWMOHeads(false);
    }
  }, []);

  // Layout state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statsVisible, setStatsVisible] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  // Confirmation modal state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmModalAction, setConfirmModalAction] = useState<
    "activate" | "deactivate" | null
  >(null);
  const [confirmModalTarget, setConfirmModalTarget] = useState<{
    userId: string;
    name?: string;
  } | null>(null);
  const [confirmModalLoading, setConfirmModalLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "manageUsers"
    | "manageAccount"
    | "generateReports"
    | "schedules"
    | "incidentReports"
  >("dashboard");
  const [tabFadeIn, setTabFadeIn] = useState(false);

  // Restore active tab from localStorage and keep it in sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedTab = localStorage.getItem("tcemo_active_tab");
    if (
      storedTab === "dashboard" ||
      storedTab === "manageUsers" ||
      storedTab === "manageAccount" ||
      storedTab === "generateReports" ||
      storedTab === "schedules" ||
      storedTab === "incidentReports"
    ) {
      setActiveTab(storedTab);
    }
  }, []);

  useEffect(() => {
    setTabFadeIn(false);
    const timeoutId = window.setTimeout(() => {
      setTabFadeIn(true);
    }, 50);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("tcemo_active_tab", activeTab);
  }, [activeTab]);

  // Incident Reports State (copied from SWMO Head dashboard)
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

  const fetchIncidentReports = useCallback(async () => {
    setLoadingReports(true);
    setReportsError(null);
    try {
      let query = supabase.from("community_reports").select(
        `
          *,
          barangay:barangay_id (
            barangay_name
          )
        `,
      );

      if (selectedBarangay !== "all") {
        query = query.eq("barangay_id", selectedBarangay);
      }

      const { data, error } = await query;
      if (error) throw error;

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

  useEffect(() => {
    fetchIncidentReports();

    const channel = supabase
      .channel("tcemo-incident-reports-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => fetchIncidentReports(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchIncidentReports]);

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

  useEffect(() => {
    setReportPage(1);
  }, [reportSearch, reportStatusFilter, selectedBarangay, sortBy]);

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
    }

    fetchDisplayName();
  }, []);

  // Add SWMO Head form
  const [userForm, setUserForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    password: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Manage Account
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

  // Schedules
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [schedulesBarangayFilter, setSchedulesBarangayFilter] =
    useState<string>("all");
  const [schedulesBarangays, setSchedulesBarangays] = useState<
    { barangay_id: number | string; barangay_name: string }[]
  >([]);
  const [schedulesSearch, setSchedulesSearch] = useState("");
  const [schedulesPage, setSchedulesPage] = useState(1);
  const schedulesPageSize = 10;

  // Reports
  const [activeReportOption, setActiveReportOption] =
    useState<ReportOption>("wasteCollection");

  // when generating barangay concerns report the user must pick a barangay first
  const [reportBarangayId, setReportBarangayId] = useState<string>("");
  const [barangayOptions, setBarangayOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const [wasteCollectionData, setWasteCollectionData] = useState<
    { month: string; tons: number }[]
  >([]);

  const [responseDetails, setResponseDetails] = useState<{
    [key: number]: string;
  }>({});

  // Summary Counts
  const [counts, setCounts] = useState({
    residents: 0,
    gcps: 0,
    barangays: 0,
    incidentReports: 0,
  });

  // ---------- Fetch Users ----------
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

    const channel = supabase
      .channel("tcemo-users-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => {
          fetchUsers();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]);

  useEffect(() => {
    fetchSWMOHeads();
  }, [fetchSWMOHeads, users]);

  // ---------- Summary Cards ----------
  useEffect(() => {
    async function fetchCounts() {
      let residentCount = 0,
        gcpCount = 0,
        barangayCount = 0,
        reportCount = 0;
      try {
        const { count, error } = await supabase
          .from("users")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "Resident");
        residentCount = error ? 0 : count || 0;
      } catch {
        residentCount = 0;
      }
      try {
        const { count, error } = await supabase
          .from("users")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "GCP");
        gcpCount = error ? 0 : count || 0;
      } catch {
        gcpCount = 0;
      }
      try {
        const { count, error } = await supabase
          .from("users")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "BWMC");
        barangayCount = error ? 0 : count || 0;
      } catch {
        barangayCount = 0;
      }
      try {
        const { count, error } = await supabase
          .from("community_reports")
          .select("report_id", { count: "exact", head: true });
        reportCount = error ? 0 : count || 0;
      } catch {
        reportCount = 0;
      }
      setCounts({
        residents: residentCount,
        gcps: gcpCount,
        barangays: barangayCount,
        incidentReports: reportCount,
      });
    }
    fetchCounts();

    const channel = supabase
      .channel("tcemo-counts-realtime")
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

  // ---------- Fetch Schedules ----------
  useEffect(() => {
    async function fetchBarangays() {
      try {
        const { data, error } = await supabase
          .from("barangay")
          .select("barangay_id, barangay_name")
          .order("barangay_name", { ascending: true });
        if (error) throw error;
        setSchedulesBarangays(data || []);
      } catch {}
    }
    fetchBarangays();
  }, []);

  // convert the list we already fetch for schedules into select options
  useEffect(() => {
    setBarangayOptions(
      schedulesBarangays.map((b) => ({
        value: String(b.barangay_id),
        label: b.barangay_name,
      })),
    );
  }, [schedulesBarangays]);

  const fetchSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    setSchedulesError(null);
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
          start_time,
          end_time,
          status,
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
    } catch (err) {
      setSchedulesError((err as Error).message || "Failed to load schedules.");
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();

    const channel = supabase
      .channel("tcemo-schedules-realtime")
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
  }, [fetchSchedules]);

  // Filtered & searched schedules
  const filteredSchedules = schedules.filter((s) => {
    const matchesBarangay =
      schedulesBarangayFilter === "all" ||
      String(s.barangay?.barangay_id) === schedulesBarangayFilter;
    const matchesSearch =
      !schedulesSearch ||
      (s.barangay?.barangay_name || "")
        .toLowerCase()
        .includes(schedulesSearch.toLowerCase()) ||
      (s.days || "").toLowerCase().includes(schedulesSearch.toLowerCase()) ||
      `${s.gcp_user?.first_name || ""} ${s.gcp_user?.last_name || ""}`
        .toLowerCase()
        .includes(schedulesSearch.toLowerCase());
    return matchesBarangay && matchesSearch;
  });

  const schedulesTotalPages = Math.ceil(
    filteredSchedules.length / schedulesPageSize,
  );
  const paginatedSchedules = filteredSchedules.slice(
    (schedulesPage - 1) * schedulesPageSize,
    schedulesPage * schedulesPageSize,
  );

  const summaryCards = [
    {
      label: "Residents Registered",
      icon: "👤",
      count: counts.residents,
    },
    {
      label: "GCP Registered",
      icon: "🛠️",
      count: counts.gcps,
    },
    {
      label: "Barangays Registered",
      icon: "🌏",
      count: counts.barangays,
    },
    {
      label: "Incident Reports",
      icon: "🗑️",
      count: counts.incidentReports,
    },
  ];

  // ---------- Helpers ----------
  const nameRegex = /^[A-Za-z\s]+$/;
  const sanitizeNameField = (value: string) =>
    value.replace(/[^A-Za-z\s]/g, "");

  const validateUserForm = () => {
    if (
      !userForm.first_name.trim() ||
      !userForm.last_name.trim() ||
      !userForm.email.trim() ||
      !userForm.contact_number.trim()
    ) {
      return "All fields are required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userForm.email)) return "Invalid email format";
    if (
      !nameRegex.test(userForm.first_name) ||
      !nameRegex.test(userForm.last_name)
    )
      return "First and last names can only contain letters and spaces.";
    return null;
  };

  const validateManageAccountForm = () => {
    if (
      !manageAccountForm.first_name.trim() ||
      !manageAccountForm.last_name.trim() ||
      !manageAccountForm.username.trim() ||
      !manageAccountForm.email.trim() ||
      !manageAccountForm.contact_number.trim()
    ) {
      return "All fields except password fields are required.";
    }
    if (
      !nameRegex.test(manageAccountForm.first_name) ||
      !nameRegex.test(manageAccountForm.last_name)
    )
      return "First and last names can only contain letters and spaces.";
    if (manageAccountForm.password || manageAccountForm.confirm_password) {
      if (manageAccountForm.password.length < 6)
        return "New password must be at least 6 characters.";
      if (manageAccountForm.password !== manageAccountForm.confirm_password)
        return "Passwords do not match.";
    }
    return null;
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

  // ---------- Load current TCEMO account ----------
  useEffect(() => {
    async function loadAccount() {
      setManageAccountLoading(true);
      try {
        const { data: authUserData, error: authError } =
          await supabase.auth.getUser();
        if (!authUserData?.user || authError) {
          setManageAccountError("Could not load account info.");
          setManageAccountLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("users")
          .select("username, first_name, last_name, email, contact_number")
          .eq("user_id", authUserData.user.id)
          .single();
        if (error || !data) {
          setManageAccountError("Profile not found.");
          setManageAccountLoading(false);
          return;
        }

        setManageAccountForm((prev) => ({
          ...prev,
          username: data.username || "",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          contact_number: data.contact_number || "",
          password: "",
          confirm_password: "",
        }));
        setManageAccountLoading(false);
      } catch {
        setManageAccountError("Unexpected error loading account.");
        setManageAccountLoading(false);
      }
    }
    loadAccount();
  }, []);

  const handleUserFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === "first_name" || e.target.name === "last_name") {
      setUserForm({
        ...userForm,
        [e.target.name]: sanitizeNameField(e.target.value),
      });
      return;
    }
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  // Derived: check if any SWMO Head is currently active
  const activeSWMOHead = swmoHeads.find(
    (u) => u.status.toLowerCase() === "active",
  );

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();

    if (activeSWMOHead) {
      setFormError(
        `An SWMO Head account (${activeSWMOHead.email}) is currently active. Please deactivate it before creating a new one.`,
      );
      return;
    }
    setFormError(null);
    setFormSuccess(null);
    const validationError = validateUserForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    // Check if email already exists in users table
    const { data: existingUser, error: emailCheckError } = await supabase
      .from("users")
      .select("email, status")
      .eq("email", userForm.email.trim())
      .maybeSingle();

    if (emailCheckError) {
      setFormError(`Error checking email: ${emailCheckError.message}`);
      return;
    }

    if (existingUser) {
      if (existingUser.status?.toLowerCase() === "active") {
        setFormError(
          "This email is already associated with an active account. Please use a different email.",
        );
      } else {
        setFormError(
          "This email already exists in the system. Please use a different email or reactivate the existing account.",
        );
      }
      return;
    }

    try {
      const tempPassword = generateTempPassword(10);
      // call backend admin create
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: userForm.email,
          username: `swmohead_${Date.now()}`,
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          contact_number: userForm.contact_number,
          role: "SWMO Head",
          tempPassword,
        }),
      });
      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Server returned invalid JSON: ${text}`);
      }
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || `Failed to create user: ${text}`);
      }
      const userId = payload.userId;
      const uniqueUsername = `swmohead_${Date.now()}`;
      setFormSuccess(
        `User account created successfully! Username: ${uniqueUsername}`,
      );
      // send notification with temp password
      try {
        const notifRes = await fetch("/api/notifications/account-created/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            role: "SWMO Head",
            createdBy: "TCEMO Head",
            tempPassword,
          }),
        });
        const notifData = await notifRes.json();
        if (!notifRes.ok) {
          console.error("Notification API error:", notifData.error);
        }
      } catch (notifErr) {
        console.error("Notification API call failed:", notifErr);
      }
      setUserForm({
        first_name: "",
        last_name: "",
        email: "",
        contact_number: "",
        password: "",
      });
      fetchUsers();
      fetchSWMOHeads();
    } catch (err) {
      setFormError(`Unexpected error: ${(err as Error).message}`);
    }
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

  const handleLogout = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to logout?")
    ) {
      localStorage.removeItem("authToken");
      router.push("/");
    }
  };

  const handleDeactivateSWMOHead = async (userId: string) => {
    // open confirm modal for deactivation
    setConfirmModalAction("deactivate");
    setConfirmModalTarget({ userId });
    setConfirmModalOpen(true);
  };

  const handleActivateSWMOHead = async (userId: string) => {
    // Prevent activating if another SWMO Head is already active
    const alreadyActive = swmoHeads.find(
      (u) => u.status.toLowerCase() === "active" && u.user_id !== userId,
    );
    if (alreadyActive) {
      window.alert(
        `Cannot activate: SWMO Head account (${alreadyActive.email}) is still active. Deactivate it first.`,
      );
      return;
    }
    // open confirm modal for activation
    setConfirmModalAction("activate");
    setConfirmModalTarget({ userId });
    setConfirmModalOpen(true);
  };

  const performConfirmAction = async () => {
    if (!confirmModalAction || !confirmModalTarget) return;
    setConfirmModalLoading(true);
    try {
      if (confirmModalAction === "deactivate") {
        const { error } = await supabase
          .from("users")
          .update({ status: "Inactive" })
          .eq("user_id", confirmModalTarget.userId);
        if (error) throw error;
      } else if (confirmModalAction === "activate") {
        const { error } = await supabase
          .from("users")
          .update({ status: "active" })
          .eq("user_id", confirmModalTarget.userId);
        if (error) throw error;
      }
      await fetchUsers();
      await fetchSWMOHeads();
    } catch (err) {
      // fallback alert
      if (typeof window !== "undefined")
        window.alert("Action failed: " + (err as Error).message);
    } finally {
      setConfirmModalLoading(false);
      setConfirmModalOpen(false);
      setConfirmModalAction(null);
      setConfirmModalTarget(null);
    }
  };

  const openConfirmModal = (
    action: "activate" | "deactivate",
    userId: string,
    name?: string,
  ) => {
    setConfirmModalAction(action);
    setConfirmModalTarget({ userId, name });
    setConfirmModalOpen(true);
  };

  // ---------- Render ----------

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
        <div className="flex items-center justify-between px-2 sm:px-4 md:px-8 py-3 sm:py-4 min-h-16">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
            <button
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-slate-900/80 text-slate-100 hover:bg-slate-800 transition-colors flex-shrink-0 ring-1 ring-white/10"
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
                  TCEMO Dashboard
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
                className={`w-4 h-4 text-slate-300 transition-transform duration-300 ${profileDropdownOpen ? "rotate-180" : ""}`}
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

        {/* Sidebar */}
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
            {/* You'll need to replace SidebarItem with this inline version */}
            {[
              { label: "Dashboard", icon: "📊", tab: "dashboard" },
              { label: "Manage Users", icon: "👥", tab: "manageUsers" },
              { label: "Incident Reports", icon: "🚩", tab: "incidentReports" },
              { label: "Generate Report", icon: "📈", tab: "generateReports" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveTab(
                    item.tab as
                      | "dashboard"
                      | "manageUsers"
                      | "schedules"
                      | "generateReports"
                      | "manageAccount"
                      | "incidentReports",
                  );
                  if (item.tab !== "dashboard") setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                  activeTab === item.tab
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </button>
            ))}

            <div className="pt-6 mt-6 border-t border-slate-800"></div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 lg:px-10 py-10 space-y-10 relative z-10 md:ml-64 bg-slate-900/40">
          <div
            className={`transition-opacity duration-300 ease-in-out ${
              tabFadeIn ? "opacity-100" : "opacity-0"
            }`}
            key={activeTab}
          >
            {/* DASHBOARD */}
            {activeTab === "dashboard" && (
              <>
                <section className="space-y-6">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                        onClick={() => setStatsVisible(!statsVisible)}
                        variant="outline"
                        className="h-auto border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-500/50"
                      >
                        {statsVisible ? "Hide Stats" : "Show Stats"}
                      </Button>
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 text-emerald-300 px-3 py-2 text-xs font-semibold">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        Live
                      </span>
                    </div>
                  </div>

                  {/* Collapsible Stats Section */}
                  {statsVisible && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      {summaryCards.map((card, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-800/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40"
                          role="region"
                          aria-label={card.label}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-slate-400 text-sm">
                                {card.label}
                              </p>
                              <h3 className="text-2xl font-bold text-slate-100">
                                {card.count}
                              </h3>
                              <p className="text-sm text-emerald-400 font-medium">
                                ↑ Active
                              </p>
                            </div>
                            <div className="bg-emerald-500/15 text-emerald-300 p-3 rounded-full text-xl">
                              {card.icon}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Map Section with Toggle Button */}
                  <section>
                    <div className="dashboard-section overflow-hidden">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-100">
                          Live Truck Tracking
                        </h2>
                        <div className="flex items-center gap-2">
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
                </section>
              </>
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
                                  {report.location}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                  {report.current_status}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                  {report.date_submitted
                                    ? new Date(
                                        report.date_submitted,
                                      ).toLocaleString()
                                    : "N/A"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-200">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setSelectedReport(report);
                                        setShowReportModal(true);
                                      }}
                                    >
                                      View
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleViewHistory(report)}
                                    >
                                      History
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {totalReportPages > 1 && (
                      <div className="flex justify-center items-center gap-3 mt-4">
                        <Button
                          disabled={currentReportPage === 1}
                          onClick={() => setReportPage(currentReportPage - 1)}
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-500/50"
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-slate-300">
                          Page {currentReportPage} of {totalReportPages} (
                          {filteredIncidentReports.length} total)
                        </span>
                        <Button
                          disabled={currentReportPage === totalReportPages}
                          onClick={() => setReportPage(currentReportPage + 1)}
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 hover:border-emerald-500/50"
                        >
                          Next
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* History Modal */}
            {historyModal && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
                onClick={() => setHistoryModal(null)}
              >
                <div
                  className="relative w-full max-w-3xl max-h-[75vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-slate-800 gap-3">
                    <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-blue-600/20 border border-blue-600/30 flex-shrink-0">
                        <span className="text-lg sm:text-2xl">🕘</span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-slate-100 truncate">
                          History: {historyModal.title}
                        </h3>
                        <p className="text-xs text-slate-400 truncate">
                          Most recent updates first
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setHistoryModal(null)}
                      className="rounded-lg bg-slate-800 px-3 py-2 text-slate-300 hover:bg-slate-700 transition-colors flex-shrink-0 text-sm"
                    >
                      ✖️
                    </button>
                  </div>

                  {historyModal.entries.length === 0 ? (
                    <div className="rounded-lg border border-slate-800/70 bg-slate-900/80 p-6 text-sm text-slate-300">
                      {historyModal.message || "No history records found."}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyModal.entries.map((entry, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-slate-800/70 bg-slate-900/80 p-4"
                        >
                          <div className="flex items-center justify-between text-xs text-slate-400">
                            <span>{entry.status}</span>
                            <span>{entry.time}</span>
                          </div>
                          <p className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">
                            {entry.remarks || "No remarks."}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

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
                          ID: #{String(selectedReport.report_id).slice(0, 12)}
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
                              : selectedReport.current_status === "Ongoing"
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
                          {selectedReport.barangay?.barangay_name || "Unknown"}
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

                  <div className="flex justify-end border-t border-slate-800 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setShowReportModal(false)}
                      className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
            {/* USER ADMIN – Add SWMO Head + list, styled */}
            {activeTab === "manageUsers" && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Form */}
                <div className="dashboard-section overflow-hidden">
                  <div className="relative z-10">
                    <h2 className="text-lg font-bold mb-2 text-slate-100">
                      Add New SWMO Head
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">
                      Create an account for the Solid Waste Management Office
                      head.
                    </p>
                    {activeSWMOHead && (
                      <div className="px-3 py-2 mb-4 bg-yellow-500/10 text-yellow-300 border border-yellow-500/30 rounded-lg text-xs">
                        An SWMO Head account (
                        <strong>{activeSWMOHead.email}</strong>) is currently
                        active. Deactivate it first to create a new one.
                      </div>
                    )}
                    <form
                      onSubmit={handleAddUser}
                      className="space-y-2"
                      noValidate
                    >
                      <fieldset
                        disabled={!!activeSWMOHead}
                        className="disabled:opacity-50"
                      >
                        {formError && (
                          <div className="px-3 py-2 bg-red-500/10 text-red-300 border border-red-500/30 rounded-lg text-xs">
                            {formError}
                          </div>
                        )}
                        {formSuccess && (
                          <div className="px-3 py-2 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs">
                            {formSuccess}
                          </div>
                        )}
                        <InputField
                          label="First Name"
                          name="first_name"
                          type="text"
                          value={userForm.first_name}
                          onChange={handleUserFormChange}
                          required
                        />
                        <InputField
                          label="Last Name"
                          name="last_name"
                          type="text"
                          value={userForm.last_name}
                          onChange={handleUserFormChange}
                          required
                        />
                        <InputField
                          label="Contact Number"
                          name="contact_number"
                          type="tel"
                          value={userForm.contact_number}
                          onChange={handleUserFormChange}
                          required
                        />
                        <InputField
                          label="Email"
                          name="email"
                          type="email"
                          value={userForm.email}
                          onChange={handleUserFormChange}
                          required
                        />

                        {/* password is autogenerated and sent via SMS */}
                        <p className="text-xs text-slate-400 mb-4">
                          A temporary password will be generated automatically
                          and delivered to the new SWMO Head by SMS. They will
                          be required to change it when they first log in.
                        </p>
                        <div className="flex justify-end mt-4">
                          <Button
                            type="submit"
                            className="h-auto"
                            disabled={!!activeSWMOHead}
                          >
                            Add User
                          </Button>
                        </div>
                      </fieldset>
                    </form>
                  </div>
                </div>

                {/* SWMO Head list */}
                <div className="dashboard-section overflow-hidden">
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold mb-3 text-slate-100">
                      SWMO Head Accounts
                    </h3>
                    {loadingSWMOHeads ? (
                      <TruckLoader />
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-800 text-slate-200 sticky top-0 z-10">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-medium">
                                Name
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium hidden sm:table-cell">
                                Email
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium">
                                Status
                              </th>
                              <th className="px-3 py-2 text-left text-xs font-medium">
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {swmoHeads.map((user) => (
                              <tr
                                key={user.user_id}
                                className="border-t border-slate-800 hover:bg-slate-800 transition-colors"
                              >
                                <td className="px-3 py-2">
                                  {user.first_name} {user.last_name}
                                  <div className="sm:hidden text-xs text-slate-400">
                                    {user.email}
                                  </div>
                                </td>
                                <td className="px-3 py-2 hidden sm:table-cell">
                                  {user.email}
                                </td>
                                <td className="px-3 py-2 capitalize">
                                  {user.status}
                                </td>
                                <td className="px-3 py-2">
                                  {user.status.toLowerCase() === "active" ? (
                                    <Button
                                      variant="destructive"
                                      onClick={() =>
                                        handleDeactivateSWMOHead(user.user_id)
                                      }
                                    >
                                      Deactivate
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={() =>
                                        handleActivateSWMOHead(user.user_id)
                                      }
                                    >
                                      Activate
                                    </Button>
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
              </section>
            )}

            {activeTab === "generateReports" && (
              <section className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-600 font-semibold">
                      Analytics
                    </p>
                    <h1 className="text-2xl font-bold text-slate-100 md:text-3xl">
                      Generate Reports
                    </h1>
                  </div>
                </div>

                <div className="flex gap-3">
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

            {/* MANAGE ACCOUNT – card style */}
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
          </div>

          {/* Confirmation Modal */}
          {confirmModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div
                className="fixed inset-0 bg-black/60"
                onClick={() => setConfirmModalOpen(false)}
                aria-hidden="true"
              />
              <div className="relative z-50 max-w-lg w-full mx-4">
                <div className="dashboard-section">
                  <h3 className="text-lg font-bold mb-2 text-slate-100">
                    {confirmModalAction === "activate"
                      ? "Activate Account"
                      : "Deactivate Account"}
                  </h3>
                  <p className="text-sm text-slate-300 mb-4">
                    Are you sure you want to{" "}
                    {confirmModalAction === "activate"
                      ? "activate"
                      : "deactivate"}{" "}
                    {confirmModalTarget?.name ?? "this account"}?
                  </p>
                  <div className="flex justify-end gap-3">
                    <Button
                      variant="secondary"
                      type="button"
                      onClick={() => {
                        setConfirmModalOpen(false);
                        setConfirmModalAction(null);
                        setConfirmModalTarget(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={performConfirmAction}
                      disabled={confirmModalLoading}
                    >
                      {confirmModalLoading ? "Please wait..." : "Confirm"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
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
}) {
  if (loading) return <TruckLoader />;
  return (
    <div className="max-w-5xl mx-auto rounded-lg bg-slate-900 border border-slate-800 px-6 py-6">
      <h2 className="text-lg font-bold mb-4 text-slate-100">Manage Account</h2>
      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 text-red-300 border border-red-500/30 text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs">
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
        <div className="flex justify-end mt-6">
          <Button type="submit">Update Account</Button>
        </div>
      </form>
    </div>
  );
}
