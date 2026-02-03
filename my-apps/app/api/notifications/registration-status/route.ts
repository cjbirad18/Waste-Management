// Notify resident when BWMC approves or rejects their registration
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { userId, status, reason } = await req.json();

    console.log(
      `[Registration Status SMS] Processing userId: ${userId}, status: ${status}`,
    );

    // Get resident details
    const { data: resident, error: residentError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (residentError) {
      console.error(`[Registration Status SMS] Database error:`, residentError);
      return NextResponse.json(
        { success: false, error: `Database error: ${residentError.message}` },
        { status: 500 },
      );
    }

    if (!resident) {
      console.error(
        `[Registration Status SMS] Resident not found for userId: ${userId}`,
      );
      return NextResponse.json(
        { success: false, error: "Resident not found" },
        { status: 404 },
      );
    }

    console.log(
      `[Registration Status SMS] Found resident: ${resident.first_name} ${resident.last_name}, Phone: ${resident.contact_number}`,
    );

    // Validate phone number
    if (!resident.contact_number) {
      console.error(
        `[Registration Status SMS] No phone number for resident: ${userId}`,
      );
      return NextResponse.json(
        { success: false, error: "Resident has no phone number" },
        { status: 400 },
      );
    }

    let message = "";

    if (status === "approved" || status === "active") {
      message = `Welcome to Track the Truck, ${resident.first_name}! Your account has been approved by BWMC. You can now log in and track garbage collection in your area. - Track the Truck`;
    } else if (status === "rejected") {
      message = `Your registration for Track the Truck has been reviewed. ${reason ? `Reason: ${reason}.` : "Please contact your BWMC for more information."} - Track the Truck`;
    } else {
      console.warn(`[Registration Status SMS] Unknown status: ${status}`);
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    console.log(
      `[Registration Status SMS] Sending SMS to ${resident.contact_number}`,
    );

    // Send SMS
    const smsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: resident.contact_number,
          message,
        }),
      },
    );

    const smsResult = await smsResponse.json();

    console.log(`[Registration Status SMS] SMS API Response:`, {
      status: smsResponse.status,
      result: smsResult,
    });

    if (smsResult.success) {
      console.log(`[Registration Status SMS] SMS sent successfully`);

      // Try to log, but don't fail if table doesn't exist
      try {
        await supabase.from("sms_notifications").insert({
          user_id: userId,
          notification_type: "registration_status",
          message,
          phone_number: resident.contact_number,
          sent_at: new Date().toISOString(),
          status: "sent",
        });
      } catch (logErr) {
        console.warn(
          `[Registration Status SMS] Could not log to sms_notifications (table may not exist):`,
          logErr,
        );
      }
    } else {
      console.error(`[Registration Status SMS] SMS failed:`, smsResult.error);

      // Try to log failed attempt
      try {
        await supabase.from("sms_notifications").insert({
          user_id: userId,
          notification_type: "registration_status",
          message,
          phone_number: resident.contact_number,
          sent_at: new Date().toISOString(),
          status: "failed",
          error_message: smsResult.error || "Unknown error",
        });
      } catch (logErr) {
        console.warn(
          `[Registration Status SMS] Could not log error (table may not exist):`,
          logErr,
        );
      }
    }

    return NextResponse.json({
      success: smsResult.success,
      message: smsResult.success
        ? "Resident notified successfully"
        : `SMS failed: ${smsResult.error}`,
      error: smsResult.error,
    });
  } catch (error: any) {
    console.error("[Registration Status SMS] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 },
    );
  }
}
