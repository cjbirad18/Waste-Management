// Notify GCP when incident needs action
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { reportId, gcpId, location, description } = await req.json();

    // Get GCP details
    const { data: gcp, error: gcpError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number")
      .eq("user_id", gcpId)
      .maybeSingle();

    if (gcpError || !gcp) {
      return NextResponse.json(
        { success: false, error: "GCP not found" },
        { status: 404 },
      );
    }

    const message = `TTruck: INCIDENT UPDATE: Report #${reportId} requires immediate attention.\nLocation: ${location}.\nDetails: ${description}.\nPlease acknowledge receipt and act according to standard operating procedures.\n\n - Track the Truck`;

    // Send SMS directly using the helper
    try {
      await sendSMS(gcp.contact_number, message);
      await supabase.from("sms_notifications").insert({
        user_id: gcpId,
        notification_type: "incident_action_required",
        message,
        phone_number: gcp.contact_number,
        sent_at: new Date().toISOString(),
        status: "sent",
      });
    } catch (smsError: any) {
      console.error("Incident action SMS send failed:", smsError);
      await supabase.from("sms_notifications").insert({
        user_id: gcpId,
        notification_type: "incident_action_required",
        message,
        phone_number: gcp.contact_number,
        sent_at: new Date().toISOString(),
        status: "failed",
        error_message:
          smsError?.message ||
          (typeof smsError === "string" ? smsError : "SMS send failed"),
      });
      return NextResponse.json({
        success: false,
        error: smsError?.message || "SMS send failed",
      });
    }

    return NextResponse.json({
      success: true,
      message: "GCP notified successfully",
    });
  } catch (error: any) {
    console.error("Incident action notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
