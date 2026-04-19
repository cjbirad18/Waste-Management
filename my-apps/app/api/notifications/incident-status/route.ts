// Notify resident about incident report status updates
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { reportId, userId, status, reason, actionTaken } = await req.json();

    // Get resident details
    const { data: resident, error: residentError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number")
      .eq("user_id", userId)
      .maybeSingle();

    if (residentError || !resident) {
      return NextResponse.json(
        { success: false, error: "Resident not found" },
        { status: 404 },
      );
    }

    let message = "";

    switch (status) {
      case "acknowledged":
        message = `TTruck: INCIDENT REPORT UPDATE: #${reportId} has been acknowledged and is currently under review. Thank you for your submission.\n\n - Track the Truck`;
        break;
      case "needs_action":
        message = `TTruck: INCIDENT REPORT UPDATE: #${reportId} has been validated and escalated to SWMO for intervention. You will receive further updates shortly.\n\n - Track the Truck`;
        break;
      case "ongoing":
        message = `TTruck: INCIDENT REPORT UPDATE: #${reportId} is being actively addressed by our team. We are working to resolve the matter promptly.\n\n - Track the Truck`;
        break;
      case "resolved":
        message = `TTruck: INCIDENT REPORT UPDATE: #${reportId} has been resolved.${actionTaken ? ` Action taken: ${actionTaken}.` : ""} Thank you for your cooperation.\n\n - Track the Truck`;
        break;
      case "rejected":
        message = `TTruck: INCIDENT REPORT UPDATE: #${reportId} cannot be processed as resolved.${reason ? ` Reason: ${reason}.` : " Additional evidence may be required."} Please follow up with SWMO for next steps.\n\n - Track the Truck`;
        break;
      default:
        message = `TTruck: INCIDENT REPORT UPDATE: #${reportId} status changed to ${status}.\n\n - Track the Truck`;
    }

    // Send SMS directly using the helper
    try {
      await sendSMS(resident.contact_number, message);
      await supabase.from("sms_notifications").insert({
        user_id: userId,
        notification_type: "incident_status_update",
        message,
        phone_number: resident.contact_number,
        sent_at: new Date().toISOString(),
        status: "sent",
      });
    } catch (smsError: any) {
      console.error("Incident status SMS send failed:", smsError);
      await supabase.from("sms_notifications").insert({
        user_id: userId,
        notification_type: "incident_status_update",
        message,
        phone_number: resident.contact_number,
        sent_at: new Date().toISOString(),
        status: "failed",
        error_message:
          smsError?.message ||
          (typeof smsError === "string" ? smsError : "SMS send failed"),
      });
      return NextResponse.json({
        success: true,
        message: "Resident notification failed but status update is recorded",
      });
    }

    return NextResponse.json({
      success: true,
      message: "Resident notified successfully",
    });
  } catch (error: any) {
    console.error("Incident status notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
