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
        message = `Your incident report #${reportId} has been acknowledged and is under review. Thank you for reporting! - Track the Truck`;
        break;
      case "needs_action":
        message = `Your incident report #${reportId} has been validated and forwarded to SWMO for action. You will be notified of updates. - Track the Truck`;
        break;
      case "ongoing":
        message = `Action is being taken on your incident report #${reportId}. Our team is working to resolve the issue. - Track the Truck`;
        break;
      case "resolved":
        message = `Your incident report #${reportId} has been resolved. ${actionTaken ? `Action taken: ${actionTaken}.` : ""} Thank you for your report! 
        
        - Track the Truck`;
        break;
      case "rejected":
        message = `Your incident report #${reportId} has been rejected. ${reason ? `Reason: ${reason}.` : "Additional evidence may be required."} - Track the Truck`;
        break;
      default:
        message = `Update on incident report #${reportId}: Status changed to ${status}. - Track the Truck`;
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
