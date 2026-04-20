// Notify SWMO Head when a collection is completed with waste weight and type
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const {
      barangayId,
      barangayName,
      collectionDate,
      wasteWeight,
      garbageType,
      scheduleTime,
    } = await req.json();

    if (!barangayId || !barangayName || !wasteWeight || !garbageType) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields for collection done notification",
        },
        { status: 400 },
      );
    }

    const notifications: string[] = [];

    const { data: swmoHeads, error } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "SWMO Head")
      .not("contact_number", "is", null);

    if (error) {
      throw error;
    }

    const message =
      `TTruck: DONE COLLECTION UPDATE: ${barangayName} collection is complete.` +
      ` Waste weight: ${wasteWeight} tons. Garbage type: ${garbageType}.` +
      `${collectionDate ? ` Date: ${collectionDate}.` : ""}` +
      `${scheduleTime ? ` Scheduled time: ${scheduleTime}.` : ""}` +
      ` Please review the collection report.`;

    if (swmoHeads?.length) {
      for (const swmo of swmoHeads) {
        try {
          await sendSMS(swmo.contact_number, message);
          await supabase.from("sms_notifications").insert({
            user_id: swmo.user_id,
            notification_type: "collection_done",
            message,
            phone_number: swmo.contact_number,
            sent_at: new Date().toISOString(),
            status: "sent",
          });
          notifications.push(`SWMO Head: ${swmo.first_name}`);
        } catch (smsError) {
          console.error("Failed to notify SWMO Head", smsError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length,
      recipients: notifications,
    });
  } catch (error: any) {
    console.error("Collection done notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
