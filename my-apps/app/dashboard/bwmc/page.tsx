"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
  FormEvent,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import TruckLoader from "../../loading/TruckLoader";
import {
  getDelayedCollectionsForBarangay,
  DelayedCollection,
  getDelayStatusColor,
} from "@/lib/delayDetection";
import { notifyCollectionDelay, notifyBWMCDelay } from "@/lib/smsNotifications";
import {
  startOfMonth,
  endOfMonth,
  addDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
} from "date-fns";

import BarangayConcernsAnalytics from "../../generatereport/barangayconcern";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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

interface CommunityReport {
  report_id: string;
  location: string;
  description: string;
  landmark: string;
  date_submitted: string;
  // add other fields as needed from your DB schema
}

type UserWithBarangay = User & {
  barangay?: { barangay_id: number; barangay_name: string } | null;
};

interface ProcessedAccountsTableProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accounts: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    email: string;
    contact_number: string;
  }>;
  bgColor: "emerald" | "red";
}

function ProcessedAccountsTable({
  title,
  subtitle,
  icon,
  accounts,
  bgColor,
}: ProcessedAccountsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const totalPages = Math.ceil(accounts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAccounts = accounts.slice(startIndex, endIndex);

  const bgClasses = {
    emerald: {
      header: "bg-emerald-500/10",
      iconBg: "bg-emerald-500/20",
      badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      text: "text-emerald-400",
    },
    red: {
      header: "bg-red-500/10",
      iconBg: "bg-red-500/20",
      badge: "bg-red-500/20 text-red-400 border-red-500/30",
      text: "text-red-400",
    },
  };

  const handlePrevious = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNext = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  return (
    <div className="bg-slate-950/60 rounded-2xl shadow-lg border border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between px-6 py-4 border-b border-gray-700 ${bgClasses[bgColor].header}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg ${bgClasses[bgColor].iconBg} flex items-center justify-center`}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-lg">{title}</h3>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-bold border ${bgClasses[bgColor].badge}`}
        >
          {accounts.length}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto flex-1 border border-gray-700 bg-slate-900/70">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="bg-slate-950/40 sticky top-0">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Email
              </th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Contact
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/30">
            {accounts.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-6 py-10 text-center text-slate-500"
                >
                  No {title.toLowerCase()} yet
                </td>
              </tr>
            ) : (
              paginatedAccounts.map((user, idx) => (
                <tr
                  key={`${user.user_id ?? "user"}-${idx}`}
                  className="hover:bg-slate-900/40 transition"
                >
                  <td className="px-6 py-4 font-medium text-slate-200">
                    {user.first_name} {user.last_name}
                  </td>
                  <td className="px-6 py-4 text-slate-400">{user.email}</td>
                  <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                    {user.contact_number}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {accounts.length > itemsPerPage && (
        <div className="px-6 py-4 border-t border-gray-700 bg-slate-950/30 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="text-slate-300">{startIndex + 1}</span> to{" "}
            <span className="text-slate-300">
              {Math.min(endIndex, accounts.length)}
            </span>{" "}
            of <span className="text-slate-300">{accounts.length}</span> entries
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevious}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      currentPage === page
                        ? `bg-${bgColor}-500/20 ${bgClasses[bgColor].text} border border-${bgColor}-500/30`
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({
  label,
  icon,
  badge,
  selected,
  onClick,
}: {
  label: string;
  icon: string;
  badge?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      variant={selected ? "default" : "ghost"}
      onClick={onClick}
      className={`flex gap-2 items-center w-full px-4 py-3 mb-2 text-left rounded-lg h-auto ${
        selected
          ? "bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="text-xl" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <Badge
          variant="destructive"
          className="ml-auto px-2 py-0.5 text-xs font-bold"
        >
          {badge}
        </Badge>
      )}
    </Button>
  );
}

// View Reports Section Component

export default function BWMCdashboard() {
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

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statsVisible, setStatsVisible] = useState(true);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [displayName, setDisplayName] = useState("User");
  const [pendingRequests, setPendingRequests] = useState<User[]>([]);
  const [approvedAccounts, setApprovedAccounts] = useState<User[]>([]);
  const [rejectedAccounts, setRejectedAccounts] = useState<User[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [loadingProcessed, setLoadingProcessed] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorUsers, setErrorUsers] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rejectAccountModalOpen, setRejectAccountModalOpen] = useState(false);
  const [rejectAccountReason, setRejectAccountReason] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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

  // BWMC user with barangay
  const [currentUser, setCurrentUser] = useState<UserWithBarangay | null>(null);
  const [dashboardCounts, setDashboardCounts] = useState({
    activeTrucks: 0,
    dailyCollections: 0,
    incidentReports: 0,
    delayedCollections: 0,
  });

  const [delayedCollections, setDelayedCollections] = useState<
    DelayedCollection[]
  >([]);
  const [loadingDelays, setLoadingDelays] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);

  const [sortOption, setSortOption] = useState<
    "latest" | "oldest" | "status" | "ongoing" | "needs" | "resolved"
  >("latest");

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "viewReports"
    | "schedules"
    | "pendingAccounts"
    | "processedAccounts"
    | "reports"
    | "generateReports"
    | "manageAccount"
  >("dashboard");
  const [tabFadeIn, setTabFadeIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = localStorage.getItem("bwmc_active_tab");
    if (
      persisted === "dashboard" ||
      persisted === "viewReports" ||
      persisted === "schedules" ||
      persisted === "pendingAccounts" ||
      persisted === "processedAccounts" ||
      persisted === "reports" ||
      persisted === "generateReports" ||
      persisted === "manageAccount"
    ) {
      setActiveTab(persisted);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("bwmc_active_tab", activeTab);
    setTabFadeIn(false);
    const timeoutId = window.setTimeout(() => setTabFadeIn(true), 40);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab]);

  // Manage Account form and states
  const [hasLoadedManageAccount, setHasLoadedManageAccount] = useState(false);
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

  // ---------- LOAD CURRENT BWMC USER WITH BARANGAY ----------
  useEffect(() => {
    async function fetchCurrentUserForBarangay() {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) return;

      const { data, error } = await supabase
        .from("users")
        .select(
          `
        user_id,
        username,
        first_name,
        last_name,
        email,
        contact_number,
        role,
        status,
        barangay:barangay_id (
          barangay_id,
          barangay_name
        )
      `,
        )
        .eq("user_id", session.user.id)
        .single<UserWithBarangay>(); // <-- generic here

      if (error || !data) return;

      setCurrentUser(data); // <-- no cast needed
    }

    fetchCurrentUserForBarangay();
  }, []);

  // ---------------------------------------------------------

  // Cogon (or whatever barangay the BWMC is) will appear here
  const defaultBarangayId = currentUser?.barangay?.barangay_id ?? null;

  // Fetch pending resident requests
  const fetchPendingRequests = useCallback(async () => {
    if (!currentUser?.barangay?.barangay_id) return;

    setLoadingPending(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "Resident")
      .eq("status", "pending")
      .eq("barangay_id", currentUser.barangay.barangay_id); // filter by barangay

    if (!error) setPendingRequests(data || []);
    setLoadingPending(false);
  }, [currentUser?.barangay?.barangay_id]);

  // Fetch processed accounts separated by approved and rejected
  const fetchProcessedAccounts = useCallback(async () => {
    if (!currentUser?.barangay?.barangay_id) return;

    setLoadingProcessed(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "Resident")
      .eq("barangay_id", currentUser.barangay.barangay_id) // filter by barangay
      .in("status", ["approved", "rejected"]);

    if (!error && data) {
      setApprovedAccounts(data.filter((u) => u.status === "approved"));
      setRejectedAccounts(data.filter((u) => u.status === "rejected"));
    }
    setLoadingProcessed(false);
  }, [currentUser?.barangay?.barangay_id]);

  // Fetch all users for dashboard context
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
    if (currentUser?.barangay?.barangay_id) {
      fetchPendingRequests();
      fetchProcessedAccounts();
    }
  }, [
    currentUser?.barangay?.barangay_id,
    fetchPendingRequests,
    fetchProcessedAccounts,
  ]);

  useEffect(() => {
    async function fetchDashboardCounts() {
      if (!currentUser?.barangay?.barangay_id) return;

      const todayStr = new Date().toISOString().split("T")[0];
      try {
        const [trucksRes, collectionsRes, reportsRes] = await Promise.all([
          supabase
            .from("garbage_trucks")
            .select("truck_id", { count: "exact", head: true }),
          supabase
            .from("collection_details")
            .select("collectiondetails_id", { count: "exact", head: true })
            .eq("collection_date", todayStr),
          supabase
            .from("community_reports")
            .select("report_id", { count: "exact", head: true })
            .eq("barangay_id", currentUser.barangay.barangay_id),
        ]);

        if (trucksRes.error) {
          console.error("Truck count fetch error:", trucksRes.error);
        }
        if (collectionsRes.error) {
          console.error(
            "Daily collection count fetch error:",
            collectionsRes.error,
          );
        }
        if (reportsRes.error) {
          console.error("Incident report count fetch error:", reportsRes.error);
        }

        setDashboardCounts({
          activeTrucks: trucksRes.count || 0,
          dailyCollections: collectionsRes.count || 0,
          incidentReports: reportsRes.count || 0,
          delayedCollections: 0,
        });
      } catch (err) {
        console.error("Unexpected error fetching dashboard counts:", err);
      }
    }

    fetchDashboardCounts();
  }, [currentUser?.barangay?.barangay_id]);

  // Fetch delayed collections for the barangay
  useEffect(() => {
    async function fetchDelayedCollections() {
      if (!currentUser?.barangay?.barangay_id) return;

      setLoadingDelays(true);
      try {
        const delayed = await getDelayedCollectionsForBarangay(
          currentUser.barangay.barangay_id,
        );
        setDelayedCollections(delayed);
        setDashboardCounts((prev) => ({
          ...prev,
          delayedCollections: delayed.length,
        }));
      } catch (error) {
        console.error("Error fetching delayed collections:", error);
      } finally {
        setLoadingDelays(false);
      }
    }

    fetchDelayedCollections();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDelayedCollections, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentUser?.barangay?.barangay_id]);

  // ---- Supabase Realtime: auto-refresh when any relevant table changes ----
  useEffect(() => {
    if (!currentUser?.barangay?.barangay_id) return;

    const barangayId = currentUser.barangay.barangay_id;

    // Helper to re-fetch all dashboard data
    const refreshAll = () => {
      fetchPendingRequests();
      fetchProcessedAccounts();
      fetchUsers();
      // Re-fetch dashboard counts inline
      (async () => {
        const todayStr = new Date().toISOString().split("T")[0];
        try {
          const [trucksRes, collectionsRes, reportsRes] = await Promise.all([
            supabase
              .from("garbage_trucks")
              .select("truck_id", { count: "exact", head: true }),
            supabase
              .from("collection_details")
              .select("collectiondetails_id", { count: "exact", head: true })
              .eq("collection_date", todayStr),
            supabase
              .from("community_reports")
              .select("report_id", { count: "exact", head: true })
              .eq("barangay_id", barangayId),
          ]);
          setDashboardCounts((prev) => ({
            ...prev,
            activeTrucks: trucksRes.count || 0,
            dailyCollections: collectionsRes.count || 0,
            incidentReports: reportsRes.count || 0,
          }));
        } catch (err) {
          console.error("Realtime refresh error:", err);
        }
      })();
      // Re-fetch delayed collections
      getDelayedCollectionsForBarangay(barangayId)
        .then((delayed) => {
          setDelayedCollections(delayed);
          setDashboardCounts((prev) => ({
            ...prev,
            delayedCollections: delayed.length,
          }));
        })
        .catch(console.error);
    };

    const channel = supabase
      .channel("bwmc-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        () => refreshAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_reports" },
        () => refreshAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_schedules" },
        () => refreshAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collection_details" },
        () => refreshAll(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "garbage_trucks" },
        () => refreshAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    currentUser?.barangay?.barangay_id,
    fetchPendingRequests,
    fetchProcessedAccounts,
    fetchUsers,
  ]);

  const summaryCards = [
    {
      label: "Pending Accounts",
      icon: "👤",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-300",
      trend: "Awaiting review",
      trendClass: "text-slate-500",
      count: pendingRequests.length,
    },
    {
      label: "Active Garbage Trucks",
      icon: "🚚",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-300",
      trend: "Citywide total",
      trendClass: "text-slate-500",
      count: dashboardCounts.activeTrucks,
    },
    {
      label: "Daily Collections",
      icon: "📈",
      iconBg: "bg-sky-500/15",
      iconColor: "text-sky-300",
      trend: "Today",
      trendClass: "text-slate-500",
      count: dashboardCounts.dailyCollections,
    },
    {
      label: "Delayed Collections",
      icon: "⏰",
      iconBg: "bg-red-500/15",
      iconColor: "text-red-300",
      trend: "Requires attention",
      trendClass: "text-red-400",
      count: dashboardCounts.delayedCollections,
    },
    {
      label: "Incident Reports",
      icon: "🗑️",
      iconBg: "bg-rose-500/15",
      iconColor: "text-rose-300",
      trend: "Barangay total",
      trendClass: "text-slate-500",
      count: dashboardCounts.incidentReports,
    },
  ];

  // Approve or Reject handler
  const handleApproveReject = async (
    userId: string,
    newStatus: "approved" | "rejected",
    reason?: string,
  ) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({
          status: newStatus,
          reject_reason: newStatus === "rejected" ? reason || null : null,
        })
        .eq("user_id", userId);

      if (error) {
        alert(`Failed to update account: ${error.message}`);
        return;
      }

      setPendingRequests((prev) => prev.filter((u) => u.user_id !== userId));

      const { data: updatedUser } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!updatedUser) return;

      if (newStatus === "approved") {
        setApprovedAccounts((prev) => [...prev, updatedUser as User]);
      } else {
        setRejectedAccounts((prev) => [...prev, updatedUser as User]);
      }

      // Send notification to resident
      if (updatedUser.contact_number) {
        await fetch("/api/notifications/registration-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userId,
            status: newStatus,
            reason: newStatus === "rejected" ? reason : undefined,
          }),
        });
      }
    } catch (err) {
      console.error(err);
      alert("Unexpected error while updating account.");
    }
  };

  // Manage Account logic
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

  const nameRegex = /^[A-Za-z\s]+$/;
  const sanitizeNameField = (value: string) =>
    value.replace(/[^A-Za-z\s]/g, "");

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
      !nameRegex.test(manageAccountForm.first_name) ||
      !nameRegex.test(manageAccountForm.last_name)
    ) {
      return "First and last names can only contain letters and spaces.";
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
    if (manageAccountForm.contact_number.length !== 11) {
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

  type Schedule = {
    schedule_id: string;
    days: string;
    start_time: string | null;
    end_time: string | null;
    status: string | null;
    barangay?: {
      barangay_id: number;
      barangay_name: string;
    } | null;
  };

  function generatePatternDates(
    pattern: string,
    year: number,
    month: number,
  ): Date[] {
    if (!pattern) return [];

    const validDays =
      pattern === "MWF" ? [1, 3, 5] : pattern === "TTH" ? [2, 4] : [];

    const dates: Date[] = [];
    let date = startOfMonth(new Date(year, month));
    const end = endOfMonth(date);

    while (date <= end) {
      if (validDays.includes(date.getDay())) {
        dates.push(new Date(date));
      }
      date = addDays(date, 1);
    }

    return dates;
  }

  function ScheduleCalendar({ schedule }: { schedule: Schedule }) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const patternDates = generatePatternDates(schedule.days, year, month);

    const weeks: Date[][] = [];
    const start = startOfWeek(startOfMonth(new Date(year, month)), {
      weekStartsOn: 1,
    });
    const end = endOfWeek(endOfMonth(new Date(year, month)), {
      weekStartsOn: 1,
    });

    let currentWeekStart = start;
    while (currentWeekStart <= end) {
      const weekDays: Date[] = [];
      for (let i = 0; i < 7; i++) {
        weekDays.push(addDays(currentWeekStart, i));
      }
      weeks.push(weekDays);
      currentWeekStart = addWeeks(currentWeekStart, 1);
    }
    return (
      <div className="mb-4 relative">
        {/* Month Header with decorative elements */}
        <div className="mb-3 flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-500/30" />
          <div className="relative">
            <span className="relative z-10 text-sm font-bold bg-gradient-to-r from-slate-100 via-emerald-200 to-slate-100 bg-clip-text text-transparent tracking-wide">
              {format(new Date(year, month), "LLLL yyyy")}
            </span>
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
          </div>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-emerald-500/30" />
        </div>

        {/* Calendar Container */}
        <div className="bg-slate-800/20 rounded-xl border border-slate-700/30 p-2 backdrop-blur-sm">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, idx) => (
              <div
                key={d}
                className={`text-center text-[15px] font-semibold uppercase tracking-wider py-1 rounded-md ${
                  idx >= 5
                    ? "text-emerald-400/60 bg-emerald-500/5"
                    : "text-slate-400 bg-slate-800/30"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {weeks.map((weekDays, weekIdx) =>
              weekDays.map((day) => {
                const isScheduled = patternDates.some(
                  (d) => d.toDateString() === day.toDateString(),
                );
                const isCurrentMonth = day.getMonth() === month;
                const isToday =
                  day.getDate() === now.getDate() &&
                  day.getMonth() === now.getMonth() &&
                  day.getFullYear() === now.getFullYear();
                const dayText = isCurrentMonth ? format(day, "d") : "";
                const isSatOrSun =
                  isCurrentMonth && (day.getDay() === 6 || day.getDay() === 0);

                let cellClasses =
                  "relative h-10 rounded-lg flex flex-col items-center justify-center text-md font-medium transition-all duration-200 ";
                let content = null;

                if (!isCurrentMonth) {
                  cellClasses +=
                    "text-slate-600/50 bg-transparent hover:bg-slate-800/20";
                } else if (isToday && isScheduled) {
                  // Today AND scheduled
                  cellClasses +=
                    "bg-red-600 text-white shadow-md shadow-red-900/50 border border-red-400 cursor-pointer ring-2 ring-red-400/50";
                  content = (
                    <>
                      <span className="relative z-10 font-bold text-sm">
                        {dayText}
                      </span>
                      <div className="absolute bottom-1 flex gap-0.5">
                        <div className="w-1 h-1 bg-red-200 rounded-full animate-pulse" />
                        <div className="w-1 h-1 bg-emerald-300/50 rounded-full animate-pulse delay-75" />
                      </div>
                    </>
                  );
                } else if (isToday) {
                  // Today only - full solid red
                  cellClasses +=
                    "bg-red-600 text-white shadow-md shadow-red-900/50 border border-red-400 font-bold ring-2 ring-red-400/50";
                  content = (
                    <span className="font-bold text-sm">{dayText}</span>
                  );
                } else if (isScheduled) {
                  // Scheduled days - Premium highlight
                  cellClasses +=
                    "bg-gradient-to-br from-emerald-600/90 to-teal-700/90 text-white shadow-md shadow-emerald-900/40 border border-emerald-400/30 cursor-pointer";
                  content = (
                    <>
                      <span className="relative z-10 font-bold text-sm">
                        {dayText}
                      </span>
                      <div className="absolute bottom-1 flex gap-0.5">
                        <div className="w-1 h-1 bg-emerald-200 rounded-full animate-pulse" />
                        <div className="w-1 h-1 bg-emerald-300/50 rounded-full animate-pulse delay-75" />
                      </div>
                    </>
                  );
                } else if (isSatOrSun) {
                  // Weekend non-scheduled
                  cellClasses +=
                    "bg-slate-800/40 text-emerald-400/40 border border-emerald-500/10";
                  content = <span className="font-medium">{dayText}</span>;
                } else {
                  // Normal weekdays
                  cellClasses +=
                    "bg-slate-800/30 text-slate-300 hover:bg-slate-700/50 hover:text-emerald-200 border border-transparent hover:border-emerald-500/20";
                  content = <span className="font-medium">{dayText}</span>;
                }

                return (
                  <div
                    key={day.toISOString() + weekIdx}
                    className={cellClasses}
                    title={
                      isToday && isScheduled && isCurrentMonth
                        ? `Today - Scheduled: ${format(day, "EEE, MMM d, yyyy")} at ${schedule.start_time ?? ""}`
                        : isScheduled && isCurrentMonth
                          ? `Scheduled: ${format(day, "EEE, MMM d, yyyy")} at ${schedule.start_time ?? ""}`
                          : isToday
                            ? "Today"
                            : isSatOrSun && isCurrentMonth
                              ? "Weekend - No collection"
                              : isCurrentMonth
                                ? `Available: ${format(day, "EEE, MMM d")}`
                                : ""
                    }
                  >
                    {content || <span>{dayText}</span>}

                    {/* Subtle day indicator for scheduled days */}
                    {isScheduled && isCurrentMonth && (
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900 shadow-sm" />
                    )}

                    {/* Today indicator dot */}
                    {isToday && !isScheduled && isCurrentMonth && (
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-400 rounded-full border border-slate-900 shadow-sm" />
                    )}
                  </div>
                );
              }),
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-2 flex items-center justify-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 border border-emerald-400/30" />
            <span className="text-slate-400">Collection Day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-600 border border-red-400" />
            <span className="text-slate-400">Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-800/40 border border-emerald-500/10" />
            <span className="text-slate-400">Weekend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-slate-800/30" />
            <span className="text-slate-400">Weekday</span>
          </div>
        </div>
      </div>
    );
  }

  function BWMCCollectionSchedulesFeature({
    defaultBarangayId,
  }: {
    defaultBarangayId: number | string | null;
  }) {
    const [barangays, setBarangays] = useState<
      { barangay_id: number | string; barangay_name: string }[]
    >([]);
    const [selectedBarangayId, setSelectedBarangayId] = useState<string>(
      defaultBarangayId ? String(defaultBarangayId) : "",
    );
    const [schedules, setSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // keep in sync with BWMC barangay
    useEffect(() => {
      if (defaultBarangayId) {
        setSelectedBarangayId(String(defaultBarangayId));
      }
    }, [defaultBarangayId]);

    // load barangays
    useEffect(() => {
      async function fetchBarangays() {
        try {
          const { data, error } = await supabase
            .from("barangay")
            .select("barangay_id, barangay_name")
            .order("barangay_name", { ascending: true });

          if (error) throw error;
          const list = data || [];
          setBarangays(list);

          // only fallback to first barangay if we truly have no default
          if (!defaultBarangayId && !selectedBarangayId && list.length > 0) {
            setSelectedBarangayId(String(list[0].barangay_id));
          }
        } catch (err: any) {
          setError(err.message || "Failed to load barangays.");
        }
      }
      fetchBarangays();
      // include selectedBarangayId so fallback only runs when still empty
    }, [defaultBarangayId, selectedBarangayId]);

    // load schedules
    useEffect(() => {
      async function fetchSchedules() {
        setLoading(true);
        setError(null);
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
        } catch (err: any) {
          setError(err.message || "Failed to load schedules.");
        } finally {
          setLoading(false);
        }
      }
      fetchSchedules();

      // Realtime: auto-refresh schedules when collection_schedules or collection_details changes
      const channel = supabase
        .channel("bwmc-schedules-realtime")
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
    }, []);

    const orderedSchedules = [...schedules].sort((a, b) => {
      const aIsBarangay = !!a.barangay?.barangay_id;
      const bIsBarangay = !!b.barangay?.barangay_id;
      if (aIsBarangay === bIsBarangay) return 0;
      return aIsBarangay ? -1 : 1;
    });

    const activeSchedule = orderedSchedules.find(
      (s) => String(s.barangay?.barangay_id) === String(selectedBarangayId),
    );

    return (
      <section className="w-full max-w-5xl mx-auto mt-6 md:mt-10 rounded-3xl border border-emerald-800/60 bg-slate-900/90 shadow-2xl shadow-emerald-900/40 px-4 py-5 md:p-8 backdrop-blur-xl space-y-5">
        {/* Top row: text + select */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
          <p className="text-xs md:text-sm text-slate-300">
            View barangay collection schedules assigned to GCPs.
          </p>

          <div className="w-full md:w-64">
            <label
              htmlFor="bwmc-barangay-select"
              className="block text-[11px] font-semibold uppercase tracking-wide text-emerald-300 mb-1"
            >
              Barangay
            </label>
            <select
              id="bwmc-barangay-select"
              value={selectedBarangayId}
              onChange={(e) => setSelectedBarangayId(e.target.value)}
              className="block w-full rounded-lg bg-slate-900/80 border border-emerald-700/60 px-3 py-2 text-sm text-slate-100
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                     appearance-none"
            >
              {barangays.map((b) => (
                <option key={b.barangay_id} value={b.barangay_id}>
                  {b.barangay_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-emerald-800/60 bg-slate-900/80 p-6 flex justify-center">
            <TruckLoader />
          </div>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-red-700/70 bg-red-900/40 p-4 text-xs md:text-sm text-red-100">
            Error: {error}
          </div>
        ) : activeSchedule ? (
          <div className="mt-2 space-y-4">
            {/* Schedule header + calendar */}
            <div className="rounded-2xl border border-emerald-800/60 bg-slate-900/80 p-4 md:p-5 shadow-lg shadow-emerald-900/40">
              <h3 className="font-semibold text-base md:text-lg text-emerald-300 mb-1">
                Barangay:{" "}
                <span className="text-slate-100">
                  {activeSchedule.barangay?.barangay_name || "N/A"}
                </span>
              </h3>
              <p className="text-xs md:text-sm text-slate-300">
                Days:{" "}
                <span className="font-medium text-emerald-200">
                  {activeSchedule.days || "N/A"}
                </span>
              </p>
              <p className="text-xs md:text-sm text-slate-300 mt-1">
                Assigned GCP:{" "}
                <span className="font-medium text-slate-100">
                  {activeSchedule.gcp_user
                    ? `${activeSchedule.gcp_user.first_name} ${activeSchedule.gcp_user.last_name}`
                    : "None"}
                </span>
              </p>

              <div className="mt-4 rounded-xl border border-emerald-800/60 bg-slate-900/80 p-2 md:p-3">
                {/* Allow horizontal scroll for the calendar on very small screens */}
                <div className="w-full overflow-x-auto">
                  <div className="min-w-[280px]">
                    <ScheduleCalendar schedule={activeSchedule} />
                  </div>
                </div>
              </div>
            </div>

            {/* Upcoming collections list */}
            {Array.isArray(activeSchedule.collection_details) &&
            activeSchedule.collection_details.length > 0 ? (
              <div className="rounded-2xl border border-emerald-800/60 bg-slate-900/80 p-4 md:p-5 shadow-lg shadow-emerald-900/40">
                <h4 className="text-xs md:text-sm font-semibold text-emerald-300 mb-3">
                  Upcoming Collections
                </h4>
                <ul className="space-y-3 text-xs md:text-sm text-slate-200">
                  {activeSchedule.collection_details.map((detail: any) => (
                    <li
                      key={detail.collectiondetails_id}
                      className="border border-slate-700/70 rounded-xl px-3 py-2 bg-slate-900/80 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div>
                          <span className="font-semibold text-slate-100">
                            Truck:
                          </span>{" "}
                          {detail.truck?.plate_number ||
                            detail.truck?.truck_code ||
                            "N/A"}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-100">
                            Collection Date:
                          </span>{" "}
                          {detail.collection_date
                            ? new Date(
                                detail.collection_date,
                              ).toLocaleDateString()
                            : "N/A"}
                        </div>
                      </div>
                      <div className="text-left md:text-right">
                        <span className="font-semibold text-slate-100">
                          Status:
                        </span>{" "}
                        {detail.status || "N/A"}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs md:text-sm text-slate-400">
                No collection details for this barangay.
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-xs md:text-sm text-slate-400">
            No schedule found for this barangay.
          </p>
        )}
      </section>
    );
  }

  function ViewReportsSection() {
    const [reports, setReports] = useState<any[]>([]);
    const [barangayName, setBarangayName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [descModalOpen, setDescModalOpen] = useState(false);
    const [descText, setDescText] = useState("");

    const [selectedReport, setSelectedReport] = useState<any | null>(null);
    const [responseType, setResponseType] = useState<
      "NEED_ACTION" | "ONGOING" | null
    >(null);
    const [responseRemarks, setResponseRemarks] = useState("");

    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [selectedReportPhotos, setSelectedReportPhotos] = useState<string[]>(
      [],
    );
    const [rejectRemarks, setRejectRemarks] = useState("");

    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [actionRemarks, setActionRemarks] = useState("");

    const [viewRemarkModalOpen, setViewRemarkModalOpen] = useState(false);
    const [viewRemarkText, setViewRemarkText] = useState("");
    const [viewRemarkTitle, setViewRemarkTitle] = useState("Remarks");
    const [selectedDescReport, setSelectedDescReport] = useState<
      (typeof reports)[0] | null
    >(null);

    // New state for table view
    const [reportTab, setReportTab] = useState<
      | "All Reports"
      | "Submitted"
      | "Ongoing"
      | "Needs Action"
      | "Resolved"
      | "Rejected"
    >("All Reports");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const reportsPerPage = 5;

    useEffect(() => {
      const fetchReports = async () => {
        setLoading(true);
        setError("");

        const { data: authUser } = await supabase.auth.getUser();
        if (!authUser?.user) {
          setError("User not authenticated.");
          setLoading(false);
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("barangay_id")
          .eq("user_id", authUser.user.id)
          .single();

        if (userError || !userData?.barangay_id) {
          setError("Cannot determine user barangay.");
          setLoading(false);
          return;
        }

        const { data: barangayData } = await supabase
          .from("barangay")
          .select("barangay_name")
          .eq("barangay_id", userData.barangay_id)
          .single();

        if (barangayData?.barangay_name) {
          setBarangayName(barangayData.barangay_name);
        }

        const { data, error: reportError } = await supabase
          .from("community_reports")
          .select(
            `
            *,
            reporter:user_id (
              first_name,
              last_name
            )
          `,
          )
          .eq("barangay_id", userData.barangay_id)
          .order("date_submitted", { ascending: false });

        if (!reportError && data) {
          const withLocalRemarks = data.map((r: any) => ({
            ...r,
            latest_remarks: r.latest_remarks ?? null,
          }));
          setReports(withLocalRemarks);
        }

        setLoading(false);
      };

      fetchReports();

      // Realtime: auto-refresh reports when community_reports or report_status_history changes
      const channel = supabase
        .channel("bwmc-reports-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "community_reports" },
          () => fetchReports(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "report_status_history" },
          () => fetchReports(),
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, []);

    useEffect(() => {
      if (!descModalOpen || !selectedDescReport) {
        setSelectedReportPhotos([]);
        return;
      }

      const fetchPhotos = async () => {
        const { data, error } = await supabase
          .from("report_photos")
          .select("photo_path")
          .eq("report_id", selectedDescReport.report_id);

        if (error) {
          console.error("Error fetching report_photos", error);
          setSelectedReportPhotos([]);
          return;
        }

        setSelectedReportPhotos(
          (data || []).map((item: { photo_path: string }) => item.photo_path),
        );
      };

      fetchPhotos();
    }, [descModalOpen, selectedDescReport]);

    const getCurrentUserId = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) return null;
      return data.user.id;
    };

    const handleOpenResponse = (report: any) => {
      setSelectedReport(report);
      setResponseType(null);
      setResponseRemarks("");
      setRejectModalOpen(false);
      setActionModalOpen(false);
    };

    const handleSubmitResponse = async () => {
      if (!selectedReport || !responseType) return;

      // responseType must match what you set in the radios, e.g. "NEED_ACTION" | "ONGOING"
      const newStatus =
        responseType === "NEED_ACTION" ? "Needs Action" : "Ongoing";

      const userId = await getCurrentUserId();
      if (!userId) {
        alert("User not authenticated.");
        return;
      }

      const { error: updateError } = await supabase
        .from("community_reports")
        .update({ current_status: newStatus })
        .eq("report_id", selectedReport.report_id);

      const { error: historyError } = await supabase
        .from("report_status_history")
        .insert({
          report_id: selectedReport.report_id,
          updated_by: userId,
          status: newStatus,
          remarks: responseRemarks,
          timestamp: new Date().toISOString(),
        });

      if (updateError || historyError) {
        alert(
          `Update error (response): ${
            updateError?.message || historyError?.message || "Unknown error"
          }`,
        );
        return;
      }

      // --- SMS to the resident who reported ---
      // make sure selectedReport has userid / user_id of the reporter in your query
      const { data: reporter, error: reporterError } = await supabase
        .from("users")
        .select("contact_number")
        .eq("user_id", selectedReport.user_id) // or selectedReport.userid depending on your column
        .single();

      if (!reporterError && reporter?.contact_number) {
        const msg = `Your report for ${selectedReport.location} is now ${newStatus}.`;

        await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: reporter.contact_number,
            message: msg,
          }),
        });
      }

      if (newStatus === "Needs Action") {
        const { data: secretaries, error: secretaryError } = await supabase
          .from("users")
          .select("user_id, contact_number")
          .eq("role", "Secretary")
          .not("contact_number", "is", null);

        if (!secretaryError && secretaries?.length) {
          const secretaryMessage = `Incident report #${selectedReport.report_id} requires your action. Location: ${selectedReport.location}. ${responseRemarks ? `\n\nRemarks: ${responseRemarks}. ` : ""}\n\nTrack the Truck`;

          await Promise.all(
            secretaries.map((secretary) =>
              fetch("/api/send-sms", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to: secretary.contact_number,
                  message: secretaryMessage,
                  userId: secretary.user_id,
                  notificationType: "incident_needs_action",
                }),
              }),
            ),
          );
        }
      }

      setReports((prev) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? {
                ...r,
                current_status: newStatus,
                latest_remarks: responseRemarks,
              }
            : r,
        ),
      );

      setSelectedReport(null);
      setResponseType(null);
      setResponseRemarks("");
    };

    const handleOpenReject = (report: any) => {
      setSelectedReport(report);
      setRejectRemarks("");
      setRejectModalOpen(true);
      setActionModalOpen(false);
    };

    const handleSubmitReject = async () => {
      if (!selectedReport) return;

      const userId = await getCurrentUserId();
      if (!userId) {
        alert("User not authenticated.");
        return;
      }

      const newStatus = "Rejected";

      const { error: updateError } = await supabase
        .from("community_reports")
        .update({ current_status: newStatus })
        .eq("report_id", selectedReport.report_id);

      const { error: historyError } = await supabase
        .from("report_status_history")
        .insert({
          report_id: selectedReport.report_id,
          updated_by: userId,
          status: newStatus,
          remarks: rejectRemarks,
          timestamp: new Date().toISOString(),
        });

      if (updateError || historyError) {
        alert(
          `Update error (reject): ${
            updateError?.message || historyError?.message || "Unknown error"
          }`,
        );
        return;
      }

      // Notify resident via SMS with BWMC remarks
      if (selectedReport.user_id) {
        try {
          await fetch("/api/notifications/incident-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reportId: selectedReport.report_id,
              userId: selectedReport.user_id,
              status: "rejected",
              reason: rejectRemarks || undefined,
            }),
          });
        } catch (notifyError) {
          console.error(
            "Failed to notify resident about rejection",
            notifyError,
          );
        }
      }

      setReports((prev: any[]) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? { ...r, current_status: newStatus, latest_remarks: rejectRemarks }
            : r,
        ),
      );

      setSelectedReport(null);
      setRejectModalOpen(false);
      setRejectRemarks("");
    };

    const handleOpenActionReport = (report: any) => {
      setSelectedReport(report);
      setActionRemarks("");
      setActionModalOpen(true);
      setRejectModalOpen(false);
    };

    const handleSubmitActionReport = async () => {
      if (!selectedReport) return;

      const userId = await getCurrentUserId();
      if (!userId) {
        alert("User not authenticated.");
        return;
      }

      const newStatus = "Resolved";

      const { error: updateError } = await supabase
        .from("community_reports")
        .update({ current_status: newStatus })
        .eq("report_id", selectedReport.report_id);

      const { error: historyError } = await supabase
        .from("report_status_history")
        .insert({
          report_id: selectedReport.report_id,
          updated_by: userId,
          status: newStatus,
          remarks: actionRemarks,
          timestamp: new Date().toISOString(),
        });

      if (updateError || historyError) {
        alert(
          `Update error (action): ${
            updateError?.message || historyError?.message || "Unknown error"
          }`,
        );
        return;
      }

      if (selectedReport.user_id) {
        try {
          await fetch("/api/notifications/incident-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reportId: selectedReport.report_id,
              userId: selectedReport.user_id,
              status: "resolved",
              actionTaken: actionRemarks || undefined,
            }),
          });
        } catch (notifyError) {
          console.error(
            "Failed to notify resident about resolution",
            notifyError,
          );
        }
      }

      setReports((prev: any[]) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? { ...r, current_status: newStatus, latest_remarks: actionRemarks }
            : r,
        ),
      );

      setSelectedReport(null);
      setActionModalOpen(false);
      setActionRemarks("");
    };

    // Filter and paginate reports
    const filteredReports = useMemo(() => {
      let filtered = [...reports];

      // Filter by tab
      if (reportTab === "Submitted") {
        filtered = filtered.filter((r) => r.current_status === "Submitted");
      } else if (reportTab === "Ongoing") {
        filtered = filtered.filter((r) => r.current_status === "Ongoing");
      } else if (reportTab === "Needs Action") {
        filtered = filtered.filter((r) => r.current_status === "Needs Action");
      } else if (reportTab === "Resolved") {
        filtered = filtered.filter((r) => r.current_status === "Resolved");
      } else if (reportTab === "Rejected") {
        filtered = filtered.filter((r) => r.current_status === "Rejected");
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const search = searchQuery.toLowerCase();
        filtered = filtered.filter((r) => {
          const reporterName = r.reporter
            ? `${r.reporter.first_name || ""} ${r.reporter.last_name || ""}`.trim()
            : "";
          const haystack = [
            r.location,
            r.description,
            r.landmark,
            r.current_status,
            r.report_id,
            reporterName,
          ]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase())
            .join(" ");
          return haystack.includes(search);
        });
      }

      // Sort by most recent
      return filtered.sort(
        (a, b) =>
          new Date(b.date_submitted).getTime() -
          new Date(a.date_submitted).getTime(),
      );
    }, [reports, reportTab, searchQuery]);

    const totalPages = Math.max(
      1,
      Math.ceil(filteredReports.length / reportsPerPage),
    );
    const currentPageNum = Math.min(currentPage, totalPages);
    const startIndex = (currentPageNum - 1) * reportsPerPage;
    const pagedReports = filteredReports.slice(
      startIndex,
      startIndex + reportsPerPage,
    );

    const visiblePages = (() => {
      const start = Math.max(1, currentPageNum - 1);
      const end = Math.min(totalPages, start + 2);
      return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
    })();

    useEffect(() => {
      setCurrentPage(1);
    }, [reportTab, searchQuery]);

    if (loading) {
      return (
        <section>
          <TruckLoader />
        </section>
      );
    }

    if (error) return <div className="text-red-700">{error}</div>;

    const reportTabs = [
      "All Reports",
      "Submitted",
      "Ongoing",
      "Needs Action",
      "Resolved",
      "Rejected",
    ] as const;

    return (
      <section className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">
              Incident Reports
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Monitor reported incidents for {barangayName || "Your Barangay"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full md:w-64"
            />
          </div>
        </div>

        {/* Table Section */}
        <div className="rounded-2xl border border-slate-800/70 bg-slate-900/80 shadow-xl shadow-black/40">
          <div className="p-5 md:p-6 space-y-4">
            {/* Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {reportTabs.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setReportTab(tab)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                      reportTab === tab
                        ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {loading && <TruckLoader />}

            {!loading && filteredReports.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-400">
                No reports match the selected filters.
              </div>
            )}

            {!loading && filteredReports.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-800">
                  <thead className="bg-slate-950/60">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Report ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Reported By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Description
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Date Submitted
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                    {pagedReports.map((report) => {
                      const statusConfig: Record<
                        string,
                        { className: string; label: string }
                      > = {
                        "Needs Action": {
                          className:
                            "bg-amber-500/15 text-amber-300 border border-amber-500/30",
                          label: "Needs Action",
                        },
                        Ongoing: {
                          className:
                            "bg-blue-500/15 text-blue-300 border border-blue-500/30",
                          label: "Ongoing",
                        },
                        Rejected: {
                          className:
                            "bg-rose-500/15 text-rose-300 border border-rose-500/30",
                          label: "Rejected",
                        },
                        Resolved: {
                          className:
                            "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
                          label: "Resolved",
                        },
                        Submitted: {
                          className:
                            "bg-slate-500/15 text-slate-300 border border-slate-500/30",
                          label: "Submitted",
                        },
                      };

                      const statusInfo =
                        statusConfig[report.current_status] ||
                        statusConfig.Submitted;

                      const reporterName = report.reporter
                        ? `${report.reporter.first_name || ""} ${report.reporter.last_name || ""}`.trim() ||
                          "Unknown"
                        : "Unknown";

                      return (
                        <tr key={report.report_id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            RP-{report.report_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            <div className="max-w-xs truncate">
                              {reporterName}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            <div className="max-w-xs truncate">
                              {report.location || "N/A"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-200">
                            <div className="max-w-md truncate">
                              {report.description || "No description"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${statusInfo.className}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                            {new Date(report.date_submitted).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => {
                                setSelectedDescReport(report);
                                setDescText(report.description);
                                setDescModalOpen(true);
                              }}
                              className="text-emerald-300 hover:text-emerald-200 mr-4"
                            >
                              View
                            </button>
                            {report.current_status === "Submitted" ? (
                              <>
                                <button
                                  onClick={() => handleOpenResponse(report)}
                                  className="text-blue-300 hover:text-blue-200 mr-4"
                                >
                                  Respond
                                </button>
                                <button
                                  onClick={() => handleOpenReject(report)}
                                  className="text-red-300 hover:text-red-200"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setViewRemarkTitle(
                                    report.current_status === "Rejected"
                                      ? "Reject Remark"
                                      : "Response Remark",
                                  );
                                  setViewRemarkText(
                                    report.latest_remarks ||
                                      "No remarks provided.",
                                  );
                                  setViewRemarkModalOpen(true);
                                }}
                                className="text-slate-300 hover:text-slate-100"
                              >
                                Remark
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

            {/* Pagination */}
            {!loading && filteredReports.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between text-sm text-slate-400">
                <div>
                  Showing {filteredReports.length ? startIndex + 1 : 0} to{" "}
                  {Math.min(
                    startIndex + reportsPerPage,
                    filteredReports.length,
                  )}{" "}
                  of {filteredReports.length} results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={currentPageNum === 1}
                    className="rounded-lg bg-slate-800 px-3 py-1 text-sm text-slate-200 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {visiblePages.map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`rounded-lg px-3 py-1 text-sm ${
                        page === currentPageNum
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
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={currentPageNum === totalPages}
                    className="rounded-lg bg-slate-800 px-3 py-1 text-sm text-slate-200 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description modal */}
        {descModalOpen && selectedDescReport && (
          <div
            className="pt-10 fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setDescModalOpen(false);
              setSelectedDescReport(null);
            }}
            onKeyDown={(e) =>
              e.key === "Escape" &&
              (setDescModalOpen(false), setSelectedDescReport(null))
            }
            tabIndex={-1}
            role="presentation"
          >
            <div
              className="relative w-full max-w-lg rounded-2xl bg-slate-900/95 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)] border border-slate-700/80 transform transition-all duration-150"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="desc-modal-title"
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-3 border-b border-slate-700/80">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-600/10 text-emerald-300 border border-emerald-700/30">
                    📷
                  </span>
                  <h3
                    id="desc-modal-title"
                    className="ml-1 text-sm font-semibold tracking-wide text-slate-200"
                  >
                    Report Description
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setDescModalOpen(false);
                    setSelectedDescReport(null);
                  }}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  aria-label="Close description dialog"
                >
                  ✕
                </button>
              </div>

              {/* Content area */}
              <div className="p-6 space-y-4">
                {/* Photo container */}
                <div className="rounded-xl border border-slate-700/80 bg-slate-950/60 px-3 py-3 flex items-center justify-center min-h-[160px]">
                  {selectedReportPhotos.length > 0 ? (
                    <div className="flex flex-wrap justify-center items-center gap-2">
                      {selectedReportPhotos.map((url, index) => (
                        <img
                          key={`${url}-${index}`}
                          src={url}
                          alt={`Incident photo ${index + 1}`}
                          className="max-h-72 max-w-full rounded-lg object-contain shadow-lg shadow-slate-900/70"
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">
                      No photo was attached to this report.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80">
                    DETAILS
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Detailed information provided by the resident.
                  </p>
                </div>

                <div className="h-px w-full bg-slate-700/70" />

                {/* Scrollable text */}
                <div className="max-h-60 overflow-y-auto pr-1 custom-scroll rounded-lg bg-slate-900/80 border border-slate-700/70 px-3 py-2">
                  <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-line">
                    {descText}
                  </p>
                </div>

                {/* Footer / status bar */}
                <div className="flex items-center justify-between text-[11px] text-slate-400"></div>
              </div>
            </div>
          </div>
        )}

        {/* Response modal */}
        {selectedReport && !rejectModalOpen && !actionModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedReport(null)}
            onKeyDown={(e) => e.key === "Escape" && setSelectedReport(null)}
            tabIndex={-1}
            role="presentation"
          >
            <div
              className="relative w-full max-w-lg text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-2xl border border-slate-700/80 bg-slate-900/95 transform transition-all duration-150"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="response-dialog-title"
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-3 border-b border-slate-700/80">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-600/10 text-emerald-300 border border-emerald-700/30">
                    🛠️
                  </span>
                  <h3
                    id="response-dialog-title"
                    className="ml-1 text-sm font-semibold tracking-wide text-slate-200"
                  >
                    Response • {selectedReport.location}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedReport(null)}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  aria-label="Close response dialog"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-1">
                  ACTION
                </p>
                <p className="text-sm mb-3 text-slate-200">
                  Choose how this incident will be handled.
                </p>

                {/* Options */}
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border ${
                      responseType === "NEED_ACTION"
                        ? "bg-amber-900/10 border-amber-500/60 ring-1 ring-amber-400/20"
                        : "bg-slate-800/60 border-slate-700/70 hover:bg-slate-800/70"
                    }`}
                  >
                    <input
                      className="mt-1 text-emerald-500 focus:ring-emerald-500"
                      type="radio"
                      name="responseType"
                      value="NEED_ACTION"
                      checked={responseType === "NEED_ACTION"}
                      onChange={() => setResponseType("NEED_ACTION")}
                    />
                    <div>
                      <div className="font-semibold text-slate-100">
                        Need action by SWMO
                      </div>
                      <div className="text-xs text-slate-400">
                        Escalate this report to SWMO for direct intervention.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border ${
                      responseType === "ONGOING"
                        ? "bg-sky-900/10 border-sky-500/60 ring-1 ring-sky-400/20"
                        : "bg-slate-800/60 border-slate-700/70 hover:bg-slate-800/70"
                    }`}
                  >
                    <input
                      className="mt-1 text-emerald-500 focus:ring-emerald-500"
                      type="radio"
                      name="responseType"
                      value="ONGOING"
                      checked={responseType === "ONGOING"}
                      onChange={() => setResponseType("ONGOING")}
                    />
                    <div>
                      <div className="font-semibold text-slate-100">
                        BWMC can resolve (Ongoing)
                      </div>
                      <div className="text-xs text-slate-400">
                        Mark as in-progress under your barangay's handling.
                      </div>
                    </div>
                  </label>
                </div>

                {/* Remarks */}
                <label className="block text-sm font-semibold mb-1 text-slate-200">
                  Remarks
                </label>
                <textarea
                  className="w-full border border-slate-700 rounded-xl px-2.5 py-2 text-sm mb-4 text-slate-100 bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  rows={3}
                  value={responseRemarks}
                  onChange={(e) => setResponseRemarks(e.target.value)}
                  placeholder="Add details about your response..."
                  required
                />

                {/* Footer / buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedReport(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitResponse}
                    disabled={!responseType}
                    aria-disabled={!responseType}
                  >
                    Submit response
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reject modal */}
        {rejectModalOpen && selectedReport && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setRejectModalOpen(false);
              setSelectedReport(null);
            }}
            onKeyDown={(e) =>
              e.key === "Escape" &&
              (setRejectModalOpen(false), setSelectedReport(null))
            }
            tabIndex={-1}
            role="presentation"
          >
            <div
              className="relative w-full max-w-lg text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-2xl border border-red-700/80 bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="reject-dialog-title"
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-3 border-b border-red-700/70">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-red-600/10 text-red-300 border border-red-700/30">
                    🚫
                  </span>
                  <h3
                    id="reject-dialog-title"
                    className="ml-1 text-sm font-semibold tracking-wide text-slate-100"
                  >
                    Reject Report • {selectedReport.location}
                  </h3>
                </div>

                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setSelectedReport(null);
                  }}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500/40"
                  aria-label="Close reject dialog"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-red-400/80 mb-1">
                  REJECTION REASON
                </p>
                <p className="text-sm mb-3 text-slate-200">
                  Please provide a clear explanation for rejecting this
                  incident.
                </p>

                <textarea
                  className="w-full border border-slate-700 rounded-xl px-2.5 py-2 text-sm mb-4 text-slate-100 bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  rows={3}
                  value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="Reason for rejection..."
                  required
                />

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setRejectModalOpen(false);
                      setSelectedReport(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleSubmitReject}>
                    Submit rejection
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Report modal */}
        {actionModalOpen && selectedReport && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setActionModalOpen(false);
              setSelectedReport(null);
            }}
          >
            <div
              className="relative w-full max-w-md text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-emerald-700/70 bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-2 border-b border-emerald-700/70">
                <div className="flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-sm shadow-emerald-900" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-sm shadow-amber-900" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400/80 shadow-sm shadow-slate-900" />
                  </span>
                  <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
                    Action Report • {selectedReport.location}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setActionModalOpen(false);
                    setSelectedReport(null);
                  }}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-1">
                  ACTION DETAILS
                </p>
                <p className="text-sm mb-3 text-slate-200">
                  Describe the actions taken by the BWMC to resolve this
                  incident.
                </p>

                <textarea
                  className="w-full border border-slate-700 rounded-xl px-2.5 py-2 text-sm mb-4 text-slate-100 bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  rows={3}
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  placeholder="Details of the action taken..."
                  required
                />

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                  <Button
                    onClick={() => {
                      setActionModalOpen(false);
                      setSelectedReport(null);
                    }}
                    variant="secondary"
                    className="h-auto"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSubmitActionReport} className="h-auto">
                    Submit action
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View remark modal */}
        {viewRemarkModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setViewRemarkModalOpen(false)}
          >
            <div
              className="relative w-full max-w-md text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-emerald-700/70 bg-slate-900/95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-2 border-b border-emerald-700/70">
                <div className="flex items-center gap-2">
                  <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
                    {viewRemarkTitle}
                  </span>
                </div>

                <button
                  onClick={() => setViewRemarkModalOpen(false)}
                  className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-2">
                  REMARK
                </p>

                <div className="max-h-60 overflow-y-auto pr-1 rounded-lg bg-slate-900/80 border border-slate-700/70 px-3 py-2">
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                    {viewRemarkText}
                  </p>
                </div>

                {/* Footer */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setViewRemarkModalOpen(false)}
                    className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-emerald-950/70 text-slate-100 flex flex-col relative overflow-hidden antialiased">
      {/* Top navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-900/40 bg-slate-950/80 shadow-lg shadow-emerald-900/20 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4 min-h-16">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg bg-slate-900/80 text-slate-100 hover:bg-slate-800 transition-colors flex-shrink-0 ring-1 ring-white/10"
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              {sidebarOpen ? "✖" : "☰"}
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-lg flex-shrink-0 shadow-lg shadow-emerald-900/40">
                🗑️
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold truncate">
                  Track-the-Truck
                </p>
                <h1 className="text-lg font-bold text-slate-100 truncate">
                  BWMC Dashboard
                </h1>
              </div>
            </div>
          </div>
          {/* Profile Dropdown */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-100 font-medium transition-colors whitespace-nowrap ring-1 ring-white/10"
            >
              {/* Initials circle */}
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-800 text-slate-200 font-bold text-lg mr-2">
                {displayName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </span>
              <svg
                className={`w-4 h-4 text-slate-300 transition-transform duration-300 flex-shrink-0 ${profileDropdownOpen ? "rotate-180" : ""}`}
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

        {/* Sidebar – same sizing as SWMO, BWMC items */}
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
            {[
              { label: "Dashboard", icon: "📊", tab: "dashboard" },
              { label: "Pending Accounts", icon: "⏳", tab: "pendingAccounts" },
              {
                label: "Processed Accounts",
                icon: "✅",
                tab: "processedAccounts",
              },
              { label: "View Reports", icon: "📈", tab: "viewReports" },
              { label: "Schedules", icon: "📅", tab: "schedules" },
              { label: "Generate Reports", icon: "📊", tab: "generateReports" },
            ].map((item) => (
              <Button
                key={item.tab}
                variant={activeTab === item.tab ? "default" : "ghost"}
                onClick={() => {
                  setActiveTab(
                    item.tab as
                      | "dashboard"
                      | "pendingAccounts"
                      | "processedAccounts"
                      | "viewReports"
                      | "schedules"
                      | "generateReports"
                      | "manageAccount",
                  );
                  setSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 justify-start rounded-lg px-4 py-3 h-auto"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Button>
            ))}

            <div className="pt-6 mt-6 border-t border-green-800/40"></div>
          </nav>
        </aside>

        {/* Main content – same paddings, structure as SWMO */}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                      {summaryCards.map((card) => (
                        <div
                          key={card.label}
                          className="rounded-2xl border-2 border-gray-700 bg-slate-900/80 p-6 shadow-xl shadow-black/40"
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
                </section>

                {/* Delayed Collections Alert Section */}
                {delayedCollections.length > 0 && (
                  <section className="dashboard-section">
                    <div className="dashboard-section-glow" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent drop-shadow-lg">
                            ⚠️ Delayed Collections
                          </h2>
                          <p className="text-sm text-slate-400 mt-1">
                            Collections past their scheduled time
                          </p>
                        </div>
                        <Button
                          onClick={async () => {
                            if (!currentUser?.barangay?.barangay_id) return;
                            setSendingSMS(true);
                            try {
                              const delayed =
                                await getDelayedCollectionsForBarangay(
                                  currentUser.barangay.barangay_id,
                                );
                              setDelayedCollections(delayed);
                              setDashboardCounts((prev) => ({
                                ...prev,
                                delayedCollections: delayed.length,
                              }));
                            } catch (error) {
                              console.error("Error refreshing delays:", error);
                            } finally {
                              setSendingSMS(false);
                            }
                          }}
                          variant="secondary"
                          className="h-auto"
                          disabled={loadingDelays}
                        >
                          🔄 Refresh
                        </Button>
                      </div>

                      <div className="space-y-4">
                        {delayedCollections.map((delayed, idx) => {
                          const delayStatus = getDelayStatusColor(
                            delayed.delay_minutes,
                          );
                          return (
                            <div
                              key={`${delayed.schedule_id}-${idx}`}
                              className="rounded-xl border border-red-800/60 bg-slate-900/80 p-4 shadow-lg"
                            >
                              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-lg font-semibold text-slate-100">
                                      {delayed.barangay_name}
                                    </h3>
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-semibold ${delayStatus.bg} ${delayStatus.text}`}
                                    >
                                      {delayStatus.label}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-300">
                                    <p>
                                      <span className="text-slate-500">
                                        Scheduled:
                                      </span>{" "}
                                      {delayed.scheduled_date} at{" "}
                                      {delayed.scheduled_time}
                                    </p>
                                    <p>
                                      <span className="text-slate-500">
                                        Delay:
                                      </span>{" "}
                                      <span className="text-red-400 font-semibold">
                                        {delayed.delay_minutes} minutes
                                      </span>
                                    </p>
                                    <p>
                                      <span className="text-slate-500">
                                        GCP:
                                      </span>{" "}
                                      {delayed.gcp_name}
                                    </p>
                                    <p>
                                      <span className="text-slate-500">
                                        Status:
                                      </span>{" "}
                                      {delayed.status}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                  <Button
                                    onClick={async () => {
                                      // Notify residents in the barangay
                                      if (
                                        !confirm(
                                          `Send delay notification to residents in ${delayed.barangay_name}?`,
                                        )
                                      )
                                        return;

                                      setSendingSMS(true);
                                      try {
                                        // Fetch residents in this barangay
                                        const { data: residents, error } =
                                          await supabase
                                            .from("users")
                                            .select(
                                              "first_name, last_name, contact_number",
                                            )
                                            .eq("role", "Resident")
                                            .eq(
                                              "barangay_id",
                                              delayed.barangay_id,
                                            )
                                            .eq("status", "approved");

                                        if (error) throw error;

                                        // Send SMS to each resident
                                        for (const resident of residents ||
                                          []) {
                                          await notifyCollectionDelay(
                                            {
                                              name: `${resident.first_name} ${resident.last_name}`,
                                              phoneNumber:
                                                resident.contact_number,
                                            },
                                            delayed.barangay_name,
                                            delayed.delay_minutes,
                                          );
                                        }

                                        alert(
                                          `Delay notifications sent to ${residents?.length || 0} residents`,
                                        );
                                      } catch (error) {
                                        console.error(
                                          "Error sending notifications:",
                                          error,
                                        );
                                        alert(
                                          "Failed to send notifications. Check console for details.",
                                        );
                                      } finally {
                                        setSendingSMS(false);
                                      }
                                    }}
                                    variant="outline"
                                    className="text-sm h-auto"
                                    disabled={sendingSMS}
                                  >
                                    📱 Notify Residents
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                )}

                {/* Map Section with Toggle Button */}
                <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)] gap-6">
                  <div className="dashboard-section overflow-hidden">
                    <div className="dashboard-section-glow" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                          Live Truck Tracking{" "}
                        </h2>
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 h-[500px] md:h-[600px] relative z-10">
                        <LeafletMap />
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === "pendingAccounts" && (
              <section className="my-8 space-y-4 px-2 md:px-10">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent">
                      Pending Resident Accounts
                    </h2>
                    <p className="text-sm md:text-base text-slate-300">
                      Review and approve or reject new resident registrations.
                    </p>
                  </div>
                </div>

                {loadingPending ? (
                  <div className="rounded-3xl border border-emerald-800/60 bg-slate-900/80 shadow-2xl shadow-emerald-900/40 backdrop-blur-xl p-6">
                    <TruckLoader />
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="mt-4 p-6 rounded-3xl border border-slate-700/80 bg-slate-900/80 text-center text-slate-300 shadow-xl shadow-slate-900/40">
                    No pending accounts.
                  </div>
                ) : (
                  <div className="rounded-3xl border border-emerald-800/60 bg-slate-900/90 shadow-2xl shadow-emerald-900/40 backdrop-blur-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-emerald-700/60 bg-slate-900/95 flex items-center justify-between">
                      <span className="text-emerald-200 font-semibold text-lg">
                        Pending Accounts
                      </span>
                      <span className="text-sm text-emerald-300">
                        Total {pendingRequests.length}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-emerald-900/80 text-emerald-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold">
                              Name
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Email
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Contact
                            </th>
                            <th className="px-3 py-2 text-left font-semibold">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingRequests.map((user, idx) => (
                            <tr
                              key={user.user_id}
                              className={
                                idx % 2 === 0
                                  ? "bg-slate-900/80"
                                  : "bg-slate-800/80"
                              }
                            >
                              <td className="px-3 py-2 text-slate-100">
                                {user.first_name} {user.last_name}
                              </td>
                              <td className="px-3 py-2 text-slate-200">
                                {user.email}
                              </td>
                              <td className="px-3 py-2 text-slate-200">
                                {user.contact_number}
                              </td>
                              <td className="px-3 py-2 text-slate-100">
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      const confirmed = window.confirm(
                                        "Are you sure you want to APPROVE this account?",
                                      );
                                      if (!confirmed) return;
                                      handleApproveReject(
                                        user.user_id,
                                        "approved",
                                      );
                                    }}
                                    className="px-3 py-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 text-xs font-semibold shadow-md shadow-emerald-600/40 hover:from-emerald-500 hover:to-teal-500"
                                  >
                                    Approve
                                  </button>

                                  <button
                                    onClick={() => {
                                      const confirmed = window.confirm(
                                        "Are you sure you want to REJECT this account?",
                                      );
                                      if (!confirmed) return;
                                      setSelectedUserId(user.user_id);
                                      setRejectAccountReason("");
                                      setRejectAccountModalOpen(true);
                                    }}
                                    className="px-3 py-1 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-slate-50 text-xs font-semibold shadow-md shadow-red-600/40 hover:from-red-500 hover:to-rose-500"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {rejectAccountModalOpen && selectedUserId && (
                  <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center"
                    onClick={() => setRejectAccountModalOpen(false)}
                  >
                    <div
                      className="relative max-w-md w-full text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.65)] rounded-2xl border border-red-700/80 bg-slate-900/95"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Title bar */}
                      <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-2 border-b border-red-700/70">
                        <div className="flex items-center gap-2">
                          <span className="flex gap-1">
                            <span className="h-2.5 w-2.5 rounded-full bg-red-500/90 shadow-sm shadow-red-900" />
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-sm shadow-amber-900" />
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 shadow-sm shadow-emerald-900" />
                          </span>
                          <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
                            Reject Resident Account
                          </span>
                        </div>

                        <button
                          onClick={() => setRejectAccountModalOpen(false)}
                          className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
                          aria-label="Close"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-red-400/80 mb-1">
                          REJECTION REASON
                        </p>
                        <p className="text-sm mb-3 text-slate-200">
                          Please provide a clear explanation for rejecting this
                          resident&apos;s account request.
                        </p>

                        <textarea
                          className="w-full border border-slate-700 rounded-xl px-2.5 py-2 text-sm mb-4 text-slate-100 bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                          rows={3}
                          value={rejectAccountReason}
                          onChange={(e) =>
                            setRejectAccountReason(e.target.value)
                          }
                          placeholder="Reason for rejection..."
                          required
                        />

                        {/* Footer */}
                        <div className="flex justify-end gap-2 pt-1 border-t border-slate-800/80 mt-2">
                          <button
                            onClick={() => setRejectAccountModalOpen(false)}
                            className="px-3 py-1.5 text-sm rounded-lg border border-slate-600 text-slate-200 bg-slate-900/60 hover:bg-slate-800/80 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              if (!selectedUserId) return;
                              if (!rejectAccountReason.trim()) {
                                alert("Please enter a reason for rejection.");
                                return;
                              }
                              await handleApproveReject(
                                selectedUserId,
                                "rejected",
                                rejectAccountReason.trim(),
                              );
                              setRejectAccountModalOpen(false);
                              setSelectedUserId(null);
                              setRejectAccountReason("");
                            }}
                            className="px-4 py-1.5 text-sm rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-slate-50 border border-red-500/80 shadow-sm shadow-red-700/60 hover:from-red-500 hover:to-rose-500 transition-colors"
                          >
                            Submit rejection
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === "viewReports" && <ViewReportsSection />}

            {activeTab === "processedAccounts" && (
              <section className="space-y-6">
                {/* Header */}
                <div className="glass-panel rounded-2xl p-6 card-glow">
                  <h2 className="text-2xl font-bold gradient-text mb-2">
                    Processed Resident Accounts
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Review residents whose registrations have already been
                    approved or rejected.
                  </p>
                </div>

                {loadingProcessed ? (
                  <div className="rounded-2xl border border-gray-700 bg-slate-900/70 p-12 flex items-center justify-center">
                    <TruckLoader />
                  </div>
                ) : (
                  <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Approved */}
                      <div className="rounded-2xl border border-gray-700 bg-slate-900/70 p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                              Total Approved
                            </p>
                            <h3 className="text-3xl font-bold text-emerald-400">
                              {approvedAccounts.length}
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">
                              Active residents
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-emerald-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              ></path>
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Rejected */}
                      <div className="rounded-2xl border border-gray-700 bg-slate-900/70 p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                              Total Rejected
                            </p>
                            <h3 className="text-3xl font-bold text-red-400">
                              {rejectedAccounts.length}
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">
                              Declined
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-red-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M6 18L18 6M6 6l12 12"
                              ></path>
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Processed */}
                      <div className="rounded-2xl border border-gray-700 bg-slate-900/70 p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                              Total Processed
                            </p>
                            <h3 className="text-3xl font-bold text-blue-400">
                              {approvedAccounts.length +
                                rejectedAccounts.length}
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">
                              Applications
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-blue-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              ></path>
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Approval Rate */}
                      <div className="rounded-2xl border border-gray-700 bg-slate-900/70 p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
                              Approval Rate
                            </p>
                            <h3 className="text-3xl font-bold text-purple-400">
                              {approvedAccounts.length +
                                rejectedAccounts.length >
                              0
                                ? Math.round(
                                    (approvedAccounts.length /
                                      (approvedAccounts.length +
                                        rejectedAccounts.length)) *
                                      100,
                                  )
                                : 0}
                              %
                            </h3>
                            <p className="text-slate-500 text-xs mt-1">
                              Success rate
                            </p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-purple-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                              ></path>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tables Grid with Pagination */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 ">
                      {/* Approved Accounts */}
                      <ProcessedAccountsTable
                        title="Approved Accounts"
                        subtitle="Active registrations"
                        icon={
                          <svg
                            className="w-5 h-5 text-emerald-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            ></path>
                          </svg>
                        }
                        accounts={approvedAccounts}
                        bgColor="emerald"
                      />

                      {/* Rejected Accounts */}
                      <ProcessedAccountsTable
                        title="Rejected Accounts"
                        subtitle="Declined registrations"
                        icon={
                          <svg
                            className="w-5 h-5 text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"
                            ></path>
                          </svg>
                        }
                        accounts={rejectedAccounts}
                        bgColor="red"
                      />
                    </div>
                  </>
                )}
              </section>
            )}

            {activeTab === "schedules" && (
              <section className="my-6">
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-emerald-300 to-teal-400 bg-clip-text text-transparent ">
                  Collection Schedules
                </h2>
                <BWMCCollectionSchedulesFeature
                  defaultBarangayId={defaultBarangayId}
                />
              </section>
            )}

            {activeTab === "generateReports" &&
              currentUser?.barangay?.barangay_id && (
                <BarangayConcernsAnalytics
                  barangayId={currentUser.barangay.barangay_id}
                />
              )}

            {activeTab === "manageAccount" && (
              <div className="dashboard-section max-w-2xl mx-auto">
                <div className="dashboard-section-glow" />
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
        </main>
      </div>
    </div>
  );
}

type ManageAccountSectionProps = {
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
};

function ManageAccountSection(props: ManageAccountSectionProps) {
  const { form, loading, error, success, onChange, onSubmit } = props;

  if (loading) return <TruckLoader />;

  return (
    <section className="max-w-5xl mx-auto rounded-3xl bg-slate-900/95 border border-slate-800 px-10 py-8 shadow-2xl">
      <h2 className="text-3xl font-bold mb-1 text-emerald-400">
        Manage Account
      </h2>
      <p className="text-[11px] text-slate-400 mb-6">
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
            className="text-xs font-semibold text-slate-100"
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
              className="text-xs font-semibold text-slate-100"
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
              className="text-xs font-semibold text-slate-100"
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

        {/* Contact / Email */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="contact_number"
              className="text-xs font-semibold text-slate-100"
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
              className="text-xs font-semibold text-slate-100"
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

        {/* Passwords */}
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-xs font-semibold text-slate-100"
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
            className="text-xs font-semibold text-slate-100"
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
      <Label htmlFor={name} className="text-sm font-semibold text-slate-100">
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
