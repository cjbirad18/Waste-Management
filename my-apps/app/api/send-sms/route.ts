// app/api/send-sms/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { to, message } = await req.json();

  try {
    const apiToken = process.env.PHILSMS_API_TOKEN;
    const senderId = process.env.PHILSMS_SENDER_ID || "PhilSMS";

    if (!apiToken) {
      return NextResponse.json(
        { success: false, error: "SMS service not configured" },
        { status: 500 },
      );
    }

    const payload = {
      recipient: to, // Format: 09XXXXXXXXX or 639XXXXXXXXX
      sender_id: senderId,
      message,
    };

    const response = await fetch("https://app.philsms.com/api/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = await response.json();
    console.log("PhilSMS response:", response.status, result);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: result.message || "Failed to send SMS" },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "SMS sent successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("PhilSMS route error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
