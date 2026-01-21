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
    <button
      onClick={onClick}
      className={`flex gap-2 items-center w-full px-4 py-3 mb-2 text-left rounded-lg transition
        ${
          selected
            ? "bg-slate-100 text-slate-900 font-semibold" // ✅ dark text on light bg
            : "text-slate-200 hover:bg-slate-900/60"
        }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span className={textClassName}>{label}</span>
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
      <label
        htmlFor={name}
        className="block mb-1 text-md font-semibold text-slate-100"
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
        className="w-full rounded-lg bg-slate-900/90 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
      <label
        htmlFor={name}
        className="block mb-1 text-md font-semibold text-slate-100"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-lg bg-slate-900/90 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    "dashboard" | "userAdmin" | "manageAccount" | "reports" | "collection"
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
    null,
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
        !takenSingleRoles.includes(role.value),
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
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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
      <section className="max-w-2xl mx-auto rounded-2xl bg-slate-900/90 border border-slate-800/70 p-6 md:p-8 shadow-xl backdrop-blur-sm">
        <h2 className="text-2xl font-bold mb-2 text-emerald-400">
          Manage Account
        </h2>
        <p className="text-[11px] text-slate-400 mb-4">
          Update your profile details and sign‑in credentials.
        </p>

        {loading && <TruckLoader />}

        {error && (
          <div
            className="px-4 py-2 mb-3 rounded-lg bg-red-500/10 border border-red-500/50 text-xs text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="px-4 py-2 mb-3 rounded-lg bg-emerald-500/10 border border-emerald-500/50 text-xs text-emerald-200"
            role="status"
          >
            {success}
          </div>
        )}

        {!loading && (
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            {/* make all labels white via utility */}
            <div className="[&_label]:text-slate-100 [&_label]:text-xs [&_label]:font-semibold space-y-3">
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
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                Update Account
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  const sidebarItems = [
    { label: "Dashboard", icon: "📊", tab: "dashboard" },
    { label: "Collection Panel", icon: "🗺️", tab: "collection" },
    { label: "Manage Users", icon: "👥", tab: "userAdmin" },
    { label: "Reports", icon: "📈", tab: "reports" },
    { label: "Account", icon: "⚙️", tab: "manageAccount" },
  ] as const;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-900/80 text-slate-200 flex flex-col relative overflow-hidden">
      {/* Subtle background animation */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 animate-pulse" />
      </div>

      {/* Top navigation */}
      <header className="sticky top-0 z-50 border-b border-green-800/40 bg-slate-900/95 backdrop-blur-2xl shadow-xl shadow-green-900/20">
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
                  SWMO Admin
                </h1>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Shell layout */}
      <div className="flex flex-1 overflow-hidden">
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
          fixed z-40 inset-y-0 left-0 w-72 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }
          md:static md:translate-x-0 md:w-64
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
                      | "reports"
                      | "manageAccount",
                  );
                  setSidebarOpen(false);
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

            <div className="pt-6 mt-6 border-t border-green-800/40">
              <button
                onClick={handleLogout}
                className="group relative w-full rounded-2xl bg-gradient-to-r from-red-600/90 to-orange-600/90 px-4 py-3 text-sm font-bold text-slate-100 border border-red-500/40 hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl shadow-lg overflow-hidden"
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
        <main className="flex-1 overflow-y-auto px-6 md:px-8 py-8 space-y-8 relative z-10">
          {/* DASHBOARD */}
          {activeTab === "dashboard" && (
            <>
              {/* Responsive metrics grid */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {summaryCards.map((card, idx) => (
                  <div
                    key={idx}
                    className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 shadow-2xl shadow-green-900/30 p-6 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 hover:-translate-y-1 transition-all duration-500 hover:border-green-600/70"
                    role="region"
                    aria-label={card.label}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
                    <div className="flex items-start justify-between gap-4 relative z-10 h-full flex-col">
                      <div className="flex items-start justify-between w-full gap-3">
                        <div className="space-y-2">
                          <p className="text-xs uppercase tracking-wide text-emerald-400 font-semibold">
                            {card.label}
                          </p>
                          <p className="text-3xl md:text-4xl font-black bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-lg">
                            {card.count}
                          </p>
                        </div>
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 flex items-center justify-center text-2xl border border-green-800/50 shadow-lg group-hover:scale-110 transition-all duration-300 relative z-10 flex-shrink-0">
                          {card.icon}
                        </div>
                      </div>
                      <div className="w-full">
                        <div className="h-2 w-full rounded-full bg-slate-900/90 overflow-hidden border border-green-800/50 relative z-10">
                          <div className="h-full w-3/4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full shadow-lg" />
                        </div>
                        <p className="mt-3 text-xs text-slate-400 text-center relative z-10">
                          Auto-updated from collection data
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </section>

              {/* Map + small stats layout */}
              <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)] gap-6">
                <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                        Collection Coverage Map
                      </h2>
                      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-sm backdrop-blur-sm relative z-10">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                        Live vehicles
                      </span>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 h-[500px] md:h-[600px] relative z-10">
                      <LeafletMap />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* USER ADMIN */}
          {activeTab === "userAdmin" && (
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Add user */}
              <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                    Add User
                  </h2>
                  <p className="text-sm text-slate-400 mb-6">
                    Create accounts for collectors, BWMC officers, and admins.
                  </p>
                  <form
                    onSubmit={handleAddUser}
                    className="space-y-4"
                    noValidate
                  >
                    {formError && (
                      <div className="rounded-2xl bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-500/40 p-4 text-orange-200 text-sm backdrop-blur-xl shadow-lg">
                        {formError}
                      </div>
                    )}
                    {formSuccess && (
                      <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-500/40 p-4 text-emerald-200 text-sm backdrop-blur-xl shadow-lg">
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
                      />
                      <InputField
                        label="Last Name"
                        name="last_name"
                        type="text"
                        value={userForm.last_name}
                        onChange={handleUserFormChange}
                        required
                      />
                    </div>

                    <InputField
                      label="Username"
                      name="username"
                      type="text"
                      value={userForm.username}
                      onChange={handleUserFormChange}
                      required
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                    <div>
                      <label
                        className="block mb-2 text-xs font-semibold text-emerald-300 uppercase tracking-wide"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          className="w-full rounded-2xl bg-slate-900/80 border border-green-800/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 text-slate-200 placeholder:text-slate-400 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={userForm.password}
                          onChange={handleUserFormChange}
                          required
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-3 flex items-center text-slate-400 text-sm hover:text-emerald-300 transition-colors"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="group relative inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600/95 to-teal-600/95 px-6 py-3 text-sm font-bold text-slate-100 shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl border border-emerald-500/40 overflow-hidden"
                      >
                        <span className="relative z-10">＋ Add User</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* User list */}
              <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden max-h-[600px]">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                      User List (Realtime)
                    </h3>
                    <span className="text-sm bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-2xl border border-emerald-500/40 font-semibold backdrop-blur-sm">
                      {users.length} users
                    </span>
                  </div>
                  {loadingUsers && <TruckLoader />}
                  {!loadingUsers && (
                    <div className="overflow-x-auto rounded-2xl border border-green-800/50 max-h-[480px] bg-slate-900/50 backdrop-blur-xl shadow-inner">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 text-slate-300 border-b border-green-800/50">
                          <tr>
                            <th className="px-6 py-4 text-left font-semibold">
                              Name
                            </th>
                            <th className="px-6 py-4 text-left font-semibold">
                              Email
                            </th>
                            <th className="px-6 py-4 text-left font-semibold">
                              Role
                            </th>
                            <th className="px-6 py-4 text-left font-semibold">
                              Barangay
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr
                              key={user.id || user.user_id || user.email}
                              className="border-t border-green-800/30 hover:bg-slate-800/60 transition-all duration-200"
                            >
                              <td className="px-6 py-4 font-semibold text-slate-200">
                                {user.first_name} {user.last_name}
                              </td>
                              <td className="px-6 py-4 text-slate-300">
                                {user.email}
                              </td>
                              <td className="px-6 py-4">
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-400">
                                {user.role === "BWMC" ? user.barangay_id : "-"}
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

          {/* REPORTS */}
          {activeTab === "reports" && (
            <section className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
              <div className="relative z-10">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                      Reports & Analytics
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Visualize waste collection trends and barangay concerns.
                    </p>
                  </div>
                  <div className="inline-flex rounded-2xl bg-slate-900/90 border border-green-800/50 p-1 text-sm backdrop-blur-sm shadow-lg">
                    <button
                      onClick={() => setActiveReportOption("wasteCollection")}
                      className={`group/seg px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                        activeReportOption === "wasteCollection"
                          ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-lg shadow-green-500/30"
                          : "text-emerald-300 hover:bg-green-500/10 hover:shadow-md hover:shadow-green-500/20"
                      }`}
                    >
                      Waste Collection
                    </button>
                    <button
                      onClick={() => setActiveReportOption("barangayConcerns")}
                      className={`group/seg px-4 py-2.5 rounded-xl font-semibold transition-all duration-300 ${
                        activeReportOption === "barangayConcerns"
                          ? "bg-gradient-to-r from-green-600/95 to-emerald-600/95 text-slate-100 shadow-lg shadow-green-500/30"
                          : "text-emerald-300 hover:bg-green-500/10 hover:shadow-md hover:shadow-green-500/20"
                      }`}
                    >
                      Barangay Concerns
                    </button>
                  </div>
                </div>

                {activeReportOption === "wasteCollection" && (
                  <>
                    {loadingReportData ? (
                      <TruckLoader />
                    ) : errorReportData ? (
                      <div className="rounded-2xl bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/40 p-6 text-red-200 text-center text-sm backdrop-blur-xl shadow-lg">
                        {errorReportData}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="group relative rounded-2xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 border border-green-800/50 p-6 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-300 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                          <h3 className="text-lg font-bold mb-4 relative z-10 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent">
                            Monthly waste collected (tons)
                          </h3>
                          <div className="h-80 relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={wasteCollectionData}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#334155"
                                />
                                <XAxis dataKey="month" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#0f172a",
                                    borderColor: "#1e293b",
                                    color: "#e2e8f0",
                                    fontSize: 12,
                                  }}
                                />
                                <Bar
                                  dataKey="tons"
                                  fill="#10b981"
                                  radius={[8, 8, 0, 0]}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div className="group relative rounded-2xl bg-gradient-to-br from-slate-900/90 to-gray-900/90 border border-green-800/50 p-6 backdrop-blur-xl shadow-xl hover:shadow-2xl hover:shadow-green-500/30 transition-all duration-300 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
                          <h3 className="text-lg font-bold mb-4 relative z-10 bg-gradient-to-r from-slate-100 to-sky-300 bg-clip-text text-transparent">
                            Collection efficiency (%)
                          </h3>
                          <div className="h-80 relative z-10">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={performanceData}>
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  stroke="#334155"
                                />
                                <XAxis dataKey="month" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" domain={[0, 100]} />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: "#0f172a",
                                    borderColor: "#1e293b",
                                    color: "#e2e8f0",
                                    fontSize: 12,
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="efficiency"
                                  stroke="#0ea5e9"
                                  strokeWidth={3}
                                  dot={{
                                    r: 4,
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
                      <div className="rounded-2xl bg-gradient-to-r from-red-500/15 to-orange-500/15 border border-red-500/40 p-6 text-red-200 text-center text-sm backdrop-blur-xl shadow-lg">
                        {errorReportData}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-green-800/50 overflow-x-auto backdrop-blur-xl shadow-inner bg-slate-900/50">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gradient-to-r from-slate-900/95 to-gray-900/95 text-slate-300 border-b border-green-800/50">
                            <tr>
                              <th className="px-6 py-4 text-left font-semibold">
                                Barangay
                              </th>
                              <th className="px-6 py-4 text-left font-semibold">
                                Issue
                              </th>
                              <th className="px-6 py-4 text-left font-semibold">
                                Status
                              </th>
                              <th className="px-6 py-4 text-left font-semibold">
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
                                <td className="px-6 py-4 font-semibold text-slate-200">
                                  {issue.barangay_name}
                                </td>
                                <td className="px-6 py-4 max-w-md">
                                  <p className="line-clamp-2 text-slate-300">
                                    {issue.description}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                  <span
                                    className={`inline-flex px-3 py-1.5 rounded-2xl text-xs font-semibold border ${
                                      issue.current_status === "Resolved"
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                        : issue.current_status === "In Progress"
                                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                          : "bg-slate-500/20 text-slate-300 border-slate-500/40"
                                    }`}
                                  >
                                    {issue.current_status}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <button
                                    className="group inline-flex items-center rounded-xl bg-gradient-to-r from-slate-100/90 to-slate-200/90 text-slate-900 px-4 py-2 text-xs font-semibold hover:from-emerald-500/90 hover:to-teal-500/90 hover:text-slate-100 hover:shadow-lg hover:shadow-emerald-500/30 transition-all duration-300 backdrop-blur-sm"
                                    onClick={() =>
                                      handleShowResponse(issue.report_id)
                                    }
                                  >
                                    View response
                                    <div className="ml-1 w-4 h-4 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full group-hover:animate-ping opacity-0 group-hover:opacity-100 transition-all ml-1" />
                                  </button>
                                  {showResponse[issue.report_id] && (
                                    <div className="mt-3 rounded-xl border border-green-800/50 bg-slate-900/90 p-3 text-xs whitespace-pre-wrap text-slate-200 backdrop-blur-sm shadow-lg">
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

          {/* MANAGE ACCOUNT */}
          {activeTab === "manageAccount" && (
            <section className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
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
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
