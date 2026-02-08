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

type ResidentActiveTab =
  | "dashboard"
  | "schedule"
  | "submitIncidentReport"
  | "myReports"
  | "manageAccount";

type SidebarItem = {
  label: string;
  icon: string;
  tab: ResidentActiveTab;
};

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
      className={`w-full flex items-center justify-between gap-3 rounded-lg px-4 py-3 mb-2 text-left transition-colors ${
        selected
          ? "bg-emerald-600 text-white"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="flex items-center gap-2">
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </span>

      {hasBadge && (
        <span className="inline-flex items-center justify-center min-w-[1.5rem] px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white shadow shadow-red-900/60">
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
        <span className="font-semibold text-xl bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow">
          {format(new Date(year, month), "LLLL yyyy")}
        </span>
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-6 justify-center max-w-[450px] mx-auto items-center">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-emerald-600 border border-emerald-500" />
          <span className="text-slate-200 text-sm">Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-red-500/30 border border-red-400" />
          <span className="text-slate-200 text-sm">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-slate-900/80 border border-emerald-500/40" />
          <span className="text-slate-200 text-sm">No schedule</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-slate-800/80 border border-slate-700" />
          <span className="text-slate-300 text-sm">Other month</span>
        </div>
      </div>

      <div className="mt-4 calendar-grid text-md text-slate-200 select-none">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="calendar-weekday">
            {d}
          </div>
        ))}
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

            let cellClass =
              "calendar-day h-10 w-10 flex flex-col items-center justify-center text-lg rounded border transition";
            if (!isCurrentMonth) {
              cellClass += " bg-slate-800/80 text-slate-500 border-slate-700";
            } else if (isToday) {
              cellClass +=
                " bg-red-500/25 text-red-300 font-bold border-red-400 shadow-md shadow-red-900/40";
            } else if (isScheduled) {
              cellClass +=
                " bg-emerald-600 text-white font-bold border-emerald-500 shadow-md shadow-emerald-900/50";
            } else {
              cellClass +=
                " bg-slate-900/80 border-emerald-500/40 text-emerald-200 hover:border-emerald-400 hover:bg-emerald-500/10";
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
          }),
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
  `,
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
    (s) => String(s.barangay?.barangay_id) === String(selectedBarangayId),
  );

  return (
    <section className="w-full max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 px-4 py-5 md:p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl">
      <h2 className="text-2xl md:text-3xl font-bold mb-4 bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
        Schedules Overview
      </h2>

      {/* Barangay selector */}
      <div className="mb-4 md:mb-6">
        <label
          htmlFor="barangay-select"
          className="block text-xs md:text-sm font-semibold mb-2 text-slate-100"
        >
          See other barangay schedules
        </label>
        <select
          id="barangay-select"
          value={selectedBarangayId}
          onChange={(e) => setSelectedBarangayId(e.target.value)}
          className="block w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
        >
          {barangays.map((b) => (
            <option
              key={b.barangay_id}
              value={b.barangay_id}
              className="bg-slate-900 text-slate-100"
            >
              {b.barangay_name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <TruckLoader />
        </div>
      ) : error ? (
        <p className="text-red-300 text-sm md:text-base">Error: {error}</p>
      ) : schedule ? (
        <div className="space-y-4 md:space-y-5">
          {/* Header info */}
          <div>
            <h3 className="font-semibold text-lg md:text-xl text-slate-100">
              Barangay: {schedule.barangay?.barangay_name || "N/A"}
            </h3>
            <div className="text-xs md:text-sm text-slate-200 mt-1">
              <span className="font-semibold text-emerald-300">
                Assigned GCP:
              </span>{" "}
              {schedule.gcp_user
                ? `${schedule.gcp_user.first_name} ${schedule.gcp_user.last_name}`
                : "None"}
            </div>
          </div>

          {/* Calendar wrapper */}
          <div className="rounded-2xl border border-green-800/40 bg-slate-900/70 p-2 md:p-3">
            {/* Make the calendar scrollable horizontally on very narrow screens */}
            <div className="w-full overflow-x-auto">
              <div className="min-w-[280px]">
                <ScheduleCalendar schedule={schedule} />
              </div>
            </div>
          </div>

          {/* Collection details list */}
          {Array.isArray(schedule.collection_details) &&
          schedule.collection_details.length > 0 ? (
            <ul className="space-y-3 text-slate-200">
              {schedule.collection_details.map((detail) => (
                <li
                  key={detail.collectiondetails_id}
                  className="border border-green-800/40 rounded-2xl p-3 bg-slate-900/80 text-xs md:text-sm"
                >
                  <div className="flex flex-col gap-1">
                    <div>
                      <span className="font-semibold text-emerald-300">
                        Truck:
                      </span>{" "}
                      {detail.truck?.plate_number || "N/A"}
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-300">
                        Collection Date:
                      </span>{" "}
                      {detail.collection_date
                        ? new Date(detail.collection_date).toLocaleDateString()
                        : "N/A"}
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-300">
                        Status:
                      </span>{" "}
                      {detail.status}
                    </div>
                    <div>
                      <span className="font-semibold text-emerald-300">
                        Assigned User:
                      </span>{" "}
                      {detail.gcp_assignment?.user
                        ? `${detail.gcp_assignment.user.first_name} ${detail.gcp_assignment.user.last_name}`
                        : "Unassigned"}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-400 text-xs md:text-sm">
              No collection details for this schedule.
            </p>
          )}
        </div>
      ) : (
        <p className="text-slate-400 text-xs md:text-sm">
          No schedule found for this barangay.
        </p>
      )}
    </section>
  );
}

const BUCKET = "incident-photos";

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
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "environment",
  ); // back camera by default

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      setFieldError("");
      // stop previous stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints: MediaStreamConstraints = {
        video: { facingMode: cameraFacing }, // "user" or "environment"
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setFieldError("Cannot access camera");
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCameraFacing = () => {
    setCameraFacing((prev) => (prev === "user" ? "environment" : "user"));
    if (cameraActive) {
      startCamera(); // restart with new facing mode
    }
  };

  const capturePhoto = () => {
    if (!canvasRef.current || !videoRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // match canvas to video size
    const vw = videoRef.current.videoWidth || 320;
    const vh = videoRef.current.videoHeight || 240;
    canvasRef.current.width = vw;
    canvasRef.current.height = vh;

    ctx.drawImage(videoRef.current, 0, 0, vw, vh);

    // 1) create preview URL
    const dataUrl = canvasRef.current.toDataURL("image/jpeg");
    setPhotoUrl(dataUrl);

    // 2) also create a File for upload later
    canvasRef.current.toBlob((blob) => {
      if (!blob) {
        console.error("capturePhoto: blob is null");
        return;
      }
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      setForm((prev) => ({ ...prev, photoFile: file }));
    }, "image/jpeg");

    stopCamera();
  };

  // NEW: retake handler
  const handleRetakePhoto = () => {
    setPhotoUrl("");
    setForm((prev) => ({ ...prev, photoFile: null }));
    startCamera();
  };

  const uploadPhotoToSupabase = async (file: File): Promise<string> => {
    const fileName = `reports/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file, {
        contentType: "image/jpeg",
      });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

    if (uploadError) {
      setFieldError(`Photo upload failed: ${uploadError.message}`);
      return "";
    }

    return data?.publicUrl ?? "";
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldError("");
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

    // NEW: require a captured photo
    if (!form.photoFile) {
      setFieldError("Please capture a photo before submitting.");
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

      // If you want to force photo requirement, uncomment:
      // if (!form.photoFile) {
      //   setFieldError("Please capture a photo.");
      //   setLoading(false);
      //   return;
      // }

      if (form.photoFile) {
        const url = await uploadPhotoToSupabase(form.photoFile);
        if (url) {
          const { error: photoError } = await supabase
            .from("community_reports")
            .update({ photo_path: url }) // new column
            .eq("report_id", reportData.report_id);

          if (photoError) {
            setFieldError(`Photo save failed, but report was submitted.`);
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
      setPhotoUrl("");
      if (onReportSubmit) onReportSubmit();
    } catch (err) {
      console.error(err);
      setFieldError("Unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto mt-4 rounded-3xl bg-gradient-to-br from-slate-900/95 to-gray-900/95 border border-emerald-800/30 p-8 md:p-10 shadow-2xl shadow-emerald-900/30 backdrop-blur-2xl transition-all">
      <div className="mb-4 flex items-center gap-3">
        <span className="bg-emerald-700/10 text-emerald-300 rounded-2xl p-3 text-2xl border border-emerald-700/20 shadow-sm">
          📷
        </span>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
          Submit Incident Report
        </h2>
      </div>

      <p className="mb-5 text-sm text-slate-400 max-w-2xl">
        All required fields must be completed. A photo is required before
        submitting — use the live camera to capture evidence.
      </p>

      {fieldError && (
        <div className="mb-3 px-4 py-2 rounded-2xl bg-red-500/15 text-red-200 font-semibold border border-red-500/50 animate-pulse text-sm">
          {fieldError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Location */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-100">
            Location
          </label>
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            required
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            placeholder="Exact location/address"
            type="text"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-100">
            Description
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            required
            rows={3}
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            placeholder="Describe the incident"
          />
        </div>

        {/* Barangay */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-100">
            Barangay
          </label>
          <select
            name="barangay_id"
            value={form.barangay_id}
            onChange={handleChange}
            required
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          >
            <option value="">Select Barangay</option>
            {barangays.map((brgy) => (
              <option
                key={brgy.barangay_id}
                value={brgy.barangay_id}
                className="bg-slate-900 text-slate-100"
              >
                {brgy.barangay_name}
              </option>
            ))}
          </select>
        </div>

        {/* Landmark */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-slate-100">
            Landmark
          </label>
          <input
            name="landmark"
            value={form.landmark}
            onChange={handleChange}
            required
            className="w-full rounded-lg bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            placeholder="Nearby landmark"
            type="text"
          />
        </div>

        {/* Camera controls */}
        {!cameraActive && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startCamera}
              className="inline-flex items-center justify-center bg-gradient-to-r from-sky-500 to-sky-400 text-white rounded-full px-5 py-2 text-sm font-semibold shadow-lg shadow-sky-900/40 transition-transform hover:scale-[1.02]"
            >
              Start Camera
            </button>
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="inline-flex items-center justify-center border border-emerald-500 text-emerald-300 bg-transparent rounded-full px-4 py-2 text-sm font-semibold shadow-sm hover:bg-emerald-700/5 transition"
            >
              Use {cameraFacing === "user" ? "Back" : "Front"} Camera
            </button>
          </div>
        )}

        {cameraActive && (
          <div className="flex flex-col gap-2 mt-2">
            <video
              ref={videoRef}
              width={360}
              height={270}
              autoPlay
              className="rounded-2xl border border-slate-700 shadow-lg shadow-slate-900/60 bg-black/60 w-full max-w-md"
            />
            <div className="flex gap-3 flex-wrap mt-2">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-5 py-2 text-sm font-semibold shadow-lg shadow-emerald-900/40 transition-transform hover:scale-[1.02]"
              >
                Capture Photo
              </button>
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="border border-emerald-500 text-emerald-300 bg-transparent rounded-full px-4 py-2 text-sm font-semibold shadow-sm hover:bg-emerald-700/5 transition"
              >
                Switch Camera
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="bg-slate-700/80 text-slate-200 rounded-full px-4 py-2 text-sm font-medium hover:bg-slate-600 transition"
              >
                Cancel
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={320}
              height={240}
              style={{ display: "none" }}
            />
          </div>
        )}

        {photoUrl && (
          <div className="mt-4 mb-2 flex flex-col items-center gap-3">
            <div className="w-44 rounded-2xl overflow-hidden border border-slate-700 shadow-lg">
              <img src={photoUrl} alt="Live Capture" className="w-full block" />
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleRetakePhoto}
                className="inline-flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 text-emerald-300 rounded-full px-4 py-2 text-sm font-semibold border border-emerald-500/50 shadow-sm transition"
              >
                Retake Photo
              </button>
              <span className="text-xs text-slate-400 self-center">
                Preview of captured image
              </span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !form.photoFile}
          className="w-full py-3 text-sm font-bold rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-xl hover:scale-[1.02] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
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
    <section className="max-w-2xl mx-auto rounded-2xl bg-slate-900/90 border border-slate-800/70 p-6 md:p-8 shadow-xl backdrop-blur-sm">
      <h2 className="text-2xl font-bold mb-2 text-emerald-400">
        Manage Account
      </h2>
      <p className="text-[11px] text-slate-400 mb-4">
        Update your profile details and sign-in credentials.
      </p>

      {error && (
        <div
          role="alert"
          className="mb-3 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/50 text-xs text-red-200"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-3 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/50 text-xs text-emerald-200"
        >
          {success}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div className="label:text-slate-100 label:text-xs label:font-semibold space-y-3">
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
      <label
        htmlFor={name}
        className="block mb-1 text-xs font-semibold text-slate-100"
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
        autoComplete="off"
        className="w-full rounded-lg bg-slate-900/90 border border-slate-700 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
      />
    </div>
  );
}

function useResidentTracking(
  onPosition?: (coords: { lat: number; lng: number }) => void,
) {
  useEffect(() => {
    let watchId: number | null = null;

    async function startTracking() {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) return;
      if (!("geolocation" in navigator)) return;

      watchId = navigator.geolocation.watchPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;

          // update UI immediately
          onPosition?.({ lat: latitude, lng: longitude });

          // still persist to Supabase
          await supabase.from("resident_live_location").upsert(
            {
              user_id: user.id,
              latitude,
              longitude,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
        },
        (err) => console.error("Resident GPS error", err.code, err.message),
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30000,
        },
      );
    }

    startTracking();

    return () => {
      if (watchId !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [onPosition]);
}

export default function ResidentDashboard() {
  useResidentTracking();

  const router = useRouter();
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [reportSuccessModalOpen, setReportSuccessModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState("");
  const [activeTab, setActiveTab] = useState<ResidentActiveTab>("dashboard");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [gps, setGps] = useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });

  useResidentTracking(setGps);

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
    },
  );
  const [manageAccountLoading, setManageAccountLoading] = useState(true);
  const [manageAccountError, setManageAccountError] = useState<string | null>(
    null,
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

  // Map filter states
  const [showAllTrucks, setShowAllTrucks] = useState<boolean>(true);
  const [assignedTruckId, setAssignedTruckId] = useState<number | null>(null);

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
          "Failed to load reference data: " + (err as Error).message,
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

  // Fetch assigned truck for resident's barangay
  useEffect(() => {
    async function fetchAssignedTruck() {
      if (!residentBarangayId) return;
      try {
        const { data, error } = await supabase
          .from("collection_schedules")
          .select("truck_id")
          .eq("barangay_id", residentBarangayId)
          .limit(1)
          .single();

        if (!error && data) {
          const nextTruckId =
            data.truck_id == null ? null : Number(data.truck_id);
          setAssignedTruckId(
            nextTruckId != null && !Number.isNaN(nextTruckId)
              ? nextTruckId
              : null,
          );
        } else {
          setAssignedTruckId(null);
        }
      } catch (err) {
        setAssignedTruckId(null);
      }
    }
    fetchAssignedTruck();
  }, [residentBarangayId]);

  useEffect(() => {
    if (!assignedTruckId) {
      setShowAllTrucks(true);
    }
  }, [assignedTruckId]);

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
            "report_id, description, current_status, date_submitted, barangay_id",
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
          (r) => r.current_status && r.current_status !== "Resolved",
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
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
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

  const sidebarItems: {
    label: string;
    icon: string;
    tab: ResidentActiveTab;
  }[] = [
    { label: "Dashboard", icon: "📊", tab: "dashboard" },
    { label: "Schedules", icon: "📝", tab: "schedule" },
    {
      label: "Submit Incident Report",
      icon: "🚚",
      tab: "submitIncidentReport",
    },
    { label: "My Reports", icon: "📅", tab: "myReports" },
    { label: "Manage Account", icon: "🚨", tab: "manageAccount" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col relative">
      {/* Top navigation (same as SWMO) */}
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
                  Residents Dashboard
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
              <span className="hidden sm:inline text-xs sm:text-sm">
                Resident
              </span>
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
                      Resident Account
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

      <div className="flex flex-1 overflow-hidden relative z-10 pt-24 sm:pt-20 md:pt-16">
        {/* Mobile overlay when sidebar is open */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar and toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden fixed top-4 left-4 z-[70] inline-flex items-center justify-center h-11 w-11 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? "✖" : "☰"}
        </button>

        <aside
          className={`
          fixed z-40 left-0 top-24 sm:top-20 bottom-0 w-72 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }
          md:fixed md:translate-x-0 md:top-16 md:left-0 md:bottom-0 md:w-64
          bg-slate-950 border-r border-slate-800
          flex flex-col py-6 px-4 transition-all duration-300
        `}
        >
          <nav
            className="flex-1 space-y-2 text-sm font-semibold text-slate-200"
            aria-label="Main Navigation"
          >
            {[
              { label: "Dashboard", icon: "📊", tab: "dashboard" },
              { label: "Schedules", icon: "📝", tab: "schedule" },
              {
                label: "Submit Incident Report",
                icon: "🚚",
                tab: "submitIncidentReport",
              },
              { label: "My Reports", icon: "📅", tab: "myReports" },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => {
                  setActiveTab(item.tab as ResidentActiveTab);
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

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto px-6 md:px-8 py-8 space-y-8 relative z-10 md:ml-64 bg-slate-900/50">
          {/* Success modal */}
          {reportSuccessModalOpen && (
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center"
              onClick={() => setReportSuccessModalOpen(false)}
            >
              <div
                className="bg-slate-900/95 rounded-2xl shadow-2xl border border-emerald-700/60 max-w-sm w-full p-6 relative text-slate-100 backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setReportSuccessModalOpen(false)}
                  className="absolute top-1 right-2 text-2xl text-slate-500 hover:text-red-400 font-bold"
                  aria-label="Close"
                >
                  ×
                </button>
                <h3 className="font-bold text-lg mb-3 text-emerald-300 text-center">
                  Incident Report Submitted
                </h3>
                <p className="text-slate-200 text-center">
                  {reportSuccess || "Your report was submitted successfully."}
                </p>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => setReportSuccessModalOpen(false)}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500 transition-colors"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard */}
          {activeTab === "dashboard" && (
            <>
              {/* Responsive metrics grid */}
              {/* Map + small stats layout */}
              <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr),minmax(0,1fr)] gap-6">
                <div className="group relative rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl hover:shadow-3xl hover:shadow-green-600/40 transition-all duration-500 hover:border-green-600/70 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity blur-xl" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
                        Collection Coverage Map
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold text-sm backdrop-blur-sm relative z-10">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                          Live vehicles
                        </span>
                        <div className="inline-flex items-center rounded-2xl border border-slate-700/60 bg-slate-900/60 p-1 shadow-md">
                          <button
                            type="button"
                            onClick={() => setShowAllTrucks(true)}
                            className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                              showAllTrucks
                                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/50"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            All trucks
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAllTrucks(false)}
                            className={`inline-flex items-center rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                              !showAllTrucks
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/50"
                                : "text-slate-400 hover:text-slate-200"
                            } ${
                              assignedTruckId
                                ? ""
                                : "opacity-50 cursor-not-allowed"
                            }`}
                            disabled={!assignedTruckId}
                          >
                            Assigned truck
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-green-800/50 bg-slate-900/50 relative z-10">
                      <LeafletMap
                        residentGps={gps}
                        showAllTrucks={showAllTrucks}
                        assignedTruckId={assignedTruckId}
                      />
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Submit Incident Report */}
          {activeTab === "submitIncidentReport" && (
            <SubmitReportSection
              barangays={barangays}
              onReportSubmit={handleReportSubmit}
            />
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

          {/* Schedules */}
          {activeTab === "schedule" && (
            <ResidentSchedulesFeature
              residentBarangayId={residentBarangayId}
              barangays={barangays}
            />
          )}

          {/* My Reports */}
          {activeTab === "myReports" && (
            <section className="max-w-3xl mx-auto rounded-3xl bg-gradient-to-br from-slate-800/95 to-gray-800/95 border border-green-800/50 p-6 shadow-2xl shadow-green-900/30 backdrop-blur-2xl">
              <h2 className="text-2xl font-bold text-emerald-300 mb-4">
                My Recent Reports
              </h2>

              {reportsLoading && <TruckLoader />}

              {reportsError && (
                <p className="text-red-300 mb-2">{reportsError}</p>
              )}

              {!reportsLoading && !reportsError && userReports.length === 0 && (
                <p className="text-slate-300">
                  You have not submitted any reports yet.
                </p>
              )}

              {!reportsLoading && !reportsError && userReports.length > 0 && (
                <ul className="divide-y divide-green-800/40">
                  {userReports.map((report, index) => (
                    <li
                      key={report.report_id}
                      className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-emerald-700/50 rounded-2xl px-4 bg-slate-900/70"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">
                          {index + 1}.
                        </span>
                        <p className="font-semibold text-slate-100 line-clamp-2">
                          {report.location && report.location.length > 40
                            ? report.location.slice(0, 40) + "..."
                            : report.location}
                        </p>
                        <button
                          onClick={() => {
                            setSelectedMessage(report.description);
                            setModalOpen(true);
                          }}
                          className="ml-2 px-3 py-1 bg-emerald-600 text-white text-xs font-semibold rounded-2xl shadow hover:bg-emerald-500 transition-colors"
                        >
                          View Message
                        </button>
                      </div>
                      <div className="flex flex-col sm:items-end gap-1">
                        <p className="text-xs text-slate-300">
                          <span className="font-semibold">Submitted:</span>{" "}
                          {report.date_submitted
                            ? new Date(report.date_submitted).toLocaleString()
                            : "N/A"}
                        </p>
                        <span
                          className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full ${
                            report.current_status === "Resolved"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : report.current_status === "In Progress"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-500/30 text-slate-200 border border-slate-500/60"
                          }`}
                        >
                          {report.current_status || "Unknown"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {modalOpen && (
                <div
                  className="pt-50 fixed inset-0 backdrop-blur-sm z-50 flex justify-center items-center"
                  onClick={() => setModalOpen(false)}
                  onKeyDown={(e) => e.key === "Escape" && setModalOpen(false)}
                  tabIndex={-1}
                  role="presentation"
                >
                  <div
                    className="relative max-w-lg w-full text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.7)] rounded-2xl border border-emerald-700/60 bg-gradient-to-b from-slate-900/95 to-slate-800/90 transform transition-all duration-200 ease-out"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="report-message-title"
                  >
                    {/* Title bar */}
                    <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-3 border-b border-emerald-700/70">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center justify-center h-9 w-9 rounded-xl bg-emerald-600/10 text-emerald-300 border border-emerald-700/30">
                          💬
                        </span>
                        <h3
                          id="report-message-title"
                          className="ml-1 text-sm font-semibold tracking-wide text-slate-100"
                        >
                          Report Message
                        </h3>
                      </div>

                      <button
                        onClick={() => setModalOpen(false)}
                        className="text-sm font-semibold text-slate-400 hover:text-red-400 px-2 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                        aria-label="Close dialog"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <p className="text-xs uppercase tracking-[0.18em] text-emerald-400/80 mb-3">
                        MESSAGE
                      </p>
                      <div className="rounded-lg bg-slate-900/80 border border-slate-700/70 px-4 py-3">
                        <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
                          {selectedMessage || "No message available."}
                        </p>
                      </div>

                      <div className="mt-5 flex justify-end">
                        <button
                          onClick={() => setModalOpen(false)}
                          className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-700/60 hover:from-emerald-500 hover:to-teal-500 transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
