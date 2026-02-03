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
          "Garbage collection has started in your area! The truck is now in your barangay. Please prepare your waste. - Track the Truck";
        break;
      case "ongoing":
        message =
          "Garbage collection is now ongoing in your barangay. You can track the truck's location in real-time through the app. - Track the Truck";
        break;
      case "delayed":
        message = `The garbage collection truck is delayed. ${reason ? `Reason: ${reason}.` : ""} We apologize for the inconvenience. - Track the Truck`;
        break;
      case "missed":
        message =
          "The garbage collection for your barangay was missed today. You will be notified of the rescheduled collection time. We apologize for the inconvenience. - Track the Truck";
        break;
      case "completed":
        message =
          "Garbage collection in your barangay has been completed. Thank you for your cooperation! - Track the Truck";
        break;
      default:
        message = `Garbage collection status update: ${status}. - Track the Truck`;
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
