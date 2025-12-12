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
import { sendSMS } from "@/lib/sms";

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

// Erase after testing SMS functionality

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
      <span className="flex-1">{label}</span>
      {badge !== undefined && (
        <span className="ml-auto bg-red-600 text-white rounded-full px-2 py-0.5 text-xs font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}

// View Reports Section Component

export default function BWMCdashboard() {
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "viewReports"
    | "pendingAccounts"
    | "processedAccounts"
    | "manageAccount"
  >("dashboard");

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
    null
  );
  const [manageAccountSuccess, setManageAccountSuccess] = useState<
    string | null
  >(null);

  // Fetch pending resident requests
  const fetchPendingRequests = useCallback(async () => {
    setLoadingPending(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "Resident")
      .eq("status", "pending");
    if (!error) setPendingRequests(data || []);
    setLoadingPending(false);
  }, []);

  // Fetch processed accounts separated by approved and rejected
  const fetchProcessedAccounts = useCallback(async () => {
    setLoadingProcessed(true);
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "Resident")
      .in("status", ["approved", "rejected"]);
    if (!error && data) {
      setApprovedAccounts(data.filter((u) => u.status === "approved"));
      setRejectedAccounts(data.filter((u) => u.status === "rejected"));
    }
    setLoadingProcessed(false);
  }, []);

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
    fetchPendingRequests();
    fetchProcessedAccounts();
  }, [fetchUsers, fetchPendingRequests, fetchProcessedAccounts]);

  // Approve or Reject handler
  const handleApproveReject = async (
    userId: string,
    newStatus: "approved" | "rejected",
    reason?: string
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

      // remove from pending list
      setPendingRequests((prev) => prev.filter((u) => u.user_id !== userId));

      // fetch updated user and move to processed list
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

      // send SMS via API route
      if (updatedUser.contact_number) {
        const message =
          newStatus === "approved"
            ? "Your account has been approved."
            : `Your account has been rejected. Reason: ${
                reason || "No reason provided."
              }`;

        await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: updatedUser.contact_number,
            message,
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

  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
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
    const [rejectRemarks, setRejectRemarks] = useState("");

    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [actionRemarks, setActionRemarks] = useState("");

    const [viewRemarkModalOpen, setViewRemarkModalOpen] = useState(false);
    const [viewRemarkText, setViewRemarkText] = useState("");
    const [viewRemarkTitle, setViewRemarkTitle] = useState("Remarks");

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
          .select("*")
          .eq("barangay_id", userData.barangay_id)
          .order("date_submitted", { ascending: false });

        if (reportError) {
          setError("Failed to fetch reports.");
          setReports([]);
        } else {
          const withLocalRemarks = (data || []).map((r: any) => ({
            ...r,
            latest_remarks: r.latest_remarks || null,
          }));
          setReports(withLocalRemarks);
        }
        setLoading(false);
      };

      fetchReports();
    }, []);

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
          }`
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

      setReports((prev) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? {
                ...r,
                current_status: newStatus,
                latest_remarks: responseRemarks,
              }
            : r
        )
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
          }`
        );
        return;
      }

      setReports((prev: any[]) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? { ...r, current_status: newStatus, latest_remarks: rejectRemarks }
            : r
        )
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
          }`
        );
        return;
      }

      setReports((prev: any[]) =>
        prev.map((r) =>
          r.report_id === selectedReport.report_id
            ? { ...r, current_status: newStatus, latest_remarks: actionRemarks }
            : r
        )
      );

      setSelectedReport(null);
      setActionModalOpen(false);
      setActionRemarks("");
    };

    if (loading) {
      return (
        <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8 mt-8">
          <TruckLoader />
        </section>
      );
    }

    if (error) return <div className="text-red-700">{error}</div>;

    return (
      <section className="max-w-5xl mx-auto mt-8 space-y-4">
        {/* Header + small stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold text-green-700">
              Incident Reports ({barangayName || "Your Barangay"})
            </h2>
            <p className="text-lg text-gray-700">
              Monitor reported incidents and coordinate actions with BWMC and
              SWMO.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
              Total: <span className="font-bold text-lg">{reports.length}</span>
            </span>
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
              Ongoing:{" "}
              <span className="font-bold text-lg">
                {reports.filter((r) => r.current_status === "Ongoing").length}
              </span>
            </span>
            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
              Needs action:{" "}
              <span className="font-bold text-lg">
                {
                  reports.filter((r) => r.current_status === "Needs Action")
                    .length
                }
              </span>
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
              Resolved:{" "}
              <span className="font-bold text-lg">
                {reports.filter((r) => r.current_status === "Resolved").length}
              </span>
            </span>
          </div>
        </div>

        {/* List wrapper */}
        <div className="bg-white rounded-2xl shadow border border-green-100">
          <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
            <span className="text-2xl font-semibold text-green-700">
              Latest incident reports
            </span>
            <span className="text-md font-bold text-gray-800">
              Sorted by most recent submission
            </span>
          </div>

          {reports.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500 text-sm">
              No reports found for this barangay.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {reports.map((report) => (
                <div
                  key={report.report_id}
                  className="px-6 py-4 grid grid-cols-[minmax(0,2.2fr)_auto_auto] gap-4 items-center hover:bg-green-50/60 transition-colors"
                >
                  {/* Col 1: Location + date + landmark */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg font-semibold text-gray-900">
                        {report.location}
                      </span>
                      <span className="text-xs font-bold text-gray-800">
                        {new Date(report.date_submitted).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200">
                        <span className="text-md font-bold text-black">
                          Landmark:
                        </span>
                        <span className="text-black">
                          {report.landmark || (
                            <span className="text-gray-400">No landmark</span>
                          )}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Col 2: Status pill */}
                  <div className="flex items-center justify-center">
                    <span
                      className={
                        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold " +
                        (report.current_status === "Needs Action"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : report.current_status === "Ongoing"
                          ? "bg-blue-50 text-blue-700 border border-blue-200"
                          : report.current_status === "Rejected"
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : report.current_status === "Resolved"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-gray-50 text-gray-700 border border-gray-200")
                      }
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {report.current_status || "Submitted"}
                    </span>
                  </div>

                  {/* Col 3: Actions */}
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setDescText(report.description);
                        setDescModalOpen(true);
                      }}
                      className="px-3 py-1 bg-emerald-600 text-white text-xs rounded-full hover:bg-emerald-700 transition border border-emerald-700 shadow-sm"
                    >
                      View description
                    </button>
                    {report.current_status === "Needs Action" ||
                    report.current_status === "Ongoing" ||
                    report.current_status === "Rejected" ||
                    report.current_status === "Resolved" ? (
                      <button
                        onClick={() => {
                          setViewRemarkTitle(
                            report.current_status === "Rejected"
                              ? "Reject Remark"
                              : "Response Remark"
                          );
                          setViewRemarkText(
                            report.latest_remarks || "No remarks provided."
                          );
                          setViewRemarkModalOpen(true);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full hover:bg-blue-700 shadow-sm"
                      >
                        View{" "}
                        {report.current_status === "Rejected"
                          ? "reject"
                          : "response"}{" "}
                        remark
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleOpenResponse(report)}
                          className="px-1 py-1 bg-emerald-600 text-white text-xs rounded-full hover:bg-emerald-700 shadow-sm"
                        >
                          Response
                        </button>
                        <button
                          onClick={() => handleOpenReject(report)}
                          className="px-3 py-1 bg-red-600 text-white text-xs rounded-full hover:bg-red-700 shadow-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Description modal */}
        {descModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center"
            onClick={() => setDescModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setDescModalOpen(false)}
                className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="font-bold text-lg mb-3 text-green-700">
                Report Description
              </h3>
              <p className="text-sm text-gray-800 whitespace-pre-line">
                {descText}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setDescModalOpen(false)}
                  className="px-4 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Response modal */}
        {selectedReport && !rejectModalOpen && !actionModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center"
            onClick={() => setSelectedReport(null)}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedReport(null)}
                className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="font-bold text-lg mb-3 text-green-700">
                Response for {selectedReport.location}
              </h3>
              <p className="text-sm mb-2 font-semibold">Choose action:</p>
              <div className="flex flex-col gap-2 mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="responseType"
                    value="NEED_ACTION"
                    checked={responseType === "NEED_ACTION"}
                    onChange={() => setResponseType("NEED_ACTION")}
                  />
                  <span>Need action by SWMO</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="responseType"
                    value="ONGOING"
                    checked={responseType === "ONGOING"}
                    onChange={() => setResponseType("ONGOING")}
                  />
                  <span>BWMC can resolve (Ongoing)</span>
                </label>
              </div>
              <label className="block text-sm font-semibold mb-1">
                Remarks
              </label>
              <textarea
                className="w-full border rounded px-2 py-1 text-sm mb-4"
                rows={3}
                value={responseRemarks}
                onChange={(e) => setResponseRemarks(e.target.value)}
                placeholder="Add details about your response..."
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedReport(null)}
                  className="px-3 py-1 text-sm rounded border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitResponse}
                  disabled={!responseType}
                  className="px-4 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject modal */}
        {rejectModalOpen && selectedReport && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center"
            onClick={() => {
              setRejectModalOpen(false);
              setSelectedReport(null);
            }}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setSelectedReport(null);
                }}
                className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="font-bold text-lg mb-3 text-red-700">
                Reject Report
              </h3>
              <p className="text-sm mb-2">
                Please provide the reason for rejecting this report.
              </p>
              <textarea
                className="w-full border rounded px-2 py-1 text-sm mb-4"
                rows={3}
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="Reason for rejection..."
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setRejectModalOpen(false);
                    setSelectedReport(null);
                  }}
                  className="px-3 py-1 text-sm rounded border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReject}
                  className="px-4 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-700"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Report modal */}
        {actionModalOpen && selectedReport && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center"
            onClick={() => {
              setActionModalOpen(false);
              setSelectedReport(null);
            }}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setActionModalOpen(false);
                  setSelectedReport(null);
                }}
                className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="font-bold text-lg mb-3 text-green-700">
                Create Action Report
              </h3>
              <p className="text-sm mb-2">
                Describe the action taken by the BWMC to resolve this incident.
              </p>
              <textarea
                className="w-full border rounded px-2 py-1 text-sm mb-4"
                rows={3}
                value={actionRemarks}
                onChange={(e) => setActionRemarks(e.target.value)}
                placeholder="Details of the action taken..."
                required
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setActionModalOpen(false);
                    setSelectedReport(null);
                  }}
                  className="px-3 py-1 text-sm rounded border border-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitActionReport}
                  className="px-4 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View remark modal */}
        {viewRemarkModalOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center"
            onClick={() => setViewRemarkModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setViewRemarkModalOpen(false)}
                className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="font-bold text-lg mb-3 text-green-700">
                {viewRemarkTitle}
              </h3>
              <p className="text-sm text-gray-800 whitespace-pre-line">
                {viewRemarkText}
              </p>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setViewRemarkModalOpen(false)}
                  className="px-4 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
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
            BWMC Dashboard
          </h1>
          <p className="text-xs font-semibold text-gray-600 leading-snug">
            Barangay Waste Management Committee
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
            label="Pending Accounts"
            icon="📝"
            badge={pendingRequests.length}
            selected={activeTab === "pendingAccounts"}
            onClick={() => {
              setActiveTab("pendingAccounts");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Processed Accounts"
            icon="📋"
            selected={activeTab === "processedAccounts"}
            onClick={() => {
              setActiveTab("processedAccounts");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="View Reports"
            icon="🗒️"
            selected={activeTab === "viewReports"}
            onClick={() => {
              setActiveTab("viewReports");
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
        {activeTab === "dashboard" && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {summaryCards.map((sc, i) => (
                <div
                  key={i}
                  className={`rounded-xl shadow flex flex-col items-center py-6 ${sc.bg}`}
                  role="region"
                  aria-label={sc.label}
                >
                  <span className="text-4xl mb-2" aria-hidden="true">
                    {sc.icon}
                  </span>
                  <span className={`text-xl font-bold ${sc.color}`}>
                    {sc.count}
                  </span>
                  <span className="text-gray-600 text-sm">{sc.label}</span>
                </div>
              ))}
            </section>
            <section aria-label="Map of collection area and vehicles">
              <LeafletMap />
            </section>
          </>
        )}

        {activeTab === "pendingAccounts" && (
          <section className="my-6">
            <h2 className="text-3xl font-bold mb-2 text-green-600 ">
              Pending Resident Accounts
            </h2>
            <br />
            {loadingPending ? (
              <TruckLoader />
            ) : pendingRequests.length === 0 ? (
              <div className="mt-4 p-6 bg-gray-50 border border-dashed border-gray-300 rounded text-center text-gray-600">
                No pending accounts.
              </div>
            ) : (
              <table className="min-w-full text-sm border bg-white rounded-xl shadow border-emerald-100 overflow-hidden">
                <thead className="bg-emerald-600 text-white">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Contact</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((user) => (
                    <tr key={user.user_id} className="border-t even:bg-gray-50">
                      <td className="px-3 py-2 text-black">
                        {user.first_name} {user.last_name}
                      </td>
                      <td className="px-3 py-2 text-black">{user.email}</td>
                      <td className="px-3 py-2 text-black">
                        {user.contact_number}
                      </td>
                      <td className="px-3 py-2 text-black">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const confirmed = window.confirm(
                                "Are you sure you want to APPROVE this account?"
                              );
                              if (!confirmed) return;
                              handleApproveReject(user.user_id, "approved");
                            }}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs"
                          >
                            Approve
                          </button>

                          <button
                            onClick={() => {
                              // open reason modal, but only if user confirms
                              const confirmed = window.confirm(
                                "Are you sure you want to REJECT this account?"
                              );
                              if (!confirmed) return;
                              setSelectedUserId(user.user_id);
                              setRejectAccountReason("");
                              setRejectAccountModalOpen(true);
                            }}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {rejectAccountModalOpen && selectedUserId && (
              <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex justify-center items-center"
                onClick={() => setRejectAccountModalOpen(false)}
              >
                <div
                  className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setRejectAccountModalOpen(false)}
                    className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
                    aria-label="Close"
                  >
                    ×
                  </button>
                  <h3 className="font-bold text-lg mb-3 text-red-700">
                    Reject Resident Account
                  </h3>
                  <p className="text-sm mb-2">
                    Please provide the reason for rejecting this account.
                  </p>
                  <textarea
                    className="w-full border rounded px-2 py-1 text-sm mb-4"
                    rows={3}
                    value={rejectAccountReason}
                    onChange={(e) => setRejectAccountReason(e.target.value)}
                    placeholder="Reason for rejection..."
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setRejectAccountModalOpen(false)}
                      className="px-3 py-1 text-sm rounded border border-gray-300"
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
                          rejectAccountReason.trim()
                        );
                        setRejectAccountModalOpen(false);
                        setSelectedUserId(null);
                        setRejectAccountReason("");
                      }}
                      className="px-4 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-700"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "viewReports" && <ViewReportsSection />}

        {activeTab === "processedAccounts" && (
          <section className="my-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-3xl font-bold text-green-700">
                  Processed Resident Accounts
                </h2>
                <p className="text-lg text-gray-700">
                  Review residents whose registrations have already been
                  approved or rejected.
                </p>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold">
                  Approved:{" "}
                  <span className="font-extrabold">
                    {approvedAccounts.length}
                  </span>
                </span>
                <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-100 font-extrabold">
                  Rejected:{" "}
                  <span className="font-extrabold">
                    {rejectedAccounts.length}
                  </span>
                </span>
              </div>
            </div>

            {loadingProcessed ? (
              <div className="bg-white rounded-xl shadow p-6">
                <TruckLoader />
              </div>
            ) : (
              <div className="space-y-8">
                {/* Approved */}
                <div className="bg-white rounded-xl shadow border border-emerald-100 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-emerald-50 border-b border-emerald-100">
                    <h3 className="text-2xl font-semibold text-emerald-700">
                      Approved Accounts
                    </h3>
                    <span className="text-lg font-bold uppercase tracking-wide text-emerald-600">
                      Total {approvedAccounts.length}
                    </span>
                  </div>

                  {approvedAccounts.length === 0 ? (
                    <p className="px-5 py-6 text-2xl text-gray-700">
                      No approved accounts yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-emerald-600 text-white">
                            <th className="px-4 py-2 text-left font-semibold text-lg">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-lg">
                              Email
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-lg">
                              Contact
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {approvedAccounts.map((user, idx) => (
                            <tr
                              key={user.user_id}
                              className={
                                idx % 2 === 0 ? "bg-white" : "bg-emerald-50/40"
                              }
                            >
                              <td className="px-4 py-2 whitespace-nowrap text-lg">
                                <span className="font-medium text-gray-900 ">
                                  {user.first_name} {user.last_name}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-900 text-lg">
                                {user.email}
                              </td>
                              <td className="px-4 py-2 text-gray-900 text-lg">
                                {user.contact_number}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Rejected */}
                <div className="bg-white rounded-xl shadow border border-red-100 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-red-50 border-b border-red-100">
                    <h3 className="text-2xl font-semibold text-red-700">
                      Rejected Accounts
                    </h3>
                    <span className="text-lg font-bold uppercase tracking-wide text-red-600">
                      Total {rejectedAccounts.length}
                    </span>
                  </div>

                  {rejectedAccounts.length === 0 ? (
                    <p className="px-5 py-6 text-xl text-gray-700">
                      No rejected accounts yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="bg-red-600 text-white">
                            <th className="px-4 py-2 text-left font-semibold text-lg">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-lg">
                              Email
                            </th>
                            <th className="px-4 py-2 text-left font-semibold text-lg">
                              Contact
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rejectedAccounts.map((user, idx) => (
                            <tr
                              key={user.user_id}
                              className={
                                idx % 2 === 0 ? "bg-white" : "bg-red-50/40"
                              }
                            >
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className="font-medium text-gray-900 text-lg">
                                  {user.first_name} {user.last_name}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-900 text-lg">
                                {user.email}
                              </td>
                              <td className="px-4 py-2 text-gray-900 text-lg">
                                {user.contact_number}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === "manageAccount" && (
          <section className="max-w-2xl mx-auto bg-white rounded-xl shadow p-8 mt-1">
            <h2 className="text-2xl font-bold mb-6 text-green-600">
              Manage Account
            </h2>
            {manageAccountError && (
              <div
                role="alert"
                className="mb-4 px-4 py-2 rounded bg-red-100 text-red-700"
              >
                {manageAccountError}
              </div>
            )}
            {manageAccountSuccess && (
              <div
                role="status"
                className="mb-4 px-4 py-2 rounded bg-green-100 text-green-700"
              >
                {manageAccountSuccess}
              </div>
            )}
            {manageAccountLoading ? (
              <TruckLoader />
            ) : (
              <form onSubmit={handleManageAccountSubmit} noValidate>
                <InputField
                  label="First Name"
                  name="first_name"
                  type="text"
                  value={manageAccountForm.first_name}
                  onChange={handleManageAccountFormChange}
                  required
                />
                <InputField
                  label="Last Name"
                  name="last_name"
                  type="text"
                  value={manageAccountForm.last_name}
                  onChange={handleManageAccountFormChange}
                  required
                />
                <InputField
                  label="Username"
                  name="username"
                  type="text"
                  value={manageAccountForm.username}
                  onChange={handleManageAccountFormChange}
                  required
                />
                <InputField
                  label="Email"
                  name="email"
                  type="email"
                  value={manageAccountForm.email}
                  onChange={handleManageAccountFormChange}
                  required
                />
                <InputField
                  label="Contact Number"
                  name="contact_number"
                  type="tel"
                  value={manageAccountForm.contact_number}
                  onChange={handleManageAccountFormChange}
                  required
                />
                <InputField
                  label="New Password"
                  name="password"
                  type="password"
                  value={manageAccountForm.password}
                  onChange={handleManageAccountFormChange}
                  placeholder="Leave blank to keep current password"
                />
                <InputField
                  label="Confirm New Password"
                  name="confirm_password"
                  type="password"
                  value={manageAccountForm.confirm_password}
                  onChange={handleManageAccountFormChange}
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
            )}
          </section>
        )}
      </main>
    </div>
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
