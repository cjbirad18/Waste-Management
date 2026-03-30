import { NextRequest, NextResponse } from "next/server";
import { sendSMS } from "@/lib/sms";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

/**
 * Notify both new and previous SWMO Head when admin transfer occurs
 * POST /api/notifications/admin-transfer
 * Body: { newAdminId: string, previousAdminId: string, transferredBy: string, tempPassword: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { newAdminId, previousAdminId, transferredBy, tempPassword } =
      await request.json();

    if (!newAdminId || !previousAdminId || !transferredBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Get new admin details
    const { data: newAdmin, error: newAdminError } = await supabase
      .from("users")
      .select("name, phone")
      .eq("user_id", newAdminId)
      .single();

    // Get previous admin details
    const { data: prevAdmin, error: prevAdminError } = await supabase
      .from("users")
      .select("name, phone")
      .eq("user_id", previousAdminId)
      .single();

    if (newAdminError || !newAdmin) {
      return NextResponse.json(
        { error: "New admin not found" },
        { status: 404 },
      );
    }

    if (prevAdminError || !prevAdmin) {
      return NextResponse.json(
        { error: "Previous admin not found" },
        { status: 404 },
      );
    }

    const results = {
      newAdmin: { success: false, error: null as string | null },
      prevAdmin: { success: false, error: null as string | null },
    };

    // Send notification to new admin
    if (newAdmin.phone) {
      let newAdminMessage = `Track the Truck - Admin Account Created\n\n`;
      newAdminMessage += `Dear ${newAdmin.name},\n\n`;
      newAdminMessage += `You have been appointed as the new SWMO Head (Administrator) by ${transferredBy}.\n\n`;
      newAdminMessage += `Login Credentials:\n`;
      newAdminMessage += `Username: ${newAdmin.phone}\n`;

      if (tempPassword) {
        newAdminMessage += `Temporary Password: ${tempPassword}\n\n`;
        newAdminMessage += `Please login immediately and change your password.\n\n`;
      }

      newAdminMessage += `You now have full administrative access to manage user accounts, schedules, and system operations.`;

      const newAdminSMS = await sendSMS(newAdmin.phone, newAdminMessage);
      results.newAdmin = {
        success: newAdminSMS.success,
        error: newAdminSMS.error || null,
      };

      // Log notification for new admin
      await supabase.from("sms_notifications").insert({
        user_id: newAdminId,
        notification_type: "admin_transfer_new",
        message: newAdminMessage,
        phone_number: newAdmin.phone,
        status: newAdminSMS.success ? "sent" : "failed",
        error_message: newAdminSMS.success ? null : newAdminSMS.error,
      });
    }

    // Send notification to previous admin
    if (prevAdmin.phone) {
      let prevAdminMessage = `Track the Truck - Admin Transfer Notice\n\n`;
      prevAdminMessage += `Dear ${prevAdmin.name},\n\n`;
      prevAdminMessage += `Your SWMO Head (Administrator) account has been transferred to a new administrator.\n\n`;
      prevAdminMessage += `New Admin: ${newAdmin.name}\n`;
      prevAdminMessage += `Transferred by: ${transferredBy}\n\n`;
      prevAdminMessage += `Your previous account has been deactivated. Thank you for your service.\n\n`;
      prevAdminMessage += `If you have any questions, please contact the TCEMO Head.\n\n`;
      prevAdminMessage += ` -Track the Truck`;

      const prevAdminSMS = await sendSMS(prevAdmin.phone, prevAdminMessage);
      results.prevAdmin = {
        success: prevAdminSMS.success,
        error: prevAdminSMS.error || null,
      };

      // Log notification for previous admin
      await supabase.from("sms_notifications").insert({
        user_id: previousAdminId,
        notification_type: "admin_transfer_previous",
        message: prevAdminMessage,
        phone_number: prevAdmin.phone,
        status: prevAdminSMS.success ? "sent" : "failed",
        error_message: prevAdminSMS.success ? null : prevAdminSMS.error,
      });
    }

    return NextResponse.json({
      success: results.newAdmin.success && results.prevAdmin.success,
      message: "Admin transfer notifications processed",
      results: results,
    });
  } catch (error) {
    console.error("Error sending admin transfer notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
