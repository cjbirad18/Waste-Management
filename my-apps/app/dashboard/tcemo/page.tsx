"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";

import ReportsAnalytics from "../../generatereport/generatereport";
import BarangayConcernsAnalytics from "../../generatereport/barangayconcern";

import TruckLoader from "../../loading/TruckLoader";
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
      />
    </div>
  );
}

export default function TcemoDashboard() {
  const router = useRouter();

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
    "dashboard" | "manageUsers" | "manageAccount" | "generateReports"
  >("dashboard");

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

  // Reports
  const [activeReportOption, setActiveReportOption] =
    useState<ReportOption>("wasteCollection");
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
  }, []);

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
  const validateUserForm = () => {
    if (
      !userForm.first_name.trim() ||
      !userForm.last_name.trim() ||
      !userForm.email.trim() ||
      !userForm.contact_number.trim() ||
      !userForm.password.trim()
    ) {
      return "All fields are required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userForm.email)) return "Invalid email format";
    if (userForm.password.length < 6)
      return "Password must be at least 6 characters";
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
    if (manageAccountForm.password || manageAccountForm.confirm_password) {
      if (manageAccountForm.password.length < 6)
        return "New password must be at least 6 characters.";
      if (manageAccountForm.password !== manageAccountForm.confirm_password)
        return "Passwords do not match.";
    }
    return null;
  };

  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
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
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  const handleAddUser = async (e: FormEvent) => {
    e.preventDefault();
    const activeSWMO = swmoHeads.find((u) => u.status === "Active"); // changed

    if (activeSWMO) {
      window.alert(
        "An SWMO Head account is currently active. Please deactivate the account before creating a new one.",
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
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userForm.email,
        password: userForm.password,
      });
      if (authError) {
        setFormError(`Account creation error: ${authError.message}`);
        return;
      }
      if (!authData?.user) {
        setFormError("User not found after sign up.");
        return;
      }
      const userId = authData.user.id;
      const uniqueUsername = `swmohead_${Date.now()}`;
      const { error: insertError } = await supabase.from("users").insert([
        {
          user_id: userId,
          username: uniqueUsername,
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          email: userForm.email,
          contact_number: userForm.contact_number,
          role: "SWMO Head",
          status: "active", // changed
        },
      ]);
      if (insertError) {
        setFormError(`Error saving user profile: ${insertError.message}`);
        return;
      }
      setFormSuccess(
        `User account created successfully! Username: ${uniqueUsername}`,
      );
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
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-slate-900/80 text-slate-100 hover:bg-slate-800 transition-colors flex-shrink-0 ring-1 ring-white/10"
            >
              <span className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-900 border-2 border-slate-700 text-white font-bold text-lg shadow-lg overflow-hidden">
                {initials}
              </span>
            </button>
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
              { label: "Generate Report", icon: "📈", tab: "generateReports" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveTab(
                    item.tab as
                      | "dashboard"
                      | "manageUsers"
                      | "generateReports"
                      | "manageAccount",
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
                  <form
                    onSubmit={handleAddUser}
                    className="space-y-2"
                    noValidate
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
                                {swmoHeadsPage.map((user) => (
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
                                      {user.status.toLowerCase() ===
                                      "active" ? (
                                        <Button
                                          variant="destructive"
                                          onClick={() =>
                                            openConfirmModal(
                                              "deactivate",
                                              user.user_id,
                                              `${user.first_name} ${user.last_name}`,
                                            )
                                          }
                                        >
                                          Deactivate
                                        </Button>
                                      ) : (
                                        <Button
                                          onClick={() =>
                                            openConfirmModal(
                                              "activate",
                                              user.user_id,
                                              `${user.first_name} ${user.last_name}`,
                                            )
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
                            {/* Pagination controls for SWMO Head list */}
                            {swmoTotalPages > 1 && (
                              <div className="flex justify-center items-center gap-2 mt-4">
                                <Button
                                  disabled={swmoPage === 1}
                                  onClick={() => setSwmoPage(swmoPage - 1)}
                                  variant="outline"
                                >
                                  Prev
                                </Button>
                                <span className="text-xs text-slate-300">
                                  Page {swmoPage} of {swmoTotalPages}
                                </span>
                                <Button
                                  disabled={swmoPage === swmoTotalPages}
                                  onClick={() => setSwmoPage(swmoPage + 1)}
                                  variant="outline"
                                >
                                  Next
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label
                        className="block mb-1 text-xs font-medium text-slate-300"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={userForm.password}
                          onChange={handleUserFormChange}
                          placeholder="Password"
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-slate-400 text-xs"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <Button type="submit" className="h-auto">
                        Add User
                      </Button>
                    </div>
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
                                      openConfirmModal(
                                        "deactivate",
                                        user.user_id,
                                        `${user.first_name} ${user.last_name}`,
                                      )
                                    }
                                  >
                                    Deactivate
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() =>
                                      openConfirmModal(
                                        "activate",
                                        user.user_id,
                                        `${user.first_name} ${user.last_name}`,
                                      )
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

              {activeReportOption === "wasteCollection" && <ReportsAnalytics />}

              {activeReportOption === "barangayConcerns" && (
                <BarangayConcernsAnalytics />
              )}
            </section>
          )}

          {/* MANAGE ACCOUNT – card style */}
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
    <section className="max-w-3xl mx-auto rounded-lg bg-slate-900 border border-slate-800 p-6">
      <div className="relative z-10">
        <h2 className="text-lg font-bold mb-4 text-slate-100">
          Manage Account
        </h2>
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
    </section>
  );
}
