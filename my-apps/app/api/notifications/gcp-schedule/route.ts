import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      gcp_user_id,
      barangay_id,
      schedule_pattern,
      start_time,
      truck_code,
    } = body;

    if (!gcp_user_id || !barangay_id || !schedule_pattern || !start_time) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Fetch GCP user info with correct column names
    const { data: gcp, error: gcpError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number")
      .eq("user_id", gcp_user_id)
      .single();
    if (gcpError || !gcp) {
      console.error("GCP lookup error:", gcpError);
      return NextResponse.json(
        { error: "GCP not found", details: gcpError?.message },
        { status: 404 },
      );
    }

    const phone = gcp.contact_number;
    if (!phone) {
      return NextResponse.json(
        { error: "GCP has no contact number" },
        { status: 400 },
      );
    }

    // Fetch barangay info
    const { data: barangay, error: barangayError } = await supabase
      .from("barangay")
      .select("barangay_name")
      .eq("barangay_id", barangay_id)
      .single();
    if (barangayError || !barangay) {
      console.error("Barangay lookup error:", barangayError);
      return NextResponse.json(
        { error: "Barangay not found", details: barangayError?.message },
        { status: 404 },
      );
    }

    // Format departure time
    const formattedTime = start_time || "TBA";

    // Compose SMS message (avoid spam words)
    let message = `TTruck: Hey ${gcp.first_name}! You've been assigned to Brgy. ${barangay.barangay_name}.`;
    message += ` Schedule: ${schedule_pattern}, departure at ${formattedTime}.`;
    if (truck_code) {
      message += ` Truck: ${truck_code}.`;
    }
    message += ` Stay ready! -TrackTheTruck`;

    // Send SMS directly
    let smsResult: { success: boolean; error?: string } = { success: false };
    try {
      const result = await sendSMS(phone, message);
      smsResult = { success: true, ...result };
    } catch (smsErr: any) {
      console.error("SMS sending failed:", smsErr);
      smsResult = {
        success: false,
        error: smsErr?.message || String(smsErr),
      };
    }

    // Log notification (non-blocking)
    try {
      await supabase.from("sms_notifications").insert({
        user_id: gcp_user_id,
        notification_type: "gcp_schedule",
        message: message,
        phone_number: phone,
        status: smsResult.success ? "sent" : "failed",
        error_message: smsResult.success ? null : smsResult.error || null,
      });
    } catch (logErr) {
      console.error("Failed to log SMS notification:", logErr);
    }

    return NextResponse.json({
      success: smsResult.success,
      message: smsResult.success
        ? "GCP schedule notification sent"
        : "Failed to send SMS notification",
      error: smsResult.error || null,
    });
  } catch (err: any) {
    console.error("GCP schedule notification error:", err);
    return NextResponse.json(
      { error: err?.message || "Unexpected error" },
      { status: 500 },
    );
  }
}
