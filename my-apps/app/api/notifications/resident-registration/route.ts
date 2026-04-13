// Notify BWMC when resident registers
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { userId, residentName, barangayId } = await req.json();

    // Get BWMC for the barangay
    const { data: bwmc, error: bwmcError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number")
      .eq("role", "BWMC")
      .eq("barangay_id", barangayId)
      .maybeSingle();

    if (bwmcError || !bwmc) {
      console.error("Failed to fetch BWMC:", bwmcError);
      return NextResponse.json(
        { success: false, error: "BWMC not found" },
        { status: 404 },
      );
    }

    const message = `TTruck: OFFICIAL NOTICE: A new resident registration has been submitted by ${residentName} and is awaiting your approval. Please log in to the system to review and complete the approval process.\n\n - Track the Truck`;

    try {
      const smsResult = await sendSMS(bwmc.contact_number, message);

      if (smsResult?.success || smsResult?.status === "success") {
        await supabase.from("sms_notifications").insert({
          user_id: userId,
          notification_type: "resident_registration",
          message,
          phone_number: bwmc.contact_number,
          sent_at: new Date().toISOString(),
          status: "sent",
        });

        return NextResponse.json({
          success: true,
          message: "BWMC notified successfully",
        });
      }

      await supabase.from("sms_notifications").insert({
        user_id: userId,
        notification_type: "resident_registration",
        message,
        phone_number: bwmc.contact_number,
        sent_at: new Date().toISOString(),
        status: "failed",
        error_message: smsResult?.error || "Unknown SMS send failure",
      });

      return NextResponse.json(
        {
          success: false,
          error: smsResult?.error || "Failed to send SMS notification",
        },
        { status: 502 },
      );
    } catch (smsErr: any) {
      console.error("Registration notification error (sendSMS):", smsErr);
      await supabase.from("sms_notifications").insert({
        user_id: userId,
        notification_type: "resident_registration",
        message,
        phone_number: bwmc.contact_number,
        sent_at: new Date().toISOString(),
        status: "failed",
        error_message: smsErr?.message || String(smsErr),
      });

      return NextResponse.json(
        { success: false, error: smsErr?.message || "SMS provider error" },
        { status: 500 },
      );
    }
  } catch (error: any) {
    console.error("Registration notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
