// Notify BWMC when resident submits incident report
import { NextRequest, NextResponse } from "next/server";

import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { reportId, barangayId, location, reporterName } = await req.json();

    // Get BWMC for the barangay
    const { data: bwmc, error: bwmcError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "BWMC")
      .eq("barangay_id", barangayId)
      .maybeSingle();

    if (bwmcError || !bwmc) {
      return NextResponse.json(
        { success: false, error: "BWMC not found" },
        { status: 404 },
      );
    }

    const message = `OFFICIAL INCIDENT NOTICE: A new report has been received from ${reporterName}.\nLocation: ${location}.\nReport ID: #${reportId}.\nPlease review immediately and initiate appropriate response procedures.\n\n - Track the Truck`;

    let smsResult;
    try {
      smsResult = await sendSMS(bwmc.contact_number, message);
      await supabase.from("sms_notifications").insert({
        user_id: bwmc.user_id,
        notification_type: "incident_report_submitted",
        message,
        phone_number: bwmc.contact_number,
        sent_at: new Date().toISOString(),
        status: "sent",
      });
    } catch (error: any) {
      console.error("Failed to send SMS:", error);
      await supabase.from("sms_notifications").insert({
        user_id: bwmc.user_id,
        notification_type: "incident_report_submitted",
        message,
        phone_number: bwmc.contact_number,
        sent_at: new Date().toISOString(),
        status: "failed",
        error_message:
          (error && typeof error === "object" && "message" in error
            ? (error as { message?: string }).message
            : undefined) || String(error),
      });
      return NextResponse.json(
        { success: false, error: "Failed to send SMS" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "BWMC notified successfully",
    });
  } catch (error: any) {
    console.error("Incident report notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
