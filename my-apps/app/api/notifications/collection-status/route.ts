// Notify residents about collection status changes
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST(req: NextRequest) {
  try {
    const { scheduleId, status, barangayId, reason } = await req.json();

    // Get residents in the barangay
    const { data: residents } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Resident")
      .eq("barangay_id", barangayId)
      .eq("notification_enabled", true);

    if (!residents || residents.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No residents to notify",
      });
    }

    let message = "";

    switch (status) {
      case "started":
        message =
          "NOTICE: Garbage collection has commenced in your barangay. Please ensure your waste is ready for collection.\n\n - Track the Truck";
        break;
      case "ongoing":
        message =
          "UPDATE: Garbage collection is currently in progress in your barangay. You may monitor the truck's location via the app.\n\n - Track the Truck";
        break;
      case "delayed":
        message = `NOTICE: Garbage collection is delayed. ${reason ? `Reason: ${reason}.` : "The reason is being reviewed."} We apologize for the inconvenience and will provide updates shortly.\n\n - Track the Truck`;
        break;
      case "missed":
        message =
          "NOTICE: Scheduled garbage collection in your barangay was not completed today. We apologize for the inconvenience and will communicate the rescheduled collection time as soon as possible.\n\n - Track the Truck";
        break;
      case "completed":
        message =
          "CONFIRMATION: Garbage collection in your barangay is complete. Thank you for your cooperation.\n\n - Track the Truck";
        break;
      default:
        message = `NOTICE: Garbage collection status update: ${status}.\n\n - Track the Truck`;
    }

    const notifications = [];

    // Send to all residents
    for (const resident of residents) {
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
          user_id: resident.user_id,
          notification_type: "collection_status",
          message,
          phone_number: resident.contact_number,
          sent_at: new Date().toISOString(),
          status: "sent",
        });
        notifications.push(`${resident.first_name} ${resident.last_name}`);
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length,
      recipients: notifications,
    });
  } catch (error: any) {
    console.error("Collection status notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
