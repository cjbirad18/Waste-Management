import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * Notify user when their account is deactivated
 * POST /api/notifications/account-deactivated
 * Body: { userId: string, reason?: string, deactivatedBy: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, reason, deactivatedBy } = await request.json();

    if (!userId || !deactivatedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("name, phone, role")
      .eq("user_id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.phone) {
      return NextResponse.json(
        { error: "User has no phone number" },
        { status: 400 },
      );
    }

    let message = `TTruck: Account Deactivation Notice\n\n`;
    message += `Dear ${user.name},\n\n`;
    message += `Your account has been deactivated by ${deactivatedBy}.\n`;

    if (reason) {
      message += `\nReason: ${reason}\n`;
    }

    message += `\nYou will no longer have access to the system. `;
    message += `If you believe this is an error, please contact the administrator.`;
    message += `\n\n - Track the Truck`;

    // Send SMS
    const smsResult = await sendSMS(user.phone, message);

    // Log notification
    await supabase.from("sms_notifications").insert({
      user_id: userId,
      notification_type: "account_deactivated",
      message: message,
      phone_number: user.phone,
      status: smsResult.success ? "sent" : "failed",
      error_message: smsResult.success ? null : smsResult.error,
    });

    return NextResponse.json({
      success: smsResult.success,
      message: smsResult.success
        ? "Account deactivation notification sent successfully"
        : "Failed to send notification",
      error: smsResult.error,
    });
  } catch (error) {
    console.error("Error sending account deactivation notification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
