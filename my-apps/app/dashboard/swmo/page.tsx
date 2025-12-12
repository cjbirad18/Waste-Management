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
  barangay_id?: string;
}

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
  return (
    <div className="mb-4">
      <label htmlFor={name} className="block mb-1 font-semibold text-gray-900">
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full px-3 py-2 border border-gray-400 rounded bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "userAdmin" | "manageAccount" | "reports"
  >("dashboard");

  const [hasLoadedManageAccount, setHasLoadedManageAccount] = useState(false);

  const [userForm, setUserForm] = useState({
    username: "",
    first_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    role: "",
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
    null
  );
  const [manageAccountSuccess, setManageAccountSuccess] = useState<
    string | null
  >(null);

  const [activeReportOption, setActiveReportOption] = useState<
    "wasteCollection" | "barangayConcerns"
  >("wasteCollection");
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
        !takenSingleRoles.includes(role.value)
    ),
  ];

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
    async function fetchBarangays() {
      try {
        const { data, error } = await supabase
          .from("barangay")
          .select("barangay_id, barangay_name");
        if (error) throw error;
        if (data) {
          setBarangayOptions(
            data.map((b: any) => ({
              value: b.barangay_id,
              label: b.barangay_name,
            }))
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

  const handleLogout = () => {
    if (
      typeof window !== "undefined" &&
      window.confirm("Are you sure you want to logout?")
    ) {
      localStorage.removeItem("authToken");
      router.push("/");
    }
  };

  const handleUserFormChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
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
      !userForm.role.trim() ||
      !userForm.password.trim()
    ) {
      return "All fields are required";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userForm.email)) return "Invalid email format";
    if (userForm.password.length < 6)
      return "Password must be at least 6 characters";
    if (userForm.role === "BWMC" && !userForm.barangay_id)
      return "Barangay is required for BWMC role";
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
    try {
      const { data: existingUsers, error: queryError } = await supabase
        .from("users")
        .select("username, email")
        .or(`email.eq.${userForm.email},username.eq.${userForm.username}`);
      if (queryError) throw queryError;
      if (existingUsers && existingUsers.length > 0) {
        setFormError("A user with that email or username already exists.");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userForm.email,
        password: userForm.password,
      });
      if (authError) {
        setFormError(authError.message);
        return;
      }
      if (!authData?.user) {
        setFormError("User not found after sign up.");
        return;
      }
      const userId = authData.user.id;
      const { error: insertError } = await supabase.from("users").insert([
        {
          user_id: userId,
          username: userForm.username,
          first_name: userForm.first_name,
          last_name: userForm.last_name,
          email: userForm.email,
          contact_number: userForm.contact_number,
          role: userForm.role,
          status: "active",
          barangay_id: userForm.role === "BWMC" ? userForm.barangay_id : null,
        },
      ]);
      if (insertError) {
        setFormError(`Error saving user profile: ${insertError.message}`);
        return;
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
    if (
      manageAccountForm.contact_number.length < 11 &&
      manageAccountForm.contact_number.length > 11
    ) {
      return "Contact number must be 11 digits.";
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

  const fetchReportsData = useCallback(async () => {
    setLoadingReportData(true);
    setErrorReportData(null);
    try {
      const { data: collectionRows, error } = await supabase
        .from("collection_details")
        .select(
          "collection_date, waste_weight, departure_time, completion_time"
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
        Object.entries(monthMap).map(([month, tons]) => ({ month, tons }))
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
        }))
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
          "report_id, barangay_id, description, current_status, date_submitted, resident_id"
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
        }))
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
    return (
      <section className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8 mt-1">
        <h2 className="text-2xl font-bold mb-4 text-green-700">
          Manage Account
        </h2>
        {loading && <TruckLoader />}
        {error && (
          <div
            className="px-4 py-2 bg-red-100 text-red-700 rounded mb-2"
            role="alert"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="px-4 py-2 bg-green-100 text-green-700 rounded mb-2"
            role="status"
          >
            {success}
          </div>
        )}
        {!loading && (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <InputField
              label="Username"
              name="username"
              type="text"
              value={form.username}
              onChange={onChange}
              required
            />
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
              label="Contact Number"
              name="contact_number"
              type="tel"
              value={form.contact_number}
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
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
            />
            <InputField
              label="Confirm Password"
              name="confirm_password"
              type="password"
              value={form.confirm_password}
              onChange={onChange}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-bold"
              >
                Update Account
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen">
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
            SWMO Admin
          </h1>
          <p className="text-xs font-semibold text-gray-600 leading-snug">
            Solid Waste Management
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
            label="Collection Panel"
            icon="🗑️"
            onClick={() => setSidebarOpen(false)}
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
      <main
        className={`flex-1 p-6 md:p-8 transition-all duration-300 ${
          sidebarOpen ? "ml-64" : "ml-0"
        } md:ml-64`}
      >
        {/* Dashboard */}
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
        {/* User Admin */}
        {activeTab === "userAdmin" && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Add User Form */}
            <div className="bg-white rounded-xl shadow p-6 max-w-xl w-full mx-auto md:mx-0">
              <h2 className="text-2xl font-bold mb-4 text-green-700">
                Add User
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
                <SelectField
                  label="Role"
                  name="role"
                  value={userForm.role}
                  onChange={handleUserFormChange}
                  required
                  options={filteredRoleOptions.slice(1)}
                  placeholder={filteredRoleOptions[0].label}
                />
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
                  label="Username"
                  name="username"
                  type="text"
                  value={userForm.username}
                  onChange={handleUserFormChange}
                  placeholder="Username"
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
                  placeholder="Email"
                  required
                />
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
            {/* User list table */}
            <div className="bg-white rounded-xl shadow p-6 max-w-xl w-full mx-auto md:mx-0">
              <h3 className="text-lg font-bold mb-2 text-green-600">
                User List (Realtime)
              </h3>
              {loadingUsers && <TruckLoader />}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200 rounded bg-white">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="px-3 py-2 text-left border-b text-gray-900">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left border-b text-gray-900">
                        Email
                      </th>
                      <th className="px-3 py-2 text-left border-b text-gray-900">
                        Role
                      </th>
                      <th className="px-3 py-2 text-left border-b text-gray-900">
                        Barangay
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr
                        key={user.id || user.user_id || user.email}
                        className="border-t even:bg-gray-50"
                      >
                        <td className="px-3 py-2 text-gray-800">
                          {user.first_name} {user.last_name}
                        </td>
                        <td className="px-3 py-2 text-gray-800 break-all">
                          {user.email}
                        </td>
                        <td className="px-3 py-2 text-gray-800">{user.role}</td>
                        <td className="px-3 py-2 text-gray-800">
                          {user.role === "BWMC" ? user.barangay_id : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
        {/* REPORTS */}
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
                        <Bar dataKey="tons" fill="#3182ce" />
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis domain={[0, 100]} />
                        <Tooltip />
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
