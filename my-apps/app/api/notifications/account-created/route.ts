import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * Notify user when their account is created by SWMO Head or TCEMO Head
 * POST /api/notifications/account-created
 * Body: { userId: string, role: string, createdBy: string, tempPassword: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, role, createdBy, tempPassword } = await request.json();

    if (!userId || !role || !createdBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get user details using correct column names
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, username, email")
      .eq("user_id", userId)
      .single();

    if (userError || !user) {
      console.error("User lookup error:", userError);
      return NextResponse.json(
        { error: "User not found", details: userError?.message },
        { status: 404 },
      );
    }

    const phone = user.contact_number;
    if (!phone) {
      return NextResponse.json(
        { error: "User has no phone number" },
        { status: 400 },
      );
    }

    const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    const loginId = user.username || user.email || phone;

    // Role-specific messages
    const roleMessages: Record<string, string> = {
      "TCEMO Head": "TCEMO Head",
      BWMC: "Barangay Waste Management Committee member",
      "SWMO/TCEMO Secretary": "SWMO/TCEMO Secretary",
      GCP: "Garbage Collection Personnel",
      "SWMO Head": "SWMO Head (Admin)",
    };

    const roleName = roleMessages[role] || role;
    const creator = createdBy === "SWMO Head" ? "SWMO Head" : "TCEMO Head";

    let message = `TTruck: Hey ${userName || "there"}! Good news, you're now part of the team as ${roleName}. ${creator} set things up for you. Go ahead and open the app to get started.`;
    message += ` Username: ${loginId}\n`;
    // always include email explicitly
    message += ` Email: ${user.email}\n`;
    if (tempPassword) {
      message += `Temporary Password: ${tempPassword}. Change it right away and do not share it with anyone.\n\n`;
    }
    message += ` -TrackTheTruck`;

    // Send SMS with proper error handling
    let smsResult: { success: boolean; error?: string } = { success: false };
    try {
      const result = await sendSMS(phone, message);
      smsResult = { success: true, ...result };
    } catch (smsErr: any) {
      console.error("SMS sending failed:", smsErr);
      smsResult = {
        success: false,
        error: smsErr?.message || String(smsErr),
      };
    }

    // Log notification (non-blocking, don't crash if this fails)
    try {
      await supabase.from("sms_notifications").insert({
        user_id: userId,
        notification_type: "account_created",
        message: message,
        phone_number: phone,
        status: smsResult.success ? "sent" : "failed",
        error_message: smsResult.success ? null : smsResult.error || null,
      });
    } catch (logErr) {
      console.error("Failed to log SMS notification:", logErr);
    }

    return NextResponse.json({
      success: smsResult.success,
      message: smsResult.success
        ? "Account creation notification sent successfully"
        : "Failed to send SMS notification",
      error: smsResult.error || null,
    });
  } catch (error: any) {
    console.error("Error sending account creation notification:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
