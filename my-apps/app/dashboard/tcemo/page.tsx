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
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

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

type ReportOption = "wasteCollection" | "barangayConcerns";

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
    } catch (err) {
      setSwmoHeads([]);
    } finally {
      setLoadingSWMOHeads(false);
    }
  }, []);

  // Other users
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "collection" | "userAdmin" | "manageAccount" | "reports"
  >("dashboard");

  // Add user form (SWMO Head)
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
    null
  );
  const [manageAccountSuccess, setManageAccountSuccess] = useState<
    string | null
  >(null);
  const [activeReportOption, setActiveReportOption] =
    useState<ReportOption>("wasteCollection");
  const [wasteCollectionData, setWasteCollectionData] = useState<
    { month: string; tons: number }[]
  >([]);
  const [performanceData, setPerformanceData] = useState<
    { month: string; efficiency: number }[]
  >([]);
  const [barangayConcerns, setBarangayConcerns] = useState<any[]>([]);
  const [showResponse, setShowResponse] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [responseDetails, setResponseDetails] = useState<{
    [key: string]: string;
  }>({});
  const [loadingReportData, setLoadingReportData] = useState(false);
  const [errorReportData, setErrorReportData] = useState<string | null>(null);

  // Summary Cards
  const [counts, setCounts] = useState({
    residents: 0,
    gcps: 0,
    barangays: 0,
    incidentReports: 0,
  });

  const handleShowResponse = (reportId: string) => {
    setShowResponse((prev) => ({
      ...prev,
      [reportId]: !prev[reportId],
    }));
  };

  // Fetch user list
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

  // Fetch SWMO Heads
  useEffect(() => {
    fetchSWMOHeads();
  }, [fetchSWMOHeads, users]);

  // Deactivate SWMO Head
  const handleDeactivateSWMOHead = async (userId: string) => {
    const confirmed = window.confirm("Deactivate this SWMO Head account?");
    if (!confirmed) return;
    const { error } = await supabase
      .from("users")
      .update({ status: "Inactive" })
      .eq("user_id", userId);
    if (!error) {
      fetchUsers();
      fetchSWMOHeads();
    }
  };

  // Summary Cards
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

  // Add new SWMO Head
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

  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setManageAccountForm({
      ...manageAccountForm,
      [e.target.name]: e.target.value,
    });
  };

  useEffect(() => {
    async function loadAccount() {
      setManageAccountLoading(true);
      try {
        // Fetch authenticated user
        const { data: authUserData, error: authError } =
          await supabase.auth.getUser();
        if (!authUserData?.user || authError) {
          setManageAccountLoading(false);
          setManageAccountError("Could not load account info.");
          return;
        }
        // Fetch profile details
        const { data, error } = await supabase
          .from("users")
          .select("username, first_name, last_name, email, contact_number")
          .eq("user_id", authUserData.user.id)
          .single();
        if (error || !data) {
          setManageAccountLoading(false);
          setManageAccountError("Profile not found.");
          return;
        }
        setManageAccountForm((prev) => ({
          ...prev,
          username: data.username || "",
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          contact_number: data.contact_number || "",
          password: "", // always blank
          confirm_password: "", // always blank
        }));
        setManageAccountLoading(false);
      } catch (err) {
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
    const activeSWMO = swmoHeads.find((u) => u.status === "active");
    if (activeSWMO) {
      window.alert(
        "An SWMO Head account is currently active. Please deactivate the account before creating a new one."
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
      const uniqueUsername = `swmohead_${Date.now()}`; // <-- Ensures uniqueness
      const { error: insertError } = await supabase.from("users").insert([
        {
          user_id: userId,
          username: uniqueUsername,
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          email: userForm.email,
          contact_number: userForm.contact_number,
          role: "SWMO Head",
          status: "active",
        },
      ]);
      if (insertError) {
        setFormError(`Error saving user profile: ${insertError.message}`);
        return;
      }
      setFormSuccess(
        `User account created successfully! Username: ${uniqueUsername}`
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

  const validateManageAccountForm = (): string | null => {
    if (!manageAccountForm.username.trim()) {
      return "Username is required.";
    }

    if (!manageAccountForm.email.trim()) {
      return "Email is required.";
    }

    if (
      manageAccountForm.password &&
      manageAccountForm.password !== manageAccountForm.confirm_password
    ) {
      return "Passwords do not match.";
    }

    return null;
  };

  const handleManageAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const confirmed = window.confirm(
      "Are you sure you want to update your account details?"
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

  // Sidebar logout
  const handleLogout = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to logout?")
    ) {
      localStorage.removeItem("authToken");
      router.push("/");
    }
  };

  // ---------- Main Render ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-900/80 text-slate-200 flex relative overflow-hidden">
      {/* Subtle background animation */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 animate-pulse" />
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-6 left-6 z-[70] p-3 bg-gradient-to-r from-green-500/90 to-emerald-600/90 shadow-2xl shadow-green-500/30 rounded-2xl text-slate-100 hover:shadow-3xl hover:shadow-green-500/40 hover:scale-110 transition-all duration-300 backdrop-blur-xl border border-green-500/50"
        aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
      >
        {sidebarOpen ? "✖" : "☰"}
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-gradient-to-b from-slate-900/95 to-slate-950/95 backdrop-blur-2xl border-r border-green-800/40 shadow-2xl shadow-green-900/20 flex flex-col pt-8 px-6 md:px-5 fixed top-0 left-0 h-full transition-all duration-500 z-50 ${
          sidebarOpen
            ? "w-4/5 max-w-sm opacity-100 translate-x-0"
            : "w-0 opacity-0 -translate-x-full overflow-hidden"
        } md:w-72 md:max-w-none md:opacity-100 md:translate-x-0 md:overflow-visible`}
      >
        {/* Header */}
        <div className="mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-green-500/90 to-emerald-600/90 text-2xl shadow-2xl shadow-green-500/30 mx-auto mb-4 hover:scale-110 transition-all duration-300">
            🚛
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl mb-2 text-center tracking-tight">
            TCEMO Head
          </h1>
          <p className="text-xs font-semibold text-emerald-400 leading-snug text-center tracking-wide">
            Tagbilaran City Environmental Management Office
          </p>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 space-y-2 text-sm font-bold text-emerald-300"
          aria-label="Main Navigation"
        >
          {/* Inline SidebarItem replacements */}
          {[
            { label: "Dashboard", icon: "📊", tab: "dashboard" },
            { label: "Collection Panel", icon: "🗺️", tab: "collection" },
            { label: "Manage Users", icon: "👥", tab: "userAdmin" },
            { label: "Reports", icon: "📈", tab: "reports" },
            { label: "Account", icon: "⚙️", tab: "manageAccount" },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => {
                setActiveTab(
                  item.tab as
                    | "dashboard"
                    | "collection"
                    | "userAdmin"
                    | "manageAccount"
                    | "reports"
                );
                setSidebarOpen(false);
              }}
              className={`group relative w-full flex items-center gap-4 rounded-3xl border ${
                activeTab === item.tab
                  ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-xl shadow-green-500/30 border-green-500/50"
                  : "border-green-800/50 bg-slate-800/80 hover:border-green-600/70 hover:bg-green-500/10 hover:shadow-lg hover:shadow-green-500/25"
              } px-5 py-4 text-left transition-all duration-500 backdrop-blur-xl shadow-md hover:scale-[1.02] ${
                activeTab === item.tab ? "!text-emerald-100" : ""
              }`}
            >
              <span className="text-2xl flex-shrink-0">{item.icon}</span>
              <span className="font-black">{item.label}</span>
              {activeTab === item.tab && (
                <div className="absolute right-4 w-2 h-8 bg-gradient-to-b from-emerald-400 to-teal-400 rounded-full animate-pulse shadow-lg" />
              )}
            </button>
          ))}

          {/* Logout */}
          <div className="pt-8 mt-8 border-t border-green-800/40">
            <button
              onClick={handleLogout}
              className="group relative w-full rounded-3xl bg-gradient-to-r from-red-600/90 to-orange-600/90 px-5 py-4 text-sm font-black text-slate-100 border border-red-500/40 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl shadow-lg overflow-hidden"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                ⎋ Logout
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </button>
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 md:p-8 transition-all duration-500 md:ml-72 relative z-10 overflow-y-auto">
        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <>
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {summaryCards.map((card, idx) => (
                <div
                  key={idx}
                  className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 shadow-2xl shadow-green-900/30 p-6 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 hover:-translate-y-1 hover:border-green-600/70 transition-all duration-500 text-center"
                  role="region"
                  aria-label={card.label}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
                  <div className="relative z-10 space-y-3 h-full flex flex-col justify-center">
                    <div className="text-4xl mx-auto group-hover:scale-110 transition-all duration-300">
                      {card.icon}
                    </div>
                    <div>
                      <p className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl">
                        {card.count}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-emerald-400 font-semibold mt-1">
                        {card.label}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <section
              className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden"
              aria-label="Map of collection area and vehicles"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-2xl">
                  Live Collection Map
                </h2>
                <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 h-[500px] md:h-[600px]">
                  <LeafletMap />
                </div>
              </div>
            </section>
          </>
        )}

        {/* User Admin */}
        {activeTab === "userAdmin" && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Add SWMO Head Form */}
            <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden max-w-2xl">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-2xl">
                  Add New SWMO Head
                </h2>
                <form onSubmit={handleAddUser} className="space-y-6" noValidate>
                  {formError && (
                    <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-500/40 p-4 text-orange-200 backdrop-blur-xl shadow-lg">
                      {formError}
                    </div>
                  )}
                  {formSuccess && (
                    <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/40 p-4 text-emerald-200 backdrop-blur-xl shadow-lg">
                      {formSuccess}
                    </div>
                  )}

                  {/* First Name */}
                  <div>
                    <label
                      htmlFor="first_name"
                      className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
                    >
                      First Name
                    </label>
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      value={userForm.first_name}
                      onChange={handleUserFormChange}
                      className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                      placeholder="Enter first name"
                      required
                    />
                  </div>

                  {/* Last Name */}
                  <div>
                    <label
                      htmlFor="last_name"
                      className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
                    >
                      Last Name
                    </label>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      value={userForm.last_name}
                      onChange={handleUserFormChange}
                      className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                      placeholder="Enter last name"
                      required
                    />
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label
                      htmlFor="contact_number"
                      className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
                    >
                      Contact Number
                    </label>
                    <input
                      id="contact_number"
                      name="contact_number"
                      type="tel"
                      value={userForm.contact_number}
                      onChange={handleUserFormChange}
                      className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                      placeholder="e.g. +63 917 123 4567"
                      required
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      value={userForm.email}
                      onChange={handleUserFormChange}
                      className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                      placeholder="user@tagbilaran.gov.ph"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label
                      htmlFor="password"
                      className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 text-slate-200 placeholder:text-slate-400 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={userForm.password}
                        onChange={handleUserFormChange}
                        placeholder="Enter secure password"
                        required
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-emerald-300 transition-colors"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>

                  <input type="hidden" name="username" value="SWMO Head" />
                  <input type="hidden" name="role" value="SWMO Head" />
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      className="group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600/95 to-teal-600/95 px-8 py-4 text-sm font-black text-slate-100 shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl border border-emerald-500/40 overflow-hidden"
                    >
                      <span className="relative z-10">＋ Add SWMO Head</span>
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* SWMO Head List */}
            <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden max-h-[600px]">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-2xl">
                  SWMO Head Accounts
                </h3>
                {loadingSWMOHeads ? (
                  <TruckLoader />
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-green-800/50 max-h-[480px] bg-slate-900/50 backdrop-blur-xl shadow-inner">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 text-slate-300 border-b border-green-800/50">
                        <tr>
                          <th className="px-6 py-4 text-left font-semibold text-slate-100">
                            Name
                          </th>
                          <th className="px-6 py-4 text-left font-semibold text-slate-100">
                            Email
                          </th>
                          <th className="px-6 py-4 text-left font-semibold text-slate-100">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left font-semibold text-slate-100">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {swmoHeads.map((user) => (
                          <tr
                            key={user.user_id}
                            className="border-t border-green-800/30 hover:bg-slate-800/60 transition-all duration-200"
                          >
                            <td className="px-6 py-5 font-semibold text-slate-200">
                              {user.first_name} {user.last_name}
                            </td>
                            <td className="px-6 py-5 text-slate-300">
                              {user.email}
                            </td>
                            <td className="px-6 py-5">
                              <span
                                className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
                                  user.status === "Active"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-orange-500/20 text-orange-300 border border-orange-500/40"
                                }`}
                              >
                                {user.status}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              {user.status === "active" && (
                                <button
                                  onClick={() =>
                                    handleDeactivateSWMOHead(user.user_id)
                                  }
                                  className="group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600/90 to-orange-600/90 px-6 py-3 text-sm font-bold text-slate-100 hover:shadow-xl hover:shadow-red-500/30 hover:scale-105 transition-all duration-300 backdrop-blur-xl border border-red-500/40 shadow-lg overflow-hidden"
                                >
                                  <span className="relative z-10">
                                    Deactivate
                                  </span>
                                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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

        {/* Reports */}
        {activeTab === "reports" && (
          <section className="group relative max-w-6xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
            <div className="relative z-10">
              <h2 className="text-3xl font-black mb-8 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-2xl">
                Generate Report
              </h2>
              <div className="flex flex-wrap gap-4 mb-12 justify-center lg:justify-start">
                <button
                  onClick={() => setActiveReportOption("wasteCollection")}
                  className={`group relative px-8 py-4 rounded-2xl font-black text-lg transition-all duration-500 backdrop-blur-xl shadow-lg ${
                    activeReportOption === "wasteCollection"
                      ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-2xl shadow-green-500/30 border border-green-500/50"
                      : "bg-slate-800/80 text-emerald-300 border border-green-800/50 hover:bg-green-500/10 hover:shadow-xl hover:shadow-green-500/25 hover:border-green-600/70"
                  }`}
                >
                  {activeReportOption === "wasteCollection" && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-20 blur-sm" />
                  )}
                  Waste Collection Reports
                </button>
                <button
                  onClick={() => setActiveReportOption("barangayConcerns")}
                  className={`group relative px-8 py-4 rounded-2xl font-black text-lg transition-all duration-500 backdrop-blur-xl shadow-lg ${
                    activeReportOption === "barangayConcerns"
                      ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-2xl shadow-green-500/30 border border-green-500/50"
                      : "bg-slate-800/80 text-emerald-300 border border-green-800/50 hover:bg-green-500/10 hover:shadow-xl hover:shadow-green-500/25 hover:border-green-600/70"
                  }`}
                >
                  {activeReportOption === "barangayConcerns" && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-20 blur-sm" />
                  )}
                  Barangay Concerns & Actions
                </button>
              </div>

              {activeReportOption === "wasteCollection" && (
                <>
                  {loadingReportData ? (
                    <TruckLoader />
                  ) : errorReportData ? (
                    <div className="rounded-2xl bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/40 p-8 text-red-200 text-center text-lg backdrop-blur-xl shadow-lg mx-auto max-w-2xl">
                      {errorReportData}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="group relative rounded-2xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 border border-green-800/50 p-8 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                        <h3 className="text-xl font-bold mb-6 relative z-10 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent">
                          Monthly Waste Collected (tons)
                        </h3>
                        <div className="h-96 relative z-10">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={wasteCollectionData}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#334155"
                              />
                              <XAxis
                                dataKey="month"
                                stroke="#9ca3af"
                                fontSize={12}
                              />
                              <YAxis stroke="#9ca3af" fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#0f172a",
                                  borderColor: "#1e293b",
                                  color: "#e2e8f0",
                                  fontSize: 13,
                                  borderRadius: 12,
                                }}
                              />
                              <Bar
                                dataKey="tons"
                                fill="#10b981"
                                radius={[10, 10, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="group relative rounded-2xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 border border-green-800/50 p-8 backdrop-blur-xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                        <h3 className="text-xl font-bold mb-6 relative z-10 bg-gradient-to-r from-slate-100 to-sky-300 bg-clip-text text-transparent">
                          Collection Efficiency (%)
                        </h3>
                        <div className="h-96 relative z-10">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={performanceData}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#334155"
                              />
                              <XAxis
                                dataKey="month"
                                stroke="#9ca3af"
                                fontSize={12}
                              />
                              <YAxis
                                stroke="#9ca3af"
                                domain={[0, 100]}
                                fontSize={12}
                              />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "#0f172a",
                                  borderColor: "#1e293b",
                                  color: "#e2e8f0",
                                  fontSize: 13,
                                  borderRadius: 12,
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="efficiency"
                                stroke="#0ea5e9"
                                strokeWidth={4}
                                dot={{
                                  r: 6,
                                  strokeWidth: 2,
                                  stroke: "#0f172a",
                                }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeReportOption === "barangayConcerns" && (
                <>
                  {loadingReportData ? (
                    <TruckLoader />
                  ) : errorReportData ? (
                    <div className="rounded-2xl bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/40 p-8 text-red-200 text-center text-lg backdrop-blur-xl shadow-lg">
                      {errorReportData}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-green-800/50 overflow-x-auto backdrop-blur-xl shadow-inner bg-slate-900/50">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 text-slate-300 border-b border-green-800/50">
                          <tr>
                            <th className="px-8 py-5 text-left font-black">
                              Barangay
                            </th>
                            <th className="px-8 py-5 text-left font-black">
                              Issue
                            </th>
                            <th className="px-8 py-5 text-left font-black">
                              Status
                            </th>
                            <th className="px-8 py-5 text-left font-black">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {barangayConcerns.map((issue: any) => (
                            <tr
                              key={issue.report_id}
                              className="border-t border-green-800/30 hover:bg-slate-800/60 transition-all duration-200"
                            >
                              <td className="px-8 py-6 font-bold text-slate-200">
                                {issue.barangay_name}
                              </td>
                              <td className="px-8 py-6 max-w-lg">
                                <p className="line-clamp-2 text-slate-300">
                                  {issue.description}
                                </p>
                              </td>
                              <td className="px-8 py-6">
                                <span
                                  className={`px-4 py-2 rounded-2xl text-sm font-bold ${
                                    issue.current_status === "Resolved"
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg"
                                      : issue.current_status === "In Progress"
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg"
                                      : "bg-slate-500/20 text-slate-300 border border-slate-500/40 shadow-lg"
                                  }`}
                                >
                                  {issue.current_status}
                                </span>
                              </td>
                              <td className="px-8 py-6">
                                <button
                                  className="group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600/90 to-teal-600/90 text-slate-100 px-6 py-3 text-sm font-bold hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-105 transition-all duration-300 backdrop-blur-xl border border-emerald-500/40 shadow-lg overflow-hidden"
                                  onClick={() =>
                                    handleShowResponse(issue.report_id)
                                  }
                                >
                                  <span className="relative z-10">
                                    View Response
                                  </span>
                                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                                {showResponse[issue.report_id] && (
                                  <div className="mt-4 rounded-2xl border border-green-800/50 bg-slate-900/90 p-4 text-sm whitespace-pre-wrap text-slate-200 backdrop-blur-xl shadow-xl">
                                    {responseDetails[issue.report_id] ||
                                      "Loading..."}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}

        {/* Manage Account */}
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
    <section className="group relative max-w-2xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
      {/* Subtle glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />

      <div className="relative z-10">
        <h2 className="text-3xl font-black mb-8 bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">
          Manage Account
        </h2>

        {error && (
          <div
            role="alert"
            className="rounded-2xl bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-500/40 p-5 mb-8 text-orange-200 text-sm backdrop-blur-xl shadow-lg animate-pulse"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/40 p-5 mb-8 text-emerald-200 text-sm backdrop-blur-xl shadow-lg flex items-center gap-3"
          >
            <div className="w-5 h-5 bg-emerald-500 rounded-full animate-ping" />
            {success}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-6" noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="first_name"
                className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
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
                className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <label
                htmlFor="last_name"
                className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
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
                className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                placeholder="Enter your last name"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="username"
              className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
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
              className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
              placeholder="Enter your username"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="email"
                className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
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
                className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                placeholder="user@tagbilaran.gov.ph"
              />
            </div>
            <div>
              <label
                htmlFor="contact_number"
                className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
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
                className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                placeholder="+63 917 123 4567"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="password"
                className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={onChange}
                  className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 pr-12 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                  placeholder="Leave blank to keep current password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-emerald-300 transition-colors"
                  onClick={() => {
                    /* toggle password visibility logic */
                  }}
                >
                  👁️
                </button>
              </div>
            </div>
            <div>
              <label
                htmlFor="confirm_password"
                className="block text-slate-100 font-bold uppercase tracking-widest text-xs mb-3 bg-gradient-to-r from-slate-100 to-slate-50 bg-clip-text drop-shadow-sm"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  value={form.confirm_password}
                  onChange={onChange}
                  className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-5 py-4 pr-12 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                  placeholder="Confirm your new password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-emerald-300 transition-colors"
                  onClick={() => {
                    /* toggle password visibility logic */
                  }}
                >
                  👁️
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-green-800/30">
            <button
              type="submit"
              className="group relative inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 text-lg font-black text-slate-100 shadow-2xl shadow-emerald-500/30 hover:shadow-3xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-500 backdrop-blur-2xl border border-emerald-500/50 rounded-3xl overflow-hidden"
            >
              <span className="relative z-10 tracking-wide uppercase">
                Update Account
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-white/30 via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-2 h-2 bg-gradient-to-b from-emerald-400 to-teal-400 rounded-full animate-ping opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
            </button>
          </div>
        </form>
      </div>
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
