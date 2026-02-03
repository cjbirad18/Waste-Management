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

    // Get user details
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("name, phone")
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

    let message = `Welcome to Track the Truck! Your account has been created by ${creator}.\n\n`;
    message += `Role: ${roleName}\n`;
    message += `Username: ${user.phone}\n`;

    if (tempPassword) {
      message += `Temporary Password: ${tempPassword}\n\n`;
      message += `Please login and change your password immediately for security.`;
    } else {
      message += `\nPlease check your email for login instructions.`;
    }

    // Send SMS
    const smsResult = await sendSMS(user.phone, message);

    // Log notification
    await supabase.from("sms_notifications").insert({
      user_id: userId,
      notification_type: "account_created",
      message: message,
      phone_number: user.phone,
      status: smsResult.success ? "sent" : "failed",
      error_message: smsResult.success ? null : smsResult.error,
    });

    return NextResponse.json({
      success: smsResult.success,
      message: smsResult.success
        ? "Account creation notification sent successfully"
        : "Failed to send notification",
      error: smsResult.error,
    });
  } catch (error) {
    console.error("Error sending account creation notification:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
