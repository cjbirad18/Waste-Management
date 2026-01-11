"use client";

import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  FormEvent,
} from "react";

import {
  startOfMonth,
  endOfMonth,
  addDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  format,
} from "date-fns";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import dynamic from "next/dynamic";
import TruckLoader from "../../loading/TruckLoader";

const LeafletMap = dynamic(() => import("../../leafletmap"), { ssr: false });

interface Barangay {
  barangay_id: string;
  barangay_name: string;
}

interface Truck {
  truck_id: string;
  plate_number: string;
}

interface GcpUser {
  user_id: string;
  first_name: string;
  last_name: string;
}

interface ManageAccountForm {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  contact_number: string;
  password: string;
  confirm_password: string;
}

interface ScheduleData {
  barangay_id: string;
  truck_id: string;
  gcp_user_id: string;
  plate_number: string;
  date: string;
}

interface SubmitReportSectionProps {
  barangays: Barangay[];
  onReportSubmit?: () => void;
}

function SidebarItem({
  label,
  icon,
  selected,
  onClick,
  badgeCount,
}: {
  label: string;
  icon: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  badgeCount?: number;
}) {
  const hasBadge = badgeCount && badgeCount > 0;

  return (
    <button
      onClick={onClick}
      className={`flex gap-2 items-center justify-between w-full px-4 py-3 mb-2 text-left rounded transition ${
        selected
          ? "bg-blue-100 text-blue-700 font-semibold"
          : "hover:bg-gray-100 text-gray-600"
      }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>
        <span>{label}</span>
      </span>
      {hasBadge && (
        <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 text-xs font-bold rounded-full bg-red-600 text-white">
          {badgeCount}
        </span>
      )}
    </button>
  );
}

interface Schedule {
  schedule_id: string;
  days: string;
}

function generatePatternDates(
  pattern: string,
  year: number,
  month: number
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

  const patternDates: Date[] = generatePatternDates(schedule.days, year, month);

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
    <div className="my-6">
      <div className="mb-2 mt-2 flex justify-center">
        <span className="font-semibold text-xl">
          {format(new Date(year, month), "LLLL yyyy")}
        </span>
      </div>
      <div className="mt-6 flex flex-row gap-6 justify-center max-w-[450px] mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-green-600 border border-green-600"></div>
          <span className="text-gray-800 text-sm">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-red-100 border border-red-400"></div>
          <span className="text-gray-800 text-sm">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-white border border-green-300"></div>
          <span className="text-gray-800 text-sm">No schedule</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-gray-50 border border-gray-100"></div>
          <span className="text-black text-sm">Other month</span>
        </div>
      </div>

      <br />

      <div className="grid grid-cols-7 gap-2 text-center text-md text-gray-800 select-none min-w-[350px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="font-semibold py-1 text-center text-gray-800">
            {d}
          </div>
        ))}
        {weeks.map((weekDays, weekIdx) =>
          weekDays.map((day, dayIdx) => {
            const isScheduled = patternDates.some(
              (d) => d.toDateString() === day.toDateString()
            );
            const isCurrentMonth = day.getMonth() === month;
            const isToday =
              day.getDate() === now.getDate() &&
              day.getMonth() === now.getMonth() &&
              day.getFullYear() === now.getFullYear();
            const dayText = isCurrentMonth ? format(day, "d") : "";

            let cellClass =
              "h-10 w-10 flex flex-col items-center justify-center text-lg rounded border transition";
            if (!isCurrentMonth) {
              cellClass += " bg-gray-50 text-gray-300 border-gray-400";
            } else if (isToday) {
              cellClass += " bg-red-200 text-red-700 font-bold border-red-400";
            } else if (isScheduled) {
              cellClass +=
                " bg-green-600 text-black font-bold border-green-600";
            } else {
              cellClass += " bg-white border-green-300 text-black font-bold";
            }

            return (
              <div
                key={day.toISOString() + weekIdx}
                className={cellClass}
                title={
                  isScheduled && isCurrentMonth
                    ? `Scheduled: ${format(day, "EEE, MMM d, yyyy")}`
                    : isToday
                    ? "Today"
                    : ""
                }
              >
                <span>{dayText}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

interface ResidentSchedulesFeatureProps {
  residentBarangayId: string;
  barangays: Barangay[];
}

interface ResidentScheduleRow {
  schedule_id: string;
  days: string;
  barangay?: Barangay | null;
  gcp_user?: {
    first_name: string;
    last_name: string;
  } | null;
  collection_details?:
    | {
        collectiondetails_id: string;
        truck?: {
          plate_number: string;
          truck_code: string;
        } | null;
        collection_date: string;
        status: string;
        gcp_assignment?: {
          user?: {
            first_name: string;
            last_name: string;
          } | null;
        } | null;
      }[]
    | null;
}

function ResidentSchedulesFeature({
  residentBarangayId,
  barangays,
}: ResidentSchedulesFeatureProps) {
  const [selectedBarangayId, setSelectedBarangayId] =
    useState<string>(residentBarangayId);

  useEffect(() => {
    setSelectedBarangayId(residentBarangayId);
  }, [residentBarangayId]);

  const [schedules, setSchedules] = useState<ResidentScheduleRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true);
      setError(null);

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
  `
        )
        .order("date_created", { ascending: false });

      if (error) {
        setError(error.message);
        setSchedules([]);
        setLoading(false);
        return;
      }

      const raw = (data ?? []) as unknown;
      const rows = raw as ResidentScheduleRow[];
      setSchedules(rows);
      setLoading(false);
    }

    fetchSchedules();
  }, []);

  const schedule = schedules.find(
    (s) => String(s.barangay?.barangay_id) === String(selectedBarangayId)
  );

  return (
    <section className="max-w-4xl mx-auto bg-white rounded-xl shadow p-8">
      <h2 className="text-3xl font-bold text-green-600 mb-4">
        Schedules Overview
      </h2>
      <div className="mb-6">
        <label htmlFor="barangay-select" className="block font-semibold mb-2">
          See other barangay schedules
        </label>
        <select
          id="barangay-select"
          value={selectedBarangayId}
          onChange={(e) => setSelectedBarangayId(e.target.value)}
          className="p-2 border border-gray-400 rounded w-full max-w-xs"
        >
          {barangays.map((b) => (
            <option key={b.barangay_id} value={b.barangay_id}>
              {b.barangay_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <TruckLoader />
      ) : error ? (
        <p className="text-red-600">Error: {error}</p>
      ) : schedule ? (
        <>
          <div className="mb-4">
            <h3 className="font-semibold text-lg">
              Barangay: {schedule.barangay?.barangay_name || "N/A"}
            </h3>
            <div className="text-md text-black">
              Assigned GCP:{" "}
              {schedule.gcp_user
                ? `${schedule.gcp_user.first_name} ${schedule.gcp_user.last_name}`
                : "None"}
            </div>
            <ScheduleCalendar schedule={schedule} />
            {Array.isArray(schedule.collection_details) &&
            schedule.collection_details.length > 0 ? (
              <ul className="space-y-2 text-gray-700">
                {schedule.collection_details.map((detail) => (
                  <li
                    key={detail.collectiondetails_id}
                    className="border-t pt-2"
                  >
                    <div>Truck: {detail.truck?.plate_number || "N/A"}</div>
                    <div>
                      Collection Date:{" "}
                      {new Date(detail.collection_date).toLocaleDateString()}
                    </div>
                    <div>Status: {detail.status}</div>
                    <div>
                      Assigned User:{" "}
                      {detail.gcp_assignment?.user
                        ? `${detail.gcp_assignment.user.first_name} ${detail.gcp_assignment.user.last_name}`
                        : "Unassigned"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500"></p>
            )}
          </div>
        </>
      ) : (
        <p className="text-gray-500">No schedule found for this barangay.</p>
      )}
    </section>
  );
}

function SubmitReportSection({
  barangays,
  onReportSubmit,
}: SubmitReportSectionProps) {
  const [form, setForm] = useState({
    location: "",
    description: "",
    barangay_id: "",
    landmark: "",
    photoFile: null as File | null,
  });
  const [photoUrl, setPhotoUrl] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setFieldError("Cannot access camera");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  };

  const capturePhoto = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        console.error("capturePhoto: blob is null");
        return;
      }

      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      console.log("capturePhoto: created file", file);

      // Only keep the File in state; no upload yet
      setForm((prev) => ({ ...prev, photoFile: file }));
      setPhotoUrl(""); // clear any previous preview
      stopCamera();
    }, "image/jpeg");
  };

  const uploadPhotoToSupabase = async (file: File): Promise<string> => {
    console.log("uploadPhotoToSupabase: uploading file", file);

    const fileName = `reports/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("report-photos-bucket")
      .upload(fileName, file);

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      setFieldError(`Photo upload failed: ${uploadError.message}`);
      return "";
    }

    const { data } = supabase.storage
      .from("report-photos-bucket")
      .getPublicUrl(fileName);

    const publicUrl = data?.publicUrl ?? "";
    console.log("uploadPhotoToSupabase: publicUrl", publicUrl);

    return publicUrl;
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldError("");
    if (
      !form.description.trim() ||
      !form.barangay_id ||
      !form.landmark.trim() ||
      !form.location.trim()
    ) {
      setFieldError("All fields except photo are required.");
      return;
    }
    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData?.user) {
        setFieldError("User not authenticated.");
        setLoading(false);
        return;
      }
      const userId = authData.user.id;

      const { data: reportData, error: reportError } = await supabase
        .from("community_reports")
        .insert({
          user_id: userId,
          location: form.location,
          description: form.description,
          landmark: form.landmark,
          barangay_id: form.barangay_id,
          current_status: "Submitted",
          date_submitted: new Date().toISOString(),
        })
        .select()
        .single();

      if (reportError || !reportData) {
        setFieldError("Report submission failed, check network/RLS!");
        setLoading(false);
        return;
      }

      // Only now, after report exists, upload photo (if any) and insert row
      if (form.photoFile) {
        const url = await uploadPhotoToSupabase(form.photoFile);
        console.log("handleSubmit uploaded photoUrl:", url);

        if (url) {
          const { error: photoError } = await supabase
            .from("report_photos")
            .insert({
              report_id: reportData.report_id,
              photo_path: url,
            });

          console.log("photo insert error:", photoError);

          if (photoError) {
            setFieldError("Photo record failed, but report saved!");
            setLoading(false);
            return;
          }

          setPhotoUrl(url);
        }
      }

      setForm({
        location: "",
        description: "",
        barangay_id: "",
        landmark: "",
        photoFile: null,
      });
      // keep photoUrl if you want to show last submitted preview, else clear:
      setPhotoUrl("");
      if (onReportSubmit) onReportSubmit();
    } catch (err) {
      setFieldError("Unexpected error occurred.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-2xl mx-auto bg-white rounded-xl shadow-xl p-7 mt-1 transition-all">
      <div className="mb-4 flex items-center gap-3">
        <span className="bg-green-100 text-green-700 rounded-full p-3 text-2xl">
          📷
        </span>
        <h2 className="text-2xl font-bold text-green-700">
          Submit Incident Report
        </h2>
      </div>
      <p className="mb-4 text-gray-700">
        All fields must be completed. Only live camera capture is Optional.
      </p>
      {fieldError && (
        <div className="mb-3 px-4 py-2 rounded bg-red-100 text-red-700 font-semibold animate-pulse">
          {fieldError}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1 text-gray-800">
            Location
          </label>
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            required
            className="w-full p-3 border rounded focus:ring focus:ring-green-200"
            placeholder="Exact location/address"
            type="text"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1 text-gray-800">
            Description
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            rows={3}
            className="w-full p-3 border rounded focus:ring focus:ring-green-200"
            placeholder="Describe the incident"
          />
        </div>
        <div>
          <label className="block font-semibold mb-1 text-gray-800">
            Barangay
          </label>
          <select
            name="barangay_id"
            value={form.barangay_id}
            onChange={handleChange}
            required
            className="w-full p-3 border rounded focus:ring focus:ring-green-200"
          >
            <option value="">Select Barangay</option>
            {barangays.map((brgy) => (
              <option key={brgy.barangay_id} value={brgy.barangay_id}>
                {brgy.barangay_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1 text-gray-800">
            Landmark
          </label>
          <input
            name="landmark"
            value={form.landmark}
            onChange={handleChange}
            required
            className="w-full p-3 border rounded focus:ring focus:ring-green-200"
            placeholder="Nearby landmark"
            type="text"
          />
        </div>

        {!cameraActive && (
          <button
            type="button"
            onClick={startCamera}
            className="bg-blue-600 text-white rounded px-4 py-2 font-semibold hover:bg-blue-700 transition shadow"
          >
            Start Camera
          </button>
        )}
        {cameraActive && (
          <div className="flex flex-col gap-2 mt-2">
            <video
              ref={videoRef}
              width="320"
              height="240"
              autoPlay
              className="rounded border shadow"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-green-500 text-white rounded px-4 py-2 font-semibold hover:bg-green-700 transition shadow"
              >
                Capture Photo
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="bg-gray-300 text-gray-700 rounded px-4 py-2 font-semibold hover:bg-gray-400 transition"
              >
                Cancel
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width="320"
              height="240"
              style={{ display: "none" }}
            />
          </div>
        )}

        {photoUrl && (
          <div className="mt-3 mb-2">
            <img
              src={photoUrl}
              alt="Live Capture"
              className="w-40 rounded shadow border mx-auto"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 font-semibold rounded bg-green-600 text-white shadow hover:bg-green-700 transition ${
            loading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </section>
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
  form: ManageAccountForm;
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
        <div className="flex justify-end mt-2">
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

export default function ResidentDashboard() {
  const router = useRouter();
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportSuccessModalOpen, setReportSuccessModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState("");

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "manageAccount"
    | "schedules"
    | "submitIncidentReport"
    | "myReports"
  >("dashboard");

  // Manage Account States
  const [manageAccountForm, setManageAccountForm] = useState<ManageAccountForm>(
    {
      username: "",
      first_name: "",
      last_name: "",
      email: "",
      contact_number: "",
      password: "",
      confirm_password: "",
    }
  );
  const [manageAccountLoading, setManageAccountLoading] = useState(true);
  const [manageAccountError, setManageAccountError] = useState<string | null>(
    null
  );
  const [manageAccountSuccess, setManageAccountSuccess] = useState<
    string | null
  >(null);
  const [hasLoadedManageAccount, setHasLoadedManageAccount] = useState(false);

  // Schedule Form States
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    barangay_id: "",
    truck_id: "",
    gcp_user_id: "",
    plate_number: "",
    date: "",
  });

  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  const [residentBarangayId, setResidentBarangayId] = useState<string>("");

  // Reports and notifications state
  const [userReports, setUserReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState<boolean>(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [unreadReportCount, setUnreadReportCount] = useState<number>(0);

  // Fetch current user's barangay_id when the dashboard mounts
  useEffect(() => {
    async function fetchUserBarangayId() {
      try {
        const { data: authUserData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authUserData.user) return;

        const userId = authUserData.user.id;
        const { data, error } = await supabase
          .from("users")
          .select("barangay_id")
          .eq("user_id", userId)
          .single();

        if (error || !data) return;

        setResidentBarangayId(data.barangay_id || "");
      } catch (err) {
        setResidentBarangayId("");
      }
    }
    fetchUserBarangayId();
  }, []);

  // Fetch current user info for Manage Account
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

  // Fetch dropdown data when Input Schedule tab active
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [gcps, setGcps] = useState<GcpUser[]>([]);

  useEffect(() => {
    async function fetchDropdowns() {
      try {
        const [barangayResp, truckResp, gcpResp] = await Promise.all([
          supabase.from("barangay").select("barangay_id, barangay_name"),
          supabase.from("garbage_trucks").select("truck_id, plate_number"),
          supabase
            .from("users")
            .select("user_id, first_name, last_name")
            .eq("role", "GCP"),
        ]);
        if (barangayResp.error) throw barangayResp.error;
        if (truckResp.error) throw truckResp.error;
        if (gcpResp.error) throw gcpResp.error;
        setBarangays(barangayResp.data || []);
        setTrucks(truckResp.data || []);
        setGcps(gcpResp.data || []);
      } catch (err) {
        setScheduleError(
          "Failed to load reference data: " + (err as Error).message
        );
      }
    }
    fetchDropdowns();
  }, [activeTab]);

  // Auto fill plate number on truck selection
  useEffect(() => {
    if (scheduleData.truck_id) {
      const truck = trucks.find((t) => t.truck_id === scheduleData.truck_id);
      setScheduleData((prev) => ({
        ...prev,
        plate_number: truck ? truck.plate_number : "",
      }));
    } else {
      setScheduleData((prev) => ({ ...prev, plate_number: "" }));
    }
  }, [scheduleData.truck_id, trucks]);

  // Fetch user reports and unread count
  useEffect(() => {
    async function fetchUserReports() {
      try {
        setReportsLoading(true);
        setReportsError(null);

        const { data: authData, error: authError } =
          await supabase.auth.getUser();
        if (authError || !authData?.user) {
          setReportsError("User not authenticated.");
          setReportsLoading(false);
          return;
        }

        const userId = authData.user.id;

        const { data, error } = await supabase
          .from("community_reports")
          .select(
            "report_id, description, current_status, date_submitted, barangay_id"
          )
          .eq("user_id", userId)
          .order("date_submitted", { ascending: false })
          .limit(10);

        if (error) {
          setReportsError("Failed to load reports.");
          setReportsLoading(false);
          return;
        }

        const reports = data || [];
        setUserReports(reports);

        const unread = reports.filter(
          (r) => r.current_status && r.current_status !== "Resolved"
        ).length;
        setUnreadReportCount(unread);
      } catch {
        setReportsError("Unexpected error loading reports.");
      } finally {
        setReportsLoading(false);
      }
    }

    fetchUserReports();
  }, []);

  // Form Handlers
  const handleManageAccountFormChange = (e: ChangeEvent<HTMLInputElement>) => {
    setManageAccountForm({
      ...manageAccountForm,
      [e.target.name]: e.target.value,
    });
  };
  const handleScheduleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setScheduleData({
      ...scheduleData,
      [e.target.name]: e.target.value,
    });
    setScheduleError(null);
    setScheduleSuccess(null);
  };

  // Validations
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
      return "Contact number must be exactly 11 digits.";
    }
    return null;
  };

  const validateScheduleForm = () => {
    const { barangay_id, truck_id, gcp_user_id, date, plate_number } =
      scheduleData;
    if (!barangay_id || !truck_id || !gcp_user_id || !date || !plate_number) {
      setScheduleError("All fields are required.");
      return false;
    }
    return true;
  };

  // Manage Account Submission
  const handleManageAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Are you sure you want to update your account?"))
      return;

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
      if (authError || !authUserData?.user) {
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
    } catch (err) {
      setManageAccountError(`Unexpected error: ${(err as Error).message}`);
    }
  };

  // Handle Report Submit for Success Message
  const handleReportSubmit = () => {
    setReportSuccess("Report submitted successfully!");
    setReportSuccessModalOpen(true);
  };
  // Improved Logout handler
  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      const { error } = await supabase.auth.signOut();
      if (error) {
        alert(`Logout error: ${error.message}`);
        return;
      }
      router.push("/");
    }
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      {/* Sidebar and toggle button */}
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
            Resident Dashboard
          </h1>
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
            label="Schedules"
            icon="📅"
            selected={activeTab === "schedules"}
            onClick={() => {
              setActiveTab("schedules");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="Submit Incident Report"
            icon="📷"
            selected={activeTab === "submitIncidentReport"}
            onClick={() => {
              setActiveTab("submitIncidentReport");
              setSidebarOpen(false);
            }}
          />
          <SidebarItem
            label="My Reports"
            icon="🔔"
            selected={activeTab === "myReports"}
            onClick={() => {
              setActiveTab("myReports");
              setSidebarOpen(false);
            }}
            badgeCount={unreadReportCount}
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

      {/* Main content area */}
      <main className="flex-1 p-6 md:p-8 transition-all duration-300 md:ml-64 overflow-auto">
        {reportSuccessModalOpen && (
          <div
            className="fixed inset-0 bg-gray-100/60 backdrop-blur-xs z-10 flex justify-center items-center"
            onClick={() => setReportSuccessModalOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-lg max-w-sm w-full p-6 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setReportSuccessModalOpen(false)}
                className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
                aria-label="Close"
              >
                ×
              </button>
              <h3 className="font-bold text-lg mb-3 text-green-700 text-center">
                Incident Report Submitted
              </h3>
              <p className="text-gray-800 text-center">
                {reportSuccess || "Your report was submitted successfully."}
              </p>
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setReportSuccessModalOpen(false)}
                  className="px-4 py-2 bg-green-600 text-white font-semibold rounded hover:bg-green-700 transition"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <>
            <section
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
              aria-label="Dashboard Stats"
            >
              {/* Dashboard cards omitted for brevity */}
            </section>
            <section aria-label="Map of collection area and vehicles">
              <LeafletMap />
            </section>
          </>
        )}

        {activeTab === "submitIncidentReport" && (
          <SubmitReportSection
            barangays={barangays}
            onReportSubmit={handleReportSubmit}
          />
        )}

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

        {activeTab === "schedules" && (
          <ResidentSchedulesFeature
            residentBarangayId={residentBarangayId}
            barangays={barangays}
          />
        )}

        {activeTab === "myReports" && (
          <section className="max-w-3xl mx-auto bg-white rounded-xl shadow p-6">
            <h2 className="text-2xl font-bold text-green-600 mb-4">
              My Recent Reports
            </h2>

            {reportsLoading && <TruckLoader />}

            {reportsError && (
              <p className="text-red-600 mb-2">{reportsError}</p>
            )}

            {!reportsLoading && !reportsError && userReports.length === 0 && (
              <p className="text-gray-500">
                You have not submitted any reports yet.
              </p>
            )}

            {!reportsLoading && !reportsError && userReports.length > 0 && (
              <ul className="divide-y divide-gray-200 ">
                {userReports.map((report, index) => (
                  <li
                    key={report.report_id}
                    className="py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-2 border-green-400 rounded-lg mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-700 ml-6">
                        {index + 1}.
                      </span>
                      <p className="font-semibold text-gray-900 line-clamp-2">
                        {report.location && report.location.length > 40
                          ? report.location.slice(0, 40) + "..."
                          : report.location}
                      </p>
                      <button
                        onClick={() => {
                          // Show full description in modal, not location
                          setSelectedMessage(report.description);
                          setModalOpen(true);
                        }}
                        className="ml-2 px-3 py-1 bg-green-600 text-white text-md font-bold rounded shadow hover:bg-green-700 transition"
                      >
                        View Message
                      </button>
                    </div>
                    <p className="text-sm text-black font-bold">
                      Submitted:{" "}
                      {report.date_submitted
                        ? new Date(report.date_submitted).toLocaleString()
                        : "N/A"}
                    </p>
                    <span
                      className={`inline-flex items-center px-3 py-1 text-md font-bold rounded-full mr-10${
                        report.current_status === "Resolved"
                          ? "bg-green-300 text-green-700"
                          : report.current_status === "In Progress"
                          ? "bg-yellow-300 text-yellow-700"
                          : "bg-blue-700 text-blue-700"
                      }`}
                    >
                      {report.current_status || "Unknown"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {modalOpen && (
              <div
                className="fixed inset-0 backdrop-blur-sm z-10 flex justify-center items-center"
                onClick={() => setModalOpen(false)}
              >
                <div
                  className="bg-white rounded-lg shadow-lg border max-w-md w-full p-6 relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setModalOpen(false)}
                    className="absolute top-1 right-2 text-2xl text-gray-500 hover:text-red-600 font-bold"
                    aria-label="Close"
                  >
                    ×
                  </button>
                  <h3 className="font-bold text-2xl mb-4 text-green-700">
                    Report Message :
                  </h3>
                  <p className="text-gray-800 text-xl whitespace-pre-line">
                    {selectedMessage}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
