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
    <div className="mb-4">
      <label htmlFor={name} className="block mb-1 font-semibold text-slate-100">
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
        className="w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-900/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-900/80 text-slate-200 flex flex-col relative overflow-hidden">
      {/* Subtle background animation */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 animate-pulse" />
      </div>

      {/* Top navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-green-800/40 bg-slate-900/95 backdrop-blur-2xl shadow-xl shadow-green-900/20">
        <div className="flex items-center justify-between px-4 md:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-12 w-12 rounded-2xl border-2 border-green-800/50 bg-slate-800/90 text-emerald-300 hover:border-green-600/70 hover:bg-green-500/10 hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 backdrop-blur-xl shadow-md"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? "✖" : "☰"}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500/90 to-emerald-600/90 text-2xl shadow-2xl shadow-green-500/30 hover:scale-110 transition-all duration-300">
                🚛
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-bold">
                  Track-the-Truck
                </p>
                <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                  TCEMO Dashboard
                </h1>
              </div>
            </div>
          </div>
          {/* Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all duration-300"
            >
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                TC
              </div>
              <span className="hidden md:inline text-sm font-semibold text-emerald-300">
                TCEMO
              </span>
              <svg
                className={`w-4 h-4 text-emerald-300 transition-transform duration-300 ${profileDropdownOpen ? "rotate-180" : ""}`}
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
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 shadow-2xl shadow-emerald-900/40 overflow-hidden z-50">
                  <div className="p-3 border-b border-emerald-500/20">
                    <p className="text-xs text-emerald-400 font-semibold">
                      TCEMO Head
                    </p>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setActiveTab("manageAccount");
                        setProfileDropdownOpen(false);
                        setSidebarOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-emerald-500/10 transition-colors"
                    >
                      <span className="text-lg">⚙️</span>
                      <span>Manage Account</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors"
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
          bg-gradient-to-b from-slate-900/95 to-slate-950/95 border-r border-green-800/40
          flex flex-col py-6 px-4 transition-all duration-300 backdrop-blur-2xl shadow-2xl shadow-green-900/20
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
              { label: "Account", icon: "⚙️", tab: "manageAccount" },
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
                className={`group relative w-full flex items-center gap-3 rounded-2xl border ${
                  activeTab === item.tab
                    ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-xl shadow-green-500/30 border-green-500/50"
                    : "border-green-800/50 bg-slate-800/80 text-emerald-300 hover:border-green-600/70 hover:bg-green-500/10 hover:shadow-lg hover:shadow-green-500/25"
                } px-4 py-3 text-left transition-all duration-300 backdrop-blur-xl shadow-md hover:scale-[1.02] ${
                  activeTab === item.tab ? "!text-emerald-100" : ""
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-bold">{item.label}</span>
                {activeTab === item.tab && (
                  <div className="absolute right-3 w-2 h-6 bg-gradient-to-b from-emerald-400 to-teal-400 rounded-full animate-pulse" />
                )}
              </button>
            ))}

            <div className="pt-6 mt-6 border-t border-green-800/40"></div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 py-8 space-y-8 relative z-10 md:ml-64">
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
                    <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 h-[340px] sm:h-[420px] md:h-[520px] lg:h-[600px] relative z-10">
                      <LeafletMap />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
          {/* USER ADMIN – Add SWMO Head + list, styled */}
          {activeTab === "manageUsers" && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form */}
              <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/7 via-transparent to-teal-500/7 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent">
                    Add New SWMO Head
                  </h2>
                  <p className="text-sm text-slate-400 mb-4">
                    Create an account for the Solid Waste Management Office
                    head.
                  </p>
                  <form
                    onSubmit={handleAddUser}
                    className="space-y-2"
                    noValidate
                  >
                    {formError && (
                      <div className="px-4 py-2 bg-red-900/40 text-red-200 border border-red-500/60 rounded-lg text-sm">
                        {formError}
                      </div>
                    )}
                    {formSuccess && (
                      <div className="px-4 py-2 bg-emerald-900/40 text-emerald-200 border border-emerald-500/60 rounded-lg text-sm">
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
                    <div className="mb-4">
                      <label
                        className="block mb-1 font-semibold text-slate-100"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          className="w-full px-3 py-2 border border-slate-700 rounded-xl bg-slate-900/80 text-slate-100"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={userForm.password}
                          onChange={handleUserFormChange}
                          placeholder="Password"
                          required
                        />
                        <button
                          type="button"
                          className="absolute right-2 top-2 text-slate-400 text-sm"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <button
                        type="submit"
                        className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-600/40"
                      >
                        Add User
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* SWMO Head list */}
              <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-6 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-md" />
                <div className="relative z-10">
                  <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent">
                    SWMO Head Accounts
                  </h3>
                  {loadingSWMOHeads ? (
                    <TruckLoader />
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-slate-700/60 bg-slate-900/70">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-800/90 text-slate-200 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 text-left">Name</th>
                            <th className="px-3 py-2 text-left hidden sm:table-cell">
                              Email
                            </th>
                            <th className="px-3 py-2 text-left">Status</th>
                            <th className="px-3 py-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {swmoHeads.map((user) => (
                            <tr
                              key={user.user_id}
                              className="border-t border-slate-700/60 even:bg-slate-800/60"
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
                                  <button
                                    onClick={() =>
                                      openConfirmModal(
                                        "deactivate",
                                        user.user_id,
                                        `${user.first_name} ${user.last_name}`,
                                      )
                                    }
                                    className="px-4 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold whitespace-nowrap"
                                  >
                                    Deactivate
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      openConfirmModal(
                                        "activate",
                                        user.user_id,
                                        `${user.first_name} ${user.last_name}`,
                                      )
                                    }
                                    className="px-4 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold whitespace-nowrap"
                                  >
                                    Activate
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
            </section>
          )}

          {activeTab === "generateReports" && <ReportsAnalytics />}

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
                <div className="bg-slate-900/95 border border-green-800/50 rounded-2xl p-6">
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
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmModalOpen(false);
                        setConfirmModalAction(null);
                        setConfirmModalTarget(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={performConfirmAction}
                      disabled={confirmModalLoading}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white disabled:opacity-60"
                    >
                      {confirmModalLoading ? "Please wait..." : "Confirm"}
                    </button>
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
    <section className="max-w-3xl mx-auto group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-emerald-800/50 p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/7 via-transparent to-teal-500/7 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
      <div className="relative z-10">
        <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent">
          Manage Account
        </h2>
        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-900/40 text-red-100 border border-red-500/60 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-emerald-900/40 text-emerald-100 border border-emerald-500/60 text-sm">
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
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg shadow-emerald-600/40"
            >
              Update Account
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
