import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(req: NextRequest) {
  try {
    const { scheduleId, days, start_time } = await req.json();

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: "Missing scheduleId" },
        { status: 400 },
      );
    }

    if (!days || !start_time) {
      return NextResponse.json(
        { success: false, error: "Missing days or start_time" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("collection_schedules")
      .update({ days, start_time })
      .eq("schedule_id", scheduleId)
      .select();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || JSON.stringify(error) },
        { status: 500 },
      );
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: "Schedule update returned no rows. Verify schedule_id.",
        },
        { status: 404 },
      );
    }

    const updatedSchedule = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({ success: true, data: updatedSchedule });
  } catch (error: any) {
    console.error("collection-schedules update error:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 },
    );
  }
}
