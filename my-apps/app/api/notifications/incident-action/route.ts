// Notify GCP when incident needs action
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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

    const message = `Incident Report #${reportId} requires your action.\nLocation: ${location}.\nDescription: ${description}.\nPlease respond accordingly.\n\n - Track the Truck`;

    // Send SMS
    const smsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: gcp.contact_number,
          message,
        }),
      },
    );

    const smsResult = await smsResponse.json();

    if (smsResult.success) {
      await supabase.from("sms_notifications").insert({
        user_id: gcpId,
        notification_type: "incident_action_required",
        message,
        phone_number: gcp.contact_number,
        sent_at: new Date().toISOString(),
        status: "sent",
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
