import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * Notify SWMO/TCEMO Secretary when SWMO Head approves a schedule
 * POST /api/notifications/schedule-approval
 * Body: { scheduleId: string, approvedBy: string, status: 'approved' | 'rejected', remarks?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { scheduleId, approvedBy, status, remarks } = await request.json();

    if (!scheduleId || !approvedBy || !status) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get schedule details
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .select("schedule_date, barangay_id, created_by")
      .eq("schedule_id", scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 },
      );
    }

    // Get barangay name
    const { data: barangay } = await supabase
      .from("barangays")
      .select("name")
      .eq("id", schedule.barangay_id)
      .single();

    // Get secretary (creator) details
    const { data: secretary, error: secretaryError } = await supabase
      .from("users")
      .select("name, phone")
      .eq("user_id", schedule.created_by)
      .single();

    if (secretaryError || !secretary || !secretary.phone) {
      return NextResponse.json(
        { error: "Secretary not found or has no phone number" },
        { status: 404 },
      );
    }

    const scheduleDate = new Date(schedule.schedule_date).toLocaleDateString(
      "en-US",
      {
        month: "long",
        day: "numeric",
        year: "numeric",
      },
    );

    let message = `TTruck: Schedule ${status === "approved" ? "Approved" : "Rejected"}\n\n`;
    message += `Dear ${secretary.name},\n\n`;
    message += `Your garbage collection schedule submission has been ${status} by ${approvedBy}.\n\n`;
    message += `Schedule Details:\n`;
    message += `- Barangay: ${barangay?.name || "N/A"}\n`;
    message += `- Date: ${scheduleDate}\n`;
    message += `- Schedule ID: ${scheduleId}\n`;

    if (remarks) {
      message += `\nRemarks: ${remarks}\n`;
    }

    if (status === "approved") {
      message += `\nThe schedule is now active and has been published to GCP and residents.`;
    } else {
      message += `\nAction required: Please review the comments and resubmit the schedule with necessary corrections.`;
    }

    // Send SMS
    const smsResult = await sendSMS(secretary.phone, message);

    // Log notification
    await supabase.from("sms_notifications").insert({
      user_id: schedule.created_by,
      notification_type: "schedule_approval",
      message: message,
      phone_number: secretary.phone,
      status: smsResult.success ? "sent" : "failed",
      error_message: smsResult.success ? null : smsResult.error,
    });

    return NextResponse.json({
      success: smsResult.success,
      message: smsResult.success
        ? "Schedule approval notification sent successfully"
        : "Failed to send notification",
      error: smsResult.error,
    });
  } catch (error) {
    console.error("Error sending schedule approval notification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
