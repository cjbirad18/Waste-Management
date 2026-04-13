// Notify Secretary, BWMC, and Residents when a collection is delayed
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const {
      scheduleId,
      barangayId,
      barangayName,
      delayReason,
      delayNotes,
      estimatedDelay,
      gcpName,
    } = await req.json();

    if (!scheduleId || !barangayId || !delayReason) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const notifications: string[] = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Staff message (Secretary + BWMC)
    const staffMessage =
      `TTruck: DELIVERY UPDATE: Scheduled collection service for ${barangayName} has been delayed. Reason: ${delayReason}.` +
      (delayNotes ? ` Additional notes: ${delayNotes}.` : "") +
      (gcpName ? ` GCP: ${gcpName}.` : "") +
      ` Please expect further updates from Track the Truck.\n\n -Track the Truck`;

    // Resident message
    const residentMessage = `TTruck: Scheduled garbage collection for ${barangayName} is delayed. Reason: ${delayReason}. We apologize for the inconvenience and appreciate your patience.\n\n -Track the Truck`;

    // 1. Notify Secretary
    const { data: secretaries } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Secretary")
      .not("contact_number", "is", null);

    if (secretaries?.length) {
      for (const secretary of secretaries) {
        try {
          const smsResponse = await fetch(`${baseUrl}/api/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: secretary.contact_number,
              message: staffMessage,
            }),
          });
          const result = await smsResponse.json();
          if (result.success) {
            await supabase.from("sms_notifications").insert({
              user_id: secretary.user_id,
              notification_type: "collection_delayed",
              message: staffMessage,
              phone_number: secretary.contact_number,
              sent_at: new Date().toISOString(),
              status: "sent",
            });
            notifications.push(`Secretary: ${secretary.first_name}`);
          }
        } catch (e) {
          console.error("Failed to notify secretary", e);
        }
      }
    }

    // 2. Notify BWMC of affected barangay
    const { data: bwmc } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "BWMC")
      .eq("barangay_id", barangayId)
      .maybeSingle();

    if (bwmc?.contact_number) {
      try {
        const smsResponse = await fetch(`${baseUrl}/api/send-sms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: bwmc.contact_number,
            message: staffMessage,
          }),
        });
        const result = await smsResponse.json();
        if (result.success) {
          await supabase.from("sms_notifications").insert({
            user_id: bwmc.user_id,
            notification_type: "collection_delayed",
            message: staffMessage,
            phone_number: bwmc.contact_number,
            sent_at: new Date().toISOString(),
            status: "sent",
          });
          notifications.push(`BWMC: ${bwmc.first_name}`);
        }
      } catch (e) {
        console.error("Failed to notify BWMC", e);
      }
    }

    // 3. Notify residents of affected barangay
    const { data: residents } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Resident")
      .eq("barangay_id", barangayId)
      .not("contact_number", "is", null);

    if (residents?.length) {
      for (const resident of residents) {
        try {
          const smsResponse = await fetch(`${baseUrl}/api/send-sms`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: resident.contact_number,
              message: residentMessage,
            }),
          });
          const result = await smsResponse.json();
          if (result.success) {
            await supabase.from("sms_notifications").insert({
              user_id: resident.user_id,
              notification_type: "collection_delayed",
              message: residentMessage,
              phone_number: resident.contact_number,
              sent_at: new Date().toISOString(),
              status: "sent",
            });
            notifications.push(`Resident: ${resident.first_name}`);
          }
        } catch (e) {
          console.error("Failed to notify resident", e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length,
      recipients: notifications,
    });
  } catch (error: any) {
    console.error("Collection delay notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
