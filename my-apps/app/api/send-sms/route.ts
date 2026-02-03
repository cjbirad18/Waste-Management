// app/api/send-sms/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { to, message } = await req.json();

  console.log(`[Send SMS] Starting SMS send to: ${to}`);

  try {
    const apiToken = process.env.PHILSMS_API_TOKEN;
    const senderId = process.env.PHILSMS_SENDER_ID || "Track the Truck";

    if (!apiToken) {
      console.error("[Send SMS] CRITICAL: PHILSMS_API_TOKEN not configured");
      return NextResponse.json(
        {
          success: false,
          error: "SMS service not configured - missing API token",
        },
        { status: 500 },
      );
    }

    if (!to) {
      console.error("[Send SMS] Missing phone number");
      return NextResponse.json(
        { success: false, error: "Missing phone number (to)" },
        { status: 400 },
      );
    }

    if (!message) {
      console.error("[Send SMS] Missing message");
      return NextResponse.json(
        { success: false, error: "Missing message content" },
        { status: 400 },
      );
    }

    console.log(
      `[Send SMS] Config - Sender: ${senderId}, Token: ${apiToken.substring(0, 10)}...`,
    );

    // Format phone number: Convert 09XXXXXXXXX to 639XXXXXXXXX
    let phoneNumber = to.trim();
    if (phoneNumber.startsWith("0")) {
      phoneNumber = "63" + phoneNumber.substring(1);
    } else if (!phoneNumber.startsWith("63")) {
      phoneNumber = "63" + phoneNumber;
    }

    console.log(`[Send SMS] Phone formatted: ${to} -> ${phoneNumber}`);

    const payload = {
      recipient: phoneNumber,
      sender_id: senderId,
      message,
    };

    console.log(`[Send SMS] Payload prepared:`, {
      recipient: phoneNumber,
      sender_id: senderId,
      message_length: message.length,
    });

    const response = await fetch(
      "https://dashboard.philsms.com/api/v3/sms/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      },
    );

    const result = await response.json();

    console.log(`[Send SMS] PhilSMS API Response:`, {
      status: response.status,
      ok: response.ok,
      result: result,
    });

    if (!response.ok) {
      console.error(
        `[Send SMS] API Error (${response.status}):`,
        result.message || result,
      );
      return NextResponse.json(
        {
          success: false,
          error: result.message || "Failed to send SMS",
          details: result,
        },
        { status: response.status },
      );
    }

    console.log(`[Send SMS] SUCCESS: SMS sent to ${to}`);

    return NextResponse.json({
      success: true,
      message: "SMS sent successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("[Send SMS] Exception error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        type: error.name,
      },
      { status: 500 },
    );
  }
}
