// app/api/notifications/truck-arrival/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

// Define types for the query result
type UserData = {
  first_name: string;
  last_name: string;
  contact_number: string;
  notification_enabled?: boolean;
};

type ResidentLocation = {
  user_id: string;
  latitude: number | null;
  longitude: number | null;
  users: UserData | UserData[] | null;
};

export async function POST(req: NextRequest) {
  try {
    const { truckId, barangayId, latitude, longitude } = await req.json();

    if (!barangayId) {
      return NextResponse.json({
        success: false,
        error: "Missing barangayId",
      });
    }

    // Normalize barangayId type to number if possible (supabase column is numeric)
    const barangayIdNumber = Number(barangayId);

    // Notify all residents in the barangay (no need for live location tracking)
    const query = supabase
      .from("users")
      .select("user_id, first_name, last_name, contact_number")
      .eq("role", "Resident");
    if (!Number.isNaN(barangayIdNumber)) {
      query.eq("barangay_id", barangayIdNumber);
    } else {
      query.eq("barangay_id", barangayId);
    }

    const { data: residents, error: residentsError, count } = await query;

    console.log(
      "truck-arrival: barangayId",
      barangayId,
      "count",
      count,
      "resolvedAs",
      Number.isNaN(barangayIdNumber) ? "string" : "number",
    );

    if (residentsError || !residents) {
      console.warn(
        "Failed to fetch residents for barangay (treating as no residents):",
        residentsError,
      );
      return NextResponse.json({
        success: true,
        notificationsSent: 0,
        notifications: [],
        warning: "Unable to fetch residents for barangay",
        details: residentsError?.message || null,
      });
    }

    const notifications = [];

    for (const resident of residents) {
      if (!resident.contact_number) continue;

      const phoneNumber = resident.contact_number;
      const name = `${resident.first_name} ${resident.last_name}`;
      const message = `TTruck: NOTICE: ${name}, the garbage collection vehicle assigned to your barangay has arrived. Please ensure your waste is prepared for immediate collection.\n\n - Track the Truck`;

      // Check if notification was already sent recently (avoid spam)
      const { data: recentNotif } = await supabase
        .from("sms_notifications")
        .select("id")
        .eq("user_id", resident.user_id)
        .eq("notification_type", "truck_arrival")
        .gte("sent_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 mins
        .maybeSingle();

      if (recentNotif) continue;

      // Send SMS using internal SMS helper (no internal HTTP fetch call)
      try {
        await sendSMS(phoneNumber, message);
        await supabase.from("sms_notifications").insert({
          user_id: resident.user_id,
          notification_type: "truck_arrival",
          message,
          phone_number: phoneNumber,
          sent_at: new Date().toISOString(),
          status: "sent",
        });

        notifications.push({
          user: name,
          phone: phoneNumber,
        });
      } catch (smsError) {
        console.error("Failed to send truck arrival SMS", {
          phoneNumber,
          smsError,
        });
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length,
      notifications,
    });
  } catch (error: any) {
    console.error("Truck arrival notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
