// Notify resident when BWMC approves or rejects their registration
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const { userId, status, reason } = await req.json();

    // Get resident details
    const { data: resident, error: residentError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (residentError || !resident) {
      return NextResponse.json(
        { success: false, error: "Resident not found" },
        { status: 404 },
      );
    }

    let message = "";

    if (status === "approved" || status === "active") {
      message = `Welcome to Track the Truck, ${resident.first_name}! Your account has been approved by BWMC. You can now log in and track garbage collection in your area. - Track the Truck`;
    } else if (status === "rejected") {
      message = `Your registration for Track the Truck has been reviewed. ${reason ? `Reason: ${reason}.` : "Please contact your BWMC for more information."} - Track the Truck`;
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
        notification_type: "registration_status",
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
    console.error("Registration status notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
