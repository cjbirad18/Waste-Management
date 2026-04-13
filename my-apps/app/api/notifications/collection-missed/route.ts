// Notify SWMO/TCEMO Secretary, BWMC, and Residents when collection is missed
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const { scheduleId, barangayId, barangayName } = await req.json();

    const notifications = [];

    // Get SWMO/TCEMO Secretary
    const { data: secretary } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Secretary")
      .maybeSingle();

    // Get BWMC
    const { data: bwmc } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "BWMC")
      .eq("barangay_id", barangayId)
      .maybeSingle();

    // Get residents
    const { data: residents } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Resident")
      .eq("barangay_id", barangayId)
      .eq("notification_enabled", true);

    // Message for staff
    const staffMessage = `TTruck: OFFICIAL NOTICE: Scheduled garbage collection in ${barangayName} was not completed as planned. The vehicle did not enter or finish the assigned route. Please investigate and establish a rescheduled service window as soon as possible.\n\n - Track the Truck`;

    // Message for residents
    const residentMessage = `TTruck: NOTICE: Scheduled garbage collection for ${barangayName} was missed today. We apologize for the inconvenience. You will be notified of the rescheduled collection.\n\n - Track the Truck`;

    // Notify Secretary
    if (secretary) {
      const smsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: secretary.contact_number,
            message: staffMessage,
          }),
        },
      );

      if ((await smsResponse.json()).success) {
        await supabase.from("sms_notifications").insert({
          user_id: secretary.user_id,
          notification_type: "collection_missed",
          message: staffMessage,
          phone_number: secretary.contact_number,
          sent_at: new Date().toISOString(),
          status: "sent",
        });
        notifications.push("Secretary");
      }
    }

    // Notify BWMC
    if (bwmc) {
      const smsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: bwmc.contact_number,
            message: staffMessage,
          }),
        },
      );

      if ((await smsResponse.json()).success) {
        await supabase.from("sms_notifications").insert({
          user_id: bwmc.user_id,
          notification_type: "collection_missed",
          message: staffMessage,
          phone_number: bwmc.contact_number,
          sent_at: new Date().toISOString(),
          status: "sent",
        });
        notifications.push("BWMC");
      }
    }

    // Notify Residents
    if (residents) {
      for (const resident of residents) {
        const smsResponse = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: resident.contact_number,
              message: residentMessage,
            }),
          },
        );

        if ((await smsResponse.json()).success) {
          await supabase.from("sms_notifications").insert({
            user_id: resident.user_id,
            notification_type: "collection_missed",
            message: residentMessage,
            phone_number: resident.contact_number,
            sent_at: new Date().toISOString(),
            status: "sent",
          });
          notifications.push(`Resident: ${resident.first_name}`);
        }
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
