// Notify SWMO Secretary and residents when collection is missed
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { scheduleId, barangayId, barangayName, reason } = await req.json();

    const notifications: string[] = [];

    // Get SWMO Secretary users
    const { data: secretaries, error: secretaryError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Secretary")
      .not("contact_number", "is", null);

    if (secretaryError) {
      console.error("Failed to fetch secretaries:", secretaryError);
    }

    // Get residents in the assigned barangay
    const { data: residents, error: residentError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Resident")
      .eq("barangay_id", barangayId)
      .not("contact_number", "is", null);

    if (residentError) {
      console.error("Failed to fetch residents:", residentError);
    }

    const reasonText = reason ? ` Reason: ${reason}` : "";
    const staffMessage = `TTruck: OFFICIAL NOTICE: Scheduled garbage collection in ${barangayName} was missed today.${reasonText}\n Please review and arrange a rescheduled collection as soon as possible. \n\n -Track the Truck`;
    const residentMessage = `TTruck: NOTICE: Scheduled garbage collection for ${barangayName} was missed today.${reasonText} We apologize for the inconvenience and will notify you once a rescheduled collection is arranged. \n\n -Track the Truck`;

    const uniqueRecipients = new Map<
      string,
      {
        user_id: string;
        message: string;
        notification_type: string;
      }
    >();

    // Notify secretaries
    const secretaryRecipients = Array.isArray(secretaries) ? secretaries : [];
    for (const secretary of secretaryRecipients) {
      if (!secretary.contact_number) continue;
      if (!uniqueRecipients.has(secretary.contact_number)) {
        uniqueRecipients.set(secretary.contact_number, {
          user_id: secretary.user_id,
          message: staffMessage,
          notification_type: "collection_missed",
        });
      }
    }

    // Notify residents
    const residentRecipients = Array.isArray(residents) ? residents : [];
    for (const resident of residentRecipients) {
      if (!resident.contact_number) continue;
      if (!uniqueRecipients.has(resident.contact_number)) {
        uniqueRecipients.set(resident.contact_number, {
          user_id: resident.user_id,
          message: residentMessage,
          notification_type: "collection_missed",
        });
      }
    }

    for (const [phone_number, recipient] of uniqueRecipients.entries()) {
      try {
        await sendSMS(phone_number, recipient.message);
        await supabase.from("sms_notifications").insert({
          user_id: recipient.user_id,
          notification_type: recipient.notification_type,
          message: recipient.message,
          phone_number,
          sent_at: new Date().toISOString(),
          status: "sent",
        });
        notifications.push(phone_number);
      } catch (error: any) {
        console.error("Failed to send missed notification SMS:", error, {
          phone_number,
          user_id: recipient.user_id,
        });
        await supabase.from("sms_notifications").insert({
          user_id: recipient.user_id,
          notification_type: recipient.notification_type,
          message: recipient.message,
          phone_number,
          sent_at: new Date().toISOString(),
          status: "failed",
          error_message: error?.message ?? String(error) ?? "Unknown SMS error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length,
      recipients: notifications,
    });
  } catch (error: any) {
    console.error("Missed collection notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
