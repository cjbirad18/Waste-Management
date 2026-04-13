import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { createClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms";

function generateRandomPassword(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(req: NextRequest) {
  try {
    const { identifier } = await req.json();
    if (!identifier) {
      return NextResponse.json(
        { success: false, error: "Missing identifier." },
        { status: 400 },
      );
    }

    // Find user by email, username, or phone
    const { data: user, error } = await supabase
      .from("users")
      .select("user_id, contact_number")
      .or(
        `email.eq.${identifier},username.eq.${identifier},contact_number.eq.${identifier}`,
      )
      .maybeSingle();

    if (error || !user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 },
      );
    }

    if (!user.contact_number) {
      return NextResponse.json(
        { success: false, error: "No phone number on file." },
        { status: 400 },
      );
    }

    // Generate new password
    const newPassword = generateRandomPassword();

    // Use service role key for admin password reset
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!serviceRoleKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Server misconfiguration: missing service role key.",
        },
        { status: 500 },
      );
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      serviceRoleKey,
    );

    // Correct method for updating user password in Supabase v2+ (GoTrueAdminApi)
    // updateUserById(userId: string, attributes: AdminUserAttributes)
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(user.user_id, {
        password: newPassword,
      });
    if (updateError) {
      return NextResponse.json(
        { success: false, error: "Failed to update password." },
        { status: 500 },
      );
    }

    // Send SMS
    const smsMessage = `TTruck: Your password has been reset. Your new temporary password is ${newPassword}. Please log in and update your password immediately after signing in. Thank you.\n\n -Track the Truck.`;
    try {
      await sendSMS(user.contact_number, smsMessage);
    } catch (smsError) {
      return NextResponse.json(
        { success: false, error: "Failed to send SMS." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset SMS sent.",
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Server error." },
      { status: 500 },
    );
  }
}
