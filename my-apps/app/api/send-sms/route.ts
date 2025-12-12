// app/api/send-sms/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { to, message } = await req.json();

  try {
    const params = new URLSearchParams({
      apikey: process.env.SEMAPHORE_API_KEY || "",
      number: to, // e.g. "09998887777" or "639998887777"
      message,
      sendername: process.env.SEMAPHORE_SENDER_NAME || "SEMAPHORE",
    });

    const response = await fetch("https://semaphore.co/api/v4/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    });

    const text = await response.text();
    console.log("Semaphore raw response:", response.status, text);

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: text || "Failed to send SMS" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: text });
  } catch (error: any) {
    console.error("Semaphore route error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
