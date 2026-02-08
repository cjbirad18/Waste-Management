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
import TruckLoader from "../../loading/TruckLoader";
import ReportsAnalytics from "../../generatereport/generatereport";
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
  created_at?: string;
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
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
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
        className="block mb-1 text-xs font-medium text-slate-300"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
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
  const [statsVisible, setStatsVisible] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "userAdmin"
    | "manageAccount"
    | "reports"
    | "manageUsers"
    | "incidentReports"
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

  // Manage Users State
  const [otherUsersList, setOtherUsersList] = useState<User[]>([]);
  const [loadingOtherUsers, setLoadingOtherUsers] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserForm, setEditingUserForm] = useState<any>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [otherUsersError, setOtherUsersError] = useState<string | null>(null);
  const [otherUsersSuccess, setOtherUsersSuccess] = useState<string | null>(
    null,
  );

  // Incident Reports State
  const [incidentReports, setIncidentReports] = useState<any[]>([]);
  const [selectedBarangay, setSelectedBarangay] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

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
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .order("date_created", { ascending: false });
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
  }, [activeTab, fetchOtherUsers]);

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

  // Fetch incident reports when tab is active or filters change
  useEffect(() => {
    if (activeTab === "incidentReports") {
      fetchIncidentReports();
    }
  }, [activeTab, fetchIncidentReports]);

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

  // Fetch other users (TCEMO, Secretary, BWMC, GCP)
  // Start editing a user
  const handleEditUser = (user: User) => {
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

    if (editingUserForm.contact_number.length !== 11) {
      setOtherUsersError("Contact number must be exactly 11 digits.");
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
          <div>
            <label
              htmlFor="username"
              className="block text-xs font-medium text-slate-300 mb-1"
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
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
              placeholder="Enter your username"
            />
          </div>

          {/* First / Last */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="first_name"
                className="block text-xs font-medium text-slate-300 mb-1"
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <label
                htmlFor="last_name"
                className="block text-xs font-medium text-slate-300 mb-1"
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                placeholder="Enter your last name"
              />
            </div>
          </div>

          {/* Contact / Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="contact_number"
                className="block text-xs font-medium text-slate-300 mb-1"
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                placeholder="09123456789"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-300 mb-1"
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
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                placeholder="user@tagbilaran.gov.ph"
              />
            </div>
          </div>

          {/* Passwords */}
          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
              placeholder="Leave blank to keep current password"
            />
          </div>

          <div>
            <label
              htmlFor="confirm_password"
              className="block text-xs font-medium text-slate-300 mb-1"
            >
              Confirm Password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              value={form.confirm_password}
              onChange={onChange}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
              placeholder="Confirm your new password"
            />
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Update Account
            </button>
          </div>
        </form>
      </section>
    );
  }

  const sidebarItems = [
    { label: "Dashboard", icon: "📊", tab: "dashboard" },
    { label: "Manage Users", icon: "👥", tab: "userAdmin" },
    { label: "User Accounts", icon: "📋", tab: "manageUsers" },
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
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800 bg-slate-950">
        <div className="flex items-center justify-between px-4 md:px-8 py-4 min-h-16">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? "✖" : "☰"}
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-lg font-bold text-white flex-shrink-0">
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium transition-colors"
            >
              Admin
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
          bg-slate-950 border-r border-slate-800
          flex flex-col py-4 px-3 transition-all duration-300
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
              { label: "Reports", icon: "📈", tab: "reports" },
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
          {/* USER ADMIN */}
          {activeTab === "userAdmin" && (
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Add user */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors overflow-hidden">
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
                      <InputField
                        label="Contact Number"
                        name="contact_number"
                        type="tel"
                        value={userForm.contact_number}
                        onChange={handleUserFormChange}
                        required
                        placeholder="09xx-xxx-xxxx"
                      />
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

                    <div>
                      <label
                        className="block mb-2 text-xs font-medium text-slate-300"
                        htmlFor="password"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors text-slate-200 placeholder:text-slate-400"
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={userForm.password}
                          onChange={handleUserFormChange}
                          required
                          placeholder="At least 8 characters"
                        />
                        <button
                          type="button"
                          className="absolute inset-y-0 right-3 flex items-center text-slate-400 text-xs hover:text-slate-300 transition-colors"
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
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-medium text-white transition-colors"
                      >
                        ＋ Add User
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* User list */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors overflow-hidden max-h-[600px]">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-100">
                      User List (Realtime)
                    </h3>
                    <span className="text-xs bg-emerald-600/20 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-600/40 font-medium">
                      {users.length} users
                    </span>
                  </div>
                  {loadingUsers && <TruckLoader />}
                  {!loadingUsers && (
                    <div className="overflow-x-auto rounded-lg border border-slate-800 max-h-[480px] bg-slate-950">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-800 text-slate-300 border-b border-slate-700 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-xs">
                              Name
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-xs hidden sm:table-cell">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-xs">
                              Role
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-xs hidden md:table-cell">
                              Barangay
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr
                              key={user.id || user.user_id || user.email}
                              className="border-t border-slate-800 hover:bg-slate-800 transition-colors"
                            >
                              <td className="px-4 py-3 font-medium text-slate-200 text-sm">
                                {user.first_name} {user.last_name}
                                <div className="sm:hidden text-xs text-slate-400 font-normal">
                                  {user.email}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-slate-300 hidden sm:table-cell text-sm">
                                {user.email}
                              </td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 text-xs font-medium">
                                  {user.role}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-400 hidden md:table-cell text-sm">
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
          {/* MANAGE OTHER USERS */}
          {activeTab === "manageUsers" && (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors overflow-hidden">
                <div className="relative z-10 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600/20 border border-emerald-600/30">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">
                      User Account Management
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">
                      Manage TCEMO Head, Secretary, BWMC, and GCP accounts
                    </p>
                  </div>
                </div>
              </div>

              {/* Alerts */}
              {otherUsersError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">⚠️</span>
                    <div>
                      <p className="text-xs font-medium text-red-300">Error</p>
                      <p className="text-sm text-red-200 mt-1">
                        {otherUsersError}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              {otherUsersSuccess && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">✅</span>
                    <div>
                      <p className="text-xs font-medium text-emerald-300">
                        Success
                      </p>
                      <p className="text-sm text-emerald-200 mt-1">
                        {otherUsersSuccess}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {loadingOtherUsers && <TruckLoader />}

              {!loadingOtherUsers && otherUsersList.length === 0 && (
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-12 text-center">
                  <div className="relative z-10">
                    <span className="text-6xl mb-4 block opacity-40">👤</span>
                    <p className="text-lg font-semibold text-slate-300 mb-2">
                      No Users Found
                    </p>
                    <p className="text-xs text-slate-400">
                      There are currently no user accounts to manage
                    </p>
                  </div>
                </div>
              )}

              {!loadingOtherUsers && otherUsersList.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                  {otherUsersList.map((user) => (
                    <div
                      key={user.user_id}
                      className="relative bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors overflow-hidden"
                    >
                      <div className="relative z-10">
                        {/* View Mode */}
                        <div>
                          {/* User Header */}
                          <div className="flex items-start gap-4 mb-6">
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600/20 border border-emerald-600/30 flex-shrink-0">
                              <span className="text-2xl">
                                {user.role === "TCEMO Head"
                                  ? "👔"
                                  : user.role === "Secretary"
                                    ? "📝"
                                    : user.role === "BWMC"
                                      ? "🏛️"
                                      : "🔧"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-slate-100 truncate mb-2">
                                {user.first_name} {user.last_name}
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 text-xs font-medium">
                                  {user.role}
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold shadow ${
                                    user.status === "archived"
                                      ? "bg-red-500/10 text-red-300 border border-red-500/30"
                                      : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${user.status === "archived" ? "bg-red-400" : "bg-emerald-400 animate-pulse"}`}
                                  />
                                  {user.status || "Active"}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* User Details */}
                          <div className="space-y-3 mb-6">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700">
                              <span className="text-lg">📧</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-400 font-medium">
                                  Email
                                </p>
                                <p className="text-xs text-slate-200 truncate">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-800 border border-slate-700">
                              <span className="text-lg">📱</span>
                              <div className="flex-1">
                                <p className="text-xs text-slate-400 font-medium">
                                  Phone
                                </p>
                                <p className="text-xs text-slate-200">
                                  {user.contact_number}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-2 text-xs font-medium text-white transition-colors flex items-center justify-center gap-2"
                            >
                              <span>✏️</span>
                              Edit
                            </button>
                            {user.status !== "archived" && (
                              <button
                                onClick={() =>
                                  handleArchiveUser(
                                    user.user_id,
                                    `${user.first_name} ${user.last_name}`,
                                  )
                                }
                                className="flex-1 rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-2 text-xs font-medium text-white transition-colors flex items-center justify-center gap-2"
                              >
                                <span>🗂️</span>
                                Archive
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* INCIDENT REPORTS */}
          {activeTab === "incidentReports" && (
            <div className="space-y-6">
              {/* Header Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors overflow-hidden">
                <div className="relative z-10 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600/20 border border-red-600/30">
                    <span className="text-2xl">🚨</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">
                      Incident Reports Dashboard
                    </h2>
                    <p className="text-slate-400 text-xs mt-1">
                      View and manage community incident reports by barangay
                    </p>
                  </div>
                </div>
              </div>

              {/* Filters Section */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors overflow-hidden">
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Barangay Filter */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      🏘️ Select Barangay
                    </label>
                    <select
                      value={selectedBarangay}
                      onChange={(e) => setSelectedBarangay(e.target.value)}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                    >
                      <option value="all">All Barangays</option>
                      {barangayOptions.map((barangay) => (
                        <option key={barangay.value} value={barangay.value}>
                          {barangay.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Sort By Filter */}
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      🔄 Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                    >
                      <option value="date_desc">Date (Newest First)</option>
                      <option value="date_asc">Date (Oldest First)</option>
                      <option value="status">Status</option>
                      <option value="barangay">Barangay</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {reportsError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">⚠️</span>
                    <div>
                      <p className="text-xs font-medium text-red-300">Error</p>
                      <p className="text-sm text-red-200 mt-1">
                        {reportsError}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loadingReports && <TruckLoader />}

              {/* No Reports */}
              {!loadingReports && incidentReports.length === 0 && (
                <div className="rounded-lg bg-slate-900 border border-slate-800 p-12 text-center">
                  <div className="relative z-10">
                    <span className="text-6xl mb-4 block opacity-40">📋</span>
                    <p className="text-lg font-semibold text-slate-300 mb-2">
                      No Reports Found
                    </p>
                    <p className="text-xs text-slate-400">
                      There are no incident reports for the selected barangay
                    </p>
                  </div>
                </div>
              )}

              {/* Reports List */}
              {!loadingReports && incidentReports.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {incidentReports.map((report) => (
                    <div
                      key={report.report_id}
                      className="relative bg-slate-900 border border-slate-800 rounded-lg p-5 hover:border-slate-700 transition-colors overflow-hidden"
                    >
                      <div className="relative z-10">
                        {/* Report Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/20 border border-red-600/30">
                              <span className="text-xl">🚨</span>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                                Report ID
                              </p>
                              <p className="text-sm font-semibold text-slate-200">
                                #{String(report.report_id).slice(0, 8)}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-medium ${
                              report.current_status === "Resolved"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                                : report.current_status === "Ongoing"
                                  ? "bg-blue-500/10 text-blue-300 border border-blue-500/30"
                                  : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {report.current_status || "Pending"}
                          </span>
                        </div>

                        {/* Report Details */}
                        <div className="space-y-3 mb-4">
                          <div className="flex items-start gap-2">
                            <span className="text-base mt-0.5">📍</span>
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-400 font-medium uppercase">
                                Location
                              </p>
                              <p className="text-xs text-slate-200">
                                {report.location || "N/A"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <span className="text-base mt-0.5">🏘️</span>
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-400 font-medium uppercase">
                                Barangay
                              </p>
                              <p className="text-xs text-slate-200">
                                {report.barangay?.barangay_name || "Unknown"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <span className="text-base mt-0.5">📅</span>
                            <div className="flex-1">
                              <p className="text-[10px] text-slate-400 font-medium uppercase">
                                Submitted
                              </p>
                              <p className="text-xs text-slate-200">
                                {new Date(
                                  report.date_submitted,
                                ).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>

                          {report.landmark && (
                            <div className="flex items-start gap-2">
                              <span className="text-base mt-0.5">🏛️</span>
                              <div className="flex-1">
                                <p className="text-[10px] text-slate-400 font-medium uppercase">
                                  Landmark
                                </p>
                                <p className="text-xs text-slate-200">
                                  {report.landmark}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* View Details Button */}
                        <button
                          onClick={() => handleViewReport(report)}
                          className="w-full rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2 text-xs font-medium text-white transition-colors flex items-center justify-center gap-2"
                        >
                          <span>👁️</span>
                          View Full Report
                        </button>
                      </div>
                    </div>
                  ))}
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
            <>
              <ReportsAnalytics />
            </>
          )}
          {activeTab === "manageAccount" && (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 hover:border-slate-700 transition-colors max-w-2xl mx-auto">
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
                        Edit User Account
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Update user information
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
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={editingUserForm.first_name}
                        onChange={(e) =>
                          setEditingUserForm({
                            ...editingUserForm,
                            first_name: e.target.value,
                          })
                        }
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={editingUserForm.last_name}
                        onChange={(e) =>
                          setEditingUserForm({
                            ...editingUserForm,
                            last_name: e.target.value,
                          })
                        }
                        className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      📧 Email Address
                    </label>
                    <input
                      type="email"
                      value={editingUserForm.email}
                      onChange={(e) =>
                        setEditingUserForm({
                          ...editingUserForm,
                          email: e.target.value,
                        })
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-2">
                      📱 Contact Number
                    </label>
                    <input
                      type="tel"
                      value={editingUserForm.contact_number}
                      onChange={(e) =>
                        setEditingUserForm({
                          ...editingUserForm,
                          contact_number: e.target.value,
                        })
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600 transition-colors"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 p-6 flex gap-3">
                  <button
                    onClick={() => handleSaveUserEdit(editingUserId || "")}
                    className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                  >
                    <span>💾</span>
                    Save Changes
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>✖️</span>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
