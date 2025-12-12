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
    "dashboard" | "userAdmin" | "manageAccount" | "reports"
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
  const [showResponse, setShowResponse] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [responseDetails, setResponseDetails] = useState<{
    [key: number]: string;
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
    <div className="flex bg-white min-h-screen">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-[70] p-2 bg-green-400 shadow rounded"
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
      {/* Sidebar */}
      <aside
        className={`bg-white/95 backdrop-blur border-r border-emerald-100 shadow-lg flex flex-col pt-6 px-5 md:px-4 fixed top-0 left-0 h-full transition-all duration-300 z-50 ${
          sidebarOpen
            ? "w-4/5 max-w-xs opacity-100"
            : "w-0 opacity-0 overflow-hidden"
        } md:w-64 md:max-w-none md:opacity-100 md:overflow-visible`}
      >
        <div>
          <h1 className="text-xl font-extrabold text-emerald-700 mb-1 tracking-tight">
            TCEMO Head
          </h1>
          <p className="text-xs font-semibold text-gray-600 leading-snug">
            Tagbilaran City Environmental Management Office
          </p>
        </div>
        <nav
          className="flex-1 mt-6 text-sm font-semibold text-gray-700 space-y-1"
          aria-label="Main Navigation"
        >
          {" "}
          <SidebarItem
            label="Dashboard"
            icon="🏠"
            selected={activeTab === "dashboard"}
            onClick={() => {
              setActiveTab("dashboard");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Manage Users"
            icon="👥"
            selected={activeTab === "userAdmin"}
            onClick={() => {
              setActiveTab("userAdmin");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Generate Report"
            icon="📄"
            selected={activeTab === "reports"}
            onClick={() => {
              setActiveTab("reports");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Manage Account"
            icon="🛠️"
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
      <main className="flex-1 p-6 md:p-8 transition-all duration-300 md:ml-64">
        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <>
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

        {/* User Admin Tab: Add New SWMO Head and List */}
        {activeTab === "userAdmin" && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add SWMO Head Form */}
            <div className="bg-white rounded-xl shadow p-6 max-w-xl w-full mx-auto md:mx-0">
              <h2 className="text-2xl font-bold mb-4 text-green-700">
                Add New SWMO Head
              </h2>
              <form onSubmit={handleAddUser} className="space-y-4" noValidate>
                {formError && (
                  <div
                    className="px-4 py-2 bg-red-100 text-red-700 rounded mb-2"
                    role="alert"
                  >
                    {formError}
                  </div>
                )}
                {formSuccess && (
                  <div
                    className="px-4 py-2 bg-green-100 text-green-700 rounded mb-2"
                    role="status"
                  >
                    {formSuccess}
                  </div>
                )}
                <InputField
                  label="First Name"
                  name="first_name"
                  type="text"
                  value={userForm.first_name}
                  onChange={handleUserFormChange}
                  placeholder="First Name"
                  required
                />
                <InputField
                  label="Last Name"
                  name="last_name"
                  type="text"
                  value={userForm.last_name}
                  onChange={handleUserFormChange}
                  placeholder="Last Name"
                  required
                />
                <InputField
                  label="Contact Number"
                  name="contact_number"
                  type="tel"
                  value={userForm.contact_number}
                  onChange={handleUserFormChange}
                  placeholder="Contact Number"
                  required
                />
                <InputField
                  label="Email"
                  name="email"
                  type="email"
                  value={userForm.email}
                  onChange={handleUserFormChange}
                  placeholder="Email Address"
                  required
                />
                <div>
                  <label
                    className="block mb-1 font-semibold text-gray-900"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-gray-900"
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={userForm.password}
                      onChange={handleUserFormChange}
                      placeholder="Password"
                      required
                      aria-describedby="passwordToggle"
                    />
                    <button
                      type="button"
                      id="passwordToggle"
                      className="absolute right-2 top-2 text-gray-600"
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
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold"
                  >
                    Add User
                  </button>
                </div>
              </form>
            </div>
            {/* SWMO Head List */}
            <div className="bg-white rounded-xl shadow p-4 mt-6">
              <h3 className="text-lg font-bold mb-2 text-green-700">
                SWMO Head Accounts
              </h3>
              {loadingSWMOHeads ? (
                <TruckLoader />
              ) : (
                <table className="min-w-full text-sm border border-gray-200 rounded bg-white">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {swmoHeads.map((user) => (
                      <tr
                        key={user.user_id}
                        className="border-t even:bg-gray-50"
                      >
                        <td className="px-3 py-2">
                          {user.first_name} {user.last_name}
                        </td>
                        <td className="px-3 py-2">{user.email}</td>
                        <td className="px-3 py-2">{user.status}</td>
                        <td className="px-3 py-2">
                          {user.status === "Active" && (
                            <button
                              onClick={() =>
                                handleDeactivateSWMOHead(user.user_id)
                              }
                              className="px-4 py-1 bg-red-500 text-white rounded"
                            >
                              Deactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
        {/* Reports */}
        {activeTab === "reports" && (
          <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold mb-4 text-green-600">
              Generate Report
            </h2>
            <div className="mb-4 flex gap-4">
              <button
                onClick={() => setActiveReportOption("wasteCollection")}
                className={`px-4 py-2 rounded font-semibold ${
                  activeReportOption === "wasteCollection"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                Waste Collection Reports
              </button>
              <button
                onClick={() => setActiveReportOption("barangayConcerns")}
                className={`px-4 py-2 rounded font-semibold ${
                  activeReportOption === "barangayConcerns"
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                Barangay Concerns & Actions
              </button>
            </div>
            {activeReportOption === "wasteCollection" && (
              <>
                {loadingReportData ? (
                  <TruckLoader />
                ) : errorReportData ? (
                  <p className="text-red-600">{errorReportData}</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={wasteCollectionData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="tons" fill="#3182ce" />
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="efficiency"
                          stroke="#2c7a7b"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </>
                )}
              </>
            )}
            {activeReportOption === "barangayConcerns" && (
              <>
                {loadingReportData ? (
                  <TruckLoader />
                ) : errorReportData ? (
                  <p className="text-red-600">{errorReportData}</p>
                ) : (
                  <>
                    <table className="min-w-full text-sm border mt-4">
                      <thead className="bg-green-200 text-black">
                        <tr>
                          <th className="px-3 py-2 text-left border-b">
                            Barangay
                          </th>
                          <th className="px-3 py-2 text-left border-b">
                            Issue
                          </th>
                          <th className="px-3 py-2 text-left border-b">
                            Status
                          </th>
                          <th className="px-3 py-2 text-left border-b">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {barangayConcerns.map((issue: any) => (
                          <tr
                            key={issue.report_id}
                            className="border-t even:bg-gray-50"
                          >
                            <td className="px-3 py-2">{issue.barangay_name}</td>
                            <td className="px-3 py-2">{issue.description}</td>
                            <td className="px-3 py-2">
                              {issue.current_status}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                className="px-4 py-1 bg-blue-600 text-white rounded"
                                onClick={() =>
                                  handleShowResponse(issue.report_id)
                                }
                              >
                                View Response
                              </button>
                              {showResponse[issue.report_id] && (
                                <div className="mt-2 p-2 bg-gray-100 border rounded text-xs whitespace-pre">
                                  {responseDetails[issue.report_id] ||
                                    "Loading..."}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </section>
        )}

        {/* Manage Account */}
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
    <section className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8">
      <h2 className="text-2xl font-bold mb-6 text-green-600">Manage Account</h2>
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
