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
      <label
        htmlFor={name}
        className="block mb-1 text-xs font-medium text-slate-300"
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
        className="w-full px-3 py-2 border border-slate-700 rounded-lg bg-slate-800 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
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
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative">
      {/* Top navigation */}
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
              className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline text-xs sm:text-sm">TCEMO</span>
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
          bg-slate-950 border-r border-slate-800
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
                    ? "bg-emerald-600 text-white"
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
                <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {summaryCards.map((card, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors"
                      role="region"
                      aria-label={card.label}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{card.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs uppercase text-slate-400 font-medium">
                            {card.label}
                          </p>
                          <p className="text-2xl font-bold text-slate-100 mt-1">
                            {card.count}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </section>
              </div>

              {/* Map Section with Toggle Button */}
              <section>
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 overflow-hidden">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-100">
                      Collection Coverage Map
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStatsVisible(!statsVisible)}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors"
                        title={
                          statsVisible ? "Hide Statistics" : "Show Statistics"
                        }
                      >
                        {statsVisible ? "📊 Hide Stats" : "📈 Show Stats"}
                      </button>
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
            </>
          )}
          {/* USER ADMIN – Add SWMO Head + list, styled */}
          {activeTab === "manageUsers" && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors overflow-hidden">
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
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors"
                      >
                        Add User
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* SWMO Head list */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors overflow-hidden">
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
                                  <button
                                    onClick={() =>
                                      openConfirmModal(
                                        "deactivate",
                                        user.user_id,
                                        `${user.first_name} ${user.last_name}`,
                                      )
                                    }
                                    className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium whitespace-nowrap transition-colors"
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
                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium whitespace-nowrap transition-colors"
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
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
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
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={performConfirmAction}
                      disabled={confirmModalLoading}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 transition-colors"
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
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              Update Account
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
