// Notify GCP and Residents when schedule is updated/archived
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

type UserData = {
  first_name: string;
  last_name: string;
  contact_number: string;
};

type GCPAssignment = {
  gcp_id: string;
  users: UserData | UserData[] | null;
};

export async function POST(req: NextRequest) {
  try {
    const {
      scheduleId,
      barangayId,
      updateType,
      scheduleDate,
      scheduleTime,
      oldPattern,
      newPattern,
      oldStartTime,
      newStartTime,
    } = await req.json();

    console.log("Schedule update notification request:", {
      scheduleId,
      barangayId,
      updateType,
      scheduleDate,
      scheduleTime,
      oldPattern,
      newPattern,
      oldStartTime,
      newStartTime,
    });

    const notifications = [];

    // Get assigned GCP
    const { data: gcpAssignments, error: gcpError } = await supabase
      .from("collection_schedules")
      .select(
        `
        gcp_id,
        users:gcp_id (first_name, last_name, contact_number)
      `,
      )
      .eq("schedule_id", scheduleId);

    if (gcpError) {
      console.error("Error fetching GCP assignments:", gcpError);
    } else {
      console.log("GCP assignments found:", gcpAssignments?.length || 0);
    }

    // Get residents in the barangay
    const { data: residents, error: residentsError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Resident")
      .eq("barangay_id", barangayId);

    if (residentsError) {
      console.error("Error fetching residents:", residentsError);
    } else {
      console.log(
        "Residents in barangay found:",
        residents?.length || 0,
        residents,
      );
    }

    const recipients = [
      ...(gcpAssignments || [])
        .map((a: GCPAssignment) => {
          const userData = Array.isArray(a.users) ? a.users[0] : a.users;
          if (!userData) return null;
          return {
            name: `${userData.first_name} ${userData.last_name}`,
            phone: userData.contact_number,
            userId: a.gcp_id,
          };
        })
        .filter(
          (item): item is { name: string; phone: string; userId: string } =>
            item !== null,
        ),
      ...(residents || []).map((r) => ({
        name: `${r.first_name} ${r.last_name}`,
        phone: r.contact_number,
        userId: r.user_id,
      })),
    ];

    let message = "";

    // Helper function to convert pattern code to full day names
    const getFullDayNames = (pattern: string): string => {
      const dayMap: { [key: string]: string } = {
        MWF: "Monday, Wednesday, and Friday",
        TTH: "Tuesday and Thursday",
      };
      return dayMap[pattern] || pattern;
    };

    // Helper to format time for display (e.g. "05:00" -> "5:00 AM")
    const formatTime = (time: string): string => {
      if (!time) return "";
      const [hours, minutes] = time.split(":").map(Number);
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
    };

    if (updateType === "archived") {
      message = `NOTICE: The garbage collection schedule for ${scheduleDate} has been cancelled. You will be notified of the new schedule.\n\n - Track the Truck`;
    } else if (updateType === "updated" && oldPattern && newPattern) {
      const newDays = getFullDayNames(newPattern);
      const oldDays = getFullDayNames(oldPattern);

      const patternChanged = oldPattern !== newPattern;
      const timeChanged =
        oldStartTime && newStartTime && oldStartTime !== newStartTime;

      let changes = "";
      if (patternChanged && timeChanged) {
        changes = `The collection schedule has been revised: Days are now ${newDays} (${newPattern}) instead of ${oldDays} (${oldPattern}), and departure time is updated from ${formatTime(oldStartTime)} to ${formatTime(newStartTime)}.`;
      } else if (patternChanged) {
        changes = `The collection schedule has been revised: Days are now ${newDays} (${newPattern}) instead of ${oldDays} (${oldPattern}).`;
      } else if (timeChanged) {
        changes = `The collection schedule has been revised: Departure time is updated from ${formatTime(oldStartTime)} to ${formatTime(newStartTime)}. Collection days remain ${newDays} (${newPattern}).`;
      } else {
        changes = `The collection schedule has been updated to Days: ${newDays} (${newPattern}) and Departure: ${formatTime(newStartTime || scheduleTime)}.`;
      }

      message = `NOTICE: Garbage collection schedule update. ${changes} Please place your waste according to the revised schedule.\n\n - Track the Truck`;
    }

    console.log("Total recipients to notify:", recipients.length, recipients);

    // Send to all recipients
    for (const recipient of recipients) {
      console.log(`Sending SMS to ${recipient.name} (${recipient.phone})...`);
      try {
        const smsResult = await sendSMS(recipient.phone, message);
        console.log(`SMS response for ${recipient.phone}:`, smsResult);
        if (smsResult.status === "success") {
          await supabase.from("sms_notifications").insert({
            user_id: recipient.userId,
            notification_type: "schedule_update",
            message,
            phone_number: recipient.phone,
            sent_at: new Date().toISOString(),
            status: "sent",
          });
          notifications.push(recipient.name);
        } else {
          console.error(
            `Failed to send SMS to ${recipient.phone}:`,
            smsResult.message || smsResult.error,
          );
        }
      } catch (err) {
        console.error(`Failed to send SMS to ${recipient.phone}:`, err);
      }
    }

    console.log("Notifications sent successfully to:", notifications);

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length,
      recipients: notifications,
    });
  } catch (error: any) {
    console.error("Schedule update notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
