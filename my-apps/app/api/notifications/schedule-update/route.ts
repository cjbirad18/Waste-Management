// Notify GCP and Residents when schedule is updated/archived
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

type UserData = {
  first_name: string;
  last_name: string;
  contact_number: string;
};

type GCPAssignment = {
  gcp_id: string;
  users: UserData | UserData[] | null;
};

export async function POST(req: NextRequest) {
  try {
    const { scheduleId, barangayId, updateType, scheduleDate, scheduleTime } =
      await req.json();

    const notifications = [];

    // Get assigned GCP
    const { data: gcpAssignments } = await supabase
      .from("collection_schedules")
      .select(
        `
        gcp_id,
        users:gcp_id (first_name, last_name, contact_number)
      `,
      )
      .eq("schedule_id", scheduleId);

    // Get residents in the barangay
    const { data: residents } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Resident")
      .eq("barangay_id", barangayId)
      .eq("notification_enabled", true);

    const recipients = [
      ...(gcpAssignments || [])
        .map((a: GCPAssignment) => {
          const userData = Array.isArray(a.users) ? a.users[0] : a.users;
          if (!userData) return null;
          return {
            name: `${userData.first_name} ${userData.last_name}`,
            phone: userData.contact_number,
            userId: a.gcp_id,
          };
        })
        .filter(
          (item): item is { name: string; phone: string; userId: string } =>
            item !== null,
        ),
      ...(residents || []).map((r) => ({
        name: `${r.first_name} ${r.last_name}`,
        phone: r.contact_number,
        userId: r.user_id,
      })),
    ];

    let message = "";
    if (updateType === "archived") {
      message = `NOTICE: The garbage collection schedule for ${scheduleDate} has been cancelled. You will be notified of the new schedule. - Track the Truck`;
    } else if (updateType === "updated") {
      message = `UPDATE: Garbage collection schedule has been changed. New schedule: ${scheduleDate} at ${scheduleTime}. - Track the Truck`;
    }

    // Send to all recipients
    for (const recipient of recipients) {
      const smsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: recipient.phone, message }),
        },
      );

      const smsResult = await smsResponse.json();

      if (smsResult.success) {
        await supabase.from("sms_notifications").insert({
          user_id: recipient.userId,
          notification_type: "schedule_update",
          message,
          phone_number: recipient.phone,
          sent_at: new Date().toISOString(),
          status: "sent",
        });
        notifications.push(recipient.name);
      }
    }

    return NextResponse.json({
      success: true,
      notificationsSent: notifications.length,
      recipients: notifications,
    });
  } catch (error: any) {
    console.error("Schedule update notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
