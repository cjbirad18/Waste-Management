// app/api/notifications/truck-arrival/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

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
    const { truckId, latitude, longitude } = await req.json();

    // Get residents within notification range (e.g., 500 meters)
    const { data: residents, error: residentsError } = await supabase.from(
      "resident_live_location",
    ).select(`
        user_id,
        latitude,
        longitude,
        users:user_id (
          first_name,
          last_name,
          contact_number,
          notification_enabled
        )
      `);

    if (residentsError || !residents) {
      console.error("Failed to fetch residents:", residentsError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch residents" },
        { status: 500 },
      );
    }

    const notifications = [];
    const notificationRadius = 0.5; // 500 meters in km

    for (const resident of residents as ResidentLocation[]) {
      // Handle both single object and array from Supabase join
      const userData = Array.isArray(resident.users)
        ? resident.users[0]
        : resident.users;

      if (!userData || userData.notification_enabled === false) continue;
      if (!resident.latitude || !resident.longitude) continue;

      // Calculate distance using Haversine formula
      const distance = calculateDistance(
        latitude,
        longitude,
        resident.latitude,
        resident.longitude,
      );

      // If truck is within 500m and approaching
      if (distance <= notificationRadius) {
        const eta = Math.round((distance / 17.5) * 60); // Assuming 17.5 km/h average speed

        // Check if notification was already sent recently (avoid spam)
        const { data: recentNotif } = await supabase
          .from("sms_notifications")
          .select("id")
          .eq("user_id", resident.user_id)
          .eq("notification_type", "truck_arrival")
          .gte("sent_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 mins
          .maybeSingle();

        if (!recentNotif) {
          const phoneNumber = userData.contact_number;
          const name = `${userData.first_name} ${userData.last_name}`;
          const message = `Hi ${name}! A garbage truck will arrive at your location in approximately ${eta} minutes. Please prepare your waste for collection. - Track the Truck`;

          // Send SMS
          const smsResponse = await fetch(
            `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to: phoneNumber, message }),
            },
          );

          const smsResult = await smsResponse.json();

          if (smsResult.success) {
            // Log notification
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
              eta,
              distance,
            });
          }
        }
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

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
