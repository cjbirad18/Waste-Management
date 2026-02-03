// Notify resident when BWMC approves or rejects their registration
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  console.log("[Registration Status SMS] Endpoint called");

  try {
    const body = await req.json();
    console.log("[Registration Status SMS] Request body:", body);

    const { userId, status, reason } = body;

    if (!userId || !status) {
      console.error("[Registration Status SMS] Missing userId or status");
      return NextResponse.json(
        { success: false, error: "Missing userId or status" },
        { status: 400 },
      );
    }

    console.log(
      `[Registration Status SMS] Processing userId: ${userId}, status: ${status}`,
    );

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("[Registration Status SMS] Missing Supabase credentials");
      return NextResponse.json(
        { success: false, error: "Server configuration error" },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get resident details
    const { data: resident, error: residentError } = await supabase
      .from("users")
      .select("first_name, last_name, contact_number, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (residentError) {
      console.error(`[Registration Status SMS] Database error:`, residentError);
      return NextResponse.json(
        { success: false, error: `Database error: ${residentError.message}` },
        { status: 500 },
      );
    }

    if (!resident) {
      console.error(
        `[Registration Status SMS] Resident not found for userId: ${userId}`,
      );
      return NextResponse.json(
        { success: false, error: "Resident not found" },
        { status: 404 },
      );
    }

    console.log(
      `[Registration Status SMS] Found resident: ${resident.first_name} ${resident.last_name}, Phone: ${resident.contact_number}`,
    );

    // Validate phone number
    if (!resident.contact_number) {
      console.error(
        `[Registration Status SMS] No phone number for resident: ${userId}`,
      );
      return NextResponse.json(
        { success: false, error: "Resident has no phone number" },
        { status: 400 },
      );
    }

    let message = "";

    if (status === "approved" || status === "active") {
      message = `Welcome to Track the Truck! Your registration has been approved. You can now log in using your credentials to access garbage collection schedules and real-time truck updates.`;
    } else if (status === "rejected") {
      message = reason ? `${reason}` : `Not OK. Call BWMC.`;
    } else {
      console.warn(`[Registration Status SMS] Unknown status: ${status}`);
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 },
      );
    }

    console.log(
      `[Registration Status SMS] Sending SMS to ${resident.contact_number}`,
    );

    // Send SMS
    const smsResponse = await fetch(
      `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/send-sms`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: resident.contact_number,
          message,
          userId: userId,
          notificationType: "registration-status",
        }),
      },
    );

    const smsResult = await smsResponse.json();

    console.log(`[Registration Status SMS] SMS API Response:`, {
      status: smsResponse.status,
      result: smsResult,
    });

    // Skip database logging for now - just return the SMS result
    return NextResponse.json({
      success: smsResult.success,
      message: smsResult.success
        ? "Resident notified successfully"
        : `SMS failed: ${smsResult.error}`,
      error: smsResult.error,
    });
  } catch (error: any) {
    console.error("[Registration Status SMS] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 },
    );
  }
}
