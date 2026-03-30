// Notify resident about incident report status updates
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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
        message = `INCIDENT REPORT UPDATE: #${reportId} has been acknowledged and is currently under review. Thank you for your submission.\n\n - Track the Truck`;
        break;
      case "needs_action":
        message = `INCIDENT REPORT UPDATE: #${reportId} has been validated and escalated to SWMO for intervention. You will receive further updates shortly.\n\n - Track the Truck`;
        break;
      case "ongoing":
        message = `INCIDENT REPORT UPDATE: #${reportId} is being actively addressed by our team. We are working to resolve the matter promptly.\n\n - Track the Truck`;
        break;
      case "resolved":
        message = `INCIDENT REPORT UPDATE: #${reportId} has been resolved.${actionTaken ? ` Action taken: ${actionTaken}.` : ""} Thank you for your cooperation.\n\n - Track the Truck`;
        break;
      case "rejected":
        message = `INCIDENT REPORT UPDATE: #${reportId} cannot be processed as submitted.${reason ? ` Reason: ${reason}.` : " Additional evidence may be required."} Please follow up with SWMO for next steps.\n\n - Track the Truck`;
        break;
      default:
        message = `INCIDENT REPORT UPDATE: #${reportId} status changed to ${status}.\n\n - Track the Truck`;
    }

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

    if (smsResult.success) {
      await supabase.from("sms_notifications").insert({
        user_id: userId,
        notification_type: "incident_status_update",
        message,
        phone_number: resident.contact_number,
        sent_at: new Date().toISOString(),
        status: "sent",
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
