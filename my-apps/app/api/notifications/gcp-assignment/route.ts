// Notify GCP when collection is assigned
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const { gcpId, scheduleDate, scheduleTime, barangayName } =
      await req.json();

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

    const message = `You have been assigned to a garbage collection schedule. Barangay: ${barangayName}, Date: ${scheduleDate}, Time: ${scheduleTime}. Please check the system for details. - Track the Truck`;

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
        notification_type: "gcp_assignment",
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
    console.error("GCP assignment notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
