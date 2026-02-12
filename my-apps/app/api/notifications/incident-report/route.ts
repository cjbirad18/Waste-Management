// Notify BWMC when resident submits incident report
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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

    const message = `New incident report submitted by ${reporterName}.\nLocation: ${location}.\nReport ID: #${reportId}.\nPlease review and take action.\n\n - Track the Truck`;

    // Send SMS
    const smsResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: bwmc.contact_number,
          message,
        }),
      },
    );

    const smsResult = await smsResponse.json();

    if (smsResult.success) {
      await supabase.from("sms_notifications").insert({
        user_id: bwmc.user_id,
        notification_type: "incident_report_submitted",
        message,
        phone_number: bwmc.contact_number,
        sent_at: new Date().toISOString(),
        status: "sent",
      });
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
