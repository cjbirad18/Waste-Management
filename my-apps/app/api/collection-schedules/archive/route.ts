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
    const { scheduleId } = await req.json();

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: "Missing scheduleId" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("collection_schedules")
      .update({ status: "Archived" })
      .eq("schedule_id", scheduleId)
      .select("schedule_id, status");

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
          error: `Schedule archive returned no rows for schedule_id=${scheduleId}`,
        },
        { status: 404 },
      );
    }

    const archivedRow = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ success: true, data: archivedRow });
  } catch (error: any) {
    console.error("collection-schedules archive error:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 },
    );
  }
}
