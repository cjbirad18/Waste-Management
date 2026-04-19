// Notify BWMC when resident submits incident report
import { NextRequest, NextResponse } from "next/server";

import { supabase } from "@/lib/supabaseClient";
import { sendSMS } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const { reportId, barangayId, location, reporterName } = await req.json();
    const barangayIdNumber = Number(barangayId);

    // Get BWMC users for the barangay.
    const bwmcQuery = supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "BWMC");

    if (!Number.isNaN(barangayIdNumber)) {
      bwmcQuery.eq("barangay_id", barangayIdNumber);
    } else {
      bwmcQuery.eq("barangay_id", barangayId);
    }

    const { data: bwmcData, error: bwmcError } = await bwmcQuery;
    const bwmcRecipients = Array.isArray(bwmcData)
      ? bwmcData.filter((user) => user.contact_number)
      : [];

    if (bwmcError || bwmcRecipients.length === 0) {
      console.error("BWMC lookup failed", {
        bwmcError,
        barangayId,
        barangayIdNumber,
        bwmcCount: Array.isArray(bwmcData) ? bwmcData.length : 0,
      });
      return NextResponse.json(
        { success: false, error: "BWMC not found" },
        { status: 404 },
      );
    }

    const { data: secretaries, error: secretaryError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, user_id")
      .eq("role", "Secretary");

    if (secretaryError) {
      console.error("Failed to fetch secretaries:", secretaryError);
    }

    const bwmcMessage = `TTruck: OFFICIAL INCIDENT NOTICE: A new report has been received from ${reporterName}.\nLocation: ${location}.\nReport ID: #${reportId}.\nPlease review immediately and initiate appropriate response procedures.\n\n - Track the Truck`;

    const secretaryMessage = `TTruck: NOTICE: A resident incident report was submitted by ${reporterName}.\nLocation: ${location}.\nReport ID: #${reportId}.\nThis report is being shared for administrative awareness and follow-up.\n\n - Track the Truck`;

    const uniqueRecipients = new Map<
      string,
      {
        user_id: string;
        message: string;
        notification_type: string;
      }
    >();

    for (const bwmc of bwmcRecipients) {
      if (!uniqueRecipients.has(bwmc.contact_number)) {
        uniqueRecipients.set(bwmc.contact_number, {
          user_id: bwmc.user_id,
          message: bwmcMessage,
          notification_type: "incident_report_submitted",
        });
      }
    }

    const secretaryRecipients = Array.isArray(secretaries) ? secretaries : [];
    for (const secretary of secretaryRecipients) {
      if (!uniqueRecipients.has(secretary.contact_number)) {
        uniqueRecipients.set(secretary.contact_number, {
          user_id: secretary.user_id,
          message: secretaryMessage,
          notification_type: "incident_report_submitted",
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
      } catch (error: any) {
        console.error("Failed to send SMS to recipient:", error, {
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
          error_message:
            (error && typeof error === "object" && "message" in error
              ? (error as { message?: string }).message
              : undefined) || String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "BWMC and secretary notifications sent successfully",
    });
  } catch (error: any) {
    console.error("Incident report notification error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
