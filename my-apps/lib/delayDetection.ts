// Delay Detection Utility for Collection Schedules
import { supabase } from "./supabaseClient";

export interface DelayedCollection {
  schedule_id: string;
  barangay_id: number;
  barangay_name: string;
  scheduled_date: string;
  scheduled_time: string;
  start_time: string;
  delay_minutes: number;
  status: string;
  gcp_name?: string;
  collection_details_id?: string;
}

export interface DelayCheckResult {
  isDelayed: boolean;
  delayMinutes: number;
  message: string;
}

/**
 * Check if a specific collection is delayed based on scheduled time
 * @param scheduledTime - The scheduled start time (e.g., "08:00")
 * @param collectionDate - The scheduled date (YYYY-MM-DD)
 * @param currentStatus - Current collection status
 * @param thresholdMinutes - Minutes past scheduled time to consider delayed (default: 30)
 */
export function isCollectionDelayed(
  scheduledTime: string,
  collectionDate: string,
  currentStatus: string,
  thresholdMinutes: number = 30,
): DelayCheckResult {
  // Only check if status is Pending or In Progress
  if (currentStatus !== "Pending" && currentStatus !== "In Progress") {
    return {
      isDelayed: false,
      delayMinutes: 0,
      message: "Collection completed or cancelled",
    };
  }

  try {
    // Parse the scheduled datetime
    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const scheduledDateTime = new Date(collectionDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);

    // Get current time
    const now = new Date();

    // Calculate difference in minutes
    const diffMs = now.getTime() - scheduledDateTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    // Check if delayed (past scheduled time + threshold)
    const isDelayed = diffMinutes > thresholdMinutes;

    return {
      isDelayed,
      delayMinutes: diffMinutes > 0 ? diffMinutes : 0,
      message: isDelayed
        ? `Delayed by ${diffMinutes - thresholdMinutes} minutes`
        : "On schedule",
    };
  } catch (error) {
    console.error("Error checking delay:", error);
    return {
      isDelayed: false,
      delayMinutes: 0,
      message: "Error calculating delay",
    };
  }
}

/**
 * Get all delayed collections for a specific barangay
 * @param barangayId - The barangay ID to check
 */
export async function getDelayedCollectionsForBarangay(
  barangayId: number,
): Promise<DelayedCollection[]> {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("collection_schedules")
      .select(
        `
        schedule_id,
        barangay_id,
        start_time,
        barangay:barangay_id (
          barangay_name
        ),
        gcp_user:gcp_user_id (
          first_name,
          last_name
        ),
        collection_details:collection_details (
          collectiondetails_id,
          collection_date,
          status
        )
      `,
      )
      .eq("barangay_id", barangayId)
      .eq("status", "Active");

    if (error) throw error;

    const delayed: DelayedCollection[] = [];

    for (const schedule of data || []) {
      const details = (schedule as any).collection_details;
      if (!Array.isArray(details) || details.length === 0) continue;

      for (const detail of details) {
        const delayCheck = isCollectionDelayed(
          (schedule as any).start_time || "05:00",
          detail.collection_date,
          detail.status,
        );

        if (delayCheck.isDelayed) {
          const barangay = (schedule as any).barangay;
          const gcpUser = (schedule as any).gcp_user;

          delayed.push({
            schedule_id: (schedule as any).schedule_id,
            barangay_id: (schedule as any).barangay_id,
            barangay_name: barangay?.barangay_name || "Unknown",
            scheduled_date: detail.collection_date,
            scheduled_time: (schedule as any).start_time || "05:00",
            start_time: (schedule as any).start_time || "05:00",
            delay_minutes: delayCheck.delayMinutes,
            status: detail.status,
            gcp_name: gcpUser
              ? `${gcpUser.first_name} ${gcpUser.last_name}`
              : "Unassigned",
            collection_details_id: detail.collectiondetails_id,
          });
        }
      }
    }

    return delayed;
  } catch (error) {
    if (error instanceof Error) {
      console.error(
        "Error fetching delayed collections:",
        error.message,
        error.stack,
      );
    } else if (typeof error === "object" && error !== null) {
      console.error(
        "Error fetching delayed collections:",
        JSON.stringify(error),
      );
    } else {
      console.error("Error fetching delayed collections:", error);
    }
    return [];
  }
}

/**
 * Get all delayed collections across all barangays (for SWMO/Secretary)
 */
export async function getAllDelayedCollections(): Promise<DelayedCollection[]> {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("collection_schedules")
      .select(
        `
        schedule_id,
        barangay_id,
        start_time,
        barangay:barangay_id (
          barangay_name
        ),
        gcp_user:gcp_user_id (
          first_name,
          last_name
        ),
        collection_details:collection_details (
          collectiondetails_id,
          collection_date,
          status
        )
      `,
      )
      .eq("status", "Active");

    if (error) throw error;

    const delayed: DelayedCollection[] = [];

    for (const schedule of data || []) {
      const details = (schedule as any).collection_details;
      if (!Array.isArray(details) || details.length === 0) continue;

      for (const detail of details) {
        const delayCheck = isCollectionDelayed(
          (schedule as any).start_time || "05:00",
          detail.collection_date,
          detail.status,
        );

        if (delayCheck.isDelayed) {
          const barangay = (schedule as any).barangay;
          const gcpUser = (schedule as any).gcp_user;

          delayed.push({
            schedule_id: (schedule as any).schedule_id,
            barangay_id: (schedule as any).barangay_id,
            barangay_name: barangay?.barangay_name || "Unknown",
            scheduled_date: detail.collection_date,
            scheduled_time: (schedule as any).start_time || "05:00",
            start_time: (schedule as any).start_time || "05:00",
            delay_minutes: delayCheck.delayMinutes,
            status: detail.status,
            gcp_name: gcpUser
              ? `${gcpUser.first_name} ${gcpUser.last_name}`
              : "Unassigned",
            collection_details_id: detail.collectiondetails_id,
          });
        }
      }
    }

    return delayed;
  } catch (error) {
    console.error("Error fetching all delayed collections:", error);
    return [];
  }
}

/**
 * Calculate delay status badge color based on delay minutes
 */
export function getDelayStatusColor(delayMinutes: number): {
  bg: string;
  text: string;
  label: string;
} {
  if (delayMinutes < 30) {
    return {
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      label: "Slight Delay",
    };
  } else if (delayMinutes < 60) {
    return {
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      label: "Delayed",
    };
  } else {
    return {
      bg: "bg-red-500/10",
      text: "text-red-400",
      label: "Severely Delayed",
    };
  }
}
